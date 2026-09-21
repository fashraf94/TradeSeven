// api/_utils/tickCapture/captureCoverage.js
//
// Tick capture — THE THREE C-1 FIGURES, as pure functions.
//
// The export script (scripts/export-tick-capture.js) is a thin runner over
// this module: if a number is missing or wrong, it is fixed HERE, with a unit
// test, not in the runner (the measure-l1-corpus.js precedent).
//
// WHAT C-1 ACTUALLY SAYS, and why each denominator is the one it is:
//
//   coverage = captured ÷ MINTED, where minted is the PERSISTED COUNTER
//     (`cronState.tickSeq`). The highest captured sequence is explicitly NOT
//     the denominator, because it cannot reveal a TRAILING gap: if the last
//     three ticks of a battle failed to capture, the highest captured sequence
//     is the last one that worked and the ratio comes out at 1.
//
//   usable pairs = captured ticks whose body holds a COMPLETE, UNTRUNCATED
//     request AND response ÷ captured ticks KNOWN TO HAVE DISPATCHED a model
//     request. A tick that never reached the call is not a failed pair, and a
//     MISSING tick is not in either side — we cannot know whether it dispatched,
//     so it is reported separately as ATTEMPT UNKNOWN. No figure here is ever
//     presented as an all-attempts rate.
//
//   expired = bodies removed by the TTL policy: the permanent record exists and
//     its body document does not. Counted separately and NEVER as a gap. It
//     stays in the usable-pairs denominator (it was a dispatched, captured
//     tick) and out of the numerator, which is why the two are always reported
//     together — the ratio alone would look like a capture failure.
//
// A WRITE THAT TIMED OUT is `unknown` until this module checks whether it
// landed: `reportedUnknown` carries the sequences a run logged as `timed_out`,
// and each is resolved to `landed` or `missing` by PRESENCE. Nothing writes a
// second document to report a failed first one.
//
// ZERO imports: pure arithmetic over plain objects.

/**
 * @typedef {object} CapturedTick
 * @property {number} tickSeq
 * @property {boolean} dispatched       model.dispatched — did a request go out?
 * @property {string}  bodyStatus       'written' | 'truncated' | 'copy_failed' | 'skipped'
 * @property {boolean} bodyPresent      is the TTL body document still there?
 */

/**
 * @typedef {object} BattleInput
 * @property {string} battleId
 * @property {number} mintedTickSeq     the PERSISTED cronState.tickSeq
 * @property {CapturedTick[]} ticks     every permanent record read for the battle
 * @property {number[]} [reportedUnknown] sequences a run logged as `timed_out`
 */

const asInt = (v) => (Number.isInteger(v) ? v : (Number.isFinite(v) ? Math.trunc(v) : 0));

