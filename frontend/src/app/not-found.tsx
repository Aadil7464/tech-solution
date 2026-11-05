import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="center-page">
      <span className="eyebrow">404 / A different direction</span>
      <h1>
        Let’s get you
        <br />
        back on track.
      </h1>
      <p>This page may have moved or is not available.</p>
      <Link href="/" className="button">
        Back to the homepage ↗
      </Link>
    </main>
  );
}
