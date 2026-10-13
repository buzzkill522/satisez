# SATisEZ

A personal SAT practice site built on the full College Board **Educational Question Bank**
(every released Digital SAT Reading & Writing and Math question), with the tools the official
bank is missing:

- **Practice mode** – filter by section, domain, skill, difficulty and status; instant
  correct/incorrect feedback with the official rationale after each question; per-question stopwatch.
- **Timed module mode** – real Digital SAT module timing (R&W: 27 questions / 32 min, Math: 22 / 35),
  countdown that turns red under 5 minutes, scored at the end with a review grid.
- **Test-day tools** – answer eliminator (strike-through choices), mark for review, per-question
  notes, question navigator strip, keyboard shortcuts (`A`–`D`, `Enter`, `←`/`→`), Desmos link on Math.
- **Student-produced responses** – free-entry Math answers checked numerically (fractions, decimals,
  multiple accepted answers).
- **Browse** – search and page through the whole bank; drill into any question.
- **Progress** – accuracy by section / difficulty / skill, weakest skills, average time, day streak,
  recent history. Everything is stored in your browser; export/import as JSON.

## Design

The site uses the **Amanat design system** (Mukta + Nunito, a monochrome ink ramp with rupee-gold
as the single accent, ledge buttons, 44px tap targets, light and dark themes). Its tokens are
mapped onto the site's CSS variables at the top of `src/styles.css`, and the fonts are self-hosted
in `public/fonts/`. The test-taking screen deliberately keeps the Bluebook look.

## Setup

```sh
npm install
npm run fetch     # downloads the question bank into public/data/ (a few minutes)
npm run dev       # http://localhost:5173
```

`npm run fetch` talks to College Board's public question-bank API and writes one JSON file per
domain under `public/data/` (plus an `index.json`). Those files are git-ignored (the content belongs
to College Board); re-running the script only downloads questions you don't already have.
`npm run fetch -- --limit 20` grabs a small sample for a quick test.

## Accounts (optional)

Nothing requires an account: questions, practice, the tutor and the guide are open to everyone.
Signing in is offered for the Admin page and, later, syncing progress across devices.

Two methods, both at `/#/signin`:

- **Email + password** — needs only `SESSION_SECRET` (a long random string, type *Secret*) and the
  `USERS` KV binding (*Workers & Pages → KV → Create namespace*, then *Settings → Bindings → Add → KV
  namespace*, variable name `USERS`). Passwords are stored as PBKDF2-SHA256 hashes.
- **Google** — additionally `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from an OAuth client
  (Web application, redirect URI `https://satisez.pages.dev/api/auth/callback`). The Google button only
  appears when both are set.

`ADMIN_EMAILS` (comma-separated) lists the site **owners**. Owners are always admins and can make
other accounts admins from the **Admin** page. Every admin can: give, extend or remove Premium
(1 month to lifetime, or until a date), add an account by email before the person signs up, block
or unblock sign-in, set a new password, rename and delete accounts, and see each user's saved
progress. The Admin page also has site totals, filters, CSV export and an activity log of admin
actions. Owners can't be demoted, blocked or deleted from the site.

## Saved progress (accounts)

For signed-in users, every answer, flag, note, tutor chat and study-guide step (pages opened,
sample-question results, "Mark as done") is saved to their account in **Cloudflare D1** and
follows them to any device. Progress made before signing in is uploaded on first sign-in.
Signing out clears the browser copy so the next person on that computer starts fresh.
Visitors without an account keep progress in their browser only.

Setup (once): Cloudflare dashboard → **Storage & Databases → D1 → Create database** (any name,
e.g. `satisez`). Then the Pages project → **Settings → Bindings → Add → D1 database**, variable
name `DB`, pick that database, and redeploy. The tables are created automatically on first use.
D1's free tier allows 100,000 row writes a day (KV allows only 1,000, which is why progress
doesn't live in KV).

## Premium and payments

Free visitors get **today's five questions** (the same five for everyone, picked from the date by
`server/daily.js` and served by `/api/daily`). After the fifth answer they see the paywall. The full
question bank (`/data/*` except `index.json`), Browse, the full Practice setup and the whole Guide
are for **Premium** accounts; the tutor, flags, notes and the Progress page stay free. Admins always
have Premium, and the Admin page can grant or remove a year for any account.

Prices live in `server/pricing.json` (regular price, launch price, days) — edit them there. Payments:

