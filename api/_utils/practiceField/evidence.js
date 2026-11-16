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
import { MARK_QUALITY } from './constants.js';
import { MARK_PROVENANCE_SOURCE } from './ledger.js';
import { newTrack, foldCloseIntoTrack, trackStatistics } from './settlement.js';
import { roundUsd } from '../mandateRounding.js';
import { toCents, fromCents } from './money.js';

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
  // A lone UTF-16 surrogate is stored by Firestore as U+FFFD: made well-formed HERE, so the hash is of what is stored
  // and still holds after a round trip (review B12).
  if (typeof value === 'string') return typeof value.toWellFormed === 'function' ? value.toWellFormed() : value;
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
 * What admission needs beside the positions (review B1), read IN admission's transaction, before any write: the book's
 * row of its last closed session — was that close observed, and from which stored snapshot. Where each position's own
 * mark came from is recorded on the position itself (`lastMarkProvenance`, Astra T2B-01), so no idea row is read.
 */
export async function readAdmissionMarkSources(tx, bookRef, book) {
  const lastCloseKey = typeof book?.execState?.lastCloseKey === 'string' ? book.execState.lastCloseKey : null;
  if (lastCloseKey === null) return { lastCloseKey, lastCloseRow: null };
  const rowSnap = await tx.get(bookRef.collection('dailyRows').doc(lastCloseKey));
  return { lastCloseKey, lastCloseRow: rowSnap.exists ? rowSnap.data() : null };
}

/**
 * Where one position's recorded mark came from (contract §6), read from the provenance recorded beside it (ledger.js
 * `lastMarkProvenance`; Astra T2B-01) — the source's snapshot key, its quality and its vendor time, null when the quote
 * had none, never a time from another quote:
 *   entry_fill  a fill since the last close priced it (the fill's slot snapshot);
 *   close       the last close marked it FROM its stored snapshot;
 *   carried     the last close (or an unobserved one) carried an earlier price: the fields name THAT price's source —
 *               an earlier close's snapshot, or the fill's — exactly as it was recorded when it was fresh;
 *   unknown     no provenance is recorded on the position (none is written without one since T2B-01): every field null.
 * `recordedMarkAsOf` is the position's own `lastMarkAsOf`, as recorded — beside the source, never in place of a vendor
 * time (it keeps the last vendor-timed mark's time; ledger.js).
 */
function markSourceOf(position, lastCloseKey) {
  const recordedMarkAsOf = position?.lastMarkAsOf ?? null;
  const p = position?.lastMarkProvenance ?? null;
  if (!isPlain(p)) return { kind: 'unknown', source: null, symbol: null, session: null, snapshotKey: null, quality: null, vendorTimeIso: null, recordedMarkAsOf };
  const kind = p.source === MARK_PROVENANCE_SOURCE.FILL && (lastCloseKey === null || p.session > lastCloseKey) ? 'entry_fill'
    : (p.source === MARK_PROVENANCE_SOURCE.CLOSE && p.session === lastCloseKey ? 'close' : 'carried');
  return {
    kind, source: p.source ?? null, symbol: p.symbol ?? null, session: p.session ?? null, snapshotKey: p.snapshotKey ?? null,
    quality: p.quality ?? null, vendorTimeIso: p.vendorTimeIso ?? null, recordedMarkAsOf,
  };
}

/**
 * The admission packet. `book` is the book as admission's transaction READ it (before the reservation), `ideas` the
 * other open ideas as read, `idea` the idea document being written (its contract frozen), `verdict` admission's own
 * evaluation (the limits it computed), `markSources` what readAdmissionMarkSources read in the same transaction.
 */
