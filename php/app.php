<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
start_app_session();

const APP_NAME = 'Tech Solutions';
const CONTENT_KINDS = ['blogs', 'services', 'portfolio', 'testimonials', 'pages', 'categories'];
const LEAD_STATUSES = ['New', 'Pending', 'In Progress', 'Completed', 'Cancelled'];

function rebrand_public_value(mixed $value): mixed
{
    if (is_string($value)) {
        return str_replace(['Digital Mitra Agency', 'Digital Mitra'], 'Tech Solutions', $value);
    }
    if (is_array($value)) {
        foreach ($value as $key => $item) {
            $value[$key] = rebrand_public_value($item);
        }
    }
    return $value;
}

function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function asset_path(string $value, string $fallback): string
{
    $path = trim($value);
    if ($path === '') {
        return $fallback;
    }
    if (str_starts_with($path, '/logo/') || str_starts_with($path, '/media/')) {
        return '/frontend/public' . $path;
    }
    if (str_starts_with($path, '/') && !str_starts_with($path, '//')) {
        return $path;
    }
    return preg_match('#^https?://#i', $path) ? $path : $fallback;
}

function text_length(string $value): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($value, 'UTF-8');
    }
    $matched = preg_match_all('/./us', $value, $unused);
    return $matched === false ? strlen($value) : $matched;
}

function text_slice(string $value, int $start, int $length): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($value, $start, $length, 'UTF-8');
    }
    $characters = preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY);
    if ($characters === false) {
        return substr($value, $start, $length);
    }
    return implode('', array_slice($characters, $start, $length));
}

function json_array(?string $value): array
{
    if (!$value) {
        return [];
    }
    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : [];
}

function setting_data(): array
{
    $stmt = db()->prepare('SELECT data FROM settings WHERE setting_key = ?');
    $stmt->execute(['site']);
    $row = $stmt->fetch();
    return $row ? json_array($row['data']) : [
        'title' => APP_NAME,
        'email' => 'digitalmitra786@gmail.com',
        'logo' => '/frontend/public/logo/tech-solution-agency.svg',
        'description' => 'Website development, mobile apps, SEO and performance marketing for your next chapter.',
    ];
}

function request_path(): string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    if (!is_string($path) || $path === '') {
        return '/';
    }
    return '/' . trim(rawurldecode($path), '/');
}

function redirect_to(string $path): never
{
    header('Location: ' . $path, true, 303);
    exit;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return (string) $_SESSION['csrf'];
}

function csrf_input(): string
{
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}

