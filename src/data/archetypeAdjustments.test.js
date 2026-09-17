// src/data/archetypeAdjustments.test.js
//
// Archetype-Integrity Phase A tests. This file's import of
// ./archetypeAdjustments.js IS the BUILD_RULES §4 dependency-surface guard:
// it runs in the Node (vitest) env and would explode if a browser-only dep ever
// entered the module's graph. NEVER mock the module.

import { describe, it, expect } from 'vitest';
import ARCHETYPE_ADJUSTMENTS_DEFAULT, {
  ARCHETYPE_ADJUSTMENTS,
  ARCHETYPE_KEYS,
  PASS_THROUGH_SLOTS,
  PASS_THROUGH_SECTORS,
  getArchetypeZones,
  getAllowlist,
  isValidAdjustmentId,
  getCanonicalText,
  getCautiousRegister,
} from './archetypeAdjustments.js';

const SIX_KEYS = ['momentum_chaser', 'contrarian', 'degen', 'guardian', 'diversifier', 'analyst'];
const ID_PREFIX = {
  momentum_chaser: 'TF',
  contrarian: 'CN',
  degen: 'SP',
  guardian: 'CP',
  diversifier: 'DV',
  analyst: 'FI',
};
const EXPECTED_COUNTS = { momentum_chaser: 8, contrarian: 8, degen: 7, guardian: 8, diversifier: 7, analyst: 8 };
const ZONE_KEYS = ['immutableCore', 'protectedBias', 'tunableExecution', 'outOfScopeUserLever'];

// Cheap LINT only (not the proof): per-archetype phrases that would smell of a
// core reversal if they appeared in a `canonical`. The actual INVARIANT is the
// typed `policy.coreAlignment` assertion below.
const REVERSAL_LINT = {
  momentum_chaser: ['fade', 'beaten-down', 'contrarian', 'go defensive', 'short the'],
  contrarian: ['chase strength', 'breakout', 'momentum leader', 'remove the stop'],
  degen: ['stable', 'low-volatility', 'boring', 'blue-chip', 'play it safe'],
  guardian: ['high-beta', 'junk', 'trade fast', 'chase a mover'],
  diversifier: ['all-in', 'concentrate into one', 'single theme', 'pile into'],
  analyst: ['junk', 'ignore fundamentals', 'hot chart', 'drop the quality'],
};

