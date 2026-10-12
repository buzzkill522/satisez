// Picks the day's five free questions deterministically from the date: 3 Reading and Writing
// from one domain and 2 Math from one domain (so at most two data files are read).

function seedFrom(text) {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}
function rng(seed) {
  let s = seed || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

export const DAILY_SPLIT = { rw: 3, math: 2 }

/** `load(path)` returns parsed JSON for data/<path>. */
export async function pickDaily(date, load) {
  const index = await load('index.json')
  const rand = rng(seedFrom(`satisez-daily-${date}`))
  const out = []
  for (const [section, n] of Object.entries(DAILY_SPLIT)) {
    const domains = index[section] ?? []
    if (!domains.length) continue
    const domain = domains[Math.floor(rand() * domains.length)]
    const pool = (await load(`${section}/${domain}.json`)).filter((q) => q.type === 'mcq' || q.type === 'spr')
    const taken = new Set()
    while (taken.size < Math.min(n, pool.length)) taken.add(Math.floor(rand() * pool.length))
    for (const i of taken) out.push(pool[i])
  }
  return out
}
