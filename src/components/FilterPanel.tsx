import type { Difficulty, Filters, Question, Section } from '../lib/types'
import { DIFFICULTY_NAMES, SECTION_NAMES, domainRank, skillRank } from '../lib/types'

export const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

/**
 * Everything a filter UI needs: domains and skills in College Board order, counts that follow the
 * difficulty filter, and the domain/skill toggles (checking a domain covers all its skills; unticking
 * one skill of a checked domain swaps the domain for its other skills, so controls always mean what
 * they show). Shared by the Browse sidebar and the Practice setup flow.
 */
export function useFilterModel(questions: Question[], filters: Filters, onChange: (f: Filters) => void) {
  const domainMap = new Map<string, string>()
  const skillMap = new Map<string, { name: string; domain: string }>()
  const counts = new Map<string, number>() // by domain code and by `skill:<code>`
  for (const q of questions) {
    domainMap.set(q.domain, q.domainName)
    skillMap.set(q.skill, { name: q.skillName, domain: q.domain })
    if (filters.difficulties.length && !filters.difficulties.includes(q.difficulty)) continue
    counts.set(q.domain, (counts.get(q.domain) ?? 0) + 1)
    counts.set(`skill:${q.skill}`, (counts.get(`skill:${q.skill}`) ?? 0) + 1)
  }
  const domains = [...domainMap].sort(([a], [b]) => domainRank(a) - domainRank(b))
  const skills = [...skillMap].sort(([, a], [, b]) => skillRank(a.name) - skillRank(b.name))
  const skillsOf = (domain: string) => skills.filter(([, s]) => s.domain === domain)

  function toggleDomain(code: string) {
    const own = new Set(skillsOf(code).map(([c]) => c))
    onChange({ ...filters, domains: toggleIn(filters.domains, code), skills: filters.skills.filter((s) => !own.has(s)) })
  }
  function toggleSkill(code: string, domain: string) {
    if (filters.domains.includes(domain)) {
      onChange({
        ...filters,
        domains: filters.domains.filter((d) => d !== domain),
        skills: [...filters.skills, ...skillsOf(domain).map(([c]) => c).filter((s) => s !== code)],
      })
    } else {
      onChange({ ...filters, skills: toggleIn(filters.skills, code) })
    }
  }
  const skillChecked = (code: string, domain: string) => filters.domains.includes(domain) || filters.skills.includes(code)
  const anySelected = filters.domains.length + filters.skills.length > 0
  const clearFocus = () => onChange({ ...filters, domains: [], skills: [] })

  return { domains, skills, skillsOf, counts, toggleDomain, toggleSkill, skillChecked, anySelected, clearFocus }
}

interface Props {
  questions: Question[]
  filters: Filters
  onChange: (f: Filters) => void
}

/** Sidebar filters (Browse page). */
export function FilterPanel({ questions, filters, onChange }: Props) {
  const m = useFilterModel(questions, filters, onChange)

  return (
    <aside className="filters">
      <div className="filter-group">
        <div className="filter-title">Section</div>
        <div className="seg">
          {(Object.keys(SECTION_NAMES) as Section[]).map((s) => (
            <button
              key={s}
              className={filters.section === s ? 'active' : ''}
              onClick={() => onChange({ ...filters, section: s, domains: [], skills: [] })}
            >
              {SECTION_NAMES[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-title">Difficulty</div>
        <div className="seg">
          {(['E', 'M', 'H'] as Difficulty[]).map((d) => (
            <button
              key={d}
              className={filters.difficulties.includes(d) ? `active diff-${d}` : ''}
              onClick={() => onChange({ ...filters, difficulties: toggleIn(filters.difficulties, d) })}
            >
              {DIFFICULTY_NAMES[d]}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-head">
          <div className="filter-title">Domains &amp; skills</div>
          {m.anySelected && (
            <button className="link small" onClick={m.clearFocus}>
              Clear
            </button>
          )}
        </div>
        {!m.anySelected && <p className="muted small hint">None selected = all domains</p>}
        {m.domains.map(([code, name]) => (
          <div key={code} className="domain">
            <label className="check domain-name">
              <input type="checkbox" checked={filters.domains.includes(code)} onChange={() => m.toggleDomain(code)} />
              <span className="grow">{name}</span>
              <span className="count">{m.counts.get(code) ?? 0}</span>
            </label>
            <div className="skills">
              {m.skillsOf(code).map(([skill, s]) => (
                <label key={skill} className="check small">
                  <input type="checkbox" checked={m.skillChecked(skill, code)} onChange={() => m.toggleSkill(skill, code)} />
                  <span className="grow">{s.name}</span>
                  <span className="count">{m.counts.get(`skill:${skill}`) ?? 0}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="filter-group">
        <div className="filter-title">Status</div>
        <label className="check">
          <input type="checkbox" checked={filters.hideAnswered} onChange={(e) => onChange({ ...filters, hideAnswered: e.target.checked })} />
          Hide answered
        </label>
        <label className="check">
          <input type="checkbox" checked={filters.onlyWrong} onChange={(e) => onChange({ ...filters, onlyWrong: e.target.checked })} />
          Only ones I got wrong
        </label>
        <label className="check">
          <input type="checkbox" checked={filters.onlyFlagged} onChange={(e) => onChange({ ...filters, onlyFlagged: e.target.checked })} />
          Only flagged
        </label>
      </div>
    </aside>
  )
}

export function applyFilters(
  questions: Question[],
  f: Filters,
  latest: Map<string, { correct: boolean }>,
  flagged: string[],
): Question[] {
  return questions.filter((q) => {
    if (q.section !== f.section) return false
    if (f.difficulties.length && !f.difficulties.includes(q.difficulty)) return false
    // A question matches if its domain or its skill is selected; nothing selected means everything.
    if ((f.domains.length || f.skills.length) && !f.domains.includes(q.domain) && !f.skills.includes(q.skill))
      return false
    const a = latest.get(q.id)
    if (f.hideAnswered && a) return false
    if (f.onlyWrong && (!a || a.correct)) return false
    if (f.onlyFlagged && !flagged.includes(q.id)) return false
    return true
  })
}

export const DEFAULT_FILTERS: Filters = {
  section: 'rw',
  domains: [],
  skills: [],
  difficulties: [],
  hideAnswered: false,
  onlyWrong: false,
  onlyFlagged: false,
}
