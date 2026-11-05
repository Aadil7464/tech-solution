import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Login from "@/components/Login";
import PasswordRecovery from "@/components/PasswordRecovery";
import EmailVerification from "@/components/EmailVerification";
import Admin from "@/components/Admin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Website administration",
  robots: { index: false, follow: false },
};

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path = [] } = await params;
  const query = await searchParams;
  const stringParam = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  if (path.length > 1) notFound();
  const kind = path[0] || "dashboard";
  if (
    ![
      "dashboard",
      "login",
      "forgot-password",
      "reset-password",
      "verify-email",
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
    ].includes(kind)
  )
    notFound();
  if (kind === "login") return <Login />;
  if (kind === "forgot-password") return <PasswordRecovery mode="forgot" />;
  if (kind === "reset-password") return <PasswordRecovery mode="reset" />;
  if (kind === "verify-email") return <EmailVerification />;
  let user = null;
  let unavailable = false;
  try {
    const jar = await cookies();
    const session = jar.get("session")?.value;
    if (session) {
      const r = await fetch(
        (process.env.API_INTERNAL_URL || "http://127.0.0.1:4000") +
          "/api/v1/auth/me",
        {
          headers: { cookie: "session=" + session },
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        },
      );
      if (r.ok) user = (await r.json()).data;
      else if (r.status >= 500) unavailable = true;
    }
  } catch {
    unavailable = true;
  }
  if (unavailable)
    return (
      <main id="main" className="center-page">
        <h1>Admin temporarily unavailable.</h1>
        <p>Check the API and database connection, then refresh this page.</p>
      </main>
    );
  if (!user) redirect("/admin/login");
  if (["settings", "activity"].includes(kind) && user.role !== "admin")
    redirect("/unauthorized");
  return (
    <Admin
      kind={kind}
      user={user}
      initialStatus={stringParam("status")}
      initialFilters={{
        search: stringParam("search"),
        service: stringParam("service"),
        budget: stringParam("budget"),
        oldDays: stringParam("oldDays"),
        from: stringParam("from"),
        to: stringParam("to"),
      }}
    />
  );
}
