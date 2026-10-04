// api/_utils/callRecords/candidate.js
//
// Cockpit Build 0 — THE MINT CANDIDATE (spec docs/design/COCKPIT_SPEC_V1_3.md
// §3.6; contract docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md §2.1, §3, §4).
//
// Built ONCE, after the evaluation commit succeeds, outside any transaction
// retry, and frozen: the declarations record and every call document, their
// ids, their mint instant and their canonical forms. Publication compares
// against these canonical forms and never rebuilds them.
//
//   ids          `${battleId}:${evalId}:call:${n}`, n zero-based after removal
//   validity     §3.2 against the MODEL-RESULT observation (invalidated shots
//                are born `invalidated` with a typed reason on the record)
//   horizon      §3.5, re-judged against the REAL mint instant
//   evidence     { tickId | null, availability: 'off' | 'unresolved',
//                  priceAsOf: promptBuiltAt (its ISO string) | null } — never
//                the current time
//   provenance   hypothesisRef / origin from the FROZEN battle context
//                (agentContext.equippedWatchlist, resolvedAgentManifest
//                .equippedConfigHash) — the live watchlist is never fetched
//
// CANONICAL FORM = stable-key JSON of the immutable fields: everything except
// state, stateChangedAt, stateSource, playerResponse, outcome, refused and
// evidence.availability.
//
// Cockpit Build 2a — THE MINT FIELDS (contract Amendment C; spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md S-2). Every new call and record carries
// what the cockpit needs to say nothing false, each from the check's own seam
// and never inferred from prompt text:
//   heldAtMint      shots / confirmations: direction 'entry' on a symbol HELD
//                   at the model seam (C-2) — an upside call, answerable by no one
//   counterpart     kept only when USABLE at the seam (C-3); otherwise null and
//   counterpartRaw  the agent's string, cut to 40 code points (null when the
//                   counterpart was usable or absent) — audits only, never copy
//   saidOk          the said lint's verdict on this call's own `said` (C-4)
//   mintedMode      the check's resolved mode, 'shadow' | 'on' (C-5) — calls and
//                   the record
//   watchingSource  the record's kept watch list origin (C-1)
// The held set, the universe and the cooldown-locked set are frozen at the
// SAME seam (observe.js freezeModelObservation): the lock set from the very
// bench objects the prompt rendered "locked until …" from, at promptBuiltAt
// (review L1-3). An unknown lock set (null) excludes nothing — no lock is
// guessed.
//
// Pure: no I/O, no clock (the mint instant is handed in).

import { validateDeclarations, invalidationReason, sortRemovedInSourceOrder, removedRecordFields, DECLARATION_CAPS, jsonBytes } from './validate.js';
import { bindHorizon, battleExpiryMs } from './horizon.js';
import { saidPassesLint } from './copy.js';

/** The modes a record can be minted under (Amendment C-5). */
export const MINTED_MODES = Object.freeze(['shadow', 'on']);

/** counterpartRaw's cap, in Unicode code points (Amendment C-3). */
export const COUNTERPART_RAW_MAX = 40;

/** The fields a canonical form leaves out — the mutable state of a call. */
export const MUTABLE_CALL_FIELDS = Object.freeze(['state', 'stateChangedAt', 'stateSource', 'playerResponse', 'outcome', 'refused']);

/**
 * Provenance reasons (contract §4 `provenance_unresolved`): each names a
 * watchlist snapshot that is PRESENT but unusable (founder ruling A-1 — an
 * absent snapshot is agent_initiative, never unresolved).
 */
export const PROVENANCE_REASONS = Object.freeze(['snapshot_corrupt', 'config_hash_missing']);

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmptyString = (v) => typeof v === 'string' && v.length > 0;

/** `${battleId}:${evalId}:call:${n}` (contract §3). */
export function callIdOf(battleId, evalId, n) {
  return `${battleId}:${evalId}:call:${n}`;
}

/**
 * Stable-key JSON: object keys sorted at every depth, arrays in order, JSON's
 * own rules for every leaf (a non-finite number is `null`, as it is in any
 * JSON of the same document read back).
 */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  const json = JSON.stringify(value);
  return json === undefined ? 'null' : json;
}

