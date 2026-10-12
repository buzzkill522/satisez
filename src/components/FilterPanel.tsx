import type { Difficulty, Filters, Question, Section } from '../lib/types'
import { DIFFICULTY_NAMES, SECTION_NAMES } from '../lib/types'

interface Props {
  questions: Question[]
  filters: Filters
  onChange: (f: Filters) => void
}

export function FilterPanel({ questions, filters, onChange }: Props) {
  const domains = new Map<string, string>()
  const skills = new Map<string, { name: string; domain: string }>()
  for (const q of questions) {
    domains.set(q.domain, q.domainName)
    skills.set(q.skill, { name: q.skillName, domain: q.domain })
  }

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  return (
    <aside className="filters">
      <div className="filter-group">
        <label>Section</label>
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
        <label>Difficulty</label>
        <div className="seg">
          {(['E', 'M', 'H'] as Difficulty[]).map((d) => (
            <button
              key={d}
              className={filters.difficulties.includes(d) ? `active diff-${d}` : ''}
              onClick={() => onChange({ ...filters, difficulties: toggle(filters.difficulties, d) })}
            >
              {DIFFICULTY_NAMES[d]}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <label>Domain</label>
        {[...domains].map(([code, name]) => (
          <div key={code}>
            <label className="check">
              <input
                type="checkbox"
                checked={filters.domains.includes(code)}
                onChange={() => onChange({ ...filters, domains: toggle(filters.domains, code) })}
              />
              {name}
            </label>
            <div className="skills">
              {[...skills]
                .filter(([, s]) => s.domain === code)
                .map(([code, s]) => (
                  <label key={code} className="check small">
                    <input
                      type="checkbox"
                      checked={filters.skills.includes(code)}
                      onChange={() => onChange({ ...filters, skills: toggle(filters.skills, code) })}
                    />
                    {s.name}
                  </label>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="filter-group">
        <label>Status</label>
        <label className="check">
          <input
            type="checkbox"
            checked={filters.hideAnswered}
            onChange={(e) => onChange({ ...filters, hideAnswered: e.target.checked })}
          />
          Hide answered
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={filters.onlyWrong}
            onChange={(e) => onChange({ ...filters, onlyWrong: e.target.checked })}
          />
          Only ones I got wrong
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={filters.onlyFlagged}
            onChange={(e) => onChange({ ...filters, onlyFlagged: e.target.checked })}
          />
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
    if (f.skills.length) {
      if (!f.skills.includes(q.skill)) return false
    } else if (f.domains.length && !f.domains.includes(q.domain)) return false
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
