// scripts/shadow-read-call-records.mjs
//
// Shadow read #1 — Cockpit Build 0 call records, read against production
// after CALL_RECORDS_MODE → 'shadow' (PR #913).
// Plan of record: docs/design/COCKPIT_SPEC_V1_3.md §3.13,
// docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md, and
// docs/audits/20260924_BUILD0_CALL_RECORDS.md §10 (sources + rollback triggers).
//
// READ-ONLY BY CONSTRUCTION. Firestore Admin SDK calls in this file are
// `.get()`, `.count().get()` and `.select(...)` reads only. There is no `set`,
// `update`, `delete`, `create`, `runTransaction`, `batch` or `bulkWriter`
// call — grep it before running it. No flag is read from or written to
// anything but the local source tree. The only file this script writes is the
// local report named by --out.
//
// CREDENTIALS — the existing loaders only: scripts/loadLocalEnv.js (.env.local
// → process.env, on import) + api/_utils/firebaseAdmin.js getFirebaseAdmin().
//
// USAGE (repo root):
//   node scripts/shadow-read-call-records.mjs [--out docs/audits/<date>_CALL_RECORDS_SHADOW_READ_1.md] [--json <path>]
//
// WHAT IT CANNOT READ: Vercel function logs. The `[calls] phase … removed=`,
// `[calls] call_conflict`, `[calls] truncation_event` and `[calls] flips …`
// lines (report §10 step 7) are per-check and live only in the logs; the
// report says where a number is latest-check-only (`cronState.*` is
// overwritten by every check, review B-4).

import { writeFileSync } from 'node:fs';
import './loadLocalEnv.js';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
// Cockpit Build 1a (spec §12): the rollback recipe, reported under --calls-enabled-window.
import { computeCallsEnabledWindow, renderCallsEnabledWindow } from '../api/_utils/callRecords/rollbackRecipe.js';

// ---------------------------------------------------------------- constants

/** PR #913 merge instant (git log -1 403dfb03: 2026-09-25T22:34:07-05:00). */
export const FLIP_MERGED_AT = '2026-09-26T03:34:07Z';
export const FLIP_MS = Date.parse(FLIP_MERGED_AT);
/** The five sessions before the flip (report §10 baseline). */
export const BASELINE_DAYS = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'];
/** Battles whose expiry is before this cannot carry a baseline or shadow check. */
const SCOPE_FLOOR_ISO = '2026-09-21T00:00:00Z';
const TERMINAL = new Set(['hit', 'expired_unresolved']);

// Report §10 proposed rollback triggers.
export const TRIGGERS = {
  timeoutPts: 2,
  truncInvalidPts: 1,
  p95CallMsDelta: 2000,
  relativeMove: 0.25,
};

// ---------------------------------------------------------------- pure helpers

const etFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const etTimeFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });

export function toMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}
export const etDay = (ms) => (Number.isFinite(ms) ? etFmt.format(new Date(ms)) : 'unknown');
export const etClock = (ms) => (Number.isFinite(ms) ? `${etDay(ms)} ${etTimeFmt.format(new Date(ms))} ET` : 'n/a');

/** Nearest-rank percentile; null on an empty list. */
export function pct(values, p) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  return xs[Math.min(xs.length - 1, Math.max(0, Math.ceil((p / 100) * xs.length) - 1))];
}
const inc = (obj, key, by = 1) => { obj[key] = (obj[key] || 0) + by; return obj; };
const fmtPct = (num, den) => (den ? `${((100 * num) / den).toFixed(2)}%` : 'n/a');
const rate = (num, den) => (den ? num / den : null);

/** Does px satisfy the call's price condition (flip.js conditionMet)? */
export function conditionSatisfied(call, px) {
  const level = call?.condition?.level;
  if (!(Number.isFinite(px) && px > 0) || !Number.isFinite(level)) return false;
  return (call.condition.side === 'above' && px > level) || (call.condition.side === 'below' && px < level);
}

/**
 * The five integrity checks against one call. Returns a list of
 * { check, callId, detail } violations.
 */
