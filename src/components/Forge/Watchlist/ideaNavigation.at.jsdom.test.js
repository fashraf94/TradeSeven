// @vitest-environment jsdom
//
// src/components/Forge/Watchlist/ideaNavigation.at.jsdom.test.js
//
// Film Room B2.1 B2 (Build B Amendment H RH-2) — P1c's one door into a
// battle's Film Room (requestOpenBattleReview, OPEN_BATTLE_REVIEW_EVENT) gains
// an OPTIONAL day-and-moment field, additively:
//   · P1c's own call (no second argument) dispatches exactly what it did —
//     `detail` holds the battle and nothing else;
//   · a card's recurrence in another battle adds `detail.at`, `{ etDate,
//     moment }`, the moment cut to the four keys that name it;
//   · a malformed day or moment is never sent: the event is P1c's own, and the
//     Film Room opens on its default day;
//   · battleReviewAtOf is the one check, used again where the Film Room reads it.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OPEN_BATTLE_REVIEW_EVENT, requestOpenBattleReview, battleReviewAtOf } from './ideaNavigation';
// review AL3-3: the server counter keeps a day by isEtDate; P1c's file holds its own copy of the check (importing the
// tape schedule there would add a line outside B2.1's `at` check and pull the market calendar into a Forge helper), so
// this test pins the two to agree
import { isEtDate } from '../../../utils/tapeSchedule';

const BATTLE = Object.freeze({ id: 'b-other', ownerId: 'owner-1', status: 'completed' });
const MOMENT = Object.freeze({ situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5, from: '2026-09-25T14:00:00.000Z', to: '2026-09-25T14:30:00.000Z', checks: 2 });
const WANT = { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 };

let events;
const on = (e) => events.push(e.detail);
beforeEach(() => { events = []; window.addEventListener(OPEN_BATTLE_REVIEW_EVENT, on); });
afterEach(() => { window.removeEventListener(OPEN_BATTLE_REVIEW_EVENT, on); });

