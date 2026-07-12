// research/level-study/lib/lineage.js
//
// Level lineage engine (parent §5.4, Addendum-corrected) — entity resolution over time.
//
// Two identifiers: levelSnapshotId (dated state, assigned in level-sources.js) and
// levelFamilyId (persistent structure). This module owns the familyId side: matching,
// family anchors (EMA), merge, split, retirement, and the append-only role log.
//
// Determinism contract: every collection is processed in a fixed order — snapshots in
// ascending price (parent §5.4), families by (bornDate, familyId), merge pairs by sorted
// key — and family ids are zero-padded founding ordinals, so identical input series
// produce identical family histories (Phase A test #5). State is only ever derived from
// the current session's snapshots plus prior state, never from future bars, so the
// truncated-rebuild harness covers lineage as well as snapshot content.
//
// Zero product imports.

import CONFIG from '../config.js';

const LIN = CONFIG.levels.lineage;

export function createLineageState(symbol) {
  return {
    symbol,
    seq: 1,                 // next family founding ordinal
    families: new Map(),    // familyId -> family record
    pairRuns: new Map(),    // 'idA|idB' (sorted) -> consecutive sessions within merge distance
    events: [],             // append-only: {type: 'merge'|'split'|'retirement'|'role_flip', date, ...}
  };
}

function liveFamilies(state) {
  return [...state.families.values()]
    .filter((f) => f.status === 'live')
    .sort((a, b) => cmp(a.bornDate, b.bornDate) || cmp(a.familyId, b.familyId));
}

function elder(a, b) {
  return (cmp(a.bornDate, b.bornDate) || cmp(a.familyId, b.familyId)) < 0 ? a : b;
}

/** Effective side implied by the last role-log entry. */
export function effectiveSide(fam) {
  const last = fam.roleLog[fam.roleLog.length - 1].role;
  return last === 'support' || last === 'resistance_turned_support' ? 'support' : 'resistance';
}

function foundFamily(state, D, snapshot, splitFrom = null) {
  const familyId = `${state.symbol}_fam${String(state.seq++).padStart(4, '0')}`;
  const fam = {
    familyId,
    symbol: state.symbol,
    bornDate: D,
    status: 'live',                       // 'live' | 'retired' | 'merged'
    anchor: snapshot.centroid,            // slow EMA (α=0.15) of matched snapshot centroids (§5.4)
    lastMatchedDate: D,
    zeroSupportRun: 0,
    splitRun: 0,
    roleLog: [{ date: D, role: snapshot.side }],   // append-only (§5.4)
    matchHistory: [{ date: D, snapshotId: snapshot.snapshotId, centroid: snapshot.centroid, fromFamilyId: null }],
    mergedInto: null,
    mergedDate: null,
    mergedFrom: [],
    splitFrom,
    retiredDate: null,
    // Session-4+ hooks (populated by event detection; carried by merge per S3-C15):
    touchHistory: [],
    sequenceIndex: 0,
  };
  state.families.set(familyId, fam);
  return fam;
}

/**
 * Advance lineage by one registry session.
 * @param {object} state createLineageState() output (mutated)
 * @param {string} D registry session date
 * @param {Array} snapshots buildDaySnapshots(...).snapshots for D (familyId assigned here)
 * @param {number|null} atr ATR(14, daily, D−1) — the 0.25-ATR arm of the match radius
 */
