// research/level-study/lib/events.js
//
// LevelStory Session 4 — the EPISODE MODEL (parent §6, as amended by S3.5 / the S4 prompt).
// Turns continuous level interactions into statistically INDEPENDENT events.
//
// Governing principle (parent §6.1): continuous residence near a level is ONE interaction
// episode, however many days it lasts and however many times price probes the zone. Time
// alone NEVER re-arms a level. A new episode requires (a) the prior episode to CLOSE — price
// separates ≥ 1.0·u from the zone boundary AND stays fully outside ≥ 1 full session — and
// (b) a FRESH approach from the correct side (support from above, resistance from below).
//
// Zone (S4 §3.2 / config "unified frame" note): family anchor ± 0.25·u, where u is the clamped
// v3 distanceUnit (session.unit) and the anchor is the family's committed anchor as of the PRIOR
// session close (point-in-time: snapshot.familyAnchor with date < D — the same preAnchor the role
// machine uses, so roles and episode zones agree by construction).
//
// Pure module: zero product imports, imports ../config.js only. detectEvents() is a pure function
// of its inputs so tests fabricate registry/fiveMinByDate directly (mirrors tests/17-boundaries).

import CONFIG from '../config.js';

const EP = CONFIG.episode;
// S4.1: episode thresholds are multiples of the clamped distanceUnit u (NOT raw ATR); their ATR
// equivalents (0.25 / 1.0 / 0.5 ATR, Addendum §6.1/§6.2) are asserted in tests/25. No literals here.
const ZONE_UNITS = EP.zoneHalfWidthU;               // 1.0 → half-width 1.0·u = 0.25·ATR
const SEP_UNITS = EP.closeSeparationU;              // 4.0 → separation 4.0·u = 1.0·ATR
const MIN_OUT = EP.closeMinSessionsOutside;         // 1   → full sessions fully outside to close
const DEDUP_U = EP.crossLevelDedup.dedupIntersectU; // 2.0 → dedup radius 2.0·u = 0.5·ATR
const TIER_RANK = { F1: 1, F2: 2, F3: 3 };       // dedup: highest family tier wins
const CA_ADJ = (CONFIG.adjustment && CONFIG.adjustment.corporateActionAdjacentSessions) || 2;
const SECTOR_MAP = CONFIG.universe.sectorMap || {};

// ── Pure geometry / classification helpers ───────────────────────────────────

/** Episode zone for a family: anchor ± 0.25·u (the clamped distanceUnit). */
export function episodeZone(anchor, unit) {
  const hw = ZONE_UNITS * unit;
  return { zoneLow: anchor - hw, zoneHigh: anchor + hw };
}

/** Position of a price vs a zone: 'above' | 'below' | 'inside' (null if price null). */
function classifyPos(price, zone) {
  if (price == null) return null;
  if (price > zone.zoneHigh) return 'above';
  if (price < zone.zoneLow) return 'below';
  return 'inside';
}

/** A 5-min bar intersects the zone iff its adjusted range overlaps [zoneLow, zoneHigh]. */
function barIntersects(bar, zone) {
  return bar.adjLow <= zone.zoneHigh && bar.adjHigh >= zone.zoneLow;
}

/** The outside side price must approach from: support from above, resistance from below. */
function correctOutsideSide(side) {
  return side === 'support' ? 'above' : 'below';
}

/** Separation (price units) of a fully-outside close from the boundary it exited through. */
function separationUnits(close, zone, unit) {
  const sep = close > zone.zoneHigh ? close - zone.zoneHigh : zone.zoneLow - close;
  return sep / unit;
}

/** Effective side implied by a role-log role (mirrors lineage.js effectiveSide, S3-C8). */
function sideOfRole(role) {
  return (role === 'support' || role === 'resistance_turned_support') ? 'support' : 'resistance';
}

/**
 * Role state as of session D: the latest role-log entry with date ≤ D. A flip is recorded on D
 * from D−1-close information, so it is known at D's open — ≤ D is point-in-time-safe and pairs
 * with the strictly-< D anchor the flip was derived from.
 */
export function roleStateAsOf(family, D) {
  let entry = null;
  for (const r of family.roleLog) {
    if (r.date <= D) entry = r; else break;
  }
  if (!entry) entry = family.roleLog[0];
  return { roleState: entry.role, side: sideOfRole(entry.role) };
}

