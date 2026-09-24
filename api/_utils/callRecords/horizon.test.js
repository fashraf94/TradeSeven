// api/_utils/callRecords/horizon.test.js
//
// Cockpit Build 0 — the horizon resolver (spec V1.3 §3.5; §3.12 row 11) and
// THE vercel.json PIN: the evaluator schedule the resolver enumerates must be
// the schedule Vercel runs, so a cadence change in vercel.json fails here
// rather than silently mis-dating every `next_check` call.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EVALUATOR_SCHEDULE, EVALUATOR_SLOTS, HORIZON_BASES, HORIZON_FAILURES,
  eligibleSlotsOn, nextEligibleSlot, sessionCloseAfter, resolveHorizon, bindHorizon, etDateOf,
} from './horizon.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERCEL = JSON.parse(readFileSync(resolve(HERE, '../../../vercel.json'), 'utf8'));
const at = (iso) => Date.parse(iso);
const iso = (ms) => new Date(ms).toISOString();
const FAR = at('2026-12-31T00:00:00.000Z');

// Expand one cron field — star, star-slash-n, a comma list, or a range — over [lo, hi].
function expandField(field, lo, hi) {
  const out = new Set();
  for (const part of field.split(',')) {
    const [range, stepText] = part.split('/');
    const step = stepText ? Number(stepText) : 1;
    const [a, b] = range === '*' ? [lo, hi] : range.includes('-') ? range.split('-').map(Number) : [Number(range), Number(range)];
    for (let v = a; v <= b; v += step) out.add(v);
  }
  return [...out].sort((x, y) => x - y);
}

describe('THE vercel.json PIN — the schedule the resolver enumerates is the one Vercel runs', () => {
  const entries = VERCEL.crons.filter((c) => c.path === EVALUATOR_SCHEDULE.path);

  it('exactly one entry for /api/cron/agent-evaluate, with exactly the pinned expression', () => {
    expect(entries).toHaveLength(1);
    expect(entries[0].schedule).toBe(EVALUATOR_SCHEDULE.schedule);
  });

  it('the expanded slot table IS that expression (minute × hour × day-of-week, UTC)', () => {
    const [minute, hour, dom, month, dow] = entries[0].schedule.split(/\s+/);
    expect(dom).toBe('*');
    expect(month).toBe('*');
    expect(EVALUATOR_SLOTS.minutesUtc).toEqual(expandField(minute, 0, 59));
    expect(EVALUATOR_SLOTS.hoursUtc).toEqual(expandField(hour, 0, 23));
    expect(EVALUATOR_SLOTS.weekdaysUtc).toEqual(expandField(dow, 0, 6));
  });
});

describe('eligible slots — the schedule intersected with the session', () => {
  it('a normal RTH day has 26 slots, 09:30 → 15:45 ET (EDT: 13:30Z → 19:45Z)', () => {
    const slots = eligibleSlotsOn('2026-09-09');
    expect(slots).toHaveLength(26);
    expect(iso(slots[0])).toBe('2026-09-09T13:30:00.000Z');
    expect(iso(slots[25])).toBe('2026-09-09T19:45:00.000Z');
  });

  it('DST: after the Nov 1 change the same session is 14:30Z → 20:45Z, still 26 slots', () => {
    const slots = eligibleSlotsOn('2026-11-02');
    expect(slots).toHaveLength(26);
    expect(iso(slots[0])).toBe('2026-11-02T14:30:00.000Z');
    expect(iso(slots[25])).toBe('2026-11-02T20:45:00.000Z');
  });

  it('an early close (13:00 ET) has 14 slots, 09:30 → 12:45 ET', () => {
    const slots = eligibleSlotsOn('2026-11-27');
    expect(slots).toHaveLength(14);
    expect(iso(slots[13])).toBe('2026-11-27T17:45:00.000Z');
  });

  it('CLOSE EQUALITY: the slot AT the close is never scheduled (20:00Z on an EDT day; 18:00Z on the early close)', () => {
    expect(eligibleSlotsOn('2026-09-09')).not.toContain(at('2026-09-09T20:00:00.000Z'));
    expect(eligibleSlotsOn('2026-11-27')).not.toContain(at('2026-11-27T18:00:00.000Z'));
  });

  it('a holiday and a weekend have none; an unmaintained year is unknowable (null), never guessed', () => {
    expect(eligibleSlotsOn('2026-11-26')).toEqual([]);
    expect(eligibleSlotsOn('2026-09-12')).toEqual([]);
    expect(eligibleSlotsOn('2028-01-03')).toBeNull();
  });
});

