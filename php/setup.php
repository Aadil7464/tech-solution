<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit("Not found\n");
}

$pdo = db();
$schema = file_get_contents(__DIR__ . '/schema.sql');
if ($schema === false) {
    throw new RuntimeException('Unable to read php/schema.sql');
}
foreach (array_filter(array_map('trim', explode(';', $schema))) as $statement) {
    $pdo->exec($statement);
}

$settings = [
    'title' => 'Tech Solutions',
    'description' => 'Website development, mobile apps, SEO and performance marketing for your next chapter.',
    'email' => 'techsolutions286@gmail.com',
    'phone' => '',
    'whatsapp' => '',
    'logo' => '/frontend/public/tech-solutions-logo.png',
    'logoDark' => '/frontend/public/tech-solutions-logo.png',
    'footerText' => 'We help brands grow online with thoughtful digital solutions.',
    'address' => '',
    'socialLinks' => [],
    'defaultSeoTitle' => 'Tech Solutions | Development & Digital Marketing',
    'defaultSeoDescription' => 'Website development, mobile apps, SEO and performance marketing for your next chapter.',
];
$stmt = $pdo->prepare(
    'INSERT IGNORE INTO settings (setting_key, data) VALUES (?, ?)',
);
$stmt->execute(['site', json_encode($settings, JSON_THROW_ON_ERROR)]);

$pages = [
    [
        'home',
        'Transform Your Digital Presence Into Business Growth.',
        'From powerful websites to performance-driven digital marketing, we help businesses attract customers, build stronger brands and grow with confidence.',
        'Tech Solutions | Development & Digital Marketing',
    ],
    [
        'about',
        'Technology with purpose. A partnership with perspective.',
        'Thoughtful design, dependable development and purposeful digital marketing.',
        'About Tech Solutions',
    ],
    [
        'contact',
        'Let’s build your next chapter.',
        'Share your goals, your questions and what you have in mind. We will explore a practical scope.',
        'Contact Tech Solutions',
    ],
    [
        'services',
        'Digital Solutions Designed to Move Your Business Forward.',
        'Explore our development, marketing and creative services designed to strengthen your digital presence.',
        'Services | Tech Solutions',
    ],
    [
        'portfolio',
        'Work with a purpose.',
        'Approved projects and the thinking behind them.',
        'Portfolio | Tech Solutions',
    ],
    [
        'blog',
        'Ideas for the next move.',
        'Practical perspectives on technology, design and digital growth.',
        'Blog | Tech Solutions',
    ],
    [
        'privacy-policy',
        'Privacy Policy',
        'How we handle website enquiries and personal information.',
        'Privacy Policy',
    ],
    [
        'terms-and-conditions',
        'Terms & Conditions',
        'Website use and the starting point for working together.',
        'Terms & Conditions',
    ],
];

