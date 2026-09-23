// src/services/backingTelemetry.test.js
//
// Backing Beta PR 5 — the client emitter (spec V1.3 §10): fire-and-forget,
// deduplicated per session, never blocking, never throwing; the vocabulary is
// the sink's allowlist and stake_confirmed is never a client event.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const svc = vi.hoisted(() => ({ calls: [], mode: 'ok' }));
vi.mock('./backingService', () => ({
  postBackingEvent: vi.fn((body) => {
    svc.calls.push(body);
    if (svc.mode === 'reject') return Promise.reject(new Error('down'));
    if (svc.mode === 'throw') throw new Error('sync boom');
    return Promise.resolve({ recorded: true });
  }),
}));

const { BACKING_EVENT, __resetBackingTelemetry, dwellSince, emitBackingEvent, telemetryKey } = await import('./backingTelemetry');
const { BACKING_EVENT_ALLOWLIST } = await import('../constants/backing');

beforeEach(() => { svc.calls.length = 0; svc.mode = 'ok'; __resetBackingTelemetry(); });

describe('the vocabulary', () => {
  it('is exactly the sink\'s allowlist — and stake_confirmed is not in it', () => {
    expect(Object.values(BACKING_EVENT).sort()).toEqual([...BACKING_EVENT_ALLOWLIST].sort());
    expect(emitBackingEvent('stake_confirmed', { groupId: 'g' })).toBe(false);
    expect(emitBackingEvent('anything_else')).toBe(false);
    expect(svc.calls).toEqual([]);
  });
});

describe('fire-and-forget, deduplicated per session', () => {
  it('sends one request per (event, pod, seat) and returns false for a repeat', () => {
    expect(emitBackingEvent(BACKING_EVENT.WINDOW_VIEWED, { props: { weekKey: '2026-W40' } })).toBe(true);
    expect(emitBackingEvent(BACKING_EVENT.WINDOW_VIEWED, { props: { weekKey: '2026-W40' } })).toBe(false);
    expect(emitBackingEvent(BACKING_EVENT.TEAM_CARD_OPENED, { groupId: 'g1', odUserId: 'od-a', props: { dwellMs: 1200 } })).toBe(true);
    expect(emitBackingEvent(BACKING_EVENT.TEAM_CARD_OPENED, { groupId: 'g1', odUserId: 'od-a', props: { dwellMs: 9999 } })).toBe(false);
    expect(emitBackingEvent(BACKING_EVENT.TEAM_CARD_OPENED, { groupId: 'g1', odUserId: 'od-b', props: { dwellMs: 1 } })).toBe(true);
    expect(emitBackingEvent(BACKING_EVENT.RESULTS_VIEWED, { groupId: 'g1', props: { weekKey: '2026-W40' } })).toBe(true);
    expect(svc.calls).toEqual([
      { event: 'window_viewed', groupId: null, props: { weekKey: '2026-W40' } },
      { event: 'team_card_opened', groupId: 'g1', props: { dwellMs: 1200, odUserId: 'od-a' } },
      { event: 'team_card_opened', groupId: 'g1', props: { dwellMs: 1, odUserId: 'od-b' } },
      { event: 'results_viewed', groupId: 'g1', props: { weekKey: '2026-W40' } },
    ]);
    expect(telemetryKey('x', { groupId: 'g', odUserId: 'o' })).toBe('x|g|o');
    expect(telemetryKey('x')).toBe('x||');
  });

  it('never throws and never surfaces the reply: a rejecting or throwing request is swallowed', async () => {
    svc.mode = 'reject';
    expect(emitBackingEvent(BACKING_EVENT.STAKE_CONTROL_OPENED, { groupId: 'g1', odUserId: 'od-a' })).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    svc.mode = 'throw';
    expect(emitBackingEvent(BACKING_EVENT.YOUR_BACKING_VIEWED)).toBe(true);
    expect(svc.calls).toHaveLength(2);
  });

  it('a new session (the test seam) records again', () => {
    expect(emitBackingEvent(BACKING_EVENT.WINDOW_VIEWED)).toBe(true);
    __resetBackingTelemetry();
    expect(emitBackingEvent(BACKING_EVENT.WINDOW_VIEWED)).toBe(true);
  });
});

describe('dwellSince', () => {
  it('is whole milliseconds since the instant, never negative, clamped to a day', () => {
    expect(dwellSince(1000, 4200)).toBe(3200);
    expect(dwellSince(5000, 4200)).toBe(0);
    expect(dwellSince(0, 10 * 24 * 60 * 60 * 1000)).toBe(24 * 60 * 60 * 1000);
    expect(dwellSince(NaN, 1)).toBe(0);
  });
});
