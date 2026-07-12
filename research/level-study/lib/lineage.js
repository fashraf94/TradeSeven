// research/level-study/lib/lineage.js
//
// Level lineage engine (parent §5.4, as amended by S3.5) — entity resolution over time.
//
// S3.5 rework highlights:
//   - All geometric thresholds are multiples of the session's distanceUnit (S3.5 §3):
//     match = kMatch·u, merge = kMerge·u, split = kSplit·u — absolute price distances.
//   - LIVE SUPPORT (S3.5 §7a): merge/split runs only advance on sessions where the
//     family receives a matching snapshot. An unsupported family can never complete a
//     merge run, so the retire-vs-merge precedence conflict is impossible by construction.
//   - MERGE IS EFFECTIVE IN THE D REGISTRY (S3.5 §5): a merge detected from D's
//     information set applies to D — D's snapshot ownership is rewritten
//     absorbed → survivor and same-day role events on the absorbed id are suppressed.
//     Every state field has an explicit merge operator (config lineage.merge.transfer).
//   - ROLE STATE MACHINE (S3.5 §6): roles derive from the FAMILY ANCHOR (the same frame
//     Session 4's episode zones use). A flip needs a D−1 close beyond the opposite zone
//     boundary (anchor ± 0.25u) by ≥ 0.25u, sustained 3 consecutive matched sessions;
//     it is recorded on D — only prior-close information is ever used.
//
// Determinism contract unchanged: snapshots ascending by price, families elder-first
// (bornDate, familyId), merge pairs by sorted key, ids = zero-padded founding ordinals.
// State derives only from the current session's snapshots + prior state, so the
// truncated-rebuild harness covers lineage end to end.
//
// Zero product imports.

import CONFIG from '../config.js';

const LIN = CONFIG.levels.lineage;
const GEO = CONFIG.levels.geometry.multiples;
const ROLE = LIN.roleMachine;

export function createLineageState(symbol) {
  return {
    symbol,
    seq: 1,                 // next family founding ordinal
    sessionOrdinal: 0,      // lineage sessions processed (warmup + study; drives preStudy ages)
    families: new Map(),    // familyId -> family record
    _live: [],              // live families, elder-first (bornDate, familyId) — maintained incrementally
    pairRuns: new Map(),    // 'idA|idB' (sorted) -> consecutive both-matched-in-range sessions
    events: [],             // {type: 'merge'|'split'|'retirement'|'role_flip', date, ...} (implementation order == causal order)
  };
}

function elder(a, b) {
  return (cmp(a.bornDate, b.bornDate) || cmp(a.familyId, b.familyId)) < 0 ? a : b;
}

/** Effective side implied by the last role-log entry. */
function effectiveSide(fam) {
  const last = fam.roleLog[fam.roleLog.length - 1].role;
  return last === 'support' || last === 'resistance_turned_support' ? 'support' : 'resistance';
}

function clearPending(fam) {
  fam.pendingSide = null;
  fam.pendingRun = 0;
  fam.pendingStartDate = null;
}

function removeLive(state, fam) {
  const i = state._live.indexOf(fam);
  if (i >= 0) state._live.splice(i, 1);
}

function foundFamily(state, D, snapshot, splitFrom = null) {
  // 6-digit padding keeps lexicographic id order == founding order (the elder tie-break
  // depends on it) far beyond any plausible per-symbol family count.
  const familyId = `${state.symbol}_fam${String(state.seq++).padStart(6, '0')}`;
  const fam = {
    familyId,
    symbol: state.symbol,
    bornDate: D,
    bornOrdinal: state.sessionOrdinal,    // lineage-session ordinal at founding (preStudy ages)
    preStudy: false,                      // stamped true at the study-start checkpoint (S3.5 §4)
    preStudyAgeSessions: null,
    status: 'live',                       // 'live' | 'retired' | 'merged'
    anchor: snapshot.centroid,            // slow EMA (α=0.15) of matched snapshot centroids (§5.4)
    lastMatchedDate: D,
    zeroSupportRun: 0,
    splitRun: 0,
    // Role state machine (S3.5 §6). Founding role: snapshot side vs D−1 close (S3-C8).
    roleLog: [{ date: D, role: snapshot.side }],
    pendingSide: null,
    pendingRun: 0,
    pendingStartDate: null,
    matchHistory: [{ date: D, snapshotId: snapshot.snapshotId, centroid: snapshot.centroid, fromFamilyId: null }],
    mergedInto: null,
    mergedDate: null,
    mergedFrom: [],
    splitFrom,
    retiredDate: null,
    // Session-4 hooks — empty now, with a specified merge-transfer contract (S3.5 §5):
    // absorbed → survivor where survivor is empty; survivor wins conflicts.
    touchHistory: [],
    sequenceIndex: 0,
    s4Hooks: { episode: null, rearm: null, cooldown: null },
  };
  state.families.set(familyId, fam);
  state._live.push(fam); // bornDate = D is maximal and ids ascend → elder-first order preserved
  return fam;
}