/** Coverage for ONE battle. */
export function coverageForBattle(battle) {
  const battleId = battle?.battleId ?? null;
  const minted = Math.max(0, asInt(battle?.mintedTickSeq));
  const ticks = Array.isArray(battle?.ticks) ? battle.ticks : [];

  const bySeq = new Map();
  for (const t of ticks) {
    const seq = asInt(t?.tickSeq);
    if (seq > 0) bySeq.set(seq, t);
  }
  const captured = bySeq.size;

  // Every minted sequence with no record. A sequence ABOVE the highest captured
  // one is a TRAILING gap and is the reason the counter is the denominator.
  const missing = [];
  for (let seq = 1; seq <= minted; seq++) if (!bySeq.has(seq)) missing.push(seq);
  const highestCaptured = captured ? Math.max(...bySeq.keys()) : 0;
  const trailingGap = Math.max(0, minted - highestCaptured);

  // A record above the counter means the counter is behind its own records —
  // reported rather than silently folded into a ratio above 1.
  const aboveCounter = [...bySeq.keys()].filter((seq) => seq > minted).sort((a, b) => a - b);

  let dispatched = 0;
  let usablePairs = 0;
  let expiredBodies = 0;
  let truncatedBodies = 0;
  let copyFailedBodies = 0;
  for (const t of bySeq.values()) {
    if (t?.dispatched !== true) continue;
    dispatched += 1;
    if (t?.bodyPresent === false) { expiredBodies += 1; continue; }
    if (t?.bodyStatus === 'truncated') { truncatedBodies += 1; continue; }
    if (t?.bodyStatus === 'copy_failed') { copyFailedBodies += 1; continue; }
    if (t?.bodyStatus === 'written') usablePairs += 1;
  }

  // A timed-out write is UNKNOWN until we look: presence is the answer.
  const reported = Array.isArray(battle?.reportedUnknown) ? battle.reportedUnknown.map(asInt) : [];
  const resolvedUnknown = reported.map((seq) => ({ tickSeq: seq, resolution: bySeq.has(seq) ? 'landed' : 'missing' }));

  return {
    battleId,
    minted,
    captured,
    coverage: minted > 0 ? captured / minted : null,
    missing,
    attemptUnknown: missing.length,      // a missing tick's dispatch is UNKNOWABLE
    trailingGap,
    aboveCounter,
    dispatched,
    usablePairs,
    usablePairRate: dispatched > 0 ? usablePairs / dispatched : null,
    expiredBodies,
    truncatedBodies,
    copyFailedBodies,
    resolvedUnknown,
  };
}

/** Coverage across many battles, plus the per-battle rows. */
export function computeCoverage(battles) {
  const rows = (Array.isArray(battles) ? battles : []).map(coverageForBattle);
  const sum = (key) => rows.reduce((acc, r) => acc + r[key], 0);
  const minted = sum('minted');
  const captured = sum('captured');
  const dispatched = sum('dispatched');
  const usablePairs = sum('usablePairs');
  return {
    battles: rows.length,
    minted,
    captured,
    coverage: minted > 0 ? captured / minted : null,
    attemptUnknown: sum('attemptUnknown'),
    trailingGap: sum('trailingGap'),
    dispatched,
    usablePairs,
    usablePairRate: dispatched > 0 ? usablePairs / dispatched : null,
    expiredBodies: sum('expiredBodies'),
    truncatedBodies: sum('truncatedBodies'),
    copyFailedBodies: sum('copyFailedBodies'),
    rows,
  };
}

const pct = (v) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);

/**
 * The printable report. Every figure is labelled with ITS OWN denominator, and
 * nothing here is presented as an all-attempts rate.
 */
export function formatCoverageReport(totals, { scope = 'all battles' } = {}) {
  const lines = [
    `Tick capture coverage — ${scope}`,
    '',
    `  COVERAGE        ${totals.captured} captured / ${totals.minted} minted  = ${pct(totals.coverage)}`,
    `                  (denominator: the persisted cronState.tickSeq, so a trailing gap is visible)`,
    `  attempt unknown ${totals.attemptUnknown} minted tick(s) with no record — whether they dispatched is UNKNOWABLE`,
    `  trailing gap    ${totals.trailingGap} sequence(s) minted after the highest captured one`,
    '',
    `  USABLE PAIRS    ${totals.usablePairs} / ${totals.dispatched} captured ticks known to have dispatched = ${pct(totals.usablePairRate)}`,
    `                  (a complete, untruncated request AND response)`,
    `  truncated       ${totals.truncatedBodies} captured, body over the size cap — NOT a usable pair`,
    `  copy failed     ${totals.copyFailedBodies} captured, body copy absent — NOT a usable pair`,
    '',
    `  EXPIRED BODIES  ${totals.expiredBodies} removed by the TTL policy — counted here, never as a gap`,
    '',
    `  battles         ${totals.battles}`,
  ];
  return lines.join('\n');
}

/** The JSONL line for one exported tick. Stable key order; no computation. */
export function toJsonlLine({ permanent, body = null }) {
  return JSON.stringify({ tickId: permanent?.tickId ?? null, permanent, body });
}
