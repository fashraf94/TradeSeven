// api/_utils/practiceField/admission.js
//
// Practice Field T1a-1 — ADMISSION: the one deterministic validator between a draft and the book's money (shared
// contract V2 §5.4; concept V6.1 §5 "the agent drafts; code admits"; build prompt §4; acceptance cases B-SAME,
// B-RESERVE, B-ORIGIN, B-COVER). T1d's drafting call will call `admitIdea`; nothing else may reserve capital.
//
// THE CHECKS (every failure returned together, each a typed `{ code, … }`):
//   0, 0b, 3–5  the contract's own shape — contract.js;
//   1  the mode admits the owner; the book is active and its drafting is not paused;
//   2  the slot is open (one idea per slot per book);
//   3  no name is held or pending in another idea of the book (`ticker_held_by_other_idea`);
//   6  the start session and the due session are both on the maintained calendar (`calendar_unsupported`);
//   7  capital, on the book's recorded marked equity: the slot cap (B1), the cash floor (B2) on what the treasury
//      keeps unreserved, and — for each name's planned dollars — the single-position cap, the sector cap (the
//      archetype's, translated; sectors through the one bridge; other ideas' PENDING plans count beside what is
//      held) and the position count (positions + pending names ≤ 15). The answer always carries the PERMITTED
//      MAXIMUM and every constraint that binds it;
//   8  coverage: every name, the comparison's symbols and SPY fit the reserved universe (`coverage_unavailable`).
//
// ONE TRANSACTION, ONE CODE PATH. The whole evaluation runs inside the transaction, on the book, the epoch, every
// open idea and the coverage document as the transaction read them — a superset of "re-read and recheck 2, 3 and
// 7". Two admissions racing for the same cash both read the book; the second to commit is retried against the
// first's state and refused with its reason (B-RESERVE). On success the same transaction writes the idea
// (`accepted`, contract frozen), moves the capital from the treasury into the idea's ledger (revision + 1) and
// reserves coverage; the book is reconciled before it is written.
//
// Limits are compared in whole cents with exact integer arithmetic (money.js): no tolerance, so the designed
// boundary — three full slots leaving exactly the 10% floor — is decided by arithmetic, not representation.
//
// IDEMPOTENT ON `opId`: the idea's id is derived from (book, opId). A replay with the same contract returns the
// idea it already made; the same opId with a different contract is `op_id_conflict`.

import { createHash } from 'node:crypto';
import { canonicalContentHash } from '../canonicalHash.js';
import { isSectorCapCorrected, VINTAGE_UNCORRECTED } from '../mandateSectorCap.js';
import { isIdeaBook } from '../mandateBookKind.js';
import { PRACTICE_FIELD_SLOTS, PRACTICE_FIELD_SLOTS_VERSION } from '../../../src/data/practiceFieldSlots.js';
import { PRACTICE_FIELD_FUNDS_VERSION, PRACTICE_FIELD_BENCHMARK_SYMBOL } from '../../../src/data/practiceFieldFunds.js';
import {
  IDEA_SCHEMA_VERSION, IDEA_STATUS, CANCEL_REASON, RISK_ASSUMPTION, PRACTICE_FIELD_CONTRACT_VERSION,
} from './constants.js';
import { practiceFieldLive, practiceFieldAdmits } from './mode.js';
import { normalizeIdeaContract, weightOf, planLegCents } from './contract.js';
import { mandateSectorOf } from './symbols.js';
import { ideaSchedule } from './windows.js';
import { newLedger, LEDGER_KIND } from './ledger.js';
import { epochRefOf } from './ideaBook.js';
import {
  coverageRefOf, coverageRef, ideaCoveragePlan, coverageFits, coverageWithRef, coverageWithoutRef,
} from './coverage.js';
import { assertReconciled } from './reconcile.js';
import {
  toCents, fromCents, shareLimitCents, shareCeilCents, ratioLimitCents, floorMulDiv,
} from './money.js';

const isInstant = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v)) && /T/.test(v);
const idOk = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;

/**
 * What a request's fingerprint covers: what the draft SAID — never a constant this code derives from it (the
 * comparison's fixed phrase, the slot's length), so a copy edit between a call and its retry is not a conflict.
 */
