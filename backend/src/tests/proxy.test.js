import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { rateLimit } from "express-rate-limit";
import supertest from "supertest";
import { trustedProxyCidrs } from "../config/proxy.js";

test("proxy trust is disabled by default and rejects blanket/hop-count settings", () => {
  assert.equal(trustedProxyCidrs(), false);
  for (const value of ["true", "1", "*", "0.0.0.0/0", "::/0", "127.0.0.1/33", "::1/129", "localhost"])
    assert.throws(() => trustedProxyCidrs(value), /explicit IP/);
  assert.deepEqual(trustedProxyCidrs("127.0.0.1/8, ::1/128"), ["127.0.0.1/8", "::1/128"]);
});

test("verified loopback proxy preserves per-client limits and stops at untrusted hops", async () => {
  const app = express();
  app.set("trust proxy", trustedProxyCidrs("127.0.0.1/8,::1/128"));
  app.get("/ip", (req, res) => res.json({ ip: req.ip }));
  app.get("/limited", rateLimit({ windowMs: 60000, limit: 2 }), (req, res) => res.sendStatus(200));
  const first = "198.51.100.10";
  const second = "198.51.100.11";
  for (let i = 0; i < 2; i++) await supertest(app).get("/limited").set("X-Forwarded-For", first).expect(200);
  await supertest(app).get("/limited").set("X-Forwarded-For", first).expect(429);
  await supertest(app).get("/limited").set("X-Forwarded-For", second).expect(200);
  const response = await supertest(app).get("/ip").set("X-Forwarded-For", `${first}, ${second}`).expect(200);
  assert.equal(response.body.ip, second);
});
