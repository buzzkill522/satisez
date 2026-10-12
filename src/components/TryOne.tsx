import { useState } from 'react'
import { Link } from 'react-router-dom'

/* An original Words-in-Context question written for the landing page (not from the College Board bank). */
const Q = {
  passage:
    'For decades, the lighthouse keeper’s logbooks were dismissed as mere weather records. A recent study, however, shows that the entries are remarkably ______: alongside wind and tide, the keeper noted bird migrations, ship cargoes and even local gossip, making the logs a rich source for historians.',
  stem: 'Which choice completes the text with the most logical and precise word or phrase?',
  choices: [
    { key: 'A', text: 'repetitive' },
    { key: 'B', text: 'wide-ranging' },
    { key: 'C', text: 'illegible' },
    { key: 'D', text: 'confidential' },
  ],
  answer: 'B',
  why: {
    B: 'The colon introduces examples — migrations, cargoes, gossip — that go well beyond weather. The entries cover a lot of ground, so “wide-ranging” fits.',
    A: 'The sentence stresses how varied the entries are, which is the opposite of repetitive.',
    C: 'Nothing in the text is about handwriting; the examples are about what the keeper recorded, not how readable it is.',
    D: 'The logs are being used openly by historians, and the examples (gossip, cargoes) aren’t secret in nature.',
  } as Record<string, string>,
}

export function TryOne() {
  const [picked, setPicked] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [whyOpen, setWhyOpen] = useState(false)
  const correct = picked === Q.answer

  return (
    <div className="try">
      <div className="try-passage">
        <p>{Q.passage}</p>
      </div>
      <div className="try-q">
        <div className="try-head"><b>1</b> Words in Context · Easy</div>
        <p className="try-stem">{Q.stem}</p>
        <div className="try-choices">
          {Q.choices.map((c) => {
            const cls = ['try-choice', picked === c.key && 'on', checked && c.key === Q.answer && 'right', checked && picked === c.key && !correct && 'wrong']
              .filter(Boolean)
              .join(' ')
            return (
              <button key={c.key} className={cls} disabled={checked} onClick={() => setPicked(c.key)}>
                <i>{c.key}</i>
                {c.text}
              </button>
            )
          })}
        </div>
        {!checked ? (
          <button className="primary" disabled={!picked} onClick={() => setChecked(true)}>
            Check answer
          </button>
        ) : (
          <div className={`try-feedback ${correct ? 'is-ok' : 'is-bad'}`}>
            <b>{correct ? 'Correct.' : `Not quite — the answer is ${Q.answer}.`}</b>
            {correct || whyOpen ? (
              <>
                <p>{Q.why[Q.answer]}</p>
                {!correct && picked && <p className="muted">Why {picked} doesn’t work: {Q.why[picked]}</p>}
              </>
            ) : (
              <button className="bb-why" onClick={() => setWhyOpen(true)}>Want to know why it’s wrong?</button>
            )}
            <Link className="btn-primary" to="/practice?section=rw&domain=CAS">
              Practise more like this
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
