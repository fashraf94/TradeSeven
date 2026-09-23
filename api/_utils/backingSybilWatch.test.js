// api/_utils/backingSybilWatch.test.js
//
// Backing Beta PR 5 — the Sybil watch's analysis (spec V1.3 §8, §10). Pure
// rows: clusters by address and by device, the same-team concentration, the
// book's hygiene counts, and what is NOT a lead (one account alone on an
// address, a voided stake, a many-address account below the bar).

import { describe, it, expect } from 'vitest';
import { SYBIL_WATCH_VERSION, analyzeSybil, formatSybilReport, shortHash } from './backingSybilWatch.js';
import { findForbiddenTerm } from '../../src/constants/backingLexicon.js';

const IP_A = 'a'.repeat(64);
const IP_B = 'b'.repeat(64);
const IP_C = 'c'.repeat(64);
const UA_1 = '1'.repeat(64);
const UA_2 = '2'.repeat(64);
const UNKNOWN = 'f'.repeat(64);

const stake = (id, userId, groupId, teamOdUserId, amount, over = {}) => ({ id, userId, groupId, teamOdUserId, amount, status: 'live', weekKey: '2026-W40', placedAt: '2026-09-22T10:00:00.000Z', ...over });
const meta = (ipHash, uaHash, over = {}) => ({ ipHash, uaHash, excluded: false, at: '2026-09-22T10:00:00.000Z', ...over });

/** Three accounts on address A (two on one device), one alone on B, one on C with no meta. */
const BOOK = {
  stakes: [
    stake('s1', 'u1', 'g1', 'od-a', 300),
    stake('s2', 'u2', 'g1', 'od-a', 200),
    stake('s3', 'u3', 'g1', 'od-b', 100),
    stake('s4', 'u1', 'g2', 'od-c', 150),
    stake('s5', 'u4', 'g1', 'od-a', 250),
    stake('s6', 'u5', 'g2', 'od-c', 100),
    stake('s7', 'u2', 'g2', 'od-c', 50, { status: 'voided', voidReason: 'group_voided' }),
    stake('s8', 'u6', 'g9', 'od-a', 100),
  ],
  metaByStakeId: {
    s1: meta(IP_A, UA_1), s2: meta(IP_A, UA_1), s3: meta(IP_A, UA_2), s4: meta(IP_A, UA_1),
    s5: meta(IP_B, UA_1, { excluded: true }),
    s7: meta(IP_A, UA_1),
    s8: meta(UNKNOWN, UA_2),
  },
  // A dev pod keeps a plain group id; its POOL carries `isDev` (the runner reads it at `dev-{groupId}`).
  poolsByGroupId: { g1: { isDev: false }, g2: { isDev: false }, g9: { isDev: true } },
};

