# Hosting-independent deployment and migration guide

Updated 5 November 2026. No hosting provider, domain, database host, CDN or reverse proxy has been selected. No production access or deployment is authorized. Earlier Linux/systemd examples are optional references, not selected infrastructure.

## Application contracts

- Frontend: a long-running Next.js Node server, or a compatible managed Next.js platform. Static export is unsuitable because admin routes and public pages use server rendering.
- Backend: a long-running Express Node process with authenticated MongoDB access and persistent writable uploads. A provider with only ephemeral filesystems needs a separately implemented storage adapter before use.
- MongoDB: authenticated, private/restricted connectivity; TLS where appropriate; scheduled backups and tested recovery.
- Public routing: browser API requests must reach the backend through the frontend's same-origin /api/v1 proxy. Public /uploads requests must resolve to the durable upload directory at PUBLIC_API_URL. Different frontend/backend hosting is supported when the frontend can reach API_INTERNAL_URL and uploads are publicly reachable over HTTPS.
- Runtime baseline tested locally: Node.js 24.16.0, npm 11.13.0. Pin approved compatible versions and use the same build/runtime architecture for native modules such as sharp.
- Keep secrets and upload storage separate from application release artifacts. Do not copy development .env files, local databases or fixture data into production.

## Build and start commands

Run these only in an approved build/staging environment with its environment injected. They do not authorize production operations.

~~~text
npm ci
npm run typecheck -w frontend -- --incremental false
npm test
node scripts/final-audit.mjs
npm run build
~~~

The browser audit starts disposable MongoDB and local ports 3100, 3101 and 4100. Set CHROME_PATH to the installed Chromium/Chrome executable. Never replace its fixture database with production.

Set API_INTERNAL_URL and NEXT_PUBLIC_SITE_URL before building; ensure local frontend/.env.local overrides are excluded from the deployment artifact. Leave NEXT_DIST_DIR unset for a normal .next build, or keep its value identical during build and start.

Provider process commands, with environment injected by its process manager:

~~~text
npm run start -w backend
npm run start -w frontend -- --port 3000
~~~

The provider must choose the required binding address/port. On a private single-host process, add --hostname 127.0.0.1 to the frontend start command. On managed/container platforms use their required interface and service routing. No nginx, Cloudflare, systemd or other vendor-specific component is required by the application.

## Environment requirements

Backend: NODE_ENV=production, PORT, MONGODB_URI, stable JWT_SECRET of at least 48 characters, FRONTEND_URL, PUBLIC_FRONTEND_URL, PUBLIC_API_URL and absolute durable UPLOAD_DIR.

Frontend build/runtime: API_INTERNAL_URL and NEXT_PUBLIC_SITE_URL. Use the final HTTPS canonical origin. Do not expose database, SMTP or JWT credentials with NEXT_PUBLIC prefixes.

SMTP: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_FROM, plus SMTP_USER/SMTP_PASS when authentication is required. LEAD_NOTIFICATION_EMAIL is digitalmitra786@gmail.com. TLS is required: implicit TLS when SMTP_SECURE=true; STARTTLS is required otherwise. Keep certificate validation enabled. Validate provider sender authorization and inbox delivery after explicit approval.

Optional analytics, Search Console and Microsoft Excel variables remain documented in the .env.example files. Do not enable integrations until their destinations and privacy settings are configured.

## Proxy, CORS, sessions and client IPs

TRUSTED_PROXY_CIDRS defaults to empty, which keeps proxy trust disabled. It accepts only explicit IP addresses or nonzero CIDR ranges; booleans, hop counts, hostnames, wildcards and all-address /0 ranges are rejected. No trusted addresses have been configured in the real environment.

After hosting is selected, inspect the complete request path, including the frontend API rewrite, ingress and any CDN. Confirm which hops sanitize/append forwarded headers. Only then approve a precise TRUSTED_PROXY_CIDRS value and test client IPs from separate real clients. Do not copy the isolated loopback test configuration to production. Never use unrestricted trust proxy or disable limiter validation.

The current limiter is per-process. Use one API process initially or implement/test a shared rate-limit store before adding replicas. Keep API listener ports private through platform networking/firewalls.

