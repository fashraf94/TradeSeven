// src/components/Research/ChartRead/chartReadCopy.js
//
// The Chart view's read — EVERY WORD IT SHOWS (build prompt §5, §6, CR-8; spec docs/specs/CHART_READ_SPEC_V1.md).
// Fixed wording, filled only from the stored record's own fields by chartRead.js: no model, no free text.
// Scanned by src/components/Research/Sheet/sheetCopy.honesty.test.jsx (the chart read's block): never
// "will", "likely", "should buy", "live", and never a stop or a target beside a price (RD-13).
//
// TWO PARTS:
//   CHART_READ_COPY   the read's frame, shared by every rule set: the eyebrow, the date, the quiet states,
//                     the footnotes, the sheet's frame, the chart's chip and notes.
//   RULE_SET_COPY     per rule set (CR-9): the words of one detector — its leads, its check rows and their
//                     plain definitions, its marks' names, its other readings. A new detector adds an entry;
//                     it changes no existing one. Today one entry: tf-setup-v1, the Trend Follower's setup
//                     check (CR-8: the read is named by the playbook's strategy, not by an archetype).
//
// DATA AND SMALL TEMPLATES ONLY: no imports, no logic beyond joining the words handed in.

/** Clauses in words: "a", "a, and b", "a, b, and c" (round 6: "closed below its 20-day ($90.15), and the 50-day is falling"). */
export const joinClauses = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`);
/** Nouns in words: "a", "a and b", "a, b and c". */
export const joinNouns = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

export const CHART_READ_COPY = Object.freeze({
  eyebrow: 'Setup check · daily',
  asOf: (day) => `as of ${day} close`,
  asOfBehind: (day) => `As of ${day} close (today’s isn’t in yet)`,
  // RD-8: during and after a session whose record isn't in yet.
  sessionNote: (weekday) => `${weekday}’s close. Today’s session is read after it ends.`,
  // RD-10: the record's bars had no adjusted close.
  adjustmentNote: 'The split check couldn’t run on this record.',
  // Round 6 F: on the Battle chart the read stays as text and says where its marks are.
  battleNote: 'Daily marks are on 1D and 1W, not on these 30-minute bars.',
  // The quiet states (§5): one line, no sheet.
  absent: 'Measured after each close; no read yet for this stock.',
  refusedLead: 'No read for this stock today',
  refusedRest: (why) => ` — ${why}.`,
  unknownLead: 'Not enough to read',
  unknownRest: (why) => ` — ${why}.`,
  // MK-2: a rule set this app has no table for.
  unknownRuleSet: (ruleSet) => `Measured by rule set ${ruleSet}; this app can’t show that rule’s marks yet.`,
  // A record whose fields don't agree with themselves is never shown in part (fail closed).
  unshown: 'This record can’t be shown.',
  // RD-12: a failed read.
  failed: 'Couldn’t load the setup check',
  retry: 'Try again',
  // The read opens the sheet.
  openLabel: 'Open the checks',
  // The sheet's frame (§6).
  sheetLabel: 'The checks',
  sheetEyebrow: 'The checks · setup check',
  sheetHint: (asOf) => `${asOf} · tap a check to light its mark`,
  closeLabel: 'Close the checks',
  groupCount: (n, of) => `${n} of ${of}`,
  notPresent: 'not present',
  theOtherPattern: 'the other pattern',
  collapsed: 'Entry patterns are read only in an uptrend.',
  expand: 'Show the pattern checks',
  contextTitle: 'Context, not part of the check',
  sectorName: 'Sector rank',
  sectorReading: (n, time) => `${n} of 100 within its sector · 20 sessions · 0 is weakest · read ${time}; may include today’s unfinished session`,
  sectorNone: 'no reading',
  sectorDef: 'A 20-session rank within the sector. Optional context, not part of the rule.',
  otherReadingTitle: 'The other reading',
  separatesTitle: 'What separates them',
  footProvenance: 'Read from the stored record. Nothing is computed here; no message cost.',
  footBasis: (day) => `daily · completed sessions · prices unadjusted · as of ${day} close`,
  // Result glyphs' words for assistive tech.
  resultWords: Object.freeze({ pass: 'holds', fail: 'does not hold', unknown: 'not measured', quiet: 'not present' }),
  // The chart (CR-5, CR-7, MK-5).
  ruleChip: 'Rule',
  basisNote: 'prices unadjusted',
  dailyStub: (weekday) => `20-day · daily · ${weekday} close`,
  // Round 6: the Technical content's levels are their own calculation, and say so.
  levelsApart: 'Support and resistance · its own calculation · not the rule’s 20-session high and low',
  marksLabel: (names) => `Rule marks on the chart: ${names}`,
  // What changed (CR-6): one chip above the lead, from `read` and `previous` only, by a fixed table.
  change: Object.freeze({
    newPullback: (day) => `New since ${day}: touched the 20-day and closed back above it.`,
    newBreakout: (day) => `New since ${day}: closed at or above the 20-session high.`,
    stretched: (day) => `Since ${day}: stretched past the limit.`,
    patternGone: (day) => `Since ${day}: the entry pattern is gone; still in an uptrend.`,
    leftUptrend: (day) => `Since ${day}: left the uptrend.`,
    backInUptrend: (day) => `Since ${day}: back in an uptrend.`,
  }),
});

/**
 * The words of one refusal reason (the daily-bars adapter's closed list, ADAPTER_REFUSALS in
 * api/_utils/setupEvaluator/dailyBarsAdapter.js; pinned equal in chartRead.test.js, so a new reason can never
 * render raw). `basis_discontinuity` is round 6's own wording.
 */
export const REFUSAL_WORDS = Object.freeze({
  unsupported_symbol_class: 'this kind of symbol isn’t read',
  calendar_missing: 'the market calendar couldn’t name the session',
  asOf_not_a_session: 'the date asked for wasn’t a trading session',
  asOf_in_future: 'the date asked for hadn’t happened yet',
  missing_bar: 'the session’s daily bar was missing',
  unordered_bars: 'the daily bars came back out of order',
  insufficient_history: 'fewer than 55 completed sessions of history',
  missing_fact: 'a number the check needs was missing',
  basis_discontinuity: 'a split or dividend inside the window',
});
/** Any reason off that list. */
export const REFUSAL_FALLBACK = 'the evidence couldn’t be used';

export const RULE_SET_COPY = Object.freeze({
  'tf-setup-v1': Object.freeze({
    // CR-8: the sheet's footer names the rule set.
    footRuleSet: 'Rule set tf-setup-v1 · built as Trend Follower’s setup check',
    patterns: Object.freeze({ pullback_resume: 'Pullback and Resume', breakout: 'Trend Breakout' }),
    // The leads (§5).
    pullbackLead: 'Pullback and Resume · present',
    pullbackRest: (sma) => ` — touched its 20-day (${sma}) and closed back above it.`,
    pullbackSecond: 'Volume isn’t part of this pattern; participation is unconfirmed.',
    breakoutLead: 'Trend Breakout · present',
    breakoutRest: (high, x) => ` — closed at or above the 20-session high (${high}) on ${x}× average volume.`,
    regimeLead: 'Not in an uptrend',
    regimeRest: (parts) => ` — ${joinClauses(parts)}.`,
    // RD-7: only the checks that failed, each true at equality too.
    regimePart: Object.freeze({
      closeBelow: (sma) => `closed below its 20-day (${sma})`,
      closeAt: (sma) => `closed at its 20-day (${sma})`,
      fastBelow: 'the 20-day is below the 50-day',
      fastLevel: 'the 20-day is level with the 50-day',
      slowFalling: 'the 50-day is falling',
      slowFlat: 'the 50-day is flat over five sessions',
    }),
    regimeSecond: 'It changes with closes back above the 20-day and the 50-day turning up. This is not a downtrend call.',
    regimeSecondDowntrend: 'It changes with closes back above the 20-day and the 50-day turning up.',
    noSetupLead: 'In an uptrend; no entry pattern today.',
    noSetupSecond: (sma, high) => `A pullback needs a low at or below the 20-day (${sma}). A breakout needs a close at or above ${high} on 1.5× average volume.`,
    extendedLead: (names, many) => `${names} ${many ? 'patterns' : 'pattern'} present, but stretched`,
    extendedRest: ' — the close is more than 2 ATR above the 20-day.',
    extendedSecond: 'The check says wait.',
    // The facts in words (an unknown verdict's lead).
    facts: Object.freeze({
      C: 'the close', SMA_fast: 'the 20-day', SMA_slow: 'the 50-day', SMA_slow_5ago: 'the 50-day five sessions ago',
      swingHigh: 'the 20-session high', swingLow: 'the 20-session low', ATR: 'the 14-session ATR', V: 'the session’s volume', V_avg: 'the 20-session average volume',
    }),
    missingOne: (fact) => `${fact} is missing`,
    missingMany: (facts) => `${facts} are missing`,
    missingLow: 'a low of the last three sessions is missing',
    // The sheet's groups (§6, CR-3).
    groups: Object.freeze({ uptrend: 'The uptrend', pullback_resume: 'Pullback and Resume', stretch: 'The stretch guard', breakout: 'Trend Breakout' }),
    // The check rows: name, the two sides' labels, the plain definition (SH-1; round 6's accepted definitions).
    rows: Object.freeze({
      closeAboveFast: Object.freeze({ name: 'Close above the 20-day', lhs: 'close', rhs: '20-day', def: 'The 20/50 regime: the close above the 20-day, the 20-day above the 50-day, the 50-day rising over five sessions.' }),
      fastAboveSlow: Object.freeze({ name: '20-day above the 50-day', lhs: '20-day', rhs: '50-day', def: 'Part of the 20/50 regime.' }),
      slowRising: Object.freeze({ name: '50-day rising over five sessions', lhs: 'now', rhs: 'five sessions ago', def: 'Part of the 20/50 regime.' }),
      touch: Object.freeze({ name: 'The touch', lhs: 'lowest of three lows', rhs: '20-day', def: 'The lowest low of the last three sessions is at or below the 20-day average. It does not prove the bounce came in that order, or that support held.' }),
      pullbackClose: Object.freeze({ name: 'Close above the 20-day', lhs: 'close', rhs: '20-day', def: 'The close back above the 20-day average, the pattern’s second half.' }),
      extension: Object.freeze({ name: 'Within the stretch limit', lhs: 'close', rhs: '20-day + 2 × ATR', def: 'The close is no more than 20-day + 2 × ATR. It bounds distance; it doesn’t measure odds.' }),
      breakoutClose: Object.freeze({ name: 'Close at or above the 20-session high', lhs: 'close', rhs: (day) => (day ? `high · ${day}` : 'high'), def: 'The close at or above the highest high of the 20 sessions before it. It belongs to Trend Breakout only.' }),
      volumeFloor: Object.freeze({ name: 'The volume floor', lhs: 'volume', rhs: (avg) => `1.5 × the ${avg} average`, def: 'Volume at least 1.5 × its 20-session average. It belongs to the breakout only.' }),
    }),
    // The marks' names on the chart (§4), by id.
    marks: Object.freeze({
      sma_fast: '20-day', sma_slow: '50-day', sma_slow_5ago: '50-day, 5 sessions ago', touch_low: 'the touch',
      swing_high: '20-session high', swing_low: '20-session low', extension_limit: 'stretch limit',
    }),
    // SH-5: the other reading and what separates them, per state the sheet opens in. Round 6's wording where it
    // has it (valid · Pullback and Resume); the rest written from the rule's own checks, for the founder to check.
    other: Object.freeze({
      valid_pullback: Object.freeze({ reading: 'A failed bounce in a weakening trend.', separates: (weekday) => `The next close against that session’s own 20-day. That number doesn’t exist yet; mark 1 is ${weekday}’s.` }),
      valid_breakout: Object.freeze({ reading: 'A breakout that slips back under the high it cleared.', separates: (weekday) => `The next closes against the 20-session high it cleared. Mark 5 is the high before ${weekday}; each session has its own.` }),
      regime: Object.freeze({ reading: 'A dip inside a trend that hasn’t turned.', separates: (weekday) => `The three uptrend checks: a close above the 20-day, the 20-day above the 50-day, and the 50-day rising. Marks 1 and 2 are ${weekday}’s; mark 3 is the 50-day five sessions earlier.` }),
      no_setup: Object.freeze({ reading: 'A trend that is tiring, not pausing.', separates: () => 'A low that reaches the 20-day (mark 1), or a close at or above the 20-session high (mark 5) on 1.5× average volume.' }),
      extended: Object.freeze({ reading: 'Strength that keeps going without a pullback.', separates: (weekday) => `The close coming back within the stretch limit while the pattern still holds. Mark 7 is ${weekday}’s limit; each session has its own.` }),
    }),
  }),
});
