// The Command Center S8 fix build, ruling R-S8F-7 (the S8 review's S8-2 and K-1): the live games, counted ONCE beside
// liveGamesOf, for the Games header and Shadow's status line.

import { describe, expect, it } from 'vitest';
import { liveCountsOf } from './hubModel';

const opened = (id, ending = false) => ({ id, live: true, preOpen: false, ending });
const waiting = (id) => ({ id, live: true, preOpen: true, ending: false });

describe('liveCountsOf — one count of live games', () => {
  it('opened and waiting apart; the total is the live list', () => {
    expect(liveCountsOf({ status: 'ready', live: [opened('a'), waiting('b'), waiting('c')] })).toEqual({ opened: 1, waiting: 2, allEnding: false });
    expect(liveCountsOf({ status: 'loading', live: [waiting('b')] })).toEqual({ opened: 0, waiting: 1, allEnding: false });
  });

  it('allEnding: every opened game past its end, and at least one opened', () => {
    expect(liveCountsOf({ live: [opened('a', true), opened('b', true), waiting('c')] }).allEnding).toBe(true);
    expect(liveCountsOf({ live: [opened('a', true), opened('b', false)] }).allEnding).toBe(false);
    expect(liveCountsOf({ live: [waiting('c')] }).allEnding).toBe(false);
    expect(liveCountsOf({ live: [] }).allEnding).toBe(false);
  });

  it('reads the same list liveGamesOf does: the section\'s own `live`, else its ready rows (the layout fixtures)', () => {
    expect(liveCountsOf({ status: 'ready', rows: [opened('a'), { id: 'd', live: false }] })).toEqual({ opened: 1, waiting: 0, allEnding: false });
    expect(liveCountsOf({ status: 'loading', rows: [opened('a')] })).toEqual({ opened: 0, waiting: 0, allEnding: false });
    expect(liveCountsOf(undefined)).toEqual({ opened: 0, waiting: 0, allEnding: false });
  });
});
