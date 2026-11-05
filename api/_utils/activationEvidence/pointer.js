// api/_utils/activationEvidence/pointer.js
//
// ID-1 Build 2 — ONE ACTIVATION POINTER (contract §4, §4.5). Exactly the
// contract's fields, in its representations:
//   - `entry` is a deep, frozen copy of the snapshot's entry record (a refused
//     snapshot's refusal record included) and `missing` is null; or `entry` is
//     null and `missing` is `{ reason: 'snapshot_unavailable', detail }`, the
//     store's retryable reason in the writing run;
//   - `evidenceTiming.predatesActivation` is `capturedAt < activatedAt`,
//     strictly (equal instants are false); both members null without an entry;
//   - `anchorSwingLow` is the entry record's own swing low when it is a price,
//     frozen, else `{ value: null, provenance: 'absent' }`;
//   - `hypothesisRef` from agentContext.equippedHypothesis and `inIdeaUniverse`
//     from the battle's FROZEN watchlist tickers (P1c's frozenNamesOf), both
//     null when the battle carries no equippedHypothesis, even with a watchlist;
//   - `stream.gameMode` is the battle's field, or null when it has none (never
//     normalised); `clone` is 'casual' for a casual-clone battle, else 'ranked'.
//
// Pure. `frozenNamesOf` is imported from the review module that defines it
// (hypothesisRecords/review.js), so the idea universe is read one way.

import { isCasualCloneId } from '../../../src/constants/leagueTournament.js';
import { frozenNamesOf } from '../hypothesisRecords/review.js';
import { POINTER_SCHEMA_VERSION, SNAPSHOT_SCHEMA_VERSION } from './constants.js';
import { instantMsOf } from './lifetimes.js';

const isPrice = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A deep, frozen copy (plain data only: what a Firestore document holds). */
export function deepFrozenCopy(value) {
  const copy = structuredClone(value);
  const freeze = (v) => {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) {
      Object.freeze(v);
      for (const k of Object.keys(v)) freeze(v[k]);
    }
    return v;
  };
  return freeze(copy);
}

const sameRuleSet = (a, b) => isPlainObject(a) && isPlainObject(b)
  && Object.keys(a).length === 3 && Object.keys(b).length === 3
  && a.setupVersion === b.setupVersion && a.thresholdsHash === b.thresholdsHash && a.semanticsId === b.semanticsId;

/**
 * Is `snapshot` the store's final document for this key? Its schemaVersion is the
 * one this observer knows, and its key names this session, symbol and rule set.
 */
export function snapshotServes(snapshot, { session, symbol, ruleSet }) {
  return isPlainObject(snapshot) && snapshot.schemaVersion === SNAPSHOT_SCHEMA_VERSION
    && isPlainObject(snapshot.key) && snapshot.key.session === session && snapshot.key.symbol === symbol
    && sameRuleSet(snapshot.key.ruleSet, ruleSet) && isPlainObject(snapshot.entry);
}

/** The idea fields (contract §4): both null without an equippedHypothesis. */
function ideaOf(battle, symbol) {
  const h = battle?.agentContext?.equippedHypothesis;
  if (!isPlainObject(h)) return { hypothesisRef: null, inIdeaUniverse: null };
  return {
    hypothesisRef: { watchlistId: h.watchlistId ?? null, hypothesisVersion: h.hypothesisVersion ?? null, contentHash: h.contentHash ?? null },
    inIdeaUniverse: frozenNamesOf(battle).includes(String(symbol).toUpperCase()),
  };
}

/**
 * @param {object} p
 * @param {object} p.battle the battle document's data
 * @param {string} p.battleId
 * @param {object} p.activation from discover.js (with `activatingTick` set for a swap-in)
 * @param {string} p.session the activation's completed session (lastCompletedSessionAt)
 * @param {{ attributionAgentId: string, attributionStatus: 'resolved'|'unresolved' }} p.attribution
 * @param {object} p.ruleSet describeRuleSet() as deployed
 * @param {{ snapshotId: string, snapshot: object } | null} p.evidence the final snapshot, or null
 * @param {string|null} p.missingDetail the store's retryable reason in this run, when `evidence` is null
 * @param {string} p.observedAt ISO, the write
 */
export function buildPointer({ battle, battleId, activation, session, attribution, ruleSet, evidence, missingDetail = null, observedAt }) {
  const swapIn = activation.kind === 'swap_in';
  const entry = evidence ? deepFrozenCopy(evidence.snapshot.entry) : null;
  const capturedMs = evidence ? instantMsOf(evidence.snapshot.capturedAt) : null;
  const swingLow = entry?.factsUsed?.swingLow?.value;
  const days = battle?.timing?.tradingDays;
  return {
    schemaVersion: POINTER_SCHEMA_VERSION,
    activationId: activation.activationId,
    kind: activation.kind,
    battleId,
    symbol: activation.symbol,
    tier: activation.tier,
    slot: activation.slot,
    battleAgentId: battle.agentId ?? null,
    attributionAgentId: attribution.attributionAgentId,
    attributionStatus: attribution.attributionStatus,
    archetype: battle.agentContext?.archetype ?? null,
    stream: {
      attributionAgentId: attribution.attributionAgentId,
      clone: isCasualCloneId(battle.agentId) ? 'casual' : 'ranked',
      gameMode: battle.gameMode ?? null,
    },
    activatedAt: activation.activatedAt,
    activatedAtSource: activation.activatedAtSource,
    asOf: session,
    firstTradingDay: Array.isArray(days) && typeof days[0] === 'string' ? days[0] : null,
    ruleSet: { setupVersion: ruleSet.setupVersion, thresholdsHash: ruleSet.thresholdsHash, semanticsId: ruleSet.semanticsId },
    snapshotRef: evidence ? evidence.snapshotId : null,
    entry,
    missing: evidence ? null : { reason: 'snapshot_unavailable', detail: typeof missingDetail === 'string' ? missingDetail : null },
    evidenceTiming: evidence
      ? {
        snapshotCapturedAt: typeof evidence.snapshot.capturedAt === 'string' ? evidence.snapshot.capturedAt : null,
        predatesActivation: capturedMs === null ? null : capturedMs < activation.activatedAtMs,
      }
      : { snapshotCapturedAt: null, predatesActivation: null },
    anchorSwingLow: isPrice(swingLow) ? { value: swingLow, provenance: 'own_entry' } : { value: null, provenance: 'absent' },
    activatingTick: swapIn ? { ...activation.activatingTick } : null,
    tradeRef: swapIn
      ? { evaluationId: activation.row?.evaluationId ?? null, verificationId: activation.row?.verificationId ?? null, incomingPositionId: activation.row?.incomingPositionId ?? null }
      : null,
    ...ideaOf(battle, activation.symbol),
    observedAt,
  };
}
