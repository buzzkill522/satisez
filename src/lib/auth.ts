import { useSyncExternalStore } from 'react'

export interface User {
  email: string
  name: string
  picture: string
  admin: boolean
  /** Can load the College Board question bank. */
  access: boolean
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
}

let state: AuthState = { loading: true, user: null, configured: true, missing: [], ai: true }
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
      const data = (await res.json()) as { user: User | null; configured: boolean; missing?: string[]; ai?: boolean }
      set({ loading: false, user: data.user, configured: data.configured, missing: data.missing ?? [], ai: data.ai ?? true })
    })
    .catch(() => set({ loading: false, user: null, configured: false, missing: [], ai: false }))
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

export function signIn() {
  window.location.href = `${import.meta.env.BASE_URL}api/auth/login`
}

export async function signOut() {
  await fetch(`${import.meta.env.BASE_URL}api/auth/logout`, { method: 'POST' }).catch(() => {})
  set({ ...state, user: null })
  window.location.hash = '#/'
}
