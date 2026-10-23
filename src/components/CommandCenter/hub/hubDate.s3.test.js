// src/components/CommandCenter/hub/hubDate.s3.test.js
//
// Command Center hub, slice S3 — the record times hubDate.js gained: hubMs (a
// record's time as ms), formatHubDay (the completed row's day, in ET) and
// lastDeployedAtMs (the deploy cooldown's evidence, with its plausibility
// bound; S2a review A3-9). Their own file: hubDate.test.js is S1's and stays as
// it was. (S3 review T5-10, T5-11)

import { describe, expect, it } from 'vitest';
import { formatHubDay, hubMs, lastDeployedAtMs } from './hubDate';
import { DEPLOY_COOLDOWN_MS, cooldownUntilFrom } from './selectors/attemptReducer';

describe('hubMs — a record\'s time as ms, through the app\'s one normalizer (spec §8.2)', () => {
  it('reads a Firestore timestamp, ISO text, a Date and a number', () => {
    expect(hubMs({ toMillis: () => 1792512000500 })).toBe(1792512000500);
    expect(hubMs({ seconds: 1792512000, nanoseconds: 0 })).toBe(1792512000000);
    expect(hubMs('2026-10-20T20:05:00.000Z')).toBe(Date.UTC(2026, 9, 20, 20, 5));
    expect(hubMs(new Date(Date.UTC(2026, 9, 20, 20, 5)))).toBe(Date.UTC(2026, 9, 20, 20, 5));
    expect(hubMs(1234)).toBe(1234);
  });

  it('is null for anything it cannot read — and never throws (an infinite number throws inside the normalizer)', () => {
    for (const bad of [null, undefined, 'not a time', {}, NaN, Infinity, -Infinity, { seconds: 'x' }]) {
      expect(() => hubMs(bad), String(bad)).not.toThrow();
      expect(hubMs(bad), String(bad)).toBeNull();
    }
  });
});

describe('formatHubDay — the completed row\'s day, read in ET (BUILD_RULES §6)', () => {
  it('reads the day in New York, not in UTC: 01:00 UTC on Oct 21 is the evening of Oct 20', () => {
    expect(formatHubDay(Date.UTC(2026, 9, 21, 1, 0))).toBe('Oct 20');
    expect(formatHubDay(Date.UTC(2026, 9, 20, 20, 5))).toBe('Oct 20');
  });

  it('turns over at midnight ET (04:00 UTC while EDT), to the minute', () => {
    expect(formatHubDay(Date.UTC(2026, 9, 21, 3, 59, 59, 999))).toBe('Oct 20');
    expect(formatHubDay(Date.UTC(2026, 9, 21, 4, 0, 0, 0))).toBe('Oct 21');
  });

  it('follows the DST change through the zone, not a fixed offset: 04:30 UTC on Nov 2 2026 is 11:30 PM EST on Nov 1', () => {
    expect(formatHubDay(Date.UTC(2026, 10, 2, 4, 30))).toBe('Nov 1');
    expect(formatHubDay(Date.UTC(2026, 10, 1, 4, 30))).toBe('Nov 1');
  });

  it('is nothing for no time, a time that is not a finite number, or a day written as text', () => {
    for (const bad of [null, undefined, NaN, Infinity, '2026-10-20', '1792512000000', new Date(), {}]) {
      expect(formatHubDay(bad), String(bad)).toBe('');
    }
  });
});

describe('lastDeployedAtMs — the cooldown\'s evidence, or null when it is not a plausible past deploy (S2a review A3-9)', () => {
  const NOW = Date.UTC(2026, 9, 22, 15, 0);
  // "One cooldown" is the server's (and the reducer's): the bound moves with it, or this row says so.
  const COOLDOWN_MS = DEPLOY_COOLDOWN_MS;

  it('a past time is plausible whatever its age, in every shape a record keeps it in', () => {
    expect(lastDeployedAtMs('2026-10-22T14:58:00.000Z', NOW)).toBe(Date.UTC(2026, 9, 22, 14, 58));
    expect(lastDeployedAtMs(NOW - 86400000, NOW)).toBe(NOW - 86400000);
    expect(lastDeployedAtMs(new Date(NOW - 5000), NOW)).toBe(NOW - 5000);
    expect(lastDeployedAtMs({ seconds: Math.floor((NOW - 60000) / 1000), nanoseconds: 0 }, NOW)).toBe(Math.floor((NOW - 60000) / 1000) * 1000);
    expect(lastDeployedAtMs(Date.UTC(2020, 0, 1), NOW)).toBe(Date.UTC(2020, 0, 1));
    expect(lastDeployedAtMs(NOW, NOW)).toBe(NOW);
  });

  it('a little clock skew is allowed — up to one cooldown ahead of the clock, inclusive — and no more', () => {
    expect(lastDeployedAtMs(NOW + 60000, NOW)).toBe(NOW + 60000);
    expect(lastDeployedAtMs(NOW + COOLDOWN_MS, NOW)).toBe(NOW + COOLDOWN_MS);
    expect(lastDeployedAtMs(NOW + COOLDOWN_MS + 1, NOW)).toBeNull();
    expect(lastDeployedAtMs(NOW + 600000, NOW)).toBeNull();
    expect(lastDeployedAtMs('2027-10-22T15:00:00.000Z', NOW)).toBeNull();
  });

  it('the allowance is the caller\'s to widen', () => {
    expect(lastDeployedAtMs(NOW + 130000, NOW)).toBeNull();
    expect(lastDeployedAtMs(NOW + 130000, NOW, { aheadMs: 200000 })).toBe(NOW + 130000);
  });

  it('is null for a time it cannot read', () => {
    for (const bad of ['nonsense', null, undefined, {}, NaN, Infinity]) expect(lastDeployedAtMs(bad, NOW), String(bad)).toBeNull();
  });

  it('is null without a usable clock: the bound cannot be judged', () => {
    for (const badNow of [NaN, Infinity, undefined, null, String(NOW)]) {
      expect(lastDeployedAtMs(NOW - 1000, badNow), String(badNow)).toBeNull();
    }
  });

  // The conversion's consumer is S2b's provider (the reducer's cooldownEvidence action; S3 supplies no cooldown): a recent
  // deploy sets the bound it names, and an implausible time sets none — it can never pin a bound that no deploy made.
  it('as the reducer\'s cooldown evidence: a recent deploy sets the bound, an implausible time or none sets nothing', () => {
    const recent = NOW - 30000;
    expect(cooldownUntilFrom({ lastDeployedAtMs: lastDeployedAtMs(recent, NOW) })).toBe(recent + DEPLOY_COOLDOWN_MS);
    expect(cooldownUntilFrom({ lastDeployedAtMs: lastDeployedAtMs(NOW + 365 * 86400000, NOW) })).toBeNull();
    expect(cooldownUntilFrom({ lastDeployedAtMs: lastDeployedAtMs('nonsense', NOW) })).toBeNull();
  });
});
