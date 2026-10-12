import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Count down from this many seconds; omit for a stopwatch. */
  limitSeconds?: number
  running: boolean
  onExpire?: () => void
  /** Reset the timer whenever this changes. */
  resetKey?: unknown
}

export function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

/** Bluebook-style centered clock with a Hide/Show pill beside it. */
export function Timer({ limitSeconds, running, onExpire, resetKey }: Props) {
  const [elapsed, setElapsed] = useState(0)
  const [hidden, setHidden] = useState(false)
  const expired = useRef(false)

  useEffect(() => {
    setElapsed(0)
    expired.current = false
  }, [resetKey])

  useEffect(() => {
    if (!running) return
    const start = Date.now() - elapsed * 1000
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, resetKey])

  const remaining = limitSeconds !== undefined ? Math.max(0, limitSeconds - elapsed) : null
  useEffect(() => {
    if (remaining === 0 && !expired.current) {
      expired.current = true
      onExpire?.()
    }
  }, [remaining, onExpire])

  const shown = remaining ?? elapsed
  // Bluebook un-hides the clock and turns it red for the last 5 minutes.
  const low = remaining !== null && remaining < 5 * 60

  return (
    <div className={`bb-timer ${low ? 'low' : ''}`}>
      <span className="bb-clock" aria-live="off">
        {hidden && !low ? (
          <svg width="22" height="22" viewBox="0 0 22 22" aria-label="Timer hidden">
            <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M11 6v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : (
          formatTime(shown)
        )}
      </span>
      <button className="bb-pill" onClick={() => setHidden((h) => !h)}>
        {hidden && !low ? 'Show' : 'Hide'}
      </button>
    </div>
  )
}
