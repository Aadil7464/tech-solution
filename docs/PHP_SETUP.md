# PHP 8.2 website

The website now runs from the PHP front controller at the repository root. It renders the public pages and admin area directly, stores content and enquiries in MySQL, and does not need Node.js to serve the PHP site.

## Requirements

- PHP 8.2 or newer with `pdo_mysql`, `session` and `GD` (GD must support WebP for media uploads).
- MySQL 8.0 or newer.
- Apache with `mod_rewrite` and `.htaccess` enabled, or PHP's built-in development server.

`DOM` enables safe rich-text formatting. Without it, saved HTML is rendered as escaped text. `mbstring` is optional.

## Configure and install

Create a MySQL database and a dedicated database user. Set these server environment variables before running the installer:

```text
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=digital_mitra
DB_USER=your_database_user
DB_PASSWORD=your_database_password
```

Set administrator credentials for the initial setup run. Use a unique password; setup stores only its password hash.

```text
ADMIN_EMAIL=admin@example.com
ADMIN_NAME=Website Administrator
ADMIN_PASSWORD=use-a-unique-password-of-at-least-8-characters
ADMIN_ROLE=admin
```

Then run from the project root:

```powershell
php php/setup.php
```

The installer creates the schema and inserts starter pages, service descriptions and three original blog posts only when their slugs are missing. It creates an administrator only when all three `ADMIN_*` values are set; it will not reset an existing account. Remove the bootstrap credentials from the environment after setup.

Point the Apache document root to the repository root and allow the included `.htaccess` file. For local development:

```powershell
php -S 127.0.0.1:8080 -t . php/router.php
```

Open `http://127.0.0.1:8080`. The website is available at `/`; the admin sign-in is at `/admin/login`; `/health` checks the database connection. Set `APP_SECURE_COOKIE=1` when HTTPS terminates at a reverse proxy and PHP does not see the HTTPS request flag. Set `APP_DEBUG=1` only for local troubleshooting.

The application's uploads are stored under `php/storage/uploads`, outside the public document tree. Uploaded JPEG, PNG and WebP files are decoded and re-encoded as WebP; the original metadata is not retained. The public `/uploads/...` route serves only safe image filenames.

## Move existing MongoDB content

The PHP installer starts with clean starter content. To carry over content, users, settings and enquiries from MongoDB, first export the current database to newline-delimited JSON with MongoDB Database Tools. Keep this export private: user records contain password hashes and enquiry records contain personal information.

Example PowerShell commands (replace `MONGODB_URI` with the existing environment variable used by the Node application; do not put credentials in source files):

```powershell
New-Item -ItemType Directory -Force -Path .\mongo-export | Out-Null
$collections = @('blogs', 'services', 'portfolios', 'testimonials', 'pages', 'categories', 'users', 'leads', 'settings', 'activities', 'media')
foreach ($collection in $collections) {
  mongoexport --uri "$env:MONGODB_URI" --collection $collection --jsonFormat=relaxed --out ".\mongo-export\$collection.json"
  if ($LASTEXITCODE -ne 0) { throw "MongoDB export failed for $collection" }
}
```

After setting up the MySQL schema, import the exports:

```powershell
php php/import-mongo.php .\mongo-export
```

The importer keeps MongoDB object IDs where possible, retains content-specific fields in JSON, copies user password hashes so existing credentials continue to work, and imports leads/settings/activity/media records. It replaces only untouched PHP starter rows when a MongoDB record has the same content slug; other duplicate slugs are reported as skipped. Review the final counts and verify the site/admin before removing the private export.

`mongoexport` exports media metadata, not the image files. Copy existing uploaded images from the old configured upload directory to `php/storage/uploads` and verify their URLs before removing the old application or database. Keep a database backup during the migration. The old Node/MongoDB source and local database are intentionally left in this repository as a rollback/data source; they are not required to serve the PHP website.

## Admin and API

- Admin modules support pages, services, blogs, categories, portfolio entries, testimonials, settings, media, activity and enquiries. Public portfolio/testimonial entries require both approval and recorded client consent.
- Administrators can change their password, manage settings and content, upload images, and export filtered enquiries as CSV. Editors can manage service/blog/category content, enquiry status/notes and media.
- Drafts remain private. Scheduled items become public when their UTC publication time arrives.
- Public content and settings endpoints remain available under `/api/v1`; `POST /api/v1/leads` accepts JSON. Public enquiry submissions are rate limited to five per IP per 15 minutes.
- The contact form stores enquiries in MySQL. Email notifications use PHP's configured `mail()` transport when `LEAD_NOTIFICATION_EMAIL` is set; delivery depends on the hosting provider's mail configuration.

Run the PHP checks with:

```powershell
php php/tests.php
```

## Legacy source

The original Next.js and Express implementation remains under `frontend/` and `backend/` as a migration rollback/data reference. Do not start it as the PHP site's server. Its Node manifests, ignored dependencies, build output and local MongoDB files have not been deleted; this workspace already contains uncommitted changes and user data in those paths.
