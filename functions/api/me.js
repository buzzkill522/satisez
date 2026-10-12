// GET /api/me — who is signed in (or null). Resolved by the middleware.

import { json, missingConfig } from '../../server/auth.js'

export const onRequestGet = ({ env, data }) =>
  json({ user: data.user ?? null, configured: missingConfig(env).length === 0 })
