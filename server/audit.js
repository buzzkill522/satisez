// A short log of admin actions, newest first, kept in one KV key (admin actions are rare, so this
// stays well inside KV's free write allowance).

const KEY = 'audit:log'
const KEEP = 300

export async function logAction(env, entry) {
  if (!env.USERS) return
  const log = (await env.USERS.get(KEY, 'json')) ?? []
  log.unshift({ at: new Date().toISOString(), ...entry })
  await env.USERS.put(KEY, JSON.stringify(log.slice(0, KEEP)))
}

export async function readLog(env) {
  return (env.USERS && (await env.USERS.get(KEY, 'json'))) ?? []
}
