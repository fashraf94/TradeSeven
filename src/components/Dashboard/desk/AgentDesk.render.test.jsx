// src/components/Dashboard/desk/AgentDesk.render.test.jsx
//
// Command Center Sync Pass 1, Phase C — the Desk renders what the scoreboard
// says and nothing more. The forbidden-terms guard is a separate file
// (deskHonesty.test.js) because it reads SOURCE text; this one renders.
//
// renderToString + toContain, the repo's universal component-test idiom.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AgentDesk from './AgentDesk.jsx';

// The alert visual owns timers and framer-motion state that add nothing to the
// assertions below; the panel's own behaviour is not what is under test here.
vi.mock('../../Agent/LiveActivityPanel', () => ({
  BreakthroughAlerts: () => null,
}));

const stripComments = (h) => h.replace(/<!-- -->/g, '');

const SYNC = {
  game: { id: 'battle-1', type: 'baggerbomb', label: 'BaggerBomb', agentName: 'Aurora' },
  phase: 'LIVE',
  score: { current: 42, tradeCount: 3 },
  book: [],
  scoreProximity: [
    { symbol: 'NVDA', currentMultiplier: -0.9, targetMultiple: -1.0, direction: 'negative', zoneProgressPercent: 90 },
    { symbol: 'PLTR', currentMultiplier: 1.6, targetMultiple: 2.0, direction: 'positive', zoneProgressPercent: 80 },
  ],
  swapLock: [{ symbol: 'NVDA', locked: true, direction: 'negative', distancePercent: 1.234, message: 'locked' }],
  lastCheckedAt: '2026-09-01T16:47:00.000Z', // 12:47 ET
  nextDecisionAt: '2026-09-01T17:02:00.000Z', // 13:02 ET (a TRUE instant)
  // ET wall-clock fields, the shape the adapter emits for the next open.
  nextOpenEt: { weekdayIndex: 2, hour: 9, minute: 30 }, // Tue 9:30 AM
  proximityStale: false,
  proximityAsOf: '2026-09-01T16:50:00.000Z',
  statusFeedLatest: { message: 'Holding PLTR into the close.', timestamp: '2026-09-01T16:47:00.000Z', action: 'hold' },
  loadout: { archetype: 'momentum_chaser', watchlistLabel: null, benchLocked: true },
};

const render = (over = {}) => stripComments(
  renderToString(<AgentDesk sync={{ ...SYNC, ...over }} accent="#5eead4" />),
);

describe('the Desk renders nothing without an adapter', () => {
  it('null sync → null (this is what flag-off looks like)', () => {
    expect(renderToString(<AgentDesk sync={null} accent="#5eead4" />)).toBe('');
  });
});

describe('the Desk says which battle it describes (F-1)', () => {
  it('renders an agent · mode eyebrow', () => {
    expect(render()).toContain('Aurora · BaggerBomb');
  });

  it('the mode half comes from the adapter, so a ranked battle would say so', () => {
    // The Desk never selects a ranked battle in Pass 1 (F-1's gate), but the
    // label is derived rather than constant, so it cannot silently mislabel.
    const html = render({ game: { id: 'b1', type: 'ranked', label: 'Ranked', agentName: 'Aurora' } });
    expect(html).toContain('Aurora · Ranked');
  });

  it('degrades gracefully when either half is missing', () => {
    expect(render({ game: { id: 'b1', label: 'BaggerBomb', agentName: null } })).toContain('BaggerBomb');
    expect(render({ game: { id: 'b1', label: null, agentName: 'Aurora' } })).toContain('Aurora');
  });
});

describe('posture line — discrete, never continuous', () => {
  it('LIVE names the last check and an APPROXIMATE next one', () => {
    const html = render();
    expect(html).toContain('Checked 12:47 PM · next ~1:02 PM');
    // The ~ is required copy: the cron is not a metronome.
    expect(html).toContain('next ~');
  });

  it('LIVE with no eval yet says a check is coming — never a fabricated time', () => {
    const html = render({ lastCheckedAt: null, nextDecisionAt: null });
    expect(html).toContain('First check coming up');
    expect(html).not.toContain('Checked');
  });

  it('LIVE_CLOSED names the market state and the next check, with no agent verb', () => {
    const html = render({ phase: 'LIVE_CLOSED', nextDecisionAt: null });
    expect(html).toContain('Market closed · next check Tue 9:30 AM ET');
  });

  it('the next-check time comes from WALL-CLOCK FIELDS, so it cannot shift with the viewer zone', () => {
    // The timezone defect: formatting the next open's EPOCH through Intl gave a
    // wrong time (and, far enough east, a wrong day) for every non-ET viewer.
    // These fields are read directly, so the rendered string is fixed.
    const html = render({ phase: 'LIVE_CLOSED', nextOpenEt: { weekdayIndex: 1, hour: 9, minute: 30 } });
    expect(html).toContain('next check Mon 9:30 AM ET');
  });

  it('falls back to a bare "Market closed" when the next open is unknown', () => {
    const html = render({ phase: 'LIVE_CLOSED', nextOpenEt: null });
    expect(html).toContain('Market closed');
    expect(html).not.toContain('next check');
  });

  it('PRE_OPEN states the scheduled open — a fact, not a guess', () => {
    expect(render({ phase: 'PRE_OPEN' })).toContain('First check at 9:30 AM ET');
  });

  it('F-5: every phase names its time in ONE format — h:mm AM/PM ET', () => {
    // A bare "9:30 ET" beside "next check Mon 9:30 AM ET" read as a different
    // kind of time. Each phase's time-bearing line now matches the same shape.
    const preOpen = render({ phase: 'PRE_OPEN' });
    const closed = render({ phase: 'LIVE_CLOSED', nextDecisionAt: null });
    const live = render();
    for (const html of [preOpen, closed, live]) {
      expect(html).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    }
    // ...and the one that regressed is explicitly pinned.
    expect(preOpen).toContain('9:30 AM ET');
    expect(preOpen).not.toMatch(/9:30 ET/);
  });

  it('POST_CLOSE says the battle is complete', () => {
    expect(render({ phase: 'POST_CLOSE' })).toContain('Battle complete');
  });
});

