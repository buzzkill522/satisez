// GET  /api/admin/users           — list registered users (admins only)
// POST /api/admin/users {email, access} — switch question-bank access on or off

import { getUser, grantPremium, isAdmin, isPremium, json, putUser } from '../../../server/auth.js'

function requireAdmin(data) {
  if (!data.user) return json({ error: 'Sign in first.' }, 401)
  if (!data.user.admin) return json({ error: 'Admins only.' }, 403)
  return null
}

export async function onRequestGet({ env, data }) {
  const denied = requireAdmin(data)
  if (denied) return denied
  const users = []
  let cursor
  do {
    const page = await env.USERS.list({ prefix: 'user:', cursor })
    const batch = await Promise.all(page.keys.map((k) => env.USERS.get(k.name, 'json')))
    for (const u of batch) if (u) users.push({ ...u, password: undefined, hasPassword: Boolean(u.password), premiumActive: isPremium(u), admin: isAdmin(env, u.email) })
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  users.sort((a, b) => (b.lastLogin || '').localeCompare(a.lastLogin || ''))
  return json({ users })
}

export async function onRequestPost({ request, env, data }) {
  const denied = requireAdmin(data)
  if (denied) return denied
  const { email, access, premium } = await request.json().catch(() => ({}))
  if (typeof email !== 'string') return json({ error: 'Need {email}.' }, 400)
  const user = await getUser(env, email)
  if (!user) return json({ error: 'No such user.' }, 404)
  if (typeof premium === 'boolean') {
    // Admin grant: a year on; off clears the paid period.
    if (premium) await grantPremium(env, email, 366, 'admin')
    else await putUser(env, { ...user, premium: undefined })
  }
  if (typeof access === 'boolean') await putUser(env, { ...(await getUser(env, email)), access })
  return json({ ok: true })
}
