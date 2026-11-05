"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="center-page">
      <h1>A brief pause.</h1>
      <p>We couldn’t load this page. Please try again shortly.</p>
      <button className="button" onClick={reset}>
        Try again ↗
      </button>
    </main>
  );
}
