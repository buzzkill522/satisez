export type Section = 'rw' | 'math'
export type Difficulty = 'E' | 'M' | 'H'

export interface Choice {
  key: string
  content: string // HTML
}

export interface Question {
  id: string
  section: Section
  domain: string
  domainName: string
  skill: string
  skillName: string
  difficulty: Difficulty
  scoreBand?: number
  type: 'mcq' | 'spr'
  stimulus: string // HTML
  stem: string // HTML
  choices: Choice[]
  answers: string[] // letters for mcq, accepted strings for spr
  rationale: string // HTML
}

export interface Attempt {
  qid: string
  answer: string
  correct: boolean
  seconds: number
  at: number // epoch ms
}

export interface Filters {
  section: Section
  domains: string[]
  skills: string[]
  difficulties: Difficulty[]
  hideAnswered: boolean
  onlyWrong: boolean
  onlyFlagged: boolean
}

export const SECTION_NAMES: Record<Section, string> = {
  rw: 'Reading and Writing',
  math: 'Math',
}

export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  E: 'Easy',
  M: 'Medium',
  H: 'Hard',
}

/** Official Digital SAT module timing, used by Timed mode. */
export const MODULE_SPEC: Record<Section, { questions: number; minutes: number }> = {
  rw: { questions: 27, minutes: 32 },
  math: { questions: 22, minutes: 35 },
}

/** Official College Board ordering of domains (by code) and skills (by name), used for display. */
export const DOMAIN_ORDER = ['INI', 'CAS', 'EOI', 'SEC', 'H', 'P', 'Q', 'S']
const SKILL_ORDER = [
  // Information and Ideas
  'central ideas', 'command of evidence', 'inferences',
  // Craft and Structure
  'words in context', 'text structure', 'cross-text',
  // Expression of Ideas
  'rhetorical synthesis', 'transitions',
  // Standard English Conventions
  'boundaries', 'form, structure',
  // Algebra
  'linear equations in one', 'linear functions', 'linear equations in two', 'systems of two', 'linear inequalities',
  // Advanced Math
  'equivalent expressions', 'nonlinear equations', 'nonlinear functions',
  // Problem-Solving and Data Analysis
  'ratios', 'percentages', 'one-variable', 'two-variable', 'probability', 'inference from sample', 'evaluating statistical',
  // Geometry and Trigonometry
  'area and volume', 'lines, angles', 'right triangles', 'circles',
]

// Unknown codes/names sort last (a large number, not Infinity: Infinity - Infinity is NaN in sort).
const rank = (i: number) => (i === -1 ? 999 : i)
export const domainRank = (code: string) => rank(DOMAIN_ORDER.indexOf(code))
export const skillRank = (name: string) => {
  const n = name.toLowerCase()
  return rank(SKILL_ORDER.findIndex((s) => n.startsWith(s)))
}
