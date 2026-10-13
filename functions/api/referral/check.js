// POST /api/referral/check {code} — is this code valid for the signed-in buyer? (For the price
// preview; the order endpoint checks again.) → { ok, code, percent } or { error }

import { json } from '../../../server/auth.js'
import { checkCode } from '../../../server/referral.js'

export async function onRequestPost({ request, env, data }) {
  if (!env.USERS) return json({ error: 'Accounts are not set up.' }, 500)
  const { code } = await request.json().catch(() => ({}))
  const r = await checkCode(env, code, data.user?.email)
  if (!r.ok) return json({ error: r.error }, 400)
  return json({ ok: true, code: r.code, percent: r.percent })
}
