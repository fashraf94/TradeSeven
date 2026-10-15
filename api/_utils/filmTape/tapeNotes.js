// api/_utils/filmTape/tapeNotes.js
//
// Film Room B1 item 8 — W4: the counted notes the writers compose, with the
// right singular or plural. Before W4 they printed "check(s)", "entr(y/ies)"
// and the like; now each count agrees with its noun, verb and pronoun, and no
// other word changes. PURE, zero product imports.
//
// ONE PLACE FOR EVERY COUNTED NOTE: the close pass (tapeAssemble.js) and the
// candle pass (candlePass.js) compose through NOTES; nothing else words them.
//
// THE MERGE AND THE OLD WORDING: a close-pass section's caveats are unioned
// across runs (BA-26), so a tape written before W4 and re-merged after it
// would carry the same fact twice, once in each wording. `modernNotes`
// rewrites the old wording of every counted note into the new one — the same
// composer, the same count — and the merge applies it to the stored caveats
// and note before the union (tapeMerge.js mergeCoverage). A tape never
// re-merged keeps its notes as written.

/** "1 check" / "2 checks" — a count with its noun in the right number. */
export const counted = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const one = (n) => n === 1;

/**
 * What a check with no record leaves unknown, per section, as the singular
 * and the plural clause (tapeAssemble.js unknownReason).
 */
export const UNKNOWN_WHAT = Object.freeze({
  directives: Object.freeze({ one: 'a heard stamp, and the checks after a filing, are', many: 'a heard stamp, and the checks after a filing, are' }),
  plans: Object.freeze({ one: 'plans it recorded are', many: 'plans they recorded are' }),
  rationale: Object.freeze({ one: 'rationale it recorded is', many: 'rationale they recorded is' }),
  evidence: Object.freeze({ one: 'evidence stamps it recorded are', many: 'evidence stamps they recorded are' }),
  calls: Object.freeze({ one: 'its declarations phase, and so an absent declarations record, is', many: 'their declarations phase, and so an absent declarations record, is' }),
});

export const NOTES = Object.freeze({
  // the close pass (tapeAssemble.js)
  evictedEntries: (n) => `${counted(n, 'check', 'checks')} recorded an evalId whose evaluation entry is absent (evicted: older than the oldest surviving entry)`,
  lostEntries: (n) => `${counted(n, 'check', 'checks')} recorded an evalId whose evaluation entry is absent`,
  unknownChecks: (n, what) => (one(n)
    ? `1 minted check of this day has no record of what it read or produced (no tick record, or an evaluation entry that is absent) — ${what.one} unknown for it`
    : `${n} minted checks of this day have no record of what they read or produced (no tick record, or an evaluation entry that is absent) — ${what.many} unknown for them`),
  gapsAttributed: (n, list) => `${counted(n, 'minted check', 'minted checks')} of this day ${one(n) ? 'has' : 'have'} no record (tickSeq ${list})`,
  gapsUnattributed: (n, list) => `${counted(n, 'minted check', 'minted checks')} adjacent to this day ${one(n) ? 'has no record and its day cannot' : 'have no record and their day cannot'} be established (tickSeq ${list})`,
  entryOnly: (n) => (one(n)
    ? '1 evaluation entry has no tick record; its sequence number is among the gaps'
    : `${n} evaluation entries have no tick record; their sequence numbers are among the gaps`),
  missingSlots: (n, times) => `no run record for ${counted(n, 'evaluator slot', 'evaluator slots')} (${times} ET) — a check in ${one(n) ? 'it' : 'them'} may be missing or its deferral unlisted`,
  untradedSwaps: (cap, n) => `trades[] is at its ${cap}-entry cap and its oldest surviving entry is not before this day — ${counted(n, 'swap', 'swaps')} ${one(n) ? 'has' : 'have'} no trade record here (possibly evicted): tier, slot, exit price and locked gain unknown`,
  earlyCards: (n) => `${counted(n, 'card', 'cards')} filed before this ET day (after the battle's activation or the previous trading day) ${one(n) ? 'is' : 'are'} shown here`,
  platformAuthored: (n) => `${counted(n, 'entry', 'entries')} carried platform-written text (a placeholder or a guardrail override), not the agent's words — not copied`,
  noModelCheck: (known, unknownGaps) => `no model check recorded among the ${counted(known, 'known check', 'known checks')}${unknownGaps ? `; ${counted(unknownGaps, 'check', 'checks')} ${one(unknownGaps) ? 'has' : 'have'} no record` : ''}`,
  declarationsUnread: (n) => `${counted(n, 'check', 'checks')} expected a declarations record this read did not look up (an evaluation newer than the read)`,
  declarationsAbsent: (n) => `${counted(n, 'check', 'checks')} expected a declarations record that is absent (failed or unconfirmed — contract §2.1)`,
  lostDeclarations: (n) => `${counted(n, 'check', 'checks')} recorded an evalId whose evaluation entry is absent — whether ${one(n) ? 'it' : 'they'} expected a declarations record is unknown`,
  // the candle pass (candlePass.js)
  cryptoLegs: (n) => `${counted(n, 'crypto leg', 'crypto legs')} not replayed (crypto_not_supported)`,
  noFreshPrice: (n) => `no fresh price at ${counted(n, 'check', 'checks')}`,
  builtBeforeChecks: (n) => `built before ${counted(n, 'check', 'checks')} ${one(n) ? 'was' : 'were'} recorded`,
});