export function integrityViolations({ call, receipt, battleStatus, receiptPath }) {
  const out = [];
  const id = call.callId;
  const terminal = TERMINAL.has(call.state);
  if (terminal) {
    if (!receipt) out.push({ check: 'terminal_has_receipt', callId: id, detail: `state=${call.state} but callObservations/${id} is missing` });
    else if (call.outcome?.receiptRef !== receiptPath) out.push({ check: 'terminal_has_receipt', callId: id, detail: `outcome.receiptRef=${JSON.stringify(call.outcome?.receiptRef)} ≠ ${receiptPath}` });
    if (call.stateSource !== 'check') out.push({ check: 'terminal_has_receipt', callId: id, detail: `stateSource=${call.stateSource} (expected 'check')` });
  } else if (receipt) {
    out.push({ check: 'terminal_has_receipt', callId: id, detail: `receipt exists but state=${call.state}` });
  }
  if (call.state === 'hit' && receipt) {
    if (!(receipt.observedAtMs > call.mintedAt)) out.push({ check: 'hit_after_mint_and_px_satisfies', callId: id, detail: `observedAtMs=${receipt.observedAtMs} ≤ mintedAt=${call.mintedAt}` });
    if (call.kind === 'pick' || !conditionSatisfied(call, receipt.px)) out.push({ check: 'hit_after_mint_and_px_satisfies', callId: id, detail: `px=${receipt.px} does not satisfy ${call.condition?.side} ${call.condition?.level}` });
  }
  if (receipt && receipt.evalId != null && receipt.evalId === call.evalId) {
    out.push({ check: 'no_hit_on_minting_eval', callId: id, detail: `receipt.evalId=${receipt.evalId} = call.evalId (state=${call.state})` });
  }
  if (call.state === 'open' && battleStatus !== 'active') {
    out.push({ check: 'no_open_call_under_completed_battle', callId: id, detail: `battle status=${battleStatus}, horizon ${call.horizon?.basis} expiresAt ${etClock(call.horizon?.expiresAt)}` });
  }
  return out;
}

/** Compare two windows on one metric. kind: 'pts' (absolute pp), 'ms', 'rel'. */
export function judgeTrigger({ before, after, kind, threshold }) {
  if (before == null || after == null) return { verdict: 'NO DATA', delta: null };
  if (kind === 'pts') { const d = (after - before) * 100; return { verdict: d >= threshold ? 'TRIPPED' : 'PASS', delta: `${d >= 0 ? '+' : ''}${d.toFixed(2)} pts` }; }
  if (kind === 'ms') { const d = after - before; return { verdict: d >= threshold ? 'TRIPPED' : 'PASS', delta: `${d >= 0 ? '+' : ''}${Math.round(d)} ms` }; }
  if (before === 0) return { verdict: after === 0 ? 'PASS' : 'TRIPPED', delta: after === 0 ? '0%' : '+∞' };
  const d = (after - before) / before;
  return { verdict: Math.abs(d) > threshold ? 'TRIPPED' : 'PASS', delta: `${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}%` };
}

// ---------------------------------------------------------------- the read

