// POST /api/webhooks/paddle — Paddle's confirmation. Event: transaction.completed.
// Signature header: "ts=<unix>;h1=<hex>", signed payload "<ts>:<raw body>".

import { grantPremium, hmacHex, json, setting, timingSafeEqual } from '../../../server/auth.js'
import { normalizeCode, rewardReferrer } from '../../../server/referral.js'
import pricing from '../../../server/pricing.json'

export async function onRequestPost({ request, env }) {
  const secret = setting(env, 'PADDLE_WEBHOOK_SECRET')
  if (!secret) return json({ error: 'PADDLE_WEBHOOK_SECRET is not set.' }, 500)
  const raw = await request.text()
  const parts = Object.fromEntries((request.headers.get('paddle-signature') || '').split(';').map((kv) => kv.split('=')))
  if (!parts.ts || !parts.h1) return json({ error: 'Missing signature.' }, 401)
  const expected = await hmacHex(secret, `${parts.ts}:${raw}`)
  if (!timingSafeEqual(expected, parts.h1)) return json({ error: 'Bad signature.' }, 401)
  const event = JSON.parse(raw)
  if (event.event_type === 'transaction.completed') {
    const custom = event.data?.custom_data ?? {}
    const p = pricing.plans[custom.plan]
    const txn = event.data?.id
    // Keyed by transaction ID, so a redelivered webhook can't extend Premium twice.
    if (custom.email && p) {
      await grantPremium(env, custom.email, p.days, 'paddle', txn ? `paddle:${txn}` : undefined)
      // The code's owner is looked up here, not taken from the browser.
      const code = normalizeCode(custom.ref)
      const owner = code ? await env.USERS.get(`ref:${code}`) : null
      if (owner && txn) await rewardReferrer(env, { owner, buyer: custom.email, paymentId: `paddle:${txn}` })
    }
  }
  return json({ ok: true })
}
