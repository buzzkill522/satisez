// GET /api/referral — the signed-in user's referral code and how it's doing.
// → { code, percent, rewardDays, referrals, earnedDays }

import { getUser, json } from '../../../server/auth.js'
import { codeFor } from '../../../server/referral.js'
import pricing from '../../../server/pricing.json'

export async function onRequestGet({ env, data }) {
  if (!data.user) return json({ error: 'Sign in to get your referral code.' }, 401)
  if (!env.USERS) return json({ error: 'Accounts are not set up.' }, 500)
  const code = await codeFor(env, data.user.email)
  const user = await getUser(env, data.user.email)
  const referrals = user?.referrals?.length ?? 0
  return json({ code, percent: pricing.referral.discountPercent, rewardDays: pricing.referral.rewardDays, referrals, earnedDays: referrals * pricing.referral.rewardDays })
}
