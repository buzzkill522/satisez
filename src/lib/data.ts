import type { Question, Section } from './types'

const cache: Partial<Record<Section, Promise<Question[]>>> = {}

export function loadSection(section: Section): Promise<Question[]> {
  if (!cache[section]) {
    cache[section] = fetch(`${import.meta.env.BASE_URL}data/${section}.json`).then(async (res) => {
      if (!res.ok) throw new Error(`Missing data/${section}.json — run \`npm run fetch\` first.`)
      return (await res.json()) as Question[]
    })
  }
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
