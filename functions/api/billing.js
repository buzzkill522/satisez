// GET /api/billing — prices and which checkout is available for this visitor. Never secrets.

import { countryOf, json, setting } from '../../server/auth.js'
import pricing from '../../server/pricing.json'

export function onRequestGet({ request, env }) {
  const country = countryOf(request)
  return json({
    country,
    currency: country === 'IN' ? 'INR' : 'USD',
    pricing,
    razorpay: Boolean(setting(env, 'RAZORPAY_KEY_ID') && setting(env, 'RAZORPAY_KEY_SECRET')),
    razorpayKeyId: setting(env, 'RAZORPAY_KEY_ID') || null,
    paddle: Boolean(setting(env, 'PADDLE_CLIENT_TOKEN') && setting(env, 'PADDLE_PRICE_MONTHLY') && setting(env, 'PADDLE_PRICE_YEARLY')),
    paddleClientToken: setting(env, 'PADDLE_CLIENT_TOKEN') || null,
    paddleEnv: setting(env, 'PADDLE_ENV') || 'production',
    // Optional Paddle discount (set up in Paddle with the same % as pricing.referral) for referral codes.
    paddleReferralDiscount: setting(env, 'PADDLE_REFERRAL_DISCOUNT_ID') || null,
    paddlePrices: { monthly: setting(env, 'PADDLE_PRICE_MONTHLY') || null, yearly: setting(env, 'PADDLE_PRICE_YEARLY') || null },
  })
}
