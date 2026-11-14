<?php
declare(strict_types=1);

require_once __DIR__ . '/app.php';

function expect_value(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$safe = clean_rich_text(
    '<h2>Useful <em>content</em></h2><script>alert(1)</script><p onclick="alert(2)">Text</p><a href="javascript:alert(3)" title="x">link</a>',
);
expect_value(str_contains($safe, '<h2>Useful <em>content</em></h2>'), 'allowed formatting should remain');
expect_value(!str_contains($safe, '<script') && !str_contains($safe, 'alert('), 'script content and event handlers should be removed');
expect_value(!str_contains($safe, 'javascript:'), 'unsafe link schemes should be removed');
expect_value(asset_path('/logo/mark.svg', '') === '/frontend/public/logo/mark.svg', 'legacy logo paths should map to public assets');
expect_value(asset_path('javascript:alert(1)', '/safe.svg') === '/safe.svg', 'unsafe asset URLs should use the safe fallback');
expect_value(rebrand_public_value(['title' => 'About Digital Mitra Agency'])['title'] === 'About Tech Solutions', 'legacy brand text should be replaced on rendered pages');
expect_value(csv_cell('=SUM(A1:A2)') === "'=SUM(A1:A2)", 'spreadsheet formula values should be neutralized');
expect_value(csv_cell('plain, "quoted"') === 'plain, "quoted"', 'CSV writer should receive raw values for correct quoting');

echo "PHP unit checks passed.\n";
