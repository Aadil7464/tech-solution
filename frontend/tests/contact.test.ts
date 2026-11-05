import { test } from "node:test";
import assert from "node:assert/strict";
import { contactSchema } from "../src/lib/contact.ts";
const valid = {
  name: "Test Person",
  email: "test@example.com",
  company: "",
  service: "",
  message: "Please help us plan a useful website.",
  website: "",
  consent: true,
};
test("contact form accepts a complete enquiry", () =>
  assert.equal(contactSchema.safeParse(valid).success, true));
test("invalid email, short message, missing consent and honeypot are rejected", () => {
  for (const change of [
    { email: "invalid" },
    { message: "short" },
    { consent: false },
    { website: "spam" },
  ])
    assert.equal(
      contactSchema.safeParse({ ...valid, ...change }).success,
      false,
    );
});
test("mobile and budget accept real formats and reject malformed values", () => {
  assert.equal(
    contactSchema.safeParse({
      ...valid,
      phone: "+91 98765 43210",
      budget: "25000-50000",
    }).success,
    true,
  );
  for (const change of [
    { phone: "call me" },
    { phone: "123" },
    { budget: "unrecognised" },
  ])
    assert.equal(
      contactSchema.safeParse({ ...valid, ...change }).success,
      false,
    );
});
