import { test } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import {
  notifyLead,
  leadMessage,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "../services/notifications.js";

const lead = {
  _id: "test-notification",
  name: "A real prospect",
  email: "prospect@example.com",
  phone: "+91 98765 43210",
  budget: "discuss",
  service: "Website Development",
  message: "Please help us plan a website.",
};
test("notification generates the intended recipient and reply-to using a local JSON transport", async () => {
  const env = {
    SMTP_FROM: "website@example.com",
    LEAD_NOTIFICATION_EMAIL: "digitalmitra@gmail.com",
  };
  const transport = nodemailer.createTransport({ jsonTransport: true });
  let captured;
  const status = await notifyLead(lead, env, {
    sendMail: async (message) => {
      captured = JSON.parse((await transport.sendMail(message)).message);
    },
  });
  assert.equal(status, "sent");
  assert.equal(captured.to[0].address, "digitalmitra@gmail.com");
  assert.equal(captured.replyTo[0].address, lead.email);
  assert.match(captured.text, /98765 43210/);
  assert.match(captured.text, /Please help/);
  assert.equal(leadMessage(lead, env).from, "website@example.com");
});
test("missing SMTP disables delivery and provider failures propagate for persisted lead status", async () => {
  assert.equal(await notifyLead(lead, {}), "disabled");
  await assert.rejects(
    notifyLead(
      lead,
      {},
      {
        sendMail: async () => {
          throw new Error("Provider unavailable");
        },
      },
    ),
    /Provider unavailable/,
  );
});

test("reset mail requires SMTP acceptance for the intended recipient", async () => {
  for (const result of [undefined, { accepted: [], rejected: [] }, { accepted: ["different@example.com"], rejected: [] }]) {
    await assert.rejects(sendPasswordResetEmail(
      "digitalmitra786@gmail.com", "Admin", "fixture-token", { FRONTEND_URL: "http://localhost:3000", SMTP_FROM: "sender@example.com" },
      { sendMail: async () => result },
    ), /recipient rejected/);
  }
});

test("reset delivery receipt pins the envelope and excludes reset tokens and SMTP secrets", async () => {
  const recipient = "digitalmitra786@gmail.com";
  const token = "fixture-secret-reset-token";
  const env = { FRONTEND_URL: "http://localhost:3000", SMTP_FROM: "sender@example.com", SMTP_PASS: "fixture-smtp-secret" };
  let sent;
  const receipt = await sendPasswordResetEmail(recipient, "Admin", token, env, {
    sendMail: async (message) => {
      sent = message;
      return { accepted: [recipient], messageId: "<trace@example.com>", response: `250 accepted ${token} ${env.SMTP_PASS}` };
    },
  });
  assert.deepEqual(sent.envelope, { from: env.SMTP_FROM, to: [recipient] });
  assert.deepEqual(sent.dsn, { ret: "headers", notify: ["failure", "delay"], recipient });
  assert.equal(receipt.status, "provider_accepted");
  assert.equal(receipt.inboxDelivery, "unconfirmed");
  assert.equal(receipt.messageId, "<trace@example.com>");
  assert.equal(receipt.resetPage, "http://localhost:3000/admin/reset-password");
  assert.ok(!JSON.stringify(receipt).includes(token));
  assert.ok(!JSON.stringify(receipt).includes(env.SMTP_PASS));
});

test("account links always use the canonical FRONTEND_URL", async () => {
  const env = {
    SMTP_FROM: "website@example.com",
    FRONTEND_URL: "http://10.184.142.31:3000",
  };
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const resetMessages = [],
    verificationMessages = [];
  for (const requestOrigin of [
    "http://localhost:3000",
    "http://10.184.142.31:3000",
  ]) {
    void requestOrigin;
    await sendPasswordResetEmail(
      "admin@example.com",
      "Admin",
      "reset-token",
      env,
      {
        sendMail: async (message) => {
          resetMessages.push(
            JSON.parse((await transport.sendMail(message)).message),
          );
          return { accepted: [message.to], rejected: [] };
        },
      },
    );
    await sendEmailVerification(
      "new-admin@example.com",
      "Admin",
      "verify-token",
      env,
      {
        sendMail: async (message) => {
          verificationMessages.push(
            JSON.parse((await transport.sendMail(message)).message),
          );
        },
      },
    );
  }
  const [resetMessage] = resetMessages;
  assert.equal(resetMessage.subject, "Reset Your Tech Solutions Admin Password");
  assert.equal(resetMessage.from.name, "Tech Solutions");
  const [verificationMessage] = verificationMessages;
  assert.match(
    resetMessage.text,
    /http:\/\/10\.184\.142\.31:3000\/admin\/reset-password\?token=reset-token/,
  );
  assert.match(
    verificationMessage.text,
    /http:\/\/10\.184\.142\.31:3000\/admin\/verify-email\?token=verify-token/,
  );
  assert.deepEqual(
    resetMessages.map((message) => message.text),
    [resetMessage.text, resetMessage.text],
  );
  assert.deepEqual(
    verificationMessages.map((message) => message.text),
    [verificationMessage.text, verificationMessage.text],
  );
});
