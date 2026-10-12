import { useEffect, useState } from 'react'

interface AdminUser {
  email: string
  name: string
  picture: string
  createdAt: string
  lastLogin: string
  access: boolean
  admin: boolean
}

const fmt = (iso: string) => (iso ? new Date(iso).toLocaleString() : '—')

export default function Admin() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  async function load() {
    setError('')
    const res = await fetch(`${import.meta.env.BASE_URL}api/admin/users`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error || `Failed to load users (${res.status}).`)
    setUsers(data.users)
  }
  useEffect(() => {
    load()
  }, [])

  async function setAccess(u: AdminUser, access: boolean) {
    setSaving(u.email)
    const res = await fetch(`${import.meta.env.BASE_URL}api/admin/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: u.email, access }),
    })
    setSaving(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return setError(data.error || `Could not update ${u.email}.`)
    }
    setUsers((list) => list?.map((x) => (x.email === u.email ? { ...x, access } : x)) ?? null)
  }

  const shown = (users ?? []).filter(
    (u) => !query || u.email.includes(query.toLowerCase()) || u.name.toLowerCase().includes(query.toLowerCase()),
  )
  const withAccess = (users ?? []).filter((u) => u.access || u.admin).length

  return (
    <div className="page">
      <h1>Admin</h1>
      {error && <p className="error">{error}</p>}
      {users && (
        <div className="stats-row">
          <div className="stat"><div className="stat-value">{users.length}</div><div className="stat-label">Registered users</div></div>
          <div className="stat"><div className="stat-value">{withAccess}</div><div className="stat-label">With question-bank access</div></div>
        </div>
      )}
      <p className="muted small">
        Question-bank access unlocks the College Board questions. Keep it to people you'd personally share
        them with — the questions are College Board's copyrighted material.
      </p>
      <input className="search" placeholder="Search by name or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {!users && !error && <p className="muted">Loading…</p>}
      {users && (
        <table className="qtable admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Joined</th>
              <th>Last sign-in</th>
              <th>Question bank</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.email}>
                <td>
                  <div className="user-cell">
                    {u.picture ? <img src={u.picture} alt="" referrerPolicy="no-referrer" /> : <span className="avatar-fallback">{u.name[0]}</span>}
                    <div>
                      <div>{u.name} {u.admin && <span className="badge">Admin</span>}</div>
                      <div className="muted small">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="muted small">{fmt(u.createdAt)}</td>
                <td className="muted small">{fmt(u.lastLogin)}</td>
                <td>
                  {u.admin ? (
                    <span className="muted small">Always</span>
                  ) : (
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={u.access}
                        disabled={saving === u.email}
                        onChange={(e) => setAccess(u, e.target.checked)}
                      />
                      <span>{u.access ? 'On' : 'Off'}</span>
                    </label>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
