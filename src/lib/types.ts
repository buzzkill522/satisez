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