$insertContent = $pdo->prepare(
    'INSERT IGNORE INTO content
    (id, kind, title, slug, excerpt, body, status, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
);
foreach ($pages as [$slug, $title, $excerpt, $seoTitle]) {
    $payload = ['seoTitle' => $seoTitle, 'noindex' => in_array($slug, ['privacy-policy', 'terms-and-conditions'], true), '_phpSeeded' => true];
    $body = match ($slug) {
        'about' => '<h2>Your digital partner</h2><p>We help businesses connect the way they look, the tools they use and the way customers find them. We start with questions about your audience, operations and goals before discussing a solution.</p><h2>Clarity at every step</h2><p>We agree a practical scope, make responsibilities visible and explain progress in plain language.</p><h2>Connected by design</h2><p>A website, a mobile application and an advertising campaign should support the same business purpose.</p>',
        'privacy-policy' => '<p>Business policy template — complete the operating entity, jurisdiction and retention details before publication.</p><h2>Information you share</h2><p>When you enquire, we receive the details you submit so the team can respond to your project request.</p><h2>How information is used</h2><p>We use enquiry information to respond and manage the conversation. We do not sell enquiry details.</p><h2>Your requests</h2><p>Email techsolutions286@gmail.com to ask about access, correction or deletion.</p>',
        'terms-and-conditions' => '<p>Business terms template — complete the legal entity and applicable terms with appropriate review before publication.</p><h2>Website information</h2><p>Content explains our services and is not a binding proposal. Scope, timing, fees and deliverables are confirmed in a separate written agreement.</p><h2>Responsible use</h2><p>Do not misuse this website, attempt unauthorised access or submit unlawful material.</p>',
        default => '',
    };
    $insertContent->execute([
        bin2hex(random_bytes(12)),
        'pages',
        $title,
        $slug,
        $excerpt,
        $body,
        'published',
        json_encode($payload, JSON_THROW_ON_ERROR),
    ]);
}

$serviceRows = [
    ['Search Engine Optimization', 'search-engine-optimization', 'marketing', 'Build a search presence around the questions your customers actually ask.'],
    ['Google Ads / PPC', 'google-ads-ppc', 'marketing', 'Connect search demand with focused campaigns and relevant landing pages.'],
    ['Website Design & Development', 'website-design-development', 'development', 'Fast, accessible websites built around the actions your visitors need to take.'],
    ['Website Development', 'website-development', 'development', 'Responsive business websites with clear journeys, accessible interfaces and a maintainable content system.'],
    ['Web Application Development', 'web-application-development', 'development', 'Purpose-built web applications for customer portals, internal operations and connected workflows.'],
    ['E-commerce Development', 'e-commerce-development', 'development', 'Online stores designed around product discovery, dependable checkout and everyday operations.'],
    ['Custom Software Development', 'custom-software-development', 'development', 'Practical software for business processes that standard tools cannot comfortably support.'],
    ['Mobile App Development', 'mobile-app-development', 'development', 'Mobile experiences built around focused tasks, reliable APIs and small-screen usability.'],
    ['Website Maintenance', 'website-maintenance', 'development', 'Planned updates, backups, monitoring and routine website improvements.'],
    ['Search Engine Optimization', 'seo-services', 'marketing', 'An integrated SEO programme connecting technical health, search intent and useful content.'],
    ['Local SEO', 'local-seo', 'marketing', 'Accurate local business information and useful location content for the communities you serve.'],
    ['Technical SEO', 'technical-seo', 'marketing', 'Crawling, indexing, rendering, internal links and website performance investigation.'],
    ['On-Page SEO', 'on-page-seo', 'marketing', 'Search intent, page structure and internal links refined around customer needs.'],
    ['Off-Page SEO', 'off-page-seo', 'marketing', 'Thoughtful outreach and accurate business references without manipulative link schemes.'],
    ['Google Ads Management', 'google-ads', 'marketing', 'Search advertising built around intent, focused landing pages and measurable actions.'],
    ['Meta Ads Management', 'meta-ads', 'marketing', 'Facebook and Instagram campaigns connecting offers, creative tests and useful reporting.'],
    ['Social Media Marketing', 'social-media-marketing', 'marketing', 'Channel planning, editorial calendars and purposeful social content for your audience.'],
    ['Lead Generation', 'lead-generation', 'marketing', 'Connected landing pages, campaigns and qualification steps for your sales process.'],
    ['Content Marketing', 'content-marketing', 'marketing', 'Research-led content that helps people understand your offer and make informed decisions.'],
    ['Graphic Design', 'graphic-design', 'creative', 'A coherent visual system for brand communications, campaigns and marketing assets.'],
    ['Branding', 'branding', 'creative', 'Brand positioning, visual identity and practical guidelines for consistent communication.'],
];
$insertService = $pdo->prepare(
    'INSERT IGNORE INTO content
    (id, kind, title, slug, excerpt, body, status, category, display_order, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
);
foreach ($serviceRows as $order => [$title, $slug, $category, $excerpt]) {
    $insertService->execute([
        bin2hex(random_bytes(12)),
        'services',
        $title,
        $slug,
        $excerpt,
        '<h2>' . htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</h2><p>' . htmlspecialchars($excerpt, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p><p>We begin with your goals and current setup, agree a focused scope, share work at review milestones and document the handover.</p>',
        'published',
        $category,
        $order,
        json_encode(['seoTitle' => $title, 'metaDescription' => $excerpt, '_phpSeeded' => true], JSON_THROW_ON_ERROR),
    ]);
}

$insertCategory = $pdo->prepare(
    'INSERT IGNORE INTO content (id, kind, title, slug, excerpt, body, status, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
);
$insertCategory->execute([
    bin2hex(random_bytes(12)),
    'categories',
    'Strategy',
    'strategy',
    'Practical thinking for a more intentional digital presence.',
    '',
    'published',
    json_encode(['description' => 'Practical thinking for a more intentional digital presence.'], JSON_THROW_ON_ERROR),
]);

$posts = [
    [
        'Before you spend more on ads, check your landing page',
        'before-you-spend-more-on-ads',
        'A practical checklist for making the journey from ad click to enquiry clearer.',
        '<p>Advertising brings people to a page. What happens next depends on how clearly that page explains your offer and makes the next step available.</p><h2>Keep the promise consistent</h2><p>Read your ad and page headline together. They should describe the same offer in language a new visitor can understand.</p><h2>Remove uncertainty</h2><p>Explain who the offer is for, what happens after an enquiry and which details you need.</p><h2>Check the experience on a phone</h2><p>Check text size, form labels, keyboard behavior and loading speed on a small screen.</p>',
    ],
    [
        'A practical starting point for your SEO strategy',
        'a-practical-seo-starting-point',
        'Start with useful pages, a sound technical foundation and a measurement plan.',
        '<p>SEO planning begins with your audience and the decisions they need to make. A useful page answers a specific question and makes the next step clear.</p><h2>Understand your existing website</h2><p>Review crawlability, search queries and useful customer actions before setting priorities.</p><h2>Match pages to intent</h2><p>Group related customer questions and decide which deserve a dedicated page.</p><h2>Review and improve</h2><p>Choose meaningful indicators and review them consistently. Search visibility takes time and depends on many factors.</p>',
    ],
    [
        'What to include in a useful marketing brief',
        'writing-a-useful-marketing-brief',
        'A better brief helps everyone agree on the problem before discussing the solution.',
        '<p>A useful brief makes decisions easier. You do not need a long document, but you do need a shared understanding of what the work should achieve.</p><h2>Describe the business context</h2><p>Explain your offer, audience and current marketing setup.</p><h2>Define the desired action</h2><p>Specify what you want a visitor or customer to do.</p><h2>Agree on practical limits</h2><p>Share a budget range, timing, approval responsibilities and access requirements.</p>',
    ],
];
$insertBlog = $pdo->prepare(
    'INSERT IGNORE INTO content (id, kind, title, slug, excerpt, body, status, category, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
);
foreach ($posts as [$title, $slug, $excerpt, $body]) {
    $insertBlog->execute([
        bin2hex(random_bytes(12)),
        'blogs',
        $title,
        $slug,
        $excerpt,
        $body,
        'published',
        'strategy',
        json_encode(['author' => 'Tech Solutions', 'seoTitle' => $title, 'metaDescription' => $excerpt, '_phpSeeded' => true], JSON_THROW_ON_ERROR),
    ]);
}

$email = strtolower(trim(env_value('ADMIN_EMAIL')));
$password = env_value('ADMIN_PASSWORD');
$name = trim(env_value('ADMIN_NAME'));
$role = env_value('ADMIN_ROLE', 'admin');
if ($email !== '' || $password !== '' || $name !== '') {
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8 || strlen($password) > 72 || strlen($name) < 2 || !in_array($role, ['admin', 'editor'], true)) {
        throw new RuntimeException('Set a valid ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD (8–72 characters), and ADMIN_ROLE (admin or editor).');
    }
    $createUser = $pdo->prepare(
        'INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    );
    $createUser->execute([
        bin2hex(random_bytes(12)),
        $name,
        $email,
        password_hash($password, PASSWORD_DEFAULT),
        $role,
    ]);
    echo "Administrator account created. Remove the bootstrap credentials from the environment.\n";
} else {
    echo "No administrator created. Set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD, then run setup again.\n";
}

echo "PHP database schema and initial pages/services are ready.\n";