function contractFingerprintInput(contract) {
  return {
    thesis: contract.thesis, slot: contract.slot, names: contract.names, weights: contract.weights,
    comparison: { type: contract.comparison.type, symbols: contract.comparison.symbols },
    lines: contract.lines, capitalUsd: contract.capitalUsd, origin: contract.origin, sources: contract.sources,
  };
}

/** The fingerprint an admission request is replayed against: the book and what the (normalised) draft said. */
export function admissionFingerprint({ bookId, contract, rawContract = null }) {
  return canonicalContentHash({ bookId, contract: contract ? contractFingerprintInput(contract) : (rawContract ?? null) });
}

/** The deterministic idea id for (book, operation). */
export function ideaIdFor(bookId, opId) {
  return `idea_${createHash('sha256').update(`${bookId}::${opId}`, 'utf8').digest('hex').slice(0, 24)}`;
}

/** A limit as the caller sees it: its dollars (never negative), without the internal cents and refusal code. */
function publicLimit(limit) {
  const out = { ...limit, limitUsd: fromCents(Math.max(0, limit.limitCents)) };
  delete out.limitCents;
  delete out.code;
  return out;
}

/** The names another idea of the book holds or has pending: symbol → ideaId. */
function namesTakenBy(ideas) {
  const taken = new Map();
  for (const idea of ideas) {
    for (const sym of idea.contract?.names || []) taken.set(sym, idea.ideaId);
    for (const sym of Object.keys(idea.ledger?.holdings || {})) taken.set(sym, idea.ideaId);
  }
  return taken;
}

/**
 * The book-state half of admission (checks 1, 2, 3, 6, 7, 8). Pure: everything it needs is handed in as the
 * transaction read it.
 *
 * @returns {{ refusals: Array<object>, permittedMaxUsd: number|null, binding: Array<object>, limits: Array<object>,
 *             schedule: object|null, coveragePlan: object|null }}
 */
