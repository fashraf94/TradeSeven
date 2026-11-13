// api/_utils/practiceField/ideaBook.js
//
// Practice Field T1a-1 — THE IDEA BOOK: its document, its epoch and its creation (shared contract V2 §3, §3.1;
// concept V6.1 §2; build prompt §2).
//
// HOME. `mandates/{bookId}` with `kind: 'idea_book'` — a product kind on the Mandate engine, beside the quarterly
// book. It reuses the engine's portfolio, health, cost-telemetry and exec-state blocks. The quarterly fields
// (`quarterIndex`, `quarterKey`, `nextRolloverAt`, `escapeHatchEligibleUntil`, `cadenceTier`, `vintageRef`) and the
// portfolio's quarter lens are ABSENT, not zero: no quarterly path can read a meaning into them.
//
// WHAT THE ENGINE'S FIELDS MEAN HERE.
//   portfolio.cash       ALL the book's cash: the treasury's unreserved cash plus every idea's own cash;
//   treasury             `{ unreservedCash }` — what no idea has reserved. Admission moves cash from here into an
//                        idea's ledger; portfolio.cash does not move until a fill;
//   portfolio.positions  every position carries the `ideaId` of the idea that owns it (B-OWNED);
//   slots                `{ short, medium, long }` → the occupying idea's id, or null;
//   openIdeaIds          the ideas that still hold reserved cash or shares — the set reconciled after every
//                        mutation (reconcile.js);
//   revision             the correctness backbone, as in the engine: every money mutation increments it.
//
// THE EPOCH (`mandates/{bookId}/epochs/{epochId}`, immutable) freezes the gate limits, the rails and the versions
// the book's ideas run under. An idea book resolves its config through `bookConfigSource` — a versioned
// discriminant on `kind` — and never reads `archetypeVintages`.
//
// CREATION claims the owner's ONE open idea book at `practiceFieldBooks/{uid}` and a place under the founder cap
// (B8) at `practiceFieldBooks/_registry`, in the transaction that writes the book. It never touches
// `userMeta.activeMandateId`, which stays the quarterly product's. No endpoint calls it yet (T1a-2 adds the
// founder endpoint).

import { createHash } from 'node:crypto';
import { getArchetypeDefinition, listArchetypeIds } from '../archetypeRegistry.js';
import { translateSectorCapSlots, isSectorCapCorrected, VINTAGE_UNCORRECTED } from '../mandateSectorCap.js';
import {
  buildPortfolioBlock, buildHealthBlock, buildCostTelemetryBlock, buildExecStateBlock,
} from '../mandateSchema.js';
import { markBook } from '../mandateValuation.js';
import { roundUsd } from '../mandateRounding.js';
import {
  MANDATE_SCHEMA_VERSION, MANDATE_MAX_POSITIONS, MANDATE_MAX_SINGLE_POSITION_WEIGHT_PCT,
  MANDATE_FRICTION_MODEL_VERSION,
} from '../mandateConfig.js';
import { IDEA_BOOK_KIND, isIdeaBook } from '../mandateBookKind.js';
import { isCasualCloneId } from '../../../src/constants/leagueTournament.js';
import {
  PRACTICE_FIELD_SLOTS, PRACTICE_FIELD_SLOTS_VERSION, PRACTICE_FIELD_SLOT_NAMES,
} from '../../../src/data/practiceFieldSlots.js';
import { PRACTICE_FIELD_FUNDS_VERSION, PRACTICE_FIELD_FUND_FRICTION_TIERS } from '../../../src/data/practiceFieldFunds.js';
import { PRACTICE_FIELD_SECTOR_BRIDGE_VERSION } from '../../../src/data/practiceFieldSectorBridge.js';
import {
  IDEA_BOOK_STARTING_CAPITAL_USD, PRACTICE_FIELD_CONTRACT_VERSION, IDEA_BOOK_CONFIG_VERSION, FIRST_EPOCH_ID,
  PRACTICE_FIELD_BOOK_REGISTRY_ID,
} from './constants.js';
import { practiceFieldAdmits } from './mode.js';
import { assertReconciled } from './reconcile.js';