function require_csrf(): void
{
    $provided = (string) ($_POST['csrf'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!hash_equals(csrf_token(), $provided)) {
        http_response_code(403);
        exit('The form expired. Reload the page and try again.');
    }
}

function current_user(): ?array
{
    static $loaded = false;
    static $user = null;
    if ($loaded) {
        return $user;
    }
    $loaded = true;
    $id = $_SESSION['user_id'] ?? '';
    if (!is_string($id) || !preg_match('/^[a-f0-9]{24}$/', $id)) {
        return null;
    }
    $stmt = db()->prepare('SELECT id, name, email, role, session_version FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row || (int) $row['session_version'] !== (int) ($_SESSION['session_version'] ?? -1)) {
        $_SESSION = [];
        session_regenerate_id(true);
        return null;
    }
    $user = $row;
    return $user;
}

function require_user(): array
{
    $user = current_user();
    if (!$user) {
        redirect_to('/admin/login');
    }
    return $user;
}

function require_admin(array $user): void
{
    if ($user['role'] !== 'admin') {
        http_response_code(403);
        exit('Administrator access is required.');
    }
}

function record_activity(?string $actorId, string $action, string $resource, string $id = ''): void
{
    $stmt = db()->prepare('INSERT INTO activity (actor_id, action, resource, resource_id) VALUES (?, ?, ?, ?)');
    $stmt->execute([$actorId, $action, $resource, $id]);
}

final class RateLimitExceeded extends RuntimeException
{
}

function rate_limited(string $scope, int $limit, int $windowMinutes): bool
{
    $address = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $bucket = hash('sha256', $scope . '|' . $address);
    $sql = "INSERT INTO rate_limits (bucket, window_started_at, request_count)
            VALUES (?, UTC_TIMESTAMP(), 1)
            ON DUPLICATE KEY UPDATE
              request_count = IF(window_started_at < UTC_TIMESTAMP() - INTERVAL {$windowMinutes} MINUTE, 1, request_count + 1),
              window_started_at = IF(window_started_at < UTC_TIMESTAMP() - INTERVAL {$windowMinutes} MINUTE, UTC_TIMESTAMP(), window_started_at)";
    db()->prepare($sql)->execute([$bucket]);
    $stmt = db()->prepare('SELECT request_count FROM rate_limits WHERE bucket = ?');
    $stmt->execute([$bucket]);
    return (int) $stmt->fetchColumn() > $limit;
}

function visible_content_sql(string $kind): string
{
    $sql = "(status = 'published' AND (publish_at IS NULL OR publish_at <= UTC_TIMESTAMP()))
            OR (status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= UTC_TIMESTAMP())";
    if (in_array($kind, ['portfolio', 'testimonials'], true)) {
        $sql = "({$sql}) AND approved = 1 AND client_consent = 1";
    }
    return $sql;
}

function content_row(array $row): array
{
    $payload = json_array($row['payload'] ?? null);
    unset($payload['_phpSeeded']);
    unset($row['payload']);
    return array_merge($payload, $row, [
        '_id' => $row['id'] ?? '',
        'content' => $row['body'] ?? '',
        'publishAt' => $row['publish_at'] ?? null,
        'imageAlt' => $payload['imageAlt'] ?? '',
    ]);
}

function get_content(string $kind, ?string $slug = null): ?array
{
    if (!in_array($kind, CONTENT_KINDS, true)) {
        return null;
    }
    if ($slug === null) {
        return null;
    }
    $sql = 'SELECT * FROM content WHERE kind = ? AND slug = ? AND (' . visible_content_sql($kind) . ') LIMIT 1';
    $stmt = db()->prepare($sql);
    $stmt->execute([$kind, $slug]);
    $row = $stmt->fetch();
    return $row ? content_row($row) : null;
}

function list_content(string $kind, int $limit = 12, string $category = '', int $page = 1, string $search = ''): array
{
    if (!in_array($kind, CONTENT_KINDS, true)) {
        return [];
    }
    $where = 'kind = ? AND (' . visible_content_sql($kind) . ')';
    $params = [$kind];
    if ($category !== '') {
        $where .= ' AND category = ?';
        $params[] = $category;
    }
    if ($search !== '') {
        $where .= ' AND title LIKE ?';
        $params[] = '%' . addcslashes(text_slice($search, 0, 100), '%_\\') . '%';
    }
    $count = db()->prepare("SELECT COUNT(*) FROM content WHERE {$where}");
    $count->execute($params);
    $total = (int) $count->fetchColumn();
    $limit = max(1, min(50, $limit));
    $page = max(1, min(100000, $page));
    $offset = ($page - 1) * $limit;
    $stmt = db()->prepare("SELECT * FROM content WHERE {$where} ORDER BY display_order ASC, created_at DESC LIMIT {$limit} OFFSET {$offset}");
    $stmt->execute($params);
    return [
        'items' => array_map('content_row', $stmt->fetchAll()),
        'total' => $total,
        'page' => $page,
        'pages' => (int) ceil($total / $limit),
    ];
}

function clean_rich_text(string $html): string
{
    $allowed = ['p', 'br', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'blockquote'];
    if (!class_exists(DOMDocument::class)) {
        return nl2br(e(strip_tags($html)));
    }
    $document = new DOMDocument('1.0', 'UTF-8');
    $previous = libxml_use_internal_errors(true);
    $document->loadHTML('<?xml encoding="UTF-8"><div>' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);
    $root = $document->getElementsByTagName('div')->item(0);
    if (!$root) {
        return '';
    }
    $sanitize = function (DOMNode $node) use (&$sanitize, $allowed): string {
        if ($node instanceof DOMText) {
            return e($node->nodeValue ?? '');
        }
        if (!$node instanceof DOMElement) {
            return '';
        }
        $tag = strtolower($node->tagName);
        if (in_array($tag, ['script', 'style', 'iframe', 'object', 'svg', 'math'], true)) {
            return '';
        }
        $children = '';
        foreach (iterator_to_array($node->childNodes) as $child) {
            $children .= $sanitize($child);
        }
        if (!in_array($tag, $allowed, true)) {
            return $children;
        }
        if ($tag === 'br') {
            return '<br>';
        }
        $attrs = '';
        if ($tag === 'a') {
            $href = trim($node->getAttribute('href'));
            if (preg_match('/^(https?:\/\/|mailto:|\/(?!\/))[\pL\pN\-._~:\/?#\[\]@!$&\'()*+,;=%]*$/u', $href)) {
                $attrs = ' href="' . e($href) . '" rel="noopener noreferrer"';
                $title = $node->getAttribute('title');
                if ($title !== '') {
                    $attrs .= ' title="' . e($title) . '"';
                }
            }
        }
        return '<' . $tag . $attrs . '>' . $children . '</' . $tag . '>';
    };
    $output = '';
    foreach (iterator_to_array($root->childNodes) as $child) {
        $output .= $sanitize($child);
    }
    return $output;
}

function flash(string $message, string $type = 'success'): void
{
    $_SESSION['flash'] = ['message' => $message, 'type' => $type];
}

function render_flash(): string
{
    $item = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    if (!is_array($item) || !isset($item['message'])) {
        return '';
    }
    return '<p class="' . e($item['type'] === 'error' ? 'error' : 'success') . '" role="status">' . e($item['message']) . '</p>';
}

function header_html(array $settings, string $active = ''): string
{
    $logo = asset_path((string) ($settings['logo'] ?? ''), '/frontend/public/logo/tech-solution-agency.svg');
    $services = list_content('services', 50)['items'];
    $links = [['Home', '/'], ['About', '/about'], ['Services', '/services'], ['Portfolio', '/portfolio'], ['Blog', '/blog'], ['Contact', '/contact']];
    $html = '<a class="skip-link" href="#main">Skip to content</a><header class="header agency-header"><div class="container nav"><a href="/" aria-label="Tech Solutions home"><img class="header-logo" src="' . e($logo) . '" alt="' . e($settings['title'] ?? APP_NAME) . '" width="230" height="70"></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav">Menu <span aria-hidden="true">☰</span></button><nav id="main-nav" class="nav-links" aria-label="Main navigation">';
    foreach ($links as [$label, $href]) {
        $isActive = $active === $href || ($href !== '/' && str_starts_with($active, $href . '/'));
        $html .= '<a href="' . e($href) . '"' . ($isActive ? ' aria-current="page"' : '') . '>' . e($label) . '</a>';
    }
    $html .= '<a class="button small" href="/contact">Get a Free Quote <span aria-hidden="true">↗</span></a></nav></div></header>';
    return $html;
}

function footer_html(array $settings): string
{
    $logo = asset_path((string) ($settings['logoDark'] ?? $settings['logo'] ?? ''), '/frontend/public/logo/tech-solution-agency-dark.svg');
    $email = $settings['email'] ?? '';
    $html = '<footer class="agency-footer"><div class="container"><div class="agency-footer-grid"><div><a href="/" aria-label="Tech Solutions homepage"><img class="agency-footer-logo" src="' . e($logo) . '" alt="' . e($settings['title'] ?? APP_NAME) . '" width="240" height="76"></a><p>' . e($settings['footerText'] ?? 'We help brands grow online with thoughtful digital solutions.') . '</p></div><div><h3>Quick Links</h3><nav aria-label="Footer quick links"><a href="/">Home</a><a href="/about">About Us</a><a href="/services">Services</a><a href="/portfolio">Portfolio</a><a href="/blog">Blog</a><a href="/contact">Contact</a></nav></div><div><h3>Our Services</h3><nav aria-label="Footer services">';
    foreach (array_slice(list_content('services', 6)['items'], 0, 6) as $service) {
        $html .= '<a href="/services/' . e($service['slug']) . '"><span class="footer-icon" aria-hidden="true">↗</span>' . e($service['title']) . '</a>';
    }
    $html .= '<a class="footer-all-services" href="/services">View All Services ↗</a></nav></div><div><h3>Contact Us</h3>';
    if ($email !== '') {
        $html .= '<a class="footer-contact-line" href="mailto:' . e($email) . '"><span class="footer-icon" aria-hidden="true">✉</span>' . e($email) . '</a>';
    }
    foreach ([
        ['Mohammad Aadil', '7464891312'],
        ['Shadab Sheikh', '8941024813'],
        ['Mohd. Suleman', '6397554750'],
    ] as [$name, $phone]) {
        $html .= '<a class="footer-contact-line" href="tel:+91' . e($phone) . '"><span class="footer-icon" aria-hidden="true">☎</span><span>' . e($name) . '<strong>+91 ' . e($phone) . '</strong></span></a>';
    }
    $html .= '<div class="footer-contact-line"><span class="footer-icon" aria-hidden="true">⌖</span><span>Noida, Uttar Pradesh<br>Delhi<br>Bengaluru, Karnataka</span></div></div></div><div class="agency-footer-bottom"><span>© ' . date('Y') . ' Tech Solutions. All rights reserved.</span><nav aria-label="Legal links"><a href="/privacy-policy">Privacy Policy</a><a href="/terms-and-conditions">Terms &amp; Conditions</a><a href="/sitemap.xml">Sitemap</a></nav></div></div></footer><script src="/assets/site.js" defer></script>';
    return $html;
}

function page_html(string $title, string $description, string $body, string $active = '/', bool $noindex = false): never
{
    $title = rebrand_public_value($title);
    $description = rebrand_public_value($description);
    $body = rebrand_public_value($body);
    $settings = rebrand_public_value(setting_data());
    $siteTitle = $settings['title'] ?? APP_NAME;
    $fullTitle = $title === $siteTitle ? $title : $title . ' | ' . $siteTitle;
    $adminPage = str_starts_with($active, '/admin');
    header('Content-Type: text/html; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="' . e($description) . '"><meta name="robots" content="' . ($noindex ? 'noindex, nofollow' : 'index, follow') . '"><title>' . e($fullTitle) . '</title><link rel="icon" href="/frontend/public/favicon.ico" type="image/x-icon"><link rel="stylesheet" href="/assets/site.css"><link rel="stylesheet" href="/assets/site-shell.css"></head><body>';
    if (!$adminPage) {
        echo header_html($settings, $active);
    }
    echo '<main id="main">' . render_flash() . $body . '</main>';
    if (!$adminPage) {
        echo '<section class="growth-banner"><div class="growth-banner-inner"><div><span class="growth-eyebrow">READY FOR A PRACTICAL NEXT STEP?</span><h2>Let’s turn a good idea into <span>useful work.</span></h2><p>Tell us what you are building and we will help you find a clear place to start.</p></div><a class="growth-button" href="/contact">Talk to our team <span aria-hidden="true">↗</span></a></div></section>';
        echo footer_html($settings);
    } else {
        echo '<script src="/assets/site.js" defer></script>';
    }
    echo '</body></html>';
    exit;
}

function item_card(array $item, string $kind, int $index = 0): string
{
    $href = '/' . ($kind === 'blogs' ? 'blog' : $kind) . '/' . rawurlencode((string) $item['slug']);
    $label = $kind === 'blogs' ? 'READ ARTICLE' : ($kind === 'portfolio' ? 'VIEW PROJECT' : 'EXPLORE SERVICE');
    $image = $item['image'] ?? '';
    $html = '<article class="card article-card">';
    if ($image !== '') {
        $html .= '<a href="' . e($href) . '"><img src="' . e(asset_path($image, '')) . '" alt="' . e($item['imageAlt'] ?? '') . '" loading="lazy" width="600" height="360"></a>';
    } else {
        $html .= '<div class="article-art art-' . (($index % 2) + 1) . '"><span>' . e(strtoupper($kind === 'blogs' ? 'FROM THE JOURNAL' : $kind)) . '</span><b>' . e($item['title']) . '</b><span class="art-lines" aria-hidden="true"></span></div>';
    }
    $html .= '<div class="service-top"><span class="service-number">' . e(strtoupper($item['category'] ?? $kind)) . '</span><a class="arrow" href="' . e($href) . '" aria-label="Open ' . e($item['title']) . '">↗</a></div><div style="padding:18px 28px 28px"><h3><a href="' . e($href) . '">' . e($item['title']) . '</a></h3><p>' . e($item['excerpt'] ?? '') . '</p><a class="text-link" href="' . e($href) . '">' . e($label) . ' ↗</a></div></article>';
    return $html;
}

function card_grid(array $items, string $kind): string
{
    if (!$items) {
        $label = $kind === 'portfolio' ? 'approved case studies' : ($kind === 'blogs' ? 'articles' : 'services');
        return '<div class="empty"><p>No ' . e($label) . ' are available yet. Please check back soon.</p></div>';
    }
    $html = '<div class="card-grid">';
    foreach ($items as $index => $item) {
        $html .= item_card($item, $kind, $index);
    }
    return $html . '</div>';
}

function section_heading(string $eyebrow, string $title, string $link = '', string $linkText = ''): string
{
    $html = '<div class="section-heading"><div><span class="eyebrow">' . e($eyebrow) . '</span><h2>' . e($title) . '</h2></div>';
    if ($link !== '') {
        $html .= '<a class="text-link" href="' . e($link) . '">' . e($linkText) . ' ↗</a>';
    }
    return $html . '</div>';
}

function render_sections(mixed $sections): string
{
    if (!is_array($sections)) {
        return '';
    }
    $html = '';
    foreach ($sections as $section) {
        if (!is_array($section)) {
            continue;
        }
        $heading = trim((string) ($section['heading'] ?? ''));
        $body = trim((string) ($section['body'] ?? ''));
        $html .= '<section class="section container"><div class="prose">';
        if ($heading !== '') {
            $html .= '<h2>' . e($heading) . '</h2>';
        }
        if ($body !== '') {
            $html .= clean_rich_text($body);
        }
        $items = $section['items'] ?? [];
        if (is_array($items) && $items) {
            $html .= '<div class="card-grid">';
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $html .= '<article class="card" style="padding:24px"><h3>' . e($item['heading'] ?? '') . '</h3><p>' . e($item['body'] ?? '') . '</p></article>';
            }
            $html .= '</div>';
        }
        $url = trim((string) ($section['linkUrl'] ?? ''));
        $label = trim((string) ($section['linkLabel'] ?? ''));
        if ($label !== '' && preg_match('#^(/(?!/)|https://)#i', $url)) {
            $html .= '<p><a class="text-link" href="' . e($url) . '">' . e($label) . ' ↗</a></p>';
        }
        if (!empty($section['image'])) {
            $html .= '<img class="featured-image" src="' . e(asset_path((string) $section['image'], '')) . '" alt="' . e($section['imageAlt'] ?? '') . '" loading="lazy">';
        }
        $html .= '</div></section>';
    }
    return $html;
}

function render_faqs(mixed $faqs): string
{
    if (!is_array($faqs) || !$faqs) {
        return '';
    }
    $html = '<section class="container section faq-grid"><div><span class="eyebrow">YOUR QUESTIONS</span><h2>A few things you might be wondering.</h2></div><div>';
    foreach ($faqs as $faq) {
        if (!is_array($faq) || empty($faq['question']) || empty($faq['answer'])) {
            continue;
        }
        $html .= '<details><summary>' . e($faq['question']) . '<span aria-hidden="true">+</span></summary><p>' . e($faq['answer']) . '</p></details>';
    }
    return $html . '</div></section>';
}

function render_home(): never
{
    $page = get_content('pages', 'home') ?? [];
    $services = list_content('services', 6)['items'];
    $portfolio = list_content('portfolio', 3)['items'];
    $blogs = list_content('blogs', 3)['items'];
    $title = $page['title'] ?? 'Transform Your Digital Presence Into Business Growth.';
    $body = '<section class="mitra-hero"><div class="container hero-grid"><div class="hero-copy"><span class="hero-pill"><span></span> DIGITAL STRATEGY · CREATIVE · TECHNOLOGY</span><h1>' . e($title) . '</h1><p>' . e($page['excerpt'] ?? 'From powerful websites to performance-driven digital marketing, we help businesses attract customers, build stronger brands and grow with confidence.') . '</p><div class="hero-actions"><a class="button" href="/contact">Get a Free Strategy Call <span aria-hidden="true">↗</span></a><a class="button secondary" href="/services">Explore Our Services <span aria-hidden="true">→</span></a></div></div><div class="hero-media"><video autoplay muted loop playsinline poster="/frontend/public/media/team-collaboration.jpg" aria-label="Digital agency team collaborating on digital projects"><source src="/frontend/public/media/digital-agency.mp4" type="video/mp4"></video><div class="hero-media-overlay"></div><div class="hero-media-label"><span>STRATEGY</span><span>DESIGN</span><span>BUILD</span><span>GROWTH</span></div></div></div></section><div class="expertise-band"><div class="container"><span>THINK BIG. BUILD WITH PURPOSE.</span><p>Websites <i>✳</i> Applications <i>✳</i> Search <i>✳</i> Performance marketing</p></div></div><section class="section services-home"><div class="container">' . section_heading('02 / WHAT WE CAN BUILD TOGETHER', 'Built to connect. Designed to move you forward.', '/services', 'All services') . card_grid($services, 'services') . '</div></section><section class="section container purpose-section"><div class="purpose-media"><img src="/frontend/public/media/team-collaboration.jpg" alt="Digital team working together on a purposeful project" width="900" height="620" loading="lazy"></div><div class="purpose-copy"><span class="eyebrow">03 / ABOUT DIGITAL MITRA</span><h2>Work With Purpose.<br>Create Meaningful Growth.</h2><p>Strategy, creativity and technology work best when they move in the same direction. We connect every decision to a clear business outcome.</p><div class="purpose-benefits"><div><span>01</span><h3>Strategy Before Execution.</h3></div><div><span>02</span><h3>Creativity With Technology.</h3></div><div><span>03</span><h3>Growth That Matters.</h3></div></div><a class="button" href="/about">Discover our approach <span aria-hidden="true">↗</span></a></div></section><section class="section container process-section"><div class="container">' . section_heading('04 / THE WAY FORWARD', 'A clear path from ambition to action.') . '<div class="process-grid"><div><span class="process-index">01</span><h3>Discover</h3><p>Understand your audience, goals and the problem worth solving.</p></div><div><span class="process-index">02</span><h3>Plan</h3><p>Agree on priorities, a practical scope and a clear delivery plan.</p></div><div><span class="process-index">03</span><h3>Create</h3><p>Design, develop and review the work together at each milestone.</p></div><div><span class="process-index">04</span><h3>Grow</h3><p>Launch with care, learn from evidence and plan the next move.</p></div></div></div></section>';
    $body .= '<section class="section work-section"><div class="container">' . section_heading('06 / FEATURED PROJECTS', 'Work with a purpose.', '/portfolio', 'View portfolio') . card_grid($portfolio, 'portfolio') . '</div></section>';
    if ($blogs) {
        $body .= '<section class="section blog-home"><div class="container">' . section_heading('07 / FROM THE JOURNAL', 'Ideas for the next move.', '/blog', 'View all articles') . card_grid($blogs, 'blogs') . '</div></section>';
    }
    page_html($title, $page['metaDescription'] ?? 'Website development, mobile apps, SEO and performance marketing for your next chapter.', $body);
}

function render_listing(string $kind, string $route): never
{
    $config = [
        'services' => ['services', 'Digital solutions', 'Digital Solutions Designed to Move Your Business Forward.', 'Explore our development, marketing and creative services designed to strengthen your digital presence.'],
        'portfolio' => ['portfolio', 'Portfolio', 'Work with a purpose.', 'Approved projects and the thinking behind them.'],
        'blog' => ['blogs', 'Blog', 'Ideas for the next move.', 'Practical perspectives on technology, design and digital growth.'],
    ];
    [$dataKind, $label, $defaultTitle, $defaultExcerpt] = $config[$route];
    $cms = get_content('pages', $route);
    $category = trim((string) ($_GET['category'] ?? ''));
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $result = list_content($dataKind, $route === 'services' ? 24 : 9, $category, $page);
    $title = $cms['title'] ?? $defaultTitle;
    $excerpt = $cms['excerpt'] ?? $defaultExcerpt;
    $body = '<section class="page-hero inner-video-hero' . ($route === 'services' ? ' services-page-hero' : '') . '"><video class="page-video" autoplay muted loop playsinline poster="/frontend/public/media/' . ($route === 'portfolio' ? 'creative-design.jpg' : ($route === 'blog' ? 'digital-marketing.jpg' : 'team-collaboration.jpg')) . '" aria-hidden="true"><source src="/frontend/public/media/digital-agency.mp4" type="video/mp4"></video><div class="hero-content"><span class="eyebrow">' . e($label) . '</span><h1>' . e($title) . '</h1><p>' . e($excerpt) . '</p></div></section><section class="container section listing-section">';
    if ($route === 'services') {
        $body .= '<nav class="category-nav" aria-label="Service disciplines"><a href="/services">All Services</a><a href="/services?category=development">Development &amp; Technology</a><a href="/services?category=marketing">Digital Marketing</a><a href="/services?category=creative">Brand &amp; Creative</a></nav>';
    }
    if ($route === 'blog') {
        $categories = db()->query("SELECT title, slug FROM content WHERE kind = 'categories' AND status = 'published' ORDER BY title")->fetchAll();
        if ($categories) {
            $body .= '<nav class="category-nav" aria-label="Article categories"><a href="/blog">All articles</a>';
            foreach ($categories as $item) {
                $body .= '<a href="/blog/category/' . e(rawurlencode($item['slug'])) . '">' . e($item['title']) . '</a>';
            }
            $body .= '</nav>';
        }
    }
    if (!empty($cms['content'])) {
        $body .= '<article class="prose">' . clean_rich_text((string) $cms['content']) . '</article>';
    }
    $body .= card_grid($result['items'], $dataKind);
    if ($result['pages'] > 1) {
        $body .= '<div class="pagination"><span>Page ' . $page . ' of ' . $result['pages'] . '</span>';
        if ($page > 1) {
            $body .= '<a class="button secondary" href="?' . http_build_query(['page' => $page - 1, 'category' => $category]) . '">← Previous</a>';
        }
        if ($page < $result['pages']) {
            $body .= '<a class="button secondary" href="?' . http_build_query(['page' => $page + 1, 'category' => $category]) . '">Next →</a>';
        }
        $body .= '</div>';
    }
    $body .= '</section>';
    page_html($title, $excerpt, $body, '/' . $route, (bool) ($cms['noindex'] ?? false));
}

function render_detail(string $kind, string $slug, string $route): never
{
    $item = get_content($kind, $slug);
    if (!$item) {
        render_not_found();
    }
    $heading = '<section class="page-hero container"><nav class="breadcrumbs"><a href="/">Home</a><span>›</span><a href="/' . e($route) . '">' . e(ucfirst($route)) . '</a><span>›</span><span>' . e($item['title']) . '</span></nav><span class="eyebrow">' . e($item['category'] ?? $route) . '</span><h1>' . e($item['title']) . '</h1><p>' . e($item['excerpt'] ?? '') . '</p><div class="article-meta"><span>' . e($item['author'] ?? APP_NAME) . '</span></div></section>';
    $body = $heading . '<article class="container prose article-content">';
    if (!empty($item['image'])) {
        $body .= '<img class="featured-image" src="' . e(asset_path((string) $item['image'], '')) . '" alt="' . e($item['imageAlt'] ?? '') . '" width="1000" height="600">';
    }
    $body .= clean_rich_text((string) ($item['content'] ?? ''));
    $faqs = $item['faqs'] ?? [];
    if (is_array($faqs) && $faqs) {
        $body .= '<section class="faq-grid"><div><h2>Frequently asked questions</h2></div><div>';
        foreach ($faqs as $faq) {
            if (!is_array($faq)) {
                continue;
            }
            $body .= '<details><summary>' . e($faq['question'] ?? '') . '<span aria-hidden="true">+</span></summary><p>' . e($faq['answer'] ?? '') . '</p></details>';
        }
        $body .= '</div></section>';
    }
    $body .= '</article>';
    page_html((string) ($item['seoTitle'] ?? $item['title']), (string) ($item['metaDescription'] ?? $item['excerpt'] ?? ''), $body, '/' . $route, (bool) ($item['noindex'] ?? false));
}

function render_static_page(string $slug): never
{
    $item = get_content('pages', $slug);
    if (!$item) {
        render_not_found();
    }
    $body = '<section class="page-hero container"><span class="eyebrow">' . e($item['title']) . '</span><h1>' . e($item['title']) . '</h1><p>' . e($item['excerpt'] ?? '') . '</p></section><article class="container prose article-content">' . clean_rich_text((string) ($item['content'] ?? '')) . '</article>';
    page_html((string) ($item['seoTitle'] ?? $item['title']), (string) ($item['metaDescription'] ?? $item['excerpt'] ?? ''), $body, '/' . $slug, (bool) ($item['noindex'] ?? false));
}

function render_contact(): never
{
    $settings = setting_data();
    $page = get_content('pages', 'contact') ?? [];
    $services = list_content('services', 50)['items'];
    $phone = (string) ($settings['phone'] ?? '');
    $body = '<section class="page-hero inner-video-hero"><video class="page-video" autoplay muted loop playsinline poster="/frontend/public/media/team-collaboration.jpg" aria-hidden="true"><source src="/frontend/public/media/digital-agency.mp4" type="video/mp4"></video><div class="hero-content"><span class="eyebrow">LET’S FIND YOUR NEXT MOVE</span><h1>' . e($page['title'] ?? 'Let’s build your next chapter.') . '</h1><p>' . e($page['excerpt'] ?? 'Tell us what you are working towards. We will explore how we could help.') . '</p></div></section><section class="section container contact-grid"><div><div class="contact-details"><h2>Get in touch</h2>';
    if (!empty($settings['email'])) {
        $body .= '<a href="mailto:' . e($settings['email']) . '">' . e($settings['email']) . '</a>';
    }
    if ($phone !== '') {
        $body .= '<a href="tel:' . e(preg_replace('/[^+\d]/', '', $phone)) . '">' . e($phone) . '</a>';
    }
    if (!empty($settings['address'])) {
        $body .= '<p>' . nl2br(e($settings['address'])) . '</p>';
    }
    if (!empty($settings['whatsapp'])) {
        $body .= '<a class="button" href="https://wa.me/' . e(preg_replace('/\D/', '', (string) $settings['whatsapp'])) . '" target="_blank" rel="noopener noreferrer">Chat on WhatsApp ↗</a>';
    }
    $body .= '</div><p class="small-copy">Our team will review your project enquiry and get in touch.<br>No mailing list sign-up is required.</p></div><div class="form-panel"><h2>Tell us about your project</h2><form method="post" action="/contact" class="contact-form">' . csrf_input() . '<div class="form-two"><label>Your name <span>*</span><input name="name" required minlength="2" maxlength="100" autocomplete="name"></label><label>Email address <span>*</span><input type="email" name="email" required maxlength="254" autocomplete="email"></label></div><div class="form-two"><label>Mobile number<input type="tel" name="phone" maxlength="30" autocomplete="tel" placeholder="Include country code"></label><label>Company<input name="company" maxlength="200" autocomplete="organization"></label></div><div class="form-two"><label>Select service<select name="service"><option value="">Let’s find the right fit</option>';
    foreach ($services as $service) {
        $body .= '<option value="' . e($service['title']) . '">' . e($service['title']) . '</option>';
    }
    $body .= '</select></label><label>Project budget<select name="budget"><option value="">Choose a range (optional)</option><option value="under-25000">Under ₹25,000</option><option value="25000-50000">₹25,000–₹50,000</option><option value="50000-100000">₹50,000–₹1,00,000</option><option value="100000-plus">₹1,00,000+</option><option value="discuss">Let’s discuss</option></select></label></div><label>Tell us about your project <span>*</span><textarea name="message" rows="5" required minlength="20" maxlength="5000" placeholder="Your goals, challenges and what you have in mind…"></textarea></label><div class="honeypot" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="checkbox"><input type="checkbox" name="consent" value="1" required><span>I’ve read the <a href="/privacy-policy">privacy policy</a> and understand how my enquiry will be handled.</span></label><button class="button" type="submit">Send your enquiry <span aria-hidden="true">↗</span></button><p class="form-note">Fields marked * are required. Budget ranges help us understand your brief; they are not quoted prices.</p></form></div></section>';
    page_html((string) ($page['seoTitle'] ?? 'Contact Tech Solutions'), (string) ($page['metaDescription'] ?? $page['excerpt'] ?? ''), $body, '/contact');
}

function persist_lead(array $data): array
{
    $name = trim((string) ($data['name'] ?? ''));
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $message = trim((string) ($data['message'] ?? ''));
    if (text_length($name) < 2 || text_length($name) > 100 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254 || text_length($message) < 20 || text_length($message) > 5000) {
        throw new InvalidArgumentException('Please check your name, email address and project description.');
    }
    $phone = trim((string) ($data['phone'] ?? ''));
    if ($phone !== '' && (!preg_match('/^[+\d() .-]+$/', $phone) || strlen(preg_replace('/\D/', '', $phone)) < 7 || strlen(preg_replace('/\D/', '', $phone)) > 15)) {
        throw new InvalidArgumentException('Enter a valid phone number.');
    }
    $budget = (string) ($data['budget'] ?? '');
    if (!in_array($budget, ['', 'under-25000', '25000-50000', '50000-100000', '100000-plus', 'discuss'], true)) {
        throw new InvalidArgumentException('Choose a valid budget range.');
    }
    if (rate_limited('lead', 5, 15)) {
        throw new RateLimitExceeded('Too many enquiries from this network. Please try again later.');
    }
    $id = bin2hex(random_bytes(12));
    $leadId = 'DMA-' . gmdate('Y') . '-' . strtoupper(bin2hex(random_bytes(4)));
    $attribution = $data['attribution'] ?? [
        'source' => substr((string) ($_POST['utm_source'] ?? ''), 0, 200),
        'medium' => substr((string) ($_POST['utm_medium'] ?? ''), 0, 200),
        'campaign' => substr((string) ($_POST['utm_campaign'] ?? ''), 0, 200),
        'referrer' => substr((string) ($_SERVER['HTTP_REFERER'] ?? ''), 0, 1000),
        'landingPage' => substr((string) ($_SERVER['REQUEST_URI'] ?? '/contact'), 0, 1000),
    ];
    $stmt = db()->prepare('INSERT INTO leads (id, lead_id, name, email, company, phone, budget, service, message, attribution, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $id,
        $leadId,
        $name,
        $email,
        trim((string) ($data['company'] ?? '')),
        $phone,
        $budget,
        trim((string) ($data['service'] ?? '')),
        $message,
        json_encode($attribution, JSON_THROW_ON_ERROR),
        json_encode([], JSON_THROW_ON_ERROR),
    ]);
    $notificationStatus = 'disabled';
    $notificationError = '';
    $notifyTo = trim(env_value('LEAD_NOTIFICATION_EMAIL'));
    if ($notifyTo !== '') {
        if (!filter_var($notifyTo, FILTER_VALIDATE_EMAIL)) {
            $notificationStatus = 'failed';
            $notificationError = 'invalid_recipient';
            error_log('Lead notification is configured with an invalid recipient address.');
        } elseif (!function_exists('mail')) {
            $notificationStatus = 'failed';
            $notificationError = 'mail_transport_unavailable';
            error_log('Lead was saved, but PHP mail() is unavailable for email notifications.');
        } else {
            $subject = 'New website enquiry ' . $leadId;
            $mailBody = "New enquiry from {$name}\nEmail: {$email}\nPhone: {$phone}\nCompany: " . trim((string) ($data['company'] ?? '')) . "\nService: " . trim((string) ($data['service'] ?? '')) . "\nBudget: {$budget}\n\n{$message}\n";
            $headers = ['Content-Type: text/plain; charset=UTF-8', 'Reply-To: ' . $email];
            $mailFrom = trim(env_value('MAIL_FROM'));
            if ($mailFrom !== '' && filter_var($mailFrom, FILTER_VALIDATE_EMAIL)) {
                $headers[] = 'From: ' . APP_NAME . ' <' . $mailFrom . '>';
            }
            if (mail($notifyTo, $subject, $mailBody, implode("\r\n", $headers))) {
                $notificationStatus = 'sent';
            } else {
                $notificationStatus = 'failed';
                $notificationError = 'mail_transport_rejected';
                error_log('Lead was saved, but the configured PHP mail transport rejected its notification.');
            }
        }
    }
    db()->prepare('UPDATE leads SET notification_status = ?, notification_error = ? WHERE id = ?')
        ->execute([$notificationStatus, $notificationError, $id]);
    return ['id' => $id, 'leadId' => $leadId];
}

