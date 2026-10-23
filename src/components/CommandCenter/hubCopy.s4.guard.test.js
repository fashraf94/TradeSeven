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
    COPY.nextAction.label, COPY.nextAction.later, COPY.nextAction.liveTitle, COPY.nextAction.preOpenTitle, COPY.nextAction.openGame,
    COPY.nextAction.liveWhy('Ranked', 'League group', '2h 41m left'), COPY.nextAction.reviewTitle('Oct 3'), COPY.nextAction.reviewTitle(''),
    COPY.nextAction.reviewWhy('CPU', 'Won +11.0'), COPY.nextAction.openReview, COPY.nextAction.firstTitle, COPY.nextAction.firstWhy,
    COPY.brief.label, COPY.brief.loading, COPY.brief.more, COPY.brief.less, COPY.brief.missing, COPY.brief.failed, COPY.brief.retry,
    COPY.brief.forDate('Wed Oct 7'), COPY.brief.generated('5:30 AM ET'), COPY.brief.stale('Wed Oct 7'),
    COPY.history.refresh, COPY.history.refreshing, COPY.history.nextRefresh('11:02 AM ET'),
  ];

  it('none of them says anything about learning, improvement, growth, a visit or a sources count', () => {
    const hits = rendered.flatMap((text) => BANNED.filter((re) => re.test(text)).map((re) => `${re.source}: ${text}`));
    expect(hits).toEqual([]);
  });

  it('the sampled words are not empty, so the scan above is not vacuous', () => {
    expect(rendered.length).toBeGreaterThan(35);
    expect(rendered.every((text) => typeof text === 'string' && text.length > 0)).toBe(true);
  });

  it('the scan catches what it names', () => {
    for (const text of ['Shadow learned from this game', 'Since your last visit', 'Sources · 4', 'Shadow is growing']) {
      expect(BANNED.some((re) => re.test(text)), text).toBe(true);
    }
  });

  it('the activity row name carries no empty second line: a row with no sub reads "text, time"', () => {
    expect(COPY.activity.rowLabel('Deployed', '', 'Oct 21, 4:05 PM ET')).toBe('Deployed, Oct 21, 4:05 PM ET');
    expect(COPY.activity.rowLabel('Deployed', 'BaggerBomb vs CPU', '')).toBe('Deployed: BaggerBomb vs CPU');
  });
});
