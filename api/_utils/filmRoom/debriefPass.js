// api/_utils/filmRoom/debriefPass.js
//
// Film Room D2 — THE NIGHTLY PASS (D2 spec §6, §7; DW-6, DW-7; the founder's FD-4, FD-5). The cron handler
// (api/cron/film-room-debrief.js) is auth + gate + wiring; everything here takes its database, clock, mode and model
// call as arguments, so the runs are testable on the in-memory Firestore.
//
//   THE GATE     'off' answers before ANY read (the handler checks too); 'allowlist' keeps only the owners the
//                cockpit's server-side allowlist admits (debriefGate.js, read at call time); 'on' every owner.
//   THE DAY      the ET date of the run, when the calendar knows it as a session — one date per run, no catch-up: a
//                missed night is a day with no record.
//   THE BATTLES  the close pass's two candidate queries on `agentBattles` (`status == 'active'`, and `completedAt` on
//                or after the day's start), WRITTEN AGAIN here, never imported from the tape's writer; kept where the
//                battle is tiered (resolveModeConfig(gameMode).label, as FilmRoomRoute.jsx tests it) and the day is one
//                of its battle days (isBattleDay); then ONE get of `tape/{etDate}` and ONE of `debriefs/{etDate}` per
//                battle. No collection-group query, no new index.
//   PER DAY      no tape, a tape not written, a tape that does not name this battle, this day and this battle's
//                owner (Amendment F DF-1: `ownerMismatch`, before anything else of the day is read or built), or a
//                record already there: skipped. Otherwise the digest
//                (dayDigest.js); a day with no swap is recorded `nothing` / `no_swaps` with NO call; else ONE call
//                (debriefModelCall.js), the checks (debriefChecks.js), and the record CREATED once
//                (`agentBattles/{id}/debriefs/{etDate}`, Admin SDK `create`, so no second run overwrites it).
//   BOUNDS       at most DEBRIEF_MAX_CONCURRENT calls at once and DEBRIEF_MAX_CALLS per run; a remaining-time floor
//                checked before each battle and before each call (maxDuration 300). A day not reached keeps no record
//                and is named in the run's summary.
//   THE LOG      counts only — never words, ids or keys; an error is counted, never printed (a Firestore error's
//                message can carry a document path, and so an id).

import { TAPE_SUBCOLLECTION } from '../../../src/constants/filmTape.js';
import { DEBRIEFS_SUBCOLLECTION } from '../../../src/utils/debriefSchedule.js';
import { resolveModeConfig } from '../../../src/constants/agentGameModes.js';
import { isBattleDay, isSessionDate, etDayBounds, etDateOf } from '../../../src/utils/tapeSchedule.js';
import { filmRoomDebriefMode, filmRoomDebriefOnFor } from './debriefGate.js';
import { buildDayDigest, knownIdsOf, digestHashOf, DAY_DIGEST_VERSION } from './dayDigest.js';
import { buildDebriefPrompt } from './debriefPrompt.js';
import { runDebriefCall, DEBRIEF_MODEL } from './debriefModelCall.js';
import { checkDebriefLines } from './debriefChecks.js';
import { resolveRecordTargetId } from '../casualClone.js';
import { isCasualCloneId } from '../../../src/constants/leagueTournament.js';

/** §6: the record's shape version. */
export const DEBRIEF_RECORD_VERSION = 1;
/** §7 bounds. */
export const DEBRIEF_MAX_CONCURRENT = 4;
export const DEBRIEF_MAX_CALLS = 200;
/** The remaining-time floor checked before each battle and each call (the close pass's 30 s). */
export const DEBRIEF_TIME_FLOOR_MS = 30_000;
/** One call's own deadline — never past the run's floor. */
export const DEBRIEF_CALL_TIMEOUT_MS = 60_000;

const LOG_PREFIX = '[film-room-debrief]';
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v ? v : null);
const dataOf = (snap) => (snap?.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null);

