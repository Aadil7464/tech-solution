"use client";
import ContentBlocksEditor from "./ContentBlocksEditor";
import AccountSettings from "./AccountSettings";
import LoginSuccessNotice from "./LoginSuccessNotice";
import Link from "next/link";
import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { request } from "@/lib/client-api";
type Row = Record<string, any>;
const modules = [
  "dashboard",
  "pages",
  "leads",
  "blogs",
  "services",
  "categories",
  "portfolio",
  "testimonials",
  "media",
  "settings",
  "activity",
];
const statuses = ["New", "Pending", "In Progress", "Completed", "Cancelled"];
const blank: Row = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  author: "",
  category: "",
  tags: [],
  image: "",
  imageAlt: "",
  status: "draft",
  publishAt: null,
  order: 0,
  approved: false,
  clientConsent: false,
  projectUrl: "",
  cta: "",
  ctaUrl: "",
  secondaryCta: "",
  secondaryCtaUrl: "",
  sections: [],
  faqs: [],
  schemaJson: "",
  ogTitle: "",
  ogImage: "",
  seoTitle: "",
  metaDescription: "",
  canonicalUrl: "",
  noindex: false,
};
const pick = (r: Row, keys: string[]) =>
  Object.fromEntries(
    keys.map((k) => [k, r[k]]).filter(([, v]) => v !== undefined),
  );
