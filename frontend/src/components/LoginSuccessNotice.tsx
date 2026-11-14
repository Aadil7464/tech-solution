"use client";
import { useEffect, useState } from "react";

export default function LoginSuccessNotice() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("dm:login-success") === "1") {
        sessionStorage.removeItem("dm:login-success");
        setVisible(true);
      }
    } catch {}
  }, []);
  return visible ? (
    <div role="status" className="status-message">
      Login successful! Welcome to Tech Solutions.
      <button type="button" aria-label="Dismiss login message" onClick={() => setVisible(false)}>×</button>
    </div>
  ) : null;
}
