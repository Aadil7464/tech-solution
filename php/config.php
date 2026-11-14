<?php
declare(strict_types=1);

function env_value(string $key, string $fallback = ''): string
{
    $value = getenv($key);
    return $value === false ? $fallback : $value;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = env_value('DB_HOST', '127.0.0.1');
    $port = env_value('DB_PORT', '3306');
    $name = env_value('DB_NAME', 'digital_mitra');
    $user = env_value('DB_USER', 'root');
    $password = env_value('DB_PASSWORD');
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");

    return $pdo;
}

function start_app_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.gc_maxlifetime', (string) (8 * 60 * 60));
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params([
        'lifetime' => 8 * 60 * 60,
        'httponly' => true,
        'secure' => env_value('APP_SECURE_COOKIE') === '1' || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'samesite' => 'Strict',
        'path' => '/',
    ]);
    session_start();
}