describe('score proximity — scoreboard language only', () => {
  it('names the SCORING tier, never a trade', () => {
    const html = render();
    expect(html).toContain('PLTR · 0.4 ATR from next bonus tier');
    expect(html).toContain('NVDA · 0.1 ATR from next bust tier');
  });

  it('takes the bonus/bust word from the data direction, not from sign math', () => {
    // Same numbers, direction flipped in the DATA → the word follows the data.
    const html = render({
      scoreProximity: [
        { symbol: 'AMD', currentMultiplier: 1.6, targetMultiple: 2.0, direction: 'negative', zoneProgressPercent: 50 },
      ],
    });
    expect(html).toContain('AMD · 0.4 ATR from next bust tier');
  });

  it('omits the whole block when no position carries threshold data', () => {
    const html = render({ scoreProximity: [] });
    expect(html).not.toContain('Scoring proximity');
    expect(html).not.toContain('ATR from next');
  });

  it('renders the progress bar from zoneProgressPercent', () => {
    expect(render()).toContain('width:90%');
  });
});

describe('swap locks — a constraint, not a forecast', () => {
  it('renders distance to UNLOCK, not distance to a trade', () => {
    const html = render();
    expect(html).toContain('NVDA locked · 1.2% from unlock');
    expect(html).not.toContain('about to');
  });

  it('omits the block when nothing is locked', () => {
    const html = render({ swapLock: [] });
    expect(html).not.toContain('Swap locks');
    expect(html).not.toContain('from unlock');
  });

  it('never renders a bare "0.0" for a real but tiny distance', () => {
    // detectRedZone only admits positions close to a threshold, so sub-0.05
    // gaps are common. "0.0 ATR from next bonus tier" reads as "it arrived".
    const html = render({
      scoreProximity: [{ symbol: 'AMD', currentMultiplier: 1.98, targetMultiple: 2.0, direction: 'positive', zoneProgressPercent: 96 }],
      swapLock: [{ symbol: 'AMD', locked: true, distancePercent: 0.02 }],
    });
    // React escapes the leading "<" in the SSR output; it renders as "<0.1".
    expect(html).toContain('AMD · &lt;0.1 ATR from next bonus tier');
    expect(html).toContain('AMD locked · &lt;0.1% from unlock');
    expect(html).not.toContain('0.0 ATR');
    expect(html).not.toContain('0.0% from unlock');
  });

  it('renders a bare lock when no distance is known', () => {
    const html = render({ swapLock: [{ symbol: 'SOFI', locked: true, distancePercent: null }] });
    expect(html).toContain('SOFI locked');
    expect(html).not.toContain('from unlock');
  });
});

describe('staleness — LIVE only (rulings §6)', () => {
  it('LIVE + stale withholds the numbers and says why', () => {
    const html = render({ proximityStale: true });
    expect(html).toContain('Proximity updating');
    expect(html).not.toContain('ATR from next');
    // ...and it does not claim an as-of time it is not showing values for.
    expect(html).not.toContain('as of');
  });

  it('LIVE_CLOSED renders the numbers WITH an as-of stamp — the dormant Desk stays full', () => {
    const html = render({ phase: 'LIVE_CLOSED', proximityAsOf: '2026-08-28T20:00:00.000Z' });
    expect(html).toContain('ATR from next');
    expect(html).toContain('as of Fri 4:00 PM ET');
  });

  it('POST_CLOSE also stamps rather than blanks', () => {
    const html = render({ phase: 'POST_CLOSE', proximityAsOf: '2026-08-28T20:00:00.000Z' });
    expect(html).toContain('as of Fri 4:00 PM ET');
  });

  it('LIVE never shows an as-of stamp — during open hours "current" is the claim', () => {
    expect(render()).not.toContain('as of Tue');
  });
});

describe('the feed line is engine text, verbatim', () => {
  it('renders the message unchanged, with no paraphrase', () => {
    expect(render()).toContain('Holding PLTR into the close.');
  });

  it('renders nothing when there is no feed entry', () => {
    const html = render({ statusFeedLatest: null });
    expect(html).not.toContain('Holding PLTR');
  });

  it('does not truncate the message in JS (CSS ellipsis only)', () => {
    const long = 'A'.repeat(300);
    expect(render({ statusFeedLatest: { message: long, timestamp: null } })).toContain(long);
  });
});
