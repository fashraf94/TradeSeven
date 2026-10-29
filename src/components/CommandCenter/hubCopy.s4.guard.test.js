// src/components/CommandCenter/hubCopy.s4.guard.test.js
//
// Command Center hub, slice S4 (spec V1.2 §8.2, §8.3, §11.3 "Copy") — the words S4 adds to the copy table, pinned LITERALLY.
// The component rows compare what is on screen with COPY.* (the same string on both sides), so the spec's own words are written
// out here once. hubCopy.guard.test.js already scans every literal of the table for claims the hub cannot back (learning,
// improvement, growth, "since your last visit", a sources count), and this file's sampling reaches the S4 functions with real
// arguments, where a placeholder would hide a branch.

import { describe, expect, it } from 'vitest';
import { HUB_COPY as COPY } from './hub/hubCopy';

const BANNED = [
  /\blearn/i, /\bimprov/i, /\bintelligen/i, /\bsmart(er)?\b/i, /\bearned\b/i, /\btier\b/i, /getting better/i,
  /\bevolv/i, /\bgrow(s|th|ing)?\b/i, /since your last visit/i, /\blevel(s|led)? up\b/i, /\bunlock/i,
  /\bsources?\s*·\s*\d/i, /\bremembers?\b/i, /\bsimulat/i, /\bprototype\b/i, /\billustrative\b/i,
  // R-S4-1: Activity is a projection of records, never an event log or a history of everything.
  /\bevents?\b/i, /\bhistory of\b/i, /\blog\b/i,
];

describe('the spec\'s own words, exactly (§8.2, §8.3)', () => {
  it('the activity kinds: "Game completed", "Deployed", and the two loadout rows with their "since" date', () => {
    expect(COPY.activity.completed).toBe('Game completed');
    expect(COPY.activity.deployed).toBe('Deployed');
    expect(COPY.activity.watchlistEquipped('Oct 21')).toBe('Watchlist equipped · since Oct 21');
    expect(COPY.activity.adjustmentEquipped('Oct 21')).toBe('Adjustment equipped · since Oct 21');
  });

  it('the heading, and the link to the whole list', () => {
    expect(COPY.activity.label).toBe('Recent activity · your last 10 games and current loadout');
    expect(COPY.activity.all(21)).toBe('All activity · 21');
  });

  it('the brief: the five phrases the spec gives', () => {
    expect(COPY.brief.missing).toBe('No brief available');
    expect(`${COPY.brief.failed}${COPY.sep}${COPY.brief.retry}`).toBe("Couldn't load the brief · Retry");
    expect(COPY.brief.forDate('Wed Oct 7')).toBe('Brief for Wed Oct 7');
    expect(COPY.brief.generated('5:30 AM ET')).toBe('Generated 5:30 AM ET');
    expect(COPY.brief.stale('Wed Oct 7')).toBe("Last session's brief · for Wed Oct 7");
  });

  it('the brief\'s age (DRB stale fix, founder ruling Oct 29 2026): "Brief for {date} · {n} sessions old", and "Generated" with its day', () => {
    expect(COPY.brief.aged('Fri Oct 23', 3)).toBe('Brief for Fri Oct 23 · 3 sessions old');
    expect(COPY.brief.aged('Fri Oct 16', 5)).toBe('Brief for Fri Oct 16 · 5 sessions old');
    expect(COPY.brief.generated(COPY.time.et('Fri 8:30 AM'))).toBe('Generated Fri 8:30 AM ET');
  });

  it('the next action: the design\'s words, filled from the record', () => {
    expect(COPY.nextAction.label).toBe('Next action');
    expect(COPY.nextAction.later).toBe('Later');
    expect(COPY.nextAction.liveTitle).toBe('Open your live game');
    expect(COPY.nextAction.reviewTitle('Oct 3')).toBe('Review your Oct 3 game in the Film Room');
    expect(COPY.nextAction.reviewWhy('CPU', 'Lost −101')).toBe('vs CPU · Lost −101 · review available');
    expect(COPY.nextAction.firstTitle).toBe('Play your first BaggerBomb game against a CPU');
  });

  it('a game that has not opened yet says it is deployed and waiting for the open (§8.2)', () => {
    expect(COPY.nextAction.preOpenTitle).toMatch(/deployed/i);
    expect(COPY.games.waitingForOpen).toBe('waiting for the open');
    expect(COPY.nextAction.liveWhy('BaggerBomb', 'CPU', COPY.games.waitingForOpen)).toBe('BaggerBomb vs CPU · waiting for the open');
  });

  it('History\'s Refresh and the next permitted time', () => {
    expect(COPY.history.refresh).toBe('Refresh');
    expect(COPY.history.refreshing).toBe('Refreshing…');
    expect(COPY.history.nextRefresh('11:02 AM ET')).toBe('Next refresh at 11:02 AM ET');
  });
});

