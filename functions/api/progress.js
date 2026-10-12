// /api/progress — the signed-in user's saved progress (see server/progress.js).
//   GET                 → { attempts, items }
//   POST {attempts, items, full?} → saves (merging with what's stored); with full: true it also
//                         returns everything stored, so the browser can pick up other devices.
//   DELETE              → erases it ("Reset everything" on the Progress page).

import { json } from '../../server/auth.js'
import { clean, ensureSchema, load, save, wipe } from '../../server/progress.js'

async function guard(env, data) {
  if (!data.user) return json({ error: 'Sign in to save progress.' }, 401)
  if (!env.DB) return json({ error: 'Progress saving is not set up (no DB binding).' }, 503)
  await ensureSchema(env.DB)
  return null
}

export async function onRequestGet({ env, data }) {
  const denied = await guard(env, data)
  if (denied) return denied
  return json(await load(env.DB, data.user.email))
}

export async function onRequestPost({ request, env, data }) {
  const denied = await guard(env, data)
  if (denied) return denied
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: 'Expected JSON.' }, 400)
  await save(env.DB, data.user.email, clean(body))
  if (body.full) return json({ ok: true, ...(await load(env.DB, data.user.email)) })
  return json({ ok: true })
}

export async function onRequestDelete({ env, data }) {
  const denied = await guard(env, data)
  if (denied) return denied
  await wipe(env.DB, data.user.email)
  return json({ ok: true })
}
