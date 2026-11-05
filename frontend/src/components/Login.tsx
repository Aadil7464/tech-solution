"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { request } from "@/lib/client-api";
export default function Login() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: String(f.get("email")).trim().toLowerCase(),
          password: f.get("password"),
        }),
      });
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="login-page">
      <form onSubmit={submit} className="login-form">
        <Link href="/">
          <img
            src="/logo/horizontal.svg"
            width="230"
            height="45"
            alt="Digital Mitra Agency"
          />
        </Link>
        <h1>Welcome back.</h1>
        <p>Sign in to manage your website.</p>
        <label>
          Email
          <input
            name="email"
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
        <button className="button" disabled={busy}>
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
