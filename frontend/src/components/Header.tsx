"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import BrandLogo from "./BrandLogo";
export default function Header({
  logo,
  services = [],
}: {
  logo?: string;
  services?: { title: string; slug: string; category?: string }[];
}) {
  const [open, setOpen] = useState(false),
    [servicesOpen, setServicesOpen] = useState(false),
    [scrolled, setScrolled] = useState(false);
  const path = usePathname();
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  function close() {
    setOpen(false);
    setServicesOpen(false);
  }
  const categories = [
    ["development", "Development & technology", "⌘"],
    ["marketing", "Digital marketing", "↗"],
    ["creative", "Brand & creative", "✦"],
  ] as const;
  const serviceDescription = (slug: string) =>
    slug.includes("seo")
      ? "Clearer visibility and stronger organic discovery."
      : slug.includes("ads")
        ? "Focused campaigns connected to measurable actions."
        : slug.includes("mobile") || slug.includes("app")
          ? "Purpose-built experiences for useful everyday tasks."
          : slug.includes("marketing")
            ? "A consistent strategy for audience-focused growth."
            : slug.includes("design")
              ? "Clear, consistent visual communication."
              : "Reliable technology built around your business goals.";
  return (
    <header className={"header" + (scrolled ? " scrolled" : "")}>
      <div className="container nav">
        {" "}
        <Link href="/" aria-label="Go to homepage">
          <BrandLogo className="header-logo" src={logo} />
        </Link>
        <button
          className="menu-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="main-nav"
        >
          {open ? "Close" : "Menu"} <span aria-hidden>☰</span>
        </button>
        <nav
          id="main-nav"
          className={open ? "nav-links open" : "nav-links"}
          aria-label="Main navigation"
        >
          {[
            ["Home", "/"],
            ["About", "/about"],
          ].map(([label, url]) => (
            <Link
              key={url}
              href={url}
              aria-current={path === url ? "page" : undefined}
              onClick={close}
            >
              {label}
            </Link>
          ))}
          <div
            className={"services-menu" + (servicesOpen ? " mobile-open" : "")}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.currentTarget.blur();
                setServicesOpen(false);
              }
            }}
          >
            <Link
              className="services-menu-trigger"
              href="/services"
              aria-current={path.startsWith("/services") ? "page" : undefined}
              onClick={(e) => {
                if (window.matchMedia("(max-width: 800px)").matches) {
                  e.preventDefault();
                  setServicesOpen(!servicesOpen);
                }
              }}
            >
              Services
            </Link>
            <div className="services-dropdown">
              <Link className="dropdown-all" href="/services" onClick={close}>
                Explore all services <span aria-hidden>↗</span>
              </Link>
              {categories.map(([key, label, icon]) => (
                <div className="dropdown-group" key={key}>
                  <strong>
                    <span aria-hidden>{icon}</span>
                    {label}
                  </strong>
                  {services
                    .filter((s) => s.category === key)
                    .map((s) => (
                      <Link
                        key={s.slug}
                        href={"/services/" + s.slug}
                        onClick={close}
                      >
                        <span>
                          <b>{s.title}</b>
                          <small>{serviceDescription(s.slug)}</small>
                        </span>
                        <i aria-hidden>↗</i>
                      </Link>
                    ))}
                </div>
              ))}
            </div>
          </div>
          {[
            ["Portfolio", "/portfolio"],
            ["Blog", "/blog"],
            ["Contact", "/contact"],
          ].map(([label, url]) => (
            <Link
              key={url}
              href={url}
              aria-current={path === url ? "page" : undefined}
              onClick={close}
            >
              {label}
            </Link>
          ))}
          <Link className="button small" href="/contact" onClick={close}>
            Get a Free Quote <span aria-hidden>↗</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
