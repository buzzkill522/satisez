// POST /api/checkout/razorpay {plan, code?} — create a Razorpay order for the signed-in user (INR).
// The amount comes from server/pricing.json, never from the browser.
// → { orderId, amount, currency, keyId, email, name }

import { json } from '../../../server/auth.js'
import { MIN_AMOUNT_PAISE, razorpayApi, razorpayError, razorpayKeys } from '../../../server/razorpay.js'
import { checkCode, discounted } from '../../../server/referral.js'
import pricing from '../../../server/pricing.json'

export async function onRequestPost({ request, env, data }) {
  if (!data.user) return json({ error: 'Sign in first.' }, 401)
  const keys = razorpayKeys(env)
  if (!keys) return json({ error: 'Razorpay is not set up yet.' }, 500)
  const { plan, code } = await request.json().catch(() => ({}))
  const p = pricing.plans[plan]
  if (!p) return json({ error: 'Unknown plan.' }, 400)

  // A referral code (optional) takes a percentage off a first purchase.
  let ref = null
  if (code) {
    ref = await checkCode(env, code, data.user.email)
    if (!ref.ok) return json({ error: ref.error }, 400)
  }
  const rupees = ref ? discounted(p.INR.price, ref.percent) : p.INR.price
  const amount = Math.round(rupees * 100) // paise
  if (!(amount >= MIN_AMOUNT_PAISE)) return json({ error: `The amount must be at least ${MIN_AMOUNT_PAISE} paise.` }, 400)

  const r = await razorpayApi(env, 'POST', '/orders', {
    amount,
    currency: 'INR',
    receipt: `satisez-${plan}-${Date.now()}`.slice(0, 40), // Razorpay allows 40 characters
    notes: { email: data.user.email, plan, ...(ref ? { ref: ref.code, referrer: ref.owner } : {}) },
  })
  if (!r.ok) return json({ error: razorpayError(r) }, r.status === 401 ? 401 : 500)
  return json({ orderId: r.data.id, amount: r.data.amount, currency: r.data.currency, keyId: keys.keyId, email: data.user.email, name: data.user.name })
}
