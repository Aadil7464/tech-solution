# Deploying the existing frontend and backend

Current direction (5 November 2026): hosting, domain, database provider and ingress are not selected. Follow [HOSTING_INDEPENDENT_DEPLOYMENT.md](HOSTING_INDEPENDENT_DEPLOYMENT.md) as the primary guide. Provider-specific examples below are optional references, not an approved production topology. Proxy trust remains disabled unless explicit verified TRUSTED_PROXY_CIDRS values are supplied. Production startup no longer creates indexes automatically.

This project remains Next.js + Express + MongoDB. The existing authenticated MongoDB CMS supplies persistent pages, services, blog posts, settings and enquiries. Sanity is not needed alongside this CMS. Existing filesystem image storage is suitable only when `UPLOAD_DIR` is mounted on durable storage; ephemeral/serverless filesystems are not supported by this storage configuration.

## Prepare a host

Use Node.js 24 LTS with npm 11, a persistent MongoDB service and two long-running Node processes. Keep the API and database private where possible. Route website HTTPS traffic to Next.js, which proxies `/api/v1` to Express. Serve the API's `/uploads` path at the HTTPS origin configured by `PUBLIC_API_URL`. Mount the upload directory on a durable disk and back it up with MongoDB. Do not expose MongoDB directly to the internet.

Do not overwrite existing environment files. Copy example files only for a new installation, then supply values through your host's secret manager or restricted environment files. No credential belongs in `NEXT_PUBLIC_*` variables except intentionally public analytics identifiers.

Backend configuration:

- `NODE_ENV=production`, a private `PORT`, `MONGODB_URI` and a random `JWT_SECRET` of at least 48 characters.
- `FRONTEND_URL` must equal the exact public website origin, without a trailing slash. Writes from other origins are rejected.
- `PUBLIC_API_URL` is the public HTTPS base origin used for uploaded image URLs. Configure ingress for `/uploads` accordingly.
- `UPLOAD_DIR` points to durable storage relative to the backend process working directory, or use an absolute path.
- Mail uses `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` and `LEAD_NOTIFICATION_EMAIL`. The default recipient is `digitalmitra786@gmail.com`. Port 465 normally uses `SMTP_SECURE=true`; for STARTTLS on 587 use `false`. Supply authenticated sender details accepted by your provider. Do not place an account password in client-side code.
- Administrator recovery requires a working `SMTP_HOST` and `SMTP_FROM`, plus `SMTP_PASS` when `SMTP_USER` is set. Missing configuration or failed delivery returns HTTP 503 rather than claiming a reset email was sent. Reset mail uses the sender name Digital Mitra Agency and subject Reset Your Digital Mitra Agency Admin Password.
- Set `PUBLIC_FRONTEND_URL` to the externally reachable HTTPS website URL in production. Recovery links expire after 15 minutes. Never use a private LAN address for production email links.
- For LAN development, start Next with `--hostname 0.0.0.0`, set frontend `DEV_ALLOWED_ORIGINS` to the exact LAN hostname/IP (no scheme or port), and add the exact frontend URL to backend `FRONTEND_URLS`. These are separate HMR and API origin controls. Preserve production origin restrictions, CSRF and secure cookies.
- Run `node scripts/final-audit.mjs` for isolated MongoDB, browser authentication/recovery, desktop/mobile, LAN HMR, CMS, route/SEO and production performance verification. It uses ports 3100, 3101 and 4100 and restores Next-generated TypeScript configuration after teardown.

Frontend configuration:

- `API_INTERNAL_URL` is the private API origin reachable by the frontend server.
- `NEXT_PUBLIC_SITE_URL` is the final public HTTPS website origin used in canonical URLs and the sitemap. Set it before building.
- Optional `GOOGLE_SITE_VERIFICATION` prepares Search Console verification. Optional `NEXT_PUBLIC_GA4_ID` / `NEXT_PUBLIC_GTM_ID` enable analytics hooks. Configure the applicable consent behavior before enabling tracking; avoid loading the same tracker twice.

## Build and start

From the existing project root:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Back up the database before any approved production content migration. Do not automatically run seed on production: it adds missing pages, 19 service offerings, original articles and a category, supplies missing FAQ/category/section-item fields, and can change legacy publication states. Review and approve its exact delta first. Existing installations retain three legacy service records in Admin; their public routes redirect to the current equivalents.

Provision an administrator with explicit credentials using `npm run bootstrap`. Remove bootstrap password variables after use. In a process manager, run:

```powershell
npm run start -w backend
npm run start -w frontend
```

Preserve the working directory for each process so environment and upload paths resolve correctly. Set automatic restarts and graceful termination. Frontend changes require a fresh build and frontend restart; backend changes require an API restart. CMS changes are read on every public request and need neither.

## Verify the deployment

Check `/health` on the API, then `/`, `/services`, `/contact`, `/admin`, `/robots.txt`, `/sitemap.xml` and a service detail page. Confirm HTTPS, canonical host, secure cookies and image loading. Send a deliberate enquiry using your own details, verify it in Admin, then confirm its email status and inbox delivery. Complete real business details and legal policy review before public launch.

For automated local checks with the website/API already running:

```powershell
npm run test:routes
node --env-file=backend/.env scripts/browser-check.mjs
node --env-file=backend/.env scripts/cms-browser-check.mjs
node scripts/performance-check.mjs
```

The API tests use an isolated MongoDB instance. Browser scripts create random temporary users/content in the configured database and remove their records in `finally`. Run them against a development or staging database. Chrome is expected at the standard Windows path; set `CHROME_PATH` for another installation. `TEST_BASE_URL` changes the target website; its origin must match the API's `FRONTEND_URL` for form/auth writes. Browser screenshots are saved under ignored `.test-data`.

Synthetic LCP/CLS checks do not establish real-user Core Web Vitals or field INP. Monitor those after launch. SMTP composition is tested with a local transport; real provider/inbox delivery requires your credentials. No deployment is implied by a successful local build.

## Operating safeguards

Back up and test restoration of both MongoDB and uploaded files. Rotate secrets through the hosting environment, restrict administrative access and review dependency advisories. Multi-replica APIs need a shared rate-limit store; the included limiter is per-process. Configure a narrowly scoped `trust proxy` only after the actual ingress topology is known. Do not enable unrestricted trust proxy settings.

The dependency audit applied the compatible `follow-redirects` security patch. At implementation time the remaining advisories were in the ESLint development toolchain's transitive `minimatch` dependency; forced breaking downgrades were not applied. Runtime production dependency audit should be checked again at release.

Mail configuration follows [Nodemailer SMTP transport](https://nodemailer.com/smtp). Lint setup follows [ESLint flat configuration](https://eslint.org/docs/latest/use/configure/configuration-files).
