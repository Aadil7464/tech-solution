import { z } from "zod";
export const budgetOptions = [
  ["under-25000", "Under ₹25,000"],
  ["25000-50000", "₹25,000 – ₹50,000"],
  ["50000-100000", "₹50,000 – ₹1,00,000"],
  ["100000-plus", "₹1,00,000+"],
  ["discuss", "Let’s discuss"],
] as const;
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.email("Enter a valid email address").max(254),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine(
      (v) =>
        !v ||
        (/^[+\d() .-]+$/.test(v) &&
          v.replace(/\D/g, "").length >= 7 &&
          v.replace(/\D/g, "").length <= 15),
      "Enter a valid mobile number",
    )
    .optional(),
  budget: z
    .enum([
      "",
      "under-25000",
      "25000-50000",
      "50000-100000",
      "100000-plus",
      "discuss",
    ])
    .optional(),
  company: z.string().trim().max(200),
  service: z.string().max(120),
  message: z
    .string()
    .trim()
    .min(20, "Please share at least 20 characters")
    .max(5000),
  website: z.literal(""),
  consent: z.literal(true, { error: "Please acknowledge the privacy policy" }),
});
export type ContactValues = z.infer<typeof contactSchema>;
