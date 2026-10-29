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
// Cockpit Build 2b — THE MINT FIELDS (contract Amendment D; spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md S-3), from merge, at 'shadow' and 'on':
//   counterpart (D-7)   ONE test with the filing: an EXIT keeps its
//                       replacement only when swappable.js canComeIn passes
//                       it at the seam — the book and the swap's lists frozen
//                       at promptBuiltAt (`book`, observe.js), the lock read
//                       at promptBuiltAt — so a watchlist-only or cross-class
//                       name is nulled; an ENTRY keeps its counterpart only
//                       when it is held in the call's OWN slot tier (the
//                       filing's counterpart_not_held test). Otherwise null,
//                       with counterpartRaw as C-3.
//   replacementOptions  (D-3) on every newly minted shot or Confirmation whose
//                       direction is 'exit', whose counterpart is null after
//                       D-7 and which is not born invalidated: up to four
//                       names that pass canComeIn AND have a usable price in
//                       this check's own observation (rev 2 — the options
//                       only; D-7 and filing do not read it): the agent's own
//                       names first ('agent': its anticipation candidates in
//                       stamp order, then its kept watch list, no repeats),
//                       then the rest by the platform's technicalRank
//                       ('bench': ascending; unranked last, roster order).
//                       [] when it qualifies and no name passes; null on every
//                       other call.
//   invalidatedReason   (D-9) the mint's own reason for a call born
//                       invalidated (the value minted[] already records), else
//                       null.
// Both new fields are immutable: they are outside MUTABLE_CALL_FIELDS, so the
// canonical form publication compares carries them.
//
// Cockpit exit-not-held (contract Amendment E rev 2, E-1): an EXIT call (a called
// shot or a Confirmation) whose symbol is not held in ANY tier of the frozen seam
// book is born `invalidated`, `invalidatedReason: 'exit_not_held'` (answers.js
// isExitNotHeld — the one any-tier test the endpoint and the cockpit also ask).
// A reason that already invalidates at mint (the price line) wins: exit_not_held
// applies only to a call that would otherwise mint valid. An unknown seam (no
// frozen book) proves nothing, so it invalidates nothing.
//
// Pure: no I/O, no clock (the mint instant is handed in).

import { validateDeclarations, invalidationReason, sortRemovedInSourceOrder, removedRecordFields, DECLARATION_CAPS, jsonBytes } from './validate.js';
import { bindHorizon, battleExpiryMs } from './horizon.js';
import { saidPassesLint } from './copy.js';
import { isExitNotHeld } from './answers.js';
import { canComeIn, swappableNames, forkUsableFor } from './swappable.js';
import { composeCandidatesStamp } from '../tickStamps.js';

/** The modes a record can be minted under (Amendment C-5). */
export const MINTED_MODES = Object.freeze(['shadow', 'on']);

/** Amendment E (E-1): the mint's reason for an exit call on a stock held in no tier of the seam's book. */
export const EXIT_NOT_HELD_REASON = 'exit_not_held';

/** counterpartRaw's cap, in Unicode code points (Amendment C-3). */
export const COUNTERPART_RAW_MAX = 40;

/** The fields a canonical form leaves out — the mutable state of a call. */
export const MUTABLE_CALL_FIELDS = Object.freeze(['state', 'stateChangedAt', 'stateSource', 'playerResponse', 'outcome', 'refused']);

/**
 * Provenance reasons (contract §4 `provenance_unresolved`): each names a
 * watchlist snapshot that is PRESENT but unusable (founder ruling A-1 — an
 * absent snapshot is agent_initiative, never unresolved). Pilot P1a adds
 * `hypothesis_snapshot_mismatch`: a frozen `equippedHypothesis` sibling whose
 * `watchlistId` is not the frozen snapshot's (pilot spec §2.6; Phase 0 Q4).
 * `snapshot_corrupt` also covers a MALFORMED sibling beside a valid snapshot —
 * the frozen hypothesis is part of the frozen equipped provenance (spec §2.4),
 * as the snapshot's own version key was before P1a; the contract has no
 * separate reason for it, and none is invented here (review L1-8).
 */