describe('analyzeSybil — the clusters', () => {
  const report = analyzeSybil(BOOK, { unknownIpHash: UNKNOWN, now: new Date('2026-09-23T12:00:00.000Z') });

  it('an address shared by ≥2 accounts is a cluster; an address with one account is not', () => {
    expect(report.addressClusters.map((c) => c.ipHash)).toEqual([IP_A.slice(0, 12)]);
    const a = report.addressClusters[0];
    expect(a.accountCount).toBe(3);
    expect(a.accounts.map((x) => x.userId)).toEqual(['u1', 'u2', 'u3']);
    expect(a.accounts[0]).toEqual({ userId: 'u1', stakes: 2, bp: 450, pods: ['g1', 'g2'], excluded: 0 });
    expect(a.stakeCount).toBe(4);
    expect(a.bp).toBe(750);
  });

  it('a device cluster needs the SAME address and user agent — u1 and u2, not u3', () => {
    expect(report.deviceClusters).toEqual([{ ipHash: IP_A.slice(0, 12), uaHash: UA_1.slice(0, 12), accountCount: 2, accounts: ['u1', 'u2'], stakeCount: 3, bp: 650 }]);
  });

  it('the concentration is a cluster\'s accounts on ONE team in ONE pod — u1 and u2 on od-a in g1; not the two pods u1 backed alone', () => {
    expect(report.concentration).toEqual([{ groupId: 'g1', teamOdUserId: 'od-a', accountCount: 2, accounts: ['u1', 'u2'], bp: 500, isDev: false, ipHash: IP_A.slice(0, 12) }]);
    expect(report.addressClusters[0].sameTeam).toHaveLength(1);
  });

  it('counts the book\'s hygiene: voided skipped, missing meta, excluded, the unknown-address sentinel, dev stakes', () => {
    expect(report.counts).toEqual({
      stakes: 8, counted: 7, voided: 1, missingMeta: 1, excluded: 1, unknownAddress: 1, devStakes: 1,
      accounts: 6, pods: 3, addressClusters: 1, deviceClusters: 1, concentration: 1,
    });
    expect(report.version).toBe(SYBIL_WATCH_VERSION);
    expect(report.generatedAt).toBe('2026-09-23T12:00:00.000Z');
  });

  it('a voided stake never joins a cluster (it never moved a pot): u2\'s voided g2 stake is not in the cluster\'s pods', () => {
    const u2 = report.addressClusters[0].accounts.find((x) => x.userId === 'u2');
    expect(u2.pods).toEqual(['g1']);
    expect(u2.stakes).toBe(1);
  });

  it('many-address accounts need three addresses; nobody here has them', () => {
    expect(report.manyAddressAccounts).toEqual([]);
    const roaming = analyzeSybil({
      stakes: [stake('r1', 'u9', 'g1', 'od-a', 10), stake('r2', 'u9', 'g2', 'od-c', 10), stake('r3', 'u9', 'g3', 'od-d', 10)],
      metaByStakeId: { r1: meta(IP_A, UA_1), r2: meta(IP_B, UA_1), r3: meta(IP_C, UA_2) },
    });
    expect(roaming.manyAddressAccounts).toEqual([{ userId: 'u9', addressCount: 3, agentCount: 2, stakes: 3 }]);
    expect(roaming.addressClusters).toEqual([]);
  });

  it('minAccounts raises the bar — at 3 the device cluster and the concentration disappear, the address cluster stays', () => {
    const strict = analyzeSybil(BOOK, { minAccounts: 3 });
    expect(strict.addressClusters).toHaveLength(1);
    expect(strict.deviceClusters).toEqual([]);
    expect(strict.concentration).toEqual([]);
  });

  it('an empty or malformed book is an empty report, never a throw', () => {
    for (const input of [{ stakes: [], metaByStakeId: {} }, { stakes: null, metaByStakeId: null }, { stakes: [null, {}, { id: 'x' }], metaByStakeId: {} }]) {
      const r = analyzeSybil(input);
      expect(r.addressClusters).toEqual([]);
      expect(r.counts.counted).toBe(0);
    }
  });

  it('the REPORT OBJECT itself carries no whole digest — `--json` shows the same prefixes the text does (HON-8)', () => {
    const json = JSON.stringify(report);
    for (const digest of [IP_A, IP_B, IP_C, UA_1, UA_2, UNKNOWN]) expect(json).not.toContain(digest);
    expect(json).toContain(IP_A.slice(0, 12));
  });

  it('ranks NOTHING about users: the ordering is by cluster size and BP, and no field is a rank, a score or a verdict', () => {
    const keys = new Set();
    const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x); } };
    walk(report);
    for (const k of keys) expect(k).not.toMatch(/rank|score|verdict|fraud|guilty|ban/i);
  });
});

describe('formatSybilReport — the printed report', () => {
  it('prints digest PREFIXES only, the counts, every cluster and the next-step note; speaks no forbidden term', () => {
    const report = analyzeSybil(BOOK, { unknownIpHash: UNKNOWN });
    const text = formatSybilReport(report);
    expect(text).toContain('READ-ONLY');
    expect(text).toContain(`ip ${IP_A.slice(0, 12)}…`);
    expect(text).not.toContain(IP_A);
    expect(text).not.toContain(UA_1);
    expect(text).toContain('Stakes read: 8 · counted (live/won/lost): 7 · voided (skipped): 1');
    expect(text).toContain('SAME TEAM: pod g1 · team od-a · 2 accounts · 500 BP');
    expect(text).toContain('DEVICE CLUSTERS');
    expect(text).toContain('This script does neither.');
    expect(findForbiddenTerm(text)).toBeNull();
  });

  it('shortHash never returns the whole digest and never throws on a missing one', () => {
    expect(shortHash(IP_A)).toBe(IP_A.slice(0, 12));
    expect(shortHash(null)).toBe('(none)');
    expect(shortHash('')).toBe('(none)');
  });
});
