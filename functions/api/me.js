// GET /api/me — who is signed in (or null). Resolved by the middleware.

import { json, missingConfig } from '../../server/auth.js'

// `missing` lists setting *names* only (never values), so setup problems are easy to spot.
export const onRequestGet = ({ env, data }) => {
  const missing = missingConfig(env)
  return json({ user: data.user ?? null, configured: missing.length === 0, missing, ai: Boolean(env.AI) })
}