/** Map familyId -> ascending snapshot timeline (the level's known positions over time). */
export function buildFamilySnapshots(registry) {
  const map = new Map();
  for (const sess of registry.sessions) {
    for (const snap of sess.snapshots) {
      if (!snap.familyId) continue;
      if (!map.has(snap.familyId)) map.set(snap.familyId, []);
      map.get(snap.familyId).push({
        date: snap.date,
        snapshotId: snap.snapshotId,
        tier: snap.tier,
        methods: snap.methods,
        firstTradableDate: snap.firstTradableDate,
        familyAnchor: snap.familyAnchor,
        centroid: snap.centroid,
      });
    }
  }
  for (const arr of map.values()) arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return map;
}

function checkpointAnchors(registry) {
  const m = new Map();
  const ck = registry.studyStartCheckpoint;
  if (ck && Array.isArray(ck.liveFamilies)) for (const f of ck.liveFamilies) m.set(f.familyId, f.anchor);
  return m;
}

/**
 * Anchor as of session D — committed (post-EMA) anchor from the latest snapshot with date
 * STRICTLY < D (A4: D's own snapshot is post-touch information). Fallbacks: study-start checkpoint
 * anchor (as of studyStart−1), else the founding centroid (family founded on D).
 */
export function anchorAsOfD(famSnaps, ckAnchors, familyId, D) {
  const arr = famSnaps.get(familyId) || [];
  let val = null;
  for (const s of arr) {
    if (s.date < D) val = s.familyAnchor; else break;
  }
  if (val != null) return val;
  if (ckAnchors.has(familyId)) return ckAnchors.get(familyId);
  return arr.length ? arr[0].centroid : null;
}

/** The level snapshot an event references: latest snapshot with date ≤ D (level as last known). */
function refSnapshotAsOf(famSnaps, familyId, D) {
  const arr = famSnaps.get(familyId) || [];
  let s = null;
  for (const x of arr) {
    if (x.date <= D) s = x; else break;
  }
  return s;
}

/**
 * Cross-level dedup clustering. Diameter-bounded (left-greedy over anchor-ascending items,
 * measured against the group's FIRST member) so every pair in a group is within maxGap — i.e.
 * "anchors within 0.5·u of each other" (parent §6.2), mirroring lib/level-sources.js:boundedGroups.
 */
