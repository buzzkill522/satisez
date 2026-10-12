import type { ReactNode } from 'react'
import { signIn, useAuth } from '../lib/auth'

export function GoogleButton() {
  return (
    <button className="google-btn" onClick={signIn}>
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.1z" />
        <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.8-6.1z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z" />
      </svg>
      <span className="gb-long">Sign in with Google</span>
      <span className="gb-short">Sign in</span>
    </button>
  )
}

/** What to show instead of question content when the visitor can't load it. */
export function AccessNotice() {
  const { loading, user, configured } = useAuth()
  if (loading) return <p className="muted">Checking your account…</p>
  if (!configured)
    return (
      <div className="notice">
        <b>Sign-in isn't set up on this deployment yet.</b>
        <p>Add the Google and session settings in Cloudflare (see the README's "Accounts" section), then redeploy.</p>
      </div>
    )
  if (!user)
    return (
      <div className="notice">
        <b>Sign in to start practising.</b>
        <p>Create a free account with your Google account. It takes a few seconds.</p>
        <GoogleButton />
      </div>
    )
  return (
    <div className="notice">
      <b>You're signed in as {user.email}.</b>
      <p>Your account is waiting for access to the question bank. The site admin will switch it on for you.</p>
    </div>
  )
}

/** Renders children only for users who can load the question bank. */
export function RequireAccess({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth()
  if (!loading && user?.access) return <>{children}</>
  return (
    <div className="page">
      <AccessNotice />
    </div>
  )
}

/** Renders children only for admins. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth()
  if (loading) return <div className="page"><p className="muted">Checking your account…</p></div>
  if (!user?.admin) return <div className="page"><div className="notice"><b>Admins only.</b></div></div>
  return <>{children}</>
}
