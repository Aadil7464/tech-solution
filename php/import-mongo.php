<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit("Not found\n");
}

$directory = $argv[1] ?? '';
if ($directory === '' || !is_dir($directory)) {
    fwrite(STDERR, "Usage: php php/import-mongo.php <mongoexport-directory>\nExpected relaxed JSON exports such as blogs.json, leads.json and users.json.\n");
    exit(2);
}

function import_json_array(?string $value): array
{
    $decoded = $value ? json_decode($value, true) : [];
    return is_array($decoded) ? $decoded : [];
}

function decode_mongo_value(mixed $value): mixed
{
    if (!is_array($value)) {
        return $value;
    }
    if (isset($value['$oid']) && is_string($value['$oid'])) {
        return strtolower($value['$oid']);
    }
    if (array_key_exists('$date', $value)) {
        $date = $value['$date'];
        if (is_array($date) && isset($date['$numberLong'])) {
            return gmdate('Y-m-d H:i:s', (int) floor(((int) $date['$numberLong']) / 1000));
        }
        if (is_string($date)) {
            return (new DateTimeImmutable($date))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        }
        return null;
    }
    foreach (['$numberInt', '$numberLong', '$numberDouble', '$numberDecimal'] as $wrapper) {
        if (isset($value[$wrapper])) {
            return is_numeric($value[$wrapper]) ? 0 + $value[$wrapper] : $value[$wrapper];
        }
    }
    $result = [];
    foreach ($value as $key => $child) {
        $result[$key] = decode_mongo_value($child);
    }
    return $result;
}

