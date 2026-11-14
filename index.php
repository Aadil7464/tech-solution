<?php
declare(strict_types=1);

require_once __DIR__ . '/php/app.php';

try {
    dispatch_request();
} catch (Throwable $error) {
    error_log(sprintf('PHP website error: %s (%s)', $error->getMessage(), $error::class));
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');
    $detail = env_value('APP_DEBUG') === '1' ? '<pre>' . htmlspecialchars((string) $error, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</pre>' : '';
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Website temporarily unavailable</title><body><main><h1>Website temporarily unavailable</h1><p>The request could not be completed. Please try again later.</p>' . $detail . '</main></body></html>';
}
