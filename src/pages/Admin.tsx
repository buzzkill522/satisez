import { useCallback, useEffect, useMemo, useState } from 'react'
import { RW_SKILLS } from '../guide/rw'

interface AdminUser {
  email: string
  name: string
  picture: string
  createdAt: string
  lastLogin: string
  hasPassword: boolean
  owner: boolean
  admin: boolean
  blocked: boolean
  premium: { until: string; source: string; grantedAt?: string } | null
  premiumActive: boolean
  lifetime: boolean
  answered?: number
  lastActive?: number | null
  prank?: boolean
  signups?: number
  paidReferrals?: number
}

interface Summary {
  users: number
  premium: number
  admins: number
  blocked: number
  new7: number
  active7: number
  answered: number
}

interface Progress {
  attempts: number
  correct: number
  answered: number
  lastActive: number | null
  recent: { qid: string; correct: boolean; seconds: number; at: number }[]
  guide: { slug: string; done: boolean; opened: number | null }[]
}

interface LogEntry {
  at: string
  by: string
  action: string
  target: string
  detail?: string
}

type Filter = 'all' | 'premium' | 'free' | 'admins' | 'blocked' | 'new'
const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['premium', 'Premium'],
  ['free', 'Free'],
  ['admins', 'Admins'],
  ['blocked', 'Blocked'],
  ['new', 'New this week'],
]

/** Premium lengths offered in the dropdowns. */
const LENGTHS: [string, string][] = [
  ['31', '1 month'],
  ['92', '3 months'],
  ['183', '6 months'],
  ['366', '1 year'],
  ['lifetime', 'Lifetime'],
  ['custom', 'Until a date…'],
]

