import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import supertest from "supertest";
import { trustedFrontendOrigins } from "../config/env.js";
import { originGuard } from "../middleware/security.js";

const lan = "http://10.184.142.31:3000";
const localhost = "http://localhost:3000";

test("development trusts exact frontend origins but ignores unlisted origins", () => {
  const env = {
    NODE_ENV: "development",
    FRONTEND_URL: localhost,
    FRONTEND_URLS: `${lan}, https://example.invalid`,
  };
  assert.deepEqual(trustedFrontendOrigins(env), [
    localhost,
    lan,
    "https://example.invalid",
  ]);

  const app = express();
  app.use(express.json());
  app.use(
    originGuard({
      ...env,
      trustedFrontendOrigins: trustedFrontendOrigins(env),
    }),
  );
  app.post("/protected", (req, res) => res.json({ data: "ok" }));
  assert.deepEqual(
    [...trustedFrontendOrigins(env)],
    [localhost, lan, "https://example.invalid"],
  );
});

test("production ignores additional FRONTEND_URLS", () => {
  const env = {
    NODE_ENV: "production",
    FRONTEND_URL: localhost,
    FRONTEND_URLS: lan,
  };
  assert.deepEqual(trustedFrontendOrigins(env), [localhost]);
});

test("origin guard accepts listed development origins and rejects untrusted origins", async () => {
  const env = {
    NODE_ENV: "development",
    FRONTEND_URL: localhost,
    FRONTEND_URLS: lan,
    trustedFrontendOrigins: [localhost, lan],
  };
  const app = express();
  app.use(originGuard(env));
  app.post("/protected", (req, res) => res.json({ data: "ok" }));
  await supertest(app).post("/protected").set("Origin", lan).expect(200);
  await supertest(app)
    .post("/protected")
    .set("Origin", "https://untrusted.example")
    .expect(403);
  await supertest(app).post("/protected").expect(403);
});