function handle_contact_post(): never
{
    require_csrf();
    if (trim((string) ($_POST['website'] ?? '')) !== '') {
        flash('Thank you. Your enquiry has been received.');
        redirect_to('/contact');
    }
    if (($_POST['consent'] ?? '') !== '1') {
        flash('Please confirm that you have read the privacy policy.', 'error');
        redirect_to('/contact');
    }
    try {
        persist_lead($_POST);
        flash('Thank you. Your enquiry has been received.');
    } catch (InvalidArgumentException | RuntimeException $error) {
        flash($error->getMessage(), 'error');
    }
    redirect_to('/contact');
}

function render_login(): never
{
    if (current_user()) {
        redirect_to('/admin');
    }
    $body = '<section class="login-page"><form method="post" action="/admin/login" class="login-form"><img src="/frontend/public/logo/tech-solution-agency.svg" alt="Tech Solutions" width="220"><h1>Administrator sign in</h1>' . render_flash() . csrf_input() . '<label>Email address<input type="email" name="email" required maxlength="254" autocomplete="username"></label><label>Password<input type="password" name="password" required maxlength="200" autocomplete="current-password"></label><button class="button" type="submit">Sign in</button></form></section>';
    page_html('Admin login', 'Sign in to manage website content.', $body, '/admin/login', true);
}

