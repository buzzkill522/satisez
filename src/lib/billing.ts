// Prices and checkout. Razorpay handles India (INR, UPI/cards); Paddle handles everyone else (USD).
// Both load their checkout script only when the user actually clicks Pay.

import type { User } from './auth'

export type Plan = 'monthly' | 'yearly'
export type Currency = 'INR' | 'USD'

export interface Pricing {
  launchDiscount: string
  plans: Record<Plan, { days: number } & Record<Currency, { list: number; price: number }>>
  referral: { discountPercent: number; rewardDays: number }
}

export interface Billing {
  country: string
  currency: Currency
  pricing: Pricing
  razorpay: boolean
  razorpayKeyId: string | null
  paddle: boolean
  paddleClientToken: string | null
  paddleEnv: string
  paddlePrices: Record<Plan, string | null>
  /** Paddle discount used for referral codes; without it, codes only apply to ₹ payments. */
  paddleReferralDiscount: string | null
}

/** A referral code that checked out, and the % it takes off. */
export interface Referral {
  code: string
  percent: number
}

/** Same rounding as the server (server/referral.js). */
export const discounted = (price: number, percent: number, currency: Currency = 'INR') => {
  const raw = price * (1 - percent / 100)
  return Math.max(1, currency === 'INR' ? Math.round(raw) : Math.round(raw * 100) / 100)
}

const REF_KEY = 'satisez.ref'
/** A code from a share link (#/upgrade?ref=CODE) is remembered until it's used. */
export function rememberedCode(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('ref')
    if (fromUrl) localStorage.setItem(REF_KEY, fromUrl.toUpperCase())
    return localStorage.getItem(REF_KEY) ?? ''
  } catch {
    return ''
  }
}
export function forgetCode() {
  try {
    localStorage.removeItem(REF_KEY)
  } catch {
    /* storage unavailable */
  }
}

export async function checkReferral(code: string): Promise<Referral> {
  return postJson<Referral>('referral/check', { code })
}

export interface MyReferral {
  code: string
  percent: number
  rewardDays: number
  referrals: number
  earnedDays: number
  /** Premium members can choose their own code. */
  canCustomize: boolean
  codesLeft: number
}
export async function saveMyCode(code: string): Promise<{ code: string }> {
  return postJson<{ code: string }>('referral', { code })
}
export async function loadMyReferral(): Promise<MyReferral> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/referral`, { cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`)
  return data
}

let cached: Promise<Billing> | null = null
export function loadBilling(): Promise<Billing> {
  cached ??= fetch(`${import.meta.env.BASE_URL}api/billing`, { cache: 'no-store' }).then(async (res) => {
    if (!res.ok) throw new Error(`Could not load prices (${res.status}).`)
    return (await res.json()) as Billing
  })
  return cached
}

export const SYMBOL: Record<Currency, string> = { INR: '₹', USD: '$' }
export const money = (n: number, c: Currency) => `${SYMBOL[c]}${n.toLocaleString(c === 'INR' ? 'en-IN' : 'en-US')}`
export const percentOff = (list: number, price: number) => Math.round((100 * (list - price)) / list)

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load the payment form. Check your connection.'))
    document.head.appendChild(s)
  })
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`)
  return data
}

/* Razorpay's checkout.js and Paddle.js attach themselves to window. */
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void }
    Paddle?: {
      Environment: { set: (env: string) => void }
      Initialize: (opts: Record<string, unknown>) => void
      Checkout: { open: (opts: Record<string, unknown>) => void }
    }
  }
}

/**
 * Runs a checkout and resolves once the payment is confirmed (Razorpay) or the overlay reports
 * completion (Paddle; premium is granted by Paddle's webhook a moment later). Rejects with a
 * readable message if the user closes the form or something fails.
 */
export async function startCheckout(plan: Plan, currency: Currency, billing: Billing, user: User, referral?: Referral | null): Promise<void> {
  if (currency === 'INR') {
    if (!billing.razorpay) throw new Error('Card and UPI payments in rupees are not switched on yet.')
    await loadScript('https://checkout.razorpay.com/v1/checkout.js')
    const order = await postJson<{ orderId: string; amount: number; currency: string; keyId: string; email: string; name: string }>('checkout/razorpay', { plan, code: referral?.code })
    await new Promise<void>((resolve, reject) => {
      const rzp = new window.Razorpay!({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'SATisEZ',
        description: `Premium — ${plan}`,
        order_id: order.orderId,
        prefill: { email: order.email, name: order.name },
        notes: { email: order.email, plan },
        theme: { color: '#c2410c' },
        modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
        handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          postJson('checkout/razorpay-verify', { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature })
            .then(() => resolve())
            .catch(reject)
        },
      })
      rzp.on('payment.failed', (r: unknown) => {
        const msg = (r as { error?: { description?: string } })?.error?.description
        reject(new Error(msg || 'Payment failed.'))
      })
      rzp.open()
    })
    return
  }

  if (!billing.paddle || !billing.paddlePrices[plan]) throw new Error('Card payments in dollars are not switched on yet.')
  await loadScript('https://cdn.paddle.com/paddle/v2/paddle.js')
  const Paddle = window.Paddle!
  if (billing.paddleEnv === 'sandbox') Paddle.Environment.set('sandbox')
  await new Promise<void>((resolve, reject) => {
    Paddle.Initialize({
      token: billing.paddleClientToken,
      eventCallback: (ev: { name?: string }) => {
        if (ev.name === 'checkout.completed') resolve()
        if (ev.name === 'checkout.closed') reject(new Error('Payment cancelled.'))
        if (ev.name === 'checkout.error') reject(new Error('Payment failed.'))
      },
    })
    Paddle.Checkout.open({
      items: [{ priceId: billing.paddlePrices[plan], quantity: 1 }],
      customer: { email: user.email },
      ...(referral && billing.paddleReferralDiscount ? { discountId: billing.paddleReferralDiscount } : {}),
      customData: { email: user.email, plan, ...(referral && billing.paddleReferralDiscount ? { ref: referral.code } : {}) },
      settings: { displayMode: 'overlay', theme: 'light' },
    })
  })
}
