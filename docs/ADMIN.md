# Digital Mitra Agency: content and administration

Visit `/admin`. There are no default credentials or public registration. Create your own administrator with `npm run bootstrap` after configuring the bootstrap variables described in the README. Administrator and editor access is checked by the API on every request.

## Pages and homepage

Open **Pages**, select a record and choose **Open**. The title is the H1; the short description is the introduction. On Home these are the hero heading and supporting sentence. Its featured image replaces the original CSS illustration. Use Media to upload an image, then paste its URL and describe it in the alt text field.

Keep these built-in slugs: `home`, `about`, `services`, `portfolio`, `blog`, `contact`, `privacy-policy`, `terms-and-conditions`. Home publishes at `/`; other built-in pages use their existing paths. New page records with other slugs publish at `/your-slug`. Avoid reserved application paths such as `admin`, `api`, `unauthorized` and `robots.txt`.

The content editor accepts safe HTML: paragraphs, H2/H3 headings, lists, emphasis, quotes and links. Executable markup is stripped. Home uses its dedicated sections instead of the generic HTML body.

Expand **Page sections** to edit headings, descriptions, links and section images. Home recognises `about`, `services`, `why`, `process`, `technologies`, `projects`, `testimonials`, `blog`, `faq`, `cta`. These slots retain the homepage's designed order. Other pages render sections in the saved order. Section keys must be unique. Section items under `why`, `process` and `technologies` control reason cards, process steps and technology labels. Empty item lists use the starter content. Other section images, descriptions and links are rendered by the page templates.

The main CTA fields set the hero/action link; destination paths begin with `/`. Home also supports a secondary button. Expand **Frequently asked questions** to add, edit or remove questions and answers.

Use drafts while preparing new custom pages; publish after review. Core website routes retain a minimal fallback if their CMS record is unavailable. Draft service, article, project and custom-page records are not publicly accessible. Scheduled publication is evaluated at request time. Public content uses uncached server reads, so publishing and unpublishing do not require a rebuild or manual cache purge.

## Services, blog and client material

Services, Blogs and Portfolio use the same editor, image picker by URL, publication controls, FAQs and SEO fields. Categories and comma-separated tags are editable. The service category slugs `development`, `marketing` and `creative` control the public service filters and navigation groups. Assign one of these to new services.

Existing service records are preserved by the importer. Three older service URLs permanently redirect to their preferred equivalents. Their records remain available in the admin for reference; they are excluded from public service lists.

Portfolio items and testimonials require administrator approval and recorded client consent as well as publication. Do not add sample clients or unverified performance claims. Empty public sections explain that approved material is forthcoming.

## SEO

The editor includes title, description, canonical URL, index/noindex, Open Graph title and Open Graph image. Leave canonical blank to use the page's own URL. Social images should use a wide composition, ideally 1200 × 630 pixels. The website provides a default social image.

Organization (or ProfessionalService when a genuine address is supplied), Service, Article and Breadcrumb JSON-LD is generated automatically. Optional additional structured data accepts a JSON object containing `"@context":"https://schema.org"` and a string `"@type"`; include only accurate information. This is output as escaped JSON, not executable code. Rich results are not guaranteed.

The sitemap includes published, indexable content with self-referencing canonicals. Legal templates begin with noindex. Complete their business/legal details before deciding whether to make them indexable. Static redirect rules live in `frontend/next.config.ts`; changing a published slug requires adding an appropriate permanent redirect there.

## Media

Upload JPEG, PNG or WebP up to 5 MB. Decoded images are bounded, resized, stripped of metadata and re-encoded as WebP. Copy the public URL into an editor. Administrators can replace an image while retaining the URL, so existing references continue to work. Image responses revalidate to avoid immutable stale copies. Alternative text is editable; content-specific alt text is maintained on the content record.

Deletion is blocked when an image is used as a featured image, Open Graph image, section image or configured logo. Replace those references first. Images in local `public/logo` are application assets rather than uploaded Media records.

## Enquiries and notifications

Leads includes name, email, phone, budget, company, requested service, message, date, attribution and notification status. Search by name, email, company or phone; filter by status. Internal notes and qualification statuses are editable. CSV export is administrator-only and includes phone/budget; spreadsheet formula prefixes are neutralised.

Notification states are `disabled` (SMTP is not configured), `sent`, `failed` or `pending`. A notification failure never discards an enquiry or asks the customer to submit it again. Check enquiries in Admin even when mail is unavailable. Notifications are operational alerts; do not interpret delivery to the SMTP provider as proof that a message reached an inbox.

## Settings

Edit the title, contact email, real phone, WhatsApp number, light/dark logos, footer description, social links and global SEO defaults. Phone numbers should include country codes. WhatsApp accepts country code and digits, optionally with a leading `+`. Blank phone/WhatsApp fields hide those contact actions. No number or business address has been invented.

SMTP secrets are server environment configuration and cannot be edited or read through the public website. See `docs/DEPLOYMENT.md`.