describe('nextEligibleSlot — strictly after, before battle end', () => {
  it('strictly after: an instant ON a slot resolves to the NEXT slot', () => {
    expect(iso(nextEligibleSlot(at('2026-09-09T15:00:00.000Z'), { battleExpiresAtMs: FAR }).slotMs)).toBe('2026-09-09T15:15:00.000Z');
    expect(iso(nextEligibleSlot(at('2026-09-09T15:00:00.001Z'), { battleExpiresAtMs: FAR }).slotMs)).toBe('2026-09-09T15:15:00.000Z');
  });

  it('THE FINAL SLOT: just before 15:45 ET → 15:45 ET; from 15:45 ET → the next session\'s open (the close is never a slot)', () => {
    expect(iso(nextEligibleSlot(at('2026-09-09T19:44:59.000Z'), { battleExpiresAtMs: FAR }).slotMs)).toBe('2026-09-09T19:45:00.000Z');
    expect(iso(nextEligibleSlot(at('2026-09-09T19:45:00.000Z'), { battleExpiresAtMs: FAR }).slotMs)).toBe('2026-09-10T13:30:00.000Z');
  });

  it('HOLIDAYS are skipped: the evening before Thanksgiving → the early-close Friday\'s first slot', () => {
    expect(iso(nextEligibleSlot(at('2026-11-25T21:00:00.000Z'), { battleExpiresAtMs: FAR }).slotMs)).toBe('2026-11-27T14:30:00.000Z');
  });

  it('a Friday after the close → Monday\'s first slot', () => {
    expect(iso(nextEligibleSlot(at('2026-09-11T20:30:00.000Z'), { battleExpiresAtMs: FAR }).slotMs)).toBe('2026-09-14T13:30:00.000Z');
  });

  it('no eligible slot before the battle ends → no_slot_before_battle_end (a slot EQUAL to the end is not before it)', () => {
    expect(nextEligibleSlot(at('2026-09-09T15:00:00.000Z'), { battleExpiresAtMs: at('2026-09-09T15:15:00.000Z') })).toEqual({ reason: 'no_slot_before_battle_end' });
    expect(nextEligibleSlot(at('2026-09-09T15:00:00.000Z'), { battleExpiresAtMs: at('2026-09-09T15:15:00.001Z') })).toEqual({ slotMs: at('2026-09-09T15:15:00.000Z') });
    expect(nextEligibleSlot(at('2026-09-11T20:30:00.000Z'), { battleExpiresAtMs: at('2026-09-12T00:00:00.000Z') })).toEqual({ reason: 'no_slot_before_battle_end' });
  });

  it('AN UNMAINTAINED YEAR → calendar_unavailable, never a guessed session', () => {
    expect(nextEligibleSlot(at('2027-12-31T21:30:00.000Z'), { battleExpiresAtMs: at('2028-02-01T00:00:00.000Z') })).toEqual({ reason: 'calendar_unavailable' });
    expect(nextEligibleSlot(Number.NaN, { battleExpiresAtMs: FAR })).toEqual({ reason: 'calendar_unavailable' });
  });
});

describe('sessionCloseAfter — the session in progress, else the next one', () => {
  it('inside the session → that session\'s close; before the open → today\'s close', () => {
    expect(iso(sessionCloseAfter(at('2026-09-09T15:00:00.000Z')).closeMs)).toBe('2026-09-09T20:00:00.000Z');
    expect(iso(sessionCloseAfter(at('2026-09-09T11:00:00.000Z')).closeMs)).toBe('2026-09-09T20:00:00.000Z');
  });
  it('after the close → the next session\'s close; an early close is honored', () => {
    expect(iso(sessionCloseAfter(at('2026-09-09T20:00:00.000Z')).closeMs)).toBe('2026-09-10T20:00:00.000Z');
    expect(iso(sessionCloseAfter(at('2026-11-27T15:00:00.000Z')).closeMs)).toBe('2026-11-27T18:00:00.000Z');
  });
  it('A WEEKEND MINT (the crypto case — a horizon fixture, not an evaluator path) → Monday\'s close', () => {
    expect(iso(sessionCloseAfter(at('2026-09-12T15:00:00.000Z')).closeMs)).toBe('2026-09-14T20:00:00.000Z');
  });
  it('an unmaintained year → calendar_unavailable', () => {
    expect(sessionCloseAfter(at('2028-01-03T15:00:00.000Z'))).toEqual({ reason: 'calendar_unavailable' });
  });
});

