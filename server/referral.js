// Referral codes. Every account gets one short code to share (created the first time it's asked
// for). Someone buying Premium for the first time can enter a friend's code: they get
// pricing.referral.discountPercent off, and once they've paid the code's owner gets
// pricing.referral.rewardDays of Premium.
//
// KV: ref:<CODE> → owner email; the user record keeps refCode, and referrals [{ email, at }].

import { getUser, grantPremium, newUserRecord, putUser } from './auth.js'
import pricing from './pricing.json'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O or 1/I mix-ups
export const normalizeCode = (code) => String(code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)

function randomPart(n) {
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** The account's code, creating it on first use: up to 5 letters of the name + 4 random characters. */
export async function codeFor(env, email) {
  const user = (await getUser(env, email)) ?? newUserRecord(email)
  if (user.refCode) return user.refCode
  const stem = normalizeCode((user.name || email).split(/[\s@]/)[0]).replace(/[0-9]/g, '').slice(0, 5) || 'SAT'
  for (let i = 0; i < 5; i++) {
    const code = `${stem}${randomPart(4)}`
    if (await env.USERS.get(`ref:${code}`)) continue
    await env.USERS.put(`ref:${code}`, user.email)
    await putUser(env, { ...user, refCode: code })
    return code
  }
  throw new Error('Could not create a referral code. Try again.')
}

/**
 * Checks a code for this buyer. Resolves to { ok: true, code, owner, percent } or
 * { ok: false, error } with a message the buyer can read.
 */
export async function checkCode(env, rawCode, buyerEmail) {
  const code = normalizeCode(rawCode)
  if (!code) return { ok: false, error: 'Enter a referral code.' }
  const owner = await env.USERS.get(`ref:${code}`)
  if (!owner) return { ok: false, error: 'That referral code doesn’t exist. Check the spelling.' }
  if (buyerEmail && owner.toLowerCase() === buyerEmail.toLowerCase()) return { ok: false, error: 'You can’t use your own referral code — share it with friends instead.' }
  if (buyerEmail) {
    const buyer = await getUser(env, buyerEmail)
    if (buyer?.payments?.length) return { ok: false, error: 'Referral codes are for a first purchase only.' }
  }
  return { ok: true, code, owner, percent: pricing.referral.discountPercent }
}

/** Price after the referral discount: whole rupees for INR, cents for USD; at least 1. */
export const discounted = (price, percent, currency = 'INR') => {
  const raw = price * (1 - percent / 100)
  return Math.max(1, currency === 'INR' ? Math.round(raw) : Math.round(raw * 100) / 100)
}

/**
 * After a referred payment is confirmed: give the code's owner their reward and note the
 * referral. Keyed by payment ID, so the browser and the webhook can't reward twice.
 */
export async function rewardReferrer(env, { owner, buyer, paymentId }) {
  if (!owner || !buyer || !paymentId || owner.toLowerCase() === buyer.toLowerCase()) return
  const record = await getUser(env, owner)
  if (!record || record.payments?.includes(`referral:${paymentId}`)) return
  await grantPremium(env, owner, pricing.referral.rewardDays, 'referral', `referral:${paymentId}`)
  const fresh = await getUser(env, owner)
  const referrals = [{ email: buyer.toLowerCase(), at: new Date().toISOString() }, ...(fresh.referrals ?? [])].slice(0, 200)
  await putUser(env, { ...fresh, referrals })
}
