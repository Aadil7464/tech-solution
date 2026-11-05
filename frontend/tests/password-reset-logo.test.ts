import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("public header logo links to the homepage with an accessible label", () => {
  const header = readFileSync(
    new URL("../src/components/Header.tsx", import.meta.url),
    "utf8",
  );
  assert.match(header, /href="\/"/);
  assert.match(header, /aria-label="Go to homepage"/);
});

test("admin catch-all routes include forgot-password and reset-password screens", () => {
  const page = readFileSync(
    new URL("../src/app/admin/[[...path]]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /forgot-password/);
  assert.match(page, /reset-password/);
});
