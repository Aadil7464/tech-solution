"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { request } from "@/lib/client-api";
import BrandLogo from "./BrandLogo";
import { business } from "@/lib/business";

export default function PasswordRecovery({
  mode,
}: {
  mode: "forgot" | "reset";
}) {
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const submitting = useRef(false);
  useEffect(() => { setReady(true); }, []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "reset") {
        const password = String(form.get("password"));
        if (password !== String(form.get("confirmPassword")))
          throw new Error("Passwords do not match.");
        if (password.length < 8 || new TextEncoder().encode(password).length > 72)
          throw new Error("Password must contain at least 8 characters and at most 72 UTF-8 bytes.");
      }
      if (mode === "forgot") {
        const response = await request("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: String(form.get("email")) }),
        });
        setMessage(response.data.message);
      } else {
        const response = await request("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({
            token: String(searchParams.get("token") || ""),
            password: String(form.get("password")),
            confirmPassword: String(form.get("confirmPassword")),
          }),
        });
        setMessage(response.data.message);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to process your request",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main id="main" className="login-page">
      <form method="post" action={`/api/v1/auth/${mode === "forgot" ? "forgot-password" : "reset-password"}`} onSubmit={submit} className="login-form" aria-busy={busy}>
        <Link href="/">
          <BrandLogo className="login-logo" />
        </Link>
        <h1>
          {mode === "forgot"
            ? "Reset your password."
            : "Choose a new password."}
        </h1>
        <p>
          {mode === "forgot"
            ? "Enter the email for your registered administrator account."
            : "Create a password with at least 8 characters."}
        </p>
        {mode === "reset" && message ? null : mode === "forgot" ? (
          <label>
            Email
            <input
              name="email"
              defaultValue={business.email}
              disabled={!ready || busy}
              type="email"
              required
              autoComplete="email"
              maxLength={254}
            />
          </label>
        ) : (
          <>
            <label>
              New password
              <input
                name="password"
                disabled={!ready || busy}
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm new password
              <input
                name="confirmPassword"
                disabled={!ready || busy}
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
              />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
        {mode === "reset" && message ? (
          <Link className="button" href="/admin/login">Go to Login</Link>
        ) : <button type="submit" className="button" disabled={!ready || busy}>
          {busy
            ? mode === "forgot"
              ? "Sending…"
              : "Resetting…"
            : mode === "forgot"
              ? "Send reset link"
              : "Reset password"}{" "}
          <span>↗</span>
        </button>}
        <Link className="back-login" href="/admin/login">
          Back to admin login
        </Link>
      </form>
    </main>
  );
}
