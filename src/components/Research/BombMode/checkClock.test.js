// Research Modal Build A — the next-check clock (spec §3.3, §6 "Scored and clock").
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkClock, CHECK_QUEUE_MS, sessionOpenAt, etClock, mmss } from './checkClock.js';
import { nextEligibleSlot } from '../../../../api/_utils/callRecords/horizon.js';

const at = (iso) => Date.parse(iso);
const EXPIRES = at('2026-11-20T21:00:00.000Z');

describe('countdown — the next evaluator slot, from horizon.js', () => {
  it('Mon Nov 9, 10:07:30 ET → next check 10:15, with mm:ss under fifteen minutes', () => {
    const c = checkClock(at('2026-11-09T15:07:30.000Z'), { battleExpiresAtMs: EXPIRES, lastScoredAtMs: at('2026-11-09T15:00:20.000Z') });
    expect(c).toMatchObject({ state: 'countdown', slotMs: at('2026-11-09T15:15:00.000Z'), label: '10:15 · 07:30' });
  });
  it('is the slot nextEligibleSlot returns — never lastScoredAt + 15 minutes', () => {
    const now = at('2026-11-09T15:07:30.000Z');
    const last = at('2026-11-09T15:04:10.000Z'); // a late queue: +15 would be 10:19:10
    const c = checkClock(now, { battleExpiresAtMs: EXPIRES, lastScoredAtMs: last });
    expect(c.slotMs).toBe(nextEligibleSlot(now, { battleExpiresAtMs: EXPIRES }).slotMs);
    expect(c.slotMs).not.toBe(last + 15 * 60 * 1000);
  });
});

describe('checking… — the cron\'s queue', () => {
  const slot = at('2026-11-09T15:15:00.000Z');
  it('at the slot, until lastScoredAt passes it', () => {
    expect(checkClock(slot + 20_000, { battleExpiresAtMs: EXPIRES, lastScoredAtMs: at('2026-11-09T15:00:30.000Z') })).toMatchObject({ state: 'checking', slotMs: slot, label: 'checking…' });
  });
  it('then rolls to the next slot once the battle is scored past it', () => {
    expect(checkClock(slot + 60_000, { battleExpiresAtMs: EXPIRES, lastScoredAtMs: slot + 40_000 })).toMatchObject({ state: 'countdown', slotMs: slot + 15 * 60 * 1000 });
  });
  it('or after at most five minutes, scored or not', () => {
    expect(CHECK_QUEUE_MS).toBe(5 * 60 * 1000);
    expect(checkClock(slot + CHECK_QUEUE_MS - 1000, { battleExpiresAtMs: EXPIRES, lastScoredAtMs: null }).state).toBe('checking');
    expect(checkClock(slot + CHECK_QUEUE_MS, { battleExpiresAtMs: EXPIRES, lastScoredAtMs: null })).toMatchObject({ state: 'countdown', slotMs: slot + 15 * 60 * 1000 });
  });
});

describe('outside market hours — the next slot\'s day and time', () => {
  it('Saturday → Mon 9:30 AM', () => {
    expect(checkClock(at('2026-11-07T17:00:00.000Z'), { battleExpiresAtMs: EXPIRES })).toMatchObject({ state: 'later', slotMs: at('2026-11-09T14:30:00.000Z'), label: 'Mon 9:30 AM' });
  });
  it('after Friday\'s close (4:20 PM ET) → Mon 9:30 AM', () => {
    expect(checkClock(at('2026-11-06T21:20:00.000Z'), { battleExpiresAtMs: EXPIRES }).label).toBe('Mon 9:30 AM');
  });
  it('before the open on a weekday → that morning, named by its day', () => {
    expect(checkClock(at('2026-11-09T13:00:00.000Z'), { battleExpiresAtMs: EXPIRES })).toMatchObject({ state: 'later', label: 'Mon 9:30 AM' });
  });
  it('past the battle\'s end → none', () => {
    expect(checkClock(at('2026-11-09T15:07:30.000Z'), { battleExpiresAtMs: at('2026-11-09T15:10:00.000Z') })).toMatchObject({ state: 'none', reason: 'no_slot_before_battle_end' });
  });
});

describe('helpers', () => {
  it('sessionOpenAt follows the calendar of record (open 9:30, closed 4:00, weekend, holiday)', () => {
    expect(sessionOpenAt(at('2026-11-09T14:30:00.000Z'))).toBe(true);
    expect(sessionOpenAt(at('2026-11-09T21:00:00.000Z'))).toBe(false);
    expect(sessionOpenAt(at('2026-11-07T17:00:00.000Z'))).toBe(false);
    expect(sessionOpenAt(at('2026-11-26T17:00:00.000Z'))).toBe(false); // Thanksgiving 2026
  });
  it('etClock and mmss', () => { expect(etClock(at('2026-11-09T18:45:00.000Z'))).toBe('1:45'); expect(mmss(61_000)).toBe('01:01'); });
});

describe('no third clock: nothing in Bomb mode computes a check as an offset from the last one', () => {
  it('no BombMode source adds 15 minutes to a last-checked / last-scored instant', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    for (const f of readdirSync(dir).filter((n) => /\.(js|jsx)$/.test(n) && !/\.test\./.test(n))) {
      // code only: comments may name the forbidden method in order to forbid it
      const src = readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/last(Checked|Scored)At(Ms)?\s*\+/);
      expect(src, f).not.toMatch(/deriveDueAt/);
    }
  });
});
