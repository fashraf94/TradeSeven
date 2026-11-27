// src/components/Explore/exploreCopy.js
//
// Explore Build 1 — EVERY WORD ON AN EXPLORE SCREEN (build prompt K-13; spec
// docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §3, §4). The screens write none.
//
// The evidence vocabulary is the spec's E-1: before any check a published
// connection is "Source cited", "Reporter's reading" or "No source yet". The page
// never says what an investigation would conclude, and "What starts with it" says
// only what the investigation really receives in Build 1 (spec §4, N-3): the story,
// the question, and — when the story names tickers — the companies the server reads.
// The guard (explore.guard.test.js) bans, in this file, the investigation's own
// labels and the sheet's banned promises.
//
// IMPORTS NOTHING. The gated line is Explore's own string, pinned equal to the hub's
// by that test (Explore imports nothing from the hub).

/** Numbers as words never appear: every count comes from the read (K-7). */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const EXPLORE_COPY = Object.freeze({
  home: Object.freeze({
    heading: 'Explore',
    intro: 'Start with a question. Research begins only when you choose to work one.',
    loading: 'Loading stories…',
    empty: 'No stories to explore yet',
    failed: "Couldn't load stories",
    tryAgain: 'Try again',
    questionsLabel: 'Questions worth researching',
    inProgress: 'Research in progress',
    saved: 'Saved for later',
    savedState: 'Saved · not researched',
    savedEmpty: "Nothing saved. Saving keeps a story to read later. It doesn't start research.",
    savedLoading: 'Loading your saved stories…',
    savedFailed: "Couldn't load your saved stories",
    gone: 'No longer available',
    remove: 'Remove',
    topics: 'Browse topics',
    allTopics: 'All topics',
    noTopicMatch: 'No question under this topic.',
    // Build 2 (Amendment B §4.1)
    overview: 'Overview',
    deepStory: 'Deep story',
    stillUnknown: 'Still unknown',
    free: 'Reading and saving are free.',
    startFrom: 'Start from something you use',
    latest: 'Latest deep stories',
    latestNote: 'One company or one product in depth. Each belongs to a connection in an overview.',
    /** "AI buildout › Electric utilities": the overview a deep story belongs to, and its connection. */
    path: (overview, connection) => `${overview} › ${connection}`,
    /** The company a deep story is about (its `about`, one or two), as words. */
    about: (companies) => `About ${companies.map((c) => (c.symbol && c.name !== c.symbol ? `${c.symbol} · ${c.name}` : c.symbol ?? c.name)).join(', ')}`,
  }),

  /** The shelf, "Your theses" (Amendment B §4.2): every number is the read's own. */
  shelf: Object.freeze({
    title: 'Your theses',
    counts: (open, finished) => `${open} in progress · ${finished} finished`,
    /** The builder's own sentence, blank (B-16): words and blanks in order. No part count: a thesis does not always have six. */
    blank: Object.freeze([
      ['text', 'My theme is '], ['blank', 'your theme'], ['text', ', through '], ['blank', 'a segment'], ['text', ', built on '],
      ['blank', 'the names'], ['text', ', because '], ['blank', 'why'], ['text', ". It's wrong if "], ['blank', 'what would prove it wrong'],
      ['text', '. Time frame: '], ['blank', 'time frame'], ['text', '.'],
    ]),
    blankLabel: 'An example of the thesis sentence you build, with its parts left blank',
    empty: 'Nothing here yet. Work a question from a story and the thesis you build lands here.',
    used: (used, perDay) => `${used} of ${perDay} investigations used today.`,
    gated: 'Building a thesis needs research access. Reading and saving stay open.',
    failed: "Couldn't check your research",
    tryAgain: 'Try again',
    checking: 'Checking your research',
    continue: 'Continue research',
    viewIt: 'View it',
  }),

  /** The chain (Amendment B §4.1, §4.3; B-1, B-2, B-8; K-6). The evidence labels are story.basis's, word for word. */
  chain: Object.freeze({
    count: (n, sourced, unchecked) => `${plural(n, 'connection', 'connections')} · ${sourced} sourced · ${unchecked} not checked yet`,
    key: 'Key',
    thisQuestion: 'This question',
    deepStory: 'Deep story',
    cardDoor: 'Deep story ›',
  }),

  card: Object.freeze({
    fromReporter: (name) => `From ${name}`,
    product: 'Product',
    sample: 'Sample story',
    byline: (reporter, date) => [reporter, date].filter(Boolean).join(' · '),
    read: 'Read the story',
    continue: 'Continue research',
    save: 'Save for later',
  }),

  /** The state line (spec §3.7): every number is the read's own field. */
  state: Object.freeze({
    inProgress: 'In progress',
    inProgressOf: (set, total) => `In progress · ${set} of ${total}`,
    stepsLeft: (n) => `${plural(n, 'step', 'steps')} left`,
    saved: (date) => (date ? `Thesis saved · ${date}` : 'Thesis saved'),
    concluded: (date) => (date ? `Concluded · ${date}` : 'Concluded'),
    lastUpdate: (date) => `Last update ${date}`,
  }),

  bookmark: Object.freeze({
    failedSave: "Couldn't save this story. Try again.",
    failedRemove: "Couldn't remove this story. Try again.",
    cap: (max) => `You can keep up to ${max} saved stories. Remove one to save this.`,
  }),

  search: Object.freeze({
    label: 'Search a product, theme, company, or ticker',
    stories: 'Stories and questions',
    companies: 'Companies',
    ownWords: (text) => `Work “${text}” from your own words`,
    ownWordsNote: 'Opens Work an idea with your words. Nothing starts until you continue there.',
    noStory: 'No story on this yet.',
    noStoryNoAccess: 'No story on this yet. Try a company name or ticker.',
    /** In the own-words row's place at the daily limit (founder ruling SQ-8, Nov 22): {perDay} is the read's quota. */
    limit: (perDay) => `You've used today's ${perDay} investigations. Try this one tomorrow.`,
    company: (symbol, name) => `${symbol} · ${name}`,
    companyNote: 'Opens the company’s research',
    // Build 2 (Amendment B §4.6)
    overview: 'Overview',
    deepStory: 'Deep story',
    deepIn: (overview, connection) => `Deep story · in ${overview} › ${connection}`,
  }),

  story: Object.freeze({
    back: '← Explore',
    published: (date, span) => [date ? `Published ${date}` : null, span ? `evidence dated ${span}` : null].filter(Boolean).join(' · '),
    parts: Object.freeze({ caption: 'What each part does', name: 'Part', job: 'Its job', timing: 'Timing' }),
    leavesOpen: 'What the story leaves open',
    connections: 'Published connections',
    basis: Object.freeze({ source_cited: 'Source cited', reporters_reading: "Reporter's reading", no_source_yet: 'No source yet' }),
    leads: (list) => `Company leads: ${list}`,
    connectionsClose: "A cited source describes the relationship. How much it matters to the company's sales is a separate question.",
    sources: 'Sources',
    sourcesOpen: (date) => (date
      ? `The story was published ${date}. Each source carries its own date.`
      : 'Each source carries its own date.'),
    evidenceDated: (date) => `Evidence dated ${date}`,
    openSource: 'Open the source',
    unavailable: 'This story is no longer available.',
    // Build 2 (Amendment B §4.3–§4.5)
    /** The back link names where it goes (B-11): the front page, or the story that linked here. */
    backTo: (name) => `← ${name}`,
    backLabel: (name) => `Back to ${name}`,
    explore: 'Explore',
    jumpLabel: 'Sections of this story',
    jump: Object.freeze({ story: 'Story', connections: 'Connections', questions: 'Questions', sources: 'Sources' }),
    known: 'Known',
    unknown: 'Unknown',
    whereToLook: 'Where to look',
    knownBlank: 'Nothing sourced yet.',
    leadsTitle: 'Company leads',
    leadsNote: "A ticker opens the stock's research page. A company stays a lead until a source ties it to the story.",
    company: (symbol, name) => `${symbol}, ${name}: open the stock's research page`,
    wayUp: (overview, connection) => `Up to ${overview}, ${connection}`,
    about: 'About',
    whereNext: 'Where next',
    oneStepUp: 'One step up',
    youAreHere: 'You are here · Deep story',
    across: (subject) => `Other connections in ${subject}`,
    acrossNote: 'Each opens the overview at that connection.',
  }),

  questions: Object.freeze({
    title: 'Questions worth working',
    help: 'Choosing one prepares it below. Nothing is researched until you start.',
  }),

  panel: Object.freeze({
    proposed: 'Proposed investigation',
    /** The panel's heading while the read cannot say whether there is one (loading, no access, failed: review A-9). */
    investigation: 'Investigation',
    yours: 'Your investigation',
    question: 'Proposed question',
    questionHelp: "Edit it if it isn't quite your question. It is set when you start.",
    useWording: "Use the story's wording",
    starts: 'What starts with it',
    startsRows: Object.freeze({ story: 'Story', question: 'Question', angle: 'Angle', firstStep: 'First step', companies: 'Companies', open: 'Still open' }),
    startsStory: (title, reporter, date) => `“${title}”${[reporter, date].filter(Boolean).length ? ` · ${[reporter, date].filter(Boolean).join(', ')}` : ''}`,
    startsQuestion: 'Your question steers every search.',
    startsFirstStep: "Your agent's first step checks the story against its source.",
    startsCompanies: 'Searches start from the companies this story names.',
    startsOpen: (unknown) => `Still open: ${unknown}`,
    cost: (perDay, used) => `Uses 1 of your ${perDay} investigations today · ${used} used`,
    work: 'Work this idea',
    limit: (perDay) => `You've used today's ${perDay} investigations. Save this story and start it tomorrow.`,
    open: 'You have an investigation on this story.',
    continue: 'Continue research',
    onePerStory: 'One investigation per story. Continue this one to take it further.',
    viewIt: 'View it',
    newOne: 'Start another investigation on this story',
    checking: 'Checking your research',
    readFailed: "Couldn't check your research",
    tryAgain: 'Try again',
    /** Pinned equal to the hub's research.disabled (hub/hubCopy.js) by explore.guard.test.js — word for word. */
    gated: "Research records aren't available on this account",
    gatedNote: 'You can read the stories; starting an investigation needs research access.',
    save: 'Save for later',
    /**
     * Build 2 (Amendment B §6, B-9; K-14): a broad question's group, by EXPLORE_COMPARE_ROUTE. `off` describes the
     * investigation that exists (the only one drawn while the switch is false); `on` is the compare build's.
     */
    group: Object.freeze({
      off: Object.freeze({ heading: () => 'Companies this question names', note: "A ticker opens the stock's research page." }),
      on: Object.freeze({
        heading: (n) => `Compares ${n} companies`,
        note: "Listed in the story's order. The comparing happens inside the investigation.",
        measures: 'Compares on',
        firstStep: "Your agent's first step compares the companies this question names.",
        then: 'You narrow the group to the names you choose.',
      }),
    }),
    startsThen: 'Then',
  }),

  /** The pinned bar's question (Amendment B §4.3, B-13): a button that jumps to the chooser. */
  bar: Object.freeze({
    toQuestions: (question) => `${question} — go to the questions`,
  }),

  /** The host of the Work an idea sheet (spec §3.6): the hub wrapper's lines, restated and pinned equal by test. */
  sheet: Object.freeze({
    title: 'Work an idea',
    eyebrow: 'Explore',
    label: 'Explore · work an idea',
    close: 'Close',
    loading: 'Checking your research',
    loadFailed: "Couldn't open Shared Research",
    tryAgain: 'Try again',
  }),
});
