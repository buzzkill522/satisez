// Per-account progress in Cloudflare D1 (binding `DB`). Two tables, created on first use:
//   attempts — every answer: (email, qid, at) is unique, so re-sending an attempt is harmless.
//   items    — flags, notes, tutor chats and study-guide progress, one row per key
//              ("flag:<qid>", "note:<qid>", "chat:<qid>", "guide:<slug>"). Each row carries the
//              time it was last changed; a newer change always wins, and a NULL value records a
//              removal, so un-flagging on one device isn't undone by another.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS attempts (
     email TEXT NOT NULL, qid TEXT NOT NULL, at INTEGER NOT NULL,
     answer TEXT, correct INTEGER NOT NULL, seconds INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (email, qid, at))`,
  `CREATE TABLE IF NOT EXISTS items (
     email TEXT NOT NULL, key TEXT NOT NULL, value TEXT, stamp INTEGER NOT NULL,
     PRIMARY KEY (email, key))`,
]

let ready = null
export function ensureSchema(db) {
  ready ??= db.batch(SCHEMA.map((s) => db.prepare(s))).catch((err) => {
    ready = null
    throw err
  })
  return ready
}

export const MAX_ATTEMPTS = 5000
export const MAX_ITEMS = 2000
const MAX_VALUE = 32 * 1024
const KEY_RE = /^(flag|note|chat|guide):[\w.-]{1,80}$/

/** Drops anything malformed rather than failing the whole save. */
export function clean(body) {
  const attempts = (Array.isArray(body?.attempts) ? body.attempts : [])
    .slice(0, MAX_ATTEMPTS)
    .filter((a) => a && typeof a.qid === 'string' && a.qid.length <= 80 && Number.isFinite(a.at))
    .map((a) => ({
      qid: a.qid,
      at: Math.round(a.at),
      answer: String(a.answer ?? '').slice(0, 200),
      correct: a.correct ? 1 : 0,
      seconds: Math.max(0, Math.min(86400, Math.round(Number(a.seconds) || 0))),
    }))
  const items = (Array.isArray(body?.items) ? body.items : [])
    .slice(0, MAX_ITEMS)
    .filter((i) => i && typeof i.key === 'string' && KEY_RE.test(i.key) && Number.isFinite(i.stamp))
    .filter((i) => i.value === null || (typeof i.value === 'string' && i.value.length <= MAX_VALUE))
    .map((i) => ({ key: i.key, value: i.value, stamp: Math.round(i.stamp) }))
  return { attempts, items }
}

export async function save(db, email, { attempts, items }) {
  const addAttempt = db.prepare(
    'INSERT OR IGNORE INTO attempts (email, qid, at, answer, correct, seconds) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
  )
  const upsertItem = db.prepare(
    `INSERT INTO items (email, key, value, stamp) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (email, key) DO UPDATE SET value = excluded.value, stamp = excluded.stamp
     WHERE excluded.stamp > items.stamp`,
  )
  const stmts = [
    ...attempts.map((a) => addAttempt.bind(email, a.qid, a.at, a.answer, a.correct, a.seconds)),
    ...items.map((i) => upsertItem.bind(email, i.key, i.value, i.stamp)),
  ]
  for (let i = 0; i < stmts.length; i += 200) await db.batch(stmts.slice(i, i + 200))
}

export async function load(db, email) {
  const [a, i] = await db.batch([
    db.prepare('SELECT qid, at, answer, correct, seconds FROM attempts WHERE email = ?1 ORDER BY at').bind(email),
    db.prepare('SELECT key, value, stamp FROM items WHERE email = ?1').bind(email),
  ])
  return {
    attempts: a.results.map((r) => ({ qid: r.qid, at: r.at, answer: r.answer, correct: Boolean(r.correct), seconds: r.seconds })),
    items: i.results,
  }
}

export async function wipe(db, email) {
  await db.batch([
    db.prepare('DELETE FROM attempts WHERE email = ?1').bind(email),
    db.prepare('DELETE FROM items WHERE email = ?1').bind(email),
  ])
}

/** Distinct questions answered per account, for the Admin page. */
export async function answeredCounts(db) {
  const { results } = await db.prepare('SELECT email, COUNT(DISTINCT qid) AS n, MAX(at) AS last FROM attempts GROUP BY email').all()
  return new Map(results.map((r) => [r.email, { answered: r.n, lastActive: r.last }]))
}
