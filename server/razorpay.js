// Razorpay helpers for the Pages Functions. Uses Razorpay's REST API with fetch: the `razorpay`
// npm SDK is built for Node's http stack and doesn't run on Cloudflare Workers.
//
// Settings (Cloudflare → Pages project → Settings → Variables and secrets; locally .dev.vars):
//   RAZORPAY_KEY_ID      — rzp_test_… or rzp_live_… (public; sent to the checkout modal)
//   RAZORPAY_KEY_SECRET  — Secret. Server only, never sent to the browser.
//   RAZORPAY_WEBHOOK_SECRET (optional) — Secret, for /api/webhooks/razorpay

import { setting } from './auth.js'

export const MIN_AMOUNT_PAISE = 100
const API = 'https://api.razorpay.com/v1'

export function razorpayKeys(env) {
  const keyId = setting(env, 'RAZORPAY_KEY_ID')
  const secret = setting(env, 'RAZORPAY_KEY_SECRET')
  return keyId && secret ? { keyId, secret } : null
}

/** Calls the Razorpay API. Resolves to { ok, status, data }. */
export async function razorpayApi(env, method, path, body) {
  const keys = razorpayKeys(env)
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { authorization: 'Basic ' + btoa(`${keys.keyId}:${keys.secret}`), 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 503, data: { error: { description: 'Could not reach Razorpay. Try again in a moment.' } } }
  }
}

/** A readable message for a failed Razorpay call. */
export const razorpayError = (r) =>
  r.status === 401 ? 'Razorpay rejected the API keys. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' : r.data?.error?.description || `Razorpay error ${r.status}.`
