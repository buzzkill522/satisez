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

## Accounts (Sign in with Google)

Anyone can create an account with Google. The College Board questions are locked on the server
(`functions/_middleware.js` guards `/data/*`): only admins, and users an admin switches on from the
**Admin** page, can load them. New users see a "waiting for access" message.

Setup, once:

1. **Google OAuth client** — https://console.cloud.google.com → create a project →
   *APIs & Services → OAuth consent screen*: app name, support email, audience **External**, then
   **Publish app**. Then *Credentials → Create credentials → OAuth client ID → Web application*,
   authorized redirect URI `https://satisez.pages.dev/api/auth/callback`. Copy the client ID and secret.
2. **Cloudflare KV** — *Workers & Pages → KV → Create namespace* (e.g. `satisez-users`), then in the
   Pages project *Settings → Bindings → Add → KV namespace*, variable name `USERS`.
3. **Pages variables** (*Settings → Variables and secrets*, Production):
   - `GOOGLE_CLIENT_ID` — from step 1
   - `GOOGLE_CLIENT_SECRET` — from step 1 (type *Secret*)
   - `SESSION_SECRET` — a long random string (type *Secret*); changing it signs everyone out
   - `ADMIN_EMAILS` — your Gmail address (comma-separate to add more admins)
4. Redeploy.

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
