import { z } from "zod";

export const adminBootstrapSchema = z.object({
  ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
  ADMIN_ROLE: z.enum(["admin", "editor"]).default("admin"),
  ADMIN_PASSWORD: z
    .string()
    .min(8)
    .max(72)
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "Password must be at most 72 UTF-8 bytes",
    ),
  ADMIN_NAME: z.string().min(2),
});
