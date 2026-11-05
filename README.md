# Digital Mitra Agency

A local-first agency website with a Next.js App Router frontend, Express REST API and MongoDB persistence. There are no public default administrator credentials. Nothing is deployed.

## Run locally

Use Node.js 24 LTS and npm 11. Run commands from this project folder.

```powershell
npm ci
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Put the generated value in `JWT_SECRET` in `backend/.env`. Local environment files have already been created in this workspace; **do not overwrite them** if they exist. They are ignored by Git. No administrator account has been created for you.

Start MongoDB in one terminal:

```powershell
npm run db
```

This convenience command downloads/runs a real MongoDB binary, binds locally and stores durable data in `backend/.local-mongodb/`. Keep this terminal open. Network access is needed on the first run if the binary is not cached. It is a development helper, not a production database service. Alternatively run your own MongoDB instance and change `MONGODB_URI`.

In a second terminal:

```powershell
npm run seed
npm run dev
```

Open **http://localhost:3000**. The API runs at **http://localhost:4000**; `/health` checks its database connection. `seed` adds 17 service offerings, editable website pages, three original agency articles and a category only when their slugs do not exist. It preserves edits. Portfolio and testimonials start empty.

## Create your administrator

Set `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` in `backend/.env` to your own values, then run:

```powershell
npm run bootstrap
```

The password must contain 8–72 characters. The command hashes it with bcrypt before saving it. It refuses duplicate emails; it does not reset an existing password. Remove the bootstrap password from the environment file after creating the account. Visit **http://localhost:3000/admin/login**.

Administrators can reset their password from **http://localhost:3000/admin/forgot-password**. Reset links expire after 15 minutes. Password-reset email delivery uses `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`; these are server-only settings and must be configured outside source control.

Admin accounts can manage all modules. Editors can manage articles, services and categories, read/update leads and upload media. Only administrators can delete content, export leads, approve client content or change settings. To provision an editor locally, set `ADMIN_ROLE=editor` with that person's explicit credentials before running bootstrap. The default role is `admin`. There is no public registration endpoint.

## What to edit first

- **Admin → Settings:** real business email, phone, address, social links and website defaults. Blank contact values display explicitly labelled placeholders.
- **Admin → Services / Blogs:** edit content and SEO fields. Slugs are unique within each module. Content accepts a small sanitized HTML subset, not scripts or arbitrary embedded markup.
- **Admin → Media:** upload JPEG, PNG or WebP images up to 5 MB. The API resizes/re-encodes images as WebP, strips source metadata and stores them in the configured uploads directory. Copy the returned URL into the image field of your article or service and add descriptive alt text.
- **Admin → Portfolio / Testimonials:** only published, approved entries with recorded client consent appear publicly. Supply real content and verify claims before approval.
- **Privacy and terms:** edit the clearly labelled policy templates in Admin Pages. They intentionally remain `noindex` until the business owner has completed the missing legal details.

Drafts remain private. Scheduled entries become public when `publishAt` arrives, evaluated on every request; no background scheduler is required. A published entry with a future publication date also stays private until that date. Unpublishing takes effect immediately. Public pages fetch database content on the server without a stale content cache.

## Commands and checks

| Command                                                          | Purpose                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run db`                                                     | Start persistent local development MongoDB                                             |
| `npm run seed`                                                   | Add original initial content without replacing edits                                   |
| `npm run dev`                                                    | Run Next.js and Express together                                                       |
| `npm run bootstrap`                                              | Create an administrator from explicit environment credentials                          |
| `npm run typecheck`                                              | Check frontend TypeScript                                                              |
| `npm test`                                                       | Run MongoDB-backed API integration tests and form validation tests                     |
| `npm run build`                                                  | Build the production Next.js frontend                                                  |
| `npm run start -w frontend`                                      | Run the built Next.js application                                                      |
| `npm run start -w backend`                                       | Run the API without watch mode                                                         |
| `node --env-file=backend/.env scripts/browser-check.mjs`         | Run browser checks against the running app                                             |
| `node scripts/performance-check.mjs`                             | Check local desktop/mobile LCP and CLS budgets against the running production frontend |
| `node --env-file=backend/.env scripts/cleanup-browser-tests.mjs` | Remove only clearly marked test records after an interrupted browser run               |

The API tests use an isolated MongoDB process and database, not the development database. Browser checks use the running development database, create random temporary credentials and remove their own records in `finally`. They cover responsive navigation, overflow, form validation, persisted enquiries, session refresh, article drafts/publishing, lead notes/status, logout, 404 responses and social image generation. Chrome is used from the standard Windows installation; set `CHROME_PATH` for another installation. Screenshots go into ignored `.test-data/`.

