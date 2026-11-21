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
    company: (symbol, name) => `${symbol} · ${name}`,
    companyNote: 'Opens the company’s research',
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
    startsFirstStep: "Your agent's first step checks the story against its sources.",
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
