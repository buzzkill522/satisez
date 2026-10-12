// Cloudflare Pages Function: POST /api/ask
//
// Answers a student's "doubt" about a question using Cloudflare Workers AI, which is free
// up to a daily allowance — no API key or card needed. Requires a Workers AI binding named
// `AI` on the Pages project (Settings → Bindings → Add → Workers AI).
//
// Request body: { question: {...}, messages: [{ role: 'user'|'assistant', content: string }] }
// Response:     { reply: string }  or  { error: string }

// Small, fast models: each exchange uses a tiny slice of the free daily allowance. Tried in order,
// so if Cloudflare retires one (as it did @cf/meta/llama-3.1-8b-instruct on 30 May 2026) the next
// takes over. Set an AI_MODEL variable to put another Workers AI text model first.
const MODELS = ['@cf/zai-org/glm-4.7-flash', '@cf/google/gemma-4-26b-a4b-it', '@cf/meta/llama-3.1-8b-instruct-fp8']
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

  const messagesIn = [
    { role: 'system', content: `${SYSTEM}\n\n=== The question ===\n${questionContext(question)}` },
    ...history,
  ]
  const models = [...new Set([setting(env.AI_MODEL), ...MODELS].filter(Boolean))]
  let lastError = ''
  for (const model of models) {
    try {
      // Generous max_tokens: some newer models think before answering and count that too.
      const result = await env.AI.run(model, { messages: messagesIn, max_tokens: 1200, temperature: 0.3 })
      const reply = replyText(result)
      if (reply) return json({ reply })
      lastError = `${model} returned no text`
    } catch (err) {
      const msg = String(err?.message ?? err)
      // Workers AI reports an exhausted free allowance as a quota / capacity error.
      if (/quota|neuron|429|daily (free )?allocation/i.test(msg)) {
        return json({ error: "Today's free AI allowance is used up. It resets daily — try again tomorrow." }, 429)
      }
      lastError = `${model}: ${msg}`
    }
  }
  return json({ error: `The tutor couldn't answer right now. Try again in a moment. (${lastError})` }, 502)
}

const setting = (v) => (typeof v === 'string' ? v.trim() : '')

/**
 * Workers AI models answer in two shapes: older ones as { response }, newer ones in the OpenAI
 * format { choices: [{ message: { content } }] }. Thinking models may also wrap their reasoning
 * in <think>…</think>; only the final answer is shown.
 */
export function replyText(result) {
  const raw =
    (typeof result === 'string' && result) ||
    (typeof result?.response === 'string' && result.response) ||
    result?.choices?.[0]?.message?.content ||
    result?.choices?.[0]?.text ||
    result?.output_text ||
    ''
  const text = Array.isArray(raw) ? raw.map((p) => p?.text ?? '').join('') : String(raw)
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[\s\S]*<\/think>/, '').trim()
}

export const onRequest = ({ request }) =>
  request.method === 'POST' ? undefined : json({ error: 'POST only.' }, 405)