// ── the old wording (before W4), each mapped to its composer ────────────────

const WHAT_BY_MANY = Object.fromEntries(Object.values(UNKNOWN_WHAT).map((w) => [w.many, w]));
const whatAlternation = Object.values(UNKNOWN_WHAT).map((w) => w.many.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const N = '(\\d+)';

/** Each legacy wording as written by the pre-W4 writers, and how to say it now. Global: a note may hold several. */
const LEGACY = [
  [new RegExp(`${N} check\\(s\\) recorded an evalId whose evaluation entry is absent \\(evicted: older than the oldest surviving entry\\)`, 'g'), (m, n) => NOTES.evictedEntries(+n)],
  [new RegExp(`${N} check\\(s\\) recorded an evalId whose evaluation entry is absent — whether they expected a declarations record is unknown`, 'g'), (m, n) => NOTES.lostDeclarations(+n)],
  [new RegExp(`${N} check\\(s\\) recorded an evalId whose evaluation entry is absent`, 'g'), (m, n) => NOTES.lostEntries(+n)],
  [new RegExp(`${N} minted check\\(s\\) of this day have no record of what they read or produced \\(no tick record, or an evaluation entry that is absent\\) — (${whatAlternation}) unknown for them`, 'g'), (m, n, what) => NOTES.unknownChecks(+n, WHAT_BY_MANY[what])],
  [new RegExp(`${N} minted check\\(s\\) of this day have no record \\(tickSeq ([\\d, ]+)\\)`, 'g'), (m, n, list) => NOTES.gapsAttributed(+n, list)],
  [new RegExp(`${N} minted check\\(s\\) adjacent to this day have no record and their day cannot be established \\(tickSeq ([\\d, ]+)\\)`, 'g'), (m, n, list) => NOTES.gapsUnattributed(+n, list)],
  [new RegExp(`${N} evaluation entr\\(y/ies\\) have no tick record; their sequence numbers are among the gaps`, 'g'), (m, n) => NOTES.entryOnly(+n)],
  [new RegExp(`no run record for ${N} evaluator slot\\(s\\) \\(([\\d:, ]+) ET\\) — a check in them may be missing or its deferral unlisted`, 'g'), (m, n, times) => NOTES.missingSlots(+n, times)],
  [new RegExp(`trades\\[\\] is at its ${N}-entry cap and its oldest surviving entry is not before this day — ${N} swap\\(s\\) have no trade record here \\(possibly evicted\\): tier, slot, exit price and locked gain unknown`, 'g'), (m, cap, n) => NOTES.untradedSwaps(+cap, +n)],
  [new RegExp(`${N} card\\(s\\) filed before this ET day \\(after the battle's activation or the previous trading day\\) are shown here`, 'g'), (m, n) => NOTES.earlyCards(+n)],
  [new RegExp(`${N} entr\\(y/ies\\) carried platform-written text \\(a placeholder or a guardrail override\\), not the agent's words — not copied`, 'g'), (m, n) => NOTES.platformAuthored(+n)],
  [new RegExp(`no model check recorded among the ${N} known check\\(s\\)(?:; ${N} check\\(s\\) have no record)?`, 'g'), (m, known, gaps) => NOTES.noModelCheck(+known, gaps === undefined ? 0 : +gaps)],
  [new RegExp(`${N} check\\(s\\) expected a declarations record this read did not look up \\(an evaluation newer than the read\\)`, 'g'), (m, n) => NOTES.declarationsUnread(+n)],
  [new RegExp(`${N} check\\(s\\) expected a declarations record that is absent \\(failed or unconfirmed — contract §2\\.1\\)`, 'g'), (m, n) => NOTES.declarationsAbsent(+n)],
];

/** The pre-W4 wording of every counted close-pass note in `text`, said the W4 way. Any other text is returned as it is. */
export function modernNotes(text) {
  if (typeof text !== 'string') return text;
  let out = text;
  for (const [re, say] of LEGACY) out = out.replace(re, say);
  return out;
}
