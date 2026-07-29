# AI Website Growth Audit Platform

A free, AI-powered website audit tool designed as a lead-generation funnel: a visitor enters
their website URL, gets a real, data-backed growth audit, and submits their contact details
to download the full branded PDF report.

**Stack:** React + TypeScript + Vite + Tailwind CSS + Framer Motion + Recharts, running as a single
Cloudflare Worker with static assets (frontend + `/api/*` routes in one deployment) and Firebase (lead storage).

## MVP scope (this pass)

Built:
- Animated landing page, "how it works" section, animated scanning state
- Real audit engine (Cloudflare Worker route) covering SEO, Performance (via Google
  PageSpeed Insights), Accessibility, Mobile, Trust, Conversion and Local SEO checks
- AI-generated recommendation wording via Cloudflare Workers AI (free tier), with a
  deterministic rule-based fallback if the AI call fails
- Animated score dashboard: overall score, category cards, radar/severity/performance charts,
  growth estimates, "We Can Fix Everything For You" CTA section
- Lead capture gate (name/email/business/website) before PDF download, storing leads in Firestore
- Branded PDF report generation (client-side)

Explicitly deferred to a follow-up pass (not built yet): competitor comparison, AI screenshot/design
analysis, in-report AI consultant chat, and the full admin dashboard (leads table, analytics, CSV export, auth).

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Google PageSpeed Insights API key (free)

Powers the Performance category (Core Web Vitals, unused CSS/JS, compression, caching, etc).

1. Create/select a project at https://console.cloud.google.com
2. Enable the **PageSpeed Insights API**
3. Create an API key under **APIs & Services → Credentials**

### 3. Firebase project (for lead storage)

1. Create a project at https://console.firebase.google.com
2. Enable **Firestore Database** (production mode)
3. Go to **Project settings → Service accounts → Generate new private key** and download the JSON

### 4. Cloudflare Workers AI

No separate signup needed — it uses the same Cloudflare account you'll deploy the Worker with, via
the `AI` binding declared in `wrangler.toml`. Free tier: ~10,000 neurons/day.

### 5. Local environment variables

```bash
cp .dev.vars.example .dev.vars
```

Fill in `PAGESPEED_API_KEY` and `FIREBASE_SERVICE_ACCOUNT_JSON` (paste the full downloaded
service account JSON as a single line). `.dev.vars` is gitignored — never commit it.

### 6. Run locally

The frontend (Vite, with hot reload) and the Worker (API routes + Workers AI binding) run as
two processes:

```bash
# Terminal 1 — frontend
npm run dev

# Terminal 2 — Worker (rebuilds dist/ first, then runs wrangler dev)
npm run dev:worker
```

Vite is configured to proxy `/api/*` requests to `http://127.0.0.1:8787`, which is Wrangler's
default local port for `wrangler dev`.

> Note: `wrangler dev` (and `wrangler deploy`) require macOS 13.5+, Linux (glibc 2.35+), or
> Windows — the underlying `workerd` runtime won't start on older macOS. If you hit an
> "Unsupported macOS version" error, deploy directly (step 7) and test against the live URL instead.

### 7. Deploy to Cloudflare

This project deploys as a single Cloudflare Worker with static assets (not a classic "Pages"
project) — `wrangler.toml` declares `main` (the Worker entry) and `[assets]` (the built frontend).

```bash
npm run deploy
```

Then set the production secrets (one-time):

```bash
npx wrangler secret put PAGESPEED_API_KEY
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
```

If deploying via a Git-connected Cloudflare dashboard build, make sure the project type is
**Workers** (not **Pages**) so it runs `wrangler deploy` — that's what actually executes
against this `wrangler.toml`.

## Project structure

```
src/
  components/
    landing/     Hero, HowItWorks, animated background
    dashboard/    Score circle, category cards, charts, growth estimate, CTA
    leadgen/       Lead capture modal
    ui/            Shared Button, GlassCard, Skeleton, AnimatedCounter
  lib/
    types.ts        Shared AuditResult/CategoryScore/Recommendation types
    scoring.ts       Category + overall score aggregation, growth estimate heuristic
    recommendations.ts  Deterministic rule table (fallback text + severity/impact/difficulty)
    api.ts           Client fetch wrappers for /api/audit and /api/lead
    pdf.ts            Branded PDF report generation
  pages/            LandingPage, ScanningState, ReportPage
worker/
  index.ts          Worker entry — routes /api/* to route handlers, else serves static assets
  routes/
    audit.ts         handleAudit() — orchestrates all checks, returns AuditResult JSON
    lead.ts           handleLead() — validates + writes lead to Firestore
  lib/
    fetchSite.ts      Fetches + parses target site HTML via HTMLRewriter
    aiNarrative.ts     Cloudflare Workers AI recommendation rewriting
    firestore.ts       Minimal Firestore REST client (service-account auth)
    checks/            One module per audit category
```

## Branding the PDF report

Edit the constants at the top of `src/lib/pdf.ts` (`BRAND_NAME`, `BRAND_CONTACT`) and the
CTA link targets passed into `CtaSection` in `src/pages/ReportPage.tsx` to point at your real
consultation booking, quote request, and portfolio pages.
