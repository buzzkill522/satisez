import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Filters, Question } from '../lib/types'
import { MODULE_SPEC, SECTION_NAMES } from '../lib/types'
import { loadSection, shuffle } from '../lib/data'
import { latestByQuestion, store, useStore } from '../lib/store'
import { DEFAULT_FILTERS, applyFilters } from '../components/FilterPanel'
import { PracticeSetup, type Mode } from '../components/PracticeSetup'
import { QuestionView } from '../components/QuestionView'
import { Timer, formatTime } from '../components/Timer'
import { DailyFive } from '../components/DailyFive'
import { usePremium } from '../lib/auth'

export default function Practice() {
  const { loading, premium } = usePremium()
  if (loading) return <div className="page"><p className="muted">One moment…</p></div>
  if (!premium) return <DailyFive />
  return <FullPractice />
}

/** The paid practice flow: choose filters and a mode from the whole bank. */
function FullPractice() {
  const [params] = useSearchParams()
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    section: params.get('section') === 'math' ? 'math' : 'rw',
    // e.g. /practice?section=rw&domain=CAS — used by links from the Guide
    domains: params.get('domain') ? [params.get('domain')!] : [],
  })
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'timed' ? 'timed' : 'practice')
  const [count, setCount] = useState(10)
  const [all, setAll] = useState<Question[] | null>(null)
  const [error, setError] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const { attempts, flagged } = useStore()

  useEffect(() => {
    setAll(null)
    loadSection(filters.section).then(setAll).catch((e) => setError(e.message))
  }, [filters.section])

  const latest = useMemo(() => latestByQuestion(attempts), [attempts])
  const pool = useMemo(
    () => (all ? applyFilters(all, filters, latest, flagged) : []),
    [all, filters, latest, flagged],
  )

  function start() {
    const spec = MODULE_SPEC[filters.section]
    const n = mode === 'timed' ? spec.questions : count
    const qs = shuffle(pool).slice(0, n)
    setSession({
      mode,
      questions: qs,
      limit: mode === 'timed' ? spec.minutes * 60 : undefined,
    })
  }

  if (error) return <div className="page"><p className="error">{error}</p></div>
  if (session)
    return <Runner session={session} onExit={() => setSession(null)} />

  return (
    <div className="page setup-page">
      <PracticeSetup
        questions={all}
        filters={filters}
        onChange={setFilters}
        mode={mode}
        setMode={setMode}
        count={count}
        setCount={setCount}
        poolCount={pool.length}
        onStart={start}
      />
    </div>
  )
}

export interface Session {
  mode: Mode
  questions: Question[]
  limit?: number
}

interface RunnerProps {
  session: Session
  onExit: () => void
  /** Called after each answer with how many distinct questions are answered so far. */
  onAnswered?: (answered: number, total: number) => void
}

