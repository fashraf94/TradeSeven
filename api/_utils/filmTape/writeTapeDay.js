// api/_utils/filmTape/writeTapeDay.js
//
// Film Room tape — `writeTapeDay(battleId, etDate, { now })` (spec BA-15,
// BA-19). Called by the close pass for tonight's session and by the admin
// backfill for a range. Admin SDK only.
//
// It READS the battle document, the day's `ticks` (never `tickBodies`), the
// battle's learning receipts, `calls` and `declarations`, the day's
// agentEvalRuns, the intradayViews presence and the prior day's tape
// (tapeSources.js). It WRITES exactly one document — `tape/{etDate}` — inside a
// transaction that reads the stored copy first and merges monotonically
// (tapeMerge.js). The same transaction re-reads the battle document, and the
// tape is ASSEMBLED FROM THAT RE-READ (BA-37): when it differs from the copy
// the pass selected, the writer re-assembles before merging, from the same
// subcollection reads (made before the transaction; they stand) — no read is
// added. So a stale selection-time value never overwrites a newer recorded one
// and never re-queues the candle pass (BA-31), an assembly made before the
// battle completed can never record it active (BA-27), and the re-read is
// authoritative for the whole completion block (BA-27 amended). Nothing else
// is ever written (BA-1): not the battle document, not `ticks`, not `calls`,
// not any other collection.
//
// FILM_TAPE_WRITE_ENABLED is read at call time, here as well as in the
// handlers, so no caller can write a tape while the writer is dark.

import { FILM_TAPE_WRITE_ENABLED, CALL_RECORDS_MODE } from '../../../src/config/featureFlags.js';
import { resolveModeConfig } from '../../../src/constants/agentGameModes.js';
import { TAPE_VERSION, TAPE_NUMBER_CLASSES } from '../../../src/constants/filmTape.js';
import {
  readBattle, readDayTicks, readReceipts, readCalls, readDeclarationPresence, readEvalRunsForDay,
  readIntradayViewsPresent, readTape, tapeRef, battleRef,
} from './tapeSources.js';
import { assembleTape, assembleSkippedModeTape, dayEntries } from './tapeAssemble.js';
import { mergeTape, sanitizeForFirestore, stableStringify } from './tapeMerge.js';
import { etDayBounds, previousSession, withinCandleWindow, toMs } from './tapeTime.js';
import { resolveBattleResult } from './battleResult.js';

const nowMsOf = (now) => {
  if (typeof now === 'function') return nowMsOf(now());
  const ms = toMs(now ?? Date.now());
  if (ms === null) throw new Error('writeTapeDay: invalid now');
  return ms;
};

/** Is `battle` in scope for a full tape (BA-3: tiered BaggerBomb battles)? */
export const isTieredBattle = (battle) => resolveModeConfig(battle?.gameMode).label === 'tiered';

/**
 * Write (or merge into) the tape for one battle-day.
 *
 * @param {string} battleId
 * @param {string} etDate                 YYYY-MM-DD, the ET session date
 * @param {object} opts
 * @param {object} opts.db                Admin Firestore
 * @param {number|string|Date|Function} [opts.now]  the run instant (injectable)
 * @param {object} [opts.battle]          the battle document, when the caller already read it
 * @param {object} [opts.runsRead]        the day's agentEvalRuns read ONCE per pass (§5)
 * @param {Function} [opts.resolveResult] BA-4 result comparison (default: the evaluator's own)
 * @param {string} [opts.callRecordsMode] the CALL_RECORDS_MODE this run writes under (BA-16)
 * @returns {Promise<{ status: 'written'|'unchanged'|'skipped_mode', battleId, etDate, runCount, bytes }>}
 */