export default function Admin({
  kind,
  user,
  initialStatus = "",
  initialFilters = {},
}: {
  kind: string;
  user: { name: string; email: string; role: string };
  initialStatus?: string;
  initialFilters?: {
    search?: string;
    service?: string;
    budget?: string;
    oldDays?: string;
    from?: string;
    to?: string;
  };
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]),
    [data, setData] = useState<Row>({}),
    [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 }),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(
      statuses.includes(initialStatus) ? initialStatus : "",
    ),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Row | null>(null),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [serviceFilter, setServiceFilter] = useState(
    initialFilters.service || "",
  );
  const [budgetFilter, setBudgetFilter] = useState(initialFilters.budget || "");
  const [oldDays, setOldDays] = useState(initialFilters.oldDays || "");
  const [dateFrom, setDateFrom] = useState(initialFilters.from || "");
  const [dateTo, setDateTo] = useState(initialFilters.to || "");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const loadController = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);
    setError("");
    try {
      const result = await request(
        `/admin/${kind}?page=${page}&limit=${kind === "activity" ? 10 : 12}&search=${encodeURIComponent(query)}&status=${encodeURIComponent(filter)}${kind === "leads" ? `&service=${encodeURIComponent(serviceFilter)}&budget=${encodeURIComponent(budgetFilter)}&oldDays=${encodeURIComponent(oldDays)}&from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}` : ""}`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (["dashboard", "settings"].includes(kind)) setData(result.data);
      else {
        setRows(result.data);
        setPagination(
          result.pagination || { page: 1, pages: 1, total: result.data.length },
        );
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(message(e));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [
    kind,
    page,
    query,
    filter,
    serviceFilter,
    budgetFilter,
    oldDays,
    dateFrom,
    dateTo,
  ]);
  useEffect(() => {
    setEditing(null);
    setPage(1);
    setSearch(kind === "leads" ? initialFilters.search || "" : "");
    setQuery(kind === "leads" ? initialFilters.search || "" : "");
    setFilter(statuses.includes(initialStatus) ? initialStatus : "");
    setSelected([]);
    setNotice("");
  }, [kind, initialStatus, initialFilters.search]);
  useEffect(() => {
    if (kind !== "leads") return;
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (filter) params.set("status", filter);
    if (serviceFilter) params.set("service", serviceFilter);
    if (budgetFilter) params.set("budget", budgetFilter);
    if (oldDays) params.set("oldDays", oldDays);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const url = `/admin/leads${params.size ? `?${params}` : ""}`;
    window.history.replaceState(null, "", url);
  }, [
    kind,
    query,
    filter,
    serviceFilter,
    budgetFilter,
    oldDays,
    dateFrom,
    dateTo,
  ]);
  useEffect(() => {
    void load();
    return () => loadController.current?.abort();
  }, [load]);
  function message(e: unknown) {
    return e instanceof Error
      ? e.message
      : "Something went wrong. Please try again.";
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    await action(async () => {
      let body: Row;
      if (kind === "leads") body = pick(editing, ["status", "notes"]);
      else if (kind === "categories")
        body = pick(editing, ["title", "slug", "description"]);
      else body = pick(editing, Object.keys(blank));
      const endpoint = `/admin/${kind}${editing._id ? "/" + editing._id : ""}`;
      await request(endpoint, {
        method: kind === "leads" ? "PATCH" : editing._id ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      setEditing(null);
      setPreview(false);
      setNotice("Changes saved.");
      await load();
    });
  }
  async function remove(r: Row) {
    if (
      !window.confirm(
        `Delete “${r.title || r.alt || "this record"}”? This cannot be undone.`,
      )
    )
      return;
    await action(async () => {
      await request(`/admin/${kind}/${r._id}`, { method: "DELETE" });
      setNotice("Record deleted.");
      await load();
    });
  }
  async function retryExcel(r: Row) {
    await action(async () => {
      const result = await request(`/admin/leads/${r._id}/excel-sync`, {
        method: "POST",
      });
      setNotice(
        result.data.status === "Synced"
          ? "Excel synchronization completed."
          : `Excel synchronization is ${String(result.data.status).toLowerCase()}.`,
      );
      await load();
      if (editing?._id === r._id) setEditing(null);
    });
  }
  function leadExportParams(scope: "all" | "filtered" | "selected") {
    const params = new URLSearchParams();
    if (scope === "filtered") {
      if (query) params.set("search", query);
      if (filter) params.set("status", filter);
      if (serviceFilter) params.set("service", serviceFilter);
      if (budgetFilter) params.set("budget", budgetFilter);
      if (oldDays) params.set("oldDays", oldDays);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
    }
    if (scope === "selected") params.set("ids", selected.join(","));
    return params.toString();
  }
  async function bulkUpdate() {
    if (!selected.length || !bulkStatus) return;
    await action(async () => {
      await request("/admin/leads/status", {
        method: "PATCH",
        body: JSON.stringify({ ids: selected, status: bulkStatus }),
      });
      setNotice(
        `${selected.length} enquiry status${selected.length === 1 ? "" : "s"} updated.`,
      );
      setSelected([]);
      await load();
    });
  }
  const update = (key: string, value: unknown) =>
    setEditing((old) => ({ ...old, [key]: value }));
  function field(
    key: string,
    label: string,
    options: {
      area?: boolean;
      type?: string;
      required?: boolean;
      max?: number;
    } = {},
  ) {
    return (
      <label key={key}>
        {label}
        {options.area ? (
          <textarea
            value={editing?.[key] || ""}
            onChange={(e) => update(key, e.target.value)}
            rows={key === "content" ? 14 : 3}
            required={options.required}
            maxLength={options.max}
          />
        ) : (
          <input
            type={options.type || "text"}
            required={options.required}
            maxLength={options.max}
            value={editing?.[key] ?? ""}
            onChange={(e) =>
              update(
                key,
                options.type === "number"
                  ? Number(e.target.value)
                  : e.target.value,
              )
            }
          />
        )}
      </label>
    );
  }
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="footer-brand" href="/">
          <img src="/logo/monogram.svg" width="35" height="35" alt="" />
          <span>
            TECH SOLUTIONS
            <br />
            <small>ADMINISTRATION</small>
          </span>
        </Link>
        {modules
          .filter(
            (m) =>
              user.role === "admin" || !["settings", "activity"].includes(m),
          )
          .map((m) => (
            <Link
              className={kind === m ? "active" : ""}
              key={m}
              href={"/admin" + (m === "dashboard" ? "" : "/" + m)}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </Link>
          ))}
        <button
          className="button small"
          disabled={busy}
          onClick={() =>
            action(async () => {
              await request("/auth/logout", { method: "POST" });
              router.replace("/admin/login");
              router.refresh();
            })
          }
        >
          Sign out ↗
        </button>
      </aside>
      <main id="main" className="admin-content">
        <div className="admin-title">
          <div>
            <h1>{kind === "blogs" ? "Blog posts" : kind}</h1>
            <p>
              {user.name} · {user.role}
            </p>
          </div>
          <Link href="/" target="_blank" className="text-link">
            View website ↗
          </Link>
        </div>
        <LoginSuccessNotice />
        {error && (
          <div role="alert" className="status-message error">
            {error} <button onClick={load}>Retry</button>
          </div>
        )}
        {notice && (
          <div role="status" className="status-message">
            {notice}
          </div>
        )}
        {loading ? (
          <div className="admin-panel" role="status">
            Loading…
          </div>
        ) : (
          <>
            {kind === "dashboard" && (
              <>
                <div className="dashboard-welcome">
                  <div>
                    <span className="dashboard-kicker">CLIENT OPERATIONS</span>
                    <h2>Good day, {user.name.split(" ")[0]}</h2>
                    <p>
                      Manage enquiries and keep every customer conversation
                      moving.
                    </p>
                  </div>
                  <div className="dashboard-date">
                    {new Date().toLocaleDateString(undefined, {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div className="stats-grid">
                  {[
                    ["total", "Total enquiries", "leads", "stat-blue"],
                    [
                      "newLeads",
                      "New enquiries",
                      "leads?status=New",
                      "stat-purple",
                    ],
                    [
                      "pending",
                      "Pending enquiries",
                      "leads?status=Pending",
                      "stat-orange",
                    ],
                    [
                      "inProgress",
                      "In progress",
                      "leads?status=In Progress",
                      "stat-yellow",
                    ],
                    [
                      "completed",
                      "Completed",
                      "leads?status=Completed",
                      "stat-green",
                    ],
                    [
                      "cancelled",
                      "Cancelled enquiries",
                      "leads?status=Cancelled",
                      "stat-red",
                    ],
                  ].map(([k, label, href, className]) => (
                    <Link
                      key={k}
                      href={"/admin/" + href}
                      className={`stat ${className}`}
                    >
                      <div className="stat-icon">
                        {String(k).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <b>{data[k] ?? 0}</b>
                        <span>{label}</span>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="dashboard-grid">
                  <div className="admin-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Lead status</h2>
                        <p>Current enquiry distribution</p>
                      </div>
                      <Link href="/admin/leads" className="text-link">
                        View leads ↗
                      </Link>
                    </div>
                    <StatusOverview rows={data.statuses || []} />
                  </div>
                  <div className="admin-panel enquiry-trend-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Enquiry trend</h2>
                        <p>Daily enquiries over the last 30 days</p>
                      </div>
                    </div>
                    <div className="overview-number">
                      {data.thisMonth || 0}
                      <span>this month · {data.today || 0} today</span>
                    </div>
                    <EnquiryTrend rows={data.trend || []} />
                  </div>
                  <div className="admin-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Recent activity</h2>
                        <p>Latest administration updates</p>
                      </div>
                    </div>
                    <ActivityTable rows={(data.activity || []).slice(0, 5)} />
                    <Link href="/admin/activity">View All Activity</Link>
                  </div>
                </div>
              </>
            )}
            {kind === "settings" && (
              <>
                <SettingsForm
                  data={data}
                  busy={busy}
                  save={(body) =>
                    action(async () => {
                      await request("/admin/settings", {
                        method: "PUT",
                        body: JSON.stringify(body),
                      });
                      setNotice("Website settings saved.");
                      await load();
                    })
                  }
                />
                <AccountSettings email={user.email} />
              </>
            )}
            {kind === "activity" && (
              <div className="admin-panel">
                <ActivityTable rows={rows} />
              </div>
            )}
            {kind === "media" && (
              <>
                <form
                  className="admin-panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const body = new FormData(form);
                    void action(async () => {
                      await request("/admin/media", { method: "POST", body });
                      form.reset();
                      setNotice(
                        "Image uploaded. Copy its URL into your content.",
                      );
                      await load();
                    });
                  }}
                >
                  <h2>Upload an image</h2>
                  <p>
                    JPEG, PNG or WebP, up to 5 MB. Images are resized and
                    re-encoded before storage.
                  </p>
                  <label>
                    Image file
                    <input
                      type="file"
                      name="image"
                      accept="image/jpeg,image/png,image/webp"
                      required
                    />
                  </label>
                  <label>
                    Descriptive alternative text
                    <input name="alt" required minLength={3} maxLength={200} />
                  </label>
                  <button disabled={busy} className="button">
                    Upload ↗
                  </button>
                </form>
                <div className="media-grid">
                  {rows.map((r) => (
                    <div key={r._id} className="media-item">
                      <img
                        src={
                          r.url + "?v=" + encodeURIComponent(r.updatedAt || "")
                        }
                        alt={r.alt}
                        width="300"
                        height="200"
                      />
                      <p>{r.alt}</p>
                      <label>
                        Public image URL
                        <input
                          readOnly
                          value={r.url}
                          onFocus={(e) => e.target.select()}
                        />
                      </label>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const alt = String(
                            new FormData(e.currentTarget).get("alt"),
                          );
                          void action(async () => {
                            await request("/admin/media/" + r._id, {
                              method: "PATCH",
                              body: JSON.stringify({ alt }),
                            });
                            setNotice("Alternative text saved.");
                            await load();
                          });
                        }}
                      >
                        <label>
                          Edit alternative text
                          <input
                            name="alt"
                            defaultValue={r.alt}
                            minLength={3}
                            required
                            maxLength={200}
                          />
                        </label>
                        <button className="text-link" disabled={busy}>
                          Save alt text
                        </button>
                      </form>
                      {user.role === "admin" && (
                        <>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = e.currentTarget;
                              const body = new FormData(form);
                              void action(async () => {
                                await request("/admin/media/" + r._id, {
                                  method: "PUT",
                                  body,
                                });
                                form.reset();
                                setNotice(
                                  "Image replaced. Existing content links still work.",
                                );
                                await load();
                              });
                            }}
                          >
                            <label>
                              Replacement image
                              <input
                                name="image"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                required
                              />
                            </label>
                            <input type="hidden" name="alt" value={r.alt} />
                            <button className="text-link" disabled={busy}>
                              Replace image
                            </button>
                          </form>
                          <button onClick={() => remove(r)} disabled={busy}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {!["dashboard", "settings", "media", "activity"].includes(kind) && (
              <>
                {editing ? (
                  <form className="admin-panel editor" onSubmit={save}>
                    <h2>
                      {kind === "leads"
                        ? "Enquiry details"
                        : editing._id
                          ? "Edit " + (kind === "blogs" ? "post" : kind)
                          : "Create " + kind}
                    </h2>
                    {kind === "leads" ? (
                      <>
                        <div className="lead-detail">
                          <h3>{editing.name}</h3>
                          <dl>
                            {[
                              "email",
                              "phone",
                              "budget",
                              "company",
                              "service",
                              "message",
                              "notificationStatus",
                              "createdAt",
                            ].map((k) => (
                              <Fragment key={k}>
                                <dt>{k === "createdAt" ? "Received" : k}</dt>
                                <dd>
                                  {k === "createdAt"
                                    ? new Date(editing[k]).toLocaleString()
                                    : editing[k] || "—"}
                                </dd>
                              </Fragment>
                            ))}
                          </dl>
                          <h3>Excel synchronization</h3>
                          <dl>
                            <dt>Status</dt>
                            <dd>
                              {String(editing.excelSync?.status || "pending")}
                            </dd>
                            <dt>Last synchronization</dt>
                            <dd>
                              {editing.excelSync?.lastSyncedAt
                                ? new Date(
                                    editing.excelSync.lastSyncedAt,
                                  ).toLocaleString()
                                : "—"}
                            </dd>
                          </dl>
                          {user.role === "admin" && (
                            <button
                              type="button"
                              className="text-link"
                              disabled={busy}
                              onClick={() => retryExcel(editing)}
                            >
                              Retry Excel synchronization
                            </button>
                          )}
                          <h3>Attribution</h3>
                          <pre>
                            {JSON.stringify(editing.attribution || {}, null, 2)}
                          </pre>
                        </div>
                        <label>
                          Status
                          <select
                            value={editing.status}
                            onChange={(e) => update("status", e.target.value)}
                          >
                            {statuses.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        {field("notes", "Internal notes", {
                          area: true,
                          max: 10000,
                        })}
                      </>
                    ) : (
                      <>
                        <div className="form-two">
                          {field("title", "Title", {
                            required: true,
                            max: 180,
                          })}
                          {field(
                            "slug",
                            "URL slug (lowercase words separated by hyphens)",
                            { required: true, max: 120 },
                          )}
                        </div>
                        {kind === "categories" ? (
                          field("description", "Description", {
                            area: true,
                            max: 500,
                          })
                        ) : (
                          <>
                            {field(
                              "excerpt",
                              "Short description / testimonial quote",
                              { area: true, max: 500 },
                            )}
                            {field(
                              "content",
                              "Content (safe HTML: paragraphs, headings, lists, links)",
                              { area: true, max: 100000 },
                            )}
                            <div className="form-two">
                              {field(
                                "author",
                                "Author / testimonial attribution",
                                { max: 100 },
                              )}
                              {field("category", "Category slug", { max: 120 })}
                            </div>
                            <label>
                              Tags (comma separated)
                              <input
                                value={(editing.tags || []).join(", ")}
                                onChange={(e) =>
                                  update(
                                    "tags",
                                    e.target.value
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  )
                                }
                              />
                            </label>
                            <div className="form-two">
                              {field("image", "Image URL from Media")}
                              {field("imageAlt", "Descriptive image alt text", {
                                max: 200,
                              })}
                            </div>
                            <div className="form-two">
                              <label>
                                Publication status
                                <select
                                  value={editing.status}
                                  onChange={(e) =>
                                    update("status", e.target.value)
                                  }
                                >
                                  {["draft", "scheduled", "published"].map(
                                    (s) => (
                                      <option key={s}>{s}</option>
                                    ),
                                  )}
                                </select>
                              </label>
                              <label>
                                Publish at (your local time)
                                <input
                                  type="datetime-local"
                                  value={
                                    editing.publishAt
                                      ? localDate(editing.publishAt)
                                      : ""
                                  }
                                  onChange={(e) =>
                                    update(
                                      "publishAt",
                                      e.target.value
                                        ? new Date(e.target.value).toISOString()
                                        : null,
                                    )
                                  }
                                />
                              </label>
                            </div>
                            <p className="form-note">
                              Scheduled content becomes public at the chosen
                              time. Published content with a future date also
                              stays private until then.
                            </p>
                            <div className="form-two">
                              {field("order", "Display order", {
                                type: "number",
                              })}
                              {field("cta", "Call to action", { max: 200 })}
                            </div>
                            {field(
                              "ctaUrl",
                              "CTA destination path (e.g. /contact)",
                              { max: 500 },
                            )}
                            {kind === "pages" && (
                              <>
                                <p className="help">
                                  Home uses title as its hero heading and short
                                  description as its supporting text. Keep
                                  built-in slugs unchanged: home, about,
                                  services, portfolio, blog, contact,
                                  privacy-policy, terms-and-conditions. Custom
                                  page slugs publish at /your-slug.
                                </p>
                                {field(
                                  "secondaryCta",
                                  "Secondary button label",
                                  { max: 200 },
                                )}
                                {field(
                                  "secondaryCtaUrl",
                                  "Secondary button destination path",
                                  { max: 500 },
                                )}
                              </>
                            )}
                            <ContentBlocksEditor
                              sections={editing.sections || []}
                              faqs={editing.faqs || []}
                              onSections={(v) => update("sections", v)}
                              onFaqs={(v) => update("faqs", v)}
                            />
                            {kind === "portfolio" &&
                              field("projectUrl", "Project URL", {
                                type: "url",
                              })}
                            {["portfolio", "testimonials"].includes(kind) && (
                              <>
                                <label className="checkbox">
                                  <input
                                    type="checkbox"
                                    checked={editing.approved || false}
                                    onChange={(e) =>
                                      update("approved", e.target.checked)
                                    }
                                  />
                                  I have reviewed and approved this content and
                                  its claims.
                                </label>
                                <label className="checkbox">
                                  <input
                                    type="checkbox"
                                    checked={editing.clientConsent || false}
                                    onChange={(e) =>
                                      update("clientConsent", e.target.checked)
                                    }
                                  />
                                  The client has given permission to publish.
                                </label>
                              </>
                            )}
                            <details>
                              <summary>
                                Search engine settings <span>+</span>
                              </summary>
                              <div>
                                {field(
                                  "seoTitle",
                                  "SEO title (up to 70 characters)",
                                  { max: 70 },
                                )}
                                {field(
                                  "metaDescription",
                                  "Meta description (up to 170 characters)",
                                  { area: true, max: 170 },
                                )}
                                {field(
                                  "canonicalUrl",
                                  "Canonical URL (leave blank for this page)",
                                  { type: "url" },
                                )}
                                {field("ogTitle", "Open Graph title", {
                                  max: 100,
                                })}
                                {field("ogImage", "Open Graph image URL", {
                                  max: 500,
                                })}
                                {field(
                                  "schemaJson",
                                  "Additional structured data (JSON-LD object; optional)",
                                  { area: true, max: 20000 },
                                )}
                                <p className="form-note">
                                  Organization, Service, Article and Breadcrumb
                                  data is generated automatically. Optional JSON
                                  needs @context set to https://schema.org and
                                  an @type. Add only accurate details.
                                </p>
                                <label className="checkbox">
                                  <input
                                    type="checkbox"
                                    checked={editing.noindex || false}
                                    onChange={(e) =>
                                      update("noindex", e.target.checked)
                                    }
                                  />
                                  Ask search engines not to index this page
                                </label>
                              </div>
                            </details>
                          </>
                        )}
                      </>
                    )}
                    <div className="editor-actions">
                      <button disabled={busy} className="button">
                        {busy ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => {
                          setEditing(null);
                          setPreview(false);
                        }}
                      >
                        Cancel
                      </button>
                      {!["leads", "categories"].includes(kind) && (
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => setPreview(!preview)}
                        >
                          Preview
                        </button>
                      )}
                    </div>
                    {preview && (
                      <div className="preview-panel">
                        <h2>{editing.title}</h2>
                        <p>{editing.excerpt}</p>
                        <div className="prose">
                          {editing.content
                            .split(/<\/?[^>]+>/g)
                            .map((text: string, i: number) => (
                              <p key={i}>{text}</p>
                            ))}
                        </div>
                        <p className="form-note">
                          Safe text preview. Published formatting is sanitized
                          by the server when saved.
                        </p>
                      </div>
                    )}
                  </form>
                ) : (
                  <>
                    {kind === "leads" ? (
                      <div className="lead-management-controls">
                        <form
                          className="lead-filter-grid"
                          onSubmit={(e) => {
                            e.preventDefault();
                          }}
                        >
                          <label>
                            Search
                            <input
                              aria-label="Search leads"
                              placeholder="Lead ID, name, email or phone"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  setPage(1);
                                  setQuery(search);
                                }
                              }}
                            />
                          </label>
                          <label>
                            Status
                            <select
                              aria-label="Filter by status"
                              value={filter}
                              onChange={(e) => {
                                setFilter(e.target.value);
                                setPage(1);
                              }}
                            >
                              <option value="">All statuses</option>
                              {statuses.map((status) => (
                                <option key={status}>{status}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Old enquiries
                            <select
                              aria-label="Filter old enquiries"
                              value={oldDays}
                              onChange={(e) => {
                                setOldDays(e.target.value);
                                setDateFrom("");
                                setDateTo("");
                                setPage(1);
                              }}
                            >
                              <option value="">Any age</option>
                              {[7, 15, 30, 90].map((days) => (
                                <option key={days} value={days}>
                                  {days} days or older
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Service
                            <select
                              aria-label="Filter by service"
                              value={serviceFilter}
                              onChange={(e) => {
                                setServiceFilter(e.target.value);
                                setPage(1);
                              }}
                            >
                              <option value="">All services</option>
                              {[
                                "Website Development",
                                "SEO",
                                "Digital Marketing",
                                "Branding",
                                "Social Media",
                                "Paid Advertising",
                              ].map((service) => (
                                <option key={service}>{service}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Budget
                            <select
                              aria-label="Filter by budget"
                              value={budgetFilter}
                              onChange={(e) => {
                                setBudgetFilter(e.target.value);
                                setPage(1);
                              }}
                            >
                              <option value="">All budgets</option>
                              {[
                                "under-25000",
                                "25000-50000",
                                "50000-100000",
                                "100000-plus",
                                "discuss",
                              ].map((budget) => (
                                <option key={budget} value={budget}>
                                  {budget}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            From
                            <input
                              aria-label="Date from"
                              type="date"
                              value={dateFrom}
                              onChange={(e) => {
                                setDateFrom(e.target.value);
                                setOldDays("");
                                setPage(1);
                              }}
                            />
                          </label>
                          <label>
                            To
                            <input
                              aria-label="Date to"
                              type="date"
                              value={dateTo}
                              onChange={(e) => {
                                setDateTo(e.target.value);
                                setOldDays("");
                                setPage(1);
                              }}
                            />
                          </label>
                        </form>
                        <div className="lead-toolbar">
                          <button
                            className="button secondary"
                            onClick={() => {
                              setPage(1);
                              setQuery(search);
                            }}
                          >
                            Apply search
                          </button>
                          <button
                            className="button secondary"
                            onClick={() => {
                              setSearch("");
                              setQuery("");
                              setFilter("");
                              setServiceFilter("");
                              setBudgetFilter("");
                              setOldDays("");
                              setDateFrom("");
                              setDateTo("");
                              setPage(1);
                            }}
                          >
                            Clear filters
                          </button>
                          {selected.length > 0 && (
                            <div className="lead-bulk-actions">
                              <span>{selected.length} selected</span>
                              <select
                                aria-label="Bulk lead status"
                                value={bulkStatus}
                                onChange={(e) => setBulkStatus(e.target.value)}
                              >
                                <option value="">Choose status</option>
                                {statuses.map((status) => (
                                  <option key={status}>{status}</option>
                                ))}
                              </select>
                              <button
                                className="button"
                                disabled={!bulkStatus || busy}
                                onClick={bulkUpdate}
                              >
                                Update status
                              </button>
                              <button
                                className="button secondary"
                                onClick={() => setSelected([])}
                              >
                                Clear selection
                              </button>
                            </div>
                          )}
                          <div className="lead-export-actions">
                            <a
                              className="text-link"
                              href={`/api/v1/admin/leads/export?${leadExportParams("filtered")}`}
                            >
                              Export CSV ↓
                            </a>
                            {[
                              ["all", "Export All"],
                              ["filtered", "Export Filtered"],
                              ["selected", "Export Selected"],
                            ].map(([scope, label]) => (
                              <a
                                key={scope}
                                className="text-link"
                                aria-disabled={
                                  scope === "selected" && selected.length === 0
                                }
                                href={
                                  scope === "selected" && selected.length === 0
                                    ? undefined
                                    : `/api/v1/admin/leads/export.xlsx?${leadExportParams(scope as "all" | "filtered" | "selected")}`
                                }
                              >
                                {label} .xlsx ↓
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="filters">
                        <form
                          className="filters"
                          onSubmit={(e) => {
                            e.preventDefault();
                            setPage(1);
                            setQuery(search);
                          }}
                        >
                          <input
                            aria-label="Search records"
                            placeholder={
                              kind === "leads"
                                ? "Search name, email or company"
                                : "Search title"
                            }
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                          <button className="button secondary">Search</button>
                          {kind !== "categories" && (
                            <select
                              aria-label="Filter by status"
                              value={filter}
                              onChange={(e) => {
                                setFilter(e.target.value);
                                setPage(1);
                              }}
                            >
                              <option value="">All statuses</option>
                              {(kind === "leads"
                                ? statuses
                                : ["draft", "scheduled", "published"]
                              ).map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          )}
                        </form>
                        {kind === "leads" ? (
                          user.role === "admin" && (
                            <a
                              className="text-link"
                              href={`/api/v1/admin/leads/export?search=${encodeURIComponent(query)}&status=${encodeURIComponent(filter)}`}
                            >
                              Export CSV ↓
                            </a>
                          )
                        ) : (
                          <button
                            className="button"
                            disabled={
                              user.role !== "admin" &&
                              ["portfolio", "testimonials"].includes(kind)
                            }
                            onClick={() => {
                              setPreview(false);
                              setEditing(
                                kind === "categories"
                                  ? { title: "", slug: "", description: "" }
                                  : { ...blank },
                              );
                            }}
                          >
                            Create new +
                          </button>
                        )}
                      </div>
                    )}
                    <div className="admin-panel table-wrap">
                      {rows.length ? (
                        <table>
                          <thead>
                            <tr>
                              {kind === "leads" && (
                                <th className="lead-select-column">
                                  <input
                                    type="checkbox"
                                    aria-label="Select all leads on this page"
                                    checked={
                                      rows.length > 0 &&
                                      rows.every((row) =>
                                        selected.includes(row._id),
                                      )
                                    }
                                    onChange={(e) =>
                                      setSelected((current) =>
                                        e.target.checked
                                          ? [
                                              ...new Set([
                                                ...current,
                                                ...rows.map((row) => row._id),
                                              ]),
                                            ]
                                          : current.filter(
                                              (id) =>
                                                !rows.some(
                                                  (row) => row._id === id,
                                                ),
                                            ),
                                      )
                                    }
                                  />
                                </th>
                              )}
                              <th>{kind === "leads" ? "Enquiry" : "Title"}</th>
                              {kind === "leads" && <th>Lead ID</th>}
                              {kind === "leads" && <th>Contact</th>}
                              {kind === "leads" && <th>Service</th>}
                              <th>
                                {kind === "categories" ? "Slug" : "Status"}
                              </th>
                              <th>Created</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r._id}>
                                {kind === "leads" && (
                                  <td>
                                    <input
                                      type="checkbox"
                                      aria-label={`Select lead ${r.leadId || r.name}`}
                                      checked={selected.includes(r._id)}
                                      onChange={(e) =>
                                        setSelected((current) =>
                                          e.target.checked
                                            ? [...current, r._id]
                                            : current.filter(
                                                (id) => id !== r._id,
                                              ),
                                        )
                                      }
                                    />
                                  </td>
                                )}
                                <td>
                                  {r.title || r.name}
                                  <small>{r.email || r.slug}</small>
                                </td>
                                {kind === "leads" && (
                                  <td>
                                    <strong>{r.leadId || "—"}</strong>
                                  </td>
                                )}
                                {kind === "leads" && (
                                  <td>
                                    {r.phone || "—"}
                                    <small>{r.company || ""}</small>
                                  </td>
                                )}
                                {kind === "leads" && (
                                  <td>{r.service || "—"}</td>
                                )}
                                <td>
                                  <span className="badge">
                                    {r.status || r.slug}
                                  </span>
                                </td>
                                <td>
                                  {new Date(r.createdAt).toLocaleDateString()}
                                </td>
                                <td>
                                  <button
                                    onClick={() => {
                                      setPreview(false);
                                      setEditing({ ...blank, ...r });
                                    }}
                                  >
                                    Open
                                  </button>
                                  {user.role === "admin" &&
                                    kind !== "leads" && (
                                      <button
                                        disabled={busy}
                                        onClick={() => remove(r)}
                                      >
                                        Delete
                                      </button>
                                    )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p>No records match this view.</p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
            {!["dashboard", "settings"].includes(kind) &&
              !editing &&
              pagination.pages > 1 && (
                <div className="pagination">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    ← Previous
                  </button>
                  <span>
                    Page {page} of {pagination.pages} · {pagination.total}{" "}
                    records
                  </span>
                  <button
                    disabled={page >= pagination.pages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next →
                  </button>
                </div>
              )}
          </>
        )}
      </main>
    </div>
  );
}
function localDate(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function StatusOverview({ rows }: { rows: Row[] }) {
  const labels: Record<string, string> = {
    New: "New",
    Pending: "Pending",
    "In Progress": "In Progress",
    Completed: "Completed",
    Cancelled: "Cancelled",
    Contacted: "Pending",
    Qualified: "In Progress",
    Converted: "Completed",
    Lost: "Cancelled",
  };
  const totals = statuses.map(
    (status) =>
      [
        status,
        rows.reduce(
          (sum, row) =>
            sum + (labels[row._id] === status ? Number(row.count || 0) : 0),
          0,
        ),
      ] as [string, number],
  );
  const total = totals.reduce((sum, [, count]) => sum + count, 0) || 1;
  return (
    <div className="status-overview">
      {totals.map(([status, count], index) => (
        <div key={status}>
          <div>
            <span>
              <i className={`status-dot status-${index}`} />
              {status}
            </span>
            <b>{count}</b>
          </div>
          <div className="status-track">
            <span
              className={`status-fill status-${index}`}
              style={{
                width: `${Math.max(count ? 5 : 0, (count / total) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
function EnquiryTrend({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((row) => Number(row.count || 0)));
  return rows.length ? (
    <div
      className="enquiry-trend"
      role="img"
      aria-label="Daily enquiry trend for the last 30 days"
    >
      <div className="trend-bars">
        {rows.map((row) => {
          const count = Number(row.count || 0);
          return (
            <div
              className="trend-day"
              key={row.date}
              title={`${row.date}: ${count}`}
            >
              <span
                style={{
                  height: `${Math.max(count ? 12 : 2, (count / max) * 100)}%`,
                }}
              />
              <small>{new Date(`${row.date}T12:00:00`).getDate()}</small>
            </div>
          );
        })}
      </div>
    </div>
  ) : (
    <p>No enquiry trend data yet.</p>
  );
}
function ActivityTable({ rows }: { rows: Row[] }) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Module</th>
            <th>By</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id}>
              <td>{r.action === "login" ? "Admin Login" : r.action}</td>
              <td>{r.resource === "auth" ? "Authentication" : r.resource}</td>
              <td>{r.actor?.name || "Administrator"}</td>
              <td>{new Date(r.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p>No activity yet.</p>
  );
}
function SettingsForm({
  data,
  busy,
  save,
}: {
  data: Row;
  busy: boolean;
  save: (body: Row) => Promise<void>;
}) {
  const fields = [
    ["title", "Website title"],
    ["description", "Website description"],
    ["email", "Business email"],
    ["phone", "Business phone (include country code)"],
    ["whatsapp", "WhatsApp number (country code and digits only)"],
    ["logo", "Light background logo URL"],
    ["logoDark", "Dark background logo URL"],
    ["footerText", "Footer description"],
    ["address", "Business address"],
    ["defaultSeoTitle", "Default SEO title"],
    ["defaultSeoDescription", "Default SEO description"],
  ];
  return (
    <form
      key={data.updatedAt || "new"}
      className="admin-panel editor"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const body = Object.fromEntries(
          fields.map(([k]) => [k, f.get(k) || ""]),
        );
        void save({
          ...body,
          socialLinks: String(f.get("socialLinks") || "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        });
      }}
    >
      <h2>Website details</h2>
      <p>
        Use real business details. Blank phone and WhatsApp fields hide their
        public buttons. Upload replacement logos in Media, then paste their URLs
        below.
      </p>
      {fields.map(([k, label]) => (
        <label key={k}>
          {label}
          <input
            name={k}
            defaultValue={data[k] || ""}
            type={k === "email" ? "email" : "text"}
            required={k === "title"}
          />
        </label>
      ))}
      <label>
        Social profile links (one HTTPS URL per line)
        <textarea
          name="socialLinks"
          defaultValue={(data.socialLinks || []).join("\n")}
          rows={4}
        />
      </label>
      <button className="button" disabled={busy}>
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
