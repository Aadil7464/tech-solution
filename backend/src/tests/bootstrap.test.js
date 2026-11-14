import { test } from "node:test";
import assert from "node:assert/strict";
import { adminBootstrapSchema } from "../config/bootstrap.js";

const validCredentials = {
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_ROLE: "admin",
  ADMIN_NAME: "Admin User",
};

test("bootstrap accepts an admin password with the 8-character minimum", () => {
  const parsed = adminBootstrapSchema.parse({
    ...validCredentials,
    ADMIN_PASSWORD: "12345678",
  });
  assert.equal(parsed.ADMIN_PASSWORD, "12345678");
});

test("bootstrap rejects an admin password shorter than 8 characters", () => {
  const result = adminBootstrapSchema.safeParse({
    ...validCredentials,
    ADMIN_PASSWORD: "1234567",
  });
  assert.equal(result.success, false);
});

test("bootstrap normalizes the administrator email", () => {
  const parsed = adminBootstrapSchema.parse({
    ...validCredentials,
    ADMIN_EMAIL: "  ADMIN@EXAMPLE.COM  ",
    ADMIN_PASSWORD: "12345678",
  });
  assert.equal(parsed.ADMIN_EMAIL, "admin@example.com");
});
