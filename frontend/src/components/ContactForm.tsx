"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { contactSchema, ContactValues, budgetOptions } from "@/lib/contact";
export default function ContactForm({
  services,
}: {
  services: { title: string; slug: string }[];
}) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      website: "",
      service: "",
      company: "",
      phone: "",
      budget: "",
    },
  });
  async function submit(values: ContactValues) {
    setResult(null);
    const { consent, ...body } = values;
    void consent;
    const q = new URLSearchParams(window.location.search);
    try {
      const r = await fetch("/api/v1/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          attribution: {
            source: q.get("utm_source") || "",
            medium: q.get("utm_medium") || "",
            campaign: q.get("utm_campaign") || "",
            referrer: document.referrer,
            landingPage: window.location.pathname + window.location.search,
          },
        }),
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(
          data.error?.message || "Your enquiry could not be sent.",
        );
      setResult({
        ok: true,
        message: "Thank you. Your enquiry has been received.",
      });
      reset();
    } catch (e) {
      setResult({
        ok: false,
        message: e instanceof Error ? e.message : "Please try again shortly.",
      });
    }
  }
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="contact-form">
      <div className="form-two">
        <label>
          Your name <span>*</span>
          <input
            autoComplete="name"
            maxLength={100}
            {...register("name")}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <small id="name-error" className="error">
              {errors.name.message}
            </small>
          )}
        </label>
        <label>
          Email address <span>*</span>
          <input
            type="email"
            autoComplete="email"
            maxLength={254}
            {...register("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <small id="email-error" className="error">
              {errors.email.message}
            </small>
          )}
        </label>
      </div>
      <div className="form-two">
        <label>
          Mobile number
          <input
            type="tel"
            autoComplete="tel"
            maxLength={30}
            placeholder="Include country code"
            {...register("phone")}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
          {errors.phone && (
            <small id="phone-error" className="error">
              {errors.phone.message}
            </small>
          )}
        </label>
        <label>
          Company
          <input
            autoComplete="organization"
            maxLength={200}
            {...register("company")}
          />
        </label>
      </div>
      <div className="form-two">
        <label>
          Select service
          <select {...register("service")}>
            <option value="">Let’s find the right fit</option>
            {services.map((s) => (
              <option key={s.slug} value={s.title}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Project budget
          <select {...register("budget")}>
            <option value="">Choose a range (optional)</option>
            {budgetOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Tell us about your project <span>*</span>
        <textarea
          rows={5}
          maxLength={5000}
          placeholder="Your goals, challenges and what you have in mind…"
          {...register("message")}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
        />
        {errors.message && (
          <small id="message-error" className="error">
            {errors.message.message}
          </small>
        )}
      </label>
      <div className="honeypot" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>
      <label className="checkbox">
        <input type="checkbox" {...register("consent")} />
        <span>
          I’ve read the <Link href="/privacy-policy">privacy policy</Link> and
          understand how my enquiry will be handled.
        </span>
      </label>
      {errors.consent && (
        <small className="error">{errors.consent.message}</small>
      )}
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={result.ok ? "success" : "error"}
        >
          {result.message}
        </p>
      )}
      <button className="button" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send your enquiry"}{" "}
        <span aria-hidden>↗</span>
      </button>
      <p className="form-note">
        Fields marked * are required. Budget ranges help us understand your
        brief; they are not quoted prices.
      </p>
    </form>
  );
}
