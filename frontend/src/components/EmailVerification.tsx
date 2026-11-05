"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { request } from "@/lib/client-api";

export default function EmailVerification() {
  const token = useSearchParams().get("token") || "";
  const [message, setMessage] = useState("Verifying email address…");
  const requested = useRef(false);
  useEffect(() => {
    if (!token) {
      setMessage("Verification link is invalid.");
      return;
    }
    if (requested.current) return;
    requested.current = true;
    request("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((result) => setMessage(result.data.message))
      .catch((error) =>
        setMessage(
          error instanceof Error ? error.message : "Verification failed.",
        ),
      );
  }, [token]);
  return (
    <main id="main" className="login-page">
      <div className="login-form">
        <h1>Email verification.</h1>
        <p role="status">{message}</p>
        <Link className="back-login" href="/admin/login">
          Continue to admin login
        </Link>
      </div>
    </main>
  );
}