describe('archetypeAdjustments — module shape', () => {
  it('default export equals the named ARCHETYPE_ADJUSTMENTS', () => {
    expect(ARCHETYPE_ADJUSTMENTS_DEFAULT).toBe(ARCHETYPE_ADJUSTMENTS);
  });

  it('has exactly the six canonical code-ids', () => {
    expect(Object.keys(ARCHETYPE_ADJUSTMENTS).sort()).toEqual([...SIX_KEYS].sort());
    expect([...ARCHETYPE_KEYS].sort()).toEqual([...SIX_KEYS].sort());
  });

  it('every archetype has all four prose zones (non-empty)', () => {
    for (const key of SIX_KEYS) {
      const { zones } = ARCHETYPE_ADJUSTMENTS[key];
      expect(Object.keys(zones).sort()).toEqual([...ZONE_KEYS].sort());
      for (const z of ZONE_KEYS) {
        expect(typeof zones[z]).toBe('string');
        expect(zones[z].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('PASS_THROUGH_SLOTS are the three tier slots; PASS_THROUGH_SECTORS is reserved/empty in V1', () => {
    expect(PASS_THROUGH_SLOTS).toEqual(['Star', 'Core', 'Support']);
    // ADOPT #1: generic scoped-emphasis is cut from V1, so the sector enum is unused/empty.
    expect(PASS_THROUGH_SECTORS).toEqual([]);
  });
});

describe('archetypeAdjustments — allowlist inventory', () => {
  it('totals exactly 46 adjustment ids', () => {
    const total = SIX_KEYS.reduce((n, k) => n + ARCHETYPE_ADJUSTMENTS[k].adjustments.length, 0);
    expect(total).toBe(46);
  });

  it('each archetype has its expected id count and correctly-prefixed, unique ids', () => {
    const allIds = new Set();
    for (const key of SIX_KEYS) {
      const list = ARCHETYPE_ADJUSTMENTS[key].adjustments;
      expect(list.length).toBe(EXPECTED_COUNTS[key]);
      for (const a of list) {
        expect(a.id.startsWith(`${ID_PREFIX[key]}-`)).toBe(true);
        expect(typeof a.canonical).toBe('string');
        expect(a.canonical.trim().length).toBeGreaterThan(0);
        expect(allIds.has(a.id)).toBe(false); // globally unique
        allIds.add(a.id);
      }
    }
    expect(allIds.size).toBe(46);
  });
});

describe('archetypeAdjustments — typed policy INVARIANT (#8: proof, not verbs)', () => {
  it('every adjustment carries a fully-typed policy from the allowed vocab', () => {
    for (const key of SIX_KEYS) {
      for (const a of ARCHETYPE_ADJUSTMENTS[key].adjustments) {
        const p = a.policy;
        expect(p, `${a.id} missing policy`).toBeTruthy();
        expect(['lower', 'higher', 'neutral']).toContain(p.riskDirection);
        expect(['tighter', 'wider', 'neutral']).toContain(p.concentrationDirection);
        expect(['longer', 'shorter', 'neutral']).toContain(p.timeHorizonDirection);
        expect(typeof p.forbiddenOpposite).toBe('string');
        expect(p.forbiddenOpposite.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('INVARIANT: no adjustment reverses its core — coreAlignment is reinforces|neutral, NEVER reverses', () => {
    for (const key of SIX_KEYS) {
      for (const a of ARCHETYPE_ADJUSTMENTS[key].adjustments) {
        expect(['reinforces', 'neutral'], `${a.id} coreAlignment`).toContain(a.policy.coreAlignment);
        expect(a.policy.coreAlignment).not.toBe('reverses');
      }
    }
  });
});

describe('archetypeAdjustments — denylist LINT (cheap, not the guarantee)', () => {
  it('no canonical text contains its archetype reversal phrases', () => {
    for (const key of SIX_KEYS) {
      for (const a of ARCHETYPE_ADJUSTMENTS[key].adjustments) {
        const lc = a.canonical.toLowerCase();
        for (const banned of REVERSAL_LINT[key]) {
          expect(lc.includes(banned), `${a.id} canonical contains banned "${banned}"`).toBe(false);
        }
      }
    }
  });
});

describe('archetypeAdjustments — helpers + the #4 no-fallback-on-write rule', () => {
  it('getArchetypeZones falls back to analyst for an unknown code-id (DISPLAY only)', () => {
    expect(getArchetypeZones('momentum_chaser')).toBe(ARCHETYPE_ADJUSTMENTS.momentum_chaser.zones);
    expect(getArchetypeZones('does_not_exist')).toBe(ARCHETYPE_ADJUSTMENTS.analyst.zones);
    expect(getArchetypeZones(undefined)).toBe(ARCHETYPE_ADJUSTMENTS.analyst.zones);
  });

  it('getAllowlist NEVER falls back — unknown/missing code-id yields []', () => {
    expect(getAllowlist('diversifier').length).toBe(7);
    expect(getAllowlist('does_not_exist')).toEqual([]);
    expect(getAllowlist(undefined)).toEqual([]);
    // critical: an unknown archetype must NOT inherit analyst's allowlist (#4)
    expect(getAllowlist('does_not_exist')).not.toEqual(ARCHETYPE_ADJUSTMENTS.analyst.adjustments);
  });

  it('isValidAdjustmentId is archetype-scoped and rejects cross-archetype ids', () => {
    expect(isValidAdjustmentId('diversifier', 'DV-01')).toBe(true);
    expect(isValidAdjustmentId('guardian', 'DV-01')).toBe(false); // cross-archetype
    expect(isValidAdjustmentId('does_not_exist', 'FI-01')).toBe(false); // unknown code-id, no fallback
    expect(isValidAdjustmentId('momentum_chaser', 'TF-99')).toBe(false); // nonexistent id
  });

  it('getCanonicalText round-trips for every (archetype, id) and returns null otherwise', () => {
    for (const key of SIX_KEYS) {
      for (const a of ARCHETYPE_ADJUSTMENTS[key].adjustments) {
        expect(getCanonicalText(key, a.id)).toBe(a.canonical);
      }
    }
    expect(getCanonicalText('guardian', 'DV-01')).toBeNull(); // cross-archetype
    expect(getCanonicalText('does_not_exist', 'FI-01')).toBeNull(); // unknown, no fallback
    expect(getCanonicalText('analyst', 'FI-404')).toBeNull(); // nonexistent id
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Release 2 — versioning + conflict groups (spec Phase 1 item 1 / changelog #8)
// ─────────────────────────────────────────────────────────────────────────────

import {
  ADJUSTMENT_CONFLICT_GROUPS,
  getAdjustment,
  getCanonicalTextVersion,
  getConflictGroups,
  findEquipConflicts,
  getOpposedLeanIds,
} from './archetypeAdjustments.js';

describe('Release 2 — canonicalTextVersion', () => {
  it('every one of the 46 adjustments carries canonicalTextVersion 1 (integer)', () => {
    let count = 0;
    for (const key of SIX_KEYS) {
      for (const a of ARCHETYPE_ADJUSTMENTS[key].adjustments) {
        expect(a.canonicalTextVersion, `${key}/${a.id}`).toBe(1);
        count += 1;
      }
    }
    expect(count).toBe(46);
  });

  it('getCanonicalTextVersion / getAdjustment resolve valid pairs and null otherwise (no fallback)', () => {
    expect(getCanonicalTextVersion('guardian', 'CP-04')).toBe(1);
    expect(getAdjustment('guardian', 'CP-04')).toMatchObject({ id: 'CP-04', canonicalTextVersion: 1 });
    expect(getCanonicalTextVersion('guardian', 'DV-01')).toBeNull(); // cross-archetype
    expect(getCanonicalTextVersion('does_not_exist', 'CP-04')).toBeNull(); // unknown archetype
    expect(getAdjustment('analyst', 'FI-404')).toBeNull(); // nonexistent id
  });
});

describe('Release 2 — ADJUSTMENT_CONFLICT_GROUPS (adjudication-gated drafts)', () => {
  it('covers exactly the six archetypes (an explicit entry each, even when empty)', () => {
    expect(Object.keys(ADJUSTMENT_CONFLICT_GROUPS).sort()).toEqual([...SIX_KEYS].sort());
  });

  it('RELEASE-BLOCKING (changelog #8): every group member pins the CURRENT canonicalTextVersion — a text bump invalidates the ruling until re-adjudicated', () => {
    for (const key of SIX_KEYS) {
      for (const group of ADJUSTMENT_CONFLICT_GROUPS[key]) {
        for (const member of group.members) {
          const live = getCanonicalTextVersion(key, member.id);
          expect(live, `${key}/${group.groupId}/${member.id}: ruling pinned v${member.version} but live text is v${live} — re-adjudicate the group`).toBe(member.version);
        }
      }
    }
  });

  it('well-formed groups: ≥2 members, ids valid in their own archetype menu, unique ids within a group, groupId/dimension/rationale present', () => {
    for (const key of SIX_KEYS) {
      for (const group of ADJUSTMENT_CONFLICT_GROUPS[key]) {
        expect(group.groupId).toMatch(/^[A-Z]{2}-G\d+$/);
        expect(typeof group.dimension).toBe('string');
        expect(group.rationale.length).toBeGreaterThan(20);
        expect(group.members.length).toBeGreaterThanOrEqual(2);
        const ids = group.members.map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) {
          expect(isValidAdjustmentId(key, id), `${key}/${group.groupId}/${id}`).toBe(true);
        }
      }
    }
  });

  it('adjudicated census (Flash+Claude ruling 2026-07-10): TF 0, CN 1, SP 1, CP 1, DV 1, FI 2 groups', () => {
    expect(ADJUSTMENT_CONFLICT_GROUPS.momentum_chaser).toHaveLength(0);
    expect(ADJUSTMENT_CONFLICT_GROUPS.contrarian).toHaveLength(1);
    expect(ADJUSTMENT_CONFLICT_GROUPS.degen).toHaveLength(1);
    expect(ADJUSTMENT_CONFLICT_GROUPS.guardian).toHaveLength(1);
    expect(ADJUSTMENT_CONFLICT_GROUPS.diversifier).toHaveLength(1);
    expect(ADJUSTMENT_CONFLICT_GROUPS.analyst).toHaveLength(2);
  });

  it('getConflictGroups never falls back (unknown archetype → [])', () => {
    expect(getConflictGroups('does_not_exist')).toEqual([]);
    expect(getConflictGroups(undefined)).toEqual([]);
  });

  it('findEquipConflicts: rejects opposing combinations, allows everything else', () => {
    // Same group, other member equipped → conflict.
    expect(findEquipConflicts('guardian', 'CP-05', ['CP-04'])).toEqual(['CP-04']);
    expect(findEquipConflicts('guardian', 'CP-04', ['CP-05'])).toEqual(['CP-05']);
    // No group shared → equippable.
    expect(findEquipConflicts('guardian', 'CP-01', ['CP-04'])).toEqual([]);
    // Cross-archetype candidate never matches a group.
    expect(findEquipConflicts('guardian', 'DV-03', ['CP-04'])).toEqual([]);
    // Grouped candidate with nothing equipped → equippable.
    expect(findEquipConflicts('analyst', 'FI-05', [])).toEqual([]);
    // Analyst has two groups — only the shared-group lean conflicts.
    expect(findEquipConflicts('analyst', 'FI-05', ['FI-03', 'FI-06'])).toEqual(['FI-06']);
  });

  it('getOpposedLeanIds mirrors the group derivation as directed directive→lean edges', () => {
    expect(getOpposedLeanIds('diversifier', 'DV-03', ['DV-05', 'DV-01'])).toEqual(['DV-05']);
    expect(getOpposedLeanIds('diversifier', 'DV-01', ['DV-05'])).toEqual([]);
    expect(getOpposedLeanIds('momentum_chaser', 'TF-01', ['TF-02'])).toEqual([]); // TF has no groups
  });
});

// ── The cautious register: the charter's sentence, bound to ids (2026-09-17) ──
//
// Every expectation below is hand-transcribed from the six
// ARCHETYPE_DEF_*_2026-06-24.md charters at the repo root — ONE ID PER CLAUSE, in
// the charter's own clause order — and NOT read back out of the module under
// test. A row derived from the data it guards cannot fail when that data is
// wrong. The charter is the source; the founder blesses the mapping.
describe('cautiousRegister — the charter sentence, one id per clause', () => {
  // archetype → [the charter's clauses, in order] → [the ids they name]
  const CHARTER = {
    // TREND_FOLLOWER_TEMPLATE:47 — "raise its own bar (stronger confirmation,
    // cleanest breakouts only, lean harder on the technical leg, size down)"
    momentum_chaser: ['TF-02', 'TF-01', 'TF-07', 'TF-05'],
    // CONTRARIAN:59 — "tighten the stop / demand deeper washout / require a
    // clearer turn"
    contrarian: ['CN-03', 'CN-01', 'CN-02'],
    // SPECULATOR:47 — "tighten the (still-wide) stop / hunt slightly-less-extreme
    // volatility / size down"
    degen: ['SP-01', 'SP-02', 'SP-06'],
    // CAPITAL_PRESERVER:47 — "raise the quality bar / tighten the volatility
    // ceiling / demand cleaner balance sheets". THREE clauses, TWO ids: clause 3
    // restates clause 1 (CP-01 reads "(demand cleaner fundamentals)"), and no
    // other CP id names that dial — CP-08 is a near-term CATALYST, not a measure
    // of cleanliness. Recorded, not padded.
    guardian: ['CP-01', 'CP-02'],
    // DIVERSIFIER:49 — "tighten the cap / widen the spread / rebalance sooner"
    diversifier: ['DV-01', 'DV-02', 'DV-03'],
    // FUNDAMENTAL_INVESTOR:54 — "raise the quality bar / demand a cleaner
    // technical setup / hold conviction longer"
    analyst: ['FI-01', 'FI-02', 'FI-03'],
  };

  it('every archetype carries the exact charter list, in the charter\'s order', () => {
    for (const key of SIX_KEYS) {
      expect(ARCHETYPE_ADJUSTMENTS[key].cautiousRegister, key).toEqual(CHARTER[key]);
    }
  });

  it('every register id is on its OWN archetype\'s menu — never another\'s, never invented', () => {
    for (const key of SIX_KEYS) {
      const menu = new Set(getAllowlist(key).map((a) => a.id));
      for (const id of ARCHETYPE_ADJUSTMENTS[key].cautiousRegister) {
        expect(id.startsWith(ID_PREFIX[key]), `${key}: ${id} has the wrong prefix`).toBe(true);
        expect(isValidAdjustmentId(key, id), `${key}: ${id} not on the menu`).toBe(true);
        expect(menu.has(id)).toBe(true);
      }
    }
  });

  it('no list is empty, and no list repeats an id', () => {
    for (const key of SIX_KEYS) {
      const list = ARCHETYPE_ADJUSTMENTS[key].cautiousRegister;
      expect(list.length, `${key}: empty register`).toBeGreaterThan(0);
      expect(new Set(list).size, `${key}: duplicate id`).toBe(list.length);
    }
  });

  it('getCautiousRegister NEVER falls back — unknown/missing code-id yields []', () => {
    expect(getCautiousRegister('degen')).toEqual(['SP-01', 'SP-02', 'SP-06']);
    expect(getCautiousRegister('does_not_exist')).toEqual([]);
    expect(getCautiousRegister(undefined)).toEqual([]);
    expect(getCautiousRegister(null)).toEqual([]);
    // Unlike getArchetypeZones, it must NOT resolve to analyst's list.
    expect(getCautiousRegister('does_not_exist')).not.toEqual(CHARTER.analyst);
  });

  // WHY THE FIELD EXISTS, as an executable statement. The retired derivation —
  // policy.riskDirection 'lower' + concentration 'neutral' + horizon 'neutral' —
  // is recomputed here from the live triples and shown to DISAGREE with the
  // charter in four of six archetypes. If someone deletes the field and goes
  // back to deriving, this row is the record of what that costs.
  it('the retired `policy` derivation cannot reproduce the charter (4 of 6 disagree)', () => {
    const derived = (key) => getAllowlist(key)
      .filter((a) => a.policy.riskDirection === 'lower'
        && a.policy.concentrationDirection === 'neutral'
        && a.policy.timeHorizonDirection === 'neutral')
      .map((a) => a.id);

    const sorted = (xs) => [...xs].sort();

    // The review's headline count, stated precisely: FOUR archetypes where the
    // derivation DROPS a move its own charter names. That is the damaging half —
    // a player asking for "more cautious" was pointed away from it.
    const dropsACharterMove = SIX_KEYS.filter((k) => CHARTER[k].some((id) => !derived(k).includes(id)));
    expect(sorted(dropsACharterMove)).toEqual(sorted(['degen', 'contrarian', 'analyst', 'diversifier']));

    // And the count the review's table did not make: in SIX of six the derived
    // set is not the charter's. `guardian` and `momentum_chaser` "agree" only as
    // supersets — they ADD ids the charter never names (CP-08; TF-06 and TF-08).
    const notTheCharter = SIX_KEYS.filter((k) => sorted(derived(k)).join() !== sorted(CHARTER[k]).join());
    expect(sorted(notTheCharter)).toEqual(sorted(SIX_KEYS));
    expect(derived('guardian')).toEqual(['CP-01', 'CP-02', 'CP-08']);
    expect(derived('momentum_chaser')).toEqual(['TF-01', 'TF-02', 'TF-05', 'TF-06', 'TF-07', 'TF-08']);

    // And the reason it CANNOT be fixed inside the derivation: the three
    // Speculator ids the charter splits carry byte-identical DIRECTION triples
    // (plus the same coreAlignment), so no function of those fields can include
    // two and exclude the third — while the charter includes SP-06 and excludes
    // SP-07. The only field that separates them is `forbiddenOpposite`, free
    // prose naming the reversal, which is deliberately never rendered and would
    // be a second source for the same fact if it were read as a dial.
    const dial = (id) => {
      const { riskDirection, concentrationDirection, timeHorizonDirection, coreAlignment } =
        getAllowlist('degen').find((a) => a.id === id).policy;
      return JSON.stringify({ riskDirection, concentrationDirection, timeHorizonDirection, coreAlignment });
    };
    expect(dial('SP-02')).toBe(dial('SP-06'));
    expect(dial('SP-06')).toBe(dial('SP-07'));
    expect(CHARTER.degen).toContain('SP-06');
    expect(CHARTER.degen).not.toContain('SP-07');

    // diversifier was entirely disjoint — the sharpest case.
    expect(derived('diversifier')).toEqual(['DV-06']);
    for (const id of CHARTER.diversifier) expect(derived('diversifier')).not.toContain(id);
  });
});
