// api/_utils/liveDraftFormation.test.js
//
// Competitive Live Draft — Phase 1 (formation layer) battery:
//   (A) nextSlotFireInstant — DST-safe slot→instant resolution (winter/EST and
//       summer/EDT of the SAME slot, and the DST-transition week).
//   (B) deriveBattleStartWeek — the Monday anchor: the three founder cases
//       (Sun→next-day Mon, Wed→following Mon, Mon-pre-open→same Mon), a holiday
//       Monday (anchor advances to the week's first trading day), and a
//       DST-boundary anchor (EST 14:30Z vs EDT 13:30Z).
//   (C) claim/release transactions — create-once, join, idempotent double-claim,
//       slot_full, delete-on-last-release, non-last release, post-fire rejection.
//   (D) CONCURRENCY — a genuine optimistic-concurrency race (interleave hook):
//       last-seat release vs a new claim, both orders, proving no ghost group
//       and no double-create.
//   (E) getSlotOccupancy — per-slot counts + names for the picker.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// liveDraftFormation.js IS the runtime guard that its transitive api/ -> src/
// import surface stays Node-clean. Never mock that import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getEtParts } from './tournamentTime.js';
import {
  nextSlotFireInstant,
  deriveBattleStartWeek,
  effectiveBattleAnchor,
  slotGroupId,
  claimSlotSeat,
  releaseSlotSeat,
  getSlotOccupancy,
  SLOT_SENTINEL_PREFIX,
} from './liveDraftFormation.js';
import { LIVE_DRAFT_SLOTS, slotById } from '../../src/config/liveDraftSlots.js';
import { GROUP_STATUS, GROUP_SIZE, TOURNAMENT_GROUPS_COLLECTION, BASELINE_POLICY } from '../../src/constants/leagueTournament.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ==================== IN-MEMORY FIRESTORE (concurrency-capable) ====================
//
// Extends the shared makeDb idiom with (1) tx.delete and (2) OPTIMISTIC
// CONCURRENCY: each transaction records the versions of the docs it reads and,
// on commit, retries the whole fn if any read doc changed underneath it (real
// Firestore semantics). `setInterleave(fn)` injects a one-shot committed writer
// AFTER the target txn's first read pass but BEFORE its commit — the vehicle for
// a true last-seat race.

function applyDotPathUpdate(target, updates) {
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split('.');
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] == null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
}

function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const versions = new Map();
  const writeLog = [];
  let interleave = null;

  const ver = (p) => versions.get(p) ?? 0;
  const bump = (p) => versions.set(p, ver(p) + 1);
  const snap = (p) => ({ exists: store.has(p), id: p.split('/').pop(), data: () => structuredClone(store.get(p)) });

  function makeDocRef(path) {
    return {
      path,
      get: async () => snap(path),
      set: async (data) => { store.set(path, structuredClone(data)); bump(path); writeLog.push(['set', path]); },
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
  }
  function makeCollection(prefix) {
    return {
      doc: (id) => makeDocRef(`${prefix}/${id}`),
      // Query support for the one-competitive-game guard (array-contains) + any
      // equality read; direct children of `prefix` only.
      where: (field, op, value) => ({
        get: async () => {
          const docs = [];
          for (const [path, data] of store.entries()) {
            if (!path.startsWith(`${prefix}/`) || path.slice(prefix.length + 1).includes('/')) continue;
            const fv = data[field];
            const match = op === 'array-contains' ? (Array.isArray(fv) && fv.includes(value)) : fv === value;
            if (match) docs.push({ id: path.split('/').pop(), data: () => structuredClone(data) });
          }
          return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
        },
      }),
    };
  }

  const db = {
    collection: (name) => makeCollection(name),
    runTransaction: async (fn) => {
      for (let attempt = 0; attempt < 8; attempt++) {
        const reads = new Map();
        const staged = [];
        const tx = {
          get: async (ref) => { reads.set(ref.path, ver(ref.path)); return snap(ref.path); },
          set: (ref, data) => staged.push(['set', ref.path, data]),
          update: (ref, patch) => staged.push(['update', ref.path, patch]),
          delete: (ref) => staged.push(['delete', ref.path]),
        };
        const result = await fn(tx);
        if (attempt === 0 && interleave) { const h = interleave; interleave = null; await h(); }
        let conflict = false;
        for (const [p, v] of reads) { if (ver(p) !== v) { conflict = true; break; } }
        if (conflict) continue; // a read changed under us — retry the whole fn
        for (const [op, p, data] of staged) {
          if (op === 'set') store.set(p, structuredClone(data));
          else if (op === 'update') { const d = store.get(p); if (d === undefined) throw new Error(`tx.update on missing ${p}`); applyDotPathUpdate(d, data); }
          else if (op === 'delete') store.delete(p);
          bump(p);
          writeLog.push([`tx.${op}`, p]);
        }
        return result;
      }
      throw new Error('transaction retries exhausted');
    },
  };
  return { db, store, writeLog, setInterleave: (fn) => { interleave = fn; } };
}