ESLint, TypeScript, Node's test runner and the Next.js build are configured code checks. Run `npm run lint` for frontend, backend and scripts. Real-user Core Web Vitals require traffic after hosting; local browser checks do not establish field performance. The performance script observes Largest Contentful Paint and layout shifts and samples an interaction with the FAQ. It checks local budgets of LCP below 2.5 seconds and CLS below 0.1; its interaction sample is not a field INP measurement.

## Environment reference

Backend (`backend/.env`):

| Variable                                      | Meaning                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `NODE_ENV`                                    | `development`, `test` or `production`; production enables Secure cookies                |
| `PORT`                                        | API listener port, default 4000                                                         |
| `MONGODB_URI`                                 | MongoDB connection string; required                                                     |
| `JWT_SECRET`                                  | Required random secret, at least 48 characters; never expose in frontend variables      |
| `FRONTEND_URL`                                | Exact browser origin allowed to write, e.g. `http://localhost:3000`                     |
| `PUBLIC_API_URL`                              | Public base URL used to form uploaded image URLs                                        |
| `UPLOAD_DIR`                                  | Persistent image directory relative to the backend working directory, default `uploads` |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | Used only by the local bootstrap command                                                |
| `ADMIN_ROLE`                                  | Optional local bootstrap role: `admin` (default) or `editor`                            |

Frontend (`frontend/.env.local`):

| Variable                   | Meaning                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `API_INTERNAL_URL`         | Server-to-server Express base URL; default `http://127.0.0.1:4000`; also used by the API rewrite |
| `NEXT_PUBLIC_SITE_URL`     | Canonical public website URL; use the actual HTTPS origin before hosting                         |
| `NEXT_PUBLIC_GA4_ID`       | Optional `G-…` measurement ID; blank disables GA4                                                |
| `NEXT_PUBLIC_GTM_ID`       | Optional `GTM-…` container ID; blank disables GTM                                                |
| `GOOGLE_SITE_VERIFICATION` | Optional Search Console verification string                                                      |

Analytics hooks are off by default. Configure the applicable consent policy and consent behavior before enabling tracking. Avoid adding the same analytics configuration through both GA4 and GTM.

## Important files

- `frontend/src/app/(website)/`: public pages. Reusable section/detail routes serve services, blog posts and case studies; category pages have their own route.
- `frontend/src/components/Admin.tsx`: admin module forms, lists, filters and pagination.
- `frontend/src/lib/api.ts`: server-side reads and clear unavailable states.
- `frontend/src/app/admin/[[...path]]/page.tsx`: server-side session check before the admin UI is rendered.
- `backend/src/models/`: MongoDB models, unique indexes, timestamps and activity records.
- `backend/src/routes/api.js`: route composition and API handlers; content CRUD lives in `controllers/content.js`.
- `backend/src/middleware/security.js`: sessions, CSRF, role checks and validation helpers.
- `backend/src/validators/`: strict server-side write schemas.
- `backend/src/services/content.js`: publication rules, HTML sanitization, pagination and safe CSV formatting.
- `API.md`: endpoint and response reference.

## Security and operating notes

Authentication uses an eight-hour JWT in an HttpOnly, SameSite=Strict cookie. The database session version invalidates existing sessions on logout. Every cookie-authenticated write checks both the exact Origin and a CSRF header matched to an HttpOnly cookie; login also requires this token. Roles come from MongoDB, not client claims. Public enquiry and login endpoints are rate limited. Express uses Helmet, bounded request bodies, explicit field validation and sanitized HTML. Formula-like CSV cells are neutralized before export.

Media is stored on the local filesystem as a self-hosted storage option. Before hosting, mount `UPLOAD_DIR` on durable storage, back it up alongside MongoDB, and route its public URL through HTTPS. Uploads referenced by content cannot be deleted. Categories referenced by blog posts cannot be deleted or renamed until those posts are moved. Changing another content slug changes its URL; add a permanent redirect in `next.config.ts` if replacing a URL that has already been published.

Use HTTPS in production with the frontend and proxied API on the same site. Do not expose database ports publicly. Configure a process manager and backups when a hosting platform is chosen. The current rate limiter is in-process; multiple API replicas require a shared limiter store. If placing Express behind a reverse proxy, configure a narrowly scoped Express `trust proxy` setting appropriate to that infrastructure so rate limiting uses the correct visitor IP. No deployment configuration has been guessed here.

Business contact details, approved client material, legal policy review, analytics consent configuration and hosting remain owner-supplied. No physical address, client endorsements, performance figures or search-ranking promises are fabricated.

## Expanded Digital Mitra site

See [Admin and CMS usage](docs/ADMIN.md) for homepage sections, custom pages, FAQs, SEO, logo/WhatsApp settings and media replacement. See [Deployment and mail setup](docs/DEPLOYMENT.md) for hosting, durable media storage, SMTP notifications and verification commands. Existing MongoDB CMS and image storage have been retained. Contact enquiries now support phone and budget; SMTP notifications are disabled until credentials are configured.