describe('no claim the hub cannot back, in S4\'s words as they are rendered (§8.2, §11.3)', () => {
  const rendered = [
    COPY.activity.label, COPY.activity.loading, COPY.activity.empty, COPY.activity.unavailable, COPY.activity.all(12),
    COPY.activity.rowLabel('Game completed', 'vs CPU · Won +11.0', 'Oct 21, 4:05 PM ET'), COPY.activity.rowLabel('Deployed', '', 'Oct 21, 4:05 PM ET'),
    COPY.activity.completed, COPY.activity.deployed, COPY.activity.completedSub('CPU', 'Lost −101'), COPY.activity.deployedSub('BaggerBomb', 'CPU'),
    COPY.activity.watchlistEquipped('Oct 21'), COPY.activity.adjustmentEquipped('Oct 21'),
    COPY.activity.sheetLabel, COPY.activity.sheetTitle, COPY.activity.sheetEyebrow(21),
    COPY.activity.asOf('11:00 AM ET'), COPY.activity.asOf(''), COPY.activity.staleAsOf('11:00 AM ET'), COPY.activity.staleAsOf(''),
    COPY.nextAction.label, COPY.nextAction.later, COPY.nextAction.liveTitle, COPY.nextAction.preOpenTitle, COPY.nextAction.openGame,
    COPY.nextAction.liveWhy('Ranked', 'League group', '2h 41m left'), COPY.nextAction.reviewTitle('Oct 3'), COPY.nextAction.reviewTitle(''),
    COPY.nextAction.reviewWhy('CPU', 'Won +11.0'), COPY.nextAction.openReview, COPY.nextAction.firstTitle, COPY.nextAction.firstWhy,
    COPY.brief.label, COPY.brief.loading, COPY.brief.more, COPY.brief.less, COPY.brief.missing, COPY.brief.failed, COPY.brief.retry,
    COPY.brief.forDate('Wed Oct 7'), COPY.brief.generated('5:30 AM ET'), COPY.brief.stale('Wed Oct 7'),
    COPY.brief.aged('Fri Oct 23', 3), COPY.brief.generated(COPY.time.et('Fri 8:30 AM')),
    COPY.history.refresh, COPY.history.refreshing, COPY.history.nextRefresh('11:02 AM ET'),
  ];

  it('none of them says anything about learning, improvement, growth, a visit or a sources count', () => {
    const hits = rendered.flatMap((text) => BANNED.filter((re) => re.test(text)).map((re) => `${re.source}: ${text}`));
    expect(hits).toEqual([]);
  });

  it('the sampled words are not empty, so the scan above is not vacuous', () => {
    expect(rendered.length).toBeGreaterThan(38);
    expect(rendered.every((text) => typeof text === 'string' && text.length > 0)).toBe(true);
  });

  it('the scan catches what it names', () => {
    for (const text of ['Shadow learned from this game', 'Since your last visit', 'Sources · 4', 'Shadow is growing', 'Activity · 21 events', 'Your activity log']) {
      expect(BANNED.some((re) => re.test(text)), text).toBe(true);
    }
  });

  it('no brief word claims freshness (DRB stale fix): an old brief is never called today\'s, the latest, current, new or live', () => {
    const FRESH = [/\btoday/i, /\blatest\b/i, /\bcurrent\b/i, /\bfresh/i, /\bnew\b/i, /\blive\b/i, /\bthis morning\b/i, /\bup[- ]to[- ]date\b/i, /\bjust\b/i];
    const brief = [
      COPY.brief.label, COPY.brief.loading, COPY.brief.more, COPY.brief.less, COPY.brief.missing, COPY.brief.failed, COPY.brief.retry,
      COPY.brief.forDate('Fri Oct 23'), COPY.brief.stale('Thu Oct 22'), COPY.brief.aged('Tue Oct 20', 3), COPY.brief.generated(COPY.time.et('Fri 8:30 AM')),
    ];
    expect(brief.flatMap((text) => FRESH.filter((re) => re.test(text)).map((re) => `${re.source}: ${text}`))).toEqual([]);
    for (const planted of ["Today's brief", 'Latest brief', 'Brief is current', 'Fresh brief', 'New brief', 'Live brief', 'Generated this morning', 'Up to date']) {
      expect(FRESH.some((re) => re.test(planted)), planted).toBe(true);
    }
  });

  it('the activity row name carries no empty second line: a row with no sub reads "text, time"', () => {
    expect(COPY.activity.rowLabel('Deployed', '', 'Oct 21, 4:05 PM ET')).toBe('Deployed, Oct 21, 4:05 PM ET');
    expect(COPY.activity.rowLabel('Deployed', 'BaggerBomb vs CPU', '')).toBe('Deployed: BaggerBomb vs CPU');
  });
});

describe('the rest of the S4 words, literally (review T-10): a reword of any of them is a decision, not an accident', () => {
  it('the Activity states, its age notes and its sheet', () => {
    expect(COPY.activity.loading).toBe('Checking your activity');
    expect(COPY.activity.empty).toBe('Nothing recorded yet.');
    expect(COPY.activity.unavailable).toBe('Couldn’t load your activity');
    expect(COPY.activity.asOf('11:00 AM ET')).toBe('As of 11:00 AM ET');
    expect(COPY.activity.asOf('')).toBe('As of your last visit');
    expect(COPY.activity.staleAsOf('11:00 AM ET')).toBe('As of 11:00 AM ET · couldn’t refresh');
    expect(COPY.activity.staleAsOf('')).toBe('Couldn’t refresh');
    expect(COPY.activity.sheetLabel).toBe('Recent activity');
    expect(COPY.activity.sheetTitle).toBe('Recent activity');
    expect(COPY.activity.sheetEyebrow(21)).toBe('Activity · 21');
  });

  it('the next action buttons, and the review title without a day', () => {
    expect(COPY.nextAction.openGame).toBe('Open game');
    expect(COPY.nextAction.openReview).toBe('Open Film Room');
    expect(COPY.nextAction.reviewTitle('')).toBe('Review your game in the Film Room');
    expect(COPY.nextAction.firstWhy).toBe('Shadow deploys with your equipped loadout.');
    expect(COPY.nextAction.preOpenTitle).toBe('Your game is deployed');
  });

  it('the brief heading and its controls', () => {
    expect(COPY.brief.label).toBe('Daily Regime Brief');
    expect(COPY.brief.loading).toBe('Checking the brief');
    expect(COPY.brief.more).toBe('More');
    expect(COPY.brief.less).toBe('Less');
    expect(COPY.brief.retry).toBe('Retry');
  });
});
