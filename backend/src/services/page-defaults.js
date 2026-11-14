export const homeSectionItems = {
  why: [
    {
      heading: "Strategy before a stack",
      body: "Choose the tools and channels that fit your business, with clear reasons behind each decision.",
    },
    {
      heading: "Built for the long term",
      body: "Readable code, useful content and a handover that helps your team keep moving.",
    },
    {
      heading: "A transparent partnership",
      body: "Your questions are welcome. Scope, ownership and review milestones stay visible.",
    },
  ],
  process: [
    {
      heading: "Discover",
      body: "Understand your audience, goals and the problem worth solving.",
    },
    {
      heading: "Define",
      body: "Agree on priorities, a practical scope and a clear delivery plan.",
    },
    {
      heading: "Build",
      body: "Design, develop and review the work together at each milestone.",
    },
    {
      heading: "Improve",
      body: "Launch with care, learn from evidence and plan the next move.",
    },
  ],
  technologies: [
    "Next.js",
    "React",
    "Node.js",
    "TypeScript",
    "MongoDB",
    "WordPress",
    "Flutter",
    "Shopify",
  ].map((heading) => ({ heading, body: "" })),
};
export const pageDefaults = [
  {
    title: "Grow Your Business in the Digital World",
    slug: "home",
    excerpt:
      "Your Trusted Digital Partner for Website Development, Mobile Applications, SEO and Performance Marketing.",
    cta: "Get Started",
    ctaUrl: "/contact",
    secondaryCta: "Explore Services",
    secondaryCtaUrl: "/services",
    seoTitle: "Tech Solutions | Development & Digital Marketing",
    metaDescription:
      "Build a stronger digital presence with Tech Solutions. Explore website development, mobile apps, SEO and performance marketing.",
    sections: [
      {
        key: "about",
        heading: "A digital partner. From the first idea to the next chapter.",
        body: "We bring a partner's spirit to your digital work: listening carefully, explaining the choices and building a practical path forward.",
      },
      {
        key: "services",
        heading: "Built to connect. Designed to move you forward.",
        body: "From your website and applications to the campaigns that bring people to them. One connected approach, shaped around your business.",
      },
      {
        key: "why",
        heading: "Good partnerships start with clarity.",
        body: "Clear scope. Direct communication. Ownership of your accounts and code. Work that can be reviewed, measured and maintained.",
      },
      {
        key: "process",
        heading: "A clear path from ambition to action.",
        body: "Discover the need. Define a focused plan. Design and build together. Launch, learn and improve.",
      },
      {
        key: "technologies",
        heading: "The right tools for the work.",
        body: "We choose the stack around your requirements, integrations and long-term maintenance needs.",
      },
      {
        key: "projects",
        heading: "Work with a purpose.",
        body: "Published projects appear here after review and client permission.",
      },
      {
        key: "testimonials",
        heading: "Real experiences. Shared with permission.",
        body: "Client feedback will appear here when approved testimonials are available.",
      },
      {
        key: "blog",
        heading: "Fresh thinking for your next move.",
        body: "Practical notes on websites, technology and digital marketing.",
      },
      {
        key: "faq",
        heading: "A few things you might be wondering.",
        body: "A good starting point before we discuss your brief.",
      },
      {
        key: "cta",
        heading: "Your next chapter starts with a conversation.",
        body: "Tell us what you are building. We will help you find a practical place to start.",
        linkLabel: "Get a Free Quote",
        linkUrl: "/contact",
      },
    ],
    faqs: [
      {
        question: "Where should we start?",
        answer:
          "Tell us about your business, your audience and the problem you want to solve. We can help define priorities before choosing services.",
      },
      {
        question: "Can you work with our existing website or team?",
        answer:
          "Yes. We review what is already working and agree where our contribution will be most useful.",
      },
      {
        question: "How are project costs decided?",
        answer:
          "Costs depend on scope, complexity, integrations and ongoing support. We provide a proposal after understanding the requirements.",
      },
      {
        question: "Do you guarantee marketing results?",
        answer:
          "No. Outcomes depend on market conditions, your offer and many other factors. We commit to a clear process and honest reporting.",
      },
    ],
  },
  {
    title: "Technology with purpose. A partnership with perspective.",
    slug: "about",
    excerpt:
      "Tech Solutions connects thoughtful design, dependable development and purposeful digital marketing.",
    content:
      "<h2>Your digital partner</h2><p>We help businesses connect the way they look, the tools they use and the way customers find them. We start with questions about your audience, operations and goals before discussing a solution.</p><h2>Clarity at every step</h2><p>Our approach is to agree a practical scope, make responsibilities visible and explain progress in plain language. Your accounts, source code and business data stay under the ownership agreed in your project contract.</p><h2>Connected by design</h2><p>A website, a mobile application and an advertising campaign should support the same business purpose. We plan those connections so each part makes the next step easier for your customers.</p><h2>Useful work, honestly presented</h2><p>We publish client names, results and testimonials only with permission. We do not promise guaranteed rankings, invented outcomes or a one-size-fits-all strategy.</p>",
    seoTitle: "About Tech Solutions",
    metaDescription:
      "Meet Tech Solutions: a practical partner for website development, mobile applications, SEO and digital marketing.",
  },
  {
    title: "Let’s build your next chapter.",
    slug: "contact",
    excerpt:
      "Share your goals, your questions and what you have in mind. We will use your brief to explore a practical scope.",
    seoTitle: "Contact Tech Solutions",
    metaDescription:
      "Discuss your website, application or marketing project with Tech Solutions. Email digitalmitra786@gmail.com or send an enquiry.",
  },
  ...[
    [
      "services",
      "Services",
      "Development, design and digital marketing, connected around your goals.",
    ],
    [
      "portfolio",
      "Portfolio",
      "Approved projects and the thinking behind them.",
    ],
    [
      "blog",
      "Blog",
      "Practical perspectives on development, design and digital growth.",
    ],
  ].map(([slug, title, excerpt]) => ({
    slug,
    title,
    excerpt,
    seoTitle: title + " | Tech Solutions",
    metaDescription: excerpt,
  })),
  {
    title: "Privacy Policy",
    slug: "privacy-policy",
    excerpt: "How we handle website enquiries and personal information.",
    noindex: true,
    content:
      "<p>Business policy template — complete the operating entity, jurisdiction, retention periods and any analytics details before publication.</p><h2>Information you share</h2><p>When you enquire, we receive your name, email, phone number if supplied, service interest, budget and message. Campaign and referring-page details may accompany the enquiry.</p><h2>How information is used</h2><p>We use enquiry information to respond, assess your requirements and manage the conversation. Access is limited to authorised team members. Enquiries are stored in our database and may trigger an email notification.</p><h2>Storage and service providers</h2><p>Contact us to confirm the hosting location, applicable processors and retention period for your information. We do not sell enquiry details.</p><h2>Your requests</h2><p>Email digitalmitra786@gmail.com to ask about access, correction or deletion. Applicable rights depend on your jurisdiction and legal obligations.</p><h2>Cookies and analytics</h2><p>Essential cookies protect administrator sessions. Analytics is disabled unless configured. Describe the actual analytics and consent setup here before enabling tracking.</p>",
  },
  {
    title: "Terms & Conditions",
    slug: "terms-and-conditions",
    excerpt: "Website use and the starting point for working together.",
    noindex: true,
    content:
      "<p>Business terms template — complete the legal entity, jurisdiction and applicable terms with appropriate review before publication.</p><h2>Website information</h2><p>Content explains our services and is not a binding proposal. Scope, timing, fees and deliverables are confirmed in a separate written agreement.</p><h2>Project agreements</h2><p>Ownership, licensing, payment milestones, support and third-party costs are defined before work begins. Submitting an enquiry does not create a service contract.</p><h2>Responsible use</h2><p>Do not misuse this website, attempt unauthorised access or submit unlawful material. We may restrict abusive submissions.</p><h2>Third-party services and outcomes</h2><p>Platforms and search engines control their own services. We do not guarantee rankings, advertising outcomes or app-store decisions.</p><h2>Questions</h2><p>Email digitalmitra786@gmail.com for clarification about the website or a project proposal.</p>",
  },
].map((page) => ({
  ...page,
  ...(page.sections
    ? {
        sections: page.sections.map((s) => ({
          ...s,
          items: homeSectionItems[s.key] || [],
        })),
      }
    : {}),
  status: "published",
}));
