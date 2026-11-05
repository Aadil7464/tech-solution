"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { request } from "@/lib/client-api";

export default function PasswordRecovery({
  mode,
}: {
  mode: "forgot" | "reset";
}) {
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
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
        {mode === "forgot" ? (
          <label>
            Email
            <input
              name="email"
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
        <button className="button" disabled={busy}>
          {busy
            ? mode === "forgot"
              ? "Sending…"
              : "Resetting…"
            : mode === "forgot"
              ? "Send reset link"
              : "Reset password"}{" "}
          <span>↗</span>
        </button>
        <Link className="back-login" href="/admin/login">
          Back to admin login
        </Link>
      </form>
    </main>
  );
}