export function evaluateAdmission({ book, epoch, ideas, coverageData, contract, ideaRefKey, nowIso, admitsOwner }) {
  const refusals = [];
  const refuse = (code, detail = {}) => { refusals.push({ code, ...detail }); };
  const gate = epoch?.gateConfig || null;
  const rails = epoch?.rails || null;

  // 1. Mode, book, drafting.
  if (!admitsOwner) refuse('mode_not_admitted');
  if (book.status !== 'active') refuse('book_not_active', { status: book.status ?? null });
  if (book.drafting === 'paused' || book.windDown) refuse('drafting_paused');
  if (!gate || !rails || !isSectorCapCorrected(gate)) refuse(VINTAGE_UNCORRECTED);

  // 2. The slot is open.
  const occupant = book.slots?.[contract.slot] ?? null;
  if (occupant !== null) refuse('slot_occupied', { slot: contract.slot, ideaId: occupant });

  // 3. B-SAME.
  const taken = namesTakenBy(ideas);
  for (const sym of Object.keys(book.portfolio?.positions || {})) if (!taken.has(sym)) taken.set(sym, book.portfolio.positions[sym].ideaId ?? null);
  for (const name of contract.names) {
    if (taken.has(name)) refuse('ticker_held_by_other_idea', { symbol: name, ideaId: taken.get(name) });
  }

  // 6. Calendar.
  const schedule = ideaSchedule(nowIso, contract.slot);
  if (!schedule) refuse('calendar_unsupported', { slot: contract.slot });

  // 7. Capital.
  const limits = [];
  let permittedMaxCents = null;
  if (gate && rails && isSectorCapCorrected(gate)) {
    // The equity every share is taken of is the book's DISPLAYED equity — `portfolio.totalValue`, the number the
    // last close (or the last fill) wrote — never a second valuation of the same positions that could differ from
    // it by a cent (BUILD_RULES §9; refuter RF1-2). Admission and release do not change it.
    const displayedEquity = book.portfolio?.totalValue;
    const equityOk = typeof displayedEquity === 'number' && Number.isFinite(displayedEquity) && displayedEquity >= 0;
    const equityCents = equityOk ? toCents(displayedEquity) : NaN;
    const unreservedCents = toCents(book.treasury?.unreservedCash);
    const capitalCents = toCents(contract.capitalUsd);

    // FAIL CLOSED on the epoch's own numbers (review L1-7, refuter RF1-1): each must be a real number of its own
    // kind. A missing one would compare as not-a-number and bind nothing; a `null`, `false` or `''` would read as
    // ZERO and bind nothing either.
    const isShare = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
    const isCount = (v) => Number.isInteger(v) && v > 0;
    const invalid = new Set();
    if (!equityOk) invalid.add('book_equity');
    if (!isShare(rails.slotCapShare?.[contract.slot])) invalid.add('slot_cap');
    if (!isShare(gate.cashFloorPct)) invalid.add('cash_floor');
    if (!isShare(gate.maxSinglePositionWeightPct)) invalid.add('single_position_cap');
    if (gate.sectorConcentrationCap !== null && !(isCount(gate.sectorCapSlots) && isCount(gate.sectorCapDenominator))) invalid.add('sector_cap');
    if (!isCount(gate.maxPositions)) invalid.add('position_count');

    limits.push({ constraint: 'slot_cap', code: 'capital_exceeds_slot_cap', limitCents: shareLimitCents(equityCents, rails.slotCapShare?.[contract.slot]), slot: contract.slot });
    limits.push({ constraint: 'cash_floor', code: 'cash_floor_breached', limitCents: unreservedCents - shareCeilCents(equityCents, gate.cashFloorPct) });

    // Single position: w × capital ≤ cap × equity for every name (no other idea holds the name — check 3).
    const singleCapCents = shareLimitCents(equityCents, gate.maxSinglePositionWeightPct);
    for (const name of contract.names) {
      const w = weightOf(contract, name);
      limits.push({ constraint: 'single_position_cap', code: 'single_position_cap_exceeded', limitCents: floorMulDiv(singleCapCents, w.den, w.num), symbol: name });
    }

    // Sector: what the book already carries in the sector (held at its recorded mark, plus other ideas' pending
    // plans) + this idea's planned dollars there ≤ cap × equity. All sectors through the one bridge.
    if (gate.sectorConcentrationCap !== null) {
      const capCents = ratioLimitCents(equityCents, gate.sectorCapSlots, gate.sectorCapDenominator);
      const exposureCents = {};
      const addExposure = (sym, cents) => { const s = mandateSectorOf(sym) ?? '__unknown__'; exposureCents[s] = (exposureCents[s] || 0) + cents; };
      for (const [sym, pos] of Object.entries(book.portfolio?.positions || {})) {
        addExposure(sym, toCents((Number(pos.shares) || 0) * (Number.isFinite(pos.lastMark) ? pos.lastMark : 0)));
      }
      for (const idea of ideas) {
        if (idea.status !== IDEA_STATUS.ACCEPTED) continue; // a filled idea's dollars are the positions above
        const legs = planLegCents(idea.contract, toCents(idea.contract.capitalUsd));
        for (const [sym, cents] of Object.entries(legs)) addExposure(sym, cents);
      }
      const bySector = new Map();
      for (const name of contract.names) {
        const sector = mandateSectorOf(name);
        if (!bySector.has(sector)) bySector.set(sector, []);
        bySector.get(sector).push(name);
      }
      for (const [sector, members] of bySector) {
        // Σ weights of the members, as one rational over a common denominator.
        const den = weightOf(contract, members[0]).den;
        const num = members.reduce((sum, n) => sum + weightOf(contract, n).num, 0);
        const headroom = capCents - (exposureCents[sector] || 0);
        limits.push({
          constraint: 'sector_cap', code: 'sector_cap_exceeded', sector,
          limitCents: headroom <= 0 ? 0 : floorMulDiv(headroom, den, num),
          capCents, existingCents: exposureCents[sector] || 0,
        });
      }
    }

    // Position count: positions + other ideas' pending names + this idea's names ≤ the cap.
    const pendingNames = ideas.filter((i) => i.status === IDEA_STATUS.ACCEPTED).reduce((n, i) => n + i.contract.names.length, 0);
    const positionsAfter = Object.keys(book.portfolio?.positions || {}).length + pendingNames + contract.names.length;
    if (invalid.has('position_count') || positionsAfter > gate.maxPositions) {
      limits.push({ constraint: 'position_count', code: 'position_count_exceeded', limitCents: 0, positionsAfter, maxPositions: gate.maxPositions });
    }

    // …and on any limit that still is not a whole number of cents. An invalid limit permits nothing.
    for (const l of limits) if (!Number.isInteger(l.limitCents)) invalid.add(l.constraint);
    if (!Number.isInteger(unreservedCents)) invalid.add('treasury');
    if (invalid.size > 0) {
      refuse('epoch_config_invalid', { constraints: [...invalid].sort() });
      for (const l of limits) if (invalid.has(l.constraint) || invalid.has('book_equity') || invalid.has('treasury')) l.limitCents = 0;
    }
    permittedMaxCents = Math.max(0, Math.min(...limits.map((l) => l.limitCents)));
    for (const l of limits) {
      if (capitalCents > l.limitCents) refuse(l.code, { ...publicLimit(l), requestedUsd: contract.capitalUsd });
    }
  }

  // 8. Coverage.
  const coveragePlan = ideaCoveragePlan(contract, { filled: false });
  const fit = coverageFits(coverageWithoutRef(coverageData, ideaRefKey, nowIso), coveragePlan);
  if (!fit.fits) refuse('coverage_unavailable', { needed: fit.needed, cap: fit.cap });

  const binding = permittedMaxCents === null ? [] : limits.filter((l) => Math.max(0, l.limitCents) === permittedMaxCents).map(publicLimit);
  return {
    refusals,
    permittedMaxUsd: permittedMaxCents === null ? null : fromCents(permittedMaxCents),
    binding,
    limits: limits.map(publicLimit),
    schedule,
    coveragePlan,
  };
}

