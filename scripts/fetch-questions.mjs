// Downloads the full SAT question bank from College Board's public
// Educational Question Bank API into public/data/{rw,math}.json.
//
// Usage: npm run fetch            (full bank)
//        npm run fetch -- --limit 50   (quick test)
//
// Already-downloaded questions are reused, so re-running is cheap.
//
// Output is split per domain (public/data/<section>/<domain>.json + index.json)
// so no single file comes near Cloudflare Pages' 25 MiB per-file limit.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const API = 'https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital'
const IBN_API = 'https://saic.collegeboard.org/disclosed'
// Kept low: the API appears to throttle bursts, which silently empties responses.
const CONCURRENCY = 3
const OUT_DIR = new URL('../public/data/', import.meta.url)

const SAT_EVENT_ID = 99
const TESTS = [
  { id: 1, key: 'rw', name: 'Reading and Writing', domains: 'INI,CAS,EOI,SEC' },
  { id: 2, key: 'math', name: 'Math', domains: 'H,P,Q,S' },
]

const limit = (() => {
  const i = process.argv.indexOf('--limit')
  return i === -1 ? Infinity : Number(process.argv[i + 1])
})()

// Last non-OK HTTP status per URL kind, for the summary.
const httpErrors = new Map()

async function post(url, body) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
      if (!res.ok) {
        httpErrors.set(`POST ${url.split('/').pop()}`, res.status)
        return null
      }
      return await res.json()
    } catch (err) {
      if (attempt === 5) throw err
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// A few example failures (status + start of body) so the build log shows *why* items were empty.
const failureSamples = []
function noteFailure(id, what) {
  if (failureSamples.length < 5) failureSamples.push(`${id}: ${what}`)
}

/** One raw attempt at an item's content; returns the parsed JSON or null and notes why. */
async function tryDetail(meta) {
  const id = meta.external_id || meta.ibn
  const attempts = []
  if (meta.external_id) attempts.push(['POST', `${API}/get-question`, { external_id: meta.external_id }])
  if (meta.ibn) attempts.push(['GET', `${IBN_API}/${meta.ibn}.json`])
  if (!meta.external_id && meta.ibn) attempts.push(['POST', `${API}/get-question`, { external_id: meta.ibn }])
  for (const [method, url, body] of attempts) {
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const text = await res.text()
      if (!res.ok) {
        httpErrors.set(`${method} ${new URL(url).host}`, res.status)
        noteFailure(id, `${method} ${res.status} ${text.slice(0, 120).replace(/\s+/g, ' ')}`)
        continue
      }
      const json = text ? JSON.parse(text) : null
      const empty = json == null || (Array.isArray(json) ? json.length === 0 : Object.keys(json).length === 0)
      if (!empty) return json
      noteFailure(id, `${method} 200 but empty body: ${text.slice(0, 60)}`)
    } catch (err) {
      noteFailure(id, `${method} ${err.message}`)
    }
  }
  return null
}

/** Fetch one question's content, backing off and retrying when the API throttles or returns nothing. */
async function fetchDetail(meta, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const detail = await tryDetail(meta)
    if (detail) return detail
    await sleep(1500 * 2 ** i)
  }
  return null
}

let loggedIbnShape = false

