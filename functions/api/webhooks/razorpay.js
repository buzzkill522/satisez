// POST /api/webhooks/razorpay — Razorpay's server-to-server confirmation (backup for the
// browser verify step, e.g. if the user closed the tab). Event: payment.captured.

import { grantPremium, hmacHex, json, setting, timingSafeEqual } from '../../../server/auth.js'
import pricing from '../../../server/pricing.json'

export async function onRequestPost({ request, env }) {
  const secret = setting(env, 'RAZORPAY_WEBHOOK_SECRET')
  if (!secret) return json({ error: 'RAZORPAY_WEBHOOK_SECRET is not set.' }, 500)
  const raw = await request.text()
  const expected = await hmacHex(secret, raw)
  if (!timingSafeEqual(expected, request.headers.get('x-razorpay-signature') || '')) return json({ error: 'Bad signature.' }, 401)
  const event = JSON.parse(raw)
  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity ?? {}
    const notes = payment.notes ?? {}
    const p = pricing.plans[notes.plan]
    // Keyed by payment ID: if the browser already confirmed this payment, nothing changes.
    if (notes.email && p && payment.id) await grantPremium(env, notes.email, p.days, 'razorpay', payment.id)
  }
  return json({ ok: true })
}
