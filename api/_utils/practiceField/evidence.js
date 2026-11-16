// api/_utils/practiceField/evidence.js
//
// Practice Field T1a-2b-1 — THE EVIDENCE PACKETS (shared contract V2 §6; build prompt §3). Two per idea, at
// `mandates/{bookId}/ideas/{ideaId}/evidence/{packetId}`, each CREATE-ONCE and immutable, each carrying a content hash:
//
//   `admission`  written in admission's own transaction (admission.js admitIdea): the contract as frozen, the source
//                references, and what admission measured the idea against — the book's recorded equity, treasury
//                and positions with their marks, the snapshot those marks were last written from, the other open
//                ideas, and the limits it computed — and the time;
//   `result`     written in the transaction of the close that writes the idea's endpoint and result (close.js
//                closeNextSession): a COPY of every price the result relied on, for every ledger — the entry fills
//                (from the inception row), each line's level and each line breach's close, every sale filled before
//                the endpoint, every endpoint mark with its vendor time and quality and the endpoint snapshot's key,
//                the corporate-action receipts applied — and the result itself.
//
// COPIES, NOT REFERENCES. The engine deletes its shared snapshots after 120 days (mandateClosePass.js
// runRetentionCleanup, which touches `mandateUniverseSnapshots`, `mandateUniverseDaily` and the batch bookkeeping, and
// nothing under `mandates/` — pinned by evidence.test.js). A packet therefore holds the prices themselves. The source
// references are references: no source carries content in this build (a founder fixture has no source), and the
// drafting call's excerpts are T1d's.
//
// JSON-PURE. Every value in a packet is a string, a number, a boolean, null, an array or a plain map: dates are ISO
// strings. So the hash computed here is the hash of what Firestore stores and returns, and `verifyPacket` holds after
// a round trip (Firestore returns map keys sorted; the canonical form sorts them too).
//
// Pure: no store, no clock. The two writers call `tx.create`, so a second write of a packet aborts its transaction.

import { canonicalContentHash } from '../canonicalHash.js';
import { PracticeFieldError } from './errors.js';

