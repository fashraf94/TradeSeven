// src/screens/filmRoomV2/filmRoomCopy.js
//
// Film Room v2 (A2) — EVERY WORD THE SCREEN SAYS, in one table (the
// battleViewCopy precedent). The wording is the spec's where the spec fixes it
// (V1.2 BA-4, BA-7, BA-9, BA-10, BA-11, BA-21, BA-22; Amendment D BA-38;
// Amendment E BA-41 … BA-49) and the design of record's otherwise
// (docs/design/20261008_FILM_ROOM_A2_MOCKUP.html). No verdict, no ranking, no
// lesson, no advice, no new agent voice, never a "Why?" heading, and no
// number spelled as a word outside a marked number (Amendment E addendum 2,
// R8) — the screen suites sweep the rendered output for all of them.

import { PROVENANCE_LABELS, LOCKED_BASIS_NOTE, REPLAY_VERSION_NOTE } from '../../constants/filmTape';

export { PROVENANCE_LABELS, LOCKED_BASIS_NOTE, REPLAY_VERSION_NOTE };

/** The marker letter for each class (BA-42): one letter in a hairline box; rebuilt is dashed, like its lines. */
export const CLASS_LETTER = Object.freeze({ recorded: 'R', derived: 'D', rebuilt: 'B', market: 'M' });

/**
 * BA-11's sentence, in the SCREEN's own words — shown only on a card whose
 * replay stores no `label` of its own. A card with a stored label shows that
 * label verbatim, as the tape's own words (R1: api/_utils/filmTape/tapeReplay.js
 * REPLAY_LABEL, "one-step hypothetical …"). The screen's own voice spells no
 * number as a word (Amendment E addendum 2, R8), so its sentence says "this
 * swap alone" where the stored label says "one-step".
 */
export const REPLAY_SENTENCE = "a hypothetical of this swap alone, through the day's close; later trades in this slot are not replayed; not the effect of the swap on the battle";