export function Runner({ session, onExit, onAnswered }: RunnerProps) {
  const { questions, mode, limit } = session
  const [idx, setIdx] = useState(0)
  const [finished, setFinished] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [results, setResults] = useState<Record<string, { answer: string; correct: boolean; seconds: number }>>({})
  const qStart = useRef(Date.now())
  const { flagged } = useStore()
  const q = questions[idx]
  const section = questions[0]?.section ?? 'rw'

  useEffect(() => {
    qStart.current = Date.now()
  }, [idx])

  const onAnswer = useCallback(
    (answer: string, correct: boolean) => {
      const seconds = Math.round((Date.now() - qStart.current) / 1000)
      setResults((r) => {
        const next = { ...r, [q.id]: { answer, correct, seconds } }
        onAnswered?.(Object.keys(next).length, questions.length)
        return next
      })
      store.recordAttempt({ qid: q.id, answer, correct, seconds, at: Date.now() })
    },
    [q.id, onAnswered, questions.length],
  )

  const finish = useCallback(() => setFinished(true), [])
  const go = (i: number) => {
    setIdx(Math.max(0, Math.min(questions.length - 1, i)))
    setNavOpen(false)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(questions.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
      if (e.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [questions.length])

  const answered = Object.keys(results).length
  const correct = Object.values(results).filter((r) => r.correct).length
  const title = `${mode === 'timed' ? 'Module' : 'Practice'}: ${SECTION_NAMES[section]}`

  if (finished) {
    const totalSec = Object.values(results).reduce((s, r) => s + r.seconds, 0)
    return (
      <div className="page">
        <h1>Results</h1>
        <div className="stats-row">
          <Stat label="Score" value={`${correct} / ${questions.length}`} />
          <Stat label="Accuracy" value={`${questions.length ? Math.round((100 * correct) / questions.length) : 0}%`} />
          <Stat label="Avg time / Q" value={answered ? formatTime(totalSec / answered) : '—'} />
        </div>
        <div className="review-grid">
          {questions.map((qq, i) => {
            const r = results[qq.id]
            return (
              <button
                key={qq.id}
                className={`cell ${r ? (r.correct ? 'ok' : 'bad') : 'skipped'}`}
                onClick={() => {
                  setFinished(false)
                  setIdx(i)
                }}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
        <button className="primary" onClick={onExit}>New set</button>
      </div>
    )
  }

  const navCell = (qq: Question, i: number) => {
    const r = results[qq.id]
    const cls = [
      'bb-navcell',
      i === idx && 'current',
      r ? 'answered' : 'unanswered',
      r && mode === 'practice' && (r.correct ? 'is-ok' : 'is-bad'),
      flagged.includes(qq.id) && 'flagged',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <button key={qq.id} className={cls} onClick={() => go(i)} aria-current={i === idx ? 'true' : undefined}>
        {i + 1}
      </button>
    )
  }

  return (
    <div className="bb-screen">
      <header className="bb-top">
        <div className="bb-top-left">
          <div className="bb-section-title">{title}</div>
          <div className="bb-directions">Directions ▾</div>
        </div>
        <div className="bb-top-center">
          <Timer limitSeconds={limit} running={!finished} onExpire={finish} />
        </div>
        <div className="bb-top-right">
          {section === 'math' && (
            <a className="bb-tool" href="https://www.desmos.com/calculator" target="_blank" rel="noreferrer">
              <span className="bb-tool-icon">▦</span>Calculator
            </a>
          )}
          {section === 'math' && (
            <a
              className="bb-tool"
              href="https://satsuite.collegeboard.org/media/pdf/digital-sat-math-reference-sheet.pdf"
              target="_blank"
              rel="noreferrer"
            >
              <span className="bb-tool-icon">x²</span>Reference
            </a>
          )}
          <button className="bb-tool" onClick={onExit}>
            <span className="bb-tool-icon">⋮</span>Exit
          </button>
        </div>
      </header>
      <div className="bb-practice-rule"><span>THIS IS A PRACTICE TEST</span></div>

      <main className="bb-main">
        <QuestionView key={q.id} question={q} number={idx + 1} instantFeedback={mode === 'practice'} onAnswer={onAnswer} />
      </main>

      {navOpen && (
        <div className="bb-nav-popup" role="dialog" aria-label="Question navigator">
          <div className="bb-nav-head">
            <b>{title} Questions</b>
            <button className="bb-nav-close" onClick={() => setNavOpen(false)} aria-label="Close">×</button>
          </div>
          <div className="bb-nav-legend">
            <span><i className="legend-current" /> Current</span>
            <span><i className="legend-unanswered" /> Unanswered</span>
            <span><i className="legend-review" /> For Review</span>
            {mode === 'practice' && <span><i className="legend-ok" /> Correct</span>}
            {mode === 'practice' && <span><i className="legend-bad" /> Incorrect</span>}
          </div>
          <div className="bb-nav-grid">{questions.map(navCell)}</div>
          <button className="bb-outline" onClick={finish}>Go to Review Page</button>
        </div>
      )}

      <footer className="bb-bottom">
        <div className="bb-bottom-left">
          {mode === 'practice' ? `${correct}/${answered} correct` : 'SATisEZ'}
        </div>
        <button className={`bb-qnav-btn ${navOpen ? 'open' : ''}`} onClick={() => setNavOpen((o) => !o)}>
          Question {idx + 1} of {questions.length} <span className="caret">{navOpen ? '▼' : '▲'}</span>
        </button>
        <div className="bb-bottom-right">
          <button className="bb-btn" disabled={idx === 0} onClick={() => go(idx - 1)}>Back</button>
          {idx < questions.length - 1 ? (
            <button className="bb-btn" onClick={() => go(idx + 1)}>Next</button>
          ) : (
            <button className="bb-btn" onClick={finish}>Finish</button>
          )}
        </div>
      </footer>
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
