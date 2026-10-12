// Shared auth helpers for the Pages Functions (imported, not a route).
//
// Sessions are a signed cookie (HMAC-SHA256 with SESSION_SECRET), so no database lookup is needed
// to know who is signed in. Users and their access flag live in the USERS KV namespace:
//   user:<email> → { email, name, picture, createdAt, lastLogin, access }
//
// Environment (Pages project → Settings → Variables and secrets / Bindings):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  — Google OAuth client
//   SESSION_SECRET                          — long random string for signing cookies
//   ADMIN_EMAILS                            — comma-separated admin emails
//   USERS                                   — KV namespace binding

export const SESSION_COOKIE = 'sid'
const SESSION_DAYS = 30

const enc = new TextEncoder()
const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signSession(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body))
  return `${body}.${b64url(sig)}`
}

export async function verifySession(token, secret) {
  if (!token || !secret) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(sig), enc.encode(body))
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)))
    return payload.exp > Date.now() ? payload : null
  } catch {
    return null
  }
}

export function getCookie(request, name) {
  const header = request.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

export function cookie(name, value, { maxAge, path = '/' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'Secure', 'SameSite=Lax']
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`)
  return parts.join('; ')
}

export const sessionCookie = (token) => cookie(SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 86400 })
export const clearSessionCookie = () => cookie(SESSION_COOKIE, '', { maxAge: 0 })
export const newSessionPayload = (user) => ({
  email: user.email,
  name: user.name,
  picture: user.picture,
  exp: Date.now() + SESSION_DAYS * 86400 * 1000,
})

export function isAdmin(env, email) {
  return (env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes((email || '').toLowerCase())
}

export async function getUser(env, email) {
  if (!env.USERS || !email) return null
  return env.USERS.get(`user:${email.toLowerCase()}`, 'json')
}

export async function putUser(env, user) {
  await env.USERS.put(`user:${user.email.toLowerCase()}`, JSON.stringify(user))
}

/** Who is making this request, with role and access resolved. Null when signed out. */
export async function currentUser(request, env) {
  const session = await verifySession(getCookie(request, SESSION_COOKIE), env.SESSION_SECRET)
  if (!session) return null
  const admin = isAdmin(env, session.email)
  const record = admin ? null : await getUser(env, session.email)
  return {
    email: session.email,
    name: session.name,
    picture: session.picture,
    admin,
    // Admins always have access; everyone else needs it switched on from the Admin page.
    access: admin || Boolean(record?.access),
  }
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store', ...headers },
  })

/** Which required settings are missing, so setup mistakes produce a clear message. */
export function missingConfig(env) {
  return ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'SESSION_SECRET', 'ADMIN_EMAILS', 'USERS'].filter((k) => !env[k])
}
