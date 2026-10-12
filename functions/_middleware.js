// Runs before every request that reaches Functions (see public/_routes.json).
// Resolves the signed-in user once, and keeps the question bank for premium accounts:
// free users get the day's five questions from /api/daily instead.

import { currentUser, emailAuthReady, googleAuthReady, json } from '../server/auth.js'

export async function onRequest(context) {
  const { request, env, next } = context
  const url = new URL(request.url)
  context.data.user = await currentUser(request, env)

  // Only gate once accounts exist; a deployment with no sign-in has no way to pay, so it stays open.
  const accounts = emailAuthReady(env) || googleAuthReady(env)
  if (accounts && url.pathname.startsWith('/data/') && url.pathname !== '/data/index.json') {
    const user = context.data.user
    if (!user) return json({ error: 'Sign in and upgrade to open the full question bank.' }, 401)
    if (!user.premium) return json({ error: 'The full question bank is part of Premium.' }, 403)
    const res = await next()
    const out = new Response(res.body, res)
    out.headers.set('cache-control', 'private, no-cache')
    return out
  }
  return next()
}
