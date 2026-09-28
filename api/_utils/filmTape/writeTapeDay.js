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
// (tapeMerge.js). The same transaction re-reads the battle document, so an
// assembly made before the battle completed can never record it active
// (BA-27), and on an equal lifecycle rank the re-read is authoritative for
// the whole completion block — a stale completed assembly cannot rewind it
// (BA-27 amended). Nothing else is ever written (BA-1): not the battle
// document, not `ticks`, not `calls`, not any other collection.
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
import { assembleTape, assembleSkippedModeTape, dayEntries, buildBattleBlock } from './tapeAssemble.js';
import { mergeTape, sanitizeForFirestore, lifecycleRank } from './tapeMerge.js';
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
    assembled = assembleTape({
      battle, etDate, bounds, nowMs,
      ticksRead, runsRead, receiptsRead, callsRead, declarationsRead,
      intradayViewsPresent, priorTape,
      callRecordsMode: opts.callRecordsMode ?? CALL_RECORDS_MODE,
      resolveResult: opts.resolveResult ?? resolveBattleResult,
    });
  }

  const withinWindow = withinCandleWindow(etDate, nowMs);
  const ref = tapeRef(db, battleId, etDate);
  const resolveResult = opts.resolveResult ?? resolveBattleResult;
  let outcome = null;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const stored = snap && snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null;
    // BA-27: the battle as it stands NOW, read in this transaction. At a later
    // lifecycle state than the assembly saw (it completed meanwhile) — and, BA-27
    // amended, at the SAME state — the re-read is authoritative: its completion
    // block (status, completedAt, final, result, battleStatusAtWrite) replaces
    // the assembly's whole, and the merge treats it as canonical.
    let doc = assembled;
    let canonicalBattle = false;
    if (assembled.passes.close.status !== 'skipped_mode') {
      const bSnap = await tx.get(battleRef(db, battleId));
      const now = bSnap && bSnap.exists ? { id: battleId, ...(typeof bSnap.data === 'function' ? bSnap.data() : bSnap.data) } : null;
      if (now && lifecycleRank(now.status) >= lifecycleRank(assembled.battle?.status)) {
        doc = { ...assembled, battleStatusAtWrite: typeof now.status === 'string' ? now.status : null, battle: buildBattleBlock({ battle: now, resolveResult }) };
        canonicalBattle = true;
      }
    }
    const { doc: merged, changed } = mergeTape(stored, doc, { nowIso, withinWindow, canonicalBattle });
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
