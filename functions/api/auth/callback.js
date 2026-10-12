// GET /api/auth/callback — Google redirects here after the user picks an account.

import { cookie, getCookie, getUser, isAdmin, json, newSessionPayload, putUser, sessionCookie, signSession } from '../../../server/auth.js'

function decodeJwtPayload(jwt) {
  const part = jwt.split('.')[1]
  return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
}

const backHome = (headers) => new Response(null, { status: 302, headers: { location: '/', ...headers } })

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const clearState = cookie('oauth_state', '', { maxAge: 0, path: '/api/auth' })

  if (url.searchParams.get('error')) return backHome({ 'set-cookie': clearState }) // user cancelled
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state || state !== getCookie(request, 'oauth_state')) {
    return json({ error: 'Sign-in expired or was tampered with. Go back and try again.' }, 400)
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/callback`,
      grant_type: 'authorization_code',
    }),
  })
  const tokens = await tokenRes.json().catch(() => ({}))
  if (!tokenRes.ok || !tokens.id_token) {
    return json({ error: `Google sign-in failed: ${tokens.error_description || tokens.error || tokenRes.status}` }, 502)
  }

  // The ID token came straight from Google's token endpoint over TLS, using our client secret,
  // so its contents can be trusted without re-verifying the signature (per Google's docs).
  const profile = decodeJwtPayload(tokens.id_token)
  if (profile.aud !== env.GOOGLE_CLIENT_ID || !profile.email || !profile.email_verified) {
    return json({ error: 'Google did not return a verified email address.' }, 403)
  }

  const email = profile.email.toLowerCase()
  const existing = await getUser(env, email)
  const now = new Date().toISOString()
  const user = {
    email,
    name: profile.name || email,
    picture: profile.picture || '',
    createdAt: existing?.createdAt || now,
    lastLogin: now,
    access: existing?.access ?? isAdmin(env, email),
  }
  await putUser(env, user)

  const token = await signSession(newSessionPayload(user), env.SESSION_SECRET)
  const headers = new Headers({ location: '/' })
  headers.append('set-cookie', sessionCookie(token))
  headers.append('set-cookie', clearState)
  return new Response(null, { status: 302, headers })
}
