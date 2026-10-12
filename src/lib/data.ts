import type { Question, Section } from './types'

const cache: Partial<Record<Section, Promise<Question[]>>> = {}
let indexPromise: Promise<Record<Section, string[]>> | null = null

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${path}`, { cache: 'no-cache' })
  if (res.status === 401 || res.status === 403) throw new Error('Your account does not have access to the question bank.')
  if (!res.ok) throw new Error(`Missing data/${path} — run \`npm run fetch\` first.`)
  return res.json()
}

/** Questions are stored one file per domain, listed in data/index.json. */
export function loadSection(section: Section): Promise<Question[]> {
  indexPromise ??= getJson('index.json')
  cache[section] ??= indexPromise.then(async (index) => {
    const parts = await Promise.all((index[section] ?? []).map((d) => getJson<Question[]>(`${section}/${d}.json`)))
    return parts.flat()
  })
  return cache[section]!
}

export async function loadAll(): Promise<Question[]> {
  const [rw, math] = await Promise.all([loadSection('rw'), loadSection('math')])
  return [...rw, ...math]
}

/** SPR answers: compare numerically when possible, accepting fractions and decimals. */
export function checkSpr(input: string, answers: string[]): boolean {
  const norm = (s: string) => s.replace(/\s+/g, '').replace(/^\+/, '')
  const given = norm(input)
  if (!given) return false
  const toNum = (s: string): number | null => {
    const m = s.match(/^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/)
    if (m) return Number(m[1]) / Number(m[2])
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  const g = toNum(given)
  return answers.some((a) => {
    const an = norm(a)
    if (an === given) return true
    const n = toNum(an)
    if (n === null || g === null) return false
    // SAT accepts answers rounded/truncated to the character limit, so allow small tolerance
    return Math.abs(n - g) < 0.001 + Math.abs(n) * 1e-6
  })
}

export function shuffle<T>(arr: T[], seed = Date.now()): T[] {
  const a = [...arr]
  let s = seed % 2147483647
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