function value_date(mixed $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_string($value)) {
        throw new RuntimeException('Encountered an unsupported date value in the export.');
    }
    return (new DateTimeImmutable($value, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
}

function document_id(array $document): string
{
    $id = $document['_id'] ?? '';
    return is_string($id) && preg_match('/^[a-f0-9]{24}$/i', $id) ? strtolower($id) : bin2hex(random_bytes(12));
}

$pdo = db();
$contentKinds = [
    'blogs' => 'blogs',
    'services' => 'services',
    'portfolios' => 'portfolio',
    'testimonials' => 'testimonials',
    'pages' => 'pages',
    'categories' => 'categories',
];
$files = 0;
$imported = 0;
$skipped = 0;

foreach ($contentKinds as $collection => $kind) {
    $file = rtrim($directory, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $collection . '.json';
    if (!is_file($file)) {
        continue;
    }
    $files++;
    $handle = fopen($file, 'rb');
    if ($handle === false) {
        throw new RuntimeException("Unable to read {$file}");
    }
    while (($line = fgets($handle)) !== false) {
        if (trim($line) === '') {
            continue;
        }
        $document = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
        $document = decode_mongo_value($document);
        if (!is_array($document) || empty($document['title']) || empty($document['slug'])) {
            $skipped++;
            continue;
        }
        $payload = $document;
        foreach (['_id', 'title', 'slug', 'excerpt', 'content', 'status', 'category', 'publishAt', 'order', 'approved', 'clientConsent', 'createdAt', 'updatedAt'] as $key) {
            unset($payload[$key]);
        }
        $payload['_mongoImported'] = true;
        $id = document_id($document);
        $status = in_array($document['status'] ?? '', ['draft', 'scheduled', 'published'], true) ? $document['status'] : 'published';
        $category = is_string($document['category'] ?? null) ? $document['category'] : '';
        $publishAt = value_date($document['publishAt'] ?? null);
        $approved = !empty($document['approved']) ? 1 : 0;
        $consent = !empty($document['clientConsent']) ? 1 : 0;
        $body = is_string($document['content'] ?? null) ? $document['content'] : '';
        $order = max(0, min(10000, (int) ($document['order'] ?? 0)));

        $existing = $pdo->prepare('SELECT id, payload FROM content WHERE kind = ? AND slug = ? LIMIT 1');
        $existing->execute([$kind, $document['slug']]);
        $match = $existing->fetch();
        $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($match) {
            if (empty(import_json_array($match['payload'])['_phpSeeded'])) {
                $skipped++;
                continue;
            }
            $stmt = $pdo->prepare('UPDATE content SET title = ?, excerpt = ?, body = ?, status = ?, category = ?, publish_at = ?, display_order = ?, approved = ?, client_consent = ?, payload = ? WHERE id = ?');
            $stmt->execute([$document['title'], $document['excerpt'] ?? '', $body, $status, $category, $publishAt, $order, $approved, $consent, $json, $match['id']]);
        } else {
            $stmt = $pdo->prepare('INSERT INTO content (id, kind, title, slug, excerpt, body, status, category, publish_at, display_order, approved, client_consent, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$id, $kind, $document['title'], $document['slug'], $document['excerpt'] ?? '', $body, $status, $category, $publishAt, $order, $approved, $consent, $json]);
        }
        $imported++;
    }
    fclose($handle);
}

$userFile = rtrim($directory, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'users.json';
if (is_file($userFile)) {
    $files++;
    $handle = fopen($userFile, 'rb');
    if ($handle === false) {
        throw new RuntimeException("Unable to read {$userFile}");
    }
    while (($line = fgets($handle)) !== false) {
        if (trim($line) === '') {
            continue;
        }
        $user = decode_mongo_value(json_decode($line, true, 512, JSON_THROW_ON_ERROR));
        if (empty($user['email']) || empty($user['passwordHash']) || !filter_var($user['email'], FILTER_VALIDATE_EMAIL)) {
            $skipped++;
            continue;
        }
        $stmt = $pdo->prepare('INSERT IGNORE INTO users (id, name, email, password_hash, role, session_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            document_id($user),
            $user['name'] ?? '',
            strtolower($user['email']),
            $user['passwordHash'],
            in_array($user['role'] ?? '', ['admin', 'editor'], true) ? $user['role'] : 'editor',
            max(0, (int) ($user['sessionVersion'] ?? 0)),
            value_date($user['createdAt'] ?? null) ?? gmdate('Y-m-d H:i:s'),
            value_date($user['updatedAt'] ?? null) ?? gmdate('Y-m-d H:i:s'),
        ]);
        if ($stmt->rowCount() > 0) {
            $imported++;
        } else {
            $skipped++;
        }
    }
    fclose($handle);
}

$leadFile = rtrim($directory, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'leads.json';
if (is_file($leadFile)) {
    $files++;
    $handle = fopen($leadFile, 'rb');
    if ($handle === false) {
        throw new RuntimeException("Unable to read {$leadFile}");
    }
    while (($line = fgets($handle)) !== false) {
        if (trim($line) === '') {
            continue;
        }
        $lead = decode_mongo_value(json_decode($line, true, 512, JSON_THROW_ON_ERROR));
        if (empty($lead['name']) || empty($lead['email']) || empty($lead['message'])) {
            $skipped++;
            continue;
        }
        $payload = $lead;
        foreach (['_id', 'leadId', 'name', 'email', 'company', 'phone', 'budget', 'service', 'message', 'status', 'notes', 'archivedAt', 'attribution', 'createdAt', 'updatedAt'] as $key) {
            unset($payload[$key]);
        }
        $status = match ($lead['status'] ?? 'New') {
            'Contacted', 'Qualified' => 'In Progress',
            'Converted' => 'Completed',
            'Lost' => 'Cancelled',
            default => in_array($lead['status'] ?? '', ['New', 'Pending', 'In Progress', 'Completed', 'Cancelled'], true) ? $lead['status'] : 'New',
        };
        $notificationStatus = in_array($lead['notificationStatus'] ?? '', ['pending', 'sent', 'failed', 'disabled'], true) ? $lead['notificationStatus'] : 'disabled';
        $stmt = $pdo->prepare('INSERT IGNORE INTO leads (id, lead_id, name, email, company, phone, budget, service, message, status, notification_status, notes, archived_at, attribution, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            document_id($lead),
            $lead['leadId'] ?? ('DMA-' . gmdate('Y') . '-' . strtoupper(bin2hex(random_bytes(4)))),
            $lead['name'],
            $lead['email'],
            $lead['company'] ?? '',
            $lead['phone'] ?? '',
            $lead['budget'] ?? '',
            $lead['service'] ?? '',
            $lead['message'],
            $status,
            $notificationStatus,
            $lead['notes'] ?? '',
            value_date($lead['archivedAt'] ?? null),
            json_encode($lead['attribution'] ?? [], JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE),
            json_encode($payload, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE),
            value_date($lead['createdAt'] ?? null) ?? gmdate('Y-m-d H:i:s'),
            value_date($lead['updatedAt'] ?? null) ?? gmdate('Y-m-d H:i:s'),
        ]);
        if ($stmt->rowCount() > 0) {
            $imported++;
        } else {
            $skipped++;
        }
    }
    fclose($handle);
}

$settingsFile = rtrim($directory, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'settings.json';
if (is_file($settingsFile)) {
    $files++;
    $handle = fopen($settingsFile, 'rb');
    if ($handle === false) {
        throw new RuntimeException("Unable to read {$settingsFile}");
    }
    $document = fgets($handle);
    fclose($handle);
    if ($document !== false) {
        $settings = decode_mongo_value(json_decode($document, true, 512, JSON_THROW_ON_ERROR));
        unset($settings['_id'], $settings['key'], $settings['createdAt'], $settings['updatedAt']);
        $pdo->prepare('INSERT INTO settings (setting_key, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)')
            ->execute(['site', json_encode($settings, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE)]);
        $imported++;
    }
}

$activityFile = rtrim($directory, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'activities.json';
if (is_file($activityFile)) {
    $files++;
    $handle = fopen($activityFile, 'rb');
    if ($handle === false) {
        throw new RuntimeException("Unable to read {$activityFile}");
    }
    while (($line = fgets($handle)) !== false) {
        if (trim($line) === '') {
            continue;
        }
        $activity = decode_mongo_value(json_decode($line, true, 512, JSON_THROW_ON_ERROR));
        if (empty($activity['action']) || empty($activity['resource'])) {
            $skipped++;
            continue;
        }
        $stmt = $pdo->prepare('INSERT INTO activity (actor_id, action, resource, resource_id, created_at) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([
            is_string($activity['actor'] ?? null) && preg_match('/^[a-f0-9]{24}$/i', $activity['actor']) ? strtolower($activity['actor']) : null,
            $activity['action'],
            $activity['resource'],
            (string) ($activity['resourceId'] ?? ''),
            value_date($activity['createdAt'] ?? null) ?? gmdate('Y-m-d H:i:s'),
        ]);
        $imported++;
    }
    fclose($handle);
}

$mediaFile = rtrim($directory, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'media.json';
if (is_file($mediaFile)) {
    $files++;
    $handle = fopen($mediaFile, 'rb');
    if ($handle === false) {
        throw new RuntimeException("Unable to read {$mediaFile}");
    }
    while (($line = fgets($handle)) !== false) {
        if (trim($line) === '') {
            continue;
        }
        $media = decode_mongo_value(json_decode($line, true, 512, JSON_THROW_ON_ERROR));
        if (empty($media['url'])) {
            $skipped++;
            continue;
        }
        $stmt = $pdo->prepare('INSERT IGNORE INTO media (id, filename, url, alt, mime, size, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            document_id($media),
            $media['filename'] ?? basename((string) $media['url']),
            $media['url'],
            $media['alt'] ?? '',
            $media['mime'] ?? '',
            max(0, (int) ($media['size'] ?? 0)),
            is_string($media['uploadedBy'] ?? null) && preg_match('/^[a-f0-9]{24}$/i', $media['uploadedBy']) ? strtolower($media['uploadedBy']) : null,
            value_date($media['createdAt'] ?? null) ?? gmdate('Y-m-d H:i:s'),
        ]);
        $stmt->rowCount() > 0 ? $imported++ : $skipped++;
    }
    fclose($handle);
}

if ($files === 0) {
    fwrite(STDERR, "No supported mongoexport JSON files were found in {$directory}\n");
    exit(2);
}

echo "MongoDB export import finished. Records inserted/replaced: {$imported}; skipped: {$skipped}.\n";
echo "Content with duplicate slugs is skipped unless it replaces an untouched PHP starter record.\n";
