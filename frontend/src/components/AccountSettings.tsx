"use client";

import { FormEvent, useEffect, useState } from "react";
import { request } from "@/lib/client-api";

export default function AccountSettings({ email }: { email: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="account-settings">
      <form
        method="post"
        action="/api/v1/admin/account/email"
        className="admin-panel"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage("");
          setError("");
          const form = new FormData(event.currentTarget);
          try {
            const result = await request("/admin/account/email", {
              method: "POST",
              body: JSON.stringify({
                email: String(form.get("email")).trim(),
                password: String(form.get("password")),
              }),
            });
            setMessage(result.data.message);
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Unable to request email change",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Change administrator email</h2>
        <p>
          Current email: <strong>{email}</strong>
        </p>
        <label>
          New email
          <input
            name="email"
            type="email"
            disabled={!ready || busy}
            required
            maxLength={254}
            autoComplete="email"
          />
        </label>
        <label>
          Current password
          <input
            name="password"
            type="password"
            disabled={!ready || busy}
            required
            autoComplete="current-password"
          />
        </label>
        <button className="button" disabled={!ready || busy}>
          {busy ? "Sending…" : "Send verification link"}
        </button>
      </form>
      <form
        method="post"
        action="/api/v1/admin/account/password"
        className="admin-panel"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage("");
          setError("");
          const form = new FormData(event.currentTarget);
          try {
            await request("/admin/account/password", {
              method: "PUT",
              body: JSON.stringify({
                currentPassword: String(form.get("currentPassword")),
                newPassword: String(form.get("newPassword")),
                confirmPassword: String(form.get("confirmPassword")),
              }),
            });
            setMessage("Password changed. Sign in again.");
            window.location.assign("/admin/login");
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Unable to change password",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Change password</h2>
        <label>
          Current password
          <input
            name="currentPassword"
            disabled={!ready || busy}
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <label>
          New password
          <input
            name="newPassword"
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
        <button className="button" disabled={!ready || busy}>
          {busy ? "Changing…" : "Change password"}
        </button>
      </form>
      {message && (
        <p role="status" className="status-message">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="status-message error">
          {error}
        </p>
      )}
    </div>
  );
}
