import nodemailer from "nodemailer";

export function leadMessage(lead, env) {
  return {
    from: env.SMTP_FROM,
    to: env.LEAD_NOTIFICATION_EMAIL || "digitalmitra@gmail.com",
    replyTo: lead.email,
    subject: "New website enquiry — Digital Mitra Agency",
    text: [
      `Name: ${lead.name}`,
      `Email: ${lead.email}`,
      `Phone: ${lead.phone || "Not supplied"}`,
      `Company: ${lead.company || "Not supplied"}`,
      `Service: ${lead.service || "Not selected"}`,
      `Budget: ${lead.budget || "Not selected"}`,
      "",
      lead.message,
      "",
      `Enquiry ID: ${lead._id}`,
    ].join("\n"),
  };
}

export async function notifyLead(lead, env, transport) {
  if (!transport && (!env.SMTP_HOST || !env.SMTP_FROM)) return "disabled";
  const mailer =
    transport ||
    nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
        : {}),
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000,
      logger: false,
      debug: false,
    });
  await mailer.sendMail(leadMessage(lead, env));
  return "sent";
}

export async function sendPasswordResetEmail(
  email,
  name,
  token,
  env,
  transport,
) {
  const mailer =
    transport ||
    nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
        : {}),
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000,
      logger: false,
      debug: false,
    });
  const resetUrl = new URL(
    "/admin/reset-password",
    env.PUBLIC_FRONTEND_URL || env.FRONTEND_URL,
  );
  resetUrl.searchParams.set("token", token);
  await mailer.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: "Reset your Digital Mitra Agency admin password",
    text: [
      `Hello ${name || "Admin"},`,
      `Use this link within 15 minutes to reset your admin password:`,
      resetUrl.toString(),
      "If you did not request this reset, you can ignore this email.",
    ].join("\n\n"),
  });
}

export async function sendEmailVerification(
  email,
  name,
  token,
  env,
  transport,
) {
  const mailer =
    transport ||
    nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
        : {}),
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000,
      logger: false,
      debug: false,
    });
  const verifyUrl = new URL(
    "/admin/verify-email",
    env.PUBLIC_FRONTEND_URL || env.FRONTEND_URL,
  );
  verifyUrl.searchParams.set("token", token);
  await mailer.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: "Verify your Digital Mitra Agency admin email",
    text: [
      `Hello ${name || "Admin"},`,
      `Confirm this email address change within 15 minutes:`,
      verifyUrl.toString(),
      "If you did not request this change, ignore this email.",
    ].join("\n\n"),
  });
}
