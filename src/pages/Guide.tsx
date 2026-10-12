import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RW_DOMAINS, RW_FACTS, RW_SKILLS, type GuideDomain, type GuideSkill } from '../guide/rw'
import { useAuth } from '../lib/auth'
import { loadSection } from '../lib/data'
import { store } from '../lib/store'
import { QuestionView } from '../components/QuestionView'
import type { Difficulty, Question } from '../lib/types'

const domainClass = (code: string) => `dom-${code.toLowerCase()}`

/** /guide — section picker. */
export function GuideIndex() {
  return (
    <div className="page guide">
      <h1>Study guide</h1>
      <p className="lead">How each part of the SAT is built, and how to attempt every question type.</p>
      <div className="cards">
        <Link className="card" to="/guide/rw">
          <h3>Reading and Writing</h3>
          <p>2 modules · 54 questions · 64 minutes. The order questions come in, and a page for each of the 11 question types.</p>
        </Link>
        <div className="card disabled" aria-disabled="true">
          <h3>Math</h3>
          <p>Coming next.</p>
        </div>
      </div>
    </div>
  )
}

/** /guide/rw — how the Reading and Writing section comes on test day. */
export function GuideRW() {
  const f = RW_FACTS
  return (
    <div className="page guide">
      <Crumbs items={[['Guide', '/guide'], ['Reading and Writing']]} />
      <h1>How Reading and Writing comes on the SAT</h1>

      <div className="stats-row">
        <Tile value={`${f.modules}`} label="modules" />
        <Tile value={`${f.questionsPerModule}`} label="questions each" />
        <Tile value={`${f.minutesPerModule} min`} label="per module" />
        <Tile value={`~${f.secondsPerQuestion}s`} label="per question" />
        <Tile value="4" label="choices, all multiple choice" />
      </div>

      <h2>The two modules</h2>
      <div className="module-flow">
        <div className="mf-box">
          <div className="mf-title">Module 1</div>
          <div className="mf-sub">{f.questionsPerModule} questions · {f.minutesPerModule} min</div>
          <div className="mf-sub">Mix of easy, medium and hard</div>
        </div>
        <div className="mf-arrow" aria-hidden="true">→</div>
        <div className="mf-branch">
          <div className="mf-box harder">
            <div className="mf-title">Module 2 — harder</div>
            <div className="mf-sub">if you did well in Module 1</div>
          </div>
          <div className="mf-box easier">
            <div className="mf-title">Module 2 — easier</div>
            <div className="mf-sub">otherwise</div>
          </div>
        </div>
      </div>
      <ul className="guide-facts">
        <li>The test is <b>adaptive by module</b>: your Module 1 results decide which version of Module 2 you get.</li>
        <li>Within a module you can move back and forth freely. Once Module 1 ends, you can't return to it.</li>
        <li>Each module includes {f.pretestPerModule} unscored trial questions. You can't tell which ones, so treat every question as real.</li>
        <li>Every question is <b>one short passage ({f.passageWords} words) and one question</b>. Some passages are a pair of texts, a poem, or come with a table or graph.</li>
      </ul>

      <h2>The order questions come in</h2>
      <p className="muted">
        Each module follows the same order: four groups, one per domain. Within a group, questions that test the
        same skill sit together and usually run from easier to harder. Both modules use this layout.
      </p>

      <ModuleStrip />

      <ol className="module-map">
        {RW_DOMAINS.map((d, i) => (
          <li key={d.code} className={domainClass(d.code)}>
            <div className="mm-head">
              <span className="mm-num">{i + 1}</span>
              <div className="mm-title">
                <h3>{d.name}</h3>
                <div className="muted small">
                  ~{d.perModule} questions per module · {d.perTest} per test · ~{d.share}% of the section
                </div>
              </div>
              <Link className="mm-practice" to={`/practice?section=rw&domain=${d.code}`}>Practice</Link>
            </div>
            <p className="mm-blurb">{d.blurb}</p>
            <div className="mm-skills">
              {d.skills.map((s) => (
                <Link key={s.slug} className="skill-chip" to={`/guide/rw/${s.slug}`}>
                  <span>{s.name}</span>
                  <span className="chip-arrow" aria-hidden="true">›</span>
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <p className="muted small">
        Question counts are College Board's published ranges for a full test; exact counts vary from test to test.
      </p>
    </div>
  )
}

/** A proportional bar showing the four groups in order across one module. */
function ModuleStrip() {
  const total = RW_DOMAINS.reduce((n, d) => n + d.perModule, 0)
  let start = 1
  return (
    <div className="module-strip" role="img" aria-label="Order of question groups in a module">
      {RW_DOMAINS.map((d) => {
        const from = start
        start += d.perModule
        return (
          <div key={d.code} className={`ms-seg ${domainClass(d.code)}`} style={{ flexGrow: d.perModule / total }}>
            <span className="ms-name">{d.name}</span>
            <span className="ms-range">Q{from}–{start - 1}</span>
          </div>
        )
      })}
    </div>
  )
}

/** /guide/rw/:slug — one question type. */
export function GuideSkillPage() {
  const { slug } = useParams()
  const { user } = useAuth()
  const isAdmin = Boolean(user?.admin)
  const i = RW_SKILLS.findIndex((s) => s.slug === slug)
  if (i === -1)
    return (
      <div className="page guide">
        <p>That guide page doesn't exist. <Link to="/guide/rw">Back to Reading and Writing</Link></p>
      </div>
    )
  const s = RW_SKILLS[i]
  const d = s.domain
  const prev = RW_SKILLS[i - 1]
  const next = RW_SKILLS[i + 1]
  const groupIndex = RW_DOMAINS.indexOf(d)

  return (
    <div className="page guide skill-page">
      <Crumbs items={[['Guide', '/guide'], ['Reading and Writing', '/guide/rw'], [s.name]]} />
      <span className={`dom-tag ${domainClass(d.code)}`}>{d.name}</span>
      <h1>{s.name}</h1>
      <p className="lead">{s.asks}</p>

      <SampleQuestion
        skill={s}
        which="before"
        difficulty="H"
        title="Warm-up: try a hard one first"
        blurb="Attempt it cold, before reading the strategy, so you can see what the steps fix. It's a real question from the bank."
      />

      <section className="g-section">
        <h2>Where it appears</h2>
        <p>
          Group {groupIndex + 1} of 4 in every module{groupPosition(groupIndex)}.
          {d.code === 'SEC' && ' Boundaries and Form, Structure, and Sense questions are mixed together within this group.'}
        </p>
        <MiniStrip active={d} />
      </section>

      <section className="g-section">
        <h2>How the question is worded</h2>
        <ul className="stem-list">
          {s.stems.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <ContentSection title="How to approach it" filled={s.approach.length > 0} isAdmin={isAdmin}>
        <ol className="g-steps">
          {s.approach.map((step, k) => (
            <li key={k}>{step}</li>
          ))}
        </ol>
      </ContentSection>

      <ContentSection title="Common traps" filled={s.traps.length > 0} isAdmin={isAdmin}>
        <ul className="g-traps">
          {s.traps.map((t, k) => (
            <li key={k}>{t}</li>
          ))}
        </ul>
      </ContentSection>

      <ContentSection title="Worked example" filled={Boolean(s.example.trim())} isAdmin={isAdmin}>
        <div className="g-example">
          {s.example.split(/\n\s*\n/).map((para, k) => (
            <p key={k}>{para}</p>
          ))}
        </div>
      </ContentSection>

      <ContentSection title="Time target" filled={Boolean(s.timeTarget.trim())} isAdmin={isAdmin}>
        <p className="g-time">{s.timeTarget}</p>
      </ContentSection>

      <SampleQuestion
        skill={s}
        which="after"
        difficulty="M"
        title="Now apply it: a medium one"
        blurb="Run the steps in order — clues, tone, subject, predict, eliminate — before you look at the choices."
      />

      <div className="g-actions">
        <Link className="primary-link" to={`/practice?section=rw&domain=${d.code}`}>
          Practice {d.name} questions
        </Link>
      </div>

      <nav className="g-pager">
        {prev ? <Link to={`/guide/rw/${prev.slug}`}>‹ {prev.name}</Link> : <span />}
        {next ? <Link to={`/guide/rw/${next.slug}`}>{next.name} ›</Link> : <Link to="/guide/rw">Back to overview ›</Link>}
      </nav>
    </div>
  )
}

const groupPosition = (i: number) =>
  [', right at the start', ', after Craft and Structure', ', after Information and Ideas', ', at the end'][i] ?? ''

function MiniStrip({ active }: { active: GuideDomain }) {
  return (
    <div className="module-strip mini" aria-hidden="true">
      {RW_DOMAINS.map((d) => (
        <div key={d.code} className={`ms-seg ${domainClass(d.code)} ${d === active ? 'on' : 'off'}`} style={{ flexGrow: d.perModule }}>
          <span className="ms-name">{d.name}</span>
        </div>
      ))}
    </div>
  )
}

/** A strategy section: shown when written; admins see an empty slot otherwise. */
function ContentSection({ title, filled, isAdmin, children }: { title: string; filled: boolean; isAdmin: boolean; children: ReactNode }) {
  if (!filled && !isAdmin) return null
  return (
    <section className={`g-section ${filled ? '' : 'g-empty'}`}>
      <h2>{title}</h2>
      {filled ? children : <p className="muted">Not written yet — we'll write this together. (Only admins see this.)</p>}
    </section>
  )
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map(([label, to], k) => (
        <span key={label}>
          {k > 0 && <span className="crumb-sep">/</span>}
          {to ? <Link to={to}>{label}</Link> : <span>{label}</span>}
        </span>
      ))}
    </nav>
  )
}

/**
 * A real question from the bank embedded in a guide page. Uses the skill's configured ID when
 * set, otherwise the first question of the wanted difficulty for this skill (stable: the bank is
 * sorted by ID). Only renders once the strategy content exists, so unfinished pages stay clean.
 */
function SampleQuestion({ skill, which, difficulty, title, blurb }: { skill: GuideSkill; which: 'before' | 'after'; difficulty: Difficulty; title: string; blurb: string }) {
  const [q, setQ] = useState<Question | null | undefined>(undefined)
  const wantedId = skill.samples?.[which]
  const hasContent = skill.approach.length > 0

  useEffect(() => {
    if (!hasContent) return
    let alive = true
    loadSection('rw')
      .then((all) => {
        const pick =
          (wantedId && all.find((x) => x.id === wantedId)) ||
          all.filter((x) => x.skillName === skill.name && x.difficulty === difficulty).sort((a, b) => a.id.localeCompare(b.id))[0] ||
          null
        if (alive) setQ(pick)
      })
      .catch(() => alive && setQ(null))
    return () => {
      alive = false
    }
  }, [hasContent, wantedId, skill.name, difficulty])

  if (!hasContent || q === null) return null
  return (
    <section className={`g-section g-sample ${which}`}>
      <div className="g-sample-head">
        <h2>{title}</h2>
        {q && (
          <Link className="g-sample-id" to={`/browse?q=${q.id}`} title="Open this question in Browse">
            ID {q.id}
          </Link>
        )}
      </div>
      <p className="muted">{blurb}</p>
      {q === undefined ? (
        <p className="muted small">Loading the question…</p>
      ) : (
        <div className="g-sample-q">
          <QuestionView
            question={q}
            number={which === 'before' ? 1 : 2}
            instantFeedback
            onAnswer={(answer, correct) => store.recordAttempt({ qid: q.id, answer, correct, seconds: 0, at: Date.now() })}
          />
        </div>
      )}
    </section>
  )
}
