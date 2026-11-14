<?php
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path = is_string($path) ? rawurldecode($path) : '/';
if (str_starts_with($path, '/php/') || str_starts_with($path, '/.') || (preg_match('/\.php$/i', $path) && $path !== '/index.php')) {
    http_response_code(404);
    exit("Not found\n");
}
$publicPath = preg_match('#^/(logo|media)/#', $path)
    ? '/frontend/public' . $path
    : $path;
$file = realpath(dirname(__DIR__) . $publicPath);
$root = realpath(dirname(__DIR__));
if ($file !== false && $root !== false && str_starts_with($file, $root . DIRECTORY_SEPARATOR) && is_file($file)) {
    return false;
}
require dirname(__DIR__) . '/index.php';
