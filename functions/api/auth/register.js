// POST /api/auth/register {email, password, name} — create an email+password account and sign in.

import { recordSignup } from '../../../server/referral.js'
import { emailAuthReady, getUser, hashPassword, isAdmin, json, newSessionPayload, putUser, sessionCookie, setting, signSession, validEmail } from '../../../server/auth.js'

export async function onRequestPost({ request, env }) {
  if (!emailAuthReady(env)) return json({ error: 'Accounts are not set up on this deployment yet.' }, 500)
  const body = await request.json().catch(() => ({}))
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const name = String(body.name ?? '').trim().slice(0, 80)
  if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400)
  if (password.length < 8) return json({ error: 'Use a password of at least 8 characters.' }, 400)

  const existing = await getUser(env, email)
  if (existing?.blocked) return json({ error: 'This account has been blocked. Contact the site owner if you think this is a mistake.' }, 403)
  if (existing?.password) return json({ error: 'An account with that email already exists. Sign in instead.' }, 409)
  const now = new Date().toISOString()
  const user = {
    ...existing,
    email,
    name: name || existing?.name || email.split('@')[0],
    picture: existing?.picture || '',
    createdAt: existing?.createdAt || now,
    lastLogin: now,
    access: existing?.access ?? isAdmin(env, email),
    password: await hashPassword(password),
  }
  await putUser(env, user)
  // First sign-in for this email, arriving through a referral link: credit the referrer.
  if (!existing?.lastLogin && body.ref) await recordSignup(env, body.ref, email)
  const token = await signSession(newSessionPayload(user), setting(env, 'SESSION_SECRET'))
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token) })
}
