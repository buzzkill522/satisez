import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Question } from '../lib/types'
import { latestByQuestion, useStore } from '../lib/store'
import { Runner, type Session } from '../pages/Practice'
import { PaywallModal } from './Paywall'
import { CheckIcon } from './Icons'

interface Daily {
  date: string
  questions: Question[]
}

/**
 * The free experience: today's five questions, the same five for every free visitor. They can be
 * retried as often as you like; the paywall appears when the fifth answer goes in.
 */
export function DailyFive() {
  const [daily, setDaily] = useState<Daily | null>(null)
  const [error, setError] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [wall, setWall] = useState(false)
  const [walled, setWalled] = useState(false)
  const { attempts } = useStore()

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/daily`, { cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as Daily & { error?: string }
        if (!res.ok) throw new Error(data.error || `Could not load today's questions (${res.status}).`)
        setDaily(data)
      })
      .catch((e) => setError(e.message))
  }, [])

  const onAnswered = useCallback(
    (count: number, total: number) => {
      if (count >= total && !walled) {
        setWalled(true)
        setWall(true)
      }
    },
    [walled],
  )

  if (error) return <div className="page"><p className="error">{error}</p></div>
  if (!daily) return <div className="page"><p className="muted">Loading today's questions…</p></div>

  if (session)
    return (
      <>
        <Runner session={session} onExit={() => setSession(null)} onAnswered={onAnswered} />
        {wall && (
          <PaywallModal onClose={() => setWall(false)}>
            <button className="btn-secondary" onClick={() => setWall(false)}>Review my answers</button>
          </PaywallModal>
        )}
      </>
    )

  const latest = latestByQuestion(attempts)
  const done = daily.questions.filter((q) => latest.has(q.id))
  const correct = done.filter((q) => latest.get(q.id)!.correct).length
  const rw = daily.questions.filter((q) => q.section === 'rw').length
  const math = daily.questions.length - rw
  const day = new Date(daily.date + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

  return (
    <div className="page daily-page">
      <div className="daily-card">
        <span className="pw-eyebrow">Free · {day}</span>
        <h1>Today's 5 questions</h1>
        <p className="lead">
          {rw} Reading and Writing, {math} Math. Everyone gets the same five today, and a new five arrives tomorrow.
          You can retry them as many times as you want.
        </p>
        <ol className="daily-list">
          {daily.questions.map((q, i) => {
            const a = latest.get(q.id)
            return (
              <li key={q.id} className={a ? (a.correct ? 'is-ok' : 'is-bad') : ''}>
                <span className="daily-num">{i + 1}</span>
                <span className="daily-skill">
                  <b>{q.skillName}</b>
                  <span className="muted small">{q.section === 'rw' ? 'Reading and Writing' : 'Math'} · {q.domainName}</span>
                </span>
                <span className="daily-state">{a ? (a.correct ? <><CheckIcon width={16} height={16} /> Correct</> : 'Incorrect') : 'Not yet'}</span>
              </li>
            )
          })}
        </ol>
        <div className="daily-actions">
          <button className="primary large" onClick={() => setSession({ mode: 'practice', questions: daily.questions })}>
            {done.length ? 'Retry today’s 5' : 'Start'}
          </button>
          {done.length > 0 && <span className="muted">{correct} of {done.length} correct so far</span>}
        </div>
      </div>

      <aside className="daily-upsell">
        <h2>Want more than five?</h2>
        <p className="muted">
          Premium opens all 3,700+ questions with filters by skill and difficulty, timed modules, the question bank browser
          and the full study guide.
        </p>
        <Link className="btn-primary" to="/upgrade">See Premium prices</Link>
      </aside>
    </div>
  )
}
