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

async function get(url) {
  const res = await fetch(url)
  if (!res.ok) {
    httpErrors.set(`GET ${new URL(url).host}`, res.status)
    return null
  }
  return res.json()
}

/** Fetch one question's content. Older ("ibn") items live on a separate host; fall back to the main API. */
async function fetchDetail(meta) {
  if (meta.external_id) return post(`${API}/get-question`, { external_id: meta.external_id })
  return (await get(`${IBN_API}/${meta.ibn}.json`)) ?? post(`${API}/get-question`, { external_id: meta.ibn })
}

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
  // "ibn" (disclosed paper-style) format: an array with one item
  const item = Array.isArray(detail) ? detail[0] : detail
  const q = item?.item?.[0] ?? item
  const choices = q?.answer?.choices ?? {}
  return {
    ...base,
    type: q?.answer?.style === 'SPR' ? 'spr' : 'mcq',
    stimulus: q?.passage?.body ?? '',
    stem: q?.prompt ?? '',
    choices: Object.entries(choices).map(([k, v]) => ({ key: k.toUpperCase(), content: v.body })),
    answers: (q?.answer?.correct_choice ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
    rationale: q?.answer?.rationale ?? '',
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
    const stats = { cached: 0, fetched: 0, empty: 0, error: 0, ibn: 0 }
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
            else stats.empty++
          } catch (err) {
            stats.error++
            console.warn(`  ! failed ${id}: ${err.message}`)
          }
        }
        if (q) results.push(q)
        if (++done % 250 === 0) console.log(`  ${done}/${metas.length}`)
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker))
    console.log(
      `  saved ${results.length}/${metas.length} (cached ${stats.cached}, fetched ${stats.fetched}, ` +
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
    const missing = test.domains.split(',').filter((d) => !byDomain.has(d))
    if (missing.length) console.warn(`  WARNING: no questions saved for domain(s) ${missing.join(', ')}`)
  }
  await writeFile(new URL('index.json', OUT_DIR), JSON.stringify(index))
  if (httpErrors.size) console.warn(`\nHTTP errors seen: ${[...httpErrors].map(([k, v]) => `${k} → ${v}`).join(', ')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
