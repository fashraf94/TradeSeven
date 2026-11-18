// src/components/SharedResearch/sharedResearchCopy.js
//
// Shared Research "Work an idea" — THE CLIENT'S WORDS (B2 build prompt K-5; spec
// docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md §7.1, §7.3). ONE
// table, SR_COPY: every screen title, button, label and note the sheet writes
// itself. Words from elsewhere are never restated here:
//   - a REFUSAL shows the server's own line, the answer's `message` (copy.js);
//   - finding labels, horizons, eligibility and the beat questions come from
//     src/constants/sharedResearch.js (one table for both sides, BUILD_RULES §9);
//   - the agent's name is a prop (`agentName`), "your agent" when absent — never
//     a literal.
// The few lines the sheet shows WITHOUT a refusal to carry them (a failed step or
// frame answers with no `message`; a quota ceiling already reached shows before
// any request) are the server's lines word for word, pinned equal to
// api/_utils/sharedResearch/copy.js by sharedResearchCopy.guard.test.js (founder
// ruling P-5). So is the gated line, pinned to the hub's (spec §4.1).
//
// Guarded (sharedResearchCopy.guard.test.js): the hub's banned list, plus
// "Shadow", "confidence" and "%". IMPORTS NOTHING but the shared vocabulary.

import { REVIEW_HONEST_LINE } from '../../constants/hypothesisRecords';