/**
 * Advance lineage by one registry session.
 * @param {object} state createLineageState() output (mutated)
 * @param {string} D registry session date
 * @param {Array} snapshots buildDaySnapshots(...).snapshots for D (familyId assigned here;
 *   ownership may be rewritten by a same-session merge per S3.5 §5)
 * @param {{unit:number, refClose:number}} ctx the session's distanceUnit u(D) — computed
 *   from ATR(14, D−1) and price(D−1) — and the D−1 adjusted close.
 */
export function lineageStep(state, D, snapshots, ctx) {
  const { unit, refClose } = ctx;

  // ── 1. Matching (§5.4): ascending price; join the family whose anchor is within
  // kMatch·u; nearest anchor wins; elder breaks ties; side ignored.
  const snaps = [...snapshots].sort((a, b) => a.centroid - b.centroid || cmp(a.snapshotId, b.snapshotId));
  const radius = GEO.kMatch * unit;
  const matched = new Map(); // familyId -> [{snapshot, founding}]
  for (const s of snaps) {
    let best = null, bestDist = Infinity;
    // _live iterates elder-first, so strict `<` keeps the elder on an exact-distance tie —
    // the §5.4 tie-break is enforced by iteration order. (S3-C11: includes families
    // founded earlier in this pass.)
    for (const f of state._live) {
      const d = Math.abs(f.anchor - s.centroid);
      if (d > radius) continue;
      if (d < bestDist) { best = f; bestDist = d; }
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

  // ── 2. Split detection & execution (§5.4; S3.5 geometry): constituent method levels
  // separated by more than kSplit·u on 5 consecutive SUPPORTED sessions (live-support —
  // an unmatched session resets in phase 4). The bounded-diameter theorem guarantees a
  // single snapshot can never carry the evidence, so ≥2 matched snapshots is implied,
  // not a special rule. Runs BEFORE anchor updates so branch snapshots never pull the
  // elder's anchor.
  for (const fid of [...matched.keys()].sort()) {
    const fam = state.families.get(fid);
    const list = matched.get(fid);
    const prices = list.flatMap((e) => e.snapshot.members.map((m) => m.price));
    const span = prices.length >= 2 ? Math.max(...prices) - Math.min(...prices) : 0;
    if (list.length >= 2 && span > GEO.kSplit * unit) fam.splitRun += 1; else fam.splitRun = 0;
    if (fam.splitRun >= LIN.splitConsecutiveSessions) {
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
      clearPending(fam); // S3.5 §6: a split resets pending role state
      state.events.push({ type: 'split', date: D, familyId: fam.familyId, branches, spanUnits: span / unit });
    }
  }

  // ── 3. Matched-family updates: role state machine, anchor EMA, support reset,
  // match history.
  for (const fid of [...matched.keys()].sort()) {
    const fam = state.families.get(fid);
    const list = matched.get(fid);
    const preAnchor = fam.anchor; // the prior COMMITTED anchor — the role frame (S3.5 §6)

    // Role state machine (S3.5 §6). Inputs: prior committed anchor, D−1 adjusted close
    // (refClose), D−1 distanceUnit. The flip lands on D after the 3rd confirming close,
    // which occurred on D−1 — never D's own close (that would be lookahead).
    const isFounding = list.length === 1 && list[0].founding;
    if (!isFounding) {
      const zoneHalf = ROLE.zoneHalfWidthUnits * unit;
      const margin = ROLE.flipBeyondOppositeBoundaryUnits * unit;
      const side = effectiveSide(fam);
      const evidence = side === 'support'
        ? refClose <= preAnchor - zoneHalf - margin   // closed below the LOWER boundary by ≥ margin
        : refClose >= preAnchor + zoneHalf + margin;  // closed above the UPPER boundary by ≥ margin
      if (evidence) {
        const target = side === 'support' ? 'resistance' : 'support';
        if (fam.pendingSide === target) fam.pendingRun += 1;
        else { fam.pendingSide = target; fam.pendingRun = 1; fam.pendingStartDate = D; }
        if (fam.pendingRun >= ROLE.confirmSessions) {
          const role = side === 'support' ? 'support_turned_resistance' : 'resistance_turned_support';
          fam.roleLog.push({ date: D, role });                      // append-only
          state.events.push({ type: 'role_flip', date: D, familyId: fam.familyId, role, pendingStartDate: fam.pendingStartDate });
          clearPending(fam);
        }
      } else {
        // Inside the zone, back on the current-role side, or in the gray band short of
        // the flip margin — evidence absent breaks the consecutive run (S3.5 §6 resets).
        clearPending(fam);
      }
    }

    const centroids = list.map((e) => e.snapshot.centroid);
    const observed = centroids.reduce((s, c) => s + c, 0) / centroids.length; // S3-C10
    fam.anchor = preAnchor + LIN.anchorEmaAlpha * (observed - preAnchor);
    fam.lastMatchedDate = D;
    fam.zeroSupportRun = 0;
    for (const e of list) {
      if (e.founding) continue;                                     // founding entry already recorded
      fam.matchHistory.push({ date: D, snapshotId: e.snapshot.snapshotId, centroid: e.snapshot.centroid, fromFamilyId: null });
    }
  }

  // ── 4. Unsupported families: zero-support accumulation → retirement (§5.4); split
  // runs and pending role state reset (live-support / S3.5 §6).
  for (const fam of [...state._live]) {
    if (matched.has(fam.familyId)) continue;
    fam.zeroSupportRun += 1;
    fam.splitRun = 0;
    clearPending(fam);
    if (fam.zeroSupportRun >= LIN.retireZeroSupportSessions) {
      fam.status = 'retired';                                       // cannot re-arm or host events;
      fam.retiredDate = D;                                          // later reformation = NEW family
      removeLive(state, fam);
      state.events.push({ type: 'retirement', date: D, familyId: fam.familyId });
    }
  }

  // ── 5. Merge (§5.4; S3.5 §5, §7a): a pair run advances only on sessions where BOTH
  // families are matched (live support) AND their anchors sit within kMerge·u; any other
  // session deletes the run. At 5 consecutive, the elder survives and the merge is
  // EFFECTIVE IN THIS SESSION'S REGISTRY.
  const live = [...state._live].sort((a, b) => a.anchor - b.anchor || cmp(a.familyId, b.familyId));
  const activeKeys = new Set();
  const mergeDist = GEO.kMerge * unit;
  for (let i = 0; i < live.length; i++) {
    if (!matched.has(live[i].familyId)) continue;                   // live support (S3.5 §7a)
    for (let j = i + 1; j < live.length; j++) {
      if (live[j].anchor - live[i].anchor > mergeDist) break;       // anchors sorted
      if (!matched.has(live[j].familyId)) continue;
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
    removeLive(state, absorbed);
    survivor.mergedFrom.push({ familyId: absorbed.familyId, date: D, absorbedAnchor: absorbed.anchor });

    // S3.5 §5 — merge is EFFECTIVE IN THE D REGISTRY: rewrite this session's snapshot
    // ownership and suppress the absorbed family's same-day role events. (The absorbed
    // family's own roleLog is retained untouched — append-only, provenance under
    // mergedFrom — only the event stream is cleaned.)
    for (const s of snaps) if (s.familyId === absorbed.familyId) s.familyId = survivor.familyId;
    state.events = state.events.filter((e) =>
      !(e.type === 'role_flip' && e.date === D && e.familyId === absorbed.familyId));

    // Full state-transfer operator (config lineage.merge.transfer):
    // matchHistory — union, absorbed entries tagged, deterministic sort.
    for (const h of absorbed.matchHistory) {
      survivor.matchHistory.push({ ...h, fromFamilyId: h.fromFamilyId ?? absorbed.familyId });
    }
    survivor.matchHistory.sort((x, y) => cmp(x.date, y.date) || cmp(x.snapshotId, y.snapshotId) || cmp(x.fromFamilyId || '', y.fromFamilyId || ''));
    // touchHistory — union sorted by (timestamp, familyId, snapshotId) (S4 populates).
    survivor.touchHistory = survivor.touchHistory.concat(absorbed.touchHistory)
      .sort((x, y) => cmp(x.timestamp || x.date || '', y.timestamp || y.date || '') || cmp(x.familyId || '', y.familyId || '') || cmp(x.snapshotId || '', y.snapshotId || ''));
    // sequenceIndex — recomputed from the merged, sorted touchHistory (S35-C5).
    survivor.sequenceIndex = survivor.touchHistory.length;
    // pending role state — survivor's only; absorbed's is meaningless post-merge.
    clearPending(absorbed);
    // S4 hooks — transfer where survivor is empty; survivor wins conflicts (audit in event).
    const s4Conflicts = {};
    for (const k of Object.keys(survivor.s4Hooks)) {
      if (survivor.s4Hooks[k] == null && absorbed.s4Hooks[k] != null) survivor.s4Hooks[k] = absorbed.s4Hooks[k];
      else if (survivor.s4Hooks[k] != null && absorbed.s4Hooks[k] != null) s4Conflicts[k] = absorbed.s4Hooks[k];
    }
    // anchor — survivor's own EMA continues (absorbed anchor audited on the event).

    state.events.push({
      type: 'merge', date: D,
      survivorId: survivor.familyId, absorbedId: absorbed.familyId,
      survivorAnchor: survivor.anchor, absorbedAnchor: absorbed.anchor,
      ...(Object.keys(s4Conflicts).length ? { absorbedS4Hooks: s4Conflicts } : {}),
    });
    for (const k of [...state.pairRuns.keys()]) {
      if (k.split('|').includes(absorbed.familyId)) state.pairRuns.delete(k);
    }
  }

  state.sessionOrdinal += 1;
}

function pairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

/** Plain-object view of the family store for artifacts/comparison (sorted keys). */
export function familiesToObject(state) {
  const out = {};
  for (const id of [...state.families.keys()].sort()) out[id] = state.families.get(id);
  return out;
}
