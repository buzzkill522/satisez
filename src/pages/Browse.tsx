import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Filters, Question } from '../lib/types'
import { DIFFICULTY_NAMES } from '../lib/types'
import { loadSection } from '../lib/data'
import { latestByQuestion, useStore } from '../lib/store'
import { DEFAULT_FILTERS, FilterPanel, applyFilters } from '../components/FilterPanel'
import { QuestionView } from '../components/QuestionView'
import { useCalculator } from '../components/Calculator'

const PAGE = 50

export default function Browse() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [all, setAll] = useState<Question[] | null>(null)
  const [error, setError] = useState('')
  const [params] = useSearchParams()
  // /browse?q=<id> opens that question straight away (used by the guide's sample links)
  const [open, setOpen] = useState<string | null>(params.get('q'))
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const { attempts, flagged } = useStore()
  const calc = useCalculator()

  useEffect(() => {
    setAll(null)
    loadSection(filters.section).then(setAll).catch((e) => setError(e.message))
  }, [filters.section])

  useEffect(() => setPage(0), [filters, search])

  const latest = useMemo(() => latestByQuestion(attempts), [attempts])
  const list = useMemo(() => {
    if (!all) return []
    let qs = applyFilters(all, filters, latest, flagged)
    const s = search.trim().toLowerCase()
    if (s) {
      const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').toLowerCase()
      qs = qs.filter((q) => q.id.toLowerCase().includes(s) || strip(q.stem + q.stimulus).includes(s))
    }
    return qs
  }, [all, filters, latest, flagged, search])

  if (error) return <div className="page"><p className="error">{error}</p></div>

  const openQ = open ? list.find((q) => q.id === open) ?? all?.find((q) => q.id === open) : null
  if (openQ) {
    const i = list.findIndex((q) => q.id === openQ.id)
    return (
      <div className="page">
        <div className="runner-bar">
          <button className="link" onClick={() => setOpen(null)}>← Back to list</button>
          <span className="muted">ID {openQ.id}</span>
          <span className="spacer" />
          {openQ.section === 'math' && (
            <button className={`link ${calc.open ? 'on' : ''}`} onClick={calc.toggle} aria-pressed={calc.open}>Calculator</button>
          )}
          <button className="link" disabled={i <= 0} onClick={() => setOpen(list[i - 1].id)}>Prev</button>
          <button className="link" disabled={i < 0 || i >= list.length - 1} onClick={() => setOpen(list[i + 1].id)}>Next</button>
        </div>
        <QuestionView key={openQ.id} question={openQ} number={i + 1} instantFeedback />
        {calc.panel}
      </div>
    )
  }

  const pageItems = list.slice(page * PAGE, (page + 1) * PAGE)
  const pages = Math.ceil(list.length / PAGE)

  return (
    <div className="page with-sidebar">
      {all && <FilterPanel questions={all} filters={filters} onChange={setFilters} />}
      <div className="main">
        <h1>Question bank</h1>
        <input
          className="search"
          placeholder="Search question text or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="muted">{all ? `${list.length.toLocaleString()} questions` : 'Loading…'}</p>
        <table className="qtable">
          <thead>
            <tr>
              <th>#</th>
              <th>Question</th>
              <th>Skill</th>
              <th>Difficulty</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((q, i) => {
              const a = latest.get(q.id)
              const preview = (q.stem || q.stimulus).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 110)
              return (
                <tr key={q.id} onClick={() => setOpen(q.id)}>
                  <td className="muted">{page * PAGE + i + 1}</td>
                  <td>
                    {flagged.includes(q.id) && '🚩 '}
                    {preview}…
                  </td>
                  <td className="muted">{q.skillName}</td>
                  <td><span className={`badge diff-${q.difficulty}`}>{DIFFICULTY_NAMES[q.difficulty]}</span></td>
                  <td>{a ? (a.correct ? <span className="ok">✓</span> : <span className="bad">✗</span>) : <span className="muted">—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {pages > 1 && (
          <div className="pager">
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button>
            <span>Page {page + 1} of {pages}</span>
            <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}
