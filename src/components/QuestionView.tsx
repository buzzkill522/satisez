import { useEffect, useState } from 'react'
import type { Question } from '../lib/types'
import { DIFFICULTY_NAMES } from '../lib/types'
import { checkSpr } from '../lib/data'
import { store, useStore } from '../lib/store'
import { TutorChat } from './TutorChat'

interface Props {
  question: Question
  /** 1-based question number shown in the black box. */
  number: number
  /** Show correctness + rationale as soon as an answer is submitted. */
  instantFeedback: boolean
  /** Externally force the answer to be revealed (e.g. after a timed set ends). */
  revealed?: boolean
  onAnswer?: (answer: string, correct: boolean) => void
  /** Reset internal state when this changes. */
  resetKey?: unknown
}

const FlagIcon = ({ filled }: { filled: boolean }) => (
  <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
    <path
      d="M1.5 1v14M1.5 1.5h10l-2.5 3.5 2.5 3.5h-10"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
)

/**
 * A question laid out like Bluebook: passage pane on the left (R&W), question pane with the
 * numbered header strip, "Mark for Review", the ABC answer eliminator, and bordered answer
 * cards with lettered circles. Practice-mode feedback is added below the choices.
 */
export function QuestionView({ question: q, number, instantFeedback, revealed, onAnswer, resetKey }: Props) {
  const [selected, setSelected] = useState<string>('')
  const [sprInput, setSprInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [eliminator, setEliminator] = useState(false)
  // Wrong answers keep the explanation behind a button, so students think first.
  const [whyOpen, setWhyOpen] = useState(false)
  const { flagged, notes } = useStore()

  useEffect(() => {
    setSelected('')
    setSprInput('')
    setSubmitted(false)
    setEliminated(new Set())
    setWhyOpen(false)
  }, [resetKey, q.id])

  const answer = q.type === 'spr' ? sprInput : selected
  const isCorrect = q.type === 'spr' ? checkSpr(sprInput, q.answers) : q.answers.includes(selected)
  const showResult = revealed || (submitted && instantFeedback)
  const locked = submitted || revealed

  function submit() {
    if (!answer.trim() || submitted) return
    setSubmitted(true)
    onAnswer?.(answer, isCorrect)
  }

  // Keyboard: A-D select, Enter submit
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Enter') submit()
        return
      }
      const k = e.key.toUpperCase()
      if (q.type === 'mcq' && k.length === 1 && 'ABCD'.includes(k) && !locked) setSelected(k)
      else if (e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const isFlagged = flagged.includes(q.id)

  const header = (
    <div className="bb-qhead">
      <span className="bb-qnum">{number}</span>
      <button className={`bb-mark ${isFlagged ? 'on' : ''}`} onClick={() => store.toggleFlag(q.id)}>
        <FlagIcon filled={isFlagged} />
        Mark for Review
      </button>
      {q.type === 'mcq' && (
        <button
          className={`bb-abc ${eliminator ? 'on' : ''}`}
          title="Answer eliminator"
          aria-pressed={eliminator}
          onClick={() => setEliminator((v) => !v)}
        >
          <span>ABC</span>
        </button>
      )}
    </div>
  )

  const choices = (
    <div className="bb-choices">
      {q.choices.map((c) => {
        const isSel = selected === c.key
        const isAns = q.answers.includes(c.key)
        const isElim = eliminated.has(c.key)
        const cls = [
          'bb-choice',
          isSel && 'selected',
          isElim && 'eliminated',
          showResult && isAns && 'correct',
          showResult && isSel && !isAns && 'wrong',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <div key={c.key} className={cls}>
            <button className="bb-choice-main" disabled={locked} onClick={() => setSelected(c.key)}>
              <span className="bb-letter">{c.key}</span>
              <span className="bb-choice-text html" dangerouslySetInnerHTML={{ __html: c.content }} />
            </button>
            {eliminator && !showResult && (
              <button
                className={`bb-elim ${isElim ? 'undo' : ''}`}
                aria-label={isElim ? `Undo eliminating ${c.key}` : `Eliminate ${c.key}`}
                onClick={() =>
                  setEliminated((s) => {
                    const n = new Set(s)
                    n.has(c.key) ? n.delete(c.key) : n.add(c.key)
                    return n
                  })
                }
              >
                {isElim ? 'Undo' : <span className="bb-elim-letter">{c.key}</span>}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )

  const spr = (
    <div className="bb-spr">
      <input
        type="text"
        value={sprInput}
        disabled={locked}
        onChange={(e) => setSprInput(e.target.value)}
        aria-label="Your answer"
        className={showResult ? (isCorrect ? 'correct' : 'wrong') : ''}
      />
      <div className="bb-spr-preview">
        Answer Preview: <span className="serif">{sprInput || ' '}</span>
      </div>
      {showResult && (
        <div className="bb-spr-answer">
          Correct answer{q.answers.length > 1 ? 's' : ''}: <b>{q.answers.join(', ')}</b>
        </div>
      )}
    </div>
  )

  const prompt = (
    <div className="bb-pane bb-prompt">
      {header}
      <div className="bb-pane-body">
        {q.section === 'math' && q.stimulus && (
          <div className="bb-figure html" dangerouslySetInnerHTML={{ __html: q.stimulus }} />
        )}
        <div className="bb-stem html" dangerouslySetInnerHTML={{ __html: q.stem }} />
        {q.type === 'mcq' ? choices : spr}

        {!locked && (
          <button className="bb-check" onClick={submit} disabled={!answer.trim()}>
            {instantFeedback ? 'Check Answer' : 'Submit'}
          </button>
        )}
        {submitted && !showResult && <div className="bb-recorded">Answer recorded.</div>}

        {showResult && (
          <div className={`bb-feedback ${isCorrect ? 'is-ok' : 'is-bad'}`}>
            <div className="bb-feedback-title">
              {!answer.trim() ? 'Not answered' : isCorrect ? 'Correct' : 'Incorrect'}
              {q.type === 'mcq' && !isCorrect && ` — the correct answer is ${q.answers.join('/')}`}
            </div>
            <div className="bb-tags">
              {DIFFICULTY_NAMES[q.difficulty]} · {q.domainName} · {q.skillName}
            </div>
            {isCorrect || whyOpen ? (
              <div className="bb-rationale html" dangerouslySetInnerHTML={{ __html: q.rationale }} />
            ) : (
              <button className="bb-why" onClick={() => setWhyOpen(true)}>
                {answer.trim() ? 'Want to know why it’s wrong?' : 'Want to see the explanation?'}
              </button>
            )}
            {/* The tutor is always there; after a wrong answer it opens straight away. */}
            <TutorChat question={q} studentAnswer={answer} autoOpen={!isCorrect && Boolean(answer.trim())} />
            <textarea
              className="bb-note"
              placeholder="Add a note to yourself about this question…"
              defaultValue={notes[q.id] ?? ''}
              onBlur={(e) => store.setNote(q.id, e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  )

  if (q.section === 'rw' && q.stimulus) {
    return (
      <div className="bb-question split">
        <div className="bb-pane bb-passage">
          <div className="bb-pane-body html" dangerouslySetInnerHTML={{ __html: q.stimulus }} />
        </div>
        <div className="bb-divider" aria-hidden="true" />
        {prompt}
      </div>
    )
  }
  return <div className="bb-question single">{prompt}</div>
}
