import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GoogleButton } from '../components/AuthGate'
import { refreshMe, savedReferral, useAuth } from '../lib/auth'

type Tab = 'signin' | 'create'

/** /signin — Google, or email + password. Accounts are optional: they keep progress across devices later. */
export default function SignIn() {
  const { user, google, email: emailReady, configured } = useAuth()
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const nav = useNavigate()
  const [params] = useSearchParams()
  // /#/signin?next=/upgrade — where to go after signing in (only same-site paths).
  const rawNext = params.get('next') || '/'
  const next = /^\/[^/\\]/.test(rawNext) ? rawNext : '/'

  if (user)
    return (
      <div className="page">
        <div className="notice">
          <b>You're signed in as {user.email}.</b>
          <p>Head back to <Link to="/practice">practice</Link> or the <Link to="/">home page</Link>.</p>
        </div>
      </div>
    )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/${tab === 'create' ? 'register' : 'password'}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, name, ref: savedReferral() }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) return setError(data.error || `Could not sign in (${res.status}).`)
      await refreshMe()
      nav(next)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page signin-page">
      <div className="signin-card">
        <h1>{tab === 'create' ? 'Create an account' : 'Sign in'}</h1>
        <p className="muted">
          Optional — everything on the site works without one. An account lets you sign in on other devices.
        </p>

        {!configured && (
          <div className="error-box">
            <b>Accounts aren't set up on this deployment yet.</b>
            <p>Add <code>SESSION_SECRET</code> and the <code>USERS</code> KV binding in Cloudflare, then redeploy.</p>
          </div>
        )}

        {google && (
          <>
            <GoogleButton next={next} />
            {emailReady && <div className="or"><span>or with email</span></div>}
          </>
        )}

        {emailReady && (
          <form className="signin-form" onSubmit={submit}>
            <div className="seg tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'signin'} className={tab === 'signin' ? 'active' : ''} onClick={() => setTab('signin')}>Sign in</button>
              <button type="button" role="tab" aria-selected={tab === 'create'} className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>Create account</button>
            </div>
            {tab === 'create' && (
              <label>
                Name
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
            )}
            <label>
              Email
              <input type="text" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
            <label>
              Password {tab === 'create' && <span className="muted small">(at least 8 characters)</span>}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === 'create' ? 'new-password' : 'current-password'} required minLength={tab === 'create' ? 8 : undefined} />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="primary large" type="submit" disabled={busy || !email || !password}>
              {busy ? 'One moment…' : tab === 'create' ? 'Create account' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
