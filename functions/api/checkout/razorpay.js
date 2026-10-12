// POST /api/checkout/razorpay {plan} — create a Razorpay order for the signed-in user (INR).

import { json, setting } from '../../../server/auth.js'
import pricing from '../../../server/pricing.json'

export async function onRequestPost({ request, env, data }) {
  if (!data.user) return json({ error: 'Sign in first.' }, 401)
  const keyId = setting(env, 'RAZORPAY_KEY_ID'), secret = setting(env, 'RAZORPAY_KEY_SECRET')
  if (!keyId || !secret) return json({ error: 'Razorpay is not set up yet.' }, 500)
  const { plan } = await request.json().catch(() => ({}))
  const p = pricing.plans[plan]
  if (!p) return json({ error: 'Unknown plan.' }, 400)

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { authorization: 'Basic ' + btoa(`${keyId}:${secret}`), 'content-type': 'application/json' },
    body: JSON.stringify({
      amount: p.INR.price * 100, // paise
      currency: 'INR',
      receipt: `satisez-${plan}-${Date.now()}`,
      notes: { email: data.user.email, plan },
    }),
  })
  const order = await res.json().catch(() => ({}))
  if (!res.ok) return json({ error: order?.error?.description || `Razorpay error ${res.status}` }, 502)
  return json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId, email: data.user.email, name: data.user.name })
}