FRONTEND_URL allows one exact canonical browser origin. FRONTEND_URLS and DEV_ALLOWED_ORIGINS are development controls, not production CORS fixes. Preserve Origin and Set-Cookie through routing and do not cache admin/auth/API responses at an edge cache.

With NODE_ENV=production, session cookies are Secure, HttpOnly and SameSite=Strict. JWT issuer/audience and sessionVersion checks remain enabled. Preserve the existing issuer until a deliberate session migration is approved; keep JWT_SECRET stable across normal restarts/rollback and consistent across replicas. Use HTTPS and canonical-host redirects.

Application request logging omits query strings and does not log request bodies or complete database errors. The hosting/CDN access logs must also redact account-link query strings. Never log passwords, reset tokens or complete environment objects.

## Database indexes and migrations

Production server startup now disables automatic Mongoose index creation. Inspect existing indexes after read-only production approval and prepare reviewed index operations, especially the unique users.email index. Do not infer an index exists merely because the schema declares it.

Do not run seed or bootstrap automatically. seed inserts content and can update missing fields/legacy publication states; it is not a versioned migration. bootstrap creates an account and must not be used to duplicate an existing admin.

Before any migration:

1. Obtain approval for target inspection, then verify cluster, database name, intended admin ID and all normalized official-email conflicts.
2. Identify exact content/settings/media changes. Preserve production edits and customer records.
3. Take coordinated MongoDB and uploaded-file backups. Verify a restore into a separate isolated destination with outbound integrations disabled.
4. Prepare migration IDs, expected database identity/document IDs, preconditions, counts, before/after values and inverse operations. Obtain write approval.
5. Apply conditional field updates without blind upserts. For the admin email, preserve ID, passwordHash, role and sessionVersion; stop on conflicting ownership.
6. Verify modified counts and unchanged records. Never print hashes. The locally migrated admin is not evidence about production account state.

Prefer managed snapshots/PITR when available. If using mongodump, select a topology-appropriate consistency method; quiesce all writers for a database-scoped coordinated dump. Use protected tool config files for credentials. Match MongoDB tools/server compatibility and back up uploads from the same point.

Uploaded media URLs are stored as absolute URLs. Changing PUBLIC_API_URL affects future uploads only. Inventory old local/LAN/HTTP/obsolete-host references after approval and prepare exact reversible mappings. Keep all current public logo aliases, /media assets and indexed service paths.

## Release, verification and rollback gates

1. Approve the host/domain/network/storage/secret-management design and client-IP handling.
2. Reproduce installation/build/tests from the reviewed lockfile in staging; approve the exact artifact/checksum. Uncommitted workspace changes are not present in remote Git HEAD automatically.
3. Approve production inspection, coordinated backups and restore rehearsal.
4. Approve each narrowly scoped data/index migration, then the deployment itself.
5. Start the private API and verify /health reports database connected; start the frontend; activate the provider's HTTPS routing and persistent /uploads mapping.
6. Verify connected CMS content, metadata/canonicals, sitemap, robots, redirects/404s, all contact details and logo/media paths. HTTP 200 alone may be fallback content.
7. Separately approve real login/refresh/logout, password-reset email completion, controlled upload/enquiry tests and any cleanup. Confirm distinct-client rate limiting without exhausting real users' budgets.
8. Monitor latency, 5xx/401/403/429 rates, database readiness, disk capacity, mail/integration failures and backup jobs.

For rollback, retain the previous artifact and environment version. Switch application/routing back through the chosen provider's release mechanism while preserving durable storage and stable JWT_SECRET. Keep compatible additive data. Apply inverse migrations only with approval and conditional checks, preserving new enquiries, content edits and password resets.

For disaster recovery, restore the coordinated snapshot into a NEW database and NEW upload directory, validate, reconcile subsequent writes and obtain approval before switching traffic. Do not drop/overwrite the live database or automatically delete new assets as an application rollback step.

## Current limits

No production host, credentials, database, backup system or ingress topology has been verified. Real production migration/client-IP values and provider-specific commands must be finalized after selection and approval. The current dependency-audit result and local acceptance evidence are recorded in FINAL_COMPLETION_REPORT.md; unresolved advisories must be reviewed before release.
