import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("admin login normalizes email before submission", () => {
  const login = readFileSync(
    new URL("../src/components/Login.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    login,
    /String\(\s*f\.get\(\s*(["'])email\1\s*\)\s*\)\s*\.trim\(\s*\)\s*\.toLowerCase\(\s*\)/,
  );
});

test("email verification submits each token only once per mount", () => {
  const verification = readFileSync(
    new URL("../src/components/EmailVerification.tsx", import.meta.url),
    "utf8",
  );
  assert.match(verification, /useRef\(false\)/);
  assert.match(verification, /requested\.current\s*=\s*true\s*;/);
  assert.match(verification, /if\s*\(\s*requested\.current\s*\)\s*return\s*;/);
});