/** Normalise both API shapes into the format the site consumes. */
function normalise(meta, detail, testKey) {
  if (!detail) return null
  const base = {
    id: meta.external_id || meta.ibn,
    section: testKey,
    domain: meta.primary_class_cd,
    domainName: meta.primary_class_cd_desc,
    skill: meta.skill_cd,
    skillName: meta.skill_desc,
    difficulty: meta.difficulty, // E | M | H
    scoreBand: meta.score_band_range_cd,
  }
  if (meta.external_id) {
    // "digital" question format
    const choices = detail.answerOptions ?? []
    return {
      ...base,
      type: detail.type === 'spr' ? 'spr' : 'mcq',
      stimulus: detail.stimulus ?? '',
      stem: detail.stem ?? '',
      choices: choices.map((c, i) => ({ key: 'ABCD'[i], content: c.content })),
      // digital MCQ answers are option ids; map to letters
      answers:
        detail.type === 'spr'
          ? (detail.correct_answer ?? [])
          : (detail.correct_answer ?? []).map((id) => {
              const i = choices.findIndex((c) => c.id === id)
              return i === -1 ? id : 'ABCD'[i]
            }),
      rationale: detail.rationale ?? '',
    }
  }
  // "ibn" (disclosed paper-style) format: an array with one item. Tables, graphs and
  // passages are in the item's `body`; the question itself is in `prompt`.
  const item = Array.isArray(detail) ? detail[0] : detail
  const q = item?.item?.[0] ?? item
  if (!loggedIbnShape) {
    loggedIbnShape = true
    console.log(`  (ibn item fields: ${Object.keys(q ?? {}).join(', ')}; answer fields: ${Object.keys(q?.answer ?? {}).join(', ')})`)
  }
  const choices = Object.entries(q?.answer?.choices ?? {})
  const correct = q?.answer?.correct_choice ?? q?.answer?.correct_answer ?? ''
  return {
    ...base,
    type: choices.length ? 'mcq' : 'spr',
    stimulus: q?.body ?? q?.passage?.body ?? q?.stimulus ?? '',
    stem: q?.prompt ?? q?.stem ?? '',
    choices: choices.map(([k, v]) => ({ key: k.toUpperCase(), content: v?.body ?? v })),
    answers: (Array.isArray(correct) ? correct : String(correct).split(','))
      .map((s) => String(s).trim())
      .filter(Boolean)
      .map((s) => (choices.length ? s.toUpperCase() : s)),
    rationale: q?.answer?.rationale ?? q?.rationale ?? '',
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const index = {}
  for (const test of TESTS) {
    const sectionDir = new URL(`${test.key}/`, OUT_DIR)
    await mkdir(sectionDir, { recursive: true })
    const existing = []
    for (const f of existsSync(sectionDir) ? await readdir(sectionDir) : []) {
      if (f.endsWith('.json')) existing.push(...JSON.parse(await readFile(new URL(f, sectionDir), 'utf8')))
    }
    const have = new Map(existing.map((q) => [q.id, q]))

    // List each domain separately so one bad code or failed request can't hide the others.
    console.log(`\n${test.name}: listing questions…`)
    const seen = new Set()
    const metas = []
    for (const domain of test.domains.split(',')) {
      const list = await post(`${API}/get-questions`, { asmtEventId: SAT_EVENT_ID, test: test.id, domain })
      console.log(`  ${domain}: ${list ? `${list.length} listed` : 'LISTING FAILED'}`)
      for (const meta of list ?? []) {
        const id = meta.external_id || meta.ibn
        if (id && !seen.has(id)) {
          seen.add(id)
          metas.push(meta)
        }
      }
    }
    metas.splice(limit)
    console.log(`  ${metas.length} questions total, ${have.size} cached`)

    const results = []
    const stats = { cached: 0, fetched: 0, retried: 0, empty: 0, error: 0, ibn: 0 }
    let done = 0
    const queue = [...metas]
    async function worker() {
      while (queue.length) {
        const meta = queue.shift()
        const id = meta.external_id || meta.ibn
        if (!meta.external_id) stats.ibn++
        let q = have.get(id)
        if (q) stats.cached++
        else {
          try {
            q = normalise(meta, await fetchDetail(meta), test.key)
            if (q) stats.fetched++
            else failed.push(meta)
          } catch (err) {
            stats.error++
            console.warn(`  ! failed ${id}: ${err.message}`)
          }
        }
        if (q) results.push(q)
        if (++done % 250 === 0) console.log(`  ${done}/${metas.length}`)
      }
    }
    const failed = []
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    // Second pass: one at a time with a pause, in case the first pass was being rate-limited.
    if (failed.length) {
      console.log(`  retrying ${failed.length} empty items slowly…`)
      // If retries keep failing it isn't throttling; stop rather than blow the build time limit.
      let streak = 0
      for (const [i, meta] of failed.entries()) {
        if (streak >= 20) {
          console.warn(`  20 retries in a row failed — giving up on the remaining ${failed.length - i}`)
          stats.empty += failed.length - i
          break
        }
        await sleep(400)
        const q = normalise(meta, await fetchDetail(meta, 4), test.key)
        if (q) {
          results.push(q)
          stats.fetched++
          stats.retried++
          streak = 0
        } else {
          stats.empty++
          streak++
        }
      }
    }
    console.log(
      `  saved ${results.length}/${metas.length} (cached ${stats.cached}, fetched ${stats.fetched} incl. ${stats.retried} on retry, ` +
        `no content ${stats.empty}, errors ${stats.error}; ${stats.ibn} were older "ibn" items)`,
    )

    if (results.length === 0) throw new Error(`No ${test.name} questions downloaded — API unreachable or its format changed`)
    results.sort((a, b) => a.id.localeCompare(b.id))
    const byDomain = Map.groupBy(results, (q) => q.domain)
    for (const [domain, qs] of byDomain) {
      const json = JSON.stringify(qs)
      await writeFile(new URL(`${domain}.json`, sectionDir), json)
      console.log(`  wrote ${qs.length} → public/data/${test.key}/${domain}.json (${(json.length / 1e6).toFixed(1)} MB)`)
    }
    index[test.key] = [...byDomain.keys()]
    index.counts = { ...(index.counts ?? {}), [test.key]: results.length }
    const missing = test.domains.split(',').filter((d) => !byDomain.has(d))
    if (missing.length) console.warn(`  WARNING: no questions saved for domain(s) ${missing.join(', ')}`)
  }
  await writeFile(new URL('index.json', OUT_DIR), JSON.stringify(index))
  if (failureSamples.length) console.warn(`\nExample failures:\n  ${failureSamples.join('\n  ')}`)
  if (httpErrors.size) console.warn(`\nHTTP errors seen: ${[...httpErrors].map(([k, v]) => `${k} → ${v}`).join(', ')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
