/**
 * Some typed-answer (student-produced response) questions come from the College Board API with no
 * answer in the data field; the answer is only in the explanation, which opens "The correct answer
 * is 4." This pulls it out: the number(s) in that first sentence, plus any alternative forms the
 * explanation lists ("Note that 7/2 and 3.5 are examples of ways to enter a correct answer").
 * Returns [] when nothing can be found.
 */
export function answersFromRationale(html: string): string[] {
  const text = (html ?? '')
    .replace(/<\/?(?:p|div|br|li)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&minus;|−|–/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s(=])-\s+(?=\d|\.)/g, '$1-') // a minus split from its number by math markup
    .trim()
  const number = /-?(?:\d+\.\d+|\d*\.\d+|\d+(?:\s*\/\s*\d+)?)/g
  const found: string[] = []
  const take = (s: string) => {
    for (const m of s.match(number) ?? []) {
      const v = m.replace(/\s+/g, '')
      if (!found.includes(v)) found.push(v)
    }
  }
  // The sentence after "correct answer(s) is/are", up to a full stop followed by a space or the end.
  const first = text.match(/correct answers?\s*(?:is|are|:)\s*(.+?)(?:\s*\.(?:\s|$)|$)/i)
  if (!first) return []
  take(first[1])
  // Alternatives only when the sentence is about how to enter the answer, so an unrelated
  // "Note that 5 is not…" can never become an accepted answer.
  const alt = text.match(/(?:note that|either)\s+(.+?)\s+(?:are|is|may be|can be)\b[^.]*?\b(?:enter|correct answer)/i)
  if (alt) take(alt[1])
  return found
}
