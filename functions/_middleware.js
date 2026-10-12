// Runs before every request that reaches Functions (see public/_routes.json).
// Resolves the signed-in user once, and guards the College Board question files: they are only
// served to admins and to users an admin has given access to.

import { currentUser, json } from '../server/auth.js'

export async function onRequest(context) {
  const { request, env, next } = context
  const url = new URL(request.url)
  context.data.user = await currentUser(request, env)

  if (url.pathname.startsWith('/data/')) {
    const user = context.data.user
    if (!user) return json({ error: 'Sign in to load questions.' }, 401)
    if (!user.access) return json({ error: 'Your account does not have access to the question bank yet.' }, 403)
    const res = await next()
    // Never let a shared cache keep a copy of gated content.
    const out = new Response(res.body, res)
    out.headers.set('cache-control', 'private, no-cache')
    return out
  }
  return next()
}