async function main() {
  const args = process.argv.slice(2);
  const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const outPath = argOf('--out');
  const jsonPath = argOf('--json');
  // Build 1a §12: the rollback recipe — the last five regular ET sessions with
  // calls-enabled model calls (declarationsPhase present AND a finite callMs),
  // numerator invalid_tool_result, trip > 3 %, zero data → no trip, with the
  // retained-window coverage. Read-only; a report, never a flip.
  const wantCallsEnabledWindow = args.includes('--calls-enabled-window');
  const db = getFirebaseAdmin();
  const readAtMs = Date.now();

  // 1. Battle index (field-masked), then full reads of the battles in scope.
  const index = await db.collection('agentBattles').select('status', 'expiresAt', 'createdAt').get();
  const scopeIds = index.docs.filter((d) => {
    const x = d.data();
    const exp = toMs(x.expiresAt);
    return x.status === 'active' || exp == null || exp >= Date.parse(SCOPE_FLOOR_ISO);
  }).map((d) => d.id);
  const battles = new Map();
  for (let i = 0; i < scopeIds.length; i += 50) {
    const refs = scopeIds.slice(i, i + 50).map((id) => db.collection('agentBattles').doc(id));
    for (const snap of await db.getAll(...refs)) if (snap.exists) battles.set(snap.id, snap.data());
  }

  // 2. Evaluation entries, split baseline / shadow.
  const entries = [];
  for (const [battleId, b] of battles) {
    for (const e of Array.isArray(b.evaluations) ? b.evaluations : []) {
      const ms = toMs(e?.timestamp);
      if (ms == null) continue;
      const day = etDay(ms);
      const window = ms >= FLIP_MS ? 'shadow' : (BASELINE_DAYS.includes(day) ? 'baseline' : null);
      if (window) entries.push({ battleId, ms, day, window, e });
    }
  }
  const shadowBattleIds = new Set(entries.filter((x) => x.window === 'shadow').map((x) => x.battleId));
  const shadowDays = [...new Set(entries.filter((x) => x.window === 'shadow').map((x) => x.day))].sort();

  // 3. Call-record collections (every document; they are small at shadow).
  const callsSnap = await db.collectionGroup('calls').get();
  const calls = callsSnap.docs.filter((d) => d.ref.parent.parent?.parent?.id === 'agentBattles').map((d) => ({ path: d.ref.path, battleId: d.ref.parent.parent.id, ...d.data() }));
  const declSnap = await db.collectionGroup('declarations').get();
  const decls = declSnap.docs.filter((d) => d.ref.parent.parent?.parent?.id === 'agentBattles').map((d) => ({ path: d.ref.path, battleId: d.ref.parent.parent.id, docId: d.id, ...d.data() }));
  const rcptSnap = await db.collectionGroup('callObservations').get();
  const receipts = new Map(rcptSnap.docs.filter((d) => d.ref.parent.parent?.parent?.id === 'agentBattles').map((d) => [d.ref.path, d.data()]));
  const queueSnap = await db.collection('callSweepQueue').get();
  const queue = queueSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const runsSnap = await db.collection('agentEvalRuns').get();
  const runs = runsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Battles that own call records but fell outside the scope read.
  for (const bid of new Set([...calls.map((c) => c.battleId), ...decls.map((d) => d.battleId), ...queue.map((q) => q.battleId || q.id)])) {
    if (!battles.has(bid)) { const s = await db.collection('agentBattles').doc(bid).get(); if (s.exists) battles.set(bid, s.data()); }
  }

  // 4. Tick captures that carry calls[] — for the scoped shadow battles.
  const tickRefs = [];
  for (const bid of new Set([...shadowBattleIds, ...calls.map((c) => c.battleId)])) {
    const ts = await db.collection('agentBattles').doc(bid).collection('ticks').get();
    for (const t of ts.docs) { const x = t.data(); if (Array.isArray(x.calls)) tickRefs.push({ battleId: bid, tickId: t.id, evalId: x.evalId ?? null, calls: x.calls, schemaVersion: x.schemaVersion ?? x.version ?? null }); }
  }

  // ------------------------------------------------------------ tallies

  // Declarations
  const decl = { byDay: {}, missingKey: 0, expectedWithoutRecord: [], recordWithoutExpected: [] };
  const declByEval = new Map(decls.map((d) => [`${d.battleId}:${d.docId}`, d]));
  for (const x of entries.filter((y) => y.window === 'shadow')) {
    const row = decl.byDay[x.day] ||= { entries: 0, none: 0, expected: 0, absent: 0, recordsWritten: 0 };
    row.entries += 1;
    const ph = x.e.declarationsPhase;
    if (ph === 'none') row.none += 1; else if (ph === 'expected') row.expected += 1; else { row.absent += 1; decl.missingKey += 1; }
    const rec = declByEval.get(`${x.battleId}:${x.e.evalId}`);
    if (ph === 'expected' && !rec) decl.expectedWithoutRecord.push(`${x.battleId}:${x.e.evalId}`);
    if (ph !== 'expected' && rec) decl.recordWithoutExpected.push(`${x.battleId}:${x.e.evalId}`);
  }
  const removedByReason = {}; const removedByDay = {};
  for (const d of decls) {
    const day = etDay(toMs(d.mintedAt));
    (decl.byDay[day] ||= { entries: 0, none: 0, expected: 0, absent: 0, recordsWritten: 0 }).recordsWritten += 1;
    for (const r of d.removed || []) { inc(removedByReason, `${r.source}:${r.reason}`); inc(removedByDay[day] ||= {}, `${r.source}:${r.reason}`); }
    for (const o of d.removedOverflow || []) { inc(removedByReason, `${o.source}:${o.reason}`, o.count); inc(removedByDay[day] ||= {}, `${o.source}:${o.reason}`, o.count); }
  }
  const wire = { written: 0, failed: 0, other: 0, list: [] };
  const diagList = [];
  for (const [bid, b] of battles) {
    const cs = b.cronState || {};
    if (cs.declarationsPhase) {
      const p = cs.declarationsPhase.phase;
      if (p === 'written') wire.written += 1; else if (p === 'failed') wire.failed += 1; else wire.other += 1;
      wire.list.push({ battleId: bid, ...cs.declarationsPhase });
    }
    if (cs.callsDiag) diagList.push({ battleId: bid, status: b.status, lastDay: etDay(toMs(b.cronState?.lastEvaluatedAt)), ...cs.callsDiag });
  }

  // Calls
  const callStats = { byDayKindState: {}, invalidReasons: {}, nextCheck: { judgedHit: 0, judgedExpired: 0, preSlotHit: 0, openPastBoundary: [], open: 0 }, acted: [], hitVsExpired: { hit: 0, expired_unresolved: 0 } };
  const mintedReason = new Map();
  for (const d of decls) for (const m of d.minted || []) mintedReason.set(m.callId, m.reason ?? null);
  for (const c of calls) {
    const day = etDay(toMs(c.mintedAt));
    inc(callStats.byDayKindState[day] ||= {}, `${c.kind}|${c.state}`);
    if (c.state === 'invalidated') inc(callStats.invalidReasons, mintedReason.get(c.callId) ?? 'unrecorded');
    if (TERMINAL.has(c.state)) inc(callStats.hitVsExpired, c.state);
    if (c.outcome?.actedEvalId) callStats.acted.push({ callId: c.callId, actedEvalId: c.outcome.actedEvalId });
    if (c.horizon?.basis === 'next_check') {
      const r = receipts.get(`agentBattles/${c.battleId}/callObservations/${c.callId}`);
      if (c.state === 'open') {
        callStats.nextCheck.open += 1;
        if (Number.isFinite(c.horizon.expiresAt) && readAtMs >= c.horizon.expiresAt) callStats.nextCheck.openPastBoundary.push(c.callId);
      } else if (r && TERMINAL.has(c.state)) {
        if (r.observedAtMs >= c.horizon.expiresAt) { if (c.state === 'hit') callStats.nextCheck.judgedHit += 1; else callStats.nextCheck.judgedExpired += 1; }
        else if (c.state === 'hit') callStats.nextCheck.preSlotHit += 1;
      }
    }
  }
  const conflicts = diagList.filter((d) => d.phaseResult === 'call_conflict' || (d.perId || []).some((p) => p?.reason === 'call_conflict'));

  // Integrity
  const violations = [];
  const checksRun = { terminal_has_receipt: 0, hit_after_mint_and_px_satisfies: 0, no_hit_on_minting_eval: 0, no_open_call_under_completed_battle: 0, tick_call_ref_resolves: 0 };
  for (const c of calls) {
    const receiptPath = `agentBattles/${c.battleId}/callObservations/${c.callId}`;
    const receipt = receipts.get(receiptPath) ?? null;
    checksRun.terminal_has_receipt += 1; checksRun.no_hit_on_minting_eval += 1; checksRun.no_open_call_under_completed_battle += 1;
    if (c.state === 'hit') checksRun.hit_after_mint_and_px_satisfies += 1;
    violations.push(...integrityViolations({ call: c, receipt, battleStatus: battles.get(c.battleId)?.status ?? 'missing', receiptPath }));
  }
  const callIds = new Set(calls.map((c) => `${c.battleId}|${c.callId}`));
  for (const t of tickRefs) for (const ref of t.calls) {
    checksRun.tick_call_ref_resolves += 1;
    if (!callIds.has(`${t.battleId}|${ref?.callId}`)) violations.push({ check: 'tick_call_ref_resolves', callId: ref?.callId ?? null, detail: `ticks/${t.tickId} (battle ${t.battleId}) references a call that does not exist` });
  }
  const receiptCallPaths = new Set(calls.map((c) => `agentBattles/${c.battleId}/callObservations/${c.callId}`));
  const orphanReceipts = [...receipts.keys()].filter((p) => !receiptCallPaths.has(p));

  // Coverage
  const flipsList = [];
  for (const [bid, b] of battles) { const f = b?.cronState?.callFlips; if (f) flipsList.push({ battleId: bid, status: b.status, exit: b.cronState?.callsDiag?.exit ?? null, lastDay: etDay(toMs(b.cronState?.lastEvaluatedAt)), ...f }); }
  const phaseMs = diagList.map((d) => d.ms).filter(Number.isFinite);
  const flipMs = diagList.map((d) => d.flips?.ms).filter(Number.isFinite);
  const queueRows = queue.map((q) => {
    const bid = q.battleId || q.id;
    const open = calls.filter((c) => c.battleId === bid && c.state === 'open').length;
    return { battleId: bid, nextExpiresAt: q.nextExpiresAt, battleStatus: battles.get(bid)?.status ?? 'missing', openCalls: open };
  });

  // Rollback triggers
  const windowStats = (w) => {
    const es = entries.filter((x) => x.window === w).map((x) => x.e);
    const called = es.filter((e) => Number.isFinite(e.callMs));
    const ok = called.filter((e) => !e.haikuError);
    const fc = (e) => e.haikuError?.failureClass;
    // Runs with no battle in them (an empty slot) say nothing about load; they are counted separately.
    const allRuns = runs.filter((r) => { const ms = toMs(r.startedAt ?? r.id); return w === 'shadow' ? ms >= FLIP_MS : BASELINE_DAYS.includes(etDay(ms)); });
    const wRuns = allRuns.filter((r) => (r.battlesTotal || 0) > 0);
    return {
      entries: es.length,
      modelCalls: called.length,
      timeouts: called.filter((e) => fc(e) === 'timeout').length,
      truncInvalid: called.filter((e) => fc(e) === 'truncated_response' || fc(e) === 'invalid_tool_result').length,
      p50CallMs: pct(called.map((e) => e.callMs), 50),
      p95CallMs: pct(called.map((e) => e.callMs), 95),
      swaps: es.filter((e) => e.decision === 'SWAP').length,
      modelOk: ok.length,
      candidates: ok.reduce((s, e) => s + (Array.isArray(e.candidates) ? e.candidates.length : 0), 0),
      runs: wRuns.length,
      deferred: wRuns.reduce((s, r) => s + (r.deferred || 0), 0),
      emptyRuns: allRuns.length - wRuns.length,
      battlesPerRun: rate(wRuns.reduce((s, r) => s + (r.battlesTotal || 0), 0), wRuns.length),
      runP95WallMs: pct(wRuns.map((r) => r.wallMs), 95),
      wallPerBattleP50: pct(wRuns.map((r) => r.wallMs / r.battlesTotal), 50),
      days: [...new Set(entries.filter((x) => x.window === w).map((x) => x.day))].sort(),
      failureClasses: es.reduce((acc, e) => (fc(e) ? inc(acc, fc(e)) : acc), {}),
    };
  };
  const base = windowStats('baseline');
  const shad = windowStats('shadow');
  const trig = [
    { name: 'Model timeout rate (per model call)', b: rate(base.timeouts, base.modelCalls), a: rate(shad.timeouts, shad.modelCalls), kind: 'pts', threshold: TRIGGERS.timeoutPts, rule: '≥ +2 pts' },
    { name: 'truncated_response + invalid_tool_result (per model call)', b: rate(base.truncInvalid, base.modelCalls), a: rate(shad.truncInvalid, shad.modelCalls), kind: 'pts', threshold: TRIGGERS.truncInvalidPts, rule: '≥ +1 pt' },
    { name: 'p95 callMs', b: base.p95CallMs, a: shad.p95CallMs, kind: 'ms', threshold: TRIGGERS.p95CallMsDelta, rule: '≥ +2,000 ms' },
    { name: 'SWAP share (per entry)', b: rate(base.swaps, base.entries), a: rate(shad.swaps, shad.entries), kind: 'rel', threshold: TRIGGERS.relativeMove, rule: '> 25 % relative' },
    { name: 'Anticipation candidates per check (model-ok checks)', b: rate(base.candidates, base.modelOk), a: rate(shad.candidates, shad.modelOk), kind: 'rel', threshold: TRIGGERS.relativeMove, rule: '> 25 % relative' },
  ].map((t) => ({ ...t, ...judgeTrigger({ before: t.b, after: t.a, kind: t.kind, threshold: t.threshold }) }));
  const perDay = {};
  for (const x of entries) {
    const d = perDay[x.day] ||= { window: x.window, entries: 0, called: [], timeouts: 0, truncInvalid: 0, swaps: 0, ok: 0, candidates: 0, battles: new Set() };
    d.entries += 1;
    d.battles.add(x.battleId);
    if (x.e.decision === 'SWAP') d.swaps += 1;
    if (Number.isFinite(x.e.callMs)) {
      d.called.push(x.e.callMs);
      const fc = x.e.haikuError?.failureClass;
      if (fc === 'timeout') d.timeouts += 1;
      if (fc === 'truncated_response' || fc === 'invalid_tool_result') d.truncInvalid += 1;
      if (!x.e.haikuError) { d.ok += 1; d.candidates += Array.isArray(x.e.candidates) ? x.e.candidates.length : 0; }
    }
  }
  const deferredPerRun = { b: rate(base.deferred, base.runs), a: rate(shad.deferred, shad.runs) };

  // Samples: every call when ≤ 10, else varied by kind then archetype.
  const archetypeOf = (bid) => battles.get(bid)?.agentContext?.archetype ?? null;
  const sorted = [...calls].sort((x, y) => x.mintedAt - y.mintedAt);
  const samples = [];
  const seen = new Set();
  for (const c of sorted) { const k = `${c.kind}|${archetypeOf(c.battleId)}`; if (!seen.has(k)) { seen.add(k); samples.push(c); } }
  for (const c of sorted) { if (samples.length >= 10) break; if (!samples.includes(c)) samples.push(c); }
  samples.length = Math.min(samples.length, 10);

  // ------------------------------------------------------------ the report

  const L = [];
  const p = (s = '') => L.push(s);
  const tbl = (head, rows) => { p(`| ${head.join(' | ')} |`); p(`|${head.map(() => '---').join('|')}|`); for (const r of rows) p(`| ${r.join(' | ')} |`); };
  const tripped = trig.filter((t) => t.verdict === 'TRIPPED');
  const shadowEntries = entries.filter((x) => x.window === 'shadow');
  const partialDay = etDay(readAtMs);

  p('## Generated tables');
  p();
  p(`Read at ${new Date(readAtMs).toISOString()} (${etClock(readAtMs)}). Flip merge instant: ${FLIP_MERGED_AT}. Battles read in full: ${battles.size} of ${index.size}. Shadow entries: ${shadowEntries.length} across ${shadowBattleIds.size} battles on ${shadowDays.join(', ') || 'no day'}${shadowDays.includes(partialDay) ? ` (${partialDay} is a session still in progress at read time)` : ''}.`);
  p();
  p('### A. Executive tallies');
  p();
  tbl(['Item', 'Value'], [
    ['Call records (all time, collection group)', String(calls.length)],
    ['Declarations records', String(decls.length)],
    ['Receipts (`callObservations`)', String(receipts.size)],
    ['Open `callSweepQueue` documents', String(queue.length)],
    ['Integrity violations', String(violations.length)],
    ['`call_conflict` (latest `callsDiag` per battle)', String(conflicts.length)],
    ['Rollback triggers tripped', `${tripped.length} of ${trig.length}`],
  ]);
  p();

  p('### B. Declarations, per ET day');
  p();
  tbl(['ET day', 'Entries', "phase 'none'", "phase 'expected'", 'phase key absent', 'declarations/ written'],
    Object.keys(decl.byDay).sort().map((d) => { const r = decl.byDay[d]; return [d, r.entries, r.none, r.expected, r.absent, r.recordsWritten].map(String); }));
  p();
  p(`- \`expected\` entries with no \`declarations/{evalId}\` record: ${decl.expectedWithoutRecord.length ? decl.expectedWithoutRecord.join(', ') : 'none'}.`);
  p(`- Records whose entry is not \`expected\`: ${decl.recordWithoutExpected.length ? decl.recordWithoutExpected.join(', ') : 'none'}.`);
  p(`- Removed rows by reason (from records that exist): ${Object.keys(removedByReason).length ? Object.entries(removedByReason).map(([k, v]) => `\`${k}\` ×${v}`).join(', ') : 'none'}. Per day: ${Object.keys(removedByDay).length ? Object.entries(removedByDay).map(([d, o]) => `${d} → ${Object.entries(o).map(([k, v]) => `${k}×${v}`).join(', ')}`).join('; ') : 'none'}.`);
  p(`- \`cronState.declarationsPhase\` (latest check per battle only): written ${wire.written}, failed ${wire.failed}${wire.other ? `, other ${wire.other}` : ''}.`);
  for (const w of wire.list) p(`  - ${w.battleId}: \`${w.evalId}\` → \`${w.phase}\``);
  p();

  p('### C. Calls');
  p();
  tbl(['ET day (mint)', 'kind | state', 'Count'], Object.keys(callStats.byDayKindState).sort().flatMap((d) => Object.entries(callStats.byDayKindState[d]).map(([k, v]) => [d, k, String(v)])));
  p();
  p(`- Invalidated reasons: ${Object.keys(callStats.invalidReasons).length ? Object.entries(callStats.invalidReasons).map(([k, v]) => `\`${k}\` ×${v}`).join(', ') : 'none'}.`);
  p(`- Terminal: hit ${callStats.hitVsExpired.hit || 0}, expired_unresolved ${callStats.hitVsExpired.expired_unresolved || 0}.`);
  p(`- \`next_check\` judgments: judged at the boundary → hit ${callStats.nextCheck.judgedHit}, expired_unresolved ${callStats.nextCheck.judgedExpired}; pre-slot hits ${callStats.nextCheck.preSlotHit}; still open ${callStats.nextCheck.open} (past their boundary at read time: ${callStats.nextCheck.openPastBoundary.length ? callStats.nextCheck.openPastBoundary.join(', ') : 'none'}).`);
  p(`- \`outcome.actedEvalId\` set: ${callStats.acted.length}${callStats.acted.length ? ` (${callStats.acted.map((a) => `${a.callId} → ${a.actedEvalId}`).join('; ')})` : ''}.`);
  p(`- \`call_conflict\` in \`cronState.callsDiag\`: ${conflicts.length}${conflicts.length ? ` (${conflicts.map((c) => `${c.battleId}:${c.evalId}`).join(', ')})` : ''}. Expect 0.`);
  p(`- \`callsDiag.phaseResult\` (latest per battle): ${Object.entries(diagList.reduce((a, d) => inc(a, d.phaseResult ?? 'null'), {})).map(([k, v]) => `\`${k}\` ×${v}`).join(', ') || 'none'}; truncated flags: ${diagList.filter((d) => d.truncated).length}; faults: ${diagList.reduce((s, d) => s + (d.faults?.length || 0), 0)}.`);
  p();

  p('### D. Integrity');
  p();
  tbl(['Check', 'Subjects checked', 'Violations'], Object.keys(checksRun).map((k) => [k, String(checksRun[k]), String(violations.filter((v) => v.check === k).length)]));
  p();
  if (violations.length) { p('Violations:'); p(); for (const v of violations) p(`- \`${v.check}\` — \`${v.callId}\`: ${v.detail}`); p(); }
  p(`- Receipts with no call: ${orphanReceipts.length ? orphanReceipts.join(', ') : 'none'}.`);
  p(`- Tick captures carrying \`calls[]\`: ${tickRefs.length} (${tickRefs.filter((t) => t.calls.length).length} non-empty, ${tickRefs.reduce((s, t) => s + t.calls.length, 0)} references).`);
  p();

  p('### E. Coverage');
  p();
  const completeN = flipsList.filter((f) => f.complete === true).length;
  p(`- \`cronState.callFlips\`: ${flipsList.length} battles carry it; complete ${completeN}/${flipsList.length}${flipsList.length ? ` (${fmtPct(completeN, flipsList.length)})` : ''}. Every battle the cron scanned carries it, including passive (CPU) battles, which write no evaluation entry. This is the latest scan only, because each check overwrites it.`);
  p();
  tbl(['Battle', 'Status', 'Last check (ET day)', 'Latest exit', 'evalId', 'scanned', 'total', 'complete', 'cursor'], flipsList.sort((x, y) => x.lastDay.localeCompare(y.lastDay) || x.battleId.localeCompare(y.battleId)).map((f) => [f.battleId, f.status, f.lastDay, String(f.exit), String(f.evalId), String(f.scanned), String(f.total), String(f.complete), f.cursor ? `${f.cursor.callId} @ ${f.cursor.mintedAt}` : 'null']));
  p();
  p(`- Open \`callSweepQueue\` documents (nothing drains them until Build 1): ${queueRows.length}.`);
  p();
  tbl(['Battle', 'nextExpiresAt', 'Battle status', 'Open calls'], queueRows.map((q) => [q.battleId, `${q.nextExpiresAt} (${etClock(q.nextExpiresAt)})`, q.battleStatus, String(q.openCalls)]));
  p();
  p(`- Calls phase wall time, \`callsDiag.ms\` (latest check per battle, n=${phaseMs.length}): p50 ${pct(phaseMs, 50) ?? 'n/a'} ms, p95 ${pct(phaseMs, 95) ?? 'n/a'} ms. Flip scan \`callsDiag.flips.ms\` (n=${flipMs.length}): p50 ${pct(flipMs, 50) ?? 'n/a'} ms, p95 ${pct(flipMs, 95) ?? 'n/a'} ms. The two are equal in ${diagList.filter((d) => Number.isFinite(d.ms) && d.ms === d.flips?.ms).length} of ${diagList.length} battles. \`callsDiag.ms\` is composed as soon as the scan returns (flip.js \`runExitCallsHook\`), before the status write, so in practice it is the same measurement.`);
  p(`- \`callsDiag.exit\` mix (latest per battle): ${Object.entries(diagList.reduce((a, d) => inc(a, d.exit ?? 'null'), {})).map(([k, v]) => `\`${k}\` ×${v}`).join(', ') || 'none'}; flip stops: ${Object.entries(diagList.reduce((a, d) => inc(a, d.flips?.stopped ?? 'none'), {})).map(([k, v]) => `\`${k}\` ×${v}`).join(', ') || 'none'}.`);
  p();

  p('### F. Rollback triggers (report §10), baseline Sep 21–25 vs shadow');
  p();
  const n = (v, d = 4) => (v == null ? 'n/a' : (Number.isInteger(v) ? String(v) : v.toFixed(d)));
  tbl(['Window', 'Days with entries', 'Entries', 'Model calls', 'Timeouts', 'Trunc+invalid', 'p50 callMs', 'p95 callMs', 'SWAPs', 'Model-ok checks', 'Candidates'],
    [['baseline', base], ['shadow', shad]].map(([w, s]) => [w, s.days.join(', ') || 'none', s.entries, s.modelCalls, s.timeouts, s.truncInvalid, s.p50CallMs, s.p95CallMs, s.swaps, s.modelOk, s.candidates].map((v) => String(v ?? 'n/a'))));
  p();
  tbl(['Window', 'Runs with battles', 'Empty runs', 'Battles per run', 'Deferred battles', 'Run p95 wallMs', 'p50 wallMs per battle'],
    [['baseline', base], ['shadow', shad]].map(([w, s]) => [w, s.runs, s.emptyRuns, s.battlesPerRun == null ? 'n/a' : s.battlesPerRun.toFixed(2), s.deferred, s.runP95WallMs, s.wallPerBattleP50 == null ? 'n/a' : Math.round(s.wallPerBattleP50)].map((v) => String(v ?? 'n/a'))));
  p();
  p('Per ET day:');
  p();
  tbl(['ET day', 'Window', 'Battles', 'Entries', 'Model calls', 'Timeout rate', 'Trunc+invalid rate', 'p95 callMs', 'SWAP share', 'Candidates / model-ok check'],
    Object.keys(perDay).sort().map((d) => { const r = perDay[d]; return [d, r.window, r.battles.size, r.entries, r.called.length, fmtPct(r.timeouts, r.called.length), fmtPct(r.truncInvalid, r.called.length), pct(r.called, 95), fmtPct(r.swaps, r.entries), r.ok ? (r.candidates / r.ok).toFixed(2) : 'n/a'].map((v) => String(v ?? 'n/a')); }));
  p();
  tbl(['Trigger', 'Rule', 'Baseline', 'Shadow', 'Move', 'Verdict'], trig.map((t) => [t.name, t.rule, n(t.b), n(t.a), t.delta ?? 'n/a', `**${t.verdict}**`]));
  p();
  p('Per battle (model-ok checks only), to show whether a move is the same battles changing or a different mix of battles:');
  p();
  const perBattle = {};
  for (const x of entries) {
    if (!Number.isFinite(x.e.callMs) || x.e.haikuError) continue;
    const r = perBattle[`${x.window}|${x.battleId}`] ||= { window: x.window, battleId: x.battleId, ok: 0, candidates: 0, swaps: 0, days: new Set() };
    r.ok += 1; r.days.add(x.day);
    r.candidates += Array.isArray(x.e.candidates) ? x.e.candidates.length : 0;
    if (x.e.decision === 'SWAP') r.swaps += 1;
  }
  tbl(['Window', 'Battle', 'Archetype', 'ET days', 'Model-ok checks', 'Candidates / check', 'SWAPs'],
    Object.values(perBattle).sort((x, y) => x.window.localeCompare(y.window) || [...x.days][0].localeCompare([...y.days][0])).map((r) => [r.window, r.battleId, String(battles.get(r.battleId)?.agentContext?.archetype ?? 'n/a'), [...r.days].join(', '), String(r.ok), (r.candidates / r.ok).toFixed(2), String(r.swaps)]));
  p();
  p(`- Deferred battles per run (no §10 threshold — reported, not judged): baseline ${n(deferredPerRun.b, 3)}, shadow ${n(deferredPerRun.a, 3)}.`);
  p(`- Failure classes, baseline: ${Object.entries(base.failureClasses).map(([k, v]) => `\`${k}\` ×${v}`).join(', ') || 'none'}; shadow: ${Object.entries(shad.failureClasses).map(([k, v]) => `\`${k}\` ×${v}`).join(', ') || 'none'}.`);
  p();

  p(`### G. Sample calls (${samples.length} — ${calls.length <= 10 ? 'every call in production' : 'varied by kind and archetype'})`);
  p();
  samples.forEach((c, i) => {
    const r = receipts.get(`agentBattles/${c.battleId}/callObservations/${c.callId}`) ?? null;
    p(`**${i + 1}. \`${c.callId}\`** — kind \`${c.kind}\`, archetype \`${archetypeOf(c.battleId)}\`, minted ${etClock(c.mintedAt)}`);
    p();
    p('```json');
    p(JSON.stringify({ said: c.said, symbol: c.symbol, direction: c.direction, slot: c.slot, counterpart: c.counterpart, ...(c.kind === 'pick' ? { swapOut: c.swapOut, options: c.options } : {}), condition: c.condition, defaultAction: c.defaultAction, horizon: c.horizon, state: c.state, stateSource: c.stateSource, stateChangedAt: c.stateChangedAt, origin: c.origin, outcome: c.outcome, receipt: r }, null, 2));
    p('```');
    p();
  });

  let callsEnabledWindow = null;
  if (wantCallsEnabledWindow) {
    callsEnabledWindow = computeCallsEnabledWindow(battles);
    p('### H. Rollback recipe (Build 1a §12) — the calls-enabled window');
    p();
    p(renderCallsEnabledWindow(callsEnabledWindow));
    p();
    tbl(['ET session', 'Model calls', 'invalid_tool_result'], callsEnabledWindow.perDay.map((d) => [d.day, String(d.modelCalls), String(d.invalid)]));
    p();
  }

  const md = L.join('\n');
  if (outPath) writeFileSync(outPath, md + '\n');
  else console.log(md);
  if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ readAtMs, base, shad, trig, violations, calls, decls, receipts: Object.fromEntries(receipts), queue, flipsList, diagList, wire, decl, callStats, tickRefs, ...(callsEnabledWindow ? { callsEnabledWindow } : {}) }, null, 2));
  console.error(`[shadow-read] battles=${battles.size} shadowEntries=${shadowEntries.length} calls=${calls.length} violations=${violations.length} tripped=${tripped.length}`);
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) main().catch((err) => { console.error(err); process.exit(1); });