function clusterByAnchor(items, maxGap) {
  const sorted = items.slice().sort((a, b) => (a.anchor - b.anchor) || (a.fid < b.fid ? -1 : 1));
  const groups = [];
  let cur = [];
  for (const it of sorted) {
    if (cur.length && (it.anchor - cur[0].anchor) <= maxGap) cur.push(it);
    else { if (cur.length) groups.push(cur); cur = [it]; }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

/** Corporate-action ex-dates = adjFactor discontinuities in the daily series. */
function corporateActionIndex(dailyByDate) {
  if (!dailyByDate) return null;
  const bars = [...dailyByDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  const ex = [];
  for (let i = 1; i < bars.length; i++) {
    const a = bars[i - 1].adjFactor, b = bars[i].adjFactor;
    if (a != null && b != null && a !== 0 && Math.abs(b / a - 1) > 1e-6) ex.push(i);
  }
  return { ex, dateToOrdinal: new Map(bars.map((b, i) => [b.date, i])) };
}
function corporateActionAdjacent(caIndex, D) {
  if (!caIndex || !caIndex.ex.length) return false;
  const ord = caIndex.dateToOrdinal.get(D);
  if (ord == null) return false;
  return caIndex.ex.some((o) => Math.abs(o - ord) <= CA_ADJ);
}

/** touchAt = the touch bar's open-label timestamp (UTC ISO from the bar's epoch seconds). */
function touchAtOf(bar) {
  return new Date(bar.epoch * 1000).toISOString();
}

function touchKey(t) { return `${t.timestamp}|${t.familyId}|${t.snapshotId}`; }
function mergeTouchHistories(a, b) {
  const seen = new Set(), out = [];
  for (const t of [...a, ...b]) {
    const k = touchKey(t);
    if (!seen.has(k)) { seen.add(k); out.push(t); }
  }
  out.sort((x, y) => (touchKey(x) < touchKey(y) ? -1 : touchKey(x) > touchKey(y) ? 1 : 0));
  return out;
}

// ── The detector ─────────────────────────────────────────────────────────────

/**
 * @param {object} args symbol, sector?, stratum?, registry, fiveMinByDate (Map date->{isFullDay,
 *   earlyClose, hasAuction, sessionCloseAdj, regular:[bar]}), dailyByDate?, studyStart?
 * @returns {{ symbol, events:[EventRecord], rejected, shadowed, episodes,
 *             dispositions:{touch,GAP_BREAK,RETIRED_MIDEPISODE} }}
 */
export function detectEvents(args) {
  const symbol = args.symbol;
  const sector = args.sector !== undefined ? args.sector : (SECTOR_MAP[symbol] || null);
  const stratum = args.stratum !== undefined ? args.stratum : null;
  const registry = args.registry;
  const fiveMinByDate = args.fiveMinByDate;
  const dailyByDate = args.dailyByDate || null;
  const studyStart = args.studyStart || CONFIG.range.studyStart;

  const famSnaps = buildFamilySnapshots(registry);
  const ckAnchors = checkpointAnchors(registry);
  const caIndex = corporateActionIndex(dailyByDate);
  const families = registry.families || {};
  const configVersion = registry.configVersion != null ? registry.configVersion : CONFIG.version;

  const lineageByDate = new Map();
  for (const ev of (registry.events || [])) {
    if (ev.type !== 'retirement' && ev.type !== 'merge') continue;
    if (!lineageByDate.has(ev.date)) lineageByDate.set(ev.date, []);
    lineageByDate.get(ev.date).push(ev);
  }

  const st = new Map();
  const stateOf = (fid) => {
    if (!st.has(fid)) {
      st.set(fid, {
        phase: 'ARMED', terminal: false, openEpisode: null, openedBar: null,
        probeCount: 0, currentlyInside: false, excursionMaxSepU: 0, fullSessionsOutside: 0,
        touchHistory: [],
      });
    }
    return st.get(fid);
  };

  const emitted = [];
  const counters = { rejected: 0, shadowed: 0, episodes: 0 };

  const finalize = (s, disposition, episodeEnd) => {
    const ep = s.openEpisode;
    if (ep && ep.record) {
      const r = ep.record;
      r.disposition = disposition;
      r.episodeEnd = episodeEnd; // ET date, or null if still open at run end
      r.probeCountInEpisode = s.probeCount;
      r.eventId = `${r.levelFamilyId}_ep${String(r.sequenceIndex).padStart(2, '0')}`;
      counters.rejected += Math.max(0, s.probeCount - 1); // re-entries suppressed as probes
    }
    s.phase = 'ARMED'; s.openEpisode = null; s.openedBar = null; s.probeCount = 0;
    s.currentlyInside = false; s.excursionMaxSepU = 0; s.fullSessionsOutside = 0;
  };

  const isActiveOn = (fid, D) => {
    const fam = families[fid];
    if (!fam) return false;
    if (fam.bornDate && fam.bornDate > D) return false;
    const term = fam.retiredDate || fam.mergedDate || null;
    if (term && term < D) return false; // terminal strictly before D
    return true;
  };

  // Open an episode for candidate c on `bar` (session ctx). shadowedIds===null → silent (dedup loser).
  const openEpisode = (c, bar, ctx, shadowedIds) => {
    const s = stateOf(c.fid);
    if (shadowedIds === null) {
      // Shadowed loser: episode state STILL advances (so later re-entries are probes) — no event.
      s.phase = 'OPEN'; s.openedBar = bar; s.openEpisode = { record: null, dropped: false };
      s.probeCount = 1; s.currentlyInside = true; s.excursionMaxSepU = 0; s.fullSessionsOutside = 0;
      counters.shadowed += 1;
      return;
    }
    const ref = refSnapshotAsOf(famSnaps, c.fid, ctx.D);
    if (!ref) return;                                             // no level to reference
    if (ref.firstTradableDate && ref.firstTradableDate > ctx.D) return; // lookahead guard (test 11)
    const seq = s.touchHistory.length;                           // 0-based event sequence index
    const touchAt = touchAtOf(bar);
    const record = {
      eventId: null,
      levelFamilyId: c.fid,
      levelSnapshotId: ref.snapshotId,
      symbol, sector, stratum,
      eventDate: ctx.D,
      side: c.side,
      roleState: c.roleState,
      sequenceIndex: seq,
      familyTier: ref.tier,
      methods: ref.methods,
      touchAt,
      atrDaily: ctx.atr,
      distanceUnit: ctx.unit,
      zoneLow: c.zone.zoneLow,
      zoneHigh: c.zone.zoneHigh,
      episodeStart: ctx.D,
      episodeEnd: null,
      probeCountInEpisode: 0,
      shadowedFamilyIds: shadowedIds,
      corporateActionAdjacent: corporateActionAdjacent(caIndex, ctx.D),
      halfDay: !!(ctx.five.earlyClose != null ? ctx.five.earlyClose : !ctx.five.isFullDay),
      eodSource: ctx.five.hasAuction ? 'auction' : 'fallback_1555',
      disposition: 'touch',
      configVersion,
    };
    s.phase = 'OPEN'; s.openedBar = bar;
    s.openEpisode = { record, dropped: false };
    s.probeCount = 1; s.currentlyInside = true; s.excursionMaxSepU = 0; s.fullSessionsOutside = 0;
    s.touchHistory.push({ timestamp: touchAt, familyId: c.fid, snapshotId: ref.snapshotId });
    emitted.push(s.openEpisode);
    counters.episodes += 1;
  };

  const emitGapBreak = (c, bar, ctx) => {
    const ref = refSnapshotAsOf(famSnaps, c.fid, ctx.D);
    if (!ref) return;
    if (ref.firstTradableDate && ref.firstTradableDate > ctx.D) return;
    const s = stateOf(c.fid);
    const record = {
      eventId: `${c.fid}_gap_${ctx.D}`,
      levelFamilyId: c.fid,
      levelSnapshotId: ref.snapshotId,
      symbol, sector, stratum,
      eventDate: ctx.D,
      side: c.side,
      roleState: c.roleState,
      sequenceIndex: s.touchHistory.length, // informational; not consumed (GAP_BREAK excluded from touch base)
      familyTier: ref.tier,
      methods: ref.methods,
      touchAt: touchAtOf(bar),
      atrDaily: ctx.atr,
      distanceUnit: ctx.unit,
      zoneLow: c.zone.zoneLow,
      zoneHigh: c.zone.zoneHigh,
      episodeStart: ctx.D,
      episodeEnd: ctx.D,
      probeCountInEpisode: 0,
      shadowedFamilyIds: [],
      corporateActionAdjacent: corporateActionAdjacent(caIndex, ctx.D),
      halfDay: !!(ctx.five.earlyClose != null ? ctx.five.earlyClose : !ctx.five.isFullDay),
      eodSource: ctx.five.hasAuction ? 'auction' : 'fallback_1555',
      disposition: 'GAP_BREAK',
      configVersion,
    };
    emitted.push({ record, dropped: false });
    // family stays ARMED — a later correct-side approach can still open a normal episode.
  };

  let prevSessionCloseAdj = null; // prior session's close — seeds the approach side (A3)

  for (const sess of registry.sessions) {
    const D = sess.date;
    if (D < studyStart) continue; // warmup gate (registry emits study-window only; asserted here)
    const unit = sess.unit;
    const five = fiveMinByDate.get ? fiveMinByDate.get(D) : fiveMinByDate[D];
    const ctx = { D, atr: sess.atr, unit, five };

    // 1) Lineage events dated D (retirements + merges), before bars.
    for (const ev of (lineageByDate.get(D) || [])) {
      if (ev.type === 'retirement') {
        const s = stateOf(ev.familyId);
        if (s.phase === 'OPEN') finalize(s, 'RETIRED_MIDEPISODE', D);
        s.terminal = true;
      } else if (ev.type === 'merge') {
        const A = stateOf(ev.survivorId), B = stateOf(ev.absorbedId);
        A.touchHistory = mergeTouchHistories(A.touchHistory, B.touchHistory);
        if (B.phase === 'OPEN') {
          if (A.phase !== 'OPEN') {
            A.phase = 'OPEN'; A.openEpisode = B.openEpisode; A.probeCount = B.probeCount;
            A.excursionMaxSepU = B.excursionMaxSepU; A.fullSessionsOutside = B.fullSessionsOutside;
            A.currentlyInside = B.currentlyInside; A.openedBar = null;
            if (A.openEpisode && A.openEpisode.record) A.openEpisode.record.levelFamilyId = ev.survivorId;
          } else if (B.openEpisode) {
            B.openEpisode.dropped = true; // survivor wins conflicts (lineage.js:293-296)
          }
          B.phase = 'ARMED'; B.openEpisode = null;
        }
        B.terminal = true;
      }
    }

    if (!five || !Array.isArray(five.regular) || !five.regular.length) {
      if (five && five.sessionCloseAdj != null) prevSessionCloseAdj = five.sessionCloseAdj;
      continue;
    }

    // 2) Candidate families active on D.
    const cand = [];
    for (const fid of Object.keys(families)) {
      if (!isActiveOn(fid, D)) continue;
      const anchor = anchorAsOfD(famSnaps, ckAnchors, fid, D);
      if (anchor == null) continue;
      const zone = episodeZone(anchor, unit);
      const { roleState, side } = roleStateAsOf(families[fid], D);
      const ref0 = refSnapshotAsOf(famSnaps, fid, D);
      cand.push({
        fid, anchor, zone, side, roleState,
        tier: ref0 ? ref0.tier : 'F1',
        approachPos: classifyPos(prevSessionCloseAdj, zone), // A3 seed: prior close vs D's zone
        touchedThisSession: false,
      });
    }

    // 3) Iterate bars ascending; drive the state machine (dedup at each opening bar).
    for (const bar of five.regular) {
      const opens = [];
      for (const c of cand) {
        const s = stateOf(c.fid);
        const inter = barIntersects(bar, c.zone);
        if (inter) c.touchedThisSession = true;
        if (s.phase === 'ARMED' && !s.terminal && inter && c.approachPos === correctOutsideSide(c.side)) {
          opens.push(c);
        }
      }
      if (opens.length) {
        for (const group of clusterByAnchor(opens, DEDUP_U * unit)) {
          if (group.length === 1) {
            openEpisode(group[0], bar, ctx, []);
          } else {
            const ordered = group.slice().sort((a, b) => {
              const ra = TIER_RANK[a.tier] || 0, rb = TIER_RANK[b.tier] || 0;
              if (ra !== rb) return rb - ra;                                    // highest tier
              const da = Math.abs(a.anchor - bar.adjClose), db = Math.abs(b.anchor - bar.adjClose);
              if (da !== db) return da - db;                                    // nearest anchor
              return a.fid < b.fid ? -1 : 1;                                    // elder family
            });
            const winner = ordered[0];
            const losers = ordered.slice(1);
            openEpisode(winner, bar, ctx, losers.map((l) => l.fid).sort());
            for (const l of losers) openEpisode(l, bar, ctx, null);
          }
        }
      }
      // OPEN families that did NOT just open on this bar → probes / separation.
      for (const c of cand) {
        const s = stateOf(c.fid);
        if (s.phase !== 'OPEN' || s.openedBar === bar) continue;
        if (barIntersects(bar, c.zone)) {
          if (!s.currentlyInside) s.probeCount += 1; // re-entry probe
          s.currentlyInside = true;
          s.excursionMaxSepU = 0; s.fullSessionsOutside = 0; // back inside → excursion resets
        } else {
          s.currentlyInside = false;
          const sepU = separationUnits(bar.adjClose, c.zone, unit);
          if (sepU > s.excursionMaxSepU) s.excursionMaxSepU = sepU;
        }
      }
      // Advance the approach side: most recent close STRICTLY before the next bar (A3).
      for (const c of cand) c.approachPos = classifyPos(bar.adjClose, c.zone);
    }

    // 4) GAP_BREAK: ARMED families where price gapped over the level without trading in it.
    for (const c of cand) {
      const s = stateOf(c.fid);
      if (s.phase !== 'ARMED' || s.terminal || c.touchedThisSession) continue;
      const first = five.regular[0];
      const wasOutsideCorrect = classifyPos(prevSessionCloseAdj, c.zone) === correctOutsideSide(c.side);
      const gappedThrough = c.side === 'support'
        ? first.adjHigh < c.zone.zoneLow    // was above → opened entirely below support
        : first.adjLow > c.zone.zoneHigh;   // was below → opened entirely above resistance
      if (wasOutsideCorrect && gappedThrough) emitGapBreak(c, first, ctx);
    }

    // 5) Session-end close evaluation.
    for (const c of cand) {
      const s = stateOf(c.fid);
      if (s.phase !== 'OPEN') continue;
      if (c.touchedThisSession) {
        s.fullSessionsOutside = 0;
      } else {
        s.fullSessionsOutside += 1;
        if (s.excursionMaxSepU >= SEP_UNITS && s.fullSessionsOutside >= MIN_OUT) finalize(s, 'touch', D);
      }
    }

    if (five.sessionCloseAdj != null) prevSessionCloseAdj = five.sessionCloseAdj;
  }

  // 6) Episodes still open at run end are genuinely ongoing → episodeEnd stays null.
  for (const s of st.values()) if (s.phase === 'OPEN') finalize(s, 'touch', null);

  const events = emitted.filter((e) => !e.dropped && e.record).map((e) => e.record);
  events.sort((a, b) =>
    (a.touchAt < b.touchAt ? -1 : a.touchAt > b.touchAt ? 1
      : a.levelFamilyId < b.levelFamilyId ? -1 : a.levelFamilyId > b.levelFamilyId ? 1
        : a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0));
  const dispositions = { touch: 0, GAP_BREAK: 0, RETIRED_MIDEPISODE: 0 };
  for (const e of events) dispositions[e.disposition] = (dispositions[e.disposition] || 0) + 1;

  return { symbol, events, rejected: counters.rejected, shadowed: counters.shadowed, episodes: counters.episodes, dispositions };
}
