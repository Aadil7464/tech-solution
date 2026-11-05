import Link from "next/link";
export const metadata = {
  title: "Access restricted",
  robots: { index: false, follow: false },
};
export default function Unauthorized() {
  return (
    <main id="main" className="center-page">
      <h1>Access restricted.</h1>
      <p>Your account does not have permission to access this section.</p>
      <Link className="button" href="/admin">
        Back to dashboard
      </Link>
    </main>
  );
}
