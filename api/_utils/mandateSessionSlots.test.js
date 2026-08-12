// api/_utils/mandateSessionSlots.test.js
// Spec 1 §3.1 — market-calendar gating + session-relative slots. Aug 2026 is
// EDT (UTC−4): ET H:M == UTC (H+4):M. 2026-08-12 is a Wednesday trading day.

import { describe, it, expect } from 'vitest';
import {
  resolveSessionSlots,
  slotAtEtMinutes,
  tierEligibleAt,
  slotsForTier,
  isLastSlotForTier,
  buildTickKey,
  resolveEvalContext,
  activeTick,
  SLOT_NAMES,
} from './mandateSessionSlots.js';

describe('resolveSessionSlots — geometry + calendar gating', () => {
  it('a regular trading day has three session-relative slots', () => {
    const s = resolveSessionSlots('2026-08-12');
    expect(s.trading).toBe(true);
    expect(s.isEarlyClose).toBe(false);
    expect(s.closeMin).toBe(960);
    const byName = Object.fromEntries(s.slots.map((x) => [x.name, x.atMin]));
    expect(byName.open30).toBe(600);   // 10:00
    expect(byName.midday).toBe(765);   // 12:45
    expect(byName.preClose).toBe(930); // 15:30
    expect(s.slots.map((x) => x.name)).toEqual(SLOT_NAMES);
  });

  it('holidays and weekends are no-ops (fail-closed)', () => {
    expect(resolveSessionSlots('2026-01-01').trading).toBe(false); // New Year holiday
    expect(resolveSessionSlots('2026-08-15').trading).toBe(false); // Saturday
  });

  it('fails closed beyond the maintained holiday horizon (2028+ would else trade on holidays)', () => {
    const s = resolveSessionSlots('2028-01-03'); // a weekday, but beyond maintained years
    expect(s.trading).toBe(false);
    expect(s.reason).toBe('beyond_calendar_horizon');
    expect(resolveEvalContext('fast', new Date('2028-01-03T15:00:00Z')).eligible).toBe(false);
  });

  it('early-close days compress the session (13:00 close)', () => {
    const s = resolveSessionSlots('2026-11-27'); // day after Thanksgiving
    expect(s.trading).toBe(true);
    expect(s.isEarlyClose).toBe(true);
    expect(s.closeMin).toBe(780); // 13:00
    const byName = Object.fromEntries(s.slots.map((x) => [x.name, x.atMin]));
    expect(byName.open30).toBe(600);   // 10:00
    expect(byName.midday).toBe(675);   // 11:15
    expect(byName.preClose).toBe(750); // 12:30
  });
});

describe('slotAtEtMinutes — non-overlapping activation windows', () => {
  const d = '2026-08-12';
  it('matches within a slot window and nowhere else', () => {
    expect(slotAtEtMinutes(600, d)).toBe('open30');   // exactly at target
    expect(slotAtEtMinutes(620, d)).toBe('open30');   // within window
    expect(slotAtEtMinutes(631, d)).toBe(null);       // past window end (630)
    expect(slotAtEtMinutes(765, d)).toBe('midday');
    expect(slotAtEtMinutes(930, d)).toBe('preClose');
    expect(slotAtEtMinutes(500, d)).toBe(null);       // pre-open
    expect(slotAtEtMinutes(960, d)).toBe(null);       // at/after close
  });
});

describe('tier → slot mapping (D-19)', () => {
  it('slow rides only the early slot; fast rides all three', () => {
    expect(slotsForTier('slow')).toEqual(['open30']);
    expect(slotsForTier('standard')).toEqual(['open30', 'midday']);
    expect(slotsForTier('fast')).toEqual(['open30', 'midday', 'preClose']);
    expect(slotsForTier('bogus')).toEqual([]);
  });
  it('tierEligibleAt gates per tier', () => {
    expect(tierEligibleAt('slow', 'open30')).toBe(true);
    expect(tierEligibleAt('slow', 'midday')).toBe(false);
    expect(tierEligibleAt('standard', 'preClose')).toBe(false);
    expect(tierEligibleAt('fast', 'preClose')).toBe(true);
  });
  it('isLastSlotForTier identifies each tier last eval slot (F3 input)', () => {
    expect(isLastSlotForTier('slow', 'open30')).toBe(true);
    expect(isLastSlotForTier('standard', 'midday')).toBe(true);
    expect(isLastSlotForTier('standard', 'open30')).toBe(false);
    expect(isLastSlotForTier('fast', 'preClose')).toBe(true);
  });
});

describe('resolveEvalContext / activeTick — at real instants', () => {
  it('a slow book is eligible at open30 and not at midday', () => {
    const at1005 = new Date('2026-08-12T14:05:00Z'); // 10:05 ET
    const ctx = resolveEvalContext('slow', at1005);
    expect(ctx.eligible).toBe(true);
    expect(ctx.slot).toBe('open30');
    expect(ctx.tickKey).toBe('2026-08-12_open30');
    expect(ctx.isLastSlotForTier).toBe(true); // open30 is slow's only slot

    const at1245 = new Date('2026-08-12T16:45:00Z'); // 12:45 ET
    const ctxMid = resolveEvalContext('slow', at1245);
    expect(ctxMid.slot).toBe('midday');
    expect(ctxMid.eligible).toBe(false); // slow does not evaluate midday
  });

  it('a fast book is eligible at pre-close (its last slot)', () => {
    const at1530 = new Date('2026-08-12T19:30:00Z'); // 15:30 ET
    const ctx = resolveEvalContext('fast', at1530);
    expect(ctx.eligible).toBe(true);
    expect(ctx.slot).toBe('preClose');
    expect(ctx.isLastSlotForTier).toBe(true);
  });

  it('pre-open and holidays yield no eligible slot', () => {
    const preOpen = new Date('2026-08-12T13:00:00Z'); // 09:00 ET
    expect(resolveEvalContext('fast', preOpen).slot).toBe(null);
    const holiday = new Date('2026-01-01T15:00:00Z');
    const h = resolveEvalContext('fast', holiday);
    expect(h.trading).toBe(false);
    expect(h.eligible).toBe(false);
  });

  it('activeTick is tier-independent and shared across books', () => {
    const at1005 = new Date('2026-08-12T14:05:00Z');
    expect(activeTick(at1005)).toEqual({ date: '2026-08-12', slot: 'open30', tickKey: '2026-08-12_open30' });
    expect(activeTick(new Date('2026-08-12T13:00:00Z'))).toBe(null); // pre-open
  });

  it('buildTickKey is the shared platform-wide key', () => {
    expect(buildTickKey('2026-08-12', 'midday')).toBe('2026-08-12_midday');
  });
});
