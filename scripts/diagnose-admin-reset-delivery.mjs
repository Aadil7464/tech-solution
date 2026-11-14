// Sends one real reset to the official account and records SMTP evidence, never the token/password.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseEnv as readEnv } from "node:util";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import supertest from "supertest";
import { parseEnv } from "../backend/src/config/env.js";
import { createApp } from "../backend/src/app.js";
import { User } from "../backend/src/models/index.js";

assert.equal(process.env.SEND_OFFICIAL_RESET_DIAGNOSTIC, "1", "Explicit real-mail opt-in required");
const email = "digitalmitra786@gmail.com";
const env = parseEnv(readEnv(await fs.readFile("backend/.env", "utf8")));
assert.ok(["localhost", "127.0.0.1"].includes(new URL(env.MONGODB_URI).hostname));
const redact = (value) => {
  let text = String(value || "");
  for (const secret of [env.SMTP_PASS, env.JWT_SECRET]) if (secret) text = text.replaceAll(secret, "[redacted]");
  return text.replace(/[a-f0-9]{64}/gi, "[redacted-token-shaped-value]").replace(/[\r\n]/g, " ").slice(0, 500);
};
const evidence = { recipient: email, stage: "preflight", inboxDelivery: "unconfirmed", smtpHost: env.SMTP_HOST, port: env.SMTP_PORT, requireTLS: !env.SMTP_SECURE, sender: env.SMTP_FROM };
try {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false });
  evidence.database = mongoose.connection.name;
  const users = await User.find({}).select("+passwordHash").lean();
  const matches = users.filter((user) => user.email?.trim().toLowerCase() === email);
  assert.equal(matches.length, 1);
  const before = matches[0];
  assert.equal(before.role, "admin");
  const mailer = nodemailer.createTransport({
    host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, requireTLS: !env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    connectionTimeout: 6000, greetingTimeout: 6000, socketTimeout: 6000, logger: false, debug: false,
  });
  await mailer.verify();
  evidence.smtpConnectionAndAuthentication = "passed";
  const app = createApp({ ...env, NODE_ENV: "test" }, {
    passwordResetTransport: {
      sendMail: async (message) => {
        assert.equal(message.to, email);
        assert.deepEqual(message.envelope, { from: env.SMTP_FROM, to: [email] });
        assert.equal(message.subject, "Reset Your Tech Solutions Admin Password");
        const result = await mailer.sendMail(message);
        evidence.messageId = redact(result.messageId);
        evidence.smtpResponse = redact(result.response);
        evidence.envelopeFrom = result.envelope?.from;
        evidence.envelopeRecipients = result.envelope?.to;
        evidence.acceptedRecipient = result.accepted?.includes(email) || false;
        evidence.dsnRequested = true;
        return result;
      },
    },
  });
  const client = supertest.agent(app);
  const csrf = (await client.get("/api/v1/auth/csrf")).body.data.token;
  const response = await client.post("/api/v1/auth/forgot-password")
    .set("Origin", new URL(env.FRONTEND_URL).origin).set("x-csrf-token", csrf).send({ email });
  evidence.apiStatus = response.status;
  evidence.apiMessage = response.body.data?.message || response.body.error?.message;
  const after = await User.findById(before._id).select("+passwordHash +passwordResetHash").lean();
  evidence.accountIdPreserved = String(before._id) === String(after._id);
  evidence.passwordUnchanged = before.passwordHash === after.passwordHash;
  evidence.rolePreserved = after.role === "admin";
  evidence.tokenHashStored = Boolean(after.passwordResetHash);
  evidence.tokenExpiryValid = after.passwordResetExpires > new Date();
  evidence.userCountUnchanged = users.length === await User.countDocuments();
  const url = new URL("/admin/reset-password", env.PUBLIC_FRONTEND_URL || env.FRONTEND_URL);
  evidence.resetPageWithoutToken = url.origin + url.pathname;
  evidence.stage = response.status === 200 && evidence.acceptedRecipient ? "provider_accepted" : "submission_failed";
  if (evidence.stage !== "provider_accepted") process.exitCode = 1;
} catch (error) {
  evidence.stage = "diagnostic_failed";
  evidence.errorType = error.name;
  evidence.errorCode = error.code;
  evidence.smtpResponseCode = error.responseCode;
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  await fs.mkdir(".test-data", { recursive: true });
  await fs.writeFile(".test-data/admin-email-delivery-evidence.json", JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence));
}