/** The idea document at admission: the contract frozen, the capital in its ledger, nothing bought. */
export function buildIdeaDoc({ ideaId, bookId, book, contract, schedule, opId, opFingerprint, nowIso }) {
  const capitalCents = toCents(contract.capitalUsd);
  return {
    schemaVersion: IDEA_SCHEMA_VERSION,
    ideaId,
    bookId,
    userId: book.userId,
    attributionAgentId: book.attributionAgentId,
    status: IDEA_STATUS.ACCEPTED,
    statusHistory: [{ status: IDEA_STATUS.ACCEPTED, at: nowIso }],
    revision: 0,
    opId,
    opFingerprint,
    admittedAt: nowIso,
    // The contract, frozen at admission (contract V2 §4.1). Never rewritten.
    contract: {
      ...contract,
      schedule: {
        startSession: schedule.startSession,
        dueSession: schedule.dueSession,
        sessions: schedule.sessions,
        entryNotBefore: schedule.entryNotBefore,
      },
      riskAssumption: RISK_ASSUMPTION,
      band: {
        shareOfReserved: PRACTICE_FIELD_SLOTS.B4_BAND_SHARE_OF_RESERVED,
        usd: fromCents(shareLimitCents(capitalCents, PRACTICE_FIELD_SLOTS.B4_BAND_SHARE_OF_RESERVED)),
      },
      benchmarkSymbol: PRACTICE_FIELD_BENCHMARK_SYMBOL,
      epochId: book.currentEpochId,
      contractVersion: PRACTICE_FIELD_CONTRACT_VERSION,
      slotsVersion: PRACTICE_FIELD_SLOTS_VERSION,
      fundsVersion: PRACTICE_FIELD_FUNDS_VERSION,
    },
    // The idea's own sub-ledger: its reserved capital, in cash, until the basket fills.
    ledger: newLedger(LEDGER_KIND.IDEA, contract.capitalUsd),
    comparisonLedger: null,
    spyLedger: null,
    lines: null,
    entry: null,
    lastEntryAttempt: null,
  };
}

const refused = (refusals, extra = {}) => ({ ok: false, refusals, permittedMaxUsd: null, binding: [], ...extra });

/**
 * Admit an idea: validate, reserve capital and coverage, and write it `accepted` — or refuse with every reason.
 *
 * @returns {Promise<
 *   | { ok: true, ideaId: string, idempotentReplay: boolean, startSession: string, dueSession: string,
 *       entryNotBefore: object, permittedMaxUsd: number, binding: Array<object> }
 *   | { ok: false, refusals: Array<{ code: string }>, permittedMaxUsd: number|null, binding: Array<object> }
 * >}
 */
