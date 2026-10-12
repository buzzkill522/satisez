// GET /api/daily — today's five free questions, the same five for everyone (chosen from the
// date), so free users can retry them but can't pull different ones. Cached per day in KV.

import { json } from '../../server/auth.js'
import { pickDaily } from '../../server/daily.js'

export async function onRequestGet({ request, env }) {
  const date = new Date().toISOString().slice(0, 10)
  const key = `daily:${date}`
  const cached = env.USERS ? await env.USERS.get(key, 'json') : null
  if (cached) return json({ date, questions: cached }, 200, { 'cache-control': 'public, max-age=300' })

  const origin = new URL(request.url).origin
  const load = async (path) => {
    const res = await env.ASSETS.fetch(new Request(`${origin}/data/${path}`))
    if (!res.ok) throw new Error(`missing data/${path}`)
    return res.json()
  }
  try {
    const questions = await pickDaily(date, load)
    if (env.USERS) await env.USERS.put(key, JSON.stringify(questions), { expirationTtl: 2 * 86400 })
    return json({ date, questions }, 200, { 'cache-control': 'public, max-age=300' })
  } catch (err) {
    return json({ error: `Could not build today's questions: ${err.message}` }, 500)
  }
}