const groupPath = (groupId) => `${TOURNAMENT_GROUPS_COLLECTION}/${groupId}`;

// A Monday 8am EDT — before that week's Wed-7pm slot fire; every claim test uses
// the wed-1900 occurrence on 2026-07-08 (fire 2026-07-08T23:00Z).
const NOW = new Date('2026-07-06T12:00:00.000Z');
const WED_GROUP_ID = slotGroupId('wed-1900', '2026-07-08');

// ==================== (A) SLOT → INSTANT (DST-safe) ====================

describe('nextSlotFireInstant — DST-safe slot resolution', () => {
  it('config: the four V1 slots are present and well-shaped', () => {
    expect(LIVE_DRAFT_SLOTS.map((s) => s.id)).toEqual(['wed-1900', 'sat-1200', 'sun-1900', 'mon-0845']);
    for (const s of LIVE_DRAFT_SLOTS) {
      expect(typeof s.hourEt).toBe('number');
      expect(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).toContain(s.weekday);
    }
    expect(slotById('mon-0845')).toMatchObject({ hourEt: 8, minuteEt: 45 });
  });

  it('WINTER/EST: Wed 7pm ET resolves to 00:00 UTC (next day)', () => {
    const { fireIso, fireEtDate } = nextSlotFireInstant(slotById('wed-1900'), new Date('2026-02-04T12:00:00.000Z'));
    expect(fireIso).toBe('2026-02-05T00:00:00.000Z');
    expect(fireEtDate).toBe('2026-02-04');
    const p = getEtParts(new Date(fireIso));
    expect(p.weekday).toBe('Wed');
    expect(p.minutes).toBe(19 * 60); // 7:00pm ET
  });

  it('SUMMER/EDT: the SAME slot resolves to 23:00 UTC (same day) — DST did not shift the ET wall clock', () => {
    const { fireIso, fireEtDate } = nextSlotFireInstant(slotById('wed-1900'), new Date('2026-07-08T12:00:00.000Z'));
    expect(fireIso).toBe('2026-07-08T23:00:00.000Z');
    expect(fireEtDate).toBe('2026-07-08');
    const p = getEtParts(new Date(fireIso));
    expect(p.weekday).toBe('Wed');
    expect(p.minutes).toBe(19 * 60); // still 7:00pm ET — different UTC, same ET
  });

  it('DST-TRANSITION WEEK: the Wed either side of the Mar 8 2026 spring-forward each land at 7pm ET', () => {
    const before = nextSlotFireInstant(slotById('wed-1900'), new Date('2026-03-02T12:00:00.000Z')); // → Wed Mar 4 (EST)
    const after = nextSlotFireInstant(slotById('wed-1900'), new Date('2026-03-09T12:00:00.000Z'));  // → Wed Mar 11 (EDT)
    expect(before.fireIso).toBe('2026-03-05T00:00:00.000Z'); // EST: 7pm → 00:00 UTC next day
    expect(after.fireIso).toBe('2026-03-11T23:00:00.000Z');  // EDT: 7pm → 23:00 UTC same day
    for (const iso of [before.fireIso, after.fireIso]) {
      const p = getEtParts(new Date(iso));
      expect(p.weekday).toBe('Wed');
      expect(p.minutes).toBe(19 * 60);
    }
  });

  it('always returns a STRICTLY FUTURE occurrence (never the slot that just passed)', () => {
    // 8:00pm ET Wed — one hour AFTER this week's 7pm fire → next week's Wed.
    const { fireEtDate } = nextSlotFireInstant(slotById('wed-1900'), new Date('2026-07-09T00:00:00.000Z'));
    expect(fireEtDate).toBe('2026-07-15'); // the following Wednesday
  });
});

// ==================== (B) battleStartWeek (Monday anchor) ====================