export async function admitIdea(db, { bookId, contract: rawContract, opId, nowIso } = {}) {
  if (!db) throw new Error('admitIdea: db required');
  if (!idOk(bookId) || !idOk(opId)) throw new Error('admitIdea: bookId and opId are required');
  if (!isInstant(nowIso)) throw new Error('admitIdea: nowIso must be an ISO instant');

  const shape = normalizeIdeaContract(rawContract);
  // 'off': no Practice Field read happens at all.
  if (!practiceFieldLive()) return refused([...shape.refusals, { code: 'mode_not_admitted' }]);

  const bookRef = db.collection('mandates').doc(bookId);
  const ideaId = ideaIdFor(bookId, opId);
  const ideaRef = bookRef.collection('ideas').doc(ideaId);
  const coverageDocRef = coverageRefOf(db);
  const ideaRefKey = coverageRef(bookId, ideaId);
  const opFingerprint = admissionFingerprint({ bookId, contract: shape.contract, rawContract });

  return db.runTransaction(async (tx) => {
    const bookSnap = await tx.get(bookRef);
    if (!bookSnap.exists || !isIdeaBook(bookSnap.data())) return refused([...shape.refusals, { code: 'book_not_found' }]);
    const book = bookSnap.data();

    const existing = await tx.get(ideaRef);
    if (existing.exists) {
      const prior = existing.data();
      if (prior.opFingerprint !== opFingerprint) return refused([{ code: 'op_id_conflict', ideaId }]);
      return {
        ok: true, ideaId, idempotentReplay: true, status: prior.status, // the idea as it stands NOW: a replay after a timeout says `cancelled`
        startSession: prior.contract.schedule.startSession, dueSession: prior.contract.schedule.dueSession,
        entryNotBefore: prior.contract.schedule.entryNotBefore, permittedMaxUsd: null, binding: [],
      };
    }

    const epochSnap = await tx.get(epochRefOf(bookRef, book));
    const epoch = epochSnap.exists ? epochSnap.data() : null;
    const ideas = [];
    for (const id of book.openIdeaIds || []) {
      const snap = await tx.get(bookRef.collection('ideas').doc(id));
      if (snap.exists) ideas.push(snap.data());
    }
    const coverageSnap = await tx.get(coverageDocRef);
    const coverageData = coverageSnap.exists ? coverageSnap.data() : null;
    // Reject, never repair (Astra T1A-02): a book that does not reconcile AS READ — its marks, its equity, any of its
    // ideas' three ledgers — admits nothing. The limits below are shares of that equity.
    assertReconciled(book, ideas);

    const admitsOwner = practiceFieldAdmits(book.userId);
    if (shape.contract === null) {
      // The shape failed: the book-level checks that need a whole contract cannot run. Say everything known.
      const extra = [];
      if (!admitsOwner) extra.push({ code: 'mode_not_admitted' });
      if (book.status !== 'active') extra.push({ code: 'book_not_active', status: book.status ?? null });
      if (book.drafting === 'paused' || book.windDown) extra.push({ code: 'drafting_paused' });
      return refused([...shape.refusals, ...extra]);
    }
    const contract = shape.contract;
    const verdict = evaluateAdmission({ book, epoch, ideas, coverageData, contract, ideaRefKey, nowIso, admitsOwner });
    if (verdict.refusals.length > 0) {
      return { ok: false, refusals: verdict.refusals, permittedMaxUsd: verdict.permittedMaxUsd, binding: verdict.binding };
    }

    const ideaDoc = buildIdeaDoc({ ideaId, bookId, book, contract, schedule: verdict.schedule, opId, opFingerprint, nowIso });
    const nextBook = {
      ...book,
      treasury: { ...book.treasury, unreservedCash: fromCents(toCents(book.treasury.unreservedCash) - toCents(contract.capitalUsd)) },
      slots: { ...book.slots, [contract.slot]: ideaId },
      openIdeaIds: [...(book.openIdeaIds || []), ideaId],
      revision: (book.revision || 0) + 1,
    };
    assertReconciled(nextBook, [...ideas, ideaDoc]);

    tx.set(ideaRef, ideaDoc);
    tx.update(bookRef, {
      treasury: nextBook.treasury, slots: nextBook.slots, openIdeaIds: nextBook.openIdeaIds, revision: nextBook.revision,
    });
    tx.set(coverageDocRef, coverageWithRef(coverageData, ideaRefKey, verdict.coveragePlan, nowIso));
    return {
      ok: true, ideaId, idempotentReplay: false, status: IDEA_STATUS.ACCEPTED,
      startSession: verdict.schedule.startSession, dueSession: verdict.schedule.dueSession,
      entryNotBefore: verdict.schedule.entryNotBefore, permittedMaxUsd: verdict.permittedMaxUsd, binding: verdict.binding,
    };
  });
}