function render_admin(): never
{
    $user = require_user();
    $parts = explode('/', trim(request_path(), '/'));
    $module = $parts[1] ?? 'dashboard';
    $module = in_array($module, array_merge(['dashboard'], CONTENT_KINDS, ['leads', 'media', 'settings', 'activity', 'account']), true) ? $module : 'dashboard';
    $isAdmin = $user['role'] === 'admin';
    $flashMessage = render_flash();
    $body = '<div class="admin-shell"><aside class="admin-sidebar"><a class="footer-brand" href="/admin">TECH SOLUTIONS<br><small>ADMIN</small></a>';
    $modules = ['dashboard' => 'Dashboard', 'leads' => 'Enquiries', 'pages' => 'Pages', 'blogs' => 'Blogs', 'services' => 'Services', 'categories' => 'Categories', 'portfolio' => 'Portfolio', 'testimonials' => 'Testimonials', 'media' => 'Media', 'settings' => 'Settings', 'activity' => 'Activity', 'account' => 'Account'];
    foreach ($modules as $slug => $label) {
        if (!$isAdmin && in_array($slug, ['settings', 'activity', 'pages', 'portfolio', 'testimonials', 'account'], true)) {
            continue;
        }
        $body .= '<a class="' . ($slug === $module ? 'active' : '') . '" href="/admin/' . e($slug) . '">' . e($label) . '</a>';
    }
    $body .= '<form method="post" action="/admin/logout">' . csrf_input() . '<button class="button small" type="submit">Sign out</button></form></aside><section class="admin-content"><header class="admin-title"><div><h1>' . e($modules[$module]) . '</h1><p>Signed in as ' . e($user['name']) . ' · ' . e($user['role']) . '</p></div><a href="/" target="_blank" rel="noopener noreferrer">View website ↗</a></header>' . $flashMessage;
    if ($module === 'dashboard') {
        $leadCount = (int) db()->query("SELECT COUNT(*) FROM leads WHERE archived_at IS NULL")->fetchColumn();
        $newCount = (int) db()->query("SELECT COUNT(*) FROM leads WHERE archived_at IS NULL AND status = 'New'")->fetchColumn();
        $serviceCount = (int) db()->query("SELECT COUNT(*) FROM content WHERE kind = 'services' AND status = 'published'")->fetchColumn();
        $blogCount = (int) db()->query("SELECT COUNT(*) FROM content WHERE kind = 'blogs' AND status = 'published'")->fetchColumn();
        $body .= '<div class="stats-grid"><div class="stat"><b>' . $leadCount . '</b><span>Total enquiries</span></div><div class="stat"><b>' . $newCount . '</b><span>New enquiries</span></div><div class="stat"><b>' . $serviceCount . '</b><span>Published services</span></div><div class="stat"><b>' . $blogCount . '</b><span>Published articles</span></div></div><div class="admin-panel"><h2>Website content</h2><p>Manage your pages, services, articles, enquiries and public settings.</p><a class="button" href="/admin/leads">Review enquiries</a></div>';
    } elseif ($module === 'leads') {
        $search = trim((string) ($_GET['search'] ?? ''));
        $filterStatus = (string) ($_GET['status'] ?? '');
        $where = 'archived_at IS NULL';
        $params = [];
        if ($search !== '') {
            $where .= ' AND (name LIKE ? OR email LIKE ? OR company LIKE ?)';
            $term = '%' . text_slice($search, 0, 100) . '%';
            array_push($params, $term, $term, $term);
        }
        if (in_array($filterStatus, LEAD_STATUSES, true)) {
            $where .= ' AND status = ?';
            $params[] = $filterStatus;
        } else {
            $filterStatus = '';
        }
        $leadCountQuery = db()->prepare("SELECT COUNT(*) FROM leads WHERE {$where}");
        $leadCountQuery->execute($params);
        $leadTotal = (int) $leadCountQuery->fetchColumn();
        $leadPage = max(1, (int) ($_GET['page'] ?? 1));
        $leadLimit = 50;
        $leadOffset = ($leadPage - 1) * $leadLimit;
        $leadQuery = db()->prepare("SELECT * FROM leads WHERE {$where} ORDER BY created_at DESC LIMIT {$leadLimit} OFFSET {$leadOffset}");
        $leadQuery->execute($params);
        $leads = $leadQuery->fetchAll();
        $exportQuery = http_build_query(array_filter(['search' => $search, 'status' => $filterStatus], static fn ($value) => $value !== ''));
        $body .= '<form class="filters" method="get" action="/admin/leads"><input type="search" name="search" value="' . e($search) . '" placeholder="Search name, email or company"><select name="status"><option value="">All statuses</option>';
        foreach (LEAD_STATUSES as $status) {
            $body .= '<option value="' . e($status) . '"' . ($filterStatus === $status ? ' selected' : '') . '>' . e($status) . '</option>';
        }
        $body .= '</select><button class="button small" type="submit">Filter</button><a class="button secondary" href="/admin/leads/export' . ($exportQuery !== '' ? '?' . e($exportQuery) : '') . '">Export CSV</a></form><p>' . $leadTotal . ' enquiries</p>';
        $body .= '<div class="admin-panel"><div class="table-wrap"><table><thead><tr><th>Enquiry</th><th>Project</th><th>Status &amp; notes</th><th>Received</th></tr></thead><tbody>';
        foreach ($leads as $lead) {
            $body .= '<tr><td><strong>' . e($lead['name']) . '</strong><small>' . e($lead['email']) . '</small><small>' . e($lead['phone']) . '</small></td><td>' . e($lead['service']) . '<small>' . e($lead['budget']) . '</small><small>' . e($lead['message']) . '</small></td><td><small>Notification: ' . e($lead['notification_status']) . '</small><form method="post" action="/admin/leads/update">' . csrf_input() . '<input type="hidden" name="id" value="' . e($lead['id']) . '"><select name="status">';
            foreach (LEAD_STATUSES as $status) {
                $body .= '<option value="' . e($status) . '"' . ($lead['status'] === $status ? ' selected' : '') . '>' . e($status) . '</option>';
            }
            $body .= '</select><textarea name="notes" rows="2" maxlength="10000" placeholder="Internal notes">' . e($lead['notes']) . '</textarea><button type="submit">Save</button></form></td><td>' . e($lead['lead_id']) . '<small>' . e($lead['created_at']) . '</small></td></tr>';
        }
        $body .= '</tbody></table></div></div>';
        $leadPages = (int) ceil($leadTotal / $leadLimit);
        if ($leadPages > 1) {
            $body .= '<div class="pagination"><span>Page ' . $leadPage . ' of ' . $leadPages . '</span>';
            if ($leadPage > 1) {
                $body .= '<a class="button secondary" href="/admin/leads?' . e(http_build_query(array_merge(['page' => $leadPage - 1], array_filter(['search' => $search, 'status' => $filterStatus], static fn ($value) => $value !== ''))) ) . '">← Previous</a>';
            }
            if ($leadPage < $leadPages) {
                $body .= '<a class="button secondary" href="/admin/leads?' . e(http_build_query(array_merge(['page' => $leadPage + 1], array_filter(['search' => $search, 'status' => $filterStatus], static fn ($value) => $value !== ''))) ) . '">Next →</a>';
            }
            $body .= '</div>';
        }
    } elseif ($module === 'settings') {
        require_admin($user);
        $settings = setting_data();
        $body .= '<form class="admin-panel editor" method="post" action="/admin/settings/save">' . csrf_input() . '<h2>Website settings</h2><div class="form-two"><label>Website name<input name="title" maxlength="180" required value="' . e($settings['title'] ?? APP_NAME) . '"></label><label>Public email<input type="email" name="email" maxlength="254" value="' . e($settings['email'] ?? '') . '"></label></div><div class="form-two"><label>Phone<input name="phone" maxlength="30" value="' . e($settings['phone'] ?? '') . '"></label><label>WhatsApp number<input name="whatsapp" maxlength="30" value="' . e($settings['whatsapp'] ?? '') . '"></label></div><label>Business address<textarea name="address" rows="3">' . e($settings['address'] ?? '') . '</textarea></label><label>Footer text<input name="footerText" maxlength="500" value="' . e($settings['footerText'] ?? '') . '"></label><label>Light header logo URL<input name="logo" maxlength="1000" value="' . e($settings['logo'] ?? '') . '"></label><label>Dark footer logo URL<input name="logoDark" maxlength="1000" value="' . e($settings['logoDark'] ?? '') . '"></label><button class="button" type="submit">Save settings</button></form>';
    } elseif ($module === 'account') {
        require_admin($user);
        $body .= '<form class="admin-panel editor" method="post" action="/admin/account/password"><h2>Change password</h2>' . csrf_input() . '<label>Current password<input type="password" name="currentPassword" required maxlength="200" autocomplete="current-password"></label><label>New password<input type="password" name="newPassword" required minlength="8" maxlength="72" autocomplete="new-password"></label><label>Confirm new password<input type="password" name="confirmPassword" required minlength="8" maxlength="72" autocomplete="new-password"></label><button class="button" type="submit">Change password</button></form>';
    } elseif ($module === 'media') {
        $body .= '<form class="admin-panel editor" method="post" action="/admin/media/upload" enctype="multipart/form-data">' . csrf_input() . '<h2>Upload image</h2><label>Image (JPEG, PNG or WebP; up to 5 MB)<input type="file" name="image" accept="image/jpeg,image/png,image/webp" required></label><label>Alternative text<input name="alt" required maxlength="200"></label><button class="button" type="submit">Upload image</button></form><div class="admin-panel"><div class="table-wrap"><table><thead><tr><th>Image</th><th>Alternative text</th><th>URL</th><th>Actions</th></tr></thead><tbody>';
        $mediaItems = db()->query('SELECT * FROM media ORDER BY created_at DESC LIMIT 100')->fetchAll();
        foreach ($mediaItems as $media) {
            $body .= '<tr><td><img src="' . e($media['url']) . '" alt="" width="90" height="65"></td><td><form method="post" action="/admin/media/update">' . csrf_input() . '<input type="hidden" name="id" value="' . e($media['id']) . '"><input name="alt" required maxlength="200" value="' . e($media['alt']) . '"><button type="submit">Save alt text</button></form></td><td><code>' . e($media['url']) . '</code></td><td><form method="post" action="/admin/media/delete">' . csrf_input() . '<input type="hidden" name="id" value="' . e($media['id']) . '"><button type="submit">Delete</button></form></td></tr>';
        }
        $body .= '</tbody></table></div></div>';
    } elseif ($module === 'activity') {
        require_admin($user);
        $rows = db()->query('SELECT activity.*, users.name FROM activity LEFT JOIN users ON users.id = activity.actor_id ORDER BY activity.created_at DESC LIMIT 100')->fetchAll();
        $body .= '<div class="admin-panel"><div class="table-wrap"><table><thead><tr><th>Action</th><th>Resource</th><th>By</th><th>Time</th></tr></thead><tbody>';
        foreach ($rows as $row) {
            $body .= '<tr><td>' . e($row['action']) . '</td><td>' . e($row['resource']) . ' ' . e($row['resource_id']) . '</td><td>' . e($row['name'] ?? 'System') . '</td><td>' . e($row['created_at']) . '</td></tr>';
        }
        $body .= '</tbody></table></div></div>';
    } else {
        if (!$isAdmin && in_array($module, ['pages', 'portfolio', 'testimonials'], true)) {
            http_response_code(403);
            exit('Administrator access is required.');
        }
        $editId = (string) ($_GET['edit'] ?? '');
        $editing = null;
        if ($editId !== '') {
            $stmt = db()->prepare('SELECT * FROM content WHERE id = ? AND kind = ?');
            $stmt->execute([$editId, $module]);
            $row = $stmt->fetch();
            $editing = $row ? content_row($row) : null;
        }
        $canCreate = in_array($module, CONTENT_KINDS, true);
        if ($canCreate && ($editing || (isset($_GET['new']) && $_GET['new'] === '1'))) {
            $record = $editing ?? ['title' => '', 'slug' => '', 'excerpt' => '', 'content' => '', 'category' => '', 'status' => 'draft', 'image' => '', 'imageAlt' => '', 'approved' => 0, 'clientConsent' => 0];
            $body .= '<form class="admin-panel editor" method="post" action="/admin/content/save">' . csrf_input() . '<input type="hidden" name="kind" value="' . e($module) . '"><input type="hidden" name="id" value="' . e($record['_id'] ?? '') . '"><h2>' . ($editing ? 'Edit content' : 'Create content') . '</h2><label>Title<input name="title" required maxlength="180" value="' . e($record['title']) . '"></label><label>Slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxlength="120" value="' . e($record['slug']) . '"></label><label>Short description<textarea name="excerpt" maxlength="500" rows="2">' . e($record['excerpt']) . '</textarea></label><label>Content<textarea name="content" rows="14" maxlength="100000">' . e($record['content']) . '</textarea></label><div class="form-two"><label>Category<select name="category"><option value="">None</option><option value="development"' . (($record['category'] ?? '') === 'development' ? ' selected' : '') . '>Development &amp; technology</option><option value="marketing"' . (($record['category'] ?? '') === 'marketing' ? ' selected' : '') . '>Digital marketing</option><option value="creative"' . (($record['category'] ?? '') === 'creative' ? ' selected' : '') . '>Brand &amp; creative</option></select></label><label>Publication status<select name="status">';
            foreach (['draft', 'scheduled', 'published'] as $status) {
                $body .= '<option value="' . $status . '"' . (($record['status'] ?? '') === $status ? ' selected' : '') . '>' . ucfirst($status) . '</option>';
            }
            $publishedAt = '';
            if (!empty($record['publishAt'])) {
                $publishedAt = (new DateTimeImmutable((string) $record['publishAt'], new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i');
            }
            $body .= '</select></label></div><label>Publish date and time (UTC; required for scheduled content)<input type="datetime-local" name="publishAt" value="' . e($publishedAt) . '"></label><div class="form-two"><label>SEO title<input name="seoTitle" maxlength="70" value="' . e($record['seoTitle'] ?? '') . '"></label><label>Meta description<input name="metaDescription" maxlength="170" value="' . e($record['metaDescription'] ?? '') . '"></label></div><label>Image URL<input name="image" maxlength="2000" value="' . e($record['image'] ?? '') . '"></label><label>Image alt text<input name="imageAlt" maxlength="200" value="' . e($record['imageAlt'] ?? '') . '"></label>';
            if (in_array($module, ['portfolio', 'testimonials'], true)) {
                $body .= '<label class="checkbox"><input type="checkbox" name="approved" value="1"' . (!empty($record['approved']) ? ' checked' : '') . '><span>Approved for public display</span></label><label class="checkbox"><input type="checkbox" name="clientConsent" value="1"' . (!empty($record['clientConsent']) ? ' checked' : '') . '><span>Client consent recorded</span></label>';
            }
            $body .= '<div class="editor-actions"><button class="button" type="submit">Save content</button><a class="button secondary" href="/admin/' . e($module) . '">Cancel</a></div></form>';
        } else {
            $rows = db()->prepare('SELECT * FROM content WHERE kind = ? ORDER BY display_order, created_at DESC LIMIT 200');
            $rows->execute([$module]);
            $body .= '<div class="admin-title"><span></span><a class="button" href="/admin/' . e($module) . '?new=1">Add ' . e(rtrim($modules[$module], 's')) . '</a></div><div class="admin-panel"><div class="table-wrap"><table><thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
            foreach ($rows->fetchAll() as $row) {
                $body .= '<tr><td>' . e($row['title']) . '</td><td>' . e($row['slug']) . '</td><td><span class="badge">' . e($row['status']) . '</span></td><td><a href="/admin/' . e($module) . '?edit=' . e($row['id']) . '">Edit</a> ';
                if ($isAdmin) {
                    $body .= '<form method="post" action="/admin/content/delete" style="display:inline">' . csrf_input() . '<input type="hidden" name="kind" value="' . e($module) . '"><input type="hidden" name="id" value="' . e($row['id']) . '"><button type="submit">Delete</button></form>';
                }
                $body .= '</td></tr>';
            }
            $body .= '</tbody></table></div></div>';
        }
    }
    $body .= '</section></div>';
    page_html('Admin · ' . $modules[$module], 'Manage website content.', $body, '/admin', true);
}

function handle_admin_post(): never
{
    $user = current_user();
    $path = request_path();
    if ($path === '/admin/login') {
        require_csrf();
        if (rate_limited('login', 10, 15)) {
            flash('Too many sign-in attempts. Try again later.', 'error');
            redirect_to('/admin/login');
        }
        $email = strtolower(trim((string) ($_POST['email'] ?? '')));
        $stmt = db()->prepare('SELECT id, name, email, password_hash, role, session_version FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $candidate = $stmt->fetch();
        if (!$candidate || !password_verify((string) ($_POST['password'] ?? ''), $candidate['password_hash'])) {
            flash('Email or password is incorrect.', 'error');
            redirect_to('/admin/login');
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = $candidate['id'];
        $_SESSION['session_version'] = (int) $candidate['session_version'];
        unset($_SESSION['csrf']);
        record_activity($candidate['id'], 'login', 'auth', $candidate['id']);
        redirect_to('/admin');
    }
    if (!$user) {
        redirect_to('/admin/login');
    }
    require_csrf();
    if ($path === '/admin/logout') {
        $stmt = db()->prepare('UPDATE users SET session_version = session_version + 1 WHERE id = ?');
        $stmt->execute([$user['id']]);
        record_activity($user['id'], 'logout', 'auth', $user['id']);
        $_SESSION = [];
        session_regenerate_id(true);
        redirect_to('/admin/login');
    }
    if ($path === '/admin/leads/update') {
        $status = (string) ($_POST['status'] ?? '');
        $id = (string) ($_POST['id'] ?? '');
        if (!in_array($status, LEAD_STATUSES, true) || !preg_match('/^[a-f0-9]{24}$/', $id)) {
            flash('Invalid enquiry update.', 'error');
            redirect_to('/admin/leads');
        }
        $stmt = db()->prepare('UPDATE leads SET status = ?, notes = ? WHERE id = ?');
        $stmt->execute([$status, text_slice(trim((string) ($_POST['notes'] ?? '')), 0, 10000), $id]);
        record_activity($user['id'], 'update', 'leads', $id);
        flash('Enquiry updated.');
        redirect_to('/admin/leads');
    }
    if ($path === '/admin/settings/save') {
        require_admin($user);
        $settings = setting_data();
        foreach (['title', 'description', 'email', 'phone', 'whatsapp', 'address', 'footerText', 'logo', 'logoDark'] as $key) {
            $settings[$key] = trim((string) ($_POST[$key] ?? $settings[$key] ?? ''));
        }
        $validLogo = static fn (string $url): bool => $url === '' || str_starts_with($url, '/') && !str_starts_with($url, '//') || (bool) preg_match('#^https://#i', $url);
        if ($settings['title'] === '' || ($settings['email'] !== '' && !filter_var($settings['email'], FILTER_VALIDATE_EMAIL)) || !$validLogo($settings['logo']) || !$validLogo($settings['logoDark'])) {
            flash('Enter a website name and a valid contact email.', 'error');
            redirect_to('/admin/settings');
        }
        db()->prepare('INSERT INTO settings (setting_key, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)')
            ->execute(['site', json_encode($settings, JSON_THROW_ON_ERROR)]);
        record_activity($user['id'], 'update', 'settings', 'site');
        flash('Website settings saved.');
        redirect_to('/admin/settings');
    }
    if ($path === '/admin/account/password') {
        require_admin($user);
        $current = (string) ($_POST['currentPassword'] ?? '');
        $new = (string) ($_POST['newPassword'] ?? '');
        $confirm = (string) ($_POST['confirmPassword'] ?? '');
        $stmt = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        $hash = (string) $stmt->fetchColumn();
        if (!password_verify($current, $hash)) {
            flash('Current password is incorrect.', 'error');
            redirect_to('/admin/account');
        }
        if (strlen($new) < 8 || strlen($new) > 72 || $new !== $confirm) {
            flash('Use a matching new password between 8 and 72 characters.', 'error');
            redirect_to('/admin/account');
        }
        if (password_verify($new, $hash)) {
            flash('Choose a password different from the current password.', 'error');
            redirect_to('/admin/account');
        }
        db()->prepare('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?')
            ->execute([password_hash($new, PASSWORD_DEFAULT), $user['id']]);
        record_activity($user['id'], 'password_change', 'account', $user['id']);
        $_SESSION = [];
        session_regenerate_id(true);
        flash('Password changed. Sign in with your new password.');
        redirect_to('/admin/login');
    }
    if ($path === '/admin/media/upload') {
        if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
            flash('Choose an image to upload.', 'error');
            redirect_to('/admin/media');
        }
        $alt = trim((string) ($_POST['alt'] ?? ''));
        if ($alt === '' || text_length($alt) > 200) {
            flash('Enter alternative text of 1–200 characters.', 'error');
            redirect_to('/admin/media');
        }
        $file = $_FILES['image'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file((string) ($file['tmp_name'] ?? ''))) {
            flash('The image could not be uploaded. Choose a valid image under 5 MB.', 'error');
            redirect_to('/admin/media');
        }
        if ((int) ($file['size'] ?? 0) < 1 || (int) $file['size'] > 5 * 1024 * 1024) {
            flash('Images must be no larger than 5 MB.', 'error');
            redirect_to('/admin/media');
        }
        $source = file_get_contents((string) $file['tmp_name']);
        $imageInfo = $source === false ? false : getimagesizefromstring($source);
        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!$imageInfo || !in_array($imageInfo['mime'] ?? '', $allowedTypes, true)) {
            flash('Only valid JPEG, PNG and WebP images can be uploaded.', 'error');
            redirect_to('/admin/media');
        }
        $width = (int) ($imageInfo[0] ?? 0);
        $height = (int) ($imageInfo[1] ?? 0);
        if ($width < 1 || $height < 1 || $width > 6000 || $height > 6000 || $width * $height > 10000000) {
            flash('The image dimensions are too large. Use an image under 10 megapixels.', 'error');
            redirect_to('/admin/media');
        }
        if (!function_exists('imagecreatefromstring') || !function_exists('imagewebp')) {
            http_response_code(503);
            exit('Image uploads require the PHP GD extension with WebP support.');
        }
        $image = imagecreatefromstring($source);
        if (!$image) {
            flash('The image could not be decoded.', 'error');
            redirect_to('/admin/media');
        }
        if (function_exists('imagepalettetotruecolor')) {
            imagepalettetotruecolor($image);
        }
        imagealphablending($image, false);
        imagesavealpha($image, true);
        ob_start();
        $encoded = imagewebp($image, null, 82);
        $webp = ob_get_clean();
        imagedestroy($image);
        if (!$encoded || !is_string($webp) || $webp === '' || strlen($webp) > 5 * 1024 * 1024) {
            flash('The image could not be converted to WebP. Try a smaller image.', 'error');
            redirect_to('/admin/media');
        }
        $directory = __DIR__ . '/storage/uploads';
        if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
            throw new RuntimeException('The private image storage directory could not be created.');
        }
        $filename = bin2hex(random_bytes(16)) . '.webp';
        $destination = $directory . DIRECTORY_SEPARATOR . $filename;
        $handle = fopen($destination, 'xb');
        if ($handle === false) {
            throw new RuntimeException('A unique image file could not be created.');
        }
        $written = fwrite($handle, $webp);
        fclose($handle);
        if ($written !== strlen($webp)) {
            unlink($destination);
            throw new RuntimeException('The converted image could not be saved completely.');
        }
        $mediaId = bin2hex(random_bytes(12));
        $url = '/uploads/' . $filename;
        try {
            db()->prepare('INSERT INTO media (id, filename, url, alt, mime, size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
                ->execute([$mediaId, $filename, $url, $alt, 'image/webp', strlen($webp), $user['id']]);
        } catch (Throwable $error) {
            unlink($destination);
            throw $error;
        }
        record_activity($user['id'], 'upload', 'media', $mediaId);
        flash('Image uploaded and converted to WebP.');
        redirect_to('/admin/media');
    }
    if ($path === '/admin/media/update') {
        $id = (string) ($_POST['id'] ?? '');
        $alt = trim((string) ($_POST['alt'] ?? ''));
        if (!preg_match('/^[a-f0-9]{24}$/', $id) || $alt === '' || text_length($alt) > 200) {
            flash('Enter alternative text of 1–200 characters.', 'error');
            redirect_to('/admin/media');
        }
        db()->prepare('UPDATE media SET alt = ? WHERE id = ?')->execute([$alt, $id]);
        record_activity($user['id'], 'update', 'media', $id);
        flash('Image alternative text saved.');
        redirect_to('/admin/media');
    }
    if ($path === '/admin/media/delete') {
        require_admin($user);
        $id = (string) ($_POST['id'] ?? '');
        if (!preg_match('/^[a-f0-9]{24}$/', $id)) {
            flash('Invalid image record.', 'error');
            redirect_to('/admin/media');
        }
        $stmt = db()->prepare('SELECT * FROM media WHERE id = ?');
        $stmt->execute([$id]);
        $media = $stmt->fetch();
        if (!$media) {
            flash('Image not found.', 'error');
            redirect_to('/admin/media');
        }
        $references = db()->prepare('SELECT COUNT(*) FROM content WHERE LOCATE(?, CAST(payload AS CHAR)) > 0');
        $references->execute([$media['url']]);
        $settingsJson = json_encode(setting_data(), JSON_THROW_ON_ERROR);
        if ((int) $references->fetchColumn() > 0 || str_contains($settingsJson, $media['url'])) {
            flash('This image is still referenced by website content and cannot be deleted.', 'error');
            redirect_to('/admin/media');
        }
        $filename = basename((string) $media['filename']);
        if (preg_match('/^[a-f0-9]{32}\.webp$/', $filename)) {
            $file = __DIR__ . '/storage/uploads/' . $filename;
            if (is_file($file) && !unlink($file)) {
                throw new RuntimeException('The stored image file could not be deleted.');
            }
        }
        db()->prepare('DELETE FROM media WHERE id = ?')->execute([$id]);
        record_activity($user['id'], 'delete', 'media', $id);
        flash('Image deleted.');
        redirect_to('/admin/media');
    }
    if ($path === '/admin/content/save') {
        $kind = (string) ($_POST['kind'] ?? '');
        $id = (string) ($_POST['id'] ?? '');
        if (!in_array($kind, CONTENT_KINDS, true)) {
            http_response_code(422);
            exit('Invalid content type.');
        }
        if ($kind === 'pages' || in_array($kind, ['portfolio', 'testimonials'], true)) {
            require_admin($user);
        }
        $title = trim((string) ($_POST['title'] ?? ''));
        $slug = trim((string) ($_POST['slug'] ?? ''));
        $excerpt = trim((string) ($_POST['excerpt'] ?? ''));
        $status = (string) ($_POST['status'] ?? 'draft');
        $image = trim((string) ($_POST['image'] ?? ''));
        $imageAlt = trim((string) ($_POST['imageAlt'] ?? ''));
        if (text_length($title) < 2 || text_length($title) > 180 || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) || !in_array($status, ['draft', 'scheduled', 'published'], true) || text_length($excerpt) > 500 || ($image !== '' && $imageAlt === '')) {
            flash('Check the title, slug, description, status and image alt text.', 'error');
            redirect_to('/admin/' . $kind . ($id !== '' ? '?edit=' . rawurlencode($id) : '?new=1'));
        }
        $publishAtRaw = trim((string) ($_POST['publishAt'] ?? ''));
        $publishAt = null;
        if ($publishAtRaw !== '') {
            $date = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', $publishAtRaw, new DateTimeZone('UTC'));
            if (!$date || $date->format('Y-m-d\TH:i') !== $publishAtRaw) {
                flash('Enter a valid publication date and time in UTC.', 'error');
                redirect_to('/admin/' . $kind . ($id !== '' ? '?edit=' . rawurlencode($id) : '?new=1'));
            }
            $publishAt = $date->format('Y-m-d H:i:s');
        }
        if ($status === 'scheduled' && $publishAt === null) {
            flash('A publication date is required for scheduled content.', 'error');
            redirect_to('/admin/' . $kind . ($id !== '' ? '?edit=' . rawurlencode($id) : '?new=1'));
        }
        if ($image !== '' && !preg_match('#^(https?://|/(?!/))#i', $image)) {
            flash('Use an HTTP(S) image URL or a site-relative path.', 'error');
            redirect_to('/admin/' . $kind . ($id !== '' ? '?edit=' . rawurlencode($id) : '?new=1'));
        }
        $existingPayload = [];
        if ($id !== '') {
            $existingStmt = db()->prepare('SELECT payload FROM content WHERE id = ? AND kind = ?');
            $existingStmt->execute([$id, $kind]);
            $existing = $existingStmt->fetch();
            if (!$existing) {
                flash('Content record not found.', 'error');
                redirect_to('/admin/' . $kind);
            }
            $existingPayload = json_array($existing['payload']);
        }
        $payload = array_merge($existingPayload, [
            'image' => $image,
            'imageAlt' => $imageAlt,
            'approved' => isset($_POST['approved']) && $user['role'] === 'admin',
            'clientConsent' => isset($_POST['clientConsent']) && $user['role'] === 'admin',
            'seoTitle' => text_slice(trim((string) ($_POST['seoTitle'] ?? '')), 0, 70),
            'metaDescription' => text_slice(trim((string) ($_POST['metaDescription'] ?? '')), 0, 170),
            'publishAt' => $publishAt,
        ]);
        $body = clean_rich_text((string) ($_POST['content'] ?? ''));
        $category = trim((string) ($_POST['category'] ?? ''));
        try {
            if ($id === '') {
                $id = bin2hex(random_bytes(12));
                $stmt = db()->prepare('INSERT INTO content (id, kind, title, slug, excerpt, body, status, category, publish_at, approved, client_consent, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([$id, $kind, $title, $slug, $excerpt, $body, $status, $category, $publishAt, (int) $payload['approved'], (int) $payload['clientConsent'], json_encode($payload, JSON_THROW_ON_ERROR)]);
                record_activity($user['id'], 'create', $kind, $id);
            } else {
                if (!preg_match('/^[a-f0-9]{24}$/', $id)) {
                    throw new InvalidArgumentException('Invalid content record.');
                }
                $stmt = db()->prepare('UPDATE content SET title = ?, slug = ?, excerpt = ?, body = ?, status = ?, category = ?, publish_at = ?, approved = ?, client_consent = ?, payload = ? WHERE id = ? AND kind = ?');
                $stmt->execute([$title, $slug, $excerpt, $body, $status, $category, $publishAt, (int) $payload['approved'], (int) $payload['clientConsent'], json_encode($payload, JSON_THROW_ON_ERROR), $id, $kind]);
                record_activity($user['id'], 'update', $kind, $id);
            }
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                flash('That slug is already in use for this content type.', 'error');
                redirect_to('/admin/' . $kind . ($id !== '' ? '?edit=' . rawurlencode($id) : '?new=1'));
            }
            throw $error;
        }
        flash('Content saved.');
        redirect_to('/admin/' . $kind);
    }
    if ($path === '/admin/content/delete') {
        require_admin($user);
        $kind = (string) ($_POST['kind'] ?? '');
        $id = (string) ($_POST['id'] ?? '');
        if (!in_array($kind, CONTENT_KINDS, true) || !preg_match('/^[a-f0-9]{24}$/', $id)) {
            http_response_code(422);
            exit('Invalid content record.');
        }
        if ($kind === 'categories') {
            $lookup = db()->prepare('SELECT slug FROM content WHERE id = ? AND kind = ?');
            $lookup->execute([$id, $kind]);
            $slug = $lookup->fetchColumn();
            if ($slug !== false) {
                $posts = db()->prepare('SELECT COUNT(*) FROM content WHERE kind = ? AND category = ?');
                $posts->execute(['blogs', $slug]);
                if ((int) $posts->fetchColumn() > 0) {
                    flash('Move articles to another category before deleting this category.', 'error');
                    redirect_to('/admin/categories');
                }
            }
        }
        db()->prepare('DELETE FROM content WHERE id = ? AND kind = ?')->execute([$id, $kind]);
        record_activity($user['id'], 'delete', $kind, $id);
        flash('Content deleted.');
        redirect_to('/admin/' . $kind);
    }
    http_response_code(404);
    exit('Not found.');
}

function api_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function csv_cell(mixed $value): string
{
    $value = (string) $value;
    if (preg_match('/^[=+\-@\t\r]/', $value)) {
        $value = "'" . $value;
    }
    return $value;
}

function export_leads(): never
{
    $user = require_user();
    require_admin($user);
    $search = text_slice(trim((string) ($_GET['search'] ?? '')), 0, 100);
    $status = (string) ($_GET['status'] ?? '');
    $where = 'archived_at IS NULL';
    $params = [];
    if ($search !== '') {
        $where .= ' AND (name LIKE ? OR email LIKE ? OR company LIKE ?)';
        $term = '%' . $search . '%';
        array_push($params, $term, $term, $term);
    }
    if (in_array($status, LEAD_STATUSES, true)) {
        $where .= ' AND status = ?';
        $params[] = $status;
    }
    $stmt = db()->prepare("SELECT lead_id, name, email, company, phone, budget, service, status, notes, message, created_at FROM leads WHERE {$where} ORDER BY created_at DESC");
    $stmt->execute($params);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="digital-mitra-enquiries.csv"');
    header('Cache-Control: no-store');
    $output = fopen('php://output', 'wb');
    if ($output === false) {
        throw new RuntimeException('CSV export output could not be opened.');
    }
    fwrite($output, "\xEF\xBB\xBF");
    fputcsv($output, ['Lead ID', 'Name', 'Email', 'Company', 'Phone', 'Budget', 'Service', 'Status', 'Internal notes', 'Message', 'Received at']);
    while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
        fputcsv($output, array_map('csv_cell', $row));
    }
    fclose($output);
    exit;
}

