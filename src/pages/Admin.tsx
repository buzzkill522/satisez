import { useEffect, useState } from 'react'

interface AdminUser {
  email: string
  name: string
  picture: string
  createdAt: string
  lastLogin: string
  access: boolean
  admin: boolean
  hasPassword?: boolean
}

const fmt = (iso: string) => (iso ? new Date(iso).toLocaleString() : '—')

export default function Admin() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState('')
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

  const shown = (users ?? []).filter(
    (u) => !query || u.email.includes(query.toLowerCase()) || u.name.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="page">
      <h1>Admin</h1>
      {error && <p className="error">{error}</p>}
      {users && (
        <div className="stats-row">
          <div className="stat"><div className="stat-value">{users.length}</div><div className="stat-label">Registered users</div></div>
        </div>
      )}
      <p className="muted small">Everyone who has signed in, with Google or with an email and password.</p>
      <input className="search" placeholder="Search by name or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {!users && !error && <p className="muted">Loading…</p>}
      {users && (
        <table className="qtable admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Joined</th>
              <th>Last sign-in</th>
              <th>Signs in with</th>
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
                <td className="muted small">{u.hasPassword ? 'Email + password' : 'Google'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
