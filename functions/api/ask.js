// Cloudflare Pages Function: POST /api/ask
//
// Answers a student's "doubt" about a question using Cloudflare Workers AI, which is free
// up to a daily allowance — no API key or card needed. Requires a Workers AI binding named
// `AI` on the Pages project (Settings → Bindings → Add → Workers AI).
//
// Optional: set ACCESS_CODE (Settings → Variables and secrets) to require a passcode, so
// strangers who find the URL can't use up the daily free allowance.
//
// Request body: { question: {...}, messages: [{ role: 'user'|'assistant', content: string }] }
// Response:     { reply: string }  or  { error: string }

// Small, fast model: each exchange uses a tiny slice of the free daily allowance.
// Override with an AI_MODEL variable to try another Workers AI text model.
const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct'
const MAX_TURNS = 10
const MAX_CHARS = 1000

const SYSTEM = `You are a patient SAT tutor helping one student understand a question they just answered.
You are given the question, the answer choices, which one the student picked, the correct answer, and College Board's official rationale.
Treat the official rationale and correct answer as definitely right; never contradict them.
Answer the student's specific doubt directly and concisely — usually 2–5 sentences, never more than a short paragraph or a 3-step list.
Explain the reasoning, not just the answer. When a wrong choice is tempting, say why it is wrong. For math, show the key steps. For reading and writing, point to the exact words in the passage that decide it.
Stay on this question and the skill it tests; if the student asks about something unrelated to the SAT, steer back briefly.
Use plain text. No markdown headings or tables.`

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

/** College Board content is HTML (with MathML); flatten it to readable text for the prompt. */
function textOf(html) {
  return (html ?? '')
    .replace(/<span class="sr-only">[^<]*<\/span>/g, '')
    .replace(/<\/(p|div|tr|li|math)>/g, '\n')
    .replace(/<\/(td|th|mi|mn|mo)>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function questionContext(q) {
  const parts = [`Section: ${q.section === 'math' ? 'Math' : 'Reading and Writing'} — ${q.domainName} › ${q.skillName} (${q.difficulty})`]
  if (q.stimulus) parts.push(`Passage / figure:\n${textOf(q.stimulus)}`)
  parts.push(`Question:\n${textOf(q.stem)}`)
  if (q.choices?.length) parts.push('Choices:\n' + q.choices.map((c) => `${c.key}. ${textOf(c.content)}`).join('\n'))
  parts.push(`Student's answer: ${q.studentAnswer || '(none)'}`)
  parts.push(`Correct answer: ${(q.answers ?? []).join(' or ')}`)
  if (q.rationale) parts.push(`Official rationale:\n${textOf(q.rationale)}`)
  return parts.join('\n\n')
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) {
    return json({ error: 'The Workers AI binding is missing. In Cloudflare: Pages project → Settings → Bindings → Add → Workers AI, name it AI, then redeploy.' }, 500)
  }
  if (env.ACCESS_CODE && request.headers.get('x-access-code') !== env.ACCESS_CODE) {
    return json({ error: 'Wrong passcode.' }, 401)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON.' }, 400)
  }
  const { question, messages } = body ?? {}
  if (!question?.stem || !Array.isArray(messages) || !messages.length) return json({ error: 'Missing question or messages.' }, 400)

  const history = messages
    .slice(-MAX_TURNS)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
  if (!history.length || history[0].role !== 'user') return json({ error: 'Conversation must start with the student.' }, 400)

  try {
    const result = await env.AI.run(env.AI_MODEL || DEFAULT_MODEL, {
      messages: [
        { role: 'system', content: `${SYSTEM}\n\n=== The question ===\n${questionContext(question)}` },
        ...history,
      ],
      max_tokens: 400,
      temperature: 0.3,
    })
    const reply = (result?.response ?? '').trim()
    return json({ reply: reply || 'No answer came back. Try asking again.' })
  } catch (err) {
    const msg = String(err?.message ?? err)
    // Workers AI reports an exhausted free allowance as a quota / capacity error.
    if (/quota|limit|neuron|429|capacity/i.test(msg)) {
      return json({ error: "Today's free AI allowance is used up. It resets daily — try again tomorrow." }, 429)
    }
    return json({ error: `Workers AI error: ${msg}` }, 502)
  }
}

export const onRequest = ({ request }) =>
  request.method === 'POST' ? undefined : json({ error: 'POST only.' }, 405)
