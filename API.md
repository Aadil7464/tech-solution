# REST API

Base path: `/api/v1`. The frontend proxies this path to Express so cookie authentication stays on the same browser origin.

Successful reads and writes return `{ "data": ... }`. Lists also include `pagination: { page, limit, total, pages }`. `page` starts at 1; `limit` is capped at 50. Errors use `{ "error": { "message": "...", "fields": { ... } } }`; validation uses 422, missing content 404, duplicate slugs or blocked deletion 409, unauthenticated access 401, forbidden access 403, and throttled requests 429. Delete/logout success returns 204.

## Authentication

| Method | Path           | Purpose                                               |
| ------ | -------------- | ----------------------------------------------------- |
| GET    | `/auth/csrf`   | Set HttpOnly CSRF cookie and return `data.token`      |
| POST   | `/auth/login`  | `{email,password}`; rate limited; sets session cookie |
| GET    | `/auth/me`     | Return current user's name, email and role            |
| POST   | `/auth/logout` | Invalidate user sessions and clear the cookie         |

All write requests require `Origin` equal to `FRONTEND_URL`. Login, logout and all authenticated admin writes also require `X-CSRF-Token` from `/auth/csrf`. Keep the cookies when calling from an API client. Never put session tokens in localStorage. JSON writes use `Content-Type: application/json`.

## Public

| Method | Path                                                        | Purpose                                                          |
| ------ | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| POST   | `/leads`                                                    | Persist an enquiry; public rate limit is 5 per 15 minutes per IP |
| GET    | `/settings`                                                 | Public website settings only                                     |
| GET    | `/{blogs,services,portfolio,testimonials,categories}`       | Paginated public content                                         |
| GET    | `/{blogs,services,portfolio,testimonials,categories}/:slug` | Public detail                                                    |

Enquiry payload:

```json
{
  "name": "Your name",
  "email": "you@example.com",
  "company": "Optional business name",
  "service": "Optional service interest",
  "message": "At least twenty characters describing your enquiry.",
  "website": "",
  "attribution": {
    "source": "optional campaign source",
    "medium": "optional medium",
    "campaign": "optional campaign",
    "referrer": "optional referring page",
    "landingPage": "/contact"
  }
}
```

Public lists accept `page`, `limit`, `search` and `category`. Publication and consent rules cannot be bypassed using query parameters. Public leads cannot be listed or read. Enquiry success returns only its ID and acknowledgement.

## Protected admin

All endpoints below require authentication. Both roles can read content, leads and the dashboard. Admin-only actions are labelled.

| Method     | Path                                                            | Purpose                                                          |
| ---------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| GET        | `/admin/dashboard`                                              | Enquiry/status counts, active content counts and recent activity |
| GET        | `/admin/leads`                                                  | Search name/email/company; filter by `status`; paginate          |
| GET        | `/admin/leads/:id`                                              | Full enquiry, original attribution and internal notes            |
| PATCH      | `/admin/leads/:id`                                              | `{status,notes}`; preserves original timestamp                   |
| GET        | `/admin/leads/export`                                           | CSV download with the same filters; admin only                   |
| GET / POST | `/admin/{blogs,services,portfolio,testimonials,categories}`     | List/create records                                              |
| PUT        | `/admin/{blogs,services,portfolio,testimonials,categories}/:id` | Replace editable record fields                                   |
| DELETE     | `/admin/{blogs,services,portfolio,testimonials,categories}/:id` | Delete record; admin only                                        |
| GET        | `/admin/media`                                                  | Paginated uploaded images                                        |
| POST       | `/admin/media`                                                  | Multipart `image` and `alt` fields                               |
| PATCH      | `/admin/media/:id`                                              | Update `{alt}`                                                   |
| DELETE     | `/admin/media/:id`                                              | Remove unreferenced image; admin only                            |
| GET / PUT  | `/admin/settings`                                               | Read/update site settings; admin only                            |
| GET        | `/admin/activity`                                               | Paginated audit log; admin only                                  |

Lead statuses: `New`, `Contacted`, `Qualified`, `Converted`, `Lost`. Admin content lists also accept `status=draft|scheduled|published`. Search input is escaped before use in MongoDB queries.

Content fields: required `title` and unique lowercase hyphenated `slug`; optional `excerpt`, `content`, `author`, `category` (slug), `tags` (array), `image`, `imageAlt`, `status`, `publishAt` (ISO UTC date or null), `order` (nonnegative integer), `cta`, `projectUrl`, `approved`, `clientConsent`, `seoTitle`, `metaDescription`, `canonicalUrl`, `noindex`. Defaults are draft, order 0, consent/approval false. An image requires alt text. Scheduled content requires `publishAt`. Portfolio/testimonial writes require the admin role, including approving content.

Category fields: `title`, `slug`, `description`. Settings fields: `title`, `description`, `email`, `phone`, `address`, `socialLinks` (HTTPS URL array), `defaultSeoTitle`, `defaultSeoDescription`. Use empty strings for unknown contact fields, not made-up details.

`GET /health` is outside the API prefix and returns 200 only while MongoDB is connected. Uploaded images are served from `/uploads/:filename`. No endpoint exposes password hashes or provides public account registration.
