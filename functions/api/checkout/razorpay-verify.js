// POST /api/checkout/razorpay-verify {orderId, paymentId, signature, plan} — confirm a payment
// the browser reports, using Razorpay's signature, then grant premium.

import { grantPremium, hmacHex, json, setting, timingSafeEqual } from '../../../server/auth.js'
import pricing from '../../../server/pricing.json'

export async function onRequestPost({ request, env, data }) {
  if (!data.user) return json({ error: 'Sign in first.' }, 401)
  const secret = setting(env, 'RAZORPAY_KEY_SECRET')
  const { orderId, paymentId, signature, plan } = await request.json().catch(() => ({}))
  const p = pricing.plans[plan]
  if (!secret || !orderId || !paymentId || !signature || !p) return json({ error: 'Missing payment details.' }, 400)
  const expected = await hmacHex(secret, `${orderId}|${paymentId}`)
  if (!timingSafeEqual(expected, String(signature))) return json({ error: 'Payment signature did not match.' }, 400)
  const until = await grantPremium(env, data.user.email, p.days, 'razorpay')
  return json({ ok: true, until })
}
