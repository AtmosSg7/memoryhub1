# MemoryHub — Product Requirements Document (PRD)

## Original problem statement
Create a modern SaaS landing page for **MemoryHub**, a client search platform for
French artisans, freelancers and small businesses. Promise: "Find every piece of
information about a client in less than 5 seconds." Connects Gmail, Google Drive
and Notion. Frontend only. Premium blue palette on white. Sections: Hero, "Your
client calls…" interactive demo with dashboard mockup (AI Summary, Emails, Quotes,
Invoices, Drive, Notion notes, Photos), Features, How it works (3 steps), Pricing
(Solo / Pro / Team), FAQ, Final CTA. Smooth animations, responsive. Feel like
Linear / Stripe / Notion.

## User choices
- Bilingual UI (FR / EN) with switcher
- Style: mix of Stripe (premium) + Linear (minimal)
- Realistic photos (Unsplash) in demo
- Pricing: Solo 19€ / Pro 49€ / Team 99€ per month

## Personas
- **Solo artisan** (menuisier, plombier, électricien) — juggles WhatsApp, Gmail,
  Notion; needs to answer client calls in seconds.
- **Freelance** — designer / consultant with 20–200 active clients.
- **TPE / small workshop** — 2–5 collaborators sharing a client history.

## Architecture (implemented)
- **Frontend**: React 19 + Tailwind + Shadcn UI + Framer Motion + lucide-react +
  react-icons. Craco alias `@` -> `/src`. Landing page assembled as composable
  section components under `/src/components`.
- **Backend**: none (frontend-only MVP as requested).
- **i18n**: lightweight custom `LanguageContext` + dictionary at
  `/src/lib/translations.js`.

## What's been implemented (2025-12)
- Sticky glassmorphism Navbar with FR/EN switcher + "Join the Beta" CTA
- Hero with mesh gradient, animated title, integration trust row
- Interactive Search demo — typing "Didier Martin", reveals a real-SaaS-looking
  client dashboard (chrome bar, avatar, tabs: AI Summary / Emails / Quotes /
  Invoices / Drive / Notion notes / Photos)
- Features grid (6 cards)
- How it works (3 steps)
- Pricing (Solo 19€ / Pro 49€ highlighted / Team 99€)
- FAQ accordion (Shadcn)
- Dark Final CTA section
- Footer
- Join modal with email capture + success state
- Full responsive (tested at 1440x900 and 390x844)
- 100% testing_agent_v3 pass rate

## Backlog

### P0
- (none — MVP complete)

### P1
- Real backend for beta waitlist (persist emails, Resend integration)
- Google OAuth "Connect Gmail / Drive / Notion" mock flow on landing
- Analytics: Plausible / PostHog page + CTA tracking

### P2
- Blog / changelog section
- Case studies (real artisan testimonials)
- Live chat / Crisp / Intercom
- Cookie consent banner (RGPD)

## Deferred
- Actual product app (only landing scope for this MVP)
