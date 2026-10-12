// Downloads the full SAT question bank from College Board's public
// Educational Question Bank API into public/data/{rw,math}.json.
//
// Usage: npm run fetch            (full bank)
//        npm run fetch -- --limit 50   (quick test)
//
// Already-downloaded questions are reused, so re-running is cheap.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

async function post(url, body) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
      if (!res.ok) return null
      return await res.json()
    } catch (err) {
      if (attempt === 5) throw err
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
    }
  }
}

async function get(url) {
  const res = await fetch(url)
  return res.ok ? res.json() : null
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
  for (const test of TESTS) {
    const outPath = new URL(`${test.key}.json`, OUT_DIR)
    const existing = existsSync(outPath) ? JSON.parse(await readFile(outPath, 'utf8')) : []
    const have = new Map(existing.map((q) => [q.id, q]))

    console.log(`\n${test.name}: listing questions…`)
    const list = await post(`${API}/get-questions`, {
      asmtEventId: SAT_EVENT_ID,
      test: test.id,
      domain: test.domains,
    })
    const metas = (list ?? []).slice(0, limit)
    console.log(`  ${metas.length} questions in bank, ${have.size} cached`)

    const results = []
    let done = 0
    const queue = [...metas]
    async function worker() {
      while (queue.length) {
        const meta = queue.shift()
        const id = meta.external_id || meta.ibn
        let q = have.get(id)
        if (!q) {
          try {
            const detail = meta.external_id
              ? await post(`${API}/get-question`, { external_id: meta.external_id })
              : await get(`${IBN_API}/${meta.ibn}.json`)
            q = normalise(meta, detail, test.key)
          } catch (err) {
            console.warn(`  ! failed ${id}: ${err.message}`)
          }
        }
        if (q) results.push(q)
        if (++done % 100 === 0) console.log(`  ${done}/${metas.length}`)
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker))

    if (results.length === 0) throw new Error(`No ${test.name} questions downloaded — API unreachable or its format changed`)
    results.sort((a, b) => a.id.localeCompare(b.id))
    await writeFile(outPath, JSON.stringify(results))
    console.log(`  wrote ${results.length} → public/data/${test.key}.json`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
