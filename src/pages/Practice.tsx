import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Filters, Question } from '../lib/types'
import { MODULE_SPEC, SECTION_NAMES } from '../lib/types'
import { loadSection, shuffle } from '../lib/data'
import { latestByQuestion, store, useStore } from '../lib/store'
import { DEFAULT_FILTERS, FilterPanel, applyFilters } from '../components/FilterPanel'
import { QuestionView } from '../components/QuestionView'
import { Timer, formatTime } from '../components/Timer'

type Mode = 'practice' | 'timed'

export default function Practice() {
  const [params] = useSearchParams()
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    section: params.get('section') === 'math' ? 'math' : 'rw',
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
    <div className="page with-sidebar">
      {all && <FilterPanel questions={all} filters={filters} onChange={setFilters} />}
      <div className="main">
        <h1>Practice</h1>
        <div className="seg big">
          <button className={mode === 'practice' ? 'active' : ''} onClick={() => setMode('practice')}>
            Practice <small>instant feedback, stopwatch</small>
          </button>
          <button className={mode === 'timed' ? 'active' : ''} onClick={() => setMode('timed')}>
            Timed module <small>{SECTION_NAMES[filters.section]}: {MODULE_SPEC[filters.section].questions} Qs / {MODULE_SPEC[filters.section].minutes} min</small>
          </button>
        </div>
        {mode === 'practice' && (
          <label className="row">
            Questions:
            <input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        )}
        <p className="muted">
          {all ? `${pool.length.toLocaleString()} questions match your filters` : 'Loading question bank…'}
        </p>
        <button className="primary large" onClick={start} disabled={!pool.length}>
          Start
        </button>
        <p className="muted small">
          Shortcuts: <kbd>A</kbd>–<kbd>D</kbd> select · <kbd>Enter</kbd> submit · <kbd>←</kbd>/<kbd>→</kbd> navigate
        </p>
      </div>
    </div>
  )
}

interface Session {
  mode: Mode
  questions: Question[]
  limit?: number
}

function Runner({ session, onExit }: { session: Session; onExit: () => void }) {
  const { questions, mode, limit } = session
  const [idx, setIdx] = useState(0)
  const [finished, setFinished] = useState(false)
  const [results, setResults] = useState<Record<string, { answer: string; correct: boolean; seconds: number }>>({})
  const qStart = useRef(Date.now())
  const { flagged } = useStore()
  const q = questions[idx]

  useEffect(() => {
    qStart.current = Date.now()
  }, [idx])

  const onAnswer = useCallback(
    (answer: string, correct: boolean) => {
      const seconds = Math.round((Date.now() - qStart.current) / 1000)
      setResults((r) => ({ ...r, [q.id]: { answer, correct, seconds } }))
      store.recordAttempt({ qid: q.id, answer, correct, seconds, at: Date.now() })
    },
    [q.id],
  )

  const finish = useCallback(() => setFinished(true), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(questions.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [questions.length])

  const answered = Object.keys(results).length
  const correct = Object.values(results).filter((r) => r.correct).length

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

  return (
    <div className="page runner">
      <div className="runner-bar">
        <button className="link" onClick={onExit}>← Exit</button>
        <span>
          {idx + 1} / {questions.length}
          {mode === 'practice' && <span className="muted"> · {correct}/{answered} correct</span>}
        </span>
        <span className="spacer" />
        <Timer limitSeconds={limit} running={!finished} onExpire={finish} />
        {q.section === 'math' && (
          <a className="link" href="https://www.desmos.com/calculator" target="_blank" rel="noreferrer">
            Calculator ↗
          </a>
        )}
        <button className="link" onClick={finish}>Finish</button>
      </div>

      <div className="nav-strip">
        {questions.map((qq, i) => {
          const r = results[qq.id]
          const cls = [
            'cell',
            i === idx && 'current',
            r && (mode === 'practice' ? (r.correct ? 'ok' : 'bad') : 'done'),
            flagged.includes(qq.id) && 'flag',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button key={qq.id} className={cls} onClick={() => setIdx(i)}>
              {i + 1}
            </button>
          )
        })}
      </div>

      <QuestionView
        key={q.id}
        question={q}
        instantFeedback={mode === 'practice'}
        onAnswer={onAnswer}
      />

      <div className="runner-nav">
        <button disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Back</button>
        {idx < questions.length - 1 ? (
          <button className="primary" onClick={() => setIdx(idx + 1)}>Next →</button>
        ) : (
          <button className="primary" onClick={finish}>Finish</button>
        )}
      </div>
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
