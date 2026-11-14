"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import BrandLogo from "./BrandLogo";
import { ApiError, request } from "@/lib/client-api";
import { business } from "@/lib/business";
export default function Login() {
  const [ready, setReady] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    if (window.location.search || window.location.hash)
      window.history.replaceState(null, "", "/admin/login");
    setReady(true);
  }, []);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || submitting.current) return;
    submitting.current = true;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: String(f.get("email")).trim().toLowerCase(),
          password: f.get("password"),
        }),
      });
      if (!response?.data?.email || !["admin", "editor"].includes(response.data.role))
        throw new Error("Unexpected server response. Please try again.");
      // A one-use display flag only; credentials and tokens stay out of storage.
      try { sessionStorage.setItem("dm:login-success", "1"); } catch {}
      window.location.replace("/admin");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401
        ? "Email or password is incorrect."
        : e instanceof ApiError && e.status >= 500 ? "Unable to connect to the server. Please try again."
        : e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <main id="main" className="login-page">
      <form method="post" action="/api/v1/auth/login" onSubmit={submit} className="login-form" aria-busy={busy}>
        <Link href="/" aria-label="Go to homepage">
          <BrandLogo className="login-logo" />
        </Link>
        <h1>Welcome back.</h1>
        <p>Sign in to manage your website.</p>
        <label>
          Email
          <input
            name="email"
            defaultValue={business.email}
            disabled={!ready || busy}
            type="email"
            required
            autoComplete="username"
            maxLength={254}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            disabled={!ready || busy}
            type="password"
            required
            autoComplete="current-password"
            maxLength={200}
          />
        </label>
        <div className="password-actions">
          <Link href="/admin/forgot-password">Forgot Password?</Link>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!ready && <p role="status">Preparing secure sign-in. If this does not finish, reload the page.</p>}
        <noscript><p role="alert">JavaScript is required for secure sign-in. Enable it and reload this page.</p></noscript>
        <button type="submit" className="button" disabled={!ready || busy}>
          {busy ? "Signing in…" : "Sign in"} <span>↗</span>
        </button>
        <p className="form-note">
          Access is by invitation. Use the local bootstrap command to create an
          administrator.
        </p>
      </form>
    </main>
  );
}