describe('deriveBattleStartWeek — the next Monday-open at-or-after the slot', () => {
  it('FOUNDER CASE 1 — Sun 7pm → next-day Monday', () => {
    const b = deriveBattleStartWeek('2026-07-12T23:00:00.000Z'); // Sun Jul 12 7pm EDT
    expect(b.mondayEtDate).toBe('2026-07-13');
    expect(b.anchorEtDate).toBe('2026-07-13');
    expect(b.anchorIso).toBe('2026-07-13T13:30:00.000Z'); // 9:30 EDT
  });

  it('FOUNDER CASE 2 — Wed 7pm → the FOLLOWING Monday', () => {
    const b = deriveBattleStartWeek('2026-07-08T23:00:00.000Z'); // Wed Jul 8 7pm EDT
    expect(b.mondayEtDate).toBe('2026-07-13');
    expect(b.anchorEtDate).toBe('2026-07-13');
  });

  it('FOUNDER CASE 3 — Mon 8:45am (pre-open) → that SAME Monday', () => {
    const b = deriveBattleStartWeek('2026-07-13T12:45:00.000Z'); // Mon Jul 13 8:45am EDT
    expect(b.mondayEtDate).toBe('2026-07-13');
    expect(b.anchorEtDate).toBe('2026-07-13');
  });

  it('Monday at/after the 9:30 open → the NEXT Monday (general rule, not a V1 slot)', () => {
    const b = deriveBattleStartWeek('2026-07-13T14:00:00.000Z'); // Mon Jul 13 10:00am EDT
    expect(b.mondayEtDate).toBe('2026-07-20');
  });

  it('HOLIDAY Monday — anchor advances to the week’s first trading day (Memorial Day 2026-05-25 → Tue 05-26)', () => {
    const b = deriveBattleStartWeek('2026-05-20T23:00:00.000Z'); // Wed May 20 7pm EDT → Mon May 25 (Memorial Day)
    expect(b.mondayEtDate).toBe('2026-05-25');
    expect(b.anchorEtDate).toBe('2026-05-26');
    expect(b.anchorIso).toBe('2026-05-26T13:30:00.000Z'); // 9:30 EDT
  });

  it('DST: a WINTER anchor is 9:30 EST (14:30Z), not EDT (13:30Z)', () => {
    const b = deriveBattleStartWeek('2026-02-05T00:00:00.000Z'); // Wed Feb 4 7pm EST → Mon Feb 9
    expect(b.mondayEtDate).toBe('2026-02-09');
    expect(b.anchorIso).toBe('2026-02-09T14:30:00.000Z'); // 9:30 EST
    expect(getEtParts(new Date(b.anchorIso)).minutes).toBe(9 * 60 + 30);
  });
});

// ==================== (B2) effectiveBattleAnchor — stale-anchor guard ====================

describe('effectiveBattleAnchor — re-derive a PAST stamped anchor, keep a current one', () => {
  const wk = (anchorEtDate) => ({ battleStartWeek: { mondayEtDate: anchorEtDate, anchorEtDate, anchorIso: `${anchorEtDate}T13:30:00.000Z` } });

  it('a FUTURE stamped anchor is used unchanged', () => {
    const r = effectiveBattleAnchor(wk('2026-07-20'), new Date('2026-07-08T23:00:00.000Z'));
    expect(r).toMatchObject({ anchorEtDate: '2026-07-20', restamped: false });
  });

  it('TODAY’s Monday anchor is NOT stale — inline path unchanged', () => {
    // now is that same Monday pre-open; anchorEtDate === today → not stale
    const r = effectiveBattleAnchor(wk('2026-07-13'), new Date('2026-07-13T12:45:00.000Z'));
    expect(r).toMatchObject({ anchorEtDate: '2026-07-13', restamped: false });
  });

  it('a PAST stamped anchor is RE-DERIVED to the next Monday-open at-or-after now', () => {
    // stamped Monday 2026-07-06 is in the past when now is Wed 2026-07-15
    const r = effectiveBattleAnchor(wk('2026-07-06'), new Date('2026-07-15T23:00:00.000Z'));
    expect(r.restamped).toBe(true);
    expect(r.anchorEtDate).toBe('2026-07-20'); // the following Monday
    expect(r.battleStartWeek.mondayEtDate).toBe('2026-07-20');
  });

  it('a MISSING anchor is re-derived (never silently defaulted)', () => {
    const r = effectiveBattleAnchor({}, new Date('2026-07-15T23:00:00.000Z'));
    expect(r.restamped).toBe(true);
    expect(r.anchorEtDate).toBe('2026-07-20');
  });
});

