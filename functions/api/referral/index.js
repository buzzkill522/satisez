// GET  /api/referral        — the signed-in user's referral code and how it's doing.
//                              → { code, percent, rewardDays, referrals, earnedDays, canCustomize }
// POST /api/referral {code} — Premium members choose their own code. → { code } or { error }

import { getUser, json } from '../../../server/auth.js'
import { MAX_CODES, codeFor, setCustomCode } from '../../../server/referral.js'
import pricing from '../../../server/pricing.json'

export async function onRequestGet({ env, data }) {
  if (!data.user) return json({ error: 'Sign in to get your referral code.' }, 401)
  if (!env.USERS) return json({ error: 'Accounts are not set up.' }, 500)
  const code = await codeFor(env, data.user.email)
  const user = await getUser(env, data.user.email)
  const referrals = user?.referrals?.length ?? 0
  const used = new Set([...(user?.refCodes ?? []), code]).size
  return json({
    code,
    percent: pricing.referral.discountPercent,
    rewardDays: pricing.referral.rewardDays,
    referrals,
    earnedDays: referrals * pricing.referral.rewardDays,
    canCustomize: Boolean(data.user.premium),
    codesLeft: Math.max(0, MAX_CODES - used),
  })
}

export async function onRequestPost({ request, env, data }) {
  if (!data.user) return json({ error: 'Sign in first.' }, 401)
  if (!data.user.premium) return json({ error: 'Choosing your own code is a Premium feature.' }, 403)
  if (!env.USERS) return json({ error: 'Accounts are not set up.' }, 500)
  const { code } = await request.json().catch(() => ({}))
  const r = await setCustomCode(env, data.user.email, code)
  if (!r.ok) return json({ error: r.error }, 400)
  return json({ code: r.code })
}