const api = `${import.meta.env.BASE_URL}api/admin/users`
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const fmtWhen = (v?: string | number | null) => (v ? new Date(v).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—')
const skillName = (slug: string) => RW_SKILLS.find((s) => s.slug === slug)?.name ?? slug
const sourceLabel = (src?: string) =>
  !src ? '' : src.startsWith('admin:') ? `given by ${src.slice(6)}` : src === 'admin' ? 'given by an admin' : `paid via ${src[0].toUpperCase()}${src.slice(1)}`

async function post(body: Record<string, unknown>) {
  const res = await fetch(api, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Failed (${res.status}).`)
  return data
}

/** Turns a length dropdown value (+ optional date) into the API's premium fields. */
function premiumFields(length: string, date: string): Record<string, unknown> | null {
  if (length === 'lifetime') return { lifetime: true }
  if (length === 'custom') return date ? { until: new Date(`${date}T23:59:59`).toISOString() } : null
  return { days: Number(length) }
}

export default function Admin() {
  const [tab, setTab] = useState<'users' | 'log'>('users')
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [me, setMe] = useState<{ email: string; owner: boolean }>({ email: '', owner: false })
  const [sync, setSync] = useState(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const res = await fetch(api, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error || `Failed to load users (${res.status}).`)
    setUsers(data.users)
    setSummary(data.summary)
    setMe(data.me)
    setSync(data.sync)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const done = (msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash((f) => (f === msg ? '' : f)), 4000)
    load()
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const week = Date.now() - 7 * 86400 * 1000
    return (users ?? []).filter((u) => {
      if (q && !u.email.includes(q) && !u.name.toLowerCase().includes(q)) return false
      if (filter === 'premium') return u.premiumActive && !u.owner
      if (filter === 'free') return !u.premiumActive
      if (filter === 'admins') return u.admin
      if (filter === 'blocked') return u.blocked
      if (filter === 'new') return Boolean(u.createdAt) && Date.parse(u.createdAt) > week
      return true
    })
  }, [users, query, filter])

  function exportCsv() {
    const rows = [
      ['email', 'name', 'role', 'premium_until', 'premium_source', 'blocked', 'joined', 'last_sign_in', 'questions_answered'],
      ...(users ?? []).map((u) => [
        u.email,
        u.name,
        u.owner ? 'owner' : u.admin ? 'admin' : 'user',
        u.premiumActive && u.premium ? u.premium.until : '',
        u.premium?.source ?? '',
        u.blocked ? 'yes' : '',
        u.createdAt,
        u.lastLogin,
        String(u.answered ?? ''),
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `satisez-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="page admin-page">
      <div className="admin-head">
        <h1>Admin</h1>
        <div className="seg admin-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'users'} className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users</button>
          <button role="tab" aria-selected={tab === 'log'} className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>Activity log</button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      {flash && <p className="admin-flash">{flash}</p>}

      {tab === 'log' ? (
        <AuditLog />
      ) : (
        <>
          {summary && (
            <div className="stats-row admin-stats">
              <Tile value={summary.users} label="Accounts" />
              <Tile value={summary.premium} label="On Premium" />
              <Tile value={summary.active7} label="Active this week" />
              <Tile value={summary.new7} label="Joined this week" />
              <Tile value={summary.admins} label="Admins" />
              {sync && <Tile value={summary.answered} label="Questions answered" />}
            </div>
          )}

          <div className="admin-toolbar">
            <input className="search" placeholder="Search by name or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="primary" onClick={() => setAdding((a) => !a)}>{adding ? 'Close' : '+ Add user / give Premium'}</button>
            <button onClick={exportCsv} disabled={!users?.length}>Export CSV</button>
          </div>
          {adding && <AddUser onDone={(m) => { setAdding(false); done(m) }} />}

          <div className="seg admin-filters">
            {FILTERS.map(([f, label]) => (
              <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{label}</button>
            ))}
          </div>

          {!users && !error && <p className="muted">Loading…</p>}
          {users && (
            <div className="admin-table-wrap">
              <table className="qtable admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Premium</th>
                    <th>Answered</th>
                    <th>Last sign-in</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((u) => (
                    <tr key={u.email} onClick={() => setOpen(u.email)} className={u.blocked ? 'is-blocked' : ''}>
                      <td>
                        <div className="user-cell">
                          <Avatar u={u} />
                          <div>
                            <div className="user-name">
                              {u.name} <RoleBadges u={u} />
                            </div>
                            <div className="muted small">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="small"><PremiumStatus u={u} /></td>
                      <td className="small">{u.answered ?? '—'}</td>
                      <td className="muted small">{fmtDate(u.lastLogin)}</td>
                      <td className="muted small">{fmtDate(u.createdAt)}</td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr><td colSpan={5} className="muted">No accounts match.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {open && <UserPanel email={open} me={me} onClose={() => setOpen(null)} onChanged={done} />}
    </div>
  )
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value.toLocaleString()}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function Avatar({ u }: { u: AdminUser }) {
  return u.picture ? <img src={u.picture} alt="" referrerPolicy="no-referrer" /> : <span className="avatar-fallback">{(u.name || u.email)[0]?.toUpperCase()}</span>
}

function RoleBadges({ u }: { u: AdminUser }) {
  return (
    <>
      {u.owner ? <span className="badge role-owner">Owner</span> : u.admin && <span className="badge role-admin">Admin</span>}
      {u.blocked && <span className="badge role-blocked">Blocked</span>}
      {!u.lastLogin && <span className="badge subtle">Not signed in yet</span>}
    </>
  )
}

function PremiumStatus({ u }: { u: AdminUser }) {
  if (u.owner) return <span className="muted">Always (owner)</span>
  if (!u.premiumActive || !u.premium) return <span className="muted">Free</span>
  return <span className="badge premium-badge">{u.lifetime ? 'Lifetime' : `Until ${fmtDate(u.premium.until)}`}</span>
}

/** Premium length dropdown with an optional date picker. */
function LengthPicker({ length, setLength, date, setDate }: { length: string; setLength: (v: string) => void; date: string; setDate: (v: string) => void }) {
  return (
    <>
      <select value={length} onChange={(e) => setLength(e.target.value)} aria-label="Premium length">
        {LENGTHS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      {length === 'custom' && <input type="date" value={date} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} aria-label="Premium end date" />}
    </>
  )
}

function AddUser({ onDone }: { onDone: (msg: string) => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [withPremium, setWithPremium] = useState(true)
  const [length, setLength] = useState('366')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const extra = withPremium ? premiumFields(length, date) : {}
    if (withPremium && !extra) return setError('Pick an end date.')
    setBusy(true)
    try {
      await post({ action: 'create', email, name, ...extra })
      onDone(`Added ${email}${withPremium ? ' with Premium' : ''}. They can sign in with Google using that email, or you can set a password for them.`)
    } catch (err) {
      // Already exists: give Premium to the existing account instead.
      if (withPremium && /already exists/.test((err as Error).message)) {
        try {
          await post({ action: 'premium', email, ...extra })
          onDone(`${email} already had an account — gave them Premium.`)
          return
        } catch (e2) {
          setError((e2 as Error).message)
        }
      } else setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="admin-add" onSubmit={submit}>
      <p className="muted small">Add someone by email — useful for giving Premium before they sign up. If the email already has an account, they just get the Premium.</p>
      <div className="admin-add-row">
        <input type="text" inputMode="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="text" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="admin-add-row">
        <label className="check"><input type="checkbox" checked={withPremium} onChange={(e) => setWithPremium(e.target.checked)} /> Give Premium</label>
        {withPremium && <LengthPicker length={length} setLength={setLength} date={date} setDate={setDate} />}
        <button className="primary" type="submit" disabled={busy || !email}>{busy ? 'Saving…' : 'Add'}</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  )
}

/** Side panel with everything about one account and every action on it. */
function UserPanel({ email, me, onClose, onChanged }: { email: string; me: { email: string; owner: boolean }; onClose: () => void; onChanged: (msg: string) => void }) {
  const [u, setU] = useState<AdminUser | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [length, setLength] = useState('31')
  const [date, setDate] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`${api}?email=${encodeURIComponent(email)}`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error || `Failed (${res.status}).`)
    setU(data.user)
    setName(data.user.name)
    setProgress(data.progress)
  }, [email])
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function act(key: string, body: Record<string, unknown>, msg: string, close = false) {
    setBusy(key)
    setError('')
    try {
      await post({ email, ...body })
      onChanged(msg)
      if (close) onClose()
      else await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy('')
    }
  }

  const self = email === me.email.toLowerCase()
  const accuracy = progress && progress.attempts ? Math.round((100 * progress.correct) / progress.attempts) : null
  const guideDone = progress?.guide.filter((g) => g.done) ?? []

  return (
    <div className="admin-overlay" onClick={onClose}>
      <aside className="admin-panel" onClick={(e) => e.stopPropagation()} aria-label={`Account ${email}`}>
        <button className="pw-close" onClick={onClose} aria-label="Close">×</button>
        {!u ? (
          <p className="muted">{error || 'Loading…'}</p>
        ) : (
          <>
            <div className="ap-head">
              <Avatar u={u} />
              <div>
                <h2>{u.name}</h2>
                <div className="muted small">{u.email}</div>
                <div className="ap-badges"><RoleBadges u={u} /></div>
              </div>
            </div>
            <dl className="ap-facts">
              <div><dt>Joined</dt><dd>{fmtDate(u.createdAt)}</dd></div>
              <div><dt>Last sign-in</dt><dd>{u.lastLogin ? fmtWhen(u.lastLogin) : 'Never'}</dd></div>
              <div><dt>Signs in with</dt><dd>{u.hasPassword ? 'Email + password' : 'Google'}</dd></div>
            </dl>
            {error && <p className="error">{error}</p>}

            <section className="ap-section">
              <h3>Premium</h3>
              <p className="small">
                <PremiumStatus u={u} /> {u.premiumActive && u.premium && !u.owner && <span className="muted">· {sourceLabel(u.premium.source)}</span>}
              </p>
              {!u.owner && (
                <div className="ap-row">
                  <LengthPicker length={length} setLength={setLength} date={date} setDate={setDate} />
                  <button
                    className="primary"
                    disabled={Boolean(busy) || (length === 'custom' && !date)}
                    onClick={() => {
                      const f = premiumFields(length, date)
                      if (f) act('premium', { action: 'premium', ...f }, `Premium ${u.premiumActive && !u.lifetime && !f.lifetime && !f.until ? 'extended' : u.premiumActive ? 'changed' : 'given'} for ${u.email}.`)
                    }}
                  >
                    {busy === 'premium' ? 'Saving…' : u.premiumActive && !u.lifetime && length !== 'lifetime' && length !== 'custom' ? 'Extend' : u.premiumActive ? 'Change' : 'Give Premium'}
                  </button>
                  {u.premiumActive && (
                    <button className="link" disabled={Boolean(busy)} onClick={() => confirm(`End Premium for ${u.email} now?`) && act('premium-remove', { action: 'premium-remove' }, `Premium removed for ${u.email}.`)}>
                      Remove Premium
                    </button>
                  )}
                </div>
              )}
              {!u.owner && u.premiumActive && !u.lifetime && length !== 'lifetime' && length !== 'custom' && <p className="muted small">Extending adds time on top of the current end date.</p>}
              {!u.owner && u.lifetime && <p className="muted small">Picking a length replaces the lifetime grant, counted from today.</p>}
            </section>

            <section className="ap-section">
              <h3>Role</h3>
              {u.owner ? (
                <p className="muted small">Owner — set in ADMIN_EMAILS in Cloudflare. Owners are always admins and can’t be changed here.</p>
              ) : !me.owner ? (
                <p className="muted small">{u.admin ? 'Admin.' : 'Regular user.'} Only the site owners can add or remove admins.</p>
              ) : self ? (
                <p className="muted small">You can’t change your own role.</p>
              ) : (
                <div className="ap-row">
                  <span className="small">{u.admin ? 'Admin — can manage users and Premium.' : 'Regular user.'}</span>
                  <button
                    disabled={Boolean(busy)}
                    onClick={() =>
                      confirm(u.admin ? `Remove admin from ${u.email}?` : `Make ${u.email} an admin? They’ll be able to manage users and give Premium.`) &&
                      act('admin', { action: 'admin', value: !u.admin }, u.admin ? `${u.email} is no longer an admin.` : `${u.email} is now an admin.`)
                    }
                  >
                    {u.admin ? 'Remove admin' : 'Make admin'}
                  </button>
                </div>
              )}
            </section>

            <section className="ap-section">
              <h3>Progress</h3>
              {!progress ? (
                <p className="muted small">Progress saving isn’t switched on (no DB binding), so there’s nothing stored for accounts yet.</p>
              ) : (
                <>
                  <div className="ap-tiles">
                    <div><b>{progress.answered}</b><span>questions answered</span></div>
                    <div><b>{accuracy === null ? '—' : `${accuracy}%`}</b><span>accuracy ({progress.attempts} attempts)</span></div>
                    <div><b>{guideDone.length}/{RW_SKILLS.length}</b><span>guide types done</span></div>
                  </div>
                  <p className="muted small">Last active: {fmtWhen(progress.lastActive)}</p>
                  {progress.guide.length > 0 && (
                    <div className="ap-guide">
                      {progress.guide.map((g) => (
                        <span key={g.slug} className={`skill-chip ${g.done ? 'done' : 'started'}`}>{g.done && <span className="chip-check">✓</span>}{skillName(g.slug)}</span>
                      ))}
                    </div>
                  )}
                  {progress.recent.length > 0 && (
                    <table className="qtable ap-recent">
                      <tbody>
                        {progress.recent.map((r) => (
                          <tr key={`${r.qid}-${r.at}`}>
                            <td className={r.correct ? 'is-ok' : 'is-bad'}>{r.correct ? '✓' : '✗'}</td>
                            <td className="muted small">{r.qid}</td>
                            <td className="muted small">{fmtWhen(r.at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </section>

            <section className="ap-section">
              <h3>Account</h3>
              <div className="ap-row">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
                <button disabled={Boolean(busy) || !name.trim() || name === u.name} onClick={() => act('name', { action: 'name', name }, `Renamed to ${name}.`)}>Rename</button>
              </div>
              <p className="muted small">Referrals: {u.signups ?? 0} sign-up{u.signups === 1 ? '' : 's'} · {u.paidReferrals ?? 0} paid</p>
              {!u.owner && !self && (
                <div className="ap-row">
                  <span className="small">{u.prank ? (u.signups || u.paidReferrals ? '“Idiot” screen: on, but already cleared by a referral sign-up.' : '“Idiot” screen: showing until their first referral sign-up.') : '“Idiot” screen: off.'}</span>
                  <button
                    disabled={Boolean(busy)}
                    onClick={() => act('prank', { action: 'prank', value: !u.prank }, u.prank ? `Idiot screen off for ${u.email}.` : `Idiot screen on for ${u.email}.`)}
                  >
                    {u.prank ? 'Turn off' : 'Turn on'}
                  </button>
                </div>
              )}
              {(!u.owner || self) && (
                <div className="ap-row">
                  <input type="text" placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="New password" autoComplete="off" />
                  <button
                    disabled={Boolean(busy) || password.length < 8}
                    onClick={() => act('password', { action: 'password', password }, `New password set for ${u.email}. Send it to them privately.`).then(() => setPassword(''))}
                  >
                    Set password
                  </button>
                </div>
              )}
              {!u.owner && !self && (
                <div className="ap-row danger-row">
                  <button
                    className="danger"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      confirm(u.blocked ? `Unblock ${u.email}?` : `Block ${u.email}? They’ll be signed out and can’t sign in again until unblocked.`) &&
                      act('block', { action: 'block', value: !u.blocked }, u.blocked ? `${u.email} unblocked.` : `${u.email} blocked.`)
                    }
                  >
                    {u.blocked ? 'Unblock' : 'Block account'}
                  </button>
                  <button
                    className="danger"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      const typed = prompt(`This deletes ${u.email} and all their saved progress. It can’t be undone.\n\nType the email to confirm:`)
                      if (typed?.trim().toLowerCase() === u.email) act('delete', { action: 'delete' }, `${u.email} deleted.`, true)
                    }}
                  >
                    Delete account
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </aside>
    </div>
  )
}

function AuditLog() {
  const [log, setLog] = useState<LogEntry[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch(`${api}?log=1`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || String(res.status))
        setLog(data.log)
      })
      .catch((e) => setError(e.message))
  }, [])
  const label: Record<string, string> = {
    create: 'Added account',
    premium: 'Gave Premium',
    'premium-remove': 'Removed Premium',
    admin: 'Changed role',
    block: 'Changed block',
    password: 'Password',
    name: 'Renamed',
    delete: 'Deleted',
  }
  if (error) return <p className="error">{error}</p>
  if (!log) return <p className="muted">Loading…</p>
  if (!log.length) return <p className="muted">No admin actions yet.</p>
  return (
    <div className="admin-table-wrap">
      <table className="qtable admin-log">
        <thead>
          <tr><th>When</th><th>Admin</th><th>Action</th><th>Account</th><th>Details</th></tr>
        </thead>
        <tbody>
          {log.map((e, i) => (
            <tr key={i}>
              <td className="muted small">{fmtWhen(e.at)}</td>
              <td className="small">{e.by}</td>
              <td className="small"><b>{label[e.action] ?? e.action}</b></td>
              <td className="small">{e.target}</td>
              <td className="muted small">{e.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