function handle_api(): never
{
    $parts = explode('/', trim(request_path(), '/'));
    $resource = $parts[2] ?? '';
    $slug = $parts[3] ?? null;
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($resource === 'leads' && $method === 'POST') {
        $data = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($data)) {
            api_response(['error' => ['message' => 'Invalid JSON body.']], 400);
        }
        if (!empty($data['website'])) {
            api_response(['data' => ['id' => '', 'message' => 'Your enquiry has been received.']], 201);
        }
        try {
            $result = persist_lead($data);
            api_response(['data' => $result + ['message' => 'Your enquiry has been received.']], 201);
        } catch (RateLimitExceeded $error) {
            api_response(['error' => ['message' => $error->getMessage()]], 429);
        } catch (InvalidArgumentException $error) {
            api_response(['error' => ['message' => $error->getMessage()]], 422);
        }
    }
    if ($method !== 'GET') {
        api_response(['error' => ['message' => 'Method not allowed.']], 405);
    }
    if ($resource === 'settings') {
        $settings = setting_data();
        unset($settings['logoDark'], $settings['footerText']);
        api_response(['data' => $settings]);
    }
    if (!in_array($resource, CONTENT_KINDS, true)) {
        api_response(['error' => ['message' => 'Not found.']], 404);
    }
    if ($slug !== null) {
        $item = get_content($resource, $slug);
        $item ? api_response(['data' => $item]) : api_response(['error' => ['message' => 'Content not found.']], 404);
    }
    $result = list_content(
        $resource,
        max(1, min(50, (int) ($_GET['limit'] ?? 12))),
        (string) ($_GET['category'] ?? ''),
        max(1, (int) ($_GET['page'] ?? 1)),
        (string) ($_GET['search'] ?? ''),
    );
    api_response([
        'data' => $result['items'],
        'pagination' => ['page' => $result['page'], 'limit' => max(1, min(50, (int) ($_GET['limit'] ?? 12))), 'total' => $result['total'], 'pages' => $result['pages']],
    ]);
}