- **Razorpay** (India, INR — UPI, cards, net banking), Standard Web Checkout. Flow: the Upgrade
  button calls `POST /api/checkout/razorpay` (creates an order on Razorpay; amount from
  `server/pricing.json`, minimum 100 paise), opens the Razorpay modal with that order, then sends
  `razorpay_order_id`, `razorpay_payment_id` and `razorpay_signature` to
  `POST /api/checkout/razorpay-verify`, which checks HMAC-SHA256(order_id|payment_id, key secret)
  and grants Premium for the plan stored on the order. For local testing copy `.env.example` to
  `.dev.vars` (git-ignored) and run `npx wrangler pages dev dist`. Settings: `RAZORPAY_KEY_ID`,
  `RAZORPAY_KEY_SECRET` (Secret), `RAZORPAY_WEBHOOK_SECRET` (Secret). Add a webhook in the Razorpay
  dashboard pointing at `https://satisez.com/api/webhooks/razorpay` for the `payment.captured` event.
  The browser also confirms each payment through `/api/checkout/razorpay-verify`, so premium is on
  the moment the payment succeeds.
- **Paddle** (everywhere else, USD — cards, PayPal). Create two one-time prices (monthly and yearly)
  in Paddle, then set `PADDLE_CLIENT_TOKEN`, `PADDLE_PRICE_MONTHLY`, `PADDLE_PRICE_YEARLY`,
  `PADDLE_WEBHOOK_SECRET` (Secret) and, while testing, `PADDLE_ENV=sandbox`. Add a notification
  destination for `transaction.completed` pointing at `https://satisez.com/api/webhooks/paddle`.
  Premium is granted when that webhook arrives (usually within a few seconds).

**Referral codes.** Every account gets a code (Upgrade page, with a share link
`/#/upgrade?ref=CODE` that fills it in). A first-time buyer who enters a friend's code gets
`referral.discountPercent` off (10%), and the code's owner gets `referral.rewardDays` of Premium
(31) once the payment is confirmed; both numbers are in `server/pricing.json`. You can't use your
own code, and each payment rewards once. Codes apply to ₹ payments; for $ payments create a
percentage discount in Paddle with the same % and set its ID as `PADDLE_REFERRAL_DISCOUNT_ID`.

Without accounts configured (no `SESSION_SECRET`), nothing is gated, so local `npm run dev` shows
everything.

## AI tutor ("Ask about this question")

After checking an answer, the feedback box has a chat where you can ask a specific doubt. It runs
on **Cloudflare Workers AI**, which is free up to a daily allowance — no API key or card. It is
served by a Pages Function (`functions/api/ask.js`). Setup, once:

1. Pages project → **Settings → Bindings → Add → Workers AI**, variable name `AI`.
2. Redeploy.

Only signed-in users can use the tutor, so strangers can't use up the daily allowance.

The default model is `@cf/meta/llama-3.1-8b-instruct` (small and cheap on the allowance); set an
`AI_MODEL` variable to try another Workers AI text model. Transcripts are saved per question in
the browser alongside your notes.

## Deploying to Cloudflare (Workers static assets)

`wrangler.jsonc` serves `dist/` as a static site. In Workers & Pages → Create → import this repo:
build command `npm run build:pages`, deploy command `npx wrangler deploy`.

## Deploying to Cloudflare Pages (alternative)

The question data is not committed, so the Pages build downloads it itself via `build:pages`.

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repo.
2. Build settings:
   - **Production branch:** `main` (or whichever branch you merge to)
   - **Build command:** `npm run build:pages`
   - **Build output directory:** `dist` (leaving this blank deploys the raw source → blank page)
   - Node version is picked up from `.nvmrc` (22).
3. Save and deploy. The first build takes a few minutes while it fetches the bank; later builds
   re-fetch too (there's no cache between Pages builds), which is fine for occasional deploys.

Routing uses hash URLs, so no `_redirects` file is needed. Progress is stored in each browser's
localStorage, so it is per-device; use Export/Import on the Progress page to move it.

`npm run build` alone (without the fetch) works for any static host if you already have
`public/data/*.json` locally.

## Layout

```
scripts/fetch-questions.mjs   downloader + normaliser (both "digital" and "ibn" API formats)
src/lib/types.ts              Question / Attempt types, module timing constants
src/lib/data.ts               data loading, SPR answer checking
src/lib/store.ts              localStorage-backed progress store
src/components/QuestionView   renders a question, choices, SPR input, feedback, rationale
src/components/Timer          countdown / stopwatch
src/components/FilterPanel    section/domain/skill/difficulty/status filters
src/pages/*                   Home, Practice (+ timed runner), Browse, Stats
```
