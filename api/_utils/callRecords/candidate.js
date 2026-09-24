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
// Pure: no I/O, no clock (the mint instant is handed in).

import { validateDeclarations, invalidationReason, sortRemovedInSourceOrder, removedRecordFields, DECLARATION_CAPS, jsonBytes } from './validate.js';
import { bindHorizon, battleExpiryMs } from './horizon.js';

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

function composeCall(spec, { battleId, evalId, evalSeq, mintedAtMs, observation, evidence, provenance }) {
  const { n, kind, row, horizon } = spec;
  const isPick = kind === 'pick';
  const reason = isPick ? null : invalidationReason(row, observation);
  const call = {
    callId: callIdOf(battleId, evalId, n),
    kind,
    battleId,
    evalId,
    evalSeq,
    mintedAt: mintedAtMs,
    symbol: isPick ? null : row.symbol,
    direction: isPick ? null : row.direction,
    slot: row.slot,
    counterpart: isPick ? null : (row.counterpart ?? null),
    ...(isPick ? { swapOut: row.swapOut, options: row.options.map((o) => ({ symbol: o.symbol, why: o.why })) } : {}),
    condition: isPick ? null : { side: row.condition.side, level: row.condition.level },
    horizon: { phrase: isPick ? 'next_check' : row.horizonPhrase, expiresAt: horizon.expiresAtMs, basis: horizon.basis },
    defaultAction: isPick ? null : row.defaultAction,
    said: row.said,
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
 */
export function buildMintCandidate({ battleId, evalId, evalSeq, mintedAtMs, raw, universe, observation, promptBuiltAt, tickId, battle }) {
  const resolveHorizon = bindHorizon({
    promptBuiltAtMs: typeof promptBuiltAt === 'string' ? Date.parse(promptBuiltAt) : Number.NaN,
    mintedAtMs,
    battleExpiresAtMs: battleExpiryMs(battle),
  });
  const validation = validateDeclarations(raw, { universe, resolveHorizon });
  const removed = [...validation.removed];
  if (!validation.validated) {
    return deepFreeze({ record: null, calls: [], newOpen: [], removed, canonical: { record: null, calls: {} }, publicationBytes: 0 });
  }

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
      const { call, reason } = composeCall(spec, { battleId, evalId, evalSeq, mintedAtMs, observation, evidence, provenance });
      minted.push({ callId: call.callId, n: spec.n, kind: spec.kind, state: call.state, reason });
      return call;
    });
    const record = {
      battleId,
      evalId,
      evalSeq,
      mintedAt: mintedAtMs,
      ...block,
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