export const PROVENANCE_REASONS = Object.freeze(['snapshot_corrupt', 'config_hash_missing', 'hypothesis_snapshot_mismatch']);

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
 *   valid snapshot + a validated sibling version → versioned { watchlistId, hypothesisVersion }, equipped
 *   valid snapshot + a sibling for ANOTHER list  → null, provenance_unresolved ('hypothesis_snapshot_mismatch')
 *   valid snapshot + hash (no sibling)           → legacy { watchlistId, equippedConfigHash }, equipped
 *   valid snapshot, no hash, no sibling          → null, provenance_unresolved ('config_hash_missing')
 *   a corrupt snapshot (or a corrupt sibling)    → null, provenance_unresolved ('snapshot_corrupt')
 *   NO snapshot (absent or null)                 → null, agent_initiative — whatever the config hash says
 *
 * Ruling A-1: the manifest's equippedConfigHash exists on every battle created
 * with the manifest write on — it hashes `equippedWatchlist: null` as well — so
 * a hash is no evidence of an equipped watchlist. `provenance_unresolved` is
 * reserved for a snapshot that is PRESENT but unusable (review A-1: the
 * contract's "hash without watchlist" case made agent_initiative unreachable).
 *
 * The VERSIONED branch (pilot P1a; spec §2.4, §2.6; Phase 0 Q4) reads the
 * frozen SIBLING `agentContext.equippedHypothesis.{hypothesisVersion,
 * watchlistId}` — never the hashed snapshot, which P1b leaves byte-for-byte
 * as it is (spec §2.4). The sibling must name the SAME list as the snapshot.
 * No producer writes the sibling until P1b, so on every battle today the
 * sibling is absent and the legacy and H1 branches run exactly as before; a
 * `hypothesisVersion` key inside the snapshot is not a version source.
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
  const sibling = battle?.agentContext?.equippedHypothesis;
  if (sibling !== undefined && sibling !== null) {
    const version = isPlainObject(sibling) ? sibling.hypothesisVersion : undefined;
    if (!isPlainObject(sibling) || !nonEmptyString(sibling.watchlistId) || !(Number.isInteger(version) && version > 0)) {
      return { hypothesisRef: null, origin: 'provenance_unresolved', provenanceReason: 'snapshot_corrupt' };
    }
    if (sibling.watchlistId !== snapshot.watchlistId) {
      return { hypothesisRef: null, origin: 'provenance_unresolved', provenanceReason: 'hypothesis_snapshot_mismatch' };
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
 * Is a shot's counterpart USABLE at the seam? Exact membership, the seam's
 * own spelling. Amendment D-7 (Cockpit Build 2b) — one test with the filing,
 * replacing C-3's two rules:
 *   exit  — the replacement can come in: swappable.js canComeIn against the
 *           seam's frozen book (`book`) at the seam's instant (`atMs`, the
 *           check's promptBuiltAt) — on the swap's lists, not held, not
 *           locked, not the call's own symbol, the same asset class;
 *   entry — the position the entry would replace: held IN THE CALL'S OWN
 *           SLOT TIER (the filing's counterpart_not_held test), not the own
 *           symbol.
 * An unknown seam (no frozen book) proves nothing usable.
 *
 * @param {{ symbol: string, direction: string, slot: string, counterpart?: string }} row
 * @param {{ book: object|null, atMs: number }} seam
 */
export function counterpartUsable(row, { book, atMs }) {
  const cp = row?.counterpart;
  if (typeof cp !== 'string' || cp.length === 0) return false;
  if (!book || typeof book !== 'object') return false;
  if (cp === row.symbol) return false;
  if (row.direction === 'exit') return canComeIn({ battle: book, out: row.symbol, slot: row.slot, inSymbol: cp, atMs }).ok;
  if (row.direction === 'entry') {
    const tier = book.portfolio?.[row.slot];
    return Array.isArray(tier) && tier.some((r) => r?.symbol === cp);
  }
  return false;
}

/** The replacement options' cap (D-3). */
export const REPLACEMENT_OPTIONS_MAX = 4;

/**
 * THE REPLACEMENT OPTIONS (Amendment D-3) for one qualifying exit, at the
 * model seam: the names that pass canComeIn for OUT in the call's slot at
 * `atMs` AND that this check's own observation admits (a settlement-usable
 * quote fetched at or before the instant — observe.js buildObservation), at
 * most four:
 *   'agent'  the agent's own names, in order, without repeats — its
 *            anticipation candidates (stamp order), then its kept watch list;
 *   'bench'  the remaining passing names by `technicalRank` ascending, the
 *            unranked after them in roster order.
 * `rank` is the name's technicalRank at that check, or null. `[]` when no
 * name passes.
 *
 * @param {{ symbol: string, slot: string }} row
 * @param {{ book: object|null, atMs: number, observation: object|null, candidates: string[], watching: string[], rankOf: (s: string) => number|null }} seam
 */
export function replacementOptionsFor(row, { book, atMs, observation, candidates, watching, rankOf }) {
  if (!book || typeof book !== 'object') return [];
  const priced = (sym) => Boolean(observation?.symbols && Object.prototype.hasOwnProperty.call(observation.symbols, sym) && observation.symbols[sym]);
  const passing = swappableNames({ battle: book, out: row.symbol, slot: row.slot, atMs }).filter(priced);
  const pass = new Set(passing);
  const out = [];
  const taken = new Set();
  const take = (symbol, source) => {
    if (out.length >= REPLACEMENT_OPTIONS_MAX || taken.has(symbol) || !pass.has(symbol)) return;
    taken.add(symbol);
    const rank = rankOf(symbol);
    out.push({ symbol, source, rank: Number.isInteger(rank) ? rank : null });
  };
  for (const s of [...candidates, ...watching]) take(s, 'agent');
  const rest = passing.filter((s) => !taken.has(s)).map((s, i) => ({ s, i, rank: rankOf(s) }));
  rest.sort((a, b) => {
    const ar = Number.isInteger(a.rank) ? a.rank : null;
    const br = Number.isInteger(b.rank) ? b.rank : null;
    if (ar !== null && br !== null) return ar - br || a.i - b.i;
    if (ar !== null) return -1;
    if (br !== null) return 1;
    return a.i - b.i;
  });
  for (const { s } of rest) take(s, 'bench');
  return out;
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

function composeCall(spec, { battleId, evalId, evalSeq, mintedAtMs, mintedMode, observation, evidence, provenance, held, seam }) {
  const { n, kind, row, horizon } = spec;
  const isPick = kind === 'pick';
  // The price line is judged first (D-9's three reasons); Amendment E's exit_not_held only for a call that would otherwise mint valid.
  const reason = isPick
    ? null
    : (invalidationReason(row, observation) ?? (isExitNotHeld({ kind, direction: row.direction, symbol: row.symbol }, seam.book) ? EXIT_NOT_HELD_REASON : null));
  const hasCounterpart = !isPick && typeof row.counterpart === 'string' && row.counterpart.length > 0;
  // D-7: the filing's own test, at the seam.
  const usable = hasCounterpart && counterpartUsable(row, { book: seam.book, atMs: seam.atMs });
  // D-3: an exit with no usable replacement, not born invalidated, carries its options.
  const qualifies = !isPick && row.direction === 'exit' && !usable && !reason;
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
    // Cockpit Build 2b (D-3): who could come in, as the seam saw it; null on every non-qualifying call.
    replacementOptions: qualifies ? replacementOptionsFor(row, { ...seam, observation }) : null,
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
    // Cockpit Build 2b (D-9): why a call was born invalidated — the mint's own reason (minted[] below), else null.
    invalidatedReason: reason ?? null,
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
 * @param {string[]|null} p.held   Amendment C-2: the held set frozen at the model seam —
 *   REQUIRED; `null` is the explicit "unknown" (heldAtMint false)
 * @param {'shadow'|'on'} p.mintedMode Amendment C-5: the check's resolved mode — REQUIRED
 * @param {object|null} p.book     Amendment D-7 / D-3: the book and the swap's lists frozen at the
 *   model seam (swappable.js freezeSwapBook, observe.js) — REQUIRED; `null` is the explicit
 *   "unknown" (no counterpart usable; a qualifying exit's options are `[]`)
 * @param {Array|null} p.anticipationCandidates D-3: the check's LINTED anticipation candidates (the
 *   list its `candidates` stamp is composed from) — REQUIRED; `null` = none
 * @param {Record<string, number|null>|null} p.rankMap D-3: `{ symbol: technicalRank }` from the
 *   rankings the check's prompt rendered — REQUIRED; `null` = every name unranked
 */
export function buildMintCandidate({ battleId, evalId, evalSeq, mintedAtMs, raw, universe, observation, promptBuiltAt, tickId, battle, topLevelWatching, held, mintedMode, book, anticipationCandidates, rankMap }) {
  // No silent default for a load-bearing seam fact: omission is a defect, and
  // opting out (null) is an explicit act.
  if (held === undefined) throw new Error('buildMintCandidate: `held` is required (null when the seam knows no held set)');
  if (!MINTED_MODES.includes(mintedMode)) throw new Error(`buildMintCandidate: mintedMode must be one of ${MINTED_MODES.join(', ')}`);
  if (book === undefined) throw new Error('buildMintCandidate: `book` is required (null when the seam froze no book)');
  if (anticipationCandidates === undefined) throw new Error('buildMintCandidate: `anticipationCandidates` is required (null when the check has none)');
  if (rankMap === undefined) throw new Error('buildMintCandidate: `rankMap` is required (null when the check rendered no rankings)');
  const resolveHorizon = bindHorizon({
    promptBuiltAtMs: typeof promptBuiltAt === 'string' ? Date.parse(promptBuiltAt) : Number.NaN,
    mintedAtMs,
    battleExpiresAtMs: battleExpiryMs(battle),
  });
  // BaggerBomb cleanup C3: a fork option must pass the same canComeIn test as an exit's replacement, on the
  // seam's frozen book at the check's own instant — the SAME test (swappable.js forkUsableFor) the pre-commit
  // capture used, so an entry stamped "expected" never promises a record this mint removes (review CL2-1).
  const validation = validateDeclarations(raw, { universe, resolveHorizon, topLevelWatching, forkUsable: forkUsableFor({ book, promptBuiltAt }) });
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

  // D-7 / D-3: one seam for the counterpart test and the options — the frozen book at the check's
  // own instant, the agent's two lists in order, the platform's rank.
  const seam = Object.freeze({
    book: book && typeof book === 'object' ? book : null,
    atMs: typeof promptBuiltAt === 'string' ? Date.parse(promptBuiltAt) : Number.NaN,
    candidates: (composeCandidatesStamp(anticipationCandidates) || []).map((c) => c.symbol),
    watching: [...block.watching],
    rankOf: (symbol) => (rankMap && typeof rankMap === 'object' && Object.prototype.hasOwnProperty.call(rankMap, symbol) ? rankMap[symbol] : null),
  });

  const compose = () => {
    const minted = [];
    const calls = specs.map((spec) => {
      const { call, reason } = composeCall(spec, {
        battleId, evalId, evalSeq, mintedAtMs, mintedMode, observation, evidence, provenance,
        held: heldSet, seam,
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
