import { z } from "zod";
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().startsWith("mongodb"),
  JWT_SECRET: z
    .string()
    .min(48)
    .refine((v) => !v.includes("REPLACE"), "Generate a random JWT_SECRET"),
  FRONTEND_URL: z.url(),
  FRONTEND_URLS: z.string().default(""),
  TRUSTED_PROXY_CIDRS: z.string().default(""),
  PUBLIC_FRONTEND_URL: z.url().optional(),
  PUBLIC_API_URL: z.url().default("http://localhost:4000"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.email().or(z.literal("")).default(""),
  LEAD_NOTIFICATION_EMAIL: z.email().default("digitalmitra786@gmail.com"),
  UPLOAD_DIR: z.string().default("uploads"),
  MS_CLIENT_ID: z.string().default(""),
  MS_CLIENT_SECRET: z.string().default(""),
  MS_TENANT_ID: z.string().default(""),
  MS_DRIVE_ID: z.string().default(""),
  MS_WORKBOOK_ID: z.string().default(""),
  MS_TABLE_NAME: z.string().default("ContactLeads"),
  MS_GRAPH_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(120000)
    .default(15000),
});

export function trustedFrontendOrigins(env) {
  const origins = [env.FRONTEND_URL];
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    origins.push(
      ...String(env.FRONTEND_URLS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }
  return [
    ...new Set(
      origins
        .map((value) => {
          try {
            return new URL(value).origin;
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    ),
  ];
}

export const parseEnv = (input) => {
  const env = envSchema.parse(input);
  return { ...env, trustedFrontendOrigins: trustedFrontendOrigins(env) };
};