const isInstant = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v)) && /T/.test(v);
const idOk = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;

/** The deterministic book id for (owner, operation): a replayed creation finds the book it already made. */
export function ideaBookIdFor(uid, opId) {
  const h = createHash('sha256').update(`${uid}::${opId}`, 'utf8').digest('hex').slice(0, 24);
  return `pf_${h}`;
}

/**
 * The gate limits an idea book's epoch freezes (build prompt §2): the archetype's sector cap through the SAME
 * corrected translation T0a added (stamped), the cash floor replaced by B2, the engine's single-position cap and
 * position cap kept. Archetype physics are read through the registry — never from a fenced table directly.
 */
export function buildIdeaBookGateConfig(archetypeCodeId) {
  if (!listArchetypeIds().includes(archetypeCodeId)) throw new Error(`buildIdeaBookGateConfig: unknown archetype '${archetypeCodeId}'`);
  const def = getArchetypeDefinition(archetypeCodeId);
  if (!def) throw new Error(`buildIdeaBookGateConfig: registry returned null for '${archetypeCodeId}'`);
  const sectorCap = translateSectorCapSlots(def.physics?.sectorConcentrationCap ?? null);
  return {
    gateConfig: {
      cashFloorPct: PRACTICE_FIELD_SLOTS.B2_CASH_FLOOR_SHARE,
      maxPositions: MANDATE_MAX_POSITIONS,
      maxSinglePositionWeightPct: MANDATE_MAX_SINGLE_POSITION_WEIGHT_PCT,
      sectorCapSlots: sectorCap.sectorCapSlots,
      sectorCapDenominator: sectorCap.sectorCapDenominator,
      sectorConcentrationCap: sectorCap.sectorConcentrationCap,
      sectorCapConversionVersion: sectorCap.sectorCapConversionVersion,
    },
    archetypeIdentityVersion: def.identityVersion,
  };
}

/** The epoch document: written once, never changed. `windows`, `settingsSnapshot` and `model` are T1b's. */
export function buildIdeaBookEpochDoc({ bookId, epochId, archetypeCodeId, openedAt }) {
  const { gateConfig, archetypeIdentityVersion } = buildIdeaBookGateConfig(archetypeCodeId);
  return {
    schemaVersion: MANDATE_SCHEMA_VERSION,
    epochId,
    bookId,
    configVersion: IDEA_BOOK_CONFIG_VERSION,
    contractVersion: PRACTICE_FIELD_CONTRACT_VERSION,
    archetypeCodeId,
    archetypeIdentityVersion,
    gateConfig,
    rails: {
      slotsVersion: PRACTICE_FIELD_SLOTS_VERSION,
      slotCapShare: { ...PRACTICE_FIELD_SLOTS.B1_SLOT_CAP_SHARE },
      namesPerIdea: { ...PRACTICE_FIELD_SLOTS.B3_NAMES_PER_IDEA },
      lineDistance: Object.fromEntries(Object.entries(PRACTICE_FIELD_SLOTS.B5_LINE_DISTANCE).map(([k, v]) => [k, { ...v }])),
    },
    frictionModelVersion: MANDATE_FRICTION_MODEL_VERSION,
    fundsVersion: PRACTICE_FIELD_FUNDS_VERSION,
    fundFrictionTiers: Object.fromEntries(Object.entries(PRACTICE_FIELD_FUND_FRICTION_TIERS).map(([k, v]) => [k, { ...v }])),
    sectorBridgeVersion: PRACTICE_FIELD_SECTOR_BRIDGE_VERSION,
    // Direction note ruling 13 replaced "two checks a day" with five windows. T1b writes the schedule version;
    // this build assumes no number of checks. The engine's `cadenceTier` is absent on an idea book.
    windows: null,
    settingsSnapshot: null,
    model: null,
    openedAt,
  };
}