const plural = (n, one, many) => (n === 1 ? one : many);
/** A line's first letter in capitals ("your agent" opening a line or a tag). */
const cap = (s) => (typeof s === 'string' && s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** REVIEW_HONEST_LINE with the agent's name, capitalized where it opens the sentence. */
const honestOf = (name) => {
  const line = REVIEW_HONEST_LINE.replace('[AGENT]', name);
  return line.charAt(0).toUpperCase() + line.slice(1);
};

/**
 * THE THESIS BUILDER'S WORDS (B4 build prompt K-5 to K-15; Amendment B §B1 W-1, W-2, §B7). Every label, line and tag
 * the builder view writes itself. The agent's name is an argument (`agentName`, "your agent" when absent), never a
 * literal. Nothing here says a thesis will be sold, held, watched, waited for or expired at a level or a date (K-13):
 * the idea book does not read saved theses yet.
 */
const BUILDER = Object.freeze({
  // ── the card (K-7; R3b C-B) ────────────────────────────────────────────────
  thesis: 'Thesis',
  thesisReady: 'Thesis ready',
  filled: (n) => `${n} of 6`,
  stepsLeft: (n) => `${n} ${plural(n, 'step', 'steps')} left`,
  /** The words between the blanks of the card while it fills in (the finished sentence is the server's, drawn as received). */
  frame: Object.freeze({ theme: 'My theme is', segment: ', through', names: ', built on', why: ', because', wrongIf: '. It’s wrong if', timeFrame: '. Time frame:', end: '.' }),
  blank: Object.freeze({ theme: 'your theme', segment: 'segment · optional', names: 'the names', why: 'why', wrongIf: 'what would prove it wrong', timeFrame: 'time frame' }),
  parts: Object.freeze({ theme: 'Theme', segment: 'Segment', names: 'Names', why: 'Why', wrongIf: 'Wrong if', timeFrame: 'Time frame' }),
  priceLinesName: 'the price lines',
  suggested: 'suggested',
  stale: 'out of date',
  skipped: 'skipped',
  blocked: Object.freeze({ no_listed_company: 'no listed company' }),
  working: (name) => `${cap(name)} is working on this`,
  strip: 'Nothing set yet',
  // ── a tapped part (K-7) ──────────────────────────────────────────────────────
  by: Object.freeze({
    player_wrote: () => 'you wrote',
    player_chose: () => 'you chose',
    partner_suggested_confirmed: (name) => `${name} suggested · you confirmed`,
  }),
  sources: (n) => `${n} ${plural(n, 'source', 'sources')}`,
  yourWords: 'Your words · no sources',
  noSources: 'No sources',
  change: 'Change',
  themeFixed: 'A different theme is a new investigation.',
  evidence: 'Evidence',
  hideEvidence: 'Hide evidence',
  staleLine: (part) => `${part} is out of date: a finding behind it changed. Change it, or check it again.`,
  closePart: (part) => `Close ${part}`,
  partLabel: (part, text) => `${part}: ${text}`,
  allEvidence: 'All evidence',
  backToThesis: '← Back to the thesis',
  // ── the why (K-11; R3b WhyBlock2) ──────────────────────────────────────────────
  why: 'Why',
  against: 'The point against',
  noAgainst: 'No point against found yet',
  reasons: (n) => `${n} ${plural(n, 'reason', 'reasons')}`,
  perName: 'one reason per name',
  showReasons: 'Show the reasons',
  hideReasons: 'Hide the reasons',
  noReasonYet: 'no Source-backed reason yet',
  proposal: (name) => `${cap(name)}’s proposal`,
  revisedWaiting: 'A revised why is waiting',
  onTheCard: 'On the card',
  revised: 'Revised',
  // ── the conversation (K-9) ─────────────────────────────────────────────────────
  cardLine: (text) => `Card · ${text}`,
  suggestionWaiting: 'Card · a suggestion is waiting · nothing is set until you confirm.',
  yourWordsTag: 'Your words',
  directionTag: 'Your direction',
  stepUsed: '1 step used',
  map: (name) => `${cap(name)}’s map`,
  // ── the choices (K-5, K-10, K-10b) ──────────────────────────────────────────────
  free: 'free',
  oneStep: '1 step',
  goals: Object.freeze({
    verify_source: 'Check the story against its source',
    map_segments: 'Map the segments',
    find_names: 'Find the listed companies',
    build_why: 'Find the reasons',
    pick: 'You pick, and tell me why',
    strengthen: 'Keep researching',
    direction: 'Your direction',
  }),
  strengthenPart: (part) => `Keep researching · ${part}`,
  pickTag: (name) => `${cap(name)}’s pick`,
  suggestedTag: (name) => `${cap(name)} suggested`,
  reasoningTag: (name) => `${cap(name)}’s reasoning`,
  sourceCount: (n) => `${n} ${plural(n, 'source', 'sources')}`,
  confirmValue: (value) => `Confirm ${value}`,
  themeConfirm: (value) => `Use “${value}” as the theme`,
  skipSegment: 'Skip the segment',
  namesHelp: (min, max) => `Tick ${min} to ${max}. Only a company with a sourced connection can be picked.`,
  // the names step (the phone round, P-4): the tick button names what it builds; the pick has its own button
  namesBuild: (names) => (names ? `Build it on ${names}` : 'Build it on the names you tick'),
  pickButton: (name, names) => `Use ${name}’s pick · ${names}`,
  lead: 'Lead · can’t be picked',
  confirmWhy: 'Confirm these reasons',
  keepSome: 'Keep some of the reasons',
  keepTicked: 'Keep the ticked reasons',
  dropUnsourced: (names) => `Build it on ${names} only`,
  useRevised: 'Use the revised why',
  // choices that end the sentence read as its ending (the phone round, P-7)
  leadWrongIf: 'It’s wrong if…',
  leadTimeFrame: 'Time frame:',
  // an earlier reply folds to two lines (P-5); Discard sits behind "⋯" (P-3)
  moreReply: 'More',
  lessReply: 'Less',
  moreReplyLabel: (name) => `More of ${name}’s reply`,
  lessReplyLabel: (name) => `Less of ${name}’s reply`,
  // the Discard confirm, opened from a builder (5C-5): the builder has no "Continue later"; the sheet's close keeps it
  discardAlt: 'Closing the sheet instead keeps it open; Continue brings you back to the same investigation.',
  moreActions: 'More actions',
  // ── the composer (K-6) ──────────────────────────────────────────────────────────
  composerLabel: 'Your words',
  placeholder: Object.freeze({
    theme: 'Or name your theme in a few words',
    wrongIf: 'Or write what would prove it wrong',
  }),
  directionPlaceholder: (name) => `Tell ${name} where to look`,
  pointAgent: (name) => `Point ${name} somewhere`,
  writeItMyself: 'Write it myself',
  send: 'Send',
  // ── Change asks first (K-8) ─────────────────────────────────────────────────────
  clearsAlso: (part, others) => `Changing ${part} also clears ${others}.`,
  changeIt: 'Change it',
  keepIt: 'Keep it',
  // ── the hard states (K-15) ──────────────────────────────────────────────────────
  workingLine: (name) => `${cap(name)} is working on this step`,
  checkAgain: 'Check again',
  tryAgainGoal: (label) => `Try again · ${label}`,
  conclude: 'Conclude',
  keepsResearch: 'keeps the research',
  tryAnotherSegment: 'Try another segment',
  outOfSteps: (n) => `This investigation has used all ${n} research steps. The parts that need no research can still be set, and a ready thesis can still be saved.`,
  concludeWithWhatWeHave: 'Conclude with what we have',
  // ── ready and Save (K-12, K-13) ─────────────────────────────────────────────────
  edit: 'Edit the sentence · it’s yours',
  editLabel: 'Your sentence',
  backToComposed: 'Back to the composed sentence',
  oneStock: 'one stock',
  nNames: (n) => `${n} names`,
  judged: 'How it will be judged',
  inYourWords: 'in your words',
  priceLine: 'Price line',
  priceOptional: 'optional · add your own',
  priceLevel: (symbol) => `${symbol} · a daily close below $`,
  setPriceLines: 'Set the price lines',
  priceSet: (symbol, level) => `${symbol} · a daily close below $${level}`,
  save: 'Save thesis',
  saving: 'Saving your thesis…',
  keepResearching: 'Keep researching',
  stillToSet: (parts) => `Still to set: ${parts}.`,
  saveIssue: Object.freeze({
    // the server's own lines (api/_utils/sharedResearch/copy.js), word for word: pinned equal by the copy guard
    unsupported_assertion: 'The idea states a number none of its evidence holds. Edit it to match the evidence.',
    names_not_supported: 'The idea must name exactly the companies you picked.',
    too_many_evidence_refs: 'This thesis carries more evidence than one idea can hold.',
  }),
  // ── saved, today's state only (K-14; DR-7) ──────────────────────────────────────
  saved: 'Thesis saved',
  honestLine: (name) => honestOf(name),
  ideaBook: (name) => `${cap(name)}’s idea book isn’t reading saved theses yet. Yours is saved to your lists.`,
  done: 'Done',
  optional: 'optional',
  // ── Start (K-3) ─────────────────────────────────────────────────────────────────
  start: 'Start my thesis',
});

export const SR_COPY = Object.freeze({
  agentFallback: 'your agent',
  title: 'Work an idea',
  eyebrow: 'Shared Research',
  label: 'Shared Research · work an idea',

  // ── the gated state (spec §4.1; the hub's line, pinned equal by test) ─────────
  gated: "Research records aren't available on this account",
  gatedSub: 'You can read the stories; starting an investigation needs research access.',

  // ── the server's lines for answers that carry no `message` (ruling P-5) ──────
  server: Object.freeze({
    step_failed: 'That step did not complete, and nothing was added. Try again.',
    frame_failed: 'That question could not be framed. Try again, or edit your words.',
    findings_full: 'This investigation holds all the findings it can. Save what it found as an idea, or close it.',
    budget_spent: 'This investigation has used all of its steps. Reading, saving an idea and closing still work.',
    daily_limit: 'You have opened today\'s investigations. You can open another tomorrow.',
    framing_limit: 'You have framed today\'s questions. You can frame another tomorrow, or start from a story.',
    step_limit: "You have used today's research steps. You can take another tomorrow; reading, saving an idea and closing still work.",
  }),
  /** A request that never reached an answer (no status): the network, or the client's own timeout. */
  network: 'That request did not complete. Try again.',
  networkOpen: 'That request did not complete. Try again; a retry never starts a second investigation.',
  loadFailed: "Couldn't load this investigation.",
  listFailed: "Couldn't load your open research.",
  retry: 'Try again',
  waitUntil: 'You can try again in a moment.',

  // ── Start ───────────────────────────────────────────────────────────────────
  continueHead: 'Continue your research',
  continueRow: (when, n) => (when ? `Open · last update ${when} · ${n} ${plural(n, 'finding', 'findings')}` : `Open · ${n} ${plural(n, 'finding', 'findings')}`),
  stories: 'Recent stories',
  storiesSub: 'From FantasyTimes. Pick one; its question is ready to go.',
  general: 'General selection',
  stale: (date) => `Stories last updated ${date} · newer items may exist`,
  noStories: 'No recent stories are available right now.',
  noStoriesSub: 'You can still bring your own starting point below.',
  more: (n) => `Show more stories · ${n}`,
  fewer: 'Show fewer',
  own: 'Bring your own starting point',
  ownLabel: 'What caught your attention?',
  ownHelp: 'A product name, a company, a question, or a few words is enough.',
  prompts: Object.freeze([
    Object.freeze({ id: 'product', label: 'A product I use', help: 'Who earns when people use this product?', example: 'For example: Shop Pay' }),
    Object.freeze({ id: 'company', label: 'A company I follow', help: 'What is changing in this company’s business?', example: 'For example: a company name you follow' }),
    Object.freeze({ id: 'noticed', label: 'Something I noticed', help: 'Why are more people choosing this product?', example: 'For example: Security reviews and integration requirements often delay approvals.' }),
  ]),
  promptsLabel: 'Starter prompts',
  ownExample: 'For example: Shop Pay',
  obsNote: 'Your words stay yours. They are kept as your observation, never as a fact.',
  frame: 'Frame my question',
  cancel: 'Cancel',
  signaldrop: 'Use a SignalDrop',
  signaldropHelp: 'Paste something you read; the names it mentions come with it.',
  investigateCta: 'Investigate this',

  // ── previews ────────────────────────────────────────────────────────────────
  allStories: '← All stories',
  backStart: '← Back to the start',
  fromFantasyTimes: (reporter, when) => ['From FantasyTimes', reporter || 'reporter', when].filter(Boolean).join(' · '), // the server's own fallback word (opening.js)
  yourDrop: (type, when) => (type ? `Your drop · ${type} · ${when}` : `Your drop · ${when}`),
  dropTopic: 'What your drop is about',
  dropNames: 'Names it mentions',
  dropNoNames: 'No company in the game is named in it.',
  /** The drop's proposed question, composed from the parse's topic (spec §4.1). */
  dropQuestion: (topic) => `What is behind ${topic}, and which company earns from it?`,
  proposed: 'Proposed question',
  proposedHelp: 'Edit it if it isn’t quite your question. It is set when you start.',
  direction: 'Your direction',
  directionHelp: 'Optional. Where should I look first?',
  directionPlaceholder: 'Tell me what to look into',
  previewNote: 'I start from what’s already on record, right away. Deeper checks are steps you start.',
  investigate: 'Investigate this',
  opening: 'Opening the investigation…',
  existingOpen: 'You already have an investigation open on this. Continue picks it up where you left it; nothing new is created.',
  cont: 'Continue',

  // ── framing ─────────────────────────────────────────────────────────────────
  yourObs: 'Your observation',
  framing: 'Framing your question…',
  willCheck: 'What I’ll check',
  notEst: 'What this doesn’t establish',
  editWords: 'Edit my words',
  later: 'Continue later',
  framingUnfinished: 'Framing did not finish. Edit your words to start again.',
  framingStill: 'Your question is still being framed. Try again in a moment.',

  // ── work ───────────────────────────────────────────────────────────────────
  stateLine: (state, when, n) => (when ? `${state} · last update ${when} · ${n} ${plural(n, 'finding', 'findings')}` : `${state} · ${n} ${plural(n, 'finding', 'findings')}`),
  states: Object.freeze({ open: 'Open', completed: 'Concluded', saved: 'Saved as an idea', abandoned: 'Discarded' }),
  previous: (date) => (date ? `You investigated this on ${date}` : 'You investigated this before'),
  openEarlier: 'Open the earlier one',
  backToCurrent: '← Back to your new investigation',
  earlierNote: 'This is your earlier investigation. It is closed; you can read it.',
  fromStory: 'From the story',
  storedFacts: 'What the records already hold',
  storedScore: (score) => `Ranking score ${score}`,
  storedNone: 'No company in the game is in scope yet. Stored facts appear here once a name enters the investigation.',
  openingHead: 'Opening',
  openingBody: 'No answer yet. I start from what the records hold and one step you can take.',
  shortAnswer: 'Short answer',
  asOf: (date) => `As of ${date}`,
  older: (days) => `${days} days old`,
  refresh: 'Refresh',
  refreshHelp: 'Re-checks the evidence as a step. Same question, same record.',
  answerStale: 'This answer relies on a fact that was corrected. The next step revises it.',
  whatChanged: (n) => `What changed · ${n}`,
  hideChanges: 'Hide what changed',
  earlierAnswer: (date) => `Earlier answer · ${date}`,
  companies: 'Companies connected to this idea',
  supportedCount: (n) => `${n} supported`,
  noCompanies: 'No public company has a supported connection yet. It appears here as soon as a relationship has a source.',
  noCompaniesEnded: 'No supported public company in this chain. The research above stands on its own.',
  leads: 'Leads to examine',
  leadNote: 'Not an adoption choice until the connection has a source.',
  stillOpen: 'Still open · ',
  evidenceN: (n) => `Evidence · ${n}`,
  hideEvidence: 'Hide evidence',
  examine: 'Examine this connection',
  examineLabel: (name) => `Examine this connection: ${name}`,
  toIdea: 'Turn this into an idea',
  toIdeaLabel: (name) => `Turn this into an idea, starting with ${name}`,
  separateJudgments: 'Identity, evidence and significance are three separate judgments. A confirmed relationship with unknown revenue exposure is shown as exactly that.',
  lines: Object.freeze({ support: 'Strongest support', complication: 'Strongest complication', missing: 'Missing connection', next: 'Next action' }),
  running: Object.freeze({
    next: 'Taking the next step…',
    examine: (name) => `Examining ${name}…`,
    refresh: 'Re-checking the evidence…',
    direction: 'Following your direction…',
  }),
  wasRunning: 'A step was in progress',
  remaining: (n) => `${n} research ${plural(n, 'step', 'steps')} remaining`,
  stepNote: 'Findings are added; the answer changes only if they change it.',
  noNext: 'No next step is proposed. Conclude here, or start a new question from this observation.',
  withheld: 'The answer was not updated this step: a figure in it had no source.',
  examineHead: 'What should we examine next?',
  examineHelp: 'Direction steers this question. A materially different question starts a new investigation.',
  examinePlaceholder: 'Steer the next step',
  send: 'Send',
  evidence: 'Evidence',
  earlierFindings: (n) => `Earlier · ${n}`,
  hideEarlier: 'Hide earlier findings',
  superseded: 'Superseded',
  evidenceNote: 'Unknown dates stay unknown. “Read” is when I read a page, not when a fact became true. Source-backed means the cited material supports that specific claim, not that the claim is beyond doubt.',
  exchanges: 'Exchanges',
  you: 'You',
  conclude: 'This answered my question',
  adopt: 'Turn this into an idea',
  adoptBlocked: 'No supported public-company connection, so this can’t become an idea. Its answer stays in the record.',
  investigationClosed: 'This investigation is closed, so it can’t become an idea now.',
  discard: 'Discard',
  concluded: 'Concluded',
  concludedBody: 'A finished investigation. The answer and its evidence stay here.',
  discarded: 'Discarded',
  discardedBody: 'It is closed; its findings stay on its record.',
  savedNotice: 'Saved as an idea',
  returnCC: 'Return to Command Center',
  newInv: 'Start a new investigation',
  newInvHelp: 'Carries your starting point, not the findings.',

  // ── findings ────────────────────────────────────────────────────────────────
  undated: (date) => `Undated · read ${date}`,
  published: (date) => `published ${date}`,
  openSource: 'Open source ↗',
  youWhen: (date) => `You · ${date} · kept as your words, not as a fact`,

  // ── discard ─────────────────────────────────────────────────────────────────
  discardTitle: 'Discard this investigation?',
  discardConfirm: 'Discard closes this investigation as abandoned. It leaves your open investigations and can’t be continued. Your words and its findings stay on its record.',
  discardAlt: 'Continue later instead keeps it open; Continue brings you back to the same investigation.',
  discardYes: 'Discard it',
  keep: 'Keep it',

  // ── adoption ────────────────────────────────────────────────────────────────
  adoptTitle: 'Turn this into an idea',
  back: '← Back to the investigation',
  adoptIntro: 'This previews exactly what Save creates. Nothing is created until you confirm, and saving never deploys a game.',
  pick: 'Companies',
  pickHelp: 'At least one supported name. Leads stay out until their connection has a source.',
  doubt: (q) => `Doubt · ${q}`,
  leadPick: 'Lead · not adoptable yet',
  lead: 'Lead',
  tooMuch: 'Too much evidence to carry in one idea.',
  thesisLabel: 'Proposed investment claim',
  thesisHelp: 'My proposed claim, built from the companies you select and the findings behind them. Edit it; it is your statement.',
  thesisTag: 'Inferred · your claim',
  thesisTagNote: 'The relationships behind it keep their own Source-backed labels below.',
  count: (n) => `${n.toLocaleString('en-US')} / 1,000`,
  over: ' · over the limit',
  resetDraft: 'Reset to my draft',
  stray: (names) => `Your statement still names ${names.join(' and ')}, which ${names.length === 1 ? 'isn’t' : 'aren’t'} selected. Edit the statement or re-select before saving.`,
  timeFrame: 'Time frame',
  timeFrameNone: 'You pick it; I don’t pre-select one.',
  conditions: 'Conditions',
  conditionsHelp: 'Optional, on a daily close. Empty unless you set them; I never fill a number in.',
  liveAbove: 'Live above $',
  wrongBelow: 'Wrong below $',
  conditionLabel: (symbol, side, name) => `${symbol} · ${side} — ${name}, on a daily close`,
  pickFirst: 'Choose a company first.',
  carried: 'Evidence carried into this idea',
  carriedNote: 'Only this evidence, including the complication and the open link, is carried. References stay traceable to their sources.',
  carriedNone: 'Select a company to see what travels with the idea.',
  createsHead: 'What Save creates',
  createsIdea: (names) => `A new idea with ${names}, as a researched version (not a draft).`,
  createsIdeaNone: 'A new idea with the companies you choose, as a researched version (not a draft).',
  createsEvidence: 'The evidence above and your confirmation, carried with it.',
  createsClose: 'This investigation completes as saved. Retries never make a second idea.',
  saveIdea: 'Save idea',
  saving: 'Saving your idea…',
  saveUncertain: 'I couldn’t confirm whether your idea was saved. Let me check the record before trying again, so a retry can’t create a second idea.',
  checkRecord: 'Check the record',
  checking: 'Checking the record…',
  checkFailed: "Couldn't reach the record. Check again.",
  recovered: 'Found it: your idea was saved on the first attempt.',
  notSaved: 'Checked: nothing was created. You can try again.',
  closedElsewhere: 'Checked: nothing was created. This investigation is closed.',
  previewChanged: 'Check the new draft and save again.',

  // ── the saved idea ──────────────────────────────────────────────────────────
  saved: 'Idea saved',
  savedAlready: 'This investigation was already saved as an idea. The idea saved first is the one kept; open it in the Forge to read it.',
  savedLine: (names, horizon, n) => `${names} · ${horizon} · ${n === 0 ? 'no conditions' : `${n} ${plural(n, 'condition', 'conditions')}`}`,
  replaces: (list) => `Replaces ${list} as your equipped list.`,
  noList: 'You have no equipped list; this would become it for your next game.',
  useNext: 'Use it in my next game',
  notNow: 'Not now',
  declined: 'Saved, not equipped. You can equip it later from the Forge.',
  equipping: 'Equipping…',
  equipped: 'Equipped for your next game',
  replaced: (list) => `· replaced ${list}`,
  equipFailed: 'Saved, not equipped.',
  leaveSaved: 'Leave it saved',
  honest: (name) => `${honestOf(name)} A link between research and a game is shown only once the game records it.`,

  // ── the thesis builder (B4) ─────────────────────────────────────────────────
  builder: BUILDER,
});