/** A call's canonical form (the immutable fields only). */
export function canonicalCall(call) {
  if (!isPlainObject(call)) return stableStringify(call);
  const immutable = {};
  for (const [k, v] of Object.entries(call)) {
    if (MUTABLE_CALL_FIELDS.includes(k)) continue;
    if (k === 'evidence' && isPlainObject(v)) {
      const { availability: _availability, ...rest } = v;
      immutable.evidence = rest;
      continue;
    }
    immutable[k] = v;
  }
  return stableStringify(immutable);
}

/** The declarations record's canonical form (every field is immutable). */
export function canonicalRecord(record) {
  return stableStringify(record);
}

/**
 * hypothesisRef + origin from the FROZEN battle context (contract §4, the
 * complete origin rule, as amended by founder ruling A-1, 2026-09-24). Never
 * fetches; never infers origin from a null ref.
 *
 *   valid snapshot + a validated version       → versioned { watchlistId, hypothesisVersion }, equipped
 *   valid snapshot + hash (no version)         → legacy { watchlistId, equippedConfigHash }, equipped
 *   valid snapshot, no hash, no version        → null, provenance_unresolved ('config_hash_missing')
 *   a corrupt snapshot (or a corrupt version)  → null, provenance_unresolved ('snapshot_corrupt')
 *   NO snapshot (absent or null)               → null, agent_initiative — whatever the config hash says
 *
 * Ruling A-1: the manifest's equippedConfigHash exists on every battle created
 * with the manifest write on — it hashes `equippedWatchlist: null` as well — so
 * a hash is no evidence of an equipped watchlist. `provenance_unresolved` is
 * reserved for a snapshot that is PRESENT but unusable (review A-1: the
 * contract's "hash without watchlist" case made agent_initiative unreachable).
 *
 * The VERSIONED branch reads `agentContext.equippedWatchlist.hypothesisVersion`
 * (a positive integer). HEAD's producer never writes one
 * (watchlistEquip.js buildEquippedSnapshot → { watchlistId, name, tickers }),
 * so that branch is exercised by a synthetic fixture only.
 */
export function resolveProvenance(battle) {
  const snapshot = battle?.agentContext?.equippedWatchlist;
  // Ruling A-1: no frozen watchlist → the agent's own initiative, regardless of the hash.
  if (snapshot === undefined || snapshot === null) return { hypothesisRef: null, origin: 'agent_initiative' };
  const hash = battle?.resolvedAgentManifest?.equippedConfigHash;
  const hasHash = nonEmptyString(hash);
  if (!isPlainObject(snapshot) || !nonEmptyString(snapshot.watchlistId) || !Array.isArray(snapshot.tickers)) {
    return { hypothesisRef: null, origin: 'provenance_unresolved', provenanceReason: 'snapshot_corrupt' };
  }
  const version = snapshot.hypothesisVersion;
  if (version !== undefined && version !== null) {
    if (!(Number.isInteger(version) && version > 0)) {
      return { hypothesisRef: null, origin: 'provenance_unresolved', provenanceReason: 'snapshot_corrupt' };
    }
    return { hypothesisRef: { watchlistId: snapshot.watchlistId, hypothesisVersion: version }, origin: 'equipped' };
  }
  if (hasHash) return { hypothesisRef: { watchlistId: snapshot.watchlistId, equippedConfigHash: hash }, origin: 'equipped' };
  return { hypothesisRef: null, origin: 'provenance_unresolved', provenanceReason: 'config_hash_missing' };
}

