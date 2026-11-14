# Digital Mitra Agency — production readiness

Prepared 5 November 2026 (Asia/Calcutta).

Status: local verification is complete; production readiness is conditional. This request authorized a report only. No production environment, database, SMTP service or hosting account was accessed. No deployment, staging, commit or push was performed. Application code and existing work remain unchanged.

## 1. Approval gates and deployment assumptions

Latest direction: no provider/domain/database host/reverse proxy has been chosen. Use [HOSTING_INDEPENDENT_DEPLOYMENT.md](HOSTING_INDEPENDENT_DEPLOYMENT.md) for the current deployment contract and [FINAL_COMPLETION_REPORT.md](FINAL_COMPLETION_REPORT.md) for the latest local implementation/test evidence. Linux/systemd/nginx commands below remain optional examples only; no such production topology is assumed or configured.

Before execution, identify the production domain, host/OS, ingress topology, database/cluster name, storage location, SMTP provider, release artifact and recovery objectives.

Separate approval is required for:
1. Read-only production inspection.
2. Backups and any reviewed database migration.
3. Deployment and process/ingress changes.
4. Live verification that creates records or changes the real administrator password.
5. Any production rollback.

Commands below assume a Linux host with systemd, a TLS reverse proxy, one Next.js process on private port 3000 and one Express process on private port 4000. Paths, service names and variables are proposed conventions, not verified infrastructure. Hosting-specific commands cannot be finalized until a provider and host are selected. None of these commands was executed.

## 2. Required environment variables

Use a secret manager or restricted environment files outside the repository. Exclude local .env files from release artifacts; never overwrite production configuration with local files. Backend start also reads backend/.env if present, so avoid competing configuration sources.

| Process | Variable | Required production value |
| --- | --- | --- |
| Backend | NODE_ENV | production |
| Backend | PORT | Private port, e.g. 4000 |
| Backend | MONGODB_URI | Explicit production database with authentication and TLS appropriate to its deployment |
| Backend | JWT_SECRET | Stable random secret of at least 48 characters, no placeholder; same across API replicas |
| Backend | FRONTEND_URL | Exact canonical HTTPS origin, no trailing slash |
| Backend | PUBLIC_FRONTEND_URL | Externally reachable HTTPS origin for account emails |
| Backend | PUBLIC_API_URL | Public HTTPS origin serving /uploads |
| Backend | UPLOAD_DIR | Absolute durable path, e.g. /srv/digital-mitra/shared/uploads |
| Backend | SMTP_HOST | SMTP provider hostname |
| Backend | SMTP_PORT | Provider-approved port |
| Backend | SMTP_SECURE | true for implicit TLS, commonly 465; false for STARTTLS, commonly 587 |
| Backend | SMTP_USER / SMTP_PASS | Provider credentials when authentication is required |
| Backend | SMTP_FROM | Provider-authorized sender mailbox |
| Backend | LEAD_NOTIFICATION_EMAIL | digitalmitra786@gmail.com |
| Frontend build/runtime | API_INTERNAL_URL | Private API origin reachable from Next.js, e.g. http://127.0.0.1:4000 on the same host |
| Frontend build/runtime | NEXT_PUBLIC_SITE_URL | Final canonical HTTPS origin; set before building |
| Frontend runtime | NODE_ENV | production |

Leave NEXT_DIST_DIR unset for normal .next builds, or use the same approved value during build and start. FRONTEND_URLS is ignored by the backend in production. DEV_ALLOWED_ORIGINS is development-only and should be empty in production.

Optional: GOOGLE_SITE_VERIFICATION, NEXT_PUBLIC_GA4_ID, NEXT_PUBLIC_GTM_ID. Configure consent before enabling analytics. Microsoft Excel integration additionally uses MS_CLIENT_ID, MS_CLIENT_SECRET, MS_TENANT_ID, MS_DRIVE_ID, MS_WORKBOOK_ID, MS_TABLE_NAME and MS_GRAPH_TIMEOUT_MS if enabled.

ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME and ADMIN_ROLE are bootstrap-only inputs. They are not normal runtime requirements. Never bootstrap a duplicate administrator.

The application has localhost defaults for some URLs. Startup and environment parsing alone do not prove correct production values. Never print secrets, connection strings, reset tokens or complete environment objects.

