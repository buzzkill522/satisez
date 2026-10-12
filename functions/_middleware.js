// Runs before every request that reaches Functions (see public/_routes.json).
// Resolves the signed-in user once; signing in is optional, so nothing is gated here.

import { currentUser } from '../server/auth.js'

export async function onRequest(context) {
  context.data.user = await currentUser(context.request, context.env)
  return context.next()
}
