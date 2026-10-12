import type { Difficulty, Filters, Question, Section } from '../lib/types'
import { DIFFICULTY_NAMES, MODULE_SPEC, SECTION_NAMES } from '../lib/types'
import { toggleIn, useFilterModel } from './FilterPanel'
import { BookIcon, CalcIcon, CheckIcon, ClockIcon, SparkIcon } from './Icons'

export type Mode = 'practice' | 'timed'

interface Props {
  /** Questions for the chosen section, or null while loading. */
  questions: Question[] | null
  filters: Filters
  onChange: (f: Filters) => void
  mode: Mode
  setMode: (m: Mode) => void
  count: number
  setCount: (n: number) => void
  /** How many questions match the current choices. */
  poolCount: number
  onStart: () => void
}

const PRESETS = [5, 10, 20, 30]

/** A guided set-up: section → mode → focus → size, with a sticky summary bar that starts the set. */
export function PracticeSetup({ questions, filters, onChange, mode, setMode, count, setCount, poolCount, onStart }: Props) {
  const m = useFilterModel(questions ?? [], filters, onChange)
  const spec = MODULE_SPEC[filters.section]
  const size = mode === 'timed' ? spec.questions : count
  const willGet = Math.min(size, poolCount)
  const ready = Boolean(questions) && poolCount > 0

  const focusLabel = (() => {
    const parts: string[] = []
    const names = [
      ...filters.domains.map((d) => m.domains.find(([c]) => c === d)?.[1] ?? d),
      ...filters.skills.map((s) => m.skills.find(([c]) => c === s)?.[1].name ?? s),
    ]
    if (names.length) parts.push(names.length <= 2 ? names.join(' + ') : `${names.length} focus areas`)
    if (filters.difficulties.length) parts.push(filters.difficulties.map((d) => DIFFICULTY_NAMES[d]).join('/'))
    if (filters.onlyWrong) parts.push('my mistakes')
    else if (filters.hideAnswered) parts.push('unanswered')
    if (filters.onlyFlagged) parts.push('flagged')
    return parts.length ? parts.join(' · ') : 'all domains'
  })()

  return (
    <div className="setup">
      <header className="setup-head">
        <h1>Set up a practice session</h1>
        <p className="lead">Choose what to work on. Everything here can be changed later from the same screen.</p>
      </header>

      {/* 1 · Section */}
      <section className="step">
        <StepTitle n={1} title="Section" />
        <div className="choice-cards two">
          {(Object.keys(SECTION_NAMES) as Section[]).map((s) => {
            const sp = MODULE_SPEC[s]
            const on = filters.section === s
            return (
              <button
                key={s}
                className={`choice-card ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => onChange({ ...filters, section: s, domains: [], skills: [] })}
              >
                <span className="cc-icon">{s === 'rw' ? <BookIcon /> : <CalcIcon />}</span>
                <span className="cc-body">
                  <span className="cc-title">{SECTION_NAMES[s]}</span>
                  <span className="cc-sub">
                    {s === 'rw' ? 'Short passages, one question each' : 'Multiple choice and typed answers'} · module of {sp.questions} in {sp.minutes} min
                  </span>
                </span>
                <span className="cc-check"><CheckIcon width={18} height={18} /></span>
              </button>
            )
          })}
        </div>
      </section>

      {/* 2 · Mode */}
      <section className="step">
        <StepTitle n={2} title="Mode" />
        <div className="choice-cards two">
          <button className={`choice-card ${mode === 'practice' ? 'on' : ''}`} aria-pressed={mode === 'practice'} onClick={() => setMode('practice')}>
            <span className="cc-icon"><SparkIcon /></span>
            <span className="cc-body">
              <span className="cc-title">Practice</span>
              <span className="cc-sub">Check each answer as you go. Full explanation, AI tutor, no time limit.</span>
            </span>
            <span className="cc-check"><CheckIcon width={18} height={18} /></span>
          </button>
          <button className={`choice-card ${mode === 'timed' ? 'on' : ''}`} aria-pressed={mode === 'timed'} onClick={() => setMode('timed')}>
            <span className="cc-icon"><ClockIcon /></span>
            <span className="cc-body">
              <span className="cc-title">Timed module</span>
              <span className="cc-sub">
                {spec.questions} questions in {spec.minutes} minutes, scored at the end — exactly like one module on test day.
              </span>
            </span>
            <span className="cc-check"><CheckIcon width={18} height={18} /></span>
          </button>
        </div>
      </section>

      {/* 3 · Focus */}
      <section className="step">
        <StepTitle n={3} title="Focus" hint="Leave everything unselected to practise the whole section." action={m.anySelected || filters.difficulties.length || filters.onlyWrong || filters.hideAnswered || filters.onlyFlagged ? { label: 'Clear all', onClick: () => onChange({ ...filters, domains: [], skills: [], difficulties: [], hideAnswered: false, onlyWrong: false, onlyFlagged: false }) } : undefined} />

        <div className="chip-row" role="group" aria-label="Difficulty">
          <span className="chip-label">Difficulty</span>
          {(['E', 'M', 'H'] as Difficulty[]).map((d) => (
            <button
              key={d}
              className={`chip diff-${d} ${filters.difficulties.includes(d) ? 'on' : ''}`}
              aria-pressed={filters.difficulties.includes(d)}
              onClick={() => onChange({ ...filters, difficulties: toggleIn(filters.difficulties, d) })}
            >
              {DIFFICULTY_NAMES[d]}
            </button>
          ))}
        </div>

        <div className="chip-row" role="group" aria-label="Status">
          <span className="chip-label">Only</span>
          <button className={`chip ${filters.hideAnswered ? 'on' : ''}`} aria-pressed={filters.hideAnswered} onClick={() => onChange({ ...filters, hideAnswered: !filters.hideAnswered, onlyWrong: false })}>
            Unanswered
          </button>
          <button className={`chip ${filters.onlyWrong ? 'on' : ''}`} aria-pressed={filters.onlyWrong} onClick={() => onChange({ ...filters, onlyWrong: !filters.onlyWrong, hideAnswered: false })}>
            My mistakes
          </button>
          <button className={`chip ${filters.onlyFlagged ? 'on' : ''}`} aria-pressed={filters.onlyFlagged} onClick={() => onChange({ ...filters, onlyFlagged: !filters.onlyFlagged })}>
            Flagged
          </button>
        </div>

        {!questions ? (
          <p className="muted">Loading the question bank…</p>
        ) : (
          <div className="domain-grid">
            {m.domains.map(([code, name]) => {
              const on = filters.domains.includes(code)
              const partial = !on && m.skillsOf(code).some(([c]) => filters.skills.includes(c))
              return (
                <div key={code} className={`domain-card ${on ? 'on' : partial ? 'partial' : ''}`}>
                  <button className="dc-head" aria-pressed={on} onClick={() => m.toggleDomain(code)}>
                    <span className="dc-box" aria-hidden="true">{on && <CheckIcon width={16} height={16} />}{partial && <span className="dc-dash" />}</span>
                    <span className="dc-name">{name}</span>
                    <span className="dc-count">{(m.counts.get(code) ?? 0).toLocaleString()}</span>
                  </button>
                  <div className="dc-skills">
                    {m.skillsOf(code).map(([skill, s]) => (
                      <button
                        key={skill}
                        className={`chip small ${m.skillChecked(skill, code) ? 'on' : ''}`}
                        aria-pressed={m.skillChecked(skill, code)}
                        onClick={() => m.toggleSkill(skill, code)}
                      >
                        {s.name} <span className="chip-count">{m.counts.get(`skill:${skill}`) ?? 0}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 4 · Size */}
      <section className="step">
        <StepTitle n={4} title="How many questions" />
        {mode === 'timed' ? (
          <p className="muted">
            A timed module is always {spec.questions} questions in {spec.minutes} minutes, drawn from your focus above.
          </p>
        ) : (
          <div className="chip-row">
            {PRESETS.map((n) => (
              <button key={n} className={`chip ${count === n ? 'on' : ''}`} aria-pressed={count === n} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
            <label className="chip-input">
              Custom
              <input
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                aria-label="Custom number of questions"
              />
            </label>
          </div>
        )}
      </section>

      {/* Sticky summary */}
      <div className="summary-bar" role="region" aria-label="Session summary">
        <div className="sb-text">
          <div className="sb-main">
            {mode === 'timed' ? `Timed module · ${SECTION_NAMES[filters.section]}` : `${willGet} ${SECTION_NAMES[filters.section]} question${willGet === 1 ? '' : 's'}`}
          </div>
          <div className="sb-sub muted">
            {!questions
              ? 'Loading…'
              : poolCount === 0
                ? 'Nothing matches these choices — widen your focus.'
                : `${focusLabel} · ${poolCount.toLocaleString()} available${mode === 'practice' && poolCount < count ? ` (fewer than ${count})` : ''}`}
          </div>
        </div>
        <button className="primary large" onClick={onStart} disabled={!ready}>
          {mode === 'timed' ? 'Start module' : 'Start practising'}
        </button>
      </div>
    </div>
  )
}

function StepTitle({ n, title, hint, action }: { n: number; title: string; hint?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="step-title">
      <span className="step-num">{n}</span>
      <h2>{title}</h2>
      {hint && <span className="muted small step-hint">{hint}</span>}
      {action && (
        <button className="link small step-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