function render_not_found(): never
{
    http_response_code(404);
    $body = '<section class="center-page"><span class="eyebrow">404 · PAGE NOT FOUND</span><h1>This page is not available.</h1><p>The link may be incorrect, or the page may have moved.</p><a class="button" href="/">Return to homepage</a></section>';
    page_html('Page not found', 'The requested page could not be found.', $body, '/');
}

function dispatch_request(): never
{
    $path = request_path();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (str_starts_with($path, '/uploads/')) {
        $filename = substr($path, strlen('/uploads/'));
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.(?:webp|jpe?g|png)$/i', $filename)) {
            http_response_code(404);
            exit('Not found.');
        }
        $file = __DIR__ . '/storage/uploads/' . $filename;
        if (!is_file($file)) {
            http_response_code(404);
            exit('Not found.');
        }
        $mime = match (strtolower(pathinfo($filename, PATHINFO_EXTENSION))) {
            'webp' => 'image/webp',
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
        };
        header('Content-Type: ' . $mime);
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: public, max-age=31536000, immutable');
        header('Content-Length: ' . filesize($file));
        readfile($file);
        exit;
    }
    if ($path === '/health') {
        db()->query('SELECT 1');
        header('Content-Type: application/json; charset=utf-8');
        echo '{"status":"ok","database":"connected"}';
        exit;
    }
    if ($path === '/admin/leads/export' && $method === 'GET') {
        export_leads();
    }
    if (str_starts_with($path, '/api/v1/')) {
        handle_api();
    }
    if ($path === '/admin/login') {
        if ($method === 'POST') {
            handle_admin_post();
        }
        render_login();
    }
    if ($path === '/admin' || str_starts_with($path, '/admin/')) {
        if ($method === 'POST') {
            handle_admin_post();
        }
        render_admin();
    }
    if ($path === '/contact' && $method === 'POST') {
        handle_contact_post();
    }
    if ($path === '/sitemap.xml') {
        header('Content-Type: application/xml; charset=utf-8');
        $base = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
        echo '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        foreach (['', '/about', '/services', '/portfolio', '/blog', '/contact', '/privacy-policy', '/terms-and-conditions'] as $slug) {
            echo '<url><loc>' . e($base . $slug) . '</loc></url>';
        }
        foreach (['services', 'blogs', 'portfolio'] as $kind) {
            $items = list_content($kind, 50)['items'];
            foreach ($items as $item) {
                $route = $kind === 'blogs' ? 'blog' : $kind;
                echo '<url><loc>' . e($base . '/' . $route . '/' . rawurlencode((string) $item['slug'])) . '</loc></url>';
            }
        }
        echo '</urlset>';
        exit;
    }
    if ($path === '/robots.txt') {
        header('Content-Type: text/plain; charset=utf-8');
        echo "User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: " . e(((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/sitemap.xml') . "\n";
        exit;
    }
    if ($path === '/') {
        render_home();
    }
    if ($path === '/contact') {
        render_contact();
    }
    if ($path === '/services' || $path === '/portfolio' || $path === '/blog') {
        render_listing($path === '/services' ? 'services' : ($path === '/portfolio' ? 'portfolio' : 'blogs'), trim($path, '/'));
    }
    if (preg_match('#^/services/([a-z0-9-]+)$#', $path, $match)) {
        render_detail('services', $match[1], 'services');
    }
    if (preg_match('#^/blog/category/([a-z0-9-]+)$#', $path, $match)) {
        $category = $match[1];
        $result = list_content('blogs', 9, $category, max(1, (int) ($_GET['page'] ?? 1)));
        $body = '<section class="page-hero container"><span class="eyebrow">BLOG CATEGORY</span><h1>' . e(ucwords(str_replace('-', ' ', $category))) . '</h1><p>Articles in this category.</p></section><section class="container section listing-section">' . card_grid($result['items'], 'blogs') . '</section>';
        page_html(ucwords(str_replace('-', ' ', $category)) . ' articles', 'Articles in this category.', $body, '/blog');
    }
    if (preg_match('#^/blog/([a-z0-9-]+)$#', $path, $match)) {
        render_detail('blogs', $match[1], 'blog');
    }
    if (preg_match('#^/portfolio/([a-z0-9-]+)$#', $path, $match)) {
        render_detail('portfolio', $match[1], 'portfolio');
    }
    if (preg_match('#^/([a-z0-9-]+)$#', $path, $match)) {
        render_static_page($match[1]);
    }
    render_not_found();
}
