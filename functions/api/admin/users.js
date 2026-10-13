// Admin API (admins only).
//
// GET  /api/admin/users              → { users, summary, me, sync }
// GET  /api/admin/users?email=x      → { user, progress } — one account in detail
// GET  /api/admin/users?log=1        → { log } — recent admin actions
// POST /api/admin/users { action, email, ... }
//   premium        { days } | { until: ISO date } | { lifetime: true }   give or extend Premium
//   premium-remove                                                      end Premium now
//   admin          { value: boolean }   make or remove an admin (owners only)
//   block          { value: boolean }   block or unblock sign-in
//   password       { password }         set a new password (≥ 8 characters)
//   name           { name }             rename
//   prank          { value: boolean }   joke screen until their first referral sign-up
//   create         { name?, days?, lifetime? }  add an account by email (optionally with Premium)
//   delete                              remove the account and its saved progress
//
// Owners (ADMIN_EMAILS) can't be demoted, blocked or deleted from here, and nobody can block,
// demote or delete themselves.

import { LIFETIME_UNTIL, getUser, grantPremium, hashPassword, isOwner, isPremium, json, newUserRecord, putUser, setPremiumUntil, validEmail } from '../../../server/auth.js'
import { logAction, readLog } from '../../../server/audit.js'
import { answeredCounts, ensureSchema, wipe } from '../../../server/progress.js'

function requireAdmin(data) {
  if (!data.user) return json({ error: 'Sign in first.' }, 401)
  if (!data.user.admin) return json({ error: 'Admins only.' }, 403)
  return null
}

const DAY = 86400 * 1000

/** What the admin page shows for an account: never the password hash. */
function view(env, u) {
  const owner = isOwner(env, u.email)
  return {
    email: u.email,
    name: u.name,
    picture: u.picture,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin,
    hasPassword: Boolean(u.password),
    owner,
    admin: owner || Boolean(u.admin),
    blocked: Boolean(u.blocked) && !owner,
    premium: u.premium ?? null,
    premiumActive: owner || isPremium(u),
    lifetime: u.premium?.until === LIFETIME_UNTIL,
    prank: Boolean(u.prank),
    signups: u.signups?.length ?? 0,
    paidReferrals: u.referrals?.length ?? 0,
  }
}

