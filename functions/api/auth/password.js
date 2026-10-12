// POST /api/auth/password {email, password} — sign in with an email+password account.

import { emailAuthReady, getUser, json, newSessionPayload, putUser, sessionCookie, setting, signSession, verifyPassword } from '../../../server/auth.js'

export async function onRequestPost({ request, env }) {
  if (!emailAuthReady(env)) return json({ error: 'Accounts are not set up on this deployment yet.' }, 500)
  const body = await request.json().catch(() => ({}))
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const user = await getUser(env, email)
  // Same message whether the email or the password is wrong, so the form can't be used to probe accounts.
  const bad = () => json({ error: 'Wrong email or password.' }, 401)
  if (!user) return bad()
  if (!user.password) return json({ error: 'That account signs in with Google. Use the Google button.' }, 401)
  if (!(await verifyPassword(password, user.password))) return bad()
  await putUser(env, { ...user, lastLogin: new Date().toISOString() })
  const token = await signSession(newSessionPayload(user), setting(env, 'SESSION_SECRET'))
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token) })
}
