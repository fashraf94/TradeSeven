// src/screens/filmRoomV2/filmRoomCopy.js
//
// Film Room v2 (A2) — EVERY WORD THE SCREEN SAYS, in one table (the
// battleViewCopy precedent). The wording is the spec's where the spec fixes it
// (V1.2 BA-4, BA-7, BA-9, BA-10, BA-11, BA-21, BA-22; Amendment D BA-38;
// Amendment E BA-41 … BA-49) and the design of record's otherwise
// (docs/design/20261008_FILM_ROOM_A2_MOCKUP.html). No verdict, no ranking, no
// lesson, no advice, no new agent voice, and never a "Why?" heading — the
// screen suites sweep the rendered output for the forbidden words.

import { PROVENANCE_LABELS, LOCKED_BASIS_NOTE, REPLAY_VERSION_NOTE } from '../../constants/filmTape';

export { PROVENANCE_LABELS, LOCKED_BASIS_NOTE, REPLAY_VERSION_NOTE };

/** The marker letter for each class (BA-42): one letter in a hairline box; rebuilt is dashed, like its lines. */
export const CLASS_LETTER = Object.freeze({ recorded: 'R', derived: 'D', rebuilt: 'B', market: 'M' });

/**
 * BA-11's one-step-hypothetical sentence — the same words the candle pass
 * stores on every replay as `label` (api/_utils/filmTape/tapeReplay.js
 * REPLAY_LABEL; the screen suites pin the two equal). A card shows the
 * replay's own stored label when it has one, and this when it has none.
 */
export const REPLAY_SENTENCE = "one-step hypothetical through the day's close; later trades in this slot are not replayed; not the effect of the swap on the battle";

export const FILM_ROOM_COPY = Object.freeze({
  title: 'Film Room',
  back: 'Back',
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
  noTapeScheduled: (clock) => `The close pass for this day is scheduled at ${clock} ET.`,
  noTapeLater: 'The close pass that tapes this day has not run yet.',
  noTapeUnavailable: 'Not available.',
  readError: 'The tape for this day could not be read.',
  earlierDay: "This day's tape was written while the battle was in progress; the battle's final result is recorded on its last day.",
  openLastDay: (label) => `Open ${label}`,
  skippedMode: 'This battle mode is not taped.',
  closeNotWritten: (status) => `The close pass for this day did not write a tape (${status}).`,

  // section counts (Amendment E addendum R4(a)) — "Checks · 23 of 23", "Holdings · 7 slots"
  countOf: 'of',
  countRecorded: 'recorded',
  slots: 'slots',

  // coverage (BA-20)
  coverage: 'Coverage',
  replayCoverage: 'Replay coverage',
  coverageLabel: { complete: 'complete', partial: 'partial', unavailable: 'unavailable' },
  preservedFrom: 'preserved from an earlier run',

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
  jumps: [['holdings', 'Holdings'], ['swaps', 'Swaps'], ['directives', 'Directives'], ['plans', 'Plans'], ['rationale', 'Rationale'], ['checks', 'Checks']],
  holdings: 'Holdings',
  holdingsStart: 'Start',
  holdingsEnd: 'End',
  holdingsAt: (a, b) => `the first risk record ${a} · the last ${b}`,
  swapByMaker: { agent: 'a swap by the agent', platform: 'a swap by a platform rule', other: 'the gameplan meeting, or a maker not recorded' },
  swapMakerNote: 'who made the exit, as recorded',
  tapForDeep: 'tap a name for its Deep dive',
  swaps: 'Swaps',
  swapsNone: 'No swaps were recorded this day.',
  swapAt: (clock) => `Swap · ${clock}`,
  slot: 'slot',
  banked: 'Banked',
  platformQuote: "the platform's quote",
  fork: 'Hold vs swap',
  holdPath: 'Hold path',
  swapPath: 'Swap path',
  heldLine: (sym) => `${sym} held`,
  boughtLine: (sym) => `${sym} bought`,
  rebuiltDashed: 'dashed · rebuilt from 1-minute bars',
  hypothetical: 'hypothetical',
  laterTrades: 'later trades in this slot, not replayed',
  gap: 'Gap',
  gapNote: 'swap path minus hold path, at the close',
  closedLeg: 'At the sale · rebuilt minus banked',
  closedLegNote: 'agreement at the sale, not accuracy afterward',
  replayNone: 'No replay for this swap.',
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
  missing: (names) => `missing: ${names.join(', ')}`,
  deepDoor: (sym) => `Deep dive · ${sym}`,
  directives: 'Directives',
  directivesNone: 'No directive was filed this day.',
  directiveAt: (clock) => `Directive · ${clock}`,
  youAsked: 'You asked',
  directiveFiled: 'Directive filed',
  noNewDirective: 'No new directive filed',
  retained: (text) => `Retained: ${text}`,
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
  explainerNote: 'Example cards · a fixture, not this battle · the three states a card can take.',
  explainerLabels: { committed: 'Example · filed', no_change: 'Example · no change', not_filed: 'Example · not filed' },
  readMore: 'Read more',
  showLess: 'Show less',
  plans: 'Plans',
  plansNone: 'No plan entries were recorded this day.',
  plansAll: 'All',
  threshold: 'Threshold',
  atPlan: 'At the plan',
  atClose: 'At the close',
  rationale: 'Rationale',
  rationaleNone: 'No rationale was recorded this day.',
  rationaleLabel: (clock) => `Recorded rationale at ${clock} · the agent's words at the time · not verified`,
  rationaleOpen: 'Show the recorded words',
  rationaleClose: 'Hide',
  stateEntry: (clock, label) => `Check at ${clock} · ${label}`,
  stateEntryNote: "the platform's record of the check · not the agent's words",
  checksNone: 'No checks were recorded this day.',
  diagnostics: 'Diagnostics',
  diagnosticsPresent: 'Intraday diagnostic views were recorded for this battle-day.',

  // Deep dive (BA-12, BA-13, BA-43)
  deepPrice: 'Price',
  deepNoSeries: (sym) => `No series for ${sym}.`,
  deepNoSymbols: 'No series were recorded for this day.',
  seriesReadError: 'The series for this day could not be read.',
  evidenceCoverage: 'Evidence coverage',
  checksIn1: 'check',
  sessionOpen: 'Session open',
  sessionHigh: 'Session high',
  sessionLow: 'Session low',
  lastBarClose: 'Close · the last 10-minute bar',
  market: 'Market · SPY',
  sector: (etf) => `Sector · ${etf}`,
  sectorNone: 'Sector · none',
  volume: 'Volume',
  rebased: 'rebased to the session open',
  inTheBook: 'On the day',
  sectorLine: 'Sector line',
  sectorLineNone: 'none · market line only',
  exitMark: 'Exit',
  entryMark: 'Entry',
  evidenceOverlay: 'Evidence at each check',
  evidenceOverlayNote: "A marker may sit off the bar line: the platform's quote runs about 15–20 minutes behind the bars. The difference is that delay, not smoothed.",
  allSymbols: 'All symbols',
  close10: 'close',

  // later-release regions (BA-47) — named, empty
  reservedHeader: ['since-last-time', 'prepared-case'],
  reservedFooter: ['your-call', 'receipt'],
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
