// POST /api/checkout/razorpay-verify {orderId, paymentId, signature}
// Confirms a payment the browser reports and grants Premium.
//  1. HMAC-SHA256(orderId + "|" + paymentId, RAZORPAY_KEY_SECRET) must equal the signature.
//  2. The plan and account come from the order's notes on Razorpay (set when we created it), not
//     from the browser, so a cheaper order can't be passed off as a longer plan.
//  3. Granting is keyed by payment ID, so a retry or the webhook can't count it twice.

import { grantPremium, hmacHex, json, timingSafeEqual } from '../../../server/auth.js'
import { razorpayApi, razorpayError, razorpayKeys } from '../../../server/razorpay.js'
import pricing from '../../../server/pricing.json'

export async function onRequestPost({ request, env, data }) {
  if (!data.user) return json({ error: 'Sign in first.' }, 401)
  const keys = razorpayKeys(env)
  if (!keys) return json({ error: 'Razorpay is not set up yet.' }, 500)
  const { orderId, paymentId, signature } = await request.json().catch(() => ({}))
  if (!orderId || !paymentId || !signature) return json({ error: 'Missing payment details.' }, 400)

  const expected = await hmacHex(keys.secret, `${orderId}|${paymentId}`)
  if (!timingSafeEqual(expected, String(signature))) return json({ error: 'Payment signature did not match.' }, 400)

  const r = await razorpayApi(env, 'GET', `/orders/${encodeURIComponent(orderId)}`)
  if (!r.ok) {
    // The signature is genuine, so the payment went through; the webhook will still grant it.
    return json({ error: `Your payment went through, but we couldn't confirm it just now (${razorpayError(r)}). Premium will switch on shortly — refresh in a minute.` }, r.status === 401 ? 401 : 500)
  }
  const { plan, email } = r.data.notes ?? {}
  const p = pricing.plans[plan]
  if (!p || !email) return json({ error: 'This order is not a SATisEZ plan.' }, 400)
  if (email.toLowerCase() !== data.user.email.toLowerCase()) return json({ error: 'This payment belongs to a different account.' }, 403)

  const until = await grantPremium(env, email, p.days, 'razorpay', paymentId)
  return json({ ok: true, until, plan })
}
