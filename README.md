# AI Website Growth Audit Platform

**A free, AI-powered website audit that scans a business site for SEO, speed, and trust issues and returns prioritised fixes in under 30 seconds. There is also a Pro monitoring dashboard.**

[![Live site](https://img.shields.io/badge/live-app.dean--da--dev.co.uk-2563eb?style=flat-square)](https://app.dean-da-dev.co.uk/)
![Astro](https://img.shields.io/badge/Astro-BC52EE?style=flat-square&logo=astro&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=flat-square&logo=stripe&logoColor=white)

**Live:** [app.dean-da-dev.co.uk](https://app.dean-da-dev.co.uk/)

---

## Screenshots

<!-- Add images to docs/screenshots/ and uncomment. -->
<!--
| Landing | Audit report | Monitoring dashboard |
|---|---|---|
| ![Landing](docs/screenshots/landing.png) | ![Report](docs/screenshots/report.png) | ![Dashboard](docs/screenshots/dashboard.png) |
-->

_Screenshots coming soon. For now, see the [live site](https://app.dean-da-dev.co.uk/)._

---

## Features

### Free website audit
Enter a URL and get a data-backed score across **seven categories**:

| Category | What's checked |
|---|---|
| SEO | Titles, meta descriptions, headings, structured data, sitemap, robots.txt, alt text |
| Performance | Real Core Web Vitals (LCP, CLS, INP) from Google PageSpeed Insights |
| Accessibility | Contrast, labels, heading hierarchy, ARIA, focus states |
| Trust | SSL, policies, contact details, testimonials, social links |
| Mobile | Viewport, responsive layout, tap targets, readability |
| Conversion | CTA visibility, contact forms, trust badges, content depth |
| Local SEO | Google Business Profile signals, NAP consistency, location pages |

- **AI-written recommendations.** Cloudflare Workers AI and Gemini rewrite each
  issue in plain English. If the AI call fails, deterministic rule-based text is
  used instead.
- An animated score dashboard with radar and severity charts and growth estimates
- A lead-capture gate before the **branded PDF report** download

### Monitoring dashboard (Free / Pro £5/mo)
- Tracks websites over time with scan history, score trends, and report history
- **Scheduled scans** via Cloudflare Cron Triggers. An hourly job runs any
  daily or weekly scans that are due, and a 15-minute job runs lightweight
  uptime checks.
- Competitor tracking and comparison
- **AI Coach** (Pro): ask questions about your site's results
- Web push notifications, an installable PWA, and Stripe billing and portal
- Plan limits are enforced on the server in `src/server/lib/access.ts`, the
  single source of truth, and mirrored in Firestore rules

### Content and SEO
- Built with Astro, so marketing pages, the blog, guides, industry and location
  pages, and comparison pages are static and fast
- Sitemap, structured data, and an answer engine optimisation (AEO) pass

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Astro (with React islands), TypeScript |
| UI | Tailwind CSS, Framer Motion, Recharts, lucide-react |
| Runtime | Cloudflare Workers with static assets, plus Cron Triggers |
| AI | Cloudflare Workers AI and Google Gemini |
| Data | Google PageSpeed Insights API, Cloudflare Browser Rendering |
| Backend | Firebase Auth and Firestore (Firestore is accessed through its REST API from the Worker) |
| Payments | Stripe Checkout, Billing Portal, and webhooks |
| PDF | jsPDF (client-side) |
| Testing | Vitest and Firestore rules unit tests |

---

## Getting started

### Prerequisites
- Node.js 20+
- A Cloudflare account (Workers, Workers AI, and Browser Rendering)
- A Firebase project with Firestore enabled
- A Google Cloud project with the **PageSpeed Insights API** enabled

### Install and run

```bash
git clone https://github.com/dean1234533/AI-growth-audit-platform.git
cd AI-growth-audit-platform
npm install
cp .dev.vars.example .dev.vars   # add PAGESPEED_API_KEY + FIREBASE_SERVICE_ACCOUNT_JSON
npm run dev
```

### Environment

| Variable | Where | Purpose |
|---|---|---|
| `PAGESPEED_API_KEY` | secret | Core Web Vitals data |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | secret | Server-side Firestore access (single-line JSON) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | secret | Pro billing |
| `VAPID_PRIVATE_KEY_JWK` | secret | Web push signing |
| `PUBLIC_FIREBASE_*`, `PUBLIC_VAPID_KEY` | build vars | Public client config |

Set production secrets with `npx wrangler secret put <NAME>`. Never commit `.dev.vars`.

### Scripts

```bash
npm run dev       # Astro dev server
npm run build     # astro check + build
npm run test      # Vitest
npm run lint      # oxlint
npm run deploy    # build + wrangler deploy (Worker, assets and cron entry)
```

---

## Project structure

```
src/
  pages/          Astro routes: marketing, blog, guides, dashboard, admin, api/*
  components/     landing, dashboard, dashboard-app (React), leadgen, seo, pwa, ui
  server/lib/     audit engine, access/plan limits, Firestore REST client, Gemini, alerts
  lib/            client helpers: scoring, recommendations, PDF, plans, push
  content/        blog + guide content collections
cron/             scheduled() entry: due full scans (hourly) + lightweight checks (15 min)
scripts/          content generation
wrangler.toml     Worker config, AI + Browser bindings, cron triggers, custom domain
```

---

## Author

Built by **Dean Da Dev**, a UK full-stack developer building web apps, websites,
and AI tools.

🌐 [dean-da-dev.co.uk](https://www.dean-da-dev.co.uk/) · 💼 [More projects](https://www.dean-da-dev.co.uk/portfolio) · 🐙 [GitHub](https://github.com/dean1234533)
