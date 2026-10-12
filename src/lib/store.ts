import { useSyncExternalStore } from 'react'
import type { Attempt } from './types'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Progress on one study-guide page. Times are ms since epoch. */
export interface GuideProgress {
  /** First time the page was opened. */
  opened?: number
  /** When the student marked it done (absent = not done). */
  done?: number
  /** Results on the page's two sample questions. */
  before?: { qid: string; correct: boolean; at: number }
  after?: { qid: string; correct: boolean; at: number }
}

export interface State {
  attempts: Attempt[]
  flagged: string[]
  notes: Record<string, string>
  /** Tutor chat transcript per question. */
  chats: Record<string, ChatMessage[]>
  /** Study-guide progress per skill slug. */
  guide: Record<string, GuideProgress>
  /**
   * When each flag, note, chat and guide entry last changed ("flag:<qid>", "note:<qid>",
   * "chat:<qid>", "guide:<slug>"). Lets syncing pick the newest change, including removals.
   */
  stamps: Record<string, number>
}

/** One flag/note/chat/guide entry as stored on the server; value null means removed. */
export interface Item {
  key: string
  value: string | null
  stamp: number
}

const KEY = 'satisez.progress.v1'
const empty = (): State => ({ attempts: [], flagged: [], notes: {}, chats: {}, guide: {}, stamps: {} })

function read(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty(), ...JSON.parse(raw) }
  } catch {
    /* ignore corrupt storage */
  }
  return empty()
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

/** A strictly increasing clock, so two changes in the same millisecond still order correctly. */
let lastStamp = 0
const now = () => (lastStamp = Math.max(Date.now(), lastStamp + 1))
const stamped = (key: string) => ({ ...state.stamps, [key]: now() })

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
    const flagged = state.flagged.includes(qid) ? state.flagged.filter((id) => id !== qid) : [...state.flagged, qid]
    set({ ...state, flagged, stamps: stamped(`flag:${qid}`) })
  },
  setNote(qid: string, note: string) {
    const notes = { ...state.notes }
    if (note.trim()) notes[qid] = note
    else delete notes[qid]
    set({ ...state, notes, stamps: stamped(`note:${qid}`) })
  },
  setChat(qid: string, chat: ChatMessage[]) {
    const chats = { ...state.chats }
    if (chat.length) chats[qid] = chat
    else delete chats[qid]
    set({ ...state, chats, stamps: stamped(`chat:${qid}`) })
  },
  /** Merge a change into a guide page's progress. Pass `done: undefined` to un-mark it. */
  updateGuide(slug: string, patch: Partial<GuideProgress>) {
    const next: GuideProgress = { ...state.guide[slug], ...patch }
    for (const k of Object.keys(next) as (keyof GuideProgress)[]) if (next[k] === undefined) delete next[k]
    set({ ...state, guide: { ...state.guide, [slug]: next }, stamps: stamped(`guide:${slug}`) })
  },
  reset() {
    set(empty())
  },
  export: () => JSON.stringify(state, null, 2),
  import(json: string) {
    const parsed = JSON.parse(json) as Partial<State>
    // Imported entries count as changed now, so they win over older saved copies when syncing.
    const t = now()
    const stamps: Record<string, number> = { ...(parsed.stamps ?? {}) }
    for (const item of toItems({ ...empty(), ...parsed })) stamps[item.key] = Math.max(stamps[item.key] ?? 0, t)
    set({ ...empty(), ...parsed, stamps })
  },
  /** Fold in progress from the server (or another source): attempts are combined, newer entries win. */
  merge(attempts: Attempt[], items: Item[]) {
    set(mergeInto(state, attempts, items))
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

/** Flags, notes, chats and guide entries as server items, optionally only those changed since `since`. */
export function toItems(s: State, since = 0): Item[] {
  const value = (key: string): string | null => {
    const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
    if (kind === 'flag') return s.flagged.includes(id) ? '1' : null
    if (kind === 'note') return s.notes[id] ?? null
    if (kind === 'chat') return s.chats[id] ? JSON.stringify(s.chats[id]) : null
    if (kind === 'guide') return s.guide[id] ? JSON.stringify(s.guide[id]) : null
    return null
  }
  const keys = new Set([
    ...Object.keys(s.stamps),
    ...s.flagged.map((q) => `flag:${q}`),
    ...Object.keys(s.notes).map((q) => `note:${q}`),
    ...Object.keys(s.chats).map((q) => `chat:${q}`),
    ...Object.keys(s.guide).map((g) => `guide:${g}`),
  ])
  const out: Item[] = []
  // Entries saved before stamps existed get stamp 1: they still upload, and lose to any real change.
  for (const key of keys) {
    const stamp = s.stamps[key] ?? 1
    if (stamp >= since) out.push({ key, value: value(key), stamp })
  }
  return out
}

function mergeInto(s: State, attempts: Attempt[], items: Item[]): State {
  const seen = new Set(s.attempts.map((a) => `${a.qid}|${a.at}`))
  const extra = attempts.filter((a) => !seen.has(`${a.qid}|${a.at}`))
  const next: State = {
    ...s,
    attempts: extra.length ? [...s.attempts, ...extra].sort((a, b) => a.at - b.at) : s.attempts,
    flagged: [...s.flagged],
    notes: { ...s.notes },
    chats: { ...s.chats },
    guide: { ...s.guide },
    stamps: { ...s.stamps },
  }
  for (const { key, value, stamp } of items) {
    if (stamp <= (next.stamps[key] ?? 0)) continue
    const i = key.indexOf(':')
    const kind = key.slice(0, i)
    const id = key.slice(i + 1)
    next.stamps[key] = stamp
    try {
      if (kind === 'flag') {
        next.flagged = next.flagged.filter((q) => q !== id)
        if (value) next.flagged.push(id)
      } else if (kind === 'note') {
        if (value) next.notes[id] = value
        else delete next.notes[id]
      } else if (kind === 'chat') {
        if (value) next.chats[id] = JSON.parse(value)
        else delete next.chats[id]
      } else if (kind === 'guide') {
        if (value) next.guide[id] = JSON.parse(value)
        else delete next.guide[id]
      }
    } catch {
      /* skip a malformed entry */
    }
  }
  return next
}
