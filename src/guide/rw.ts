// Reading & Writing guide: the structure of the section (facts about the test) and, per question
// type, the strategy content we're writing together.
//
// To add content, fill in a skill's `approach`, `traps`, `example` or `timeTarget`. Empty fields
// are hidden from students and shown to admins as "Not written yet".

export interface GuideSkill {
  slug: string
  name: string
  /** How the question is usually worded on the test (paraphrased patterns, not College Board text). */
  stems: string[]
  /** One line on what the question type asks you to do. */
  asks: string
  // --- Content we write together ---
  /** Step-by-step method, one step per item. */
  approach: string[]
  /** Wrong-answer patterns to watch for. */
  traps: string[]
  /** A worked example (original, not from the College Board bank). Plain text; blank lines split paragraphs. */
  example: string
  /** e.g. "About 45 seconds". */
  timeTarget: string
}

export interface GuideDomain {
  code: string // College Board domain code, used for practice links
  name: string
  /** Questions per full test (both modules), from College Board's test specifications. */
  perTest: string
  share: number // approximate % of the section
  /** Rough count per 27-question module, for the module map. */
  perModule: number
  blurb: string
  skills: GuideSkill[]
}

const empty = { approach: [], traps: [], example: '', timeTarget: '' }

/** Domains in the order they appear within each module. */
export const RW_DOMAINS: GuideDomain[] = [
  {
    code: 'CAS',
    name: 'Craft and Structure',
    perTest: '13–15',
    share: 28,
    perModule: 7,
    blurb: 'Vocabulary in context, how a text is built, and how two texts relate.',
    skills: [
      {
        slug: 'words-in-context',
        name: 'Words in Context',
        asks: 'Pick the word or phrase that fits the meaning of the text, or what a word means as used.',
        stems: [
          'Which choice completes the text with the most logical and precise word or phrase?',
          'As used in the text, what does the word "___" most nearly mean?',
        ],
        ...empty,
      },
      {
        slug: 'text-structure-and-purpose',
        name: 'Text Structure and Purpose',
        asks: 'Describe what a text (or one sentence in it) is doing, or how the text is organized.',
        stems: [
          'Which choice best describes the function of the underlined sentence in the text as a whole?',
          'Which choice best describes the overall structure of the text?',
          'Which choice best states the main purpose of the text?',
        ],
        ...empty,
      },
      {
        slug: 'cross-text-connections',
        name: 'Cross-Text Connections',
        asks: 'Two short texts on one topic: decide how one author would respond to the other.',
        stems: [
          'Based on the texts, how would the author of Text 2 most likely respond to the claim in Text 1?',
          'Based on the texts, both authors would most likely agree with which statement?',
        ],
        ...empty,
      },
    ],
  },
  {
    code: 'INI',
    name: 'Information and Ideas',
    perTest: '12–14',
    share: 26,
    perModule: 7,
    blurb: 'Main ideas, using evidence (quotes and data), and drawing logical conclusions.',
    skills: [
      {
        slug: 'central-ideas-and-details',
        name: 'Central Ideas and Details',
        asks: 'Identify the main idea of a text, or a detail it states directly.',
        stems: ['Which choice best states the main idea of the text?', 'According to the text, what is true about ___?'],
        ...empty,
      },
      {
        slug: 'command-of-evidence-textual',
        name: 'Command of Evidence: Textual',
        asks: 'Choose the quotation or finding that best supports, illustrates or weakens a claim.',
        stems: [
          'Which quotation from the text most effectively illustrates the claim?',
          'Which finding, if true, would most directly support the researcher’s hypothesis?',
        ],
        ...empty,
      },
      {
        slug: 'command-of-evidence-quantitative',
        name: 'Command of Evidence: Quantitative',
        asks: 'Use data from a table or graph to complete a statement or support a claim.',
        stems: ['Which choice most effectively uses data from the table to complete the statement?'],
        ...empty,
      },
      {
        slug: 'inferences',
        name: 'Inferences',
        asks: 'The text ends in a blank: choose the conclusion that follows logically from it.',
        stems: ['Which choice most logically completes the text?'],
        ...empty,
      },
    ],
  },
  {
    code: 'SEC',
    name: 'Standard English Conventions',
    perTest: '11–15',
    share: 26,
    perModule: 7,
    blurb: 'Grammar and punctuation. The two skills are mixed together rather than grouped separately.',
    skills: [
      {
        slug: 'boundaries',
        name: 'Boundaries',
        asks: 'Punctuate correctly between and within sentences: periods, semicolons, colons, commas, dashes.',
        stems: ['Which choice completes the text so that it conforms to the conventions of Standard English?'],
        ...empty,
      },
      {
        slug: 'form-structure-and-sense',
        name: 'Form, Structure, and Sense',
        asks: 'Pick the grammatically correct form: verb tense and agreement, pronouns, modifiers, plurals and possessives.',
        stems: ['Which choice completes the text so that it conforms to the conventions of Standard English?'],
        ...empty,
      },
    ],
  },
  {
    code: 'EOI',
    name: 'Expression of Ideas',
    perTest: '8–12',
    share: 20,
    perModule: 6,
    blurb: 'Revising writing: the right transition, and using notes to meet a specific goal.',
    skills: [
      {
        slug: 'transitions',
        name: 'Transitions',
        asks: 'Choose the transition word or phrase that shows the right logical relationship.',
        stems: ['Which choice completes the text with the most logical transition?'],
        ...empty,
      },
      {
        slug: 'rhetorical-synthesis',
        name: 'Rhetorical Synthesis',
        asks: 'Given a student’s bullet-point notes and a goal, choose the sentence that achieves the goal.',
        stems: [
          'While researching a topic, a student has taken the following notes: … The student wants to ___. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
        ],
        ...empty,
      },
    ],
  },
]

/** Every skill in test order, with its domain, for prev/next navigation. */
export const RW_SKILLS = RW_DOMAINS.flatMap((d) => d.skills.map((s) => ({ ...s, domain: d })))

/** Facts about the section as a whole (College Board's Digital SAT specifications). */
export const RW_FACTS = {
  modules: 2,
  questionsPerModule: 27,
  minutesPerModule: 32,
  totalQuestions: 54,
  totalMinutes: 64,
  pretestPerModule: 2,
  passageWords: '25–150',
  secondsPerQuestion: 71,
}