// ==================== (C) CLAIM / RELEASE (transactional) ====================

const sentinel = (code) => new RegExp(`^${SLOT_SENTINEL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${code}$`);

describe('claimSlotSeat / releaseSlotSeat — transactional seat lifecycle', () => {
  it('first claim creates the slot group EXACTLY ONCE, stamped self-sufficiently', async () => {
    const { db, store } = makeDb();
    const r = await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', displayName: 'Ada', now: NOW });

    expect(r).toMatchObject({ groupId: WED_GROUP_ID, created: true, joined: false, humanCount: 1 });
    expect(r.scheduledDraftAt).toBe('2026-07-08T23:00:00.000Z');
    expect(r.battleStartWeek.mondayEtDate).toBe('2026-07-13');

    // exactly one doc, at the deterministic id
    const paths = [...store.keys()];
    expect(paths).toEqual([groupPath(WED_GROUP_ID)]);

    const g = store.get(groupPath(WED_GROUP_ID));
    expect(g.status).toBe(GROUP_STATUS.FORMING);
    expect(g.isLiveDraft).toBe(true);
    expect(g.isTraining).toBeUndefined(); // competitive, never training
    expect(g.groupMembers).toEqual(['userA']);
    expect(g.players).toEqual([{ odUserId: 'userA', picks: [] }]);
    expect(g.players.length).toBeLessThan(GROUP_SIZE); // humans-only pre-fire → auto-excluded from the sweep
    expect(g.seatNames).toEqual({ userA: 'Ada' });
    expect(g.scheduledDraftAt).toBe('2026-07-08T23:00:00.000Z');
    expect(g.userPool).toEqual([]); // deferred to fire (Phase 2)
    expect(g.baselinePolicy).toBe(BASELINE_POLICY.CANONICAL_OPEN); // LEAGUE_CANONICAL_OPEN_CAPTURE on (founder-intentional) → round stamped canonical_open at formation
  });

  it('subsequent claims JOIN the same group up to four seats', async () => {
    const { db, store } = makeDb();
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    const r2 = await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userB', displayName: 'Bo', now: NOW });
    expect(r2).toMatchObject({ groupId: WED_GROUP_ID, created: false, joined: true, humanCount: 2 });

    const g = store.get(groupPath(WED_GROUP_ID));
    expect(g.groupMembers).toEqual(['userA', 'userB']);
    expect(g.seatNames).toEqual({ userA: null, userB: 'Bo' });
    // still one doc — the join did not create a second
    expect([...store.keys()]).toEqual([groupPath(WED_GROUP_ID)]);
  });

  it('double-claim of one seat is idempotent (no second seat)', async () => {
    const { db, store } = makeDb();
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    const again = await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    expect(again).toMatchObject({ alreadyClaimed: true, created: false, joined: false, humanCount: 1 });
    expect(store.get(groupPath(WED_GROUP_ID)).groupMembers).toEqual(['userA']);
  });

  it('a fifth distinct human is rejected — slot_full', async () => {
    const { db } = makeDb();
    for (const u of ['userA', 'userB', 'userC', 'userD']) {
      await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: u, now: NOW });
    }
    await expect(claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userE', now: NOW }))
      .rejects.toThrow(sentinel('slot_full'));
  });

  it('a full 4-human FORMING slot group still carries isLiveDraft (the Monday-pipeline guard key)', async () => {
    const { db, store } = makeDb();
    for (const u of ['userA', 'userB', 'userC', 'userD']) {
      await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: u, now: NOW });
    }
    const g = store.get(groupPath(WED_GROUP_ID));
    expect(g.players.length).toBe(GROUP_SIZE); // passes the size filter…
    expect(g.isLiveDraft).toBe(true);          // …so the guard excludes it by this field
    expect(g.status).toBe(GROUP_STATUS.FORMING);
  });

  it('unknown slot id is rejected', async () => {
    const { db } = makeDb();
    await expect(claimSlotSeat(db, { slotId: 'nope', odUserId: 'userA', now: NOW }))
      .rejects.toThrow(sentinel('unknown_slot'));
  });

  it('release frees a seat; a non-last release does NOT delete the group', async () => {
    const { db, store } = makeDb();
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userB', now: NOW });
    const r = await releaseSlotSeat(db, WED_GROUP_ID, { odUserId: 'userA', now: NOW });
    expect(r).toMatchObject({ released: true, deleted: false, humanCount: 1 });
    const g = store.get(groupPath(WED_GROUP_ID));
    expect(g.groupMembers).toEqual(['userB']);
    expect(g.seatNames).toEqual({ userB: null });
  });

  it('the LAST human releasing DELETES the group (0 humans = never materializes)', async () => {
    const { db, store } = makeDb();
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    const r = await releaseSlotSeat(db, WED_GROUP_ID, { odUserId: 'userA', now: NOW });
    expect(r).toMatchObject({ released: true, deleted: true, humanCount: 0 });
    expect(store.has(groupPath(WED_GROUP_ID))).toBe(false); // gone — structural expiry
  });

  it('releasing a non-member / already-gone group is an idempotent no-op', async () => {
    const { db } = makeDb();
    const gone = await releaseSlotSeat(db, WED_GROUP_ID, { odUserId: 'userA', now: NOW });
    expect(gone).toMatchObject({ released: false, reason: 'group_not_found' });

    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    const notMine = await releaseSlotSeat(db, WED_GROUP_ID, { odUserId: 'stranger', now: NOW });
    expect(notMine).toMatchObject({ released: false, reason: 'not_a_member' });
  });

  it('claim/release after fire are rejected — draft_already_started', async () => {
    const { db, store } = makeDb();
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    // simulate the fire cron moving the group into DRAFTING
    store.get(groupPath(WED_GROUP_ID)).status = GROUP_STATUS.DRAFTING;
    await expect(claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userB', now: NOW }))
      .rejects.toThrow(sentinel('draft_already_started'));
    await expect(releaseSlotSeat(db, WED_GROUP_ID, { odUserId: 'userA', now: NOW }))
      .rejects.toThrow(sentinel('draft_already_started'));
  });
});

