import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadAll } from '../lib/data'
import { latestByQuestion, useStore } from '../lib/store'
import { MODULE_SPEC } from '../lib/types'
import { useAuth } from '../lib/auth'
import { AccessNotice } from '../components/AuthGate'

export default function Home() {
  const [counts, setCounts] = useState<{ rw: number; math: number } | null>(null)
  const [error, setError] = useState('')
  const { attempts } = useStore()
  const done = latestByQuestion(attempts).size

  const { user } = useAuth()
  const canLoad = Boolean(user?.access)

  useEffect(() => {
    if (!canLoad) return
    loadAll()
      .then((qs) => setCounts({ rw: qs.filter((q) => q.section === 'rw').length, math: qs.filter((q) => q.section === 'math').length }))
      .catch((e) => setError(e.message))
  }, [canLoad])

  return (
    <div className="page home">
      <h1>SATisEZ</h1>
      <p className="lead">Every question from the College Board SAT question bank, with timers, instant feedback and progress tracking.</p>

      {!canLoad ? (
        <AccessNotice />
      ) : error ? (
        <div className="error-box">
          <b>No question data found.</b>
          <p>Run <code>npm run fetch</code> once to download the question bank, then reload.</p>
        </div>
      ) : (
        <div className="stats-row">
          <div className="stat"><div className="stat-value">{counts ? counts.rw.toLocaleString() : '…'}</div><div className="stat-label">Reading &amp; Writing</div></div>
          <div className="stat"><div className="stat-value">{counts ? counts.math.toLocaleString() : '…'}</div><div className="stat-label">Math</div></div>
          <div className="stat"><div className="stat-value">{done.toLocaleString()}</div><div className="stat-label">Answered</div></div>
        </div>
      )}

      <div className="cards">
        <Link className="card" to="/practice?section=rw">
          <h3>Practice Reading &amp; Writing</h3>
          <p>Pick domains, skills and difficulty. Instant feedback with full rationales.</p>
        </Link>
        <Link className="card" to="/practice?section=math">
          <h3>Practice Math</h3>
          <p>Multiple choice and student-produced responses, checked automatically.</p>
        </Link>
        <Link className="card" to="/practice?section=rw&mode=timed">
          <h3>Timed R&amp;W module</h3>
          <p>{MODULE_SPEC.rw.questions} questions in {MODULE_SPEC.rw.minutes} minutes, scored at the end — just like test day.</p>
        </Link>
        <Link className="card" to="/practice?section=math&mode=timed">
          <h3>Timed Math module</h3>
          <p>{MODULE_SPEC.math.questions} questions in {MODULE_SPEC.math.minutes} minutes.</p>
        </Link>
        <Link className="card" to="/browse">
          <h3>Browse the bank</h3>
          <p>Search and filter every question; review flagged ones and your mistakes.</p>
        </Link>
        <Link className="card" to="/stats">
          <h3>Progress</h3>
          <p>Accuracy by skill and difficulty, weakest areas, timing and streaks.</p>
        </Link>
      </div>
    </div>
  )
}
