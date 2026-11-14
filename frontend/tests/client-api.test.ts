import { test } from "node:test";
import assert from "node:assert/strict";

const networkMessage = "Unable to connect to the server. Please try again.";
let sequence = 0;
async function client() {
  return import(`../src/lib/client-api.ts?test=${++sequence}`);
}

test("auth client uses same-origin cookies and POST JSON without credential URL parameters", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; options: RequestInit }[] = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return Response.json(calls.length === 1 ? { data: { token: "test-csrf" } } : { data: { email: "admin@example.com", role: "admin" } });
  };
  try {
    const { request } = await client();
    await request("/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@example.com", password: "fixture-only" }) });
    assert.deepEqual(calls.map((call) => call.url), ["/api/v1/auth/csrf", "/api/v1/auth/login"]);
    const login = calls[1].options;
    assert.equal(login.method, "POST");
    assert.equal(login.credentials, "same-origin");
    assert.equal(new Headers(login.headers).get("Content-Type"), "application/json");
    assert.equal(new Headers(login.headers).get("x-csrf-token"), "test-csrf");
    assert.ok(login.signal instanceof AbortSignal);
  } finally { globalThis.fetch = original; }
});

test("network failures produce a visible-actionable connection message", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  try {
    const { request } = await client();
    await assert.rejects(request("/auth/login", { method: "POST" }), { message: networkMessage });
  } finally { globalThis.fetch = original; }
});

test("HTTP authentication errors preserve status for the login UI", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? Response.json({ data: { token: "test-csrf" } }) : Response.json({ error: { message: "Email or password is incorrect" } }, { status: 401 });
  try {
    const { request } = await client();
    await assert.rejects(request("/auth/login", { method: "POST" }), { name: "ApiError", status: 401 });
  } finally { globalThis.fetch = original; }
});

test("malformed CSRF response stops before sending credentials", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ data: {} }); };
  try {
    const { request } = await client();
    await assert.rejects(request("/auth/login", { method: "POST" }), { message: networkMessage });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("non-JSON success responses do not become false login success", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html>Unavailable</html>", { status: 200 });
  try {
    const { request } = await client();
    await assert.rejects(request("/auth/me"), { message: networkMessage });
  } finally { globalThis.fetch = original; }
});