// ============ (C2) baseLayerWeek / one-game guard / release lock (P5 fixes) ============

describe('baseLayerWeek is the BATTLE week, not the claim week (finding #1)', () => {
  it('a Wed claim files the pod under the following Monday’s ISO week', async () => {
    const { db, store } = makeDb();
    // claim on Mon 2026-07-06 (ISO week W28); battle starts Mon 2026-07-13 (W29).
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    const g = store.get(groupPath(WED_GROUP_ID));
    expect(g.battleStartWeek.mondayEtDate).toBe('2026-07-13');
    expect(g.baseLayerWeek).toBe('2026-W29');    // the week it PLAYS
    expect(g.baseLayerWeek).not.toBe('2026-W28'); // not the claim week (the old bug)
  });
});

describe('per-battle-week one-game guard (finding #3)', () => {
  // wed-1900 claimed at NOW (Mon 2026-07-06) derives battle week 2026-W29.
  const seedGroup = (store, id, baseLayerWeek, extra = {}) => store.set(groupPath(id), {
    status: GROUP_STATUS.BATTLE, baseLayerWeek, groupMembers: ['userA'],
    players: [{ odUserId: 'userA', picks: [] }], ...extra,
  });

  it('(a) a same-battle-week REGULAR (non-training) pod blocks the slot claim', async () => {
    const { db, store } = makeDb();
    seedGroup(store, 'reg-w29', '2026-W29'); // userA already plays 2026-W29
    await expect(claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW }))
      .rejects.toThrow(sentinel('already_in_competitive'));
  });

  it('(b) a current-week pod does NOT block a NEXT-week slot claim', async () => {
    const { db, store } = makeDb();
    seedGroup(store, 'reg-w28', '2026-W28'); // userA plays THIS week; the slot battles next week (W29)
    const r = await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    expect(r).toMatchObject({ created: true, humanCount: 1 }); // allowed — different battle week
  });

  it('a same-battle-week live-draft pod also blocks (wed + sun both play W29)', async () => {
    const { db } = makeDb();
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    await expect(claimSlotSeat(db, { slotId: 'sun-1900', odUserId: 'userA', now: NOW }))
      .rejects.toThrow(sentinel('already_in_competitive'));
  });

  it('a TRAINING pod in the same week never blocks (isTraining excluded)', async () => {
    const { db, store } = makeDb();
    seedGroup(store, 'train-w29', '2026-W29', { isTraining: true });
    const r = await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    expect(r).toMatchObject({ created: true, humanCount: 1 });
  });

  it('the idempotent re-claim of the SAME slot is allowed (excluded by id)', async () => {
    const { db } = makeDb();
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    const again = await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    expect(again).toMatchObject({ alreadyClaimed: true });
  });

  it('does not block a DIFFERENT user', async () => {
    const { db } = makeDb();
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    const r = await claimSlotSeat(db, { slotId: 'sun-1900', odUserId: 'userB', now: NOW });
    expect(r).toMatchObject({ created: true, humanCount: 1 });
  });
});

