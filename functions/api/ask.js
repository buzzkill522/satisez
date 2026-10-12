// Cloudflare Pages Function: POST /api/ask
//
// Relays a "doubt" about a question to Claude. The API key lives in the Pages
// project's secrets (ANTHROPIC_API_KEY); the site never sees it. A shared
// passcode (ACCESS_CODE) keeps strangers who find the URL from using it.
//
// Request body: { question: {...}, messages: [{ role: 'user'|'assistant', content: string }] }
// Response:     { reply: string }  or  { error: string }

import Anthropic from '@anthropic-ai/sdk'

const MAX_TURNS = 20
const MAX_CHARS = 2000

const SYSTEM = `You are a patient SAT tutor helping one student understand a question they just answered.
You are given the question, the answer choices, which one the student picked, the correct answer, and College Board's official rationale.
Answer the student's specific doubt directly and concisely. Explain the reasoning, not just the answer.
When a wrong choice is tempting, say why it is wrong. For math, show the key steps. For reading and writing, point to the exact words in the passage that decide it.
Stay on this question and the skill it tests; if the student asks about something unrelated to the SAT, steer back briefly.
Use plain text. No markdown headings or tables; short paragraphs or a short numbered list are fine.`

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
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not set on the Pages project.' }, 500)
  if (!env.ACCESS_CODE) return json({ error: 'ACCESS_CODE is not set on the Pages project.' }, 500)
  if (request.headers.get('x-access-code') !== env.ACCESS_CODE) return json({ error: 'Wrong passcode.' }, 401)

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
  // The question goes in front of the student's first message so the rest of the chat stays short.
  history[0] = { role: 'user', content: `${questionContext(question)}\n\n---\nStudent: ${history[0].content}` }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: history,
    })
    if (response.stop_reason === 'refusal') return json({ reply: "I can't help with that one — ask me something about this question." })
    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
    return json({ reply: reply || 'No answer came back. Try asking again.' })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'The Anthropic API key on the server is invalid.' }, 500)
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'Rate limited by Anthropic. Try again in a moment.' }, 429)
    if (err instanceof Anthropic.APIError) return json({ error: `Anthropic API error ${err.status}: ${err.message}` }, 502)
    return json({ error: 'Could not reach Anthropic.' }, 502)
  }
}

export const onRequest = ({ request }) =>
  request.method === 'POST' ? undefined : json({ error: 'POST only.' }, 405)