/** The evidence a call is minted with (contract §4 literal wire shape). */
export function mintEvidence({ tickId, promptBuiltAt }) {
  const id = nonEmptyString(tickId) ? tickId : null;
  return { tickId: id, availability: id ? 'unresolved' : 'off', priceAsOf: nonEmptyString(promptBuiltAt) ? promptBuiltAt : null };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/**
 * Is a shot's counterpart USABLE at the seam (Amendment C-3)? Exact
 * membership, the seam's own spelling (the fork options' rule):
 *   exit  — the replacement: in the check's universe, not held, not the call's
 *           own symbol, and not cooldown-locked where the seam knows lock
 *           status (`locked` — null when it does not);
 *   entry — the position the entry would replace: held, not the own symbol.
 * An unknown seam (held or universe null) proves nothing usable.
 *
 * @param {{ symbol: string, direction: string, counterpart?: string }} row
 * @param {{ held: string[]|null, universe: string[]|null, locked?: string[]|null }} seam
 */
export function counterpartUsable(row, { held, universe, locked = null }) {
  const cp = row?.counterpart;
  if (typeof cp !== 'string' || cp.length === 0) return false;
  if (!Array.isArray(held) || !Array.isArray(universe)) return false;
  if (cp === row.symbol) return false;
  if (row.direction === 'exit') return universe.includes(cp) && !held.includes(cp) && !(Array.isArray(locked) && locked.includes(cp));
  if (row.direction === 'entry') return held.includes(cp);
  return false;
}

/** The agent's counterpart string, cut to its first 40 code points (never a split surrogate). */
export function counterpartRawOf(counterpart) {
  return [...counterpart].slice(0, COUNTERPART_RAW_MAX).join('');
}

/** C-4: the lint's verdict on one call's own `said`; null when it says nothing. */
export function saidOkOf(said, basis) {
  if (typeof said !== 'string' || said.trim().length === 0) return null;
  return saidPassesLint(said, basis);
}

function composeCall(spec, { battleId, evalId, evalSeq, mintedAtMs, mintedMode, observation, evidence, provenance, held, universe, locked }) {
  const { n, kind, row, horizon } = spec;
  const isPick = kind === 'pick';
  const reason = isPick ? null : invalidationReason(row, observation);
  const hasCounterpart = !isPick && typeof row.counterpart === 'string' && row.counterpart.length > 0;
  const usable = hasCounterpart && counterpartUsable(row, { held, universe, locked });
  const call = {
    callId: callIdOf(battleId, evalId, n),
    kind,
    battleId,
    evalId,
    evalSeq,
    mintedAt: mintedAtMs,
    mintedMode,
    symbol: isPick ? null : row.symbol,
    direction: isPick ? null : row.direction,
    // C-2: shots and confirmations only — an 'entry' on a name held at the seam.
    ...(isPick ? {} : { heldAtMint: row.direction === 'entry' && Array.isArray(held) && held.includes(row.symbol) }),
    slot: row.slot,
    counterpart: usable ? row.counterpart : null,
    counterpartRaw: hasCounterpart && !usable ? counterpartRawOf(row.counterpart) : null,
    ...(isPick ? { swapOut: row.swapOut, options: row.options.map((o) => ({ symbol: o.symbol, why: o.why })) } : {}),
    condition: isPick ? null : { side: row.condition.side, level: row.condition.level },
    horizon: { phrase: isPick ? 'next_check' : row.horizonPhrase, expiresAt: horizon.expiresAtMs, basis: horizon.basis },
    defaultAction: isPick ? null : row.defaultAction,
    said: row.said,
    saidOk: saidOkOf(row.said, horizon.basis),
    evidence: { ...evidence },
    hypothesisRef: provenance.hypothesisRef ? { ...provenance.hypothesisRef } : null,
    origin: provenance.origin,
    ...(provenance.provenanceReason ? { provenanceReason: provenance.provenanceReason } : {}),
    state: reason ? 'invalidated' : 'open',
    stateChangedAt: mintedAtMs,
    stateSource: 'mint',
    playerResponse: null,
    directiveThreadId: null,
    outcome: null,
    refused: null,
  };
  return { call, reason };
}

/**
 * Build the frozen mint candidate. `record` is null when nothing survives —
 * there is then nothing to write.
 *
 * @param {object} p
 * @param {string} p.battleId
 * @param {string} p.evalId        the COMMITTED evaluation identity
 * @param {number} p.evalSeq
 * @param {number} p.mintedAtMs    fixed once, after the evaluation commit
 * @param {unknown} p.raw          the detached declarations block (from the tool-result seam)
 * @param {string[]} p.universe    the battle universe frozen at the prompt seam
 * @param {object|null} p.observation  the model-result observation
 * @param {string|null} p.promptBuiltAt the committed evaluation's ISO prompt instant
 * @param {string|null} p.tickId   the tick capture id, or null (capture off)
 * @param {object} p.battle        the in-memory battle (frozen context: provenance, expiry)
 * @param {unknown} [p.topLevelWatching] Amendment C-1: the same tool input's top-level `watching`,
 *   detached at the tool-result seam (absent → nothing read from the top level)
 * @param {string[]|null} p.held   Amendment C-2/C-3: the held set frozen at the model seam —
 *   REQUIRED; `null` is the explicit "unknown" (heldAtMint false, no counterpart usable)
 * @param {'shadow'|'on'} p.mintedMode Amendment C-5: the check's resolved mode — REQUIRED
 */
export function buildMintCandidate({ battleId, evalId, evalSeq, mintedAtMs, raw, universe, observation, promptBuiltAt, tickId, battle, topLevelWatching, held, locked = null, mintedMode }) {
  // No silent default for a load-bearing seam fact: omission is a defect, and
  // opting out (null) is an explicit act.
  if (held === undefined) throw new Error('buildMintCandidate: `held` is required (null when the seam knows no held set)');
  if (!MINTED_MODES.includes(mintedMode)) throw new Error(`buildMintCandidate: mintedMode must be one of ${MINTED_MODES.join(', ')}`);
  const resolveHorizon = bindHorizon({
    promptBuiltAtMs: typeof promptBuiltAt === 'string' ? Date.parse(promptBuiltAt) : Number.NaN,
    mintedAtMs,
    battleExpiresAtMs: battleExpiryMs(battle),
  });
  const validation = validateDeclarations(raw, { universe, resolveHorizon, topLevelWatching });
  const removed = [...validation.removed];
  if (!validation.validated) {
    return deepFreeze({ record: null, calls: [], newOpen: [], removed, canonical: { record: null, calls: {} }, publicationBytes: 0 });
  }
  const heldSet = Array.isArray(held) ? held : null;

  const evidence = mintEvidence({ tickId, promptBuiltAt });
  const provenance = resolveProvenance(battle);
  const block = {
    calledShots: [...validation.validated.calledShots],
    watching: [...validation.validated.watching],
    playerAsk: validation.validated.playerAsk,
    fork: validation.validated.fork,
  };
  let specs = [...validation.calls];

  const compose = () => {
    const minted = [];
    const calls = specs.map((spec) => {
      const { call, reason } = composeCall(spec, {
        battleId, evalId, evalSeq, mintedAtMs, mintedMode, observation, evidence, provenance,
        held: heldSet, universe: Array.isArray(universe) ? universe : null, locked: Array.isArray(locked) ? locked : null,
      });
      minted.push({ callId: call.callId, n: spec.n, kind: spec.kind, state: call.state, reason });
      return call;
    });
    const record = {
      battleId,
      evalId,
      evalSeq,
      mintedAt: mintedAtMs,
      mintedMode,
      ...block,
      watchingSource: validation.watchingSource,
      ...removedRecordFields(removed),
      minted,
    };
    return { record, calls };
  };

  // THE PUBLICATION CAP (≤ 64 KB, record + every call). Past it, the LAST call
  // (the highest ordinal: the fork, else the last shot) is removed `oversize`
  // with its row, and the candidate is composed again. Unreachable within the
  // per-row caps and the 16 KB record cap — the rule is enforced regardless.
  let composed = compose();
  const totalBytes = (c) => jsonBytes(c.record) + c.calls.reduce((sum, call) => sum + jsonBytes(call), 0);
  while (specs.length > 0 && totalBytes(composed) > DECLARATION_CAPS.publicationBytes) {
    const dropped = specs[specs.length - 1];
    specs = specs.slice(0, -1);
    if (dropped.source === 'fork') block.fork = null;
    else block.calledShots = block.calledShots.filter((row) => row !== dropped.row);
    removed.push({ source: dropped.source, index: dropped.index, reason: 'oversize' });
    composed = compose();
  }

  const { record, calls } = composed;
  const hasContent = block.calledShots.length > 0 || block.watching.length > 0 || block.playerAsk !== null || block.fork !== null;
  if (!hasContent) {
    return deepFreeze({ record: null, calls: [], newOpen: [], removed: sortRemovedInSourceOrder(removed), canonical: { record: null, calls: {} }, publicationBytes: 0 });
  }
  const canonical = { record: canonicalRecord(record), calls: Object.fromEntries(calls.map((c) => [c.callId, canonicalCall(c)])) };
  return deepFreeze({
    record,
    calls,
    newOpen: calls.filter((c) => c.state === 'open'),
    removed: sortRemovedInSourceOrder(removed),
    canonical,
    publicationBytes: totalBytes(composed),
  });
}