export const FILM_ROOM_COPY = Object.freeze({
  title: 'Film Room',
  // the back control names where it returns: the surface the Film Room was opened from (filmRoomBack.js)
  backTo: { battle: 'Battle', battleHistory: 'Battle History', dashboard: 'Dashboard', unknown: 'Dashboard' },
  gameName: 'BaggerBomb',
  battleLengthSuffix: '-day battle',   // the design of record's "one-day battle" — the word is a marked number (R8)
  battleComplete: 'battle complete',
  battleActive: 'battle in progress',
  depths: [{ id: 'glance', label: 'Glance' }, { id: 'study', label: 'Study' }, { id: 'deep', label: 'Deep dive' }],
  legend: 'Number kinds',
  dayPicker: 'Battle day',

  // the first open (§7, BA-49) — verbatim from the spec
  firstOpenEyebrow: 'Film Room · shown once',
  firstOpen: 'Film Room now includes held positions in its recorded score. Earlier Film Room summaries left them out, so the same battle may show a different number here. Check the timestamp: this score may be from the last recorded check rather than market close.',
  gotIt: 'Got it',

  // states of the day (§7)
  loading: 'Loading the tape…',
  noTape: 'No tape for this day',
  noTapeScheduled: { before: 'The close pass for this day is scheduled at ', after: ' ET.' },   // the clock between, as an instant (review A2A3-7)
  noTapeLater: 'The close pass that tapes this day has not run yet.',
  noTapeUnavailable: 'Not available.',
  readError: 'The tape for this day could not be read.',
  earlierDay: "This day's tape was written while the battle was in progress; the battle's final result is recorded on its last day.",
  openLastDay: (label) => `Open ${label}`,
  skippedMode: 'This battle mode is not taped.',
  closeNotWritten: 'The close pass for this day did not write a tape',   // then "(" the stored passes.close.status, bound by path (B2) ")."
  statusUnknown: 'unknown',

  // section counts (Amendment E addendum R4(a)) — "Checks · 23 of 23", "Holdings · 7 slots"
  countOf: 'of',
  countRecorded: 'recorded',
  slots: 'slots',

  // coverage (BA-20)
  coverage: 'Coverage',
  replayCoverage: 'Replay coverage',
  coverageLabel: { complete: 'complete', partial: 'partial', unavailable: 'unavailable' },
  preservedFrom: 'preserved from an earlier run',
  // B2.1 A7 (Amendment J RJ-7): Glance's ONE line of the day's coverage — "Coverage · complete for every section", or
  // "Coverage · complete except: series (partial — 1 symbol not charted)", each section that is not complete named
  // with its stored reason
  coverageSummary: {
    every: 'complete for every section',
    except: 'complete except:',
    sections: { checks: 'checks', actions: 'swaps', directives: 'directives', meetings: 'meetings', plans: 'plans', rationale: 'rationale', evidence: 'evidence', replay: 'replays', series: 'series' },
    notCharted: (n) => (n === 1 ? 'symbol not charted' : 'symbols not charted'),
    // review SPR-S-2: a section the tape does not store (written before it was taped), named as an absence (R14)
    absent: 'not on this tape',
  },

  // Glance (BA-4; F5)
  recordedScoreAt: (clock) => `Recorded score at ${clock} ET`,
  recordedScore: 'Recorded score',
  dayChange: 'Day change',
  dayChangeBasis: { battle_start: 'from the battle start', prior_day_tape: "from the prior day's last recorded check", unavailable: 'unavailable' },
  firstCheckAt: (clock) => `First check ${clock}`,
  noChecks: 'no checks recorded',
  scorePath: 'Score at each check',
  scorePathNote: 'the recorded score, held between checks',
  battleStartLine: 'battle start',
  checks: 'Checks',
  runsTitle: 'Checks, as runs',
  runCompleted: 'completed',
  runKinds: { hold: 'HOLD', swap: 'SWAP', default_hold: 'held by default', completed: 'decision not recorded' },
  checksIn: 'checks',
  swapByAgent: 'swap · the agent',
  swapByRule: 'swap · a platform rule',
  swapByOther: 'swap · the gameplan meeting, or a maker not recorded',
  afterLastCheck: 'after the last recorded check',
  tapForDetail: 'tap a check for its record',
  finalResult: 'Final result',
  apartFromDay: "the battle's result, apart from this day's score",
  resultWord: { win: 'Win', loss: 'Loss', draw: 'Draw' },
  resultBasis: { stored: 'recorded by the platform', derived: 'derived from the recorded final scores', unavailable: 'unavailable' },
  agentVsCpu: { agent: 'Agent', vs: 'vs', cpu: 'CPU' },
  platformAtCompletion: 'Platform recorded at completion',

  // check detail (BA-44, BA-7, BA-8; F3)
  checkAt: (clock) => `Check at ${clock}`,
  decision: 'Decision',
  decisionOf: (orig, fin) => (orig && orig !== fin ? `${orig} → ${fin}` : fin),
  decisionNone: 'no decision recorded',
  defaultHoldNote: "The system held by default; the decision was not the model's. The platform's record of this check — not the agent's words.",
  riskTitle: 'Risk decisions',
  noRisk: 'No risk decision recorded',
  riskNote: 'This does not show which protections were armed or checked.',
  scores: 'Scores at the check',
  scoreParts: { active: 'active', banked: 'banked', total: 'total' },
  evidenceTitle: 'Evidence stamp',
  evidenceLabel: "Recorded at the check · what the agent was given · the platform's quote",
  evidenceNone: 'No evidence stamp recorded for this check.',
  evidenceFields: {
    px: "px · the platform's quote",
    chg: 'chg · change from entry, %',
    atrX: 'atrX · ATR multiple',
    atrXMeasured: 'atrX · measured reward multiple (frozen measured %)',
    vwapDev: 'vwapDev · VWAP deviation',
    bbPct: 'bbPct · band-width percentile',
    nr7: 'nr7',
    regime: 'regime',
    risk: 'risk',
  },
  yes: 'yes',
  no: 'no',
  notRecorded: 'not recorded',
  close: 'Close',

  // Study (BA-41 F1–F4, BA-45, BA-46, BA-47)
  jumps: [['holdings', 'Holdings'], ['swaps', 'Swaps'], ['directives', 'Directives'], ['meetings', 'Meetings'], ['plans', 'Plans'], ['rationale', 'Rationale'], ['checks', 'Checks']],
  holdings: 'Holdings',
  holdingsStart: 'Start',
  holdingsEnd: 'End',
  holdingsAt: (a, b) => `the first risk record ${a} · the last ${b}`,
  swapByMaker: { agent: 'a swap by the agent', platform: 'a swap by a platform rule', other: 'the gameplan meeting, or a maker not recorded' },
  swapMakerNote: 'who made the exit, as recorded',
  tapForDeep: 'tap a name for its Deep dive',
  swaps: 'Swaps',
  swapsNone: 'No swaps were recorded this day.',
  swapWord: 'Swap',   // "Swap 1 · 12:45 PM" — the ordinal is a marked number (addendum R4(a))
  slot: 'slot',
  banked: 'Banked',
  platformQuote: "the platform's quote",
  fork: 'Hold vs swap',
  holdPath: 'Hold path',
  swapPath: 'Swap path',
  heldLine: (sym) => `${sym} held`,
  boughtLine: (sym) => `${sym} bought`,
  rebuiltDashed: 'dashed · rebuilt from 1-minute bars',   // the legend beside drawn segments only (Astra F1)
  rebuiltDots: 'dots · rebuilt from 1-minute bars',   // beside rings only (isolated readings): no segment is drawn — "dots", never "points", the screen's word for score (R15)
  rebuiltDashedDots: 'dashed lines and dots · rebuilt from 1-minute bars',   // beside both
  hypothetical: 'hypothetical',
  laterTrades: 'later trades in this slot, not replayed',
  gap: 'Gap',
  gapNote: 'swap path minus hold path, at the close',
  closedLeg: 'At the sale · rebuilt minus banked',
  closedLegNote: 'agreement at the sale, not accuracy afterward',
  replayNone: 'No replay for this swap.',
  replayNotDrawn: 'No replay drawn for this swap',   // a replay written with no mark to draw after the sale — then its stored reasons (R11, R15)
  replayNoneSeeCoverage: 'the replay coverage line above says why',   // once a candle pass has written the day's note (R11)
  replayCrypto: 'crypto legs are not replayed',
  split: 'Split by cause · the sale',
  splitRows: {
    recordedExit: (sym) => `Recorded exit · ${sym}`,
    barAtSwap: '1-minute bar at the swap',
    barMinusExit: 'Bar minus recorded exit',
    rescored: 'Rescored at the recorded exit',
    inputsPart: 'Inputs part',
    pricePart: 'Price part',
  },
  barClosedAt: (clock) => `bar closed ${clock}`,
  fill: 'The fill',
  fillRows: { recordedFill: (sym) => `Recorded fill · ${sym}`, barAtSwap: '1-minute bar at the swap', barMinusFill: 'Bar minus recorded fill' },
  missingLabel: 'missing:',   // then each stored input name, bound to its own path (Astra B2)
  deepDoor: (sym) => `Deep dive · ${sym}`,
  directives: 'Directives',
  directivesNone: 'No directive was filed this day.',
  directiveAt: (clock) => `Directive · ${clock}`,
  youAsked: 'You asked',
  directiveFiled: 'Directive filed',
  noNewDirective: 'No new directive filed',
  retainedLabel: 'Retained:',   // followed by the stored directive text, as a quotation (R7)
  noneInForce: 'Retained: none in force',
  receipt: 'Receipt',
  reached: (clock) => `Reached the agent's inputs at ${clock}`,
  unconfirmed: 'Receipt unconfirmed',
  reply: 'Chat reply at the time · not verified',
  replyDiffers: 'The filing record above stands; the reply at the time does not match it.',
  after: 'What followed',
  afterChecks: (n) => (n === 1 ? 'check followed:' : 'checks followed:'),
  afterHolds: (n) => (n === 1 ? 'hold' : 'holds'),
  afterSwaps: (n) => (n === 1 ? 'swap' : 'swaps'),
  explainerOpen: 'How a directive card reads',
  explainerClose: 'Hide the card states',
  explainerNote: 'Example cards · a fixture, not this battle · each state a card can take.',
  explainerLabels: { committed: 'Example · filed', no_change: 'Example · no change', not_filed: 'Example · not filed' },
  readMore: 'Read more',
  showLess: 'Show less',
  // R7: who a quotation's words are, as the tape records it; a stored record with no recorded author is named as
  // the record ("the stored plan"), never given a guessed one
  // B2: the player's own note on a filed card is credited "you" (spec §6; the ledger's `note`, bound by path)
  quoteBy: { agent: 'the agent', player: 'the player', platform: 'the platform', plan: 'the stored plan', directive: 'the stored directive', you: 'you' },
  plans: 'Plans',
  plansNone: 'No plan entries were recorded this day.',
  plansAll: 'All',
  threshold: 'Threshold',
  atPlan: 'At the plan',
  atClose: 'At the close',
  rationale: 'Rationale',
  rationaleNone: 'No rationale was recorded this day.',
  rationaleLabel: (clock) => `Recorded rationale at ${clock} · the agent's words at the time · not verified`,
  stateEntry: (clock, label) => `Check at ${clock} · ${label}`,
  stateEntryNote: "the platform's record of the check · not the agent's words",
  checksNone: 'No checks were recorded this day.',
  diagnostics: 'Diagnostics',
  diagnosticsPresent: 'Intraday diagnostic views were recorded for this battle-day.',

  // B2.1 A1 — Meetings (Build B spec §3 T2, acceptance H; Amendment J RJ-1): each meeting as the history records it —
  // its instants, its outcome and who resolved it, its legs, and its diagnosis as the platform's quoted words. The
  // section says nothing about whether a proposal was right (RE-5: the owner's record, never proof).
  meetings: 'Meetings',
  meetingsNote: 'as the meeting history records them',
  // the owner's record, never proof (RE-5; review SPR-RS-3): "recorded", as every other empty sentence says
  meetingsNone: 'No gameplan meeting was recorded this day.',
  // review SPR-S-1: an empty list under a section that is NOT complete — a meeting may have been created, not stored
  meetingsNoneStored: "This day's tape stores no gameplan meeting.",
  // R14: a tape with no meetings section at all (written before the meetings were taped) — an absence, said as one
  meetingsAbsent: "This day's tape has no meetings section.",
  meetingAt: (clock) => `Meeting · ${clock}`,
  meetingOutcome: { approved: 'approved', rejected: 'rejected', expired: 'expired' },
  meetingResolvedBy: 'resolved by',
  meetingInstants: { created: 'Created', deadline: 'Deadline, as recorded', resolved: 'Resolved' },
  meetingLegs: 'Legs',
  meetingLegNotCopied: 'not copied',
  // review SPR-S-5: true of an EMPTY legs list (a meeting proposing no swap) and of a missing one alike
  meetingLegsNone: 'no leg recorded',
  meetingDiagnosis: 'Diagnosis',
  // the check strip's run of "plan pending · awaiting approval" checks, inside a meeting's life: a door to that meeting
  runMeeting: 'Its meeting',

  // Deep dive (BA-12, BA-13, BA-43)
  deepPrice: 'Price',
  // B2.1 A2 (FR-02; Amendment J RJ-2): a symbol with no series says ITS OWN state — the reason the tape records
  // (coverage.series.notCharted, the candle pass's W5), else the plain sentence — never the section's "complete"
  noChart: { before: 'No chart for ', reasons: { crypto_not_supported: 'crypto is not charted', no_bars: 'no bars were returned for it' } },
  noChartRecorded: 'No chart was recorded for this symbol.',
  // Build B Amendment K RK-11: beside a CHARTED symbol, Deep dive says the symbol's own state — never the series
  // section's status, which stays on Glance's coverage line with its reasons; the symbol follows as record text
  chartRecordedFor: 'Chart recorded for ',
  // with no chart there is no marker: the stamps' recorded prices, listed by check (RJ-2)
  recordedPrices: 'The price the agent was shown at each check, as recorded · tap a check for its stamp',
  deepNoSymbols: 'No series were recorded for this day.',
  seriesReadError: 'The series for this day could not be read.',
  evidenceCoverage: 'Evidence coverage',
  checksIn1: 'check',
  sessionOpen: 'Session open',
  sessionHigh: 'Session high',
  sessionLow: 'Session low',
  lastBarClose: 'Close · the last 10-minute bar',
  changeOpenToClose: 'Change · open to close',
  volumeSession: 'Volume · session',
  // R4(b): each axis names its class once, in its caption (the ticks carry no marker)
  axisPrice: 'Price axis',
  axisPercent: '% from the session open',
  market: 'Market · SPY',
  sector: (etf) => `Sector · ${etf}`,
  sectorNone: 'Sector · none',
  volume: 'Volume',
  rebased: 'rebased to the session open',
  inTheBook: 'On the day',
  companyNameNotOnFile: 'Company name not on file',   // B2.1 A5 (FR-05; RJ-5): the directory lacks the symbol — no name is guessed
  sectorLine: 'Sector line',
  sectorLineNone: 'none · market line only',
  exitMark: 'Exit',
  entryMark: 'Entry',
  entryFor: 'in for',   // B2.1 A4 (RJ-4): "Entry · {time} · in for {sold symbol} · {maker}"
  evidenceOverlay: 'Evidence at each check',
  // B2.1 A6 (Amendment J RJ-6), verbatim: it claims no cause for any particular gap; its digits are a fixed phrase,
  // exempt by this copy key (A2F1-7)
  evidenceOverlayNote: 'A marker may sit off the bar line: the price the agent was shown came from a quote that runs about 15–20 minutes behind the bars, and the bars are not smoothed.',
  allSymbols: 'All symbols',
  close10: 'close',

  // later-release regions (BA-47) — named, empty
  reservedHeader: ['since-last-time', 'prepared-case'],
  reservedFooter: ['your-call', 'receipt'],

  // Film Room B2 — the card (Build B spec §6; Amendment G RG-2 … RG-9): the four regions' words. They render only
  // under FILM_ROOM_CARDS_MODE for an admitted owner; otherwise the regions above stay empty (the golden).
  cards: {
    sinceLastTime: 'Since last time',
    preparedCase: 'Prepared case',
    yourCall: 'Your call',
    receipt: 'Receipt',
    moments: 'Moments',
    momentsNote: 'longest first · a moment is a run of checks when a holding had stalled',
    momentsNone: "No moments matched this day's situations.",
    // R14: an absence, said as one — a tape day with no situations section at all (written before the tagger ran)
    tagsAbsent: "This day's tape has no situations section.",
    takeHome: 'Take this home',
    countAgainst: 'count',
    thresholdWord: 'against a threshold of',
    checkTag: 'Situation at this check',
    question: 'Pick a question',
    note: 'Your note',
    noteLimit: 'characters',
    routeTitle: 'What happens next',
    routes: { watch: 'Watch', drill: 'Practice', set: 'Set' },
    // RG-5: each route says only what will happen
    routeNotes: {
      watch: 'The Film Room counts each time this comes back.',
      drill: 'The Practice Field opens later; this keeps the moment for it.',
      set: 'You change the setting yourself; this card changes nothing.',
    },
    // B2.1 B1 (Amendment H RH-1; Amendment J RJ-8): with the day's stagnation rule on, Set links the one setting that
    // reaches this situation — the tempo dial, in the Forge workshop; with it off, it says no setting changes it
    setTempoLink: 'Tempo dial · Forge workshop',
    setRuleOff: 'No setting changes this situation for this archetype.',
    // Build B Amendment K RK-2: the rule on, but the tape records no tempo set on the battle (a casual clone inherits no
    // dial; an agent whose dial was never set records none either) — said after RG-5's sentence, with no link
    setNoTempo: 'No tempo setting was recorded for this battle.',
    openCards: 'Open cards',
    // the count line before the counter has answered, and when it could not: words, no number (R14)
    openCountLoading: 'Open cards · still loading',
    openCountUnknown: 'Open cards · could not be read',
    file: 'File this card',
    cancel: 'Cancel',
    filing: 'Filing…',
    refusals: {
      cap_reached: 'The open-card cap for this agent is reached. Retire a card first.',
      moment_not_found: "That moment is not on this day's tape.",
      // B2.1 review SPR-C-2: the day was re-tagged while the card was being filed (nothing was filed)
      source_changed: "This day's tape changed while the card was being filed. Try again.",
      disabled: 'Cards are not on for this battle.',
      note_too_long: 'The note is over its limit.',
      note_control_char: 'The note holds a character a card cannot keep.',
      note_empty: 'The note needs some words.',
      version_conflict: 'This card changed since it was loaded. Reload and try again.',
      shelved: 'This card is shelved and cannot move.',
      untaped: 'This battle mode is not taped.',
      archetype_changed: "The agent is on another archetype than this day's tape records. This card cannot be filed.",
      op_conflict: 'This id was already used for a card with other words.',
      tape_unreadable: 'The tape for this day could not be read. Try again.',
      // Amendment K RK-1 (review KRV1-1): the agent the card belongs to — a casual clone's parent — could not be resolved
      attribution_unavailable: 'The agent this card belongs to could not be resolved. Nothing was changed. Try again.',
      tape_not_found: 'No tape for this day.',
      tags_unavailable: "This day's tape has no situations to take home.",
      question_not_on_menu: 'That question is not on the menu for this situation.',
      illegal_transition: 'This card has already moved.',
      forbidden: 'Not authorized for this battle.',
      not_found: 'This battle was not found.',
      default: 'The card could not be filed.',
      retireDefault: 'The card could not be retired.',
    },
    filedCard: 'The filed card',
    situation: 'Situation',
    on: 'on',
    route: 'Route',
    stage: 'Stage',
    stageWords: { card: 'card', nominated: 'nominated for the Practice Field', retired: 'retired' },
    // RG-5 for a card that is no longer open: what happens next is nothing, said so
    stateNotes: {
      retired: 'Retired: nothing happens next.',
      shelved: 'Shelved: nothing happens while the agent is on another archetype.',
    },
    retire: 'Retire',
    retiring: 'Retiring…',
    recurrences: 'Since this card',
    noRecurrence: 'No recurrence recorded since this card.',
    // B2.1 B3 (RH-6), in RJ-7's style: "Recurrences · {n} days in this window could not be read"
    recurrencesWord: 'Recurrences',
    unavailableDays: (n) => (n === 1 ? 'day in this window could not be read' : 'days in this window could not be read'),
    // B2.1 B2 (RH-2): a recurrence in another battle opens that battle's Film Room day at its moment; when the battle
    // cannot be read, the row says so and nothing opens
    otherBattle: 'in another battle',
    otherBattleUnreadable: 'That battle could not be read, so it was not opened.',
    noWatchCards: 'No open Watch card.',
    myCards: 'My cards',
    groups: { active: 'Active', shelved: 'Shelved', retired: 'Retired', other: 'Other' },
    noCards: 'No cards yet.',
    shelvedExplainer: 'A card made under another archetype is shelved: kept, not counted as open, and back by itself when the agent returns to that archetype.',
    loading: 'Loading the cards…',
    readError: 'The cards could not be read.',
    openCard: 'Show',
  },
});

/**
 * F6 — the explainer's three example cards. CLEARLY LABELLED FIXTURES: the
 * card says so on its face, and nothing here is read from any battle.
 */
export const DIRECTIVE_EXPLAINER = Object.freeze([
  { cardState: 'committed', playerText: 'Protect the lead into the close.', canonicalText: 'Tighten the downside stop.', retainedDirectiveText: null, heardClock: 'the next check', agentReply: 'Heard. I will tighten the stop for the rest of the session.' },
  { cardState: 'no_change', playerText: 'Sell everything right now.', canonicalText: null, retainedDirectiveText: 'Tighten the downside stop.', heardClock: null, agentReply: 'That runs against how I trade; the plan stays as it is.' },
  { cardState: 'not_filed', playerText: 'Tilt into chips for the last hour.', canonicalText: null, retainedDirectiveText: null, heardClock: null, agentReply: 'Done — a chip tilt is filed.', agentReplyDiffers: true },
]);

/** BA-41 / the sweep: words the screen's own copy never uses (recorded quotations are the record's). */
export const FORBIDDEN_WORDS = Object.freeze(['biggest', 'best', 'worst', 'mistake', 'should have', 'missed', 'good trade', 'bad trade', 'lesson', 'grade']);
