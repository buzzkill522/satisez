// GET /api/auth/login — start "Sign in with Google".

import { cookie, json, missingConfig, setting } from '../../../server/auth.js'

export async function onRequestGet({ request, env }) {
  const missing = missingConfig(env)
  if (missing.length) return json({ error: `Sign-in is not set up yet. Missing: ${missing.join(', ')}` }, 500)

  const url = new URL(request.url)
  const origin = url.origin
  const state = crypto.randomUUID()
  // Where to land afterwards (a hash route like /upgrade); only same-site paths are accepted.
  const next = url.searchParams.get('next') || '/'
  const safeNext = /^\/[^/\\]/.test(next) || next === '/' ? next : '/'
  // Referral code from a share link, credited if this turns out to be a new account.
  const ref = (url.searchParams.get('ref') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
  const params = new URLSearchParams({
    client_id: setting(env, 'GOOGLE_CLIENT_ID'),
    redirect_uri: `${origin}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return new Response(null, {
    status: 302,
    headers: {
      location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      // Checked in the callback to make sure the response belongs to this browser's sign-in.
      'set-cookie': cookie('oauth_state', `${state}|${safeNext}|${ref}`, { maxAge: 600, path: '/api/auth' }),
    },
  })
}
