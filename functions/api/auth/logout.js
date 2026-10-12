// POST /api/auth/logout — clear the session cookie.

import { clearSessionCookie, json } from '../../../server/auth.js'

export const onRequestPost = () => json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() })
