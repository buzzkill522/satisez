import { useEffect, useMemo, useState } from 'react'
import type { Question } from '../lib/types'
import { DIFFICULTY_NAMES, SECTION_NAMES, domainRank, skillRank } from '../lib/types'
import { loadAll } from '../lib/data'
import { latestByQuestion, store, useStore } from '../lib/store'
import { formatTime } from '../components/Timer'
import { Stat } from './Practice'
import { usePremium } from '../lib/auth'
import { Link } from 'react-router-dom'

interface Bucket {
  name: string
  domain: string
  skill: string
  attempted: number
  correct: number
  total: number
}

export default function Stats() {
  const { attempts, flagged } = useStore()
  const [all, setAll] = useState<Question[]>([])
  const [error, setError] = useState('')
  const { loading, premium } = usePremium()

  // The per-skill breakdown needs the whole bank, which only Premium can load.
  useEffect(() => {
    if (loading || !premium) return
    loadAll().then(setAll).catch((e) => setError(e.message))
  }, [loading, premium])

  const byId = useMemo(() => new Map(all.map((q) => [q.id, q])), [all])
  const latest = useMemo(() => latestByQuestion(attempts), [attempts])

  const groups = useMemo(() => {
    const make = (key: (q: Question) => string, name: (q: Question) => string) => {
      const m = new Map<string, Bucket>()
      for (const q of all) {
        const k = key(q)
        const b = m.get(k) ?? { name: name(q), domain: q.domain, skill: q.skillName, attempted: 0, correct: 0, total: 0 }
        b.total++
        const a = latest.get(q.id)
        if (a) {
          b.attempted++
          if (a.correct) b.correct++
        }
        m.set(k, b)
      }
      return [...m.values()]
    }
    return {
      section: make((q) => q.section, (q) => SECTION_NAMES[q.section]),
      difficulty: make((q) => q.section + q.difficulty, (q) => `${SECTION_NAMES[q.section]} · ${DIFFICULTY_NAMES[q.difficulty]}`),
      skill: make((q) => q.skill, (q) => `${q.domainName} › ${q.skillName}`).sort(
        (a, b) => domainRank(a.domain) - domainRank(b.domain) || skillRank(a.skill) - skillRank(b.skill),
      ),
    }
  }, [all, latest])

  const totalCorrect = attempts.filter((a) => a.correct).length
  const avgSec = attempts.length ? attempts.reduce((s, a) => s + a.seconds, 0) / attempts.length : 0
  const weakest = [...groups.skill].filter((b) => b.attempted >= 3).sort((a, b) => a.correct / a.attempted - b.correct / b.attempted).slice(0, 5)

  // Streak: consecutive days with at least one attempt
  const days = new Set(attempts.map((a) => new Date(a.at).toDateString()))
  let streak = 0
  for (let d = new Date(); days.has(d.toDateString()); d.setDate(d.getDate() - 1)) streak++

  function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    f.text().then((t) => {
      try {
        store.import(t)
      } catch {
        alert('Invalid progress file')
      }
    })
  }

  return (
    <div className="page">
      <h1>Progress</h1>
      {error && <p className="error">{error}</p>}
      <div className="stats-row">
        <Stat label="Questions answered" value={latest.size.toLocaleString()} />
        <Stat label="Overall accuracy" value={attempts.length ? `${Math.round((100 * totalCorrect) / attempts.length)}%` : '—'} />
        <Stat label="Avg time / Q" value={attempts.length ? formatTime(avgSec) : '—'} />
        <Stat label="Day streak" value={String(streak)} />
        <Stat label="Flagged" value={String(flagged.length)} />
      </div>

      {weakest.length > 0 && (
        <>
          <h2>Weakest skills</h2>
          <p className="muted small">Skills with at least 3 attempts, lowest accuracy first. Use the Practice filters to drill them.</p>
          <BucketTable buckets={weakest} />
        </>
      )}

      {premium ? (
        <>
          <h2>By section</h2>
          <BucketTable buckets={groups.section} />
          <h2>By difficulty</h2>
          <BucketTable buckets={groups.difficulty} />
          <h2>By skill</h2>
          <BucketTable buckets={groups.skill} />
        </>
      ) : (
        <div className="notice">
          <b>Breakdown by skill and difficulty is part of Premium.</b>
          <p>With the full bank unlocked, this page shows your accuracy for every domain, skill and difficulty, and your weakest skills first. <Link to="/upgrade">See Premium</Link>.</p>
        </div>
      )}

      <h2>Recent</h2>
      <table className="qtable">
        <tbody>
          {[...attempts].reverse().slice(0, 30).map((a, i) => {
            const q = byId.get(a.qid)
            return (
              <tr key={i}>
                <td className={a.correct ? 'ok' : 'bad'}>{a.correct ? '✓' : '✗'}</td>
                <td className="muted">{q ? q.skillName : a.qid}</td>
                <td className="muted">{formatTime(a.seconds)}</td>
                <td className="muted">{new Date(a.at).toLocaleString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2>Data</h2>
      <div className="row">
        <button
          onClick={() => {
            const blob = new Blob([store.export()], { type: 'application/json' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `satisez-progress-${new Date().toISOString().slice(0, 10)}.json`
            a.click()
          }}
        >
          Export progress
        </button>
        <label className="button">
          Import progress
          <input type="file" accept="application/json" hidden onChange={importFile} />
        </label>
        <button
          className="danger"
          onClick={() => {
            if (confirm('Erase all progress, flags and notes?')) store.reset()
          }}
        >
          Reset everything
        </button>
      </div>
    </div>
  )
}

function BucketTable({ buckets }: { buckets: Bucket[] }) {
  return (
    <table className="qtable">
      <thead>
        <tr>
          <th>Group</th>
          <th>Done</th>
          <th>Accuracy</th>
          <th style={{ width: '40%' }}></th>
        </tr>
      </thead>
      <tbody>
        {buckets.map((b) => {
          const acc = b.attempted ? Math.round((100 * b.correct) / b.attempted) : null
          return (
            <tr key={b.name}>
              <td>{b.name}</td>
              <td className="muted">{b.attempted} / {b.total}</td>
              <td>{acc === null ? <span className="muted">—</span> : `${acc}%`}</td>
              <td>
                <div className="bar">
                  <div className="bar-fill" style={{ width: `${acc ?? 0}%` }} />
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