export async function writeTapeDay(battleId, etDate, opts = {}) {
  if (!FILM_TAPE_WRITE_ENABLED) throw new Error('film_tape_write_disabled');
  const { db } = opts;
  if (!db) throw new Error('writeTapeDay: db required');
  const nowMs = nowMsOf(opts.now);
  const nowIso = new Date(nowMs).toISOString();
  const bounds = etDayBounds(etDate);
  if (!bounds) throw new Error(`writeTapeDay: invalid etDate ${etDate}`);

  const battle = opts.battle && opts.battle.id === battleId ? opts.battle : await readBattle(db, battleId);
  if (!battle) throw new Error('battle_not_found');

  let assembled;
  // BA-37: the tiered assembly as a function of the battle document, over this
  // run's subcollection reads — re-run on the transaction's re-read.
  let assembleFrom = null;
  if (!isTieredBattle(battle)) {
    assembled = assembleSkippedModeTape({ battle, etDate, nowMs });
  } else {
    const days = Array.isArray(battle?.timing?.tradingDays) ? battle.timing.tradingDays : null;
    const priorDay = days ? (days[days.indexOf(etDate) - 1] ?? null) : previousSession(etDate);
    const [ticksRead, receiptsRead, callsRead, runsRead, intradayViewsPresent, priorTape] = await Promise.all([
      readDayTicks(db, battleId, bounds),
      readReceipts(db, battleId),
      readCalls(db, battleId),
      opts.runsRead ? Promise.resolve(opts.runsRead) : readEvalRunsForDay(db, bounds),
      readIntradayViewsPresent(db, battleId, bounds),
      priorDay ? readTape(db, battleId, priorDay) : Promise.resolve(null),
    ]);
    // The checks are the tape's spine: without the day's tick read there is
    // no honest record to write, so the battle-day fails and says why.
    if (!ticksRead.ok) throw new Error(`ticks_unreadable: ${ticksRead.error}`);
    const expected = dayEntries(battle, bounds).day
      .filter((e) => e.declarationsPhase === 'expected' && typeof e.evalId === 'string').map((e) => e.evalId);
    const declarationsRead = await readDeclarationPresence(db, battleId, expected);
    assembleFrom = (b) => assembleTape({
      battle: b, etDate, bounds, nowMs,
      ticksRead, runsRead, receiptsRead, callsRead, declarationsRead,
      intradayViewsPresent, priorTape,
      callRecordsMode: opts.callRecordsMode ?? CALL_RECORDS_MODE,
      resolveResult: opts.resolveResult ?? resolveBattleResult,
      // The gap horizon stays the copy the tick read was made for; a cronState
      // with no count yet means nothing was minted at selection. Only a copy
      // with no cronState at all falls back to the battle assembled from,
      // which can add a gap but never hide one (review lens 4 L4-2, and its
      // refuter).
      mintedMax: battle?.cronState ? (battle.cronState.tickSeq ?? null) : (b?.cronState?.tickSeq ?? null),
    });
    assembled = assembleFrom(battle);
  }

  const withinWindow = withinCandleWindow(etDate, nowMs);
  const ref = tapeRef(db, battleId, etDate);
  let outcome = null;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const stored = snap && snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null;
    // BA-37: the battle as it stands NOW, read in this transaction, is what
    // the tape is assembled from. When it differs from the copy the pass
    // selected, the tape is re-assembled from it before the merge, over the
    // same subcollection reads. Its completion block (status, completedAt,
    // final, result, battleStatusAtWrite) is then the re-read's, and the merge
    // treats it as canonical (BA-27 amended); the merge's own lifecycle rule
    // still never moves a stored completion backward (BA-27).
    let doc = assembled;
    let canonicalBattle = false;
    if (assembleFrom) {
      const bSnap = await tx.get(battleRef(db, battleId));
      const now = bSnap && bSnap.exists ? { id: battleId, ...(typeof bSnap.data === 'function' ? bSnap.data() : bSnap.data) } : null;
      // No battle document to assemble from: the selected copy may be stale,
      // so the battle-day fails and says why, as it does before the reads
      // (round-3 review L2-6).
      if (!now) throw new Error('battle_not_found');
      doc = stableStringify(now) === stableStringify(battle) ? assembled : assembleFrom(now);
      canonicalBattle = true;
    }
    // BA-39: the merge recomputes the result with the same comparison the assembly used.
    const { doc: merged, changed } = mergeTape(stored, doc, { nowIso, withinWindow, canonicalBattle, resolveResult: opts.resolveResult ?? resolveBattleResult });
    if (changed) tx.set(ref, merged);
    outcome = { doc: merged, changed };
  });
  const status = assembled.passes.close.status === 'skipped_mode'
    ? 'skipped_mode'
    : (outcome.changed ? 'written' : 'unchanged');
  return { status, battleId, etDate, runCount: outcome.doc?.runCount ?? null, bytes: JSON.stringify(outcome.doc).length };
}

/**
 * The failure record (spec §5 Budget): `passes.close.status: 'failed'` with a
 * reason when the document can be written. A stored tape keeps every section
 * and its `written` status — the failure is recorded beside it, never over it,
 * so a failed re-run cannot unready a battle the hub already sees as ready.
 */
export async function markCloseFailed(db, battle, etDate, reason, { now } = {}) {
  if (!FILM_TAPE_WRITE_ENABLED) throw new Error('film_tape_write_disabled');
  const nowIso = new Date(nowMsOf(now)).toISOString();
  const why = String(reason || 'unknown').slice(0, 300);
  const ref = tapeRef(db, battle.id, etDate);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const stored = snap && snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null;
    if (stored && stored.passes?.close) {
      const keepStatus = ['written', 'skipped_mode'].includes(stored.passes.close.status);
      tx.update(ref, {
        'passes.close.lastError': { at: nowIso, reason: why },
        ...(keepStatus ? {} : { 'passes.close.status': 'failed', 'passes.close.reason': why }),
      });
      return;
    }
    tx.set(ref, sanitizeForFirestore({
      tapeVersion: TAPE_VERSION,
      battleId: battle.id,
      ownerId: typeof battle.ownerId === 'string' ? battle.ownerId : null,
      agentId: typeof battle.agentId === 'string' ? battle.agentId : null,
      gameMode: typeof battle.gameMode === 'string' ? battle.gameMode : null,
      etDate,
      writtenAt: nowIso,
      firstWrittenAt: nowIso,
      runCount: 1,
      passes: {
        close: { status: 'failed', writtenAt: nowIso, reason: why, lastError: { at: nowIso, reason: why } },
        candles: { status: 'skipped', writtenAt: null, attempts: 0, reason: 'close_pass_failed', source: null, symbolsRequested: [], symbolsMissing: [] },
      },
      numberClasses: TAPE_NUMBER_CLASSES,
    }));
  });
}
