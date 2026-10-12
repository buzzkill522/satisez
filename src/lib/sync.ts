// Keeps the browser's progress (src/lib/store.ts) and the signed-in account's saved copy
// (/api/progress, Cloudflare D1) in step.
//
// - On sign-in: uploads what this browser has (including anything done before signing in) and
//   downloads what the account has from other devices, then merges the two.
// - After that: every change is uploaded a couple of seconds later, and again when the tab is
//   hidden or closed. Coming back to the tab after a while pulls in other devices' changes.
// - On sign-out: the browser copy is cleared, so the next person on this computer starts fresh.

import { useEffect, useSyncExternalStore } from 'react'
import { onSignOut, useAuth } from './auth'
import { store, toItems } from './store'

const OWNER_KEY = 'satisez.sync.owner' // whose saved progress this browser's copy belongs to
const PUSHED_KEY = 'satisez.sync.pushed' // everything changed before this time is uploaded
const api = `${import.meta.env.BASE_URL}api/progress`

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'saved' | 'error'
interface SyncState {
  status: SyncStatus
  /** Last successful save (ms). */
  savedAt: number | null
}

let sync: SyncState = { status: 'signed-out', savedAt: null }
const listeners = new Set<() => void>()
const setSync = (next: Partial<SyncState>) => {
  sync = { ...sync, ...next }
  listeners.forEach((l) => l())
}
export function useSyncStatus(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => sync,
  )
}

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k)
      else localStorage.setItem(k, v)
    } catch {
      /* storage unavailable */
    }
  },
}

let email: string | null = null
let ready = false // first exchange done for this account
let lastFull = 0
let timer: ReturnType<typeof setTimeout> | undefined
let inFlight: Promise<void> | null = null

/** Changes since the last successful upload. */
function delta(since: number) {
  const s = store.get()
  return { attempts: s.attempts.filter((a) => a.at >= since), items: toItems(s, since) }
}

async function push(full: boolean): Promise<void> {
  if (!email) return
  if (inFlight) await inFlight.catch(() => {})
  const who = email
  const since = Number(ls.get(PUSHED_KEY) || 0)
  const startedAt = Date.now()
  const body = { ...delta(since), full }
  if (!full && !body.attempts.length && !body.items.length) return
  setSync({ status: 'syncing' })
  inFlight = (async () => {
    const res = await fetch(api, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || String(res.status))
    if (email !== who) return // signed out mid-request
    if (full) {
      store.merge(data.attempts ?? [], data.items ?? [])
      lastFull = Date.now()
    }
    ls.set(PUSHED_KEY, String(startedAt))
    setSync({ status: 'saved', savedAt: Date.now() })
  })()
  try {
    await inFlight
  } catch {
    setSync({ status: 'error' })
  } finally {
    inFlight = null
  }
}

function schedule() {
  if (!email || !ready) return
  clearTimeout(timer)
  timer = setTimeout(() => push(false), 2000)
}

/** Last-chance upload when the tab is hidden or closed; sendBeacon survives page unload. */
function beacon() {
  if (!email || !ready) return
  clearTimeout(timer)
  const since = Number(ls.get(PUSHED_KEY) || 0)
  const body = delta(since)
  if (!body.attempts.length && !body.items.length) return
  const startedAt = Date.now()
  const sent = navigator.sendBeacon?.(api, new Blob([JSON.stringify(body)], { type: 'application/json' }))
  if (sent) ls.set(PUSHED_KEY, String(startedAt))
}

async function start(nextEmail: string) {
  const owner = ls.get(OWNER_KEY)
  if (owner && owner !== nextEmail) {
    // This browser holds someone else's (already saved) progress: don't mix it into this account.
    store.reset()
    ls.set(PUSHED_KEY, null)
  }
  if (owner !== nextEmail) ls.set(PUSHED_KEY, null) // upload everything on first sign-in here
  ls.set(OWNER_KEY, nextEmail)
  email = nextEmail
  ready = false
  await push(true)
  ready = sync.status === 'saved'
  if (!ready) setTimeout(() => email === nextEmail && start(nextEmail), 15000) // retry later
}

function stop(status: SyncStatus) {
  email = null
  ready = false
  clearTimeout(timer)
  setSync({ status, savedAt: null })
}

/** Upload anything pending, then forget this account's progress in the browser. */
async function flushAndClear() {
  if (email && ready) await push(false)
  stop('signed-out')
  store.reset()
  ls.set(OWNER_KEY, null)
  ls.set(PUSHED_KEY, null)
}

/** Erase the account's saved progress as well as the browser copy ("Reset everything"). */
export async function resetEverywhere() {
  store.reset()
  if (!email) return
  const res = await fetch(api, { method: 'DELETE' })
  if (!res.ok) throw new Error('Could not erase saved progress. Try again.')
  ls.set(PUSHED_KEY, String(Date.now()))
}

/** After an import, upload it in full. */
export function pushAll() {
  if (!email) return
  ls.set(PUSHED_KEY, null)
  return push(true)
}

let wired = false
function wire() {
  if (wired) return
  wired = true
  store.subscribe(schedule)
  onSignOut(flushAndClear)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') beacon()
    else if (email && ready && Date.now() - lastFull > 60_000) push(true)
  })
  window.addEventListener('pagehide', beacon)
}

/** Mount once (in App): follows the signed-in user and keeps their progress saved. */
export function useProgressSync() {
  const { loading, user, sync: available } = useAuth()
  const who = user?.email ?? null
  useEffect(() => {
    if (loading) return
    wire()
    if (!who) {
      if (email) stop('signed-out')
      else setSync({ status: 'signed-out' })
      return
    }
    if (!available) return stop('off')
    if (who !== email) start(who)
  }, [loading, who, available])
}