/**
 * The release of an idea that never filled, as the next state of the book, the idea and the coverage document.
 * Pure — shared by `releaseIdea`, the entry pass's timeout and the close's timeout, each inside its own
 * transaction. The idea's whole reserved cash returns to the treasury; its slot opens; its coverage is let go.
 *
 * @returns {{ nextBook: object, nextIdea: object, nextCoverage: object }}
 */
export function planRelease({ book, idea, coverageData, reason, nowIso }) {
  const cashCents = toCents(idea.ledger.cash);
  const nextIdea = {
    ...idea,
    status: IDEA_STATUS.CANCELLED,
    statusHistory: [...(idea.statusHistory || []), { status: IDEA_STATUS.CANCELLED, at: nowIso, reason }],
    cancelled: { reason, at: nowIso, returnedToTreasuryUsd: fromCents(cashCents) },
    ledger: { ...idea.ledger, cash: 0, reservedCapitalUsd: 0 },
    revision: (idea.revision || 0) + 1,
  };
  const nextBook = {
    ...book,
    treasury: { ...book.treasury, unreservedCash: fromCents(toCents(book.treasury.unreservedCash) + cashCents) },
    slots: { ...book.slots, [idea.contract.slot]: book.slots?.[idea.contract.slot] === idea.ideaId ? null : book.slots?.[idea.contract.slot] ?? null },
    openIdeaIds: (book.openIdeaIds || []).filter((id) => id !== idea.ideaId),
    revision: (book.revision || 0) + 1,
  };
  const nextCoverage = coverageWithoutRef(coverageData, coverageRef(idea.bookId, idea.ideaId), nowIso);
  return { nextBook, nextIdea, nextCoverage };
}

/**
 * Reverse the reservation of an idea that never filled (the entry timeout, build prompt §6). Idempotent: an idea
 * already cancelled answers as released. An idea that has filled is refused — its capital leaves only through
 * fills, each with its own receipt (T1a-2).
 *
 * @returns {Promise<{ ok: true, released: boolean, idempotentReplay?: boolean } | { ok: false, code: string }>}
 */
export async function releaseIdea(db, { bookId, ideaId, reason = CANCEL_REASON.RELEASED, nowIso } = {}) {
  if (!db) throw new Error('releaseIdea: db required');
  if (!idOk(bookId) || !idOk(ideaId)) throw new Error('releaseIdea: bookId and ideaId are required');
  if (!isInstant(nowIso)) throw new Error('releaseIdea: nowIso must be an ISO instant');
  if (!practiceFieldLive()) return { ok: false, code: 'mode_not_admitted' };

  const bookRef = db.collection('mandates').doc(bookId);
  const ideaRef = bookRef.collection('ideas').doc(ideaId);
  const coverageDocRef = coverageRefOf(db);

  return db.runTransaction(async (tx) => {
    const bookSnap = await tx.get(bookRef);
    if (!bookSnap.exists || !isIdeaBook(bookSnap.data())) return { ok: false, code: 'book_not_found' };
    const book = bookSnap.data();
    const ideaSnap = await tx.get(ideaRef);
    if (!ideaSnap.exists) return { ok: false, code: 'idea_not_found' };
    const idea = ideaSnap.data();
    if (idea.status === IDEA_STATUS.CANCELLED) return { ok: true, released: false, idempotentReplay: true };
    if (idea.status !== IDEA_STATUS.ACCEPTED) return { ok: false, code: 'idea_already_filled', status: idea.status };

    const others = [];
    for (const id of book.openIdeaIds || []) {
      if (id === ideaId) continue;
      const snap = await tx.get(bookRef.collection('ideas').doc(id));
      if (snap.exists) others.push(snap.data());
    }
    const coverageSnap = await tx.get(coverageDocRef);
    // Reject, never repair (Astra T1A-02): the book as read must reconcile before its reservation moves.
    assertReconciled(book, [...others, idea]);
    const { nextBook, nextIdea, nextCoverage } = planRelease({
      book, idea, coverageData: coverageSnap.exists ? coverageSnap.data() : null, reason, nowIso,
    });
    assertReconciled(nextBook, others);

    tx.set(ideaRef, nextIdea);
    tx.update(bookRef, {
      treasury: nextBook.treasury, slots: nextBook.slots, openIdeaIds: nextBook.openIdeaIds, revision: nextBook.revision,
    });
    tx.set(coverageDocRef, nextCoverage);
    return { ok: true, released: true };
  });
}