describe('B2.1 B2 — the open event\'s optional day and moment, additive to P1c', () => {
  it('P1c\'s own call is unchanged: the detail holds the battle, and nothing else', () => {
    expect(requestOpenBattleReview(BATTLE)).toBe(true);
    expect(events).toHaveLength(1);
    expect(Object.keys(events[0])).toEqual(['battle']);
    expect(events[0].battle).toBe(BATTLE);
    // an explicit null is the same call
    expect(requestOpenBattleReview(BATTLE, null)).toBe(true);
    expect(Object.keys(events[1])).toEqual(['battle']);
  });

  it('with a day and moment: `detail.at` carries them, the moment cut to the keys that name it', () => {
    expect(requestOpenBattleReview(BATTLE, { etDate: '2026-09-25', moment: MOMENT })).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].battle).toBe(BATTLE);
    expect(events[0].at).toEqual({ etDate: '2026-09-25', moment: WANT });
    // a moment whose tick seqs the tape left null still names a moment
    requestOpenBattleReview(BATTLE, { etDate: '2026-09-25', moment: { ...MOMENT, fromTickSeq: null, toTickSeq: null } });
    expect(events[1].at.moment).toEqual({ ...WANT, fromTickSeq: null, toTickSeq: null });
  });

  it('a malformed day or moment is not sent — the event is P1c\'s own', () => {
    const bad = [
      { moment: MOMENT },
      { etDate: '2026-9-25', moment: MOMENT },
      { etDate: '2026-09-25T00:00', moment: MOMENT },   // review SPR-T-9: the whole string a date, anchored
      { etDate: 20260925, moment: MOMENT },
      { etDate: '2026-09-25' },
      { etDate: '2026-09-25', moment: { ...MOMENT, situationId: '' } },
      { etDate: '2026-09-25', moment: { ...MOMENT, symbol: undefined } },
      { etDate: '2026-09-25', moment: { ...MOMENT, fromTickSeq: -1 } },
      { etDate: '2026-09-25', moment: { ...MOMENT, toTickSeq: 4.5 } },
      { etDate: '2026-09-25', moment: { ...MOMENT, toTickSeq: '5' } },
      'at',
    ];
    for (const at of bad) {
      events = [];
      expect(requestOpenBattleReview(BATTLE, at), JSON.stringify(at)).toBe(true);
      expect(Object.keys(events[0]), JSON.stringify(at)).toEqual(['battle']);
    }
  });

  it('no battle, no event — with or without a day and moment, as before', () => {
    expect(requestOpenBattleReview(null, { etDate: '2026-09-25', moment: MOMENT })).toBe(false);
    expect(requestOpenBattleReview({ id: '' }, { etDate: '2026-09-25', moment: MOMENT })).toBe(false);
    expect(events).toEqual([]);
  });

  it('Astra\'s B2.1 review §4 item 1 — a day that is not a real calendar date, or a reversed range, is dropped as malformed: P1c\'s own event, byte for byte (the mutants: an impossible date accepted; a reversed range accepted)', () => {
    const bad = [
      { etDate: '2026-02-30', moment: MOMENT },   // Astra's repros
      { etDate: '2026-99-99', moment: MOMENT },
      { etDate: '2026-09-25', moment: { ...MOMENT, fromTickSeq: 5, toTickSeq: 4 } },
      { etDate: '2026-02-29', moment: MOMENT },   // 2026 is not a leap year
      { etDate: '2026-04-31', moment: MOMENT },
      { etDate: '2026-13-01', moment: MOMENT },
      { etDate: '2026-00-10', moment: MOMENT },
      { etDate: '2026-09-00', moment: MOMENT },
      { etDate: '2026-09-25', moment: { ...MOMENT, fromTickSeq: 1, toTickSeq: 0 } },
      { etDate: '0026-09-25', moment: MOMENT },   // review AL3-4: a year before 100 — Date.UTC reads it as 19xx, so it is no such date
      { etDate: '12026-09-25', moment: MOMENT },   // review ALT-27: the whole string a date — a five-digit year round-trips
      { etDate: '2026-09-25-01', moment: MOMENT },   // review ALT-28: …to its end
      { etDate: ['2026-09-25'], moment: MOMENT },   // review ALT-29: a string, never a value that only stringifies to a date
    ];
    for (const at of bad) {
      events = [];
      expect(battleReviewAtOf(at, 'b-other'), JSON.stringify(at)).toBeNull();
      expect(requestOpenBattleReview(BATTLE, at), JSON.stringify(at)).toBe(true);
      expect(events[0], JSON.stringify(at)).toEqual({ battle: BATTLE });
      expect(Object.keys(events[0]), JSON.stringify(at)).toEqual(['battle']);
    }
  });

  it('the controls: a real date — a leap day, a month\'s last day — and an ordered range, a one-check moment among them, pass; the approved null-sequence moments still pass', () => {
    const good = [
      [{ etDate: '2026-09-25', moment: MOMENT }, WANT],
      [{ etDate: '2028-02-29', moment: MOMENT }, WANT],
      [{ etDate: '2026-04-30', moment: MOMENT }, WANT],
      [{ etDate: '2026-12-31', moment: MOMENT }, WANT],
      [{ etDate: '2026-09-25', moment: { ...MOMENT, fromTickSeq: 5, toTickSeq: 5 } }, { ...WANT, fromTickSeq: 5, toTickSeq: 5 }],
      [{ etDate: '2026-09-25', moment: { ...MOMENT, fromTickSeq: 0, toTickSeq: 40 } }, { ...WANT, fromTickSeq: 0, toTickSeq: 40 }],
      // null sequences, as approved: either bound, or both, the tape left null — no order to check
      [{ etDate: '2026-09-25', moment: { ...MOMENT, fromTickSeq: null, toTickSeq: null } }, { ...WANT, fromTickSeq: null, toTickSeq: null }],
      [{ etDate: '2026-09-25', moment: { ...MOMENT, fromTickSeq: 9, toTickSeq: null } }, { ...WANT, fromTickSeq: 9, toTickSeq: null }],
      [{ etDate: '2026-09-25', moment: { ...MOMENT, fromTickSeq: null, toTickSeq: 2 } }, { ...WANT, fromTickSeq: null, toTickSeq: 2 }],
    ];
    for (const [at, moment] of good) {
      events = [];
      expect(battleReviewAtOf(at, 'b-other'), JSON.stringify(at)).toEqual({ battleId: 'b-other', etDate: at.etDate, moment });
      requestOpenBattleReview(BATTLE, at);
      expect(events[0].at, JSON.stringify(at)).toEqual({ etDate: at.etDate, moment });
    }
  });

  it('review AL3-3: the day check agrees with the tape schedule\'s isEtDate — the check the server counter keeps its days by — over every month and day of a leap, a common, a century and a 1900s year, and a pre-100 year', () => {
    const MOMENT_ONLY = { etDate: null, moment: MOMENT };
    let checked = 0;
    for (const y of ['0026', '1999', '2000', '2026', '2028', '2100']) {
      for (let mo = 0; mo <= 13; mo += 1) {
        for (let d = 0; d <= 32; d += 1) {
          const etDate = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          expect(battleReviewAtOf({ ...MOMENT_ONLY, etDate }, 'b-other') !== null, etDate).toBe(isEtDate(etDate));
          checked += 1;
        }
      }
    }
    expect(checked).toBe(6 * 14 * 33);
  });

  it('battleReviewAtOf: the checked day and moment for one battle, or null', () => {
    expect(battleReviewAtOf({ etDate: '2026-09-25', moment: MOMENT }, 'b-other')).toEqual({ battleId: 'b-other', etDate: '2026-09-25', moment: WANT });
    expect(battleReviewAtOf({ etDate: '2026-09-25', moment: MOMENT }, '')).toBeNull();
    expect(battleReviewAtOf({ etDate: '2026-09-25', moment: MOMENT }, null)).toBeNull();
    expect(battleReviewAtOf(null, 'b-other')).toBeNull();
    expect(battleReviewAtOf(undefined, 'b-other')).toBeNull();
  });
});
