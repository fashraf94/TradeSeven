// api/_utils/backingEvents.test.js
//
// Backing activation — the telemetry writer's DEV MARKER. api/_utils/
// backingEvents.js gained one optional field for the founder smoke: a smoke
// session's event (the founder on a preview; a dev pod's `stake_confirmed`)
// carries `isDev: true` at the top level, so the funnel (spec §10) and the
// cleanup script can tell it from the beta's. Every other document is
// byte-identical to before — the first row proves the default shape has not
// moved. The route-level rows live in api/backing/event.test.js.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import of the module
// below is the runtime guard for its api/ -> src/ import of the constants.

import { describe, it, expect } from 'vitest';
import { buildBackingEvent, recordBackingEvent } from './backingEvents.js';

describe('the dev marker (the activation PR) — a smoke session\'s events are told apart from the beta\'s', () => {
  it('buildBackingEvent writes `isDev: true` ONLY when asked — every other document is byte-identical to before', () => {
    const base = { userId: 'u1', groupId: 'g1', event: 'window_viewed', props: { weekKey: '2026-W40' }, now: '2026-09-22T14:00:00.000Z' };
    expect(buildBackingEvent(base)).toEqual({ userId: 'u1', groupId: 'g1', event: 'window_viewed', at: '2026-09-22T14:00:00.000Z', props: { weekKey: '2026-W40' } });
    expect(buildBackingEvent({ ...base, isDev: false })).not.toHaveProperty('isDev');
    expect(buildBackingEvent({ ...base, isDev: 'true' })).not.toHaveProperty('isDev');
    expect(buildBackingEvent({ ...base, isDev: true })).toMatchObject({ isDev: true, userId: 'u1', event: 'window_viewed' });
  });

  it('recordBackingEvent passes the marker through to the one write', async () => {
    const writes = [];
    const db = { collection: (name) => ({ doc: (id) => ({ set: async (doc) => { writes.push([`${name}/${id}`, doc]); } }) }) };
    await recordBackingEvent(db, { eventId: 'dev:bev_window_viewed_1', userId: 'u1', event: 'window_viewed', isDev: true, now: '2026-09-22T14:00:00.000Z' });
    await recordBackingEvent(db, { eventId: 'bev_window_viewed_2', userId: 'u1', event: 'window_viewed', now: '2026-09-22T14:00:00.000Z' });
    expect(writes[0][0]).toBe('backingEvents/dev:bev_window_viewed_1');
    expect(writes[0][1]).toMatchObject({ isDev: true });
    expect(writes[1][1]).not.toHaveProperty('isDev');
  });
});
