import { useEffect, useState } from 'react'
import type { Question } from '../lib/types'
import { DIFFICULTY_NAMES } from '../lib/types'
import { checkSpr } from '../lib/data'
import { store, useStore } from '../lib/store'

interface Props {
  question: Question
  /** Show correctness + rationale as soon as an answer is submitted. */
  instantFeedback: boolean
  /** Externally force the answer to be revealed (e.g. after a timed set ends). */
  revealed?: boolean
  onAnswer?: (answer: string, correct: boolean) => void
  /** Reset internal state when this changes. */
  resetKey?: unknown
}

export function QuestionView({ question: q, instantFeedback, revealed, onAnswer, resetKey }: Props) {
  const [selected, setSelected] = useState<string>('')
  const [sprInput, setSprInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [eliminator, setEliminator] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const { flagged, notes } = useStore()

  useEffect(() => {
    setSelected('')
    setSprInput('')
    setSubmitted(false)
    setEliminated(new Set())
    setShowNote(false)
  }, [resetKey, q.id])

  const answer = q.type === 'spr' ? sprInput : selected
  const isCorrect =
    q.type === 'spr' ? checkSpr(sprInput, q.answers) : q.answers.includes(selected)
  const showResult = revealed || (submitted && instantFeedback)

  function submit() {
    if (!answer.trim() || submitted) return
    setSubmitted(true)
    onAnswer?.(answer, isCorrect)
  }

  // Keyboard: A-D select, Enter submit
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        if (e.key === 'Enter') submit()
        return
      }
      const k = e.key.toUpperCase()
      if (q.type === 'mcq' && 'ABCD'.includes(k) && k.length === 1 && !submitted) {
        setSelected(k)
      } else if (e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const isFlagged = flagged.includes(q.id)

  return (
    <div className="question">
      <div className="q-meta">
        <span className={`badge diff-${q.difficulty}`}>{DIFFICULTY_NAMES[q.difficulty]}</span>
        <span className="badge">{q.domainName}</span>
        <span className="badge subtle">{q.skillName}</span>
        <span className="spacer" />
        {q.type === 'mcq' && (
          <button
            className={`icon-btn ${eliminator ? 'active' : ''}`}
            title="Answer eliminator (strike through choices)"
            onClick={() => setEliminator((v) => !v)}
          >
            A̶B̶C̶
          </button>
        )}
        <button className="icon-btn" title="Note" onClick={() => setShowNote((v) => !v)}>
          {notes[q.id] ? '📝' : '🗒'}
        </button>
        <button
          className={`icon-btn ${isFlagged ? 'active' : ''}`}
          title="Mark for review"
          onClick={() => store.toggleFlag(q.id)}
        >
          {isFlagged ? '🚩' : '⚑'}
        </button>
      </div>

      {showNote && (
        <textarea
          className="note"
          placeholder="Your notes on this question…"
          defaultValue={notes[q.id] ?? ''}
          onBlur={(e) => store.setNote(q.id, e.target.value)}
        />
      )}

      {/* R&W passages sit beside the question (like Bluebook); math tables/figures sit above it. */}
      <div className={`q-body ${q.stimulus ? (q.section === 'rw' ? 'two-col' : 'stacked') : ''}`}>
        {q.stimulus && <div className="stimulus html" dangerouslySetInnerHTML={{ __html: q.stimulus }} />}
        <div className="prompt">
          <div className="stem html" dangerouslySetInnerHTML={{ __html: q.stem }} />

          {q.type === 'mcq' ? (
            <div className="choices">
              {q.choices.map((c) => {
                const isSel = selected === c.key
                const isAns = q.answers.includes(c.key)
                const cls = [
                  'choice',
                  isSel && 'selected',
                  eliminated.has(c.key) && 'eliminated',
                  showResult && isAns && 'correct',
                  showResult && isSel && !isAns && 'wrong',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <div key={c.key} className={cls}>
                    <button
                      className="choice-main"
                      disabled={submitted || revealed}
                      onClick={() => setSelected(c.key)}
                    >
                      <span className="choice-key">{c.key}</span>
                      <span className="html" dangerouslySetInnerHTML={{ __html: c.content }} />
                    </button>
                    {eliminator && !showResult && (
                      <button
                        className="elim-btn"
                        title="Eliminate"
                        onClick={() =>
                          setEliminated((s) => {
                            const n = new Set(s)
                            n.has(c.key) ? n.delete(c.key) : n.add(c.key)
                            return n
                          })
                        }
                      >
                        {eliminated.has(c.key) ? 'Undo' : 'Ⓧ'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="spr">
              <input
                type="text"
                value={sprInput}
                disabled={submitted || revealed}
                onChange={(e) => setSprInput(e.target.value)}
                placeholder="Enter your answer (e.g. 3/4 or 0.75)"
                className={showResult ? (isCorrect ? 'correct' : 'wrong') : ''}
              />
              {showResult && (
                <div className="spr-answer">
                  Correct answer{q.answers.length > 1 ? 's' : ''}: <b>{q.answers.join(', ')}</b>
                </div>
              )}
            </div>
          )}

          {!submitted && !revealed && (
            <button className="primary" onClick={submit} disabled={!answer.trim()}>
              {instantFeedback ? 'Check answer' : 'Submit'}
            </button>
          )}

          {submitted && !showResult && <div className="submitted-note">Answer recorded.</div>}

          {showResult && (
            <div className={`feedback ${isCorrect ? 'ok' : 'bad'}`}>
              <div className="feedback-title">
                {!answer.trim() ? 'Not answered' : isCorrect ? '✓ Correct' : '✗ Incorrect'}
                {q.type === 'mcq' && !isCorrect && ` — correct answer is ${q.answers.join('/')}`}
              </div>
              <div className="rationale html" dangerouslySetInnerHTML={{ __html: q.rationale }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