export function lineageStep(state, D, snapshots, atr) {
  // ── 1. Matching (§5.4): ascending price; join the family whose anchor is within
  // max(0.5%, 0.25 ATR); nearest anchor wins; elder breaks ties; side ignored.
  const snaps = [...snapshots].sort((a, b) => a.centroid - b.centroid || cmp(a.snapshotId, b.snapshotId));
  const matched = new Map(); // familyId -> [{snapshot, founding}]
  for (const s of snaps) {
    const radius = Math.max(
      (LIN.matchWithin.pct / 100) * s.centroid,
      atr != null ? LIN.matchWithin.atrMult * atr : 0,
    );
    let best = null, bestDist = Infinity;
    for (const f of liveFamilies(state)) {                 // S3-C11: incl. families founded this pass
      const d = Math.abs(f.anchor - s.centroid);
      if (d > radius) continue;
      if (d < bestDist || (d === bestDist && best && elder(f, best) === f)) { best = f; bestDist = d; }
    }
    if (best) {
      s.familyId = best.familyId;
      if (!matched.has(best.familyId)) matched.set(best.familyId, []);
      matched.get(best.familyId).push({ snapshot: s, founding: false });
    } else {
      const fam = foundFamily(state, D, s);
      s.familyId = fam.familyId;
      matched.set(fam.familyId, [{ snapshot: s, founding: true }]);
    }
  }

  // Deterministic family iteration order for phases 2–3.
  const matchedIds = [...matched.keys()].sort();

  // ── 2. Split detection & execution (§5.4): constituent method levels separated by
  // >1.5% for 5 consecutive sessions → elder keeps id, each other branch gets a fresh id.
  // Runs BEFORE anchor updates so branch snapshots never pull the elder's anchor.
  for (const fid of matchedIds) {
    const fam = state.families.get(fid);
    const list = matched.get(fid);
    const prices = list.flatMap((e) => e.snapshot.members.map((m) => m.price));
    const span = prices.length >= 2 ? relPct(Math.max(...prices), Math.min(...prices)) : 0;
    if (span > LIN.splitSeparationPct) fam.splitRun += 1; else fam.splitRun = 0;
    if (fam.splitRun >= LIN.splitConsecutiveSessions && list.length >= 2) { // S3-C14
      // S3-C13: the snapshot nearest the anchor keeps the elder id; others branch.
      const byDist = [...list].sort((a, b) =>
        Math.abs(a.snapshot.centroid - fam.anchor) - Math.abs(b.snapshot.centroid - fam.anchor) ||
        a.snapshot.centroid - b.snapshot.centroid);
      const keep = byDist[0];
      const branches = [];
      for (const e of list) {
        if (e === keep) continue;
        const branch = foundFamily(state, D, e.snapshot, fam.familyId);
        e.snapshot.familyId = branch.familyId;
        matched.set(branch.familyId, [{ snapshot: e.snapshot, founding: true }]);
        branches.push(branch.familyId);
      }
      matched.set(fid, [keep]);
      fam.splitRun = 0;
      state.events.push({ type: 'split', date: D, familyId: fam.familyId, branches, spanPct: span });
    }
  }

  // ── 3. Matched-family updates: anchor EMA, support reset, match history, role log.
  for (const fid of [...matched.keys()].sort()) {
    const fam = state.families.get(fid);
    const list = matched.get(fid);
    const preAnchor = fam.anchor;
    const centroids = list.map((e) => e.snapshot.centroid);
    const observed = centroids.reduce((s, c) => s + c, 0) / centroids.length; // S3-C10
    // Role first (S3-C12: side of the nearest snapshot, distance to PRE-update anchor).
    const nearest = [...list].sort((a, b) =>
      Math.abs(a.snapshot.centroid - preAnchor) - Math.abs(b.snapshot.centroid - preAnchor) ||
      a.snapshot.centroid - b.snapshot.centroid)[0].snapshot;
    const side = nearest.side;
    if (side !== effectiveSide(fam)) {
      const role = side === 'support' ? 'resistance_turned_support' : 'support_turned_resistance';
      fam.roleLog.push({ date: D, role });                          // append-only
      state.events.push({ type: 'role_flip', date: D, familyId: fam.familyId, role });
    }
    fam.anchor = preAnchor + LIN.anchorEmaAlpha * (observed - preAnchor);
    fam.lastMatchedDate = D;
    fam.zeroSupportRun = 0;
    for (const e of list) {
      if (e.founding) continue;                                     // founding entry already recorded
      fam.matchHistory.push({ date: D, snapshotId: e.snapshot.snapshotId, centroid: e.snapshot.centroid, fromFamilyId: null });
    }
  }

  // ── 4. Retirement (§5.4): zero method support for 20 consecutive sessions.
  for (const fam of liveFamilies(state)) {
    if (matched.has(fam.familyId)) continue;
    fam.zeroSupportRun += 1;
    fam.splitRun = 0;
    if (fam.zeroSupportRun >= LIN.retireZeroSupportSessions) {
      fam.status = 'retired';                                       // cannot re-arm or host events;
      fam.retiredDate = D;                                          // later reformation = NEW family
      state.events.push({ type: 'retirement', date: D, familyId: fam.familyId });
    }
  }

  // ── 5. Merge (§5.4): anchors within 0.4% for 5 consecutive sessions → elder survives.
  const live = liveFamilies(state).sort((a, b) => a.anchor - b.anchor || cmp(a.familyId, b.familyId));
  const activeKeys = new Set();
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const rel = relPct(live[j].anchor, live[i].anchor);           // S3-C9: midpoint denominator
      if (rel > LIN.mergeWithinPct) break;                          // anchors sorted → no closer pair beyond j
      const key = pairKey(live[i].familyId, live[j].familyId);
      activeKeys.add(key);
      state.pairRuns.set(key, (state.pairRuns.get(key) || 0) + 1);
    }
  }
  for (const key of [...state.pairRuns.keys()]) {
    if (!activeKeys.has(key)) state.pairRuns.delete(key);           // consecutive-run reset
  }
  for (const key of [...state.pairRuns.keys()].sort()) {
    if (state.pairRuns.get(key) < LIN.mergeConsecutiveSessions) continue;
    const [idA, idB] = key.split('|');
    const a = state.families.get(idA), b = state.families.get(idB);
    if (!a || !b || a.status !== 'live' || b.status !== 'live') { state.pairRuns.delete(key); continue; }
    const survivor = elder(a, b);
    const absorbed = survivor === a ? b : a;
    absorbed.status = 'merged';
    absorbed.mergedInto = survivor.familyId;
    absorbed.mergedDate = D;
    survivor.mergedFrom.push({ familyId: absorbed.familyId, date: D });
    // S3-C15: in-flight state transfers to the survivor (S4 episode state will ride the
    // same carry); transferred entries are tagged with their source family.
    for (const h of absorbed.matchHistory) {
      survivor.matchHistory.push({ ...h, fromFamilyId: h.fromFamilyId ?? absorbed.familyId });
    }
    survivor.matchHistory.sort((x, y) => cmp(x.date, y.date) || cmp(x.snapshotId, y.snapshotId));
    survivor.touchHistory = survivor.touchHistory.concat(absorbed.touchHistory);
    survivor.zeroSupportRun = Math.min(survivor.zeroSupportRun, absorbed.zeroSupportRun);
    state.events.push({ type: 'merge', date: D, survivorId: survivor.familyId, absorbedId: absorbed.familyId });
    for (const k of [...state.pairRuns.keys()]) {
      if (k.split('|').includes(absorbed.familyId)) state.pairRuns.delete(k);
    }
  }
}

function relPct(a, b) { return (Math.abs(a - b) / ((a + b) / 2)) * 100; } // S3-C9
function pairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

/** Plain-object view of the family store for artifacts/comparison (sorted keys). */
export function familiesToObject(state) {
  const out = {};
  for (const id of [...state.families.keys()].sort()) out[id] = state.families.get(id);
  return out;
}