/** The idea book document at creation. Reconciles by construction: all the cash is unreserved treasury. */
export function buildIdeaBookDoc({
  bookId, userId, attributionAgentId, archetypeCodeId, epochId, createdAt, createOpId,
  startingCapital = IDEA_BOOK_STARTING_CAPITAL_USD,
}) {
  if (!idOk(bookId) || !idOk(userId) || !idOk(attributionAgentId) || !idOk(archetypeCodeId) || !idOk(epochId)) {
    throw new Error('buildIdeaBookDoc: bookId, userId, attributionAgentId, archetypeCodeId and epochId are required');
  }
  const { archetypeIdentityVersion } = buildIdeaBookGateConfig(archetypeCodeId);
  // The engine's portfolio block, without its quarter lens (absent, not zero).
  // eslint-disable-next-line no-unused-vars
  const { quarterHighWaterMark, quarterDrawdownFromPeak, ...portfolio } = buildPortfolioBlock(startingCapital);
  return {
    schemaVersion: MANDATE_SCHEMA_VERSION,
    kind: IDEA_BOOK_KIND,
    bookId,
    userId,
    status: 'active',
    revision: 0,
    // Identity, written once.
    attributionAgentId,
    archetypeCodeId,
    archetypeIdentityVersion,
    contractVersion: PRACTICE_FIELD_CONTRACT_VERSION,
    configVersion: IDEA_BOOK_CONFIG_VERSION,
    slotsVersion: PRACTICE_FIELD_SLOTS_VERSION,
    fundsVersion: PRACTICE_FIELD_FUNDS_VERSION,
    sectorBridgeVersion: PRACTICE_FIELD_SECTOR_BRIDGE_VERSION,
    createdAt,
    createOpId: createOpId ?? null,
    currentEpochId: epochId,
    // Account-level controls (contract §3.2). Nothing in this build changes them.
    drafting: 'on',
    windDown: null,
    // The idea book's own accounting.
    treasury: { unreservedCash: roundUsd(startingCapital) },
    slots: Object.fromEntries(PRACTICE_FIELD_SLOT_NAMES.map((s) => [s, null])),
    openIdeaIds: [],
    portfolio,
    health: buildHealthBlock(),
    costTelemetry: buildCostTelemetryBlock(),
    execState: buildExecStateBlock(),
  };
}

/**
 * Where a book's frozen config lives — the versioned discriminant on `kind` (contract §3; Astra V5 B2). An idea
 * book answers its own epoch document; a quarterly book answers its pinned vintage, as today.
 */
export function bookConfigSource(bookId, book) {
  if (isIdeaBook(book)) {
    return { kind: IDEA_BOOK_KIND, configVersion: book.configVersion ?? null, path: `mandates/${bookId}/epochs/${book.currentEpochId}` };
  }
  return { kind: 'quarterly', configVersion: null, path: book?.vintageRef ?? null };
}

/** The epoch reference of an idea book. */
export function epochRefOf(bookRef, book) {
  return bookRef.collection('epochs').doc(book.currentEpochId);
}

/**
 * The book's RECORDED marked equity: its cash plus every position at the mark last written onto it (the last close
 * or the fill that opened it). Deterministic from the book document alone, so admission needs no snapshot and the
 * exposure it sums and the equity it divides by always share one basis.
 */
export function recordedEquityUsd(book) {
  return roundUsd(markBook(book?.portfolio?.positions || {}, book?.portfolio?.cash || 0, null).totalValue);
}

