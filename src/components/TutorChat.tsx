import { useEffect, useRef, useState } from 'react'
import type { Question } from '../lib/types'
import { store, useStore, type ChatMessage } from '../lib/store'

interface Props {
  question: Question
  studentAnswer: string
  /** Open the panel straight away (used after a wrong answer). */
  autoOpen?: boolean
}

/** "Ask about this question" — a short AI chat with the question and rationale as context. */
export function TutorChat({ question: q, studentAnswer, autoOpen }: Props) {
  const { chats } = useStore()
  const chat: ChatMessage[] = chats[q.id] ?? []
  const [open, setOpen] = useState(Boolean(autoOpen) || chat.length > 0)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [chat.length, busy, open])

  async function send() {
    const text = draft.trim()
    if (!text || busy) return
    const next: ChatMessage[] = [...chat, { role: 'user', content: text }]
    store.setChat(q.id, next)
    setDraft('')
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: { ...q, studentAnswer }, messages: next }),
      })
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string }
      if (res.status === 401) {
        setError('Your sign-in has expired. Reload the page and sign in again.')
        store.setChat(q.id, chat) // drop the unsent message; it's still in the box
        setDraft(text)
        return
      }
      if (!res.ok || !data.reply) {
        setError(data.error || `Request failed (${res.status}).`)
        return
      }
      store.setChat(q.id, [...next, { role: 'assistant', content: data.reply }])
    } catch {
      setError('Could not reach the tutor. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button className="bb-tutor-open" onClick={() => setOpen(true)}>
        Ask about this question
      </button>
    )
  }

  return (
    <div className="bb-tutor">
      <div className="bb-tutor-head">
        <span>Ask about this question</span>
        <button className="bb-nav-close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
      </div>

      <div className="bb-tutor-log">
        {chat.length === 0 && !busy && (
          <p className="bb-tutor-hint">
            Ask anything specific — "why is {q.answers[0]} right?", "what's wrong with my choice?", "how do I spot this type?"
          </p>
        )}
        {chat.map((m, i) => (
          <div key={i} className={`bb-msg ${m.role}`}>
            {m.content}
          </div>
        ))}
        {busy && <div className="bb-msg assistant thinking">Thinking…</div>}
        <div ref={endRef} />
      </div>

      {error && <div className="bb-tutor-error">{error}</div>}

      <form
        className="bb-tutor-input"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your doubt…"
          disabled={busy}
          aria-label="Your question for the tutor"
        />
        <button className="bb-check" type="submit" disabled={busy || !draft.trim()}>
          Send
        </button>
        {chat.length > 0 && (
          <button type="button" className="link small" onClick={() => store.setChat(q.id, [])}>
            Clear
          </button>
        )}
      </form>
    </div>
  )
}