describe('release is locked once the fire instant arrives (finding #4)', () => {
  it('rejects a release when scheduledDraftAt <= now, even while still FORMING', async () => {
    const { db, store } = makeDb();
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });
    // now is AT the fire instant (2026-07-08T23:00Z) but the fire cron has not yet
    // moved the status — the seat is locked to close the release-vs-fire window.
    const atFire = new Date('2026-07-08T23:00:00.000Z');
    await expect(releaseSlotSeat(db, WED_GROUP_ID, { odUserId: 'userA', now: atFire }))
      .rejects.toThrow(sentinel('draft_already_started'));
    expect(store.get(groupPath(WED_GROUP_ID)).groupMembers).toEqual(['userA']); // seat intact
  });
});

// ==================== (D) CONCURRENCY — the last-seat race ====================

describe('concurrent last-seat release vs new claim (fresh-read transaction)', () => {
  it('release-then-claim commit order: the group survives with the claimer — no ghost', async () => {
    const { db, store, setInterleave } = makeDb();
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });

    // While userA releases the LAST seat (would delete), userB's claim commits first.
    setInterleave(async () => {
      await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userB', now: NOW });
    });
    const r = await releaseSlotSeat(db, WED_GROUP_ID, { odUserId: 'userA', now: NOW });

    // release re-ran on the conflict: userB is now present, so it did NOT delete.
    expect(r).toMatchObject({ released: true, deleted: false, humanCount: 1 });
    expect(store.has(groupPath(WED_GROUP_ID))).toBe(true);
    expect(store.get(groupPath(WED_GROUP_ID)).groupMembers).toEqual(['userB']);
  });

  it('claim-then-release(delete) commit order: the claim recreates fresh — no double-create, no ghost', async () => {
    const { db, store, setInterleave } = makeDb();
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', now: NOW });

    // While userB claims (would join userA's group), userA's last-seat release deletes it first.
    setInterleave(async () => {
      await releaseSlotSeat(db, WED_GROUP_ID, { odUserId: 'userA', now: NOW });
    });
    const r = await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userB', now: NOW });

    // claim re-ran on the conflict: the doc was gone, so it CREATED fresh with just userB.
    expect(r).toMatchObject({ groupId: WED_GROUP_ID, created: true, humanCount: 1 });
    expect(store.get(groupPath(WED_GROUP_ID)).groupMembers).toEqual(['userB']);
    // exactly one doc — the race did not double-create
    expect([...store.keys()]).toEqual([groupPath(WED_GROUP_ID)]);
  });
});

// ==================== (E) OCCUPANCY (picker feed) ====================

describe('getSlotOccupancy — per-slot counts + names', () => {
  it('reports counts and seated names for the current occurrence of each slot', async () => {
    const { db } = makeDb();
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userA', displayName: 'Ada', now: NOW });
    await claimSlotSeat(db, { slotId: 'wed-1900', odUserId: 'userB', displayName: 'Bo', now: NOW });

    const rows = await getSlotOccupancy(db, NOW);
    expect(rows.map((r) => r.slotId)).toEqual(['wed-1900', 'sat-1200', 'sun-1900', 'mon-0845']);

    const wed = rows.find((r) => r.slotId === 'wed-1900');
    expect(wed.humanCount).toBe(2);
    expect(wed.isFull).toBe(false);
    expect(wed.seats).toEqual([
      { odUserId: 'userA', name: 'Ada' },
      { odUserId: 'userB', name: 'Bo' },
    ]);
    expect(wed.scheduledDraftAt).toBe('2026-07-08T23:00:00.000Z');

    // an unclaimed slot reads zero without a group existing
    const sat = rows.find((r) => r.slotId === 'sat-1200');
    expect(sat.humanCount).toBe(0);
    expect(sat.seats).toEqual([]);
  });
});
