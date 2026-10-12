import { useSyncExternalStore } from 'react'

export interface User {
  email: string
  name: string
  picture: string
  admin: boolean
  /** Can load the College Board question bank. */
  access: boolean
  /** Paid (or admin): full bank, guide and browse. */
  premium: boolean
  /** ISO date the paid period ends, if any. */
  premiumUntil: string | null
}

interface AuthState {
  loading: boolean
  user: User | null
  /** False when the server is missing sign-in settings (or isn't running Functions, e.g. `npm run dev`). */
  configured: boolean
  /** Names of required Cloudflare settings that aren't set yet. */
  missing: string[]
  /** Whether the Workers AI binding for the tutor is connected. */
  ai: boolean
  /** Which sign-in methods the server offers. */
  google: boolean
  email: boolean
  /** Visitor's country code from Cloudflare (e.g. "IN"), for choosing a currency. */
  country: string
  /** Whether progress is saved to accounts (the D1 `DB` binding is connected). */
  sync: boolean
}

let state: AuthState = { loading: true, user: null, configured: true, missing: [], ai: true, google: false, email: false, country: '', sync: false }
const listeners = new Set<() => void>()
const set = (next: AuthState) => {
  state = next
  listeners.forEach((l) => l())
}

let started = false
export function refreshMe() {
  started = true
  return fetch(`${import.meta.env.BASE_URL}api/me`, { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { user: User | null; configured: boolean; missing?: string[]; ai?: boolean; google?: boolean; email?: boolean; country?: string; sync?: boolean }
      const user = data.user ? { ...data.user, premium: Boolean(data.user.premium), premiumUntil: data.user.premiumUntil ?? null } : null
      set({ loading: false, user, configured: data.configured, missing: data.missing ?? [], ai: data.ai ?? true, google: data.google ?? false, email: data.email ?? false, country: data.country ?? '', sync: data.sync ?? false })
    })
    .catch(() => set({ loading: false, user: null, configured: false, missing: [], ai: false, google: false, email: false, country: '', sync: false }))
}

export function useAuth(): AuthState {
  if (!started) refreshMe()
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

/**
 * Whether this visitor can use the paid parts of the site. Without accounts configured (local
 * `npm run dev`, or a deployment with no SESSION_SECRET) nobody can pay, so everything is open;
 * the server applies the same rule to the question data.
 */
export function usePremium(): { loading: boolean; premium: boolean } {
  const { loading, user, configured } = useAuth()
  return { loading, premium: !configured || Boolean(user?.premium) }
}

export function signIn(next?: string) {
  const q = next ? `?next=${encodeURIComponent(next)}` : ''
  window.location.href = `${import.meta.env.BASE_URL}api/auth/login${q}`
}

const signOutHooks: (() => Promise<void> | void)[] = []
/** Run before signing out (used to upload pending progress and clear this browser's copy). */
export function onSignOut(fn: () => Promise<void> | void) {
  signOutHooks.push(fn)
}

export async function signOut() {
  for (const fn of signOutHooks) await Promise.resolve(fn()).catch(() => {})
  await fetch(`${import.meta.env.BASE_URL}api/auth/logout`, { method: 'POST' }).catch(() => {})
  set({ ...state, user: null })
  window.location.hash = '#/'
}
