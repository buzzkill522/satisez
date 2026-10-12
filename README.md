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

## AI tutor ("Ask about this question")

After checking an answer, the feedback box has a chat where you can ask a specific doubt. It is
served by a Cloudflare Pages Function (`functions/api/ask.js`) that holds the API key, so the key
never reaches the browser. Set two secrets on the Pages project
(**Settings → Variables and secrets**, type *Secret*, environment *Production*):

- `ANTHROPIC_API_KEY` — from https://console.anthropic.com. The chat uses Claude Haiku 5.5 at low
  effort with short replies: about $0.0003 per exchange, so a dollar covers ~3,000 questions.
- `ACCESS_CODE` — any passcode you choose; the site asks for it once per device

Without both, the chat shows an error and nothing is billed. Transcripts are saved per question in
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