/** The packet's own version (its own family; starts at 1). */
export const EVIDENCE_PACKET_VERSION = 1;
/** The two packets and their document ids. */
export const EVIDENCE_PACKET = Object.freeze({ ADMISSION: 'admission', RESULT: 'result' });
/** How the content hash is made: sha-256 of the canonical JSON (sorted keys) of the packet without its hash fields. */
export const EVIDENCE_HASH_ALGORITHM = 'sha256_canonical_json_v1';

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A JSON-pure deep copy: Dates and Firestore Timestamps become ISO strings; undefined map values are dropped. */
export function jsonPure(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return Number.isNaN(value) ? null : value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : jsonPure(v)));
  const out = {};
  for (const k of Object.keys(value)) {
    const v = jsonPure(value[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Seal a packet body: its content hash over everything but the two hash fields. */
function seal(body) {
  const pure = jsonPure(body);
  return { ...pure, hashAlgorithm: EVIDENCE_HASH_ALGORITHM, contentHash: canonicalContentHash(pure) };
}

/** Does a stored packet still hash to its own `contentHash`? */
export function verifyPacket(packet) {
  if (!isPlain(packet) || typeof packet.contentHash !== 'string') return false;
  const { contentHash, hashAlgorithm, ...body } = packet;
  return hashAlgorithm === EVIDENCE_HASH_ALGORITHM && canonicalContentHash(jsonPure(body)) === contentHash;
}

/** The evidence document of an idea. */
export function evidenceRefOf(ideaRef, packetId) {
  return ideaRef.collection('evidence').doc(packetId);
}

// ── admission ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The admission packet. `book` is the book as admission's transaction READ it (before the reservation), `ideas` the
 * other open ideas as read, `idea` the idea document being written (its contract frozen), `verdict` admission's own
 * evaluation (the limits it computed).
 */
export function buildAdmissionPacket({ bookId, book, ideas, idea, verdict, nowIso }) {
  const positions = {};
  for (const sym of Object.keys(book?.portfolio?.positions || {}).sort()) {
    const p = book.portfolio.positions[sym];
    positions[sym] = {
      shares: p?.shares ?? null, lastMark: p?.lastMark ?? null, lastMarkAsOf: p?.lastMarkAsOf ?? null,
      lastMarkSource: p?.lastMarkSource ?? null, ideaId: p?.ideaId ?? null,
    };
  }
  const lastCloseKey = typeof book?.execState?.lastCloseKey === 'string' ? book.execState.lastCloseKey : null;
  return seal({
    packetVersion: EVIDENCE_PACKET_VERSION,
    packetId: EVIDENCE_PACKET.ADMISSION,
    bookId,
    ideaId: idea.ideaId,
    userId: idea.userId ?? null,
    epochId: idea.contract?.epochId ?? null,
    contractVersion: idea.contract?.contractVersion ?? null,
    admittedAt: idea.admittedAt ?? nowIso,
    writtenAt: nowIso,
    opId: idea.opId ?? null,
    opFingerprint: idea.opFingerprint ?? null,
    // The contract exactly as frozen on the idea (contract §4.1).
    contract: idea.contract,
    // The sources the idea names, by reference (`{ kind, ref }`), and its origin. No excerpt exists in this build.
    sources: { origin: idea.contract?.origin ?? null, references: idea.contract?.sources ?? [] },
    // What admission measured against: the book's RECORDED state (contract §5.4 check 7 — the equity every limit is a
    // share of is `portfolio.totalValue`, the figure the last close or the last fill wrote; each position's mark is
    // the one last written on it). The marks' snapshot: the last close's stored snapshot, and the last window the
    // idea-book pass served (a fill since that close writes the marks of what it bought from that window's snapshot).
    measuredAgainst: {
      bookRevision: book?.revision ?? null,
      equityUsd: book?.portfolio?.totalValue ?? null,
      cashUsd: book?.portfolio?.cash ?? null,
      treasuryUnreservedUsd: book?.treasury?.unreservedCash ?? null,
      positions,
      marksSnapshot: {
        lastCloseKey,
        closeSnapshotKey: lastCloseKey === null ? null : `${lastCloseKey}_close`,
        lastWindowTickKey: typeof book?.execState?.lastIdeaTickKey === 'string' ? book.execState.lastIdeaTickKey : null,
      },
      otherOpenIdeas: (ideas || []).map((i) => ({
        ideaId: i?.ideaId ?? null, status: i?.status ?? null, slot: i?.contract?.slot ?? null,
        names: i?.contract?.names ?? [], capitalUsd: i?.contract?.capitalUsd ?? null,
      })),
    },
    limits: {
      permittedMaxUsd: verdict?.permittedMaxUsd ?? null,
      binding: verdict?.binding ?? [],
      all: verdict?.limits ?? [],
    },
  });
}

// ── result ────────────────────────────────────────────────────────────────────────────────────────────────────

const LEDGERS = Object.freeze([['idea', 'ledger'], ['comparison', 'comparisonLedger'], ['spy', 'spyLedger']]);

/** A fill receipt's prices: what was bought, at what, from which quote. */
const fillCopy = (r) => ({
  symbol: r?.symbol ?? null, verb: r?.verb ?? null, shares: r?.shares ?? null,
  executedPrice: r?.executedPrice ?? null, executedSizeUsd: r?.executedSizeUsd ?? null,
  mark: r?.mark ?? null, markVendorTimeIso: r?.markVendorTimeIso ?? null, markQuoteTs: r?.markQuoteTs ?? null,
  costTier: r?.costTier ?? null, frictionPaidUsd: r?.friction?.frictionPaid ?? null,
});

/** A sale receipt's prices. */
const saleCopy = (r) => ({
  decisionId: r?.decisionId ?? null, kind: r?.kind ?? null, symbol: r?.symbol ?? null, shares: r?.shares ?? null,
  executedPrice: r?.executedPrice ?? null, proceedsUsd: r?.proceedsUsd ?? null, mark: r?.mark ?? null,
  markVendorTimeIso: r?.markVendorTimeIso ?? null, tickKey: r?.tickKey ?? null, sessionDate: r?.sessionDate ?? null,
  costTier: r?.costTier ?? null, frictionPaidUsd: r?.frictionPaidUsd ?? null, queuedBy: r?.queuedBy ?? null,
});

/** One ledger's endpoint, as the endpoint row states it: every holding's mark, its vendor time and quality. */
const endpointCopy = (side) => {
  const marks = {};
  for (const sym of Object.keys(side?.holdings || {}).sort()) {
    const h = side.holdings[sym];
    marks[sym] = {
      shares: h?.shares ?? null, mark: h?.mark ?? null, markQuality: h?.markQuality ?? null,
      markVendorTimeIso: h?.markVendorTimeIso ?? null, costTier: h?.costTier ?? null,
    };
  }
  return {
    cashUsd: side?.cashUsd ?? null, holdingsAtMarksUsd: side?.holdingsAtMarksUsd ?? null,
    modelledExitCostUsd: side?.modelledExitCostUsd ?? null, valueUsd: side?.valueUsd ?? null,
    marksFullQuality: side?.marksFullQuality ?? null, unsettledActions: side?.unsettledActions ?? [], marks,
  };
};

/**
 * The result packet of an idea whose endpoint and result this close writes. `idea` is the idea AFTER this close (its
 * result, its lines with their breaches, its three ledgers with their receipts); `endpointRow` the row this close
 * creates; `inception` the idea's inception row (its entry fills, on all three ledgers), read in the same
 * transaction. An idea with an endpoint and no inception row cannot exist (the entry writes both in one transaction):
 * the close refuses it rather than write a packet without its entry prices.
 */
export function buildResultPacket({ bookId, idea, endpointRow, inception, nowIso }) {
  if (!isPlain(inception) || !isPlain(inception.legs)) throw new PracticeFieldError('inception_row_missing', { ideaId: idea?.ideaId ?? null });
  if (!isPlain(endpointRow) || !isPlain(idea?.result)) throw new PracticeFieldError('result_packet_without_result', { ideaId: idea?.ideaId ?? null });
  const entryFills = {};
  const corporateActions = {};
  const salesBeforeEndpoint = {};
  const endpoint = {};
  for (const [name, field] of LEDGERS) {
    entryFills[name] = (inception.legs[name] || []).map(fillCopy);
    const ledger = idea[field] || {};
    corporateActions[name] = (ledger.corporateActionReceipts || []).filter((r) => r?.applied === true);
    salesBeforeEndpoint[name] = (ledger.saleReceipts || []).map(saleCopy);
    endpoint[name] = endpointCopy(endpointRow[name]);
  }
  return seal({
    packetVersion: EVIDENCE_PACKET_VERSION,
    packetId: EVIDENCE_PACKET.RESULT,
    bookId,
    ideaId: idea.ideaId,
    userId: idea.userId ?? null,
    epochId: idea.contract?.epochId ?? null,
    contractVersion: idea.contract?.contractVersion ?? null,
    writtenAt: nowIso,
    // The entry: the slot snapshot the basket filled from, and every leg on every ledger.
    entry: {
      sessionDate: inception.sessionDate ?? null, snapshotKey: inception.startSnapshotKey ?? null,
      snapshotBuiltAt: inception.startSnapshotBuiltAt ?? null, startMarkAt: inception.startMarkAt ?? null,
      fills: entryFills,
    },
    // Each line's level (moved by any split since), and each breach's close with its vendor time and snapshot key.
    lines: (idea.lines || []).map((l) => ({
      symbol: l?.symbol ?? null, level: l?.level ?? null, fillPrice: l?.fillPrice ?? null, distancePct: l?.distancePct ?? null,
      adjustments: l?.adjustments ?? [], renamedFrom: l?.renamedFrom ?? [], breach: l?.breach ?? null,
    })),
    // Every sale filled before the endpoint (the comparison and SPY never sell: always empty there).
    salesBeforeEndpoint,
    // Every corporate action applied to each ledger up to and including the endpoint session.
    corporateActions,
    // The endpoint: its session and kind, THE stored close snapshot's key and build time, and every mark it used.
    endpoint: {
      session: endpointRow.endpointSession ?? null, kind: endpointRow.endpointKind ?? null, dueSession: endpointRow.dueSession ?? null,
      observed: endpointRow.observed ?? null, label: endpointRow.label ?? null, writtenLate: endpointRow.writtenLate ?? null,
      closeSnapshotKey: endpointRow.closeSnapshotKey ?? null, closeSnapshotBuiltAt: endpointRow.closeSnapshotBuiltAt ?? null,
      ledgers: endpoint,
      gapUsd: endpointRow.gapUsd ?? null, gapToSpyUsd: endpointRow.gapToSpyUsd ?? null,
    },
    // The result itself, as written on the idea.
    result: idea.result,
  });
}

/**
 * The holdings of the endpoint row whose mark the packet does not carry, as `ledger:SYMBOL` — empty for a whole
 * packet. Every ledger, every holding: a packet that drops one ledger's marks is not the result's evidence.
 */
export function resultPacketMissingMarks(packet, endpointRow) {
  const missing = [];
  for (const [name] of LEDGERS) {
    for (const sym of Object.keys(endpointRow?.[name]?.holdings || {})) {
      const m = packet?.endpoint?.ledgers?.[name]?.marks?.[sym];
      if (!m || typeof m.mark !== 'number' || !('markVendorTimeIso' in m) || typeof m.markQuality !== 'string') missing.push(`${name}:${sym}`);
    }
  }
  return missing;
}
