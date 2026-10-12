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

`npm run fetch` talks to College Board's public question-bank API and writes
`public/data/rw.json` and `public/data/math.json`. Those files are git-ignored (the content belongs
to College Board); re-running the script only downloads questions you don't already have.
`npm run fetch -- --limit 20` grabs a small sample for a quick test.

## Deploying

`npm run build` produces a static site in `dist/` (routing uses hash URLs, so it works from any
static host or subfolder). Copy `public/data/*.json` alongside it if your host doesn't include
`public/` automatically — Vite does.

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