## 3. MongoDB connection and backups

After read-only approval, verify the exact cluster/database, credentials' scope, collection counts, intended administrator and unique users.email index. Schema definitions do not establish that indexes already exist in production. Check normalized email conflicts as well as exact matches.

After read-only approval, verify the exact cluster/database, credentials' scope, collection counts, intended administrator and unique users.email index. Production server startup now sets autoIndex=false; prepare explicit reviewed index operations rather than relying on schema declarations to create production indexes. Check normalized email conflicts as well as exact matches.

Back up MongoDB AND uploaded files from a coordinated point. Record database identity, timestamp, upload snapshot ID, checksums, backup location, retention, recovery-point/recovery-time objectives and owner. Encrypt and store backups off-host with restricted access.

Prefer provider-supported snapshots/point-in-time recovery for a live busy database. For the database-scoped logical backup below, quiesce all writers for the coordinated backup window, including administrators and external integrations. Do not assume a live mongodump is consistent. Replica-set --oplog backup requires a separately reviewed full-deployment procedure; do not append it to a database-scoped dump.

Future approved Linux backup commands, with BACKUP_DIR and DB_NAME explicitly set:

~~~bash
umask 077
mkdir -p "$BACKUP_DIR"
mongodump --config=/etc/digital-mitra/mongodump.yml \
  --db="$DB_NAME" --archive="$BACKUP_DIR/database.archive.gz" --gzip
tar -C /srv/digital-mitra/shared \
  -czf "$BACKUP_DIR/uploads.tar.gz" uploads
sha256sum "$BACKUP_DIR/database.archive.gz" \
  "$BACKUP_DIR/uploads.tar.gz" > "$BACKUP_DIR/SHA256SUMS"
~~~

The restricted YAML holds the approved URI/password, avoiding credentials in process arguments. Do not enable shell tracing.

Rehearse restore into an EMPTY isolated destination using credentials unable to reach production:

~~~bash
mongorestore --config=/etc/digital-mitra/restore-rehearsal.yml \
  --archive="$BACKUP_DIR/database.archive.gz" --gzip \
  --nsInclude="$DB_NAME.*" --nsFrom="$DB_NAME.*" --nsTo="$RESTORE_DB.*"
~~~

Restore uploads to an isolated directory too. Validate counts, indexes, reference integrity and staging behavior with outbound email/integrations disabled. Do not use --drop against production. Use compatible MongoDB server/tool versions.