/** The close pass's two candidate queries (closePass.js candidatesFor), written again here: the battles, by id. The sample pack reads the same. */
export async function candidatesFor(db, bounds) {
  const col = db.collection('agentBattles');
  const [activeSnap, laterSnap] = await Promise.all([
    col.where('status', '==', 'active').get(),
    col.where('completedAt', '>=', bounds.startIso).get(),
  ]);
  const byId = new Map();
  for (const snap of [activeSnap, laterSnap]) {
    for (const d of snap?.docs || []) if (!byId.has(d.id)) byId.set(d.id, { id: d.id, ...(typeof d.data === 'function' ? d.data() : d.data) });
  }
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * The record's `attributionAgentId` (§6: "as the cards stamp them") — the platform's one attribution rule, a casual
 * clone's parent, else the battle's own agent: for a clone, a read of the clone's agent document, accepted only when it
 * is the battle owner's own, the platform's pure resolver (casualClone.js resolveRecordTargetId), then a read of the
 * parent's agent document, accepted only when it exists and is the owner's too — the cards' own guard
 * (casualClone.js resolveAttributionAgentId, which the cards stamp through: the refuter's N3). Never the clone itself,
 * and never another owner's agent: a clone it cannot resolve — no document, another owner's, no parent named, a parent
 * missing or another owner's, a failed read — is `null`, as the cards never file under a clone (the review's R3). It
 * prints nothing (the review's R2: the async resolver logs the ids it meets on its degraded paths).
 * @returns {Promise<string|null>}
 */
export async function attributionOf(db, battle) {
  const agentId = str(battle?.agentId);
  if (!agentId || !isCasualCloneId(agentId)) return agentId;
  try {
    const clone = dataOf(await db.collection('agents').doc(agentId).get());
    const own = isObj(clone) && clone.ownerId === battle.ownerId ? clone : null;
    const target = str(resolveRecordTargetId(agentId, own));
    if (!target || isCasualCloneId(target)) return null;
    const parent = dataOf(await db.collection('agents').doc(target).get());
    return isObj(parent) && parent.ownerId === battle.ownerId ? target : null;
  } catch {
    return null;
  }
}

/** A tiered battle on one of its battle days, whose owner the gate admits under `mode`. */
export function selectedForDebrief(battle, etDate, mode) {
  return resolveModeConfig(battle?.gameMode).label === 'tiered' && isBattleDay(battle, etDate) && filmRoomDebriefOnFor(battle?.ownerId, mode);
}

/** The written day: the close pass wrote it and it holds its checks and actions. */
export const writtenTape = (tape) => isObj(tape) && tape.passes?.close?.status === 'written' && Array.isArray(tape.checks) && Array.isArray(tape.actions);

/**
 * Amendment F DF-1 (Astra's F1): the tape names THIS battle, THIS day and THIS battle's owner — `tape.battleId` is the
 * battle's id, `tape.etDate` the run's date, `tape.ownerId` the battle's `ownerId` (a non-empty string). Checked before
 * anything else of the day is read or built, in the pass and in the sample pack: a battle whose owner changed after the
 * close is never handed the previous owner's tape, and no record is filed under an owner who did not play the day. No
 * second check after the call: the record is stamped from the tape (debriefRecordOf), and the rules give it to that
 * owner alone.
 */
export const tapeIsFor = (tape, battle, etDate) => isObj(tape) && str(tape.ownerId) !== null
  && tape.battleId === battle?.id && tape.etDate === etDate && tape.ownerId === battle?.ownerId;

/**
 * The record (§6), every field stamped at write. Its owner is the TAPE's (Amendment F DF-1), never the battle
 * snapshot's: the words describe that tape, and the tape's owner is the one who played that day.
 * @returns {object}
 */
export function debriefRecordOf({ battle, etDate, attributionAgentId, digest, tape, call = null, status, reason = null, lines = [], dropped = [], nowIso }) {
  return {
    version: DEBRIEF_RECORD_VERSION,
    battleId: battle.id,
    etDate,
    ownerId: str(tape?.ownerId),
    attributionAgentId: str(attributionAgentId),
    archetype: str(battle.agentContext?.archetype) ?? str(tape?.archetype),
    status,
    reason: status === 'written' ? null : reason,
    writtenAt: nowIso,
    digestVersion: DAY_DIGEST_VERSION,
    digestHash: digestHashOf(digest),
    tapeWrittenAt: str(tape?.writtenAt),
    model: call ? call.model ?? null : null,
    usage: call ? call.usage ?? null : null,
    costUsd: call ? call.costUsd ?? null : null,
    attempts: call ? call.attempts ?? null : null,
    lines,
    dropped,
  };
}

/**
 * The pass for the ET date of `startMs`.
 * @param {object} p
 * @param {object} p.db              Admin Firestore
 * @param {() => number} [p.clock]
 * @param {number} [p.startMs]
 * @param {number} [p.budgetMs]      the function's maxDuration
 * @param {string} [p.mode]          the gate, read now unless handed in
 * @param {Function} [p.call]        the model call (runDebriefCall; a fake in tests)
 * @param {string} [p.model]
 * @param {Function} [p.resolveAttribution]  the platform's attribution resolver (casualClone.js)
 * @param {Function} [p.log]
 */
export async function runDebriefPass({
  db, clock = Date.now, startMs = clock(), budgetMs = 300_000, mode = filmRoomDebriefMode(),
  call = runDebriefCall, model = DEBRIEF_MODEL, resolveAttribution = attributionOf, log = (...a) => console.log(...a),
}) {
  if (mode === 'off') return { skipped: true, reason: 'off' };
  const etDate = etDateOf(startMs);
  const summary = {
    etDate, mode, selected: 0, written: 0, nothing: 0, failed: 0, skipped: { noTape: 0, notWritten: 0, ownerMismatch: 0, exists: 0, unreadable: 0 },
    errors: 0, calls: 0, totalCostUsd: 0, notReached: [], writeFailed: [], attributionUnresolved: 0, complete: true,
  };
  const finish = () => {
    summary.totalCostUsd = Math.round(summary.totalCostUsd * 1_000_000) / 1_000_000;
    // counts only: never words, ids or keys
    log(LOG_PREFIX, JSON.stringify({
      selected: summary.selected, written: summary.written, nothing: summary.nothing, failed: summary.failed,
      notReached: summary.notReached.length, skipped: Object.values(summary.skipped).reduce((a, b) => a + b, 0),
      errors: summary.errors, writeFailed: summary.writeFailed.length, attributionUnresolved: summary.attributionUnresolved, calls: summary.calls, totalCostUsd: summary.totalCostUsd,
    }));
    return summary;
  };
  if (!isSessionDate(etDate)) { summary.notSession = true; return finish(); }
  const bounds = etDayBounds(etDate);
  const battles = (await candidatesFor(db, bounds)).filter((b) => selectedForDebrief(b, etDate, mode));
  summary.selected = battles.length;
  const remaining = () => budgetMs - (clock() - startMs);
  const runDeadline = startMs + budgetMs - DEBRIEF_TIME_FLOOR_MS / 2;
  let next = 0;

  async function one(battle) {
    const battleRef = db.collection('agentBattles').doc(battle.id);
    const tapeRef = battleRef.collection(TAPE_SUBCOLLECTION).doc(etDate);
    const debriefRef = battleRef.collection(DEBRIEFS_SUBCOLLECTION).doc(etDate);
    const [tapeSnap, debriefSnap] = await Promise.all([tapeRef.get(), debriefRef.get()]);
    const tape = dataOf(tapeSnap);
    if (!tape) { summary.skipped.noTape += 1; return; }
    if (!writtenTape(tape)) { summary.skipped.notWritten += 1; return; }
    // DF-1: before anything else is read or built — no attribution read, no digest, no prompt for another's tape
    if (!tapeIsFor(tape, battle, etDate)) { summary.skipped.ownerMismatch += 1; return; }
    if (debriefSnap?.exists) { summary.skipped.exists += 1; return; }
    const attributionAgentId = await resolveAttribution(db, battle);
    if (attributionAgentId === null && str(battle.agentId)) summary.attributionUnresolved += 1;
    // THE inventory (Amendment F DF-3): every id the day knows, every opaque reference its tape holds — built once,
    // handed to the digest's quotation policy and to check 6 alike
    const knownIds = knownIdsOf(tape, battle, [attributionAgentId]);
    const built = buildDayDigest({ tape, battle, knownIds });
    if (!built) { summary.skipped.unreadable += 1; return; }
    const { digest, refs } = built;
    const record = (fields) => debriefRecordOf({ battle, etDate, attributionAgentId, digest, tape, nowIso: new Date(clock()).toISOString(), ...fields });
    let doc;
    if (!digest.swaps.length) {
      doc = record({ status: 'nothing', reason: 'no_swaps' });
    } else {
      // the bounds, before the call: the run's call cap and its time floor — a day not reached keeps no record
      if (summary.calls >= DEBRIEF_MAX_CALLS || remaining() < DEBRIEF_TIME_FLOOR_MS) { summary.notReached.push({ battleId: battle.id, etDate }); summary.complete = false; return; }
      summary.calls += 1;
      const prompt = buildDebriefPrompt(digest);
      const r = await call({ ...prompt, model, deadlineAt: Math.min(clock() + DEBRIEF_CALL_TIMEOUT_MS, runDeadline) });
      if (Number.isFinite(r?.costUsd)) summary.totalCostUsd += r.costUsd;
      if (!r?.ok) {
        doc = record({ call: r, status: 'failed', reason: r?.reason ?? 'model_error_unknown' });
      } else {
        const checked = checkDebriefLines(r.output, digest, { knownIds });
        if (!checked.ok) doc = record({ call: r, status: 'failed', reason: 'parse' });
        else {
          const lines = checked.lines.map((l) => ({ key: refs[l.label], label: l.label, text: l.text }));
          doc = lines.length
            ? record({ call: r, status: 'written', lines, dropped: checked.dropped })
            : record({ call: r, status: 'nothing', reason: 'no_lines', dropped: checked.dropped });
        }
      }
    }
    try {
      await debriefRef.create(doc);
    } catch (err) {
      // another run created it first: the record stands, never overwritten (`create`, §6)
      if (err?.code === 6 || err?.code === 'already-exists') { summary.skipped.exists += 1; return; }
      // any other failed write: the day keeps no record and is NAMED in the summary — its call's cost already counted
      // in the run's total (the review's R4) — never printed
      summary.writeFailed.push({ battleId: battle.id, etDate });
      summary.errors += 1;
      return;
    }
    summary[doc.status] += 1;
  }

  async function worker() {
    while (next < battles.length) {
      const battle = battles[next];
      next += 1;
      if (remaining() < DEBRIEF_TIME_FLOOR_MS) { summary.notReached.push({ battleId: battle.id, etDate }); summary.complete = false; continue; }
      try {
        await one(battle);
      } catch {
        // a failed read or write: counted, never printed (its message can carry a document path); the next battle proceeds
        summary.errors += 1;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(DEBRIEF_MAX_CONCURRENT, battles.length) }, worker));
  return finish();
}