export function buildAdmissionPacket({ bookId, book, ideas, idea, verdict, nowIso, markSources = null }) {
  const lastCloseKey = typeof book?.execState?.lastCloseKey === 'string' ? book.execState.lastCloseKey : null;
  const positions = {};
  for (const sym of Object.keys(book?.portfolio?.positions || {}).sort()) {
    const p = book.portfolio.positions[sym];
    positions[sym] = {
      shares: p?.shares ?? null, lastMark: p?.lastMark ?? null, lastMarkAsOf: p?.lastMarkAsOf ?? null,
      lastMarkSource: p?.lastMarkSource ?? null, ideaId: p?.ideaId ?? null,
      markSource: markSourceOf(p, lastCloseKey),
    };
  }
  const lastCloseRow = markSources?.lastCloseRow ?? null;
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
    // share of is `portfolio.totalValue`, the figure the last close or the last fill wrote from these same marks; each
    // position's mark is the one last written on it, and `markSource` names where THAT mark came from — the entry's
    // window snapshot, the last close's stored snapshot, or a mark carried at the last close — with its observation
    // time and quality). `lastClose` is the book's last closed session as its own row records it: whether it was
    // observed, and the stored snapshot it was valued from (null for an unobserved session).
    measuredAgainst: {
      bookRevision: book?.revision ?? null,
      equityUsd: book?.portfolio?.totalValue ?? null,
      cashUsd: book?.portfolio?.cash ?? null,
      treasuryUnreservedUsd: book?.treasury?.unreservedCash ?? null,
      positions,
      lastClose: lastCloseKey === null ? null : {
        session: lastCloseKey,
        observed: lastCloseRow?.observed ?? null,
        closeSnapshotKey: lastCloseRow?.closeSnapshotKey ?? null,
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

/** A recorded mark provenance (ledger.js `lastMarkProvenance`), copied field by field; null when there is none. */
const provenanceCopy = (p) => (isPlain(p) ? {
  source: p.source ?? null, symbol: p.symbol ?? null, session: p.session ?? null, snapshotKey: p.snapshotKey ?? null,
  quality: p.quality ?? null, vendorTimeIso: p.vendorTimeIso ?? null,
} : null);

/**
 * Does a mark's stated time agree with its stated quality? A quote the vendor gave no time for
 * (`receipt_time_fallback`) has NONE — an honest unknown — and every other quality names the vendor's own time. So a
 * time paired with an untimed quality is one borrowed from another quote, and is refused (Astra T2B-01; NF-2).
 */
const timeAgreesWithQuality = (quality, vendorTimeIso) => (quality === MARK_QUALITY.RECEIPT_TIME_FALLBACK
  ? vendorTimeIso === null : typeof vendorTimeIso === 'string');

/** Is a carried mark's `carriedFrom` a whole, honest provenance: a source, a session, a snapshot and an agreeing time? */
const honestProvenance = (p) => isPlain(p)
  && (p.source === MARK_PROVENANCE_SOURCE.FILL || p.source === MARK_PROVENANCE_SOURCE.CLOSE)
  && typeof p.session === 'string' && typeof p.snapshotKey === 'string' && typeof p.quality === 'string'
  && timeAgreesWithQuality(p.quality, p.vendorTimeIso);

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

/**
 * Is an endpoint mark CARRIED — the ledger's own earlier price rather than one from this close's snapshot? The endpoint
 * row says so (`markSource`, from the valuation: ledger.js valueLedger, settlement.js ledgerEndpoint). A snapshot price
 * without a vendor time (`receipt_time_fallback`) is this close's own price — it has no observation time, and none is
 * borrowed for it (fix-round refuter NF-2).
 */
const isCarriedMark = (m) => (m?.markSource ?? null) !== 'snapshot';

/**
 * One ledger's endpoint, as the endpoint row states it: every holding's mark, its vendor time, quality and source
 * snapshot. A CARRIED mark (an unobserved endpoint, a held-back symbol, a symbol missing from the close document) names
 * where its price came from — `carriedFrom`, the holding's own provenance, which every carry leaves unchanged (Astra
 * T2B-01; review B2): that source's session, snapshot key, quality and vendor time — null when the source quote had
 * none, never another quote's.
 */
const endpointCopy = (side, endpointSnapshotKey) => {
  const marks = {};
  for (const sym of Object.keys(side?.holdings || {}).sort()) {
    const h = side.holdings[sym];
    const carried = isCarriedMark(h);
    const carriedFrom = carried ? provenanceCopy(h?.carriedFrom) : null;
    marks[sym] = {
      shares: h?.shares ?? null, mark: h?.mark ?? null, markQuality: h?.markQuality ?? null,
      markVendorTimeIso: h?.markVendorTimeIso ?? null, markSource: h?.markSource ?? null, costTier: h?.costTier ?? null,
      snapshotKey: carried ? (carriedFrom?.snapshotKey ?? null) : (endpointSnapshotKey ?? null),
      ...(carried ? { carriedFrom } : {}),
    };
  }
  return {
    cashUsd: side?.cashUsd ?? null, holdingsAtMarksUsd: side?.holdingsAtMarksUsd ?? null,
    modelledExitCostUsd: side?.modelledExitCostUsd ?? null, valueUsd: side?.valueUsd ?? null,
    marksFullQuality: side?.marksFullQuality ?? null, unsettledActions: side?.unsettledActions ?? [], marks,
  };
};

// ── the close observations (Astra T2B-03) ─────────────────────────────────────────────────────────────────────
// The result's largest decline and invested exposure are folded from EVERY close of the idea, entry to endpoint
// (settlement.js foldCloseIntoTrack). The packet therefore copies each of those closes from the idea's own row of it
// — the row is the source — on each ledger: the marked value and the cash, and each holding's quantity and mark with
// the mark's quality, vendor time, source (`markSource`) and snapshot key: this close's snapshot for a fresh mark, the
// source's for a carried one (`carriedFrom`, T2B-01). With them the statistics are recomputed from the packet alone
// (recomputeResultFromPacket), with no snapshot and no row.

/** The three ledgers of a valuation row, by the row's own field names. */
const ROW_LEDGERS = Object.freeze([
  ['idea', { value: 'markedValue', cash: 'cash', holdingsValue: 'markedHoldingsValue', quantities: 'quantities', marks: 'marks' }],
  ['comparison', { value: 'comparisonMarkedValue', cash: 'comparisonCash', holdingsValue: null, quantities: 'comparisonQuantities', marks: 'comparisonMarks' }],
  ['spy', { value: 'spyMarkedValue', cash: 'spyCash', holdingsValue: null, quantities: 'spyQuantities', marks: 'spyMarks' }],
]);

/** One close of the idea, copied from its row. */
function observationOf(row) {
  const key = row?.closeSnapshotKey ?? null;
  const ledgers = {};
  for (const [name, f] of ROW_LEDGERS) {
    const holdings = {};
    const marks = row?.[f.marks] || {};
    for (const sym of Object.keys(marks).sort()) {
      const m = marks[sym];
      const carried = (m?.markSource ?? null) !== 'snapshot';
      const carriedFrom = carried ? provenanceCopy(m?.carriedFrom) : null;
      holdings[sym] = {
        shares: row?.[f.quantities]?.[sym] ?? null, mark: m?.mark ?? null, quality: m?.quality ?? null,
        vendorTimeIso: m?.vendorTimeIso ?? null, markSource: m?.markSource ?? null,
        snapshotKey: carried ? (carriedFrom?.snapshotKey ?? null) : key,
        ...(carried ? { carriedFrom } : {}),
      };
    }
    ledgers[name] = {
      markedValueUsd: row?.[f.value] ?? null, cashUsd: row?.[f.cash] ?? null,
      ...(f.holdingsValue ? { markedHoldingsValueUsd: row?.[f.holdingsValue] ?? null } : {}),
      holdings,
    };
  }
  return {
    date: row?.date ?? null, observed: row?.observed === true, fullQuality: row?.fullQuality === true,
    closeSnapshotKey: key, closeSnapshotBuiltAt: row?.closeSnapshotBuiltAt ?? null, ledgers,
  };
}

/** A ledger's holdings value at its observation's marks: Σ shares × mark, rounded once — the valuation's own basis. */
function holdingsCentsOf(ledger) {
  let raw = 0;
  for (const sym of Object.keys(ledger?.holdings || {}).sort()) {
    const h = ledger.holdings[sym];
    raw += (Number(h?.shares) || 0) * (Number(h?.mark) || 0);
  }
  return toCents(roundUsd(raw));
}

/**
 * THE RESULT'S STATISTICS, RECOMPUTED FROM THE PACKET ALONE (Astra T2B-03) — no snapshot, no row, and not the packet's
 * own `track`: each observation's values are recomputed from its holdings' quantities and marks and its cash, checked
 * against the values it states, and folded in order exactly as the close folded its rows (settlement.js
 * foldCloseIntoTrack), then stated by the one function the result was written with (trackStatistics). Pure.
 *
 * @returns {{ largestDecline: object, investedExposure: object, rows: number, rowsNotFullQuality: number,
 *             observations: number, problems: string[] } | null}  null when the packet carries no observation
 */
export function recomputeResultFromPacket(packet) {
  const obs = Array.isArray(packet?.observations) ? packet.observations : null;
  if (!obs || obs.length === 0) return null;
  const problems = [];
  let track = newTrack();
  let prior = null;
  for (const o of obs) {
    if (typeof o?.date !== 'string' || (prior !== null && o.date <= prior)) problems.push(`order:${o?.date ?? 'none'}`);
    prior = o?.date ?? prior;
    const cents = {};
    for (const [name] of LEDGERS) {
      const l = o?.ledgers?.[name];
      const holdingsCents = holdingsCentsOf(l);
      const valueCents = toCents(l?.cashUsd) + holdingsCents;
      if (valueCents !== toCents(l?.markedValueUsd)) problems.push(`value:${o?.date}:${name}`);
      if (name === 'idea' && holdingsCents !== toCents(l?.markedHoldingsValueUsd)) problems.push(`holdings:${o?.date}:${name}`);
      cents[name] = { valueCents, holdingsCents };
    }
    track = foldCloseIntoTrack(track, {
      date: o?.date, fullQuality: o?.fullQuality === true,
      markedValue: fromCents(cents.idea.valueCents), markedHoldingsValue: fromCents(cents.idea.holdingsCents),
      comparisonMarkedValue: fromCents(cents.comparison.valueCents),
    }, { observed: o?.observed === true });
  }
  return { ...trackStatistics(track), observations: obs.length, problems };
}

/**
 * The result packet of an idea whose endpoint and result this close writes. `idea` is the idea AFTER this close (its
 * result, its lines with their breaches, its three ledgers with their receipts); `endpointRow` the row this close
 * creates; `inception` the idea's inception row (its entry fills, on all three ledgers), read in the same
 * transaction; `closeRows` the idea's row of EVERY close from its entry session to this one, in order — the earlier
 * ones read in the same transaction, this close's as it is about to be written (T2B-03). An idea with an endpoint and
 * no inception row, or with a close missing between its entry and its endpoint, cannot exist (the entry writes the
 * inception row in its transaction; every close writes the row of every filled idea): the close refuses it rather than
 * write a packet without prices its result rests on.
 */
export function buildResultPacket({ bookId, idea, endpointRow, inception, closeRows = [], nowIso }) {
  if (!isPlain(inception) || !isPlain(inception.legs)) throw new PracticeFieldError('inception_row_missing', { ideaId: idea?.ideaId ?? null });
  if (!isPlain(endpointRow) || !isPlain(idea?.result)) throw new PracticeFieldError('result_packet_without_result', { ideaId: idea?.ideaId ?? null });
  const gaps = (closeRows || []).filter((r) => !isPlain(r) || r.rowKind !== 'valuation').map((r) => r?.date ?? null);
  const first = closeRows?.[0]?.date ?? null;
  const last = closeRows?.[closeRows.length - 1]?.date ?? null;
  if (gaps.length > 0 || first !== (idea?.entry?.sessionDate ?? null) || last !== (endpointRow.endpointSession ?? null)) {
    throw new PracticeFieldError('observation_row_missing', { ideaId: idea?.ideaId ?? null, missing: gaps, first, last });
  }
  const entryFills = {};
  const corporateActions = {};
  const salesBeforeEndpoint = {};
  const endpoint = {};
  for (const [name, field] of LEDGERS) {
    entryFills[name] = (inception.legs[name] || []).map(fillCopy);
    const ledger = idea[field] || {};
    corporateActions[name] = (ledger.corporateActionReceipts || []).filter((r) => r?.applied === true);
    salesBeforeEndpoint[name] = (ledger.saleReceipts || []).map(saleCopy);
    endpoint[name] = endpointCopy(endpointRow[name], endpointRow.closeSnapshotKey);
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
    // EVERY CLOSE the result's largest decline and invested exposure were folded from, entry to endpoint, copied from
    // the idea's own rows: on each ledger the values and each holding's quantity, mark and its source (Astra T2B-03).
    observations: closeRows.map(observationOf),
    // The running record those closes were folded into (settlement.js foldCloseIntoTrack), as it stood at the
    // endpoint (review B13) — beside the observations it is recomputed from, never in their place.
    track: idea.track ?? null,
    // The result itself, as written on the idea.
    result: idea.result,
  });
}

/**
 * THE COMPLETENESS CHECK. The holdings of the endpoint row whose mark the packet does not carry WHOLE, as
 * `ledger:SYMBOL` — empty for a whole packet. Every ledger, every holding: a packet that drops one ledger's marks is
 * not the result's evidence. A mark is whole when it has its price, its quality and its source:
 *   fresh    this close's snapshot (`snapshotKey` the endpoint's), no `carriedFrom`, and a time that agrees with its
 *            quality — the vendor's own, or none for `receipt_time_fallback` (NF-2);
 *   carried  `carriedFrom` names its source — fill or close, its session and snapshot — with a time that agrees with
 *            THAT source's quality: an untimed source stays untimed (an honest unknown is accepted) and a time paired
 *            with it is borrowed, and refused (Astra T2B-01; B2).
 */
export function resultPacketMissingMarks(packet, endpointRow) {
  const missing = [];
  const endpointKey = packet?.endpoint?.closeSnapshotKey ?? null;
  for (const [name] of LEDGERS) {
    for (const sym of Object.keys(endpointRow?.[name]?.holdings || {})) {
      const m = packet?.endpoint?.ledgers?.[name]?.marks?.[sym];
      let whole = isPlain(m) && typeof m.mark === 'number' && typeof m.markQuality === 'string';
      if (whole && isCarriedMark(m)) {
        // …and the packet's own record of that source says the same (T2B-03): a time the source never had is borrowed.
        whole = honestProvenance(m.carriedFrom) && m.snapshotKey === m.carriedFrom.snapshotKey && sourceRecordAgrees(packet, name, m.carriedFrom);
      } else if (whole) {
        whole = !('carriedFrom' in m) && typeof endpointKey === 'string' && m.snapshotKey === endpointKey
          && timeAgreesWithQuality(m.markQuality, m.markVendorTimeIso ?? null);
      }
      if (!whole) missing.push(`${name}:${sym}`);
    }
  }
  return missing;
}

/**
 * Does the packet's OWN record of a carried price's source say what the carried mark says of it (T2B-01, T2B-03)? A
 * close source is the packet's observation of that session: there the symbol was marked fresh from that very snapshot,
 * with that quality and that vendor time (or none). A fill source is the entry: that slot snapshot, that session, a leg
 * of that symbol on the same ledger at that quote's time (the eligible-mark rule admits only a vendor-timed quote).
 */
function sourceRecordAgrees(packet, name, p) {
  if (p.source === MARK_PROVENANCE_SOURCE.FILL) {
    return p.quality === MARK_QUALITY.VENDOR_TIME && packet?.entry?.sessionDate === p.session && packet?.entry?.snapshotKey === p.snapshotKey
      && (packet?.entry?.fills?.[name] || []).some((f) => f?.symbol === p.symbol && (f?.markVendorTimeIso ?? null) === p.vendorTimeIso);
  }
  const o = (packet?.observations || []).find((x) => x?.date === p.session);
  const h = o?.ledgers?.[name]?.holdings?.[p.symbol];
  return isPlain(h) && h.markSource === 'snapshot' && o.closeSnapshotKey === p.snapshotKey
    && h.quality === p.quality && (h.vendorTimeIso ?? null) === p.vendorTimeIso;
}

/**
 * Every mark of every close the packet copied (T2B-03), checked as the endpoint's are: a fresh mark names its close's
 * snapshot and a time that agrees with its quality; a carried mark names a whole, honest source, earlier than the close
 * it was carried at, that the packet's own record agrees with. Returns `date:ledger:SYMBOL` for each that fails — empty
 * for a whole packet.
 */
export function resultPacketProvenanceProblems(packet) {
  const problems = [];
  for (const o of packet?.observations || []) {
    for (const [name] of LEDGERS) {
      for (const [sym, h] of Object.entries(o?.ledgers?.[name]?.holdings || {})) {
        const ok = (h?.markSource ?? null) === 'snapshot'
          ? !('carriedFrom' in h) && typeof o.closeSnapshotKey === 'string' && h.snapshotKey === o.closeSnapshotKey && timeAgreesWithQuality(h.quality, h.vendorTimeIso ?? null)
          : honestProvenance(h?.carriedFrom) && h.snapshotKey === h.carriedFrom.snapshotKey && h.carriedFrom.session <= o.date
            && sourceRecordAgrees(packet, name, h.carriedFrom);
        if (!ok) problems.push(`${o?.date}:${name}:${sym}`);
      }
    }
  }
  return problems;
}