describe('resolveHorizon — the four phrases and their typed failures', () => {
  const ctx = { promptBuiltAtMs: at('2026-09-09T14:59:58.000Z'), mintedAtMs: at('2026-09-09T15:00:20.000Z'), battleExpiresAtMs: at('2026-09-10T00:00:00.000Z') };

  it('next_check → the first slot after the PROMPT instant, basis next_check', () => {
    expect(resolveHorizon('next_check', ctx)).toEqual({ expiresAtMs: at('2026-09-09T15:00:00.000Z'), basis: 'next_check' });
  });
  it('this_session → the session close, basis this_session', () => {
    expect(resolveHorizon('this_session', ctx)).toEqual({ expiresAtMs: at('2026-09-09T20:00:00.000Z'), basis: 'this_session' });
  });
  it('this_battle → the battle\'s expiry, basis this_battle', () => {
    expect(resolveHorizon('this_battle', ctx)).toEqual({ expiresAtMs: at('2026-09-10T00:00:00.000Z'), basis: 'this_battle' });
  });
  it('explicit → kept when after the MINT instant; clamped only when beyond the battle end', () => {
    expect(resolveHorizon('explicit', { ...ctx, expiresAtMs: at('2026-09-09T18:00:00.000Z') })).toEqual({ expiresAtMs: at('2026-09-09T18:00:00.000Z'), basis: 'explicit' });
    expect(resolveHorizon('explicit', { ...ctx, expiresAtMs: at('2026-09-12T00:00:00.000Z') })).toEqual({ expiresAtMs: at('2026-09-10T00:00:00.000Z'), basis: 'explicit' });
  });
  it('THE CROSSED EXPIRY: explicit between prompt build and mint is explicit_invalid (validated against mintedAtMs, never the prompt)', () => {
    const crossed = at('2026-09-09T15:00:10.000Z'); // after promptBuiltAt, before mintedAt
    expect(crossed).toBeGreaterThan(ctx.promptBuiltAtMs);
    expect(crossed).toBeLessThan(ctx.mintedAtMs);
    expect(resolveHorizon('explicit', { ...ctx, expiresAtMs: crossed })).toEqual({ reason: 'explicit_invalid' });
    expect(resolveHorizon('explicit', { ...ctx, expiresAtMs: ctx.mintedAtMs })).toEqual({ reason: 'explicit_invalid' });
    expect(resolveHorizon('explicit', { ...ctx, expiresAtMs: Number.NaN })).toEqual({ reason: 'explicit_invalid' });
  });
  it('the vocabularies are closed', () => {
    expect(HORIZON_BASES).toEqual(['next_check', 'this_session', 'this_battle', 'explicit']);
    expect(HORIZON_FAILURES).toEqual(['no_slot_before_battle_end', 'calendar_unavailable', 'explicit_invalid']);
  });
  it('bindHorizon hands validateDeclarations a resolver fixed to one check\'s instants', () => {
    const bound = bindHorizon(ctx);
    expect(bound('next_check')).toEqual(resolveHorizon('next_check', ctx));
    expect(bound('explicit', at('2026-09-09T18:00:00.000Z'))).toEqual(resolveHorizon('explicit', { ...ctx, expiresAtMs: at('2026-09-09T18:00:00.000Z') }));
  });
  it('etDateOf reads the ET calendar date of an instant', () => {
    expect(etDateOf(at('2026-09-10T03:00:00.000Z'))).toBe('2026-09-09');
    expect(etDateOf(at('2026-09-10T05:00:00.000Z'))).toBe('2026-09-10');
  });
});

describe('battleExpiryMs — the stored expiry, read not guessed', () => {
  it('reads an ISO string, a number and a Timestamp-like; anything else is NaN', async () => {
    const { battleExpiryMs } = await import('./horizon.js');
    expect(battleExpiryMs({ expiresAt: '2026-09-10T00:00:00.000Z' })).toBe(at('2026-09-10T00:00:00.000Z'));
    expect(battleExpiryMs({ expiresAt: 5 })).toBe(5);
    expect(battleExpiryMs({ expiresAt: { toMillis: () => 7 } })).toBe(7);
    expect(battleExpiryMs({ expiresAt: { toMillis: () => { throw new Error('x'); } } })).toBeNaN();
    expect(battleExpiryMs({})).toBeNaN();
    expect(battleExpiryMs(null)).toBeNaN();
  });
});