/**
 * Create the owner's idea book. Server-only; idempotent on `opId`.
 *
 * @returns {Promise<
 *   | { ok: true, bookId: string, epochId: string, idempotentReplay: boolean }
 *   | { ok: false, code: 'mode_not_admitted' | 'unknown_archetype' | 'attribution_is_clone' | 'open_book_exists'
 *                        | 'founder_cap_reached' | 'op_id_conflict' | 'vintage_uncorrected', bookId?: string }
 * >}
 */
export async function createIdeaBook(db, { uid, attributionAgentId, archetypeCodeId, opId, nowIso } = {}) {
  if (!db) throw new Error('createIdeaBook: db required');
  if (!idOk(uid) || !idOk(attributionAgentId) || !idOk(opId)) throw new Error('createIdeaBook: uid, attributionAgentId and opId are required');
  if (!isInstant(nowIso)) throw new Error('createIdeaBook: nowIso must be an ISO instant');

  // The mode, before any read.
  if (!practiceFieldAdmits(uid)) return { ok: false, code: 'mode_not_admitted' };
  if (typeof archetypeCodeId !== 'string' || !listArchetypeIds().includes(archetypeCodeId)) return { ok: false, code: 'unknown_archetype' };
  // The book belongs to the RANKED record; nothing is ever filed under a casual clone.
  if (isCasualCloneId(attributionAgentId)) return { ok: false, code: 'attribution_is_clone' };

  const bookId = ideaBookIdFor(uid, opId);
  const epochId = FIRST_EPOCH_ID;
  const createdAt = new Date(nowIso);
  const epochDoc = buildIdeaBookEpochDoc({ bookId, epochId, archetypeCodeId, openedAt: nowIso });
  if (!isSectorCapCorrected(epochDoc.gateConfig)) return { ok: false, code: VINTAGE_UNCORRECTED };
  const bookDoc = buildIdeaBookDoc({ bookId, userId: uid, attributionAgentId, archetypeCodeId, epochId, createdAt, createOpId: opId });
  assertReconciled(bookDoc, []);

  const bookRef = db.collection('mandates').doc(bookId);
  const epochRef = bookRef.collection('epochs').doc(epochId);
  const claimRef = db.collection('practiceFieldBooks').doc(uid);
  const registryRef = db.collection('practiceFieldBooks').doc(PRACTICE_FIELD_BOOK_REGISTRY_ID);
  const cap = PRACTICE_FIELD_SLOTS.B8_FOUNDER_BOOK_CAP;

  return db.runTransaction(async (tx) => {
    const claimSnap = await tx.get(claimRef);
    const registrySnap = await tx.get(registryRef);
    const bookSnap = await tx.get(bookRef);

    const claim = claimSnap.exists ? claimSnap.data() : null;
    if (claim && typeof claim.bookId === 'string' && claim.bookId.length > 0) {
      // A replay of THIS creation returns the book it already made; anything else meets the one-open-book rule.
      if (claim.createOpId === opId && claim.bookId === bookId) return { ok: true, bookId, epochId: claim.epochId ?? epochId, idempotentReplay: true };
      return { ok: false, code: 'open_book_exists', bookId: claim.bookId };
    }
    // The same owner and operation once made a book that has since closed: never a second book under one id.
    if (bookSnap.exists) return { ok: false, code: 'op_id_conflict', bookId };

    const registry = registrySnap.exists ? registrySnap.data() : {};
    const openBooks = { ...(registry.openBooks || {}) };
    const openCount = Object.keys(openBooks).length;
    if (openCount >= cap) return { ok: false, code: 'founder_cap_reached', openBooks: openCount, cap };

    openBooks[bookId] = uid;
    tx.set(bookRef, bookDoc);
    tx.set(epochRef, epochDoc);
    tx.set(claimRef, {
      bookId, epochId, attributionAgentId, archetypeCodeId, status: 'active', createOpId: opId, createdAt: nowIso, updatedAt: nowIso,
    });
    tx.set(registryRef, { openBooks, cap, updatedAt: nowIso });
    return { ok: true, bookId, epochId, idempotentReplay: false };
  });
}
