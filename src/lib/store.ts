import { useSyncExternalStore } from 'react'
import type { Attempt } from './types'

interface State {
  attempts: Attempt[]
  flagged: string[]
  notes: Record<string, string>
}

const KEY = 'satisez.progress.v1'

function read(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { attempts: [], flagged: [], notes: {}, ...JSON.parse(raw) }
  } catch {
    /* ignore corrupt storage */
  }
  return { attempts: [], flagged: [], notes: {} }
}

let state: State = read()
const listeners = new Set<() => void>()

function set(next: State) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* quota exceeded etc. — keep in-memory state */
  }
  listeners.forEach((l) => l())
}

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  recordAttempt(a: Attempt) {
    set({ ...state, attempts: [...state.attempts, a] })
  },
  toggleFlag(qid: string) {
    const flagged = state.flagged.includes(qid)
      ? state.flagged.filter((id) => id !== qid)
      : [...state.flagged, qid]
    set({ ...state, flagged })
  },
  setNote(qid: string, note: string) {
    const notes = { ...state.notes }
    if (note.trim()) notes[qid] = note
    else delete notes[qid]
    set({ ...state, notes })
  },
  reset() {
    set({ attempts: [], flagged: [], notes: {} })
  },
  export: () => JSON.stringify(state, null, 2),
  import(json: string) {
    const parsed = JSON.parse(json)
    set({ attempts: [], flagged: [], notes: {}, ...parsed })
  },
}

export function useStore(): State {
  return useSyncExternalStore(store.subscribe, store.get)
}

/** Latest attempt per question, for status lookups. */
export function latestByQuestion(attempts: Attempt[]): Map<string, Attempt> {
  const m = new Map<string, Attempt>()
  for (const a of attempts) m.set(a.qid, a)
  return m
}
