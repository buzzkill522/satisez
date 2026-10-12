import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Question } from '../lib/types'
import { loadAll } from '../lib/data'
import { usePremium } from '../lib/auth'
import { FREE_PERKS, PREMIUM_PERKS } from '../components/Paywall'
import pricing from '../../server/pricing.json'
import { latestByQuestion, useStore } from '../lib/store'
import { MODULE_SPEC, domainRank } from '../lib/types'
import { HeroMock } from '../components/HeroMock'
import { TryOne } from '../components/TryOne'
import { ArrowRightIcon, BookIcon, CalcIcon, ChartIcon, ChatIcon, CheckIcon, ClockIcon, FlagIcon, MapIcon, ScreenIcon, SparkIcon } from '../components/Icons'

export default function Home() {
  const [all, setAll] = useState<Question[] | null>(null)
  const [counts, setCounts] = useState<{ rw: number; math: number } | null>(null)
  const [error, setError] = useState('')
  const { attempts } = useStore()
  const { loading, premium } = usePremium()
  const done = latestByQuestion(attempts).size

  // Totals come from the public index; the per-domain breakdown needs the bank itself (Premium).
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/index.json`, { cache: 'no-cache' })
      .then(async (res) => {
        if (!res.ok) throw new Error('No question data found.')
        const index = (await res.json()) as { counts?: { rw?: number; math?: number } }
        if (index.counts) setCounts({ rw: index.counts.rw ?? 0, math: index.counts.math ?? 0 })
      })
      .catch((e) => setError(e.message))
  }, [])
  useEffect(() => {
    if (loading || !premium) return
    loadAll().then(setAll).catch(() => {})
  }, [loading, premium])

  /** Questions per domain, in College Board order, for the bank breakdown. */
  const byDomain = useMemo(() => {
    if (!all) return []
    const m = new Map<string, { code: string; name: string; section: string; n: number }>()
    for (const q of all) {
      const d = m.get(q.domain) ?? { code: q.domain, name: q.domainName, section: q.section, n: 0 }
      d.n++
      m.set(q.domain, d)
    }
    return [...m.values()].sort((a, b) => domainRank(a.code) - domainRank(b.code))
  }, [all])
  const maxDomain = Math.max(1, ...byDomain.map((d) => d.n))

  return (
    <>
      {/* Amanat "stage" band: stays dark in both themes, so dark mode never meets a bright slab. */}
      <section className="hero hero-split">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="hero-eyebrow">5 free questions a day · no account needed</span>
            <h1>
              SAT practice that feels like <span className="gold-under">test day</span>.
            </h1>
            <p className="lead">
              {counts ? (counts.rw + counts.math).toLocaleString() : '3,700+'} questions from the College Board bank in a
              screen built like Bluebook — with instant explanations, real module timing and a tutor for the ones you miss.
              Five are free every day; Premium opens the rest and the study guide.
            </p>
            <div className="hero-actions">
              <Link className="btn-primary" to="/practice">{premium ? 'Start practising' : "Do today's 5 free questions"}</Link>
              <button className="btn-secondary" onClick={() => document.getElementById('try')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Try a question
              </button>
            </div>
            <ul className="hero-proof">
              <li><b>29</b> skills, filterable</li>
              <li><b>2</b> timed module formats</li>
              <li><b>5</b> free questions, every day</li>
            </ul>
          </div>
          <div className="hero-visual">
            <HeroMock />
          </div>
        </div>
      </section>

      <div className="page home">
        {error ? (
          <div className="error-box">
            <b>No question data found.</b>
            <p>Run <code>npm run fetch</code> once to download the question bank, then reload.</p>
          </div>
        ) : (
          <div className="stats-row">
            <div className="stat"><div className="stat-value">{counts ? counts.rw.toLocaleString() : '…'}</div><div className="stat-label">Reading &amp; Writing questions</div></div>
            <div className="stat"><div className="stat-value">{counts ? counts.math.toLocaleString() : '…'}</div><div className="stat-label">Math questions</div></div>
            <div className="stat"><div className="stat-value">{done.toLocaleString()}</div><div className="stat-label">You've answered</div></div>
          </div>
        )}

        <section className="home-section try-section" id="try">
          <h2>Try one now</h2>
          <p className="muted">A Words in Context question, the first type you meet on the real test. Pick an answer and check it.</p>
          <TryOne />
        </section>

        <h2>Jump in</h2>
        <div className="cards">
          <Link className="card" to="/practice?section=rw">
            <span className="card-kicker">Practice</span>
            <h3>Reading &amp; Writing</h3>
            <p>Pick domains, skills and difficulty. Instant feedback with full rationales.</p>
          </Link>
          <Link className="card" to="/practice?section=math">
            <span className="card-kicker">Practice</span>
            <h3>Math</h3>
            <p>Multiple choice and student-produced responses, checked automatically.</p>
          </Link>
          <Link className="card" to="/practice?section=rw&mode=timed">
            <span className="card-kicker">Timed</span>
            <h3>Reading &amp; Writing module</h3>
            <p>{MODULE_SPEC.rw.questions} questions in {MODULE_SPEC.rw.minutes} minutes, scored at the end — just like test day.</p>
          </Link>
          <Link className="card" to="/practice?section=math&mode=timed">
            <span className="card-kicker">Timed</span>
            <h3>Math module</h3>
            <p>{MODULE_SPEC.math.questions} questions in {MODULE_SPEC.math.minutes} minutes.</p>
          </Link>
          <Link className="card" to="/browse">
            <span className="card-kicker">Review</span>
            <h3>Browse the bank</h3>
            <p>Search and filter every question; review flagged ones and your mistakes.</p>
          </Link>
          <Link className="card" to="/stats">
            <span className="card-kicker">Review</span>
            <h3>Your progress</h3>
            <p>Accuracy by skill and difficulty, weakest areas, timing and streaks.</p>
          </Link>
        </div>

        {/* Free vs Premium */}
        {!premium && (
          <section className="home-section">
            <h2>Free, or everything</h2>
            <p className="muted">Try the site with today's five. When you're ready to cover every skill, Premium opens the whole bank and the guide.</p>
            <div className="compare">
              <div className="compare-col">
                <h3>Free</h3>
                <div className="compare-price">₹0 / $0</div>
                <ul>{FREE_PERKS.map((p) => <li key={p}><CheckIcon width={18} height={18} /> {p}</li>)}</ul>
                <Link className="btn-secondary" to="/practice">Do today's 5</Link>
              </div>
              <div className="compare-col premium">
                <h3>Premium</h3>
                <div className="compare-price"><s>₹{pricing.plans.monthly.INR.list}</s> ₹{pricing.plans.monthly.INR.price} a month · <s>${pricing.plans.monthly.USD.list}</s> ${pricing.plans.monthly.USD.price} a month</div>
                <ul>{PREMIUM_PERKS.map((p) => <li key={p}><CheckIcon width={18} height={18} /> {p}</li>)}</ul>
                <Link className="btn-primary" to="/upgrade">See plans and the launch offer</Link>
              </div>
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="home-section">
          <h2>How it works</h2>
          <ol className="how-steps">
            <li>
              <span className="how-num">1</span>
              <h3>Choose a focus</h3>
              <p>Pick a section, then narrow to the domains and skills you want — Words in Context, systems of equations, anything — and a difficulty.</p>
            </li>
            <li>
              <span className="how-num">2</span>
              <h3>Practise like it's the test</h3>
              <p>The question screen is laid out like Bluebook: same panes, mark-for-review, answer eliminator, and the clock with a Hide button.</p>
            </li>
            <li>
              <span className="how-num">3</span>
              <h3>Learn from every miss</h3>
              <p>See the official explanation right away, ask the tutor a specific doubt, leave yourself a note, and watch your weak spots shrink on the Progress page.</p>
            </li>
          </ol>
        </section>

        {/* Features */}
        <section className="home-section">
          <h2>What's inside</h2>
          <div className="feature-grid">
            <Feature icon={<ScreenIcon />} title="A Bluebook-style screen">
              Passage on the left, question on the right, the numbered header strip, and the same tools you'll have on test day.
            </Feature>
            <Feature icon={<ClockIcon />} title="Real module timing">
              {MODULE_SPEC.rw.questions} questions in {MODULE_SPEC.rw.minutes} minutes for Reading &amp; Writing, {MODULE_SPEC.math.questions} in {MODULE_SPEC.math.minutes} for Math. The clock turns red for the last five.
            </Feature>
            <Feature icon={<SparkIcon />} title="Instant feedback">
              Check an answer and get College Board's own rationale for the right choice — and why each wrong one is wrong.
            </Feature>
            <Feature icon={<ChatIcon />} title="Ask about any question">
              A built-in tutor that already knows the question, your answer and the explanation. Ask "why is B wrong?" and get a straight answer.
            </Feature>
            <Feature icon={<MapIcon />} title="A guide to every question type">
              How the test is built, the order questions come in, and how to attempt each of the question types.
            </Feature>
            <Feature icon={<ChartIcon />} title="Progress that points somewhere">
              Accuracy by skill and difficulty, your weakest areas, average time per question and a daily streak.
            </Feature>
            <Feature icon={<FlagIcon />} title="Flags and notes">
              Mark questions for review, keep a note on any of them, and come back to your mistakes with one filter.
            </Feature>
            <Feature icon={<CalcIcon />} title="Typed Math answers, checked">
              Student-produced responses accept fractions and decimals and are marked the way the test marks them.
            </Feature>
          </div>
        </section>

        {/* Progress preview */}
        <section className="home-section">
          <div className="split">
            <div>
              <h2>Know exactly what to fix</h2>
              <p className="muted">
                Every answer feeds a breakdown by domain, skill and difficulty. The Progress page surfaces your weakest
                skills first, so the next session writes itself.
              </p>
              <Link className="glance-link" to="/stats">See your progress <ArrowRightIcon width={18} height={18} /></Link>
            </div>
            <div className="preview-card" aria-label="Example of the weakest-skills report">
              <div className="preview-title">Weakest skills <span className="muted small">example</span></div>
              {[
                ['Cross-Text Connections', 42],
                ['Inferences', 55],
                ['Nonlinear functions', 61],
                ['Transitions', 68],
                ['Boundaries', 74],
              ].map(([name, pct]) => (
                <div className="preview-row" key={String(name)}>
                  <span>{name}</span>
                  <span className="bar"><span className="bar-fill" style={{ width: `${pct}%` }} /></span>
                  <b>{pct}%</b>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The test at a glance */}
        <section className="home-section">
          <h2>The Digital SAT at a glance</h2>
          <div className="glance">
            <div className="glance-card">
              <div className="glance-head"><BookIcon /> <h3>Reading and Writing</h3></div>
              <dl>
                <div><dt>Modules</dt><dd>2 × {MODULE_SPEC.rw.questions} questions</dd></div>
                <div><dt>Time</dt><dd>2 × {MODULE_SPEC.rw.minutes} minutes</dd></div>
                <div><dt>Format</dt><dd>One short passage, one question, four choices</dd></div>
                <div><dt>Domains</dt><dd>Craft and Structure · Information and Ideas · Standard English Conventions · Expression of Ideas</dd></div>
              </dl>
              <Link className="glance-link" to="/guide/rw">How the section is built <ArrowRightIcon width={18} height={18} /></Link>
            </div>
            <div className="glance-card">
              <div className="glance-head"><CalcIcon /> <h3>Math</h3></div>
              <dl>
                <div><dt>Modules</dt><dd>2 × {MODULE_SPEC.math.questions} questions</dd></div>
                <div><dt>Time</dt><dd>2 × {MODULE_SPEC.math.minutes} minutes</dd></div>
                <div><dt>Format</dt><dd>About three-quarters multiple choice, the rest typed answers; calculator allowed throughout</dd></div>
                <div><dt>Domains</dt><dd>Algebra · Advanced Math · Problem-Solving and Data Analysis · Geometry and Trigonometry</dd></div>
              </dl>
              <span className="glance-link muted">Math guide coming next</span>
            </div>
          </div>
          <p className="muted small">
            Both sections are adaptive by module: how you do in Module 1 decides whether Module 2 is the harder or easier version.
          </p>
        </section>

        {/* The bank */}
        {byDomain.length > 0 && (
          <section className="home-section">
            <h2>What's in the bank</h2>
            <p className="muted">Every released question, grouped by domain. Practise any row with one tap.</p>
            <ul className="bank-bars">
              {byDomain.map((d) => (
                <li key={d.code}>
                  <Link to={`/practice?section=${d.section}&domain=${d.code}`} className="bank-row">
                    <span className="bank-name">
                      <span className={`bank-sec ${d.section}`}>{d.section === 'rw' ? 'R&W' : 'Math'}</span>
                      {d.name}
                    </span>
                    <span className="bank-bar"><span style={{ width: `${(100 * d.n) / maxDomain}%` }} /></span>
                    <span className="bank-n">{d.n.toLocaleString()}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Closing band + footer */}
      <section className="cta-band">
        <div className="hero-inner">
          <h2>Ready when you are.</h2>
          <p>{premium ? 'Ten questions takes about ten minutes. Start with your weakest skill.' : "Today's five take about five minutes. New ones tomorrow."}</p>
          <Link className="btn-primary" to="/practice">{premium ? 'Start practising' : "Do today's 5"}</Link>
        </div>
      </section>
      <footer className="site-footer">
        <div className="hero-inner">
          <p>
            SAT® is a trademark registered by the College Board, which is not affiliated with, and does not endorse, this
            site. Questions and explanations are College Board's and are shown here for personal study.
          </p>
        </div>
      </footer>
    </>
  )
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="feature">
      <span className="feature-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}