async function listUsers(env) {
  const out = []
  let cursor
  do {
    const page = await env.USERS.list({ prefix: 'user:', cursor })
    const batch = await Promise.all(page.keys.map((k) => env.USERS.get(k.name, 'json')))
    for (const u of batch) if (u?.email) out.push(view(env, u))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return out
}

export async function onRequestGet({ request, env, data }) {
  const denied = requireAdmin(data)
  if (denied) return denied
  const url = new URL(request.url)

  if (url.searchParams.get('log')) return json({ log: await readLog(env) })

  const one = url.searchParams.get('email')
  if (one) {
    const record = await getUser(env, one)
    if (!record) return json({ error: 'No such user.' }, 404)
    return json({ user: view(env, record), progress: env.DB ? await progressOf(env.DB, record.email) : null })
  }

  const users = await listUsers(env)
  users.sort((a, b) => (b.lastLogin || '').localeCompare(a.lastLogin || ''))
  let totalAnswered = 0
  if (env.DB) {
    await ensureSchema(env.DB)
    const counts = await answeredCounts(env.DB)
    for (const u of users) {
      Object.assign(u, counts.get(u.email) ?? { answered: 0, lastActive: null })
      totalAnswered += u.answered
    }
  }
  const now = Date.now()
  const within = (iso, days) => Boolean(iso) && now - Date.parse(iso) < days * DAY
  const summary = {
    users: users.length,
    premium: users.filter((u) => u.premiumActive && !u.owner).length,
    admins: users.filter((u) => u.admin).length,
    blocked: users.filter((u) => u.blocked).length,
    new7: users.filter((u) => within(u.createdAt, 7)).length,
    active7: users.filter((u) => within(u.lastLogin, 7) || (u.lastActive && now - u.lastActive < 7 * DAY)).length,
    answered: totalAnswered,
  }
  return json({ users, summary, me: { email: data.user.email, owner: Boolean(data.user.owner) }, sync: Boolean(env.DB) })
}

/** A summary of one account's saved progress. */
async function progressOf(db, email) {
  await ensureSchema(db)
  const [totals, recent, guide] = await db.batch([
    db.prepare('SELECT COUNT(*) AS attempts, SUM(correct) AS correct, COUNT(DISTINCT qid) AS answered, MAX(at) AS last FROM attempts WHERE email = ?1').bind(email),
    db.prepare('SELECT qid, correct, seconds, at FROM attempts WHERE email = ?1 ORDER BY at DESC LIMIT 15').bind(email),
    db.prepare("SELECT key, value FROM items WHERE email = ?1 AND key LIKE 'guide:%' AND value IS NOT NULL").bind(email),
  ])
  const t = totals.results[0] ?? {}
  const guidePages = guide.results.map((r) => {
    let v = {}
    try {
      v = JSON.parse(r.value)
    } catch {
      /* ignore */
    }
    return { slug: r.key.slice(6), done: Boolean(v.done), opened: v.opened ?? null }
  })
  return {
    attempts: t.attempts ?? 0,
    correct: t.correct ?? 0,
    answered: t.answered ?? 0,
    lastActive: t.last ?? null,
    recent: recent.results.map((r) => ({ ...r, correct: Boolean(r.correct) })),
    guide: guidePages,
  }
}

export async function onRequestPost({ request, env, data }) {
  const denied = requireAdmin(data)
  if (denied) return denied
  const body = await request.json().catch(() => ({}))
  const action = String(body.action ?? '')
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400)

  const me = data.user
  const self = email === me.email.toLowerCase()
  const owner = isOwner(env, email)
  const log = (detail) => logAction(env, { by: me.email, action, target: email, detail })
  const premiumFrom = async () => {
    if (body.lifetime) return setPremiumUntil(env, email, LIFETIME_UNTIL, `admin:${me.email}`)
    if (body.until) {
      const t = Date.parse(body.until)
      if (!Number.isFinite(t) || t <= Date.now()) throw new Error('Pick a date in the future.')
      return setPremiumUntil(env, email, new Date(t).toISOString(), `admin:${me.email}`)
    }
    const days = Math.round(Number(body.days))
    if (!(days >= 1 && days <= 3660)) throw new Error('Pick how long Premium should last.')
    return grantPremium(env, email, days, `admin:${me.email}`)
  }

  try {
    if (action === 'create') {
      if (await getUser(env, email)) return json({ error: 'That account already exists — open it from the list.' }, 409)
      await putUser(env, newUserRecord(email, String(body.name ?? '').trim().slice(0, 80)))
      let until = null
      if (body.lifetime || body.days || body.until) until = await premiumFrom()
      await log(until ? `with Premium until ${until.slice(0, 10)}` : '')
      return json({ ok: true })
    }

    const user = await getUser(env, email)
    if (!user) return json({ error: 'No such user.' }, 404)

    switch (action) {
      case 'premium': {
        const until = await premiumFrom()
        await log(body.lifetime ? 'lifetime' : `until ${until.slice(0, 10)}`)
        return json({ ok: true, until })
      }
      case 'premium-remove':
        await putUser(env, { ...user, premium: undefined })
        await log('')
        return json({ ok: true })
      case 'admin': {
        if (!me.owner) return json({ error: 'Only the site owners (ADMIN_EMAILS) can add or remove admins.' }, 403)
        if (owner) return json({ error: 'Owners are set in ADMIN_EMAILS in Cloudflare and can’t be changed here.' }, 400)
        if (self) return json({ error: 'You can’t change your own admin role.' }, 400)
        await putUser(env, { ...user, admin: Boolean(body.value) || undefined })
        await log(body.value ? 'made admin' : 'removed admin')
        return json({ ok: true })
      }
      case 'block': {
        if (owner || self) return json({ error: owner ? 'Owners can’t be blocked.' : 'You can’t block yourself.' }, 400)
        if (user.admin && !me.owner) return json({ error: 'Only owners can block another admin.' }, 403)
        await putUser(env, { ...user, blocked: Boolean(body.value) || undefined })
        await log(body.value ? 'blocked' : 'unblocked')
        return json({ ok: true })
      }
      case 'password': {
        const password = String(body.password ?? '')
        if (password.length < 8) return json({ error: 'Use at least 8 characters.' }, 400)
        if (owner && !self) return json({ error: 'Owners change their own password.' }, 400)
        await putUser(env, { ...user, password: await hashPassword(password) })
        await log('set a new password')
        return json({ ok: true })
      }
      case 'prank': {
        if (owner || self) return json({ error: owner ? 'Not on owners.' : 'Not on yourself.' }, 400)
        await putUser(env, { ...user, prank: Boolean(body.value) || undefined })
        await log(body.value ? 'turned on the idiot screen' : 'turned off the idiot screen')
        return json({ ok: true })
      }
      case 'name': {
        const name = String(body.name ?? '').trim().slice(0, 80)
        if (!name) return json({ error: 'Enter a name.' }, 400)
        await putUser(env, { ...user, name })
        await log(`renamed to ${name}`)
        return json({ ok: true })
      }
      case 'delete': {
        if (owner || self) return json({ error: owner ? 'Owners can’t be deleted.' : 'You can’t delete yourself.' }, 400)
        if (user.admin && !me.owner) return json({ error: 'Only owners can delete another admin.' }, 403)
        await env.USERS.delete(`user:${email}`)
        if (env.DB) {
          await ensureSchema(env.DB)
          await wipe(env.DB, email)
        }
        await log('deleted account and progress')
        return json({ ok: true })
      }
      default:
        return json({ error: 'Unknown action.' }, 400)
    }
  } catch (err) {
    return json({ error: err.message || 'Something went wrong.' }, 400)
  }
}
