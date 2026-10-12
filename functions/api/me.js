// GET /api/me — who is signed in (or null). Resolved by the middleware.

import { countryOf, emailAuthReady, googleAuthReady, json, missingConfig } from '../../server/auth.js'

// `missing` lists setting *names* only (never values), so setup problems are easy to spot.
export const onRequestGet = ({ request, env, data }) => {
  const missing = missingConfig(env)
  return json({
    user: data.user ?? null,
    configured: emailAuthReady(env) || googleAuthReady(env),
    google: googleAuthReady(env),
    email: emailAuthReady(env),
    missing,
    ai: Boolean(env.AI),
    // Whether progress is saved to accounts (D1 binding `DB`).
    sync: Boolean(env.DB),
    country: countryOf(request),
  })
}