Official references: [mongodump](https://www.mongodb.com/docs/database-tools/mongodump/) and [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/).

## 4. Production administrator migration

The earlier migration affected only the local database. Production account state is unknown.

After approval:
1. Verify database identity and the intended existing admin's ID, role and current email.
2. Check every user for exact or normalized conflicts with digitalmitra786@gmail.com.
3. If the intended account already has that address, record a no-op.
4. If another account owns it, stop; do not merge, delete or overwrite accounts.
5. If ownership is ambiguous or no intended admin exists, stop for an account decision rather than automatically bootstrapping.
6. Record the approved before-state securely. Update only email on the exact approved user ID, with current email, role and password hash as update preconditions; no upsert.
7. Verify one modified document, unchanged ID/hash/role/sessionVersion and unchanged user count. Never output the password hash.
8. With live-test approval, verify dashboard access using the real credentials.

Rollback restores only the prior email with collision and current-value checks. Preserve legitimate password resets and session changes made after deployment. Never overwrite the entire old user document.

No blind migration command is provided because the production database and intended account ID have not been approved or inspected. A database-specific migration and inverse must be prepared from the approved inspection before execution.

## 5. SMTP readiness

Production SMTP has not been tested. Previous local provider acceptance and user-confirmed inbox receipt do not verify production configuration.

After approval, check DNS/network egress, provider authentication, authorized SMTP_FROM, quotas and sender/domain verification. Check applicable SPF/DKIM/DMARC alignment. Never disable certificate verification to make mail work.

Expected recipient: digitalmitra786@gmail.com.
Subject: Reset Your Digital Mitra Agency Admin Password.
Display name: Digital Mitra Agency.
Sender mailbox: authorized SMTP_FROM.
Link origin: actual HTTPS PUBLIC_FRONTEND_URL.

Reset tokens expire after 15 minutes; only token hashes are stored. Missing configuration or provider failure returns HTTP 503. SMTP now requires STARTTLS when SMTP_SECURE=false and uses implicit TLS when true; certificate verification remains enabled.

Separately approve a live reset test: receive the email, follow the link, reset the password, reject the old password, accept the new password, invalidate prior sessions and reject token reuse. This changes the real account and must not happen implicitly.

Redact account-link query strings at reverse proxy/CDN logs. Retain the application's admin no-referrer header.

## 6. Hosting, CORS, cookies, JWT and HTTPS

Reference topology:

Public HTTPS origin -> TLS reverse proxy -> Next.js:3000.
Browser /api/v1 -> existing Next rewrite -> private Express:4000.
Public /uploads -> Express /uploads or a reviewed mapping to its persistent directory.
Express /health -> private readiness check.
MongoDB -> private authenticated connection.

This is a server-rendered application, not a static export. The current filesystem-upload design is unsuitable for ephemeral serverless storage. Carry frontend/public, including /media, in the release.

Keep browser API traffic on the website origin. Host-only cookies and server-rendered admin checks expect the session there. Redirect alternate hosts to one canonical host. Preserve Origin and Set-Cookie through ingress, and do not CDN-cache auth/API/admin responses.

Production CORS permits only FRONTEND_URL; do not add wildcard credentialed CORS. Preserve CSRF validation, role authorization, rate limiting and security headers.

Cookies: HttpOnly, Secure when NODE_ENV=production, SameSite=Strict, path=/, host-only. JWT: HS256, eight-hour expiry, issuer/audience validation and database sessionVersion. Keep the existing issuer tech-solution-agency unless explicitly migrating sessions. Stable JWT_SECRET preserves sessions across normal restarts; secret rotation invalidates sessions.

Release gate: the actual hosting/proxy path is not selected. TRUSTED_PROXY_CIDRS now supports explicit verified proxy IPs/subnets and defaults to empty (trust disabled). Inspect the full ingress/Next API proxy chain before supplying any value; do not set unrestricted trust or disable limiter validation. Keep ports 3000/4000 private through firewall/container networking.

Rate limiting is per-process/in-memory. Use one API instance initially or implement/test a shared store before scaling. Define graceful restart, restart-on-failure, disk monitoring and readiness probes. Establish HTTPS redirects/certificates; add long-lived HSTS only after validating the domain/subdomain policy.

Set API_INTERNAL_URL and NEXT_PUBLIC_SITE_URL before the build. Next may serve fallback content when the API is unavailable, so a successful build or HTTP 200 does not prove connected CMS data.

Official references: [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting) and [express-rate-limit proxy configuration errors](https://express-rate-limit.mintlify.app/reference/error-codes#err-erl-unexpected-x-forwarded-for).

## 7. Uploads and branding paths

UPLOAD_DIR must persist across releases, e.g. /srv/digital-mitra/shared/uploads. Grant the service account read/write access, prevent file execution and back up the directory with MongoDB. Align proxy request limits with the application's 5 MB image limit plus multipart overhead.

Media URLs are saved as absolute PUBLIC_API_URL-based URLs. Changing the variable fixes future uploads only. After approval, inventory production Media.url and embedded content references for localhost/LAN/HTTP/obsolete-host paths. Prepare an exact reversible mapping; no blind global replacement.

Retain these public assets:

- /logo/digital-mitra-agency.svg — default header/login.
- /logo/digital-mitra-agency-dark.svg — default footer.
- /logo/horizontal.svg — compatible horizontal alias.
- /logo/favicon.svg and /favicon.ico — standalone DM favicon.
- /logo/icon-32.png, /logo/icon-180.png, /logo/icon-192.png, /logo/icon-512.png.
- Existing legacy aliases and all /media files.

Inspect production settings.logo and logoDark because configured overrides can replace defaults. Verify transparency, aspect ratio and mobile sizing against actual public URLs.

## 8. Migration and rollback strategy

Do not automatically run npm run seed or npm run bootstrap on production.

seed is not a versioned migration. It can insert services/pages/articles/categories, fill missing FAQ/category/section fields and mark legacy service aliases as draft. Review its actual delta first. The current catalog has 19 active services, including Branding and Google Business Profile; the older deployment document's count of 17 is stale.

Prepare narrow approved migrations for the intended admin email, settings/business email, reviewed old-email references, missing branding/google-business-profile records via $setOnInsert, explicit media URL mappings and any required indexes. Preserve existing CMS edits and customer records; do not copy the local database into production.

For every migration record its ID, database identity, expected document IDs/counts, preconditions, before/after fields, inserted IDs and verification outcome.

Rollback:
1. Quiesce writes if consistency is uncertain.
2. Switch to the previous application/ingress release, preserving durable uploads and compatible environment.
3. Keep additive data when the older application can use it.
4. Apply inverse migrations only with approval and conditional field checks. Preserve later edits, enquiries, password resets and sessions.
5. For disaster recovery, restore the coordinated backup into a NEW database and upload directory, validate, then approve switching to that pair. Reconcile post-backup writes before reopening.

Retain the prior artifact and environment version. Do not rotate JWT_SECRET during a routine rollback. Do not automatically delete newly inserted services or uploads once references may exist.

## 9. Exact command sequence for the reference Linux host

All commands are future instructions requiring the approval gates above. RELEASE_DIR must be a NEW absolute release directory; RELEASE_ARCHIVE an approved artifact. Public-domain variables contain no secrets. Production secrets are loaded from restricted files.

### A. Build and staging

Use the locally verified runtime versions as the release baseline: Node.js 24.16.0 and npm 11.13.0. Record and pin the approved runtime versions on the target host.

Because the reviewed workspace is uncommitted, remote Git HEAD may not contain these changes. Prepare and approve a release archive/checksum without staging, committing or pushing. Exclude .env files, node_modules, .next*, local databases, uploads and screenshots; include package-lock.json, backend, frontend and frontend/public.

~~~bash
mkdir -p "$RELEASE_DIR"
tar -xzf "$RELEASE_ARCHIVE" -C "$RELEASE_DIR"
cd "$RELEASE_DIR"

npm ci
npm run typecheck -w frontend -- --incremental false
npm test
CHROME_PATH=/usr/bin/google-chrome node scripts/final-audit.mjs

cd "$RELEASE_DIR/frontend"
node --env-file=/etc/digital-mitra/frontend.env \
  ../node_modules/next/dist/bin/next build
~~~

Set CHROME_PATH to the actual Chrome/Chromium executable. The browser audit uses disposable MongoDB and staging-only ports. Do not substitute production data into the browser scripts.

Build on the runtime OS/architecture class for native dependencies such as sharp. Retain full dependencies for this initial reference deployment; do not add an untested prune/standalone packaging step. Supply correct build-time URLs, exclude local frontend .env.local overrides and leave NEXT_DIST_DIR unset for this normal build.

### B. Backup and migrations

After explicit production-access approval, perform the inspected-target backup and isolated restore rehearsal from section 3. Then approve the migration delta.

A future reviewed migration artifact would be executed as follows:

~~~bash
cd "$RELEASE_DIR"
node --env-file=/etc/digital-mitra/backend.env \
  --env-file=/etc/digital-mitra/approved-migration.env \
  /etc/digital-mitra/approved-release-migration.mjs
~~~

That migration file does NOT currently exist. It must be written and reviewed after approved production inspection, enforcing sections 4 and 8. This is not represented as a ready-to-run migration.

### C. Supervised process configuration

Prepare complete systemd units named digital-mitra-api and digital-mitra-web. Use the actual Node installation path; the following assumes /usr/bin/node and a dedicated unprivileged digital-mitra user/group.

Backend [Service] core:

~~~ini
[Service]
Type=simple
User=digital-mitra
Group=digital-mitra
WorkingDirectory=/srv/digital-mitra/current/backend
ExecStart=/usr/bin/node --env-file=/etc/digital-mitra/backend.env src/server.js
Restart=on-failure
TimeoutStopSec=30
UMask=0027
~~~

Frontend [Service] core:

~~~ini
[Service]
Type=simple
User=digital-mitra
Group=digital-mitra
WorkingDirectory=/srv/digital-mitra/current/frontend
ExecStart=/usr/bin/node --env-file=/etc/digital-mitra/frontend.env ../node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000
Restart=on-failure
TimeoutStopSec=30
UMask=0027
~~~

Finalize [Unit]/[Install] sections, network dependencies, upload/cache permissions, logging and secret-file access before approval/installation. These units are proposed, not installed.

Equivalent application commands for another process manager that injects the reviewed environment:

~~~bash
npm run start -w backend
npm run start -w frontend -- --hostname 127.0.0.1 --port 3000
~~~

### D. Approved activation

Record the previous current target as PREVIOUS_RELEASE. Confirm RELEASE_DIR is the approved artifact directory and no current.next link exists before switching.

~~~bash
readlink -f /srv/digital-mitra/current
ln -s "$RELEASE_DIR" /srv/digital-mitra/current.next
mv -Tf /srv/digital-mitra/current.next /srv/digital-mitra/current

sudo systemctl daemon-reload
sudo systemctl restart digital-mitra-api
curl --fail --silent --show-error http://127.0.0.1:4000/health
sudo systemctl restart digital-mitra-web
curl --fail --silent --show-error http://127.0.0.1:3000/ > /dev/null

sudo nginx -t
sudo systemctl reload nginx
~~~

TLS certificates and the nginx virtual host must already be reviewed for the actual domain, /uploads routing, API/Next proxying, correct Origin/Set-Cookie behavior, cache exclusions, client IPs and account-query log redaction. Do not activate before resolving the trust-proxy blocker.

### E. Approved live verification

Set PUBLIC_ORIGIN to the real canonical HTTPS origin. Even read-only probes access production and require the agreed approval.

~~~bash
curl --fail --silent --show-error "$PUBLIC_ORIGIN/" > /dev/null
curl --fail --silent --show-error "$PUBLIC_ORIGIN/services" > /dev/null
curl --fail --silent --show-error "$PUBLIC_ORIGIN/contact" > /dev/null
curl --fail --silent --show-error "$PUBLIC_ORIGIN/robots.txt"
curl --fail --silent --show-error "$PUBLIC_ORIGIN/sitemap.xml" > /dev/null
curl --fail --silent --show-error "$PUBLIC_ORIGIN/logo/digital-mitra-agency.svg" > /dev/null
curl --fail --silent --show-error "$PUBLIC_ORIGIN/logo/digital-mitra-agency-dark.svg" > /dev/null
curl --fail --silent --show-error "$PUBLIC_ORIGIN/logo/favicon.svg" > /dev/null
curl --fail --silent --show-error "$PUBLIC_ORIGIN/favicon.ico" > /dev/null
~~~

Check actual existing upload URLs, all nine requested service categories, redirects, missing-page 404s, metadata/canonicals, contacts and responsive logos/navigation. Confirm pages contain real CMS data rather than fallback output.

With write-test approval, verify real-admin login/refresh/logout, protected-route denial, reset-email receipt/completion, one controlled upload and one controlled enquiry. Record test IDs for approved cleanup. Validate rate limiting using separate real clients without exhausting legitimate users' login limits.

Monitor private /health, database connectivity, 5xx/401/403/429 rates, response times, disk capacity, SMTP failures, integration status and scheduled backups.

### F. Approved rollback

Confirm PREVIOUS_RELEASE is the verified prior directory and current.rollback does not exist.

~~~bash
ln -s "$PREVIOUS_RELEASE" /srv/digital-mitra/current.rollback
mv -Tf /srv/digital-mitra/current.rollback /srv/digital-mitra/current
sudo systemctl restart digital-mitra-api
curl --fail --silent --show-error http://127.0.0.1:4000/health
sudo systemctl restart digital-mitra-web
~~~

If ingress changed, restore its prior reviewed configuration, validate nginx -t and reload. Recheck assets/authentication. Database restoration and inverse migrations are separate approvals, not automatic consequences of application rollback.

## 10. Readiness decision

Previous local evidence: 33 backend tests, 7 frontend tests, type checking, production build, isolated browser flows and 31 route/SEO checks passed. Those tests were not rerun for this documentation-only request.

Go-live remains gated on production domain/hosting selection, approved inspection, backups and restore rehearsal, intended-admin verification, durable uploads/media URL inventory, ingress/client-IP rate-limiting resolution, production SMTP and real-account verification, and explicit deployment approval.

File added for this request: docs/PRODUCTION_READINESS.md. No application, branding, authentication, environment or database changes were made. No production operations or Git staging/commit/push occurred.

