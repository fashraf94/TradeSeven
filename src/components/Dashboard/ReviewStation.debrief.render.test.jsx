// src/components/Dashboard/ReviewStation.debrief.render.test.jsx
//
// P-6, the UI half (Pass 1 spec §7 POST_CLOSE, §12 acceptance).
//
// A battle can complete after the day's last agent-batch-review run (20:25 /
// 21:25 UTC weekdays), so its debrief lands on a later run. Showing a Film Room
// entry that opens onto nothing is the thing this replaces.
//
// The copy promises no TIME, deliberately: a battle completing after the last
// run waits for the next one, so "shortly" would be a claim the cron cannot
// honor. P-6's reviewPending queue is what guarantees it arrives at all — the
// card is only honest because that queue exists.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

const { flagState } = vi.hoisted(() => ({ flagState: { on: true } }));
vi.mock('../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get COMMAND_CENTER_SYNC_ENABLED() { return flagState.on; },
}));

const { default: ReviewStation } = await import('./ReviewStation.jsx');

const stripComments = (h) => h.replace(/<!-- -->/g, '');

const battle = (over = {}) => ({
  id: 'b1',
  status: 'completed',
  agentContext: { agentName: 'Aurora' },
  scoreState: { currentScore: 12 },
  dailyReviews: [],
  ...over,
});

const render = (battles) => stripComments(
  renderToString(<ReviewStation battles={battles} agent={{ name: 'Aurora' }} accent="#5eead4" onReview={() => {}} />),
);

describe('lit — a completed battle with no review yet', () => {
  it('says the debrief is on the way instead of offering the tape', () => {
    flagState.on = true;
    const html = render([battle()]);
    expect(html).toContain('Debrief on the way.');
    expect(html).not.toContain('Break down the tape');
  });

  it('promises no time — the cron cannot honor one', () => {
    flagState.on = true;
    const html = render([battle()]);
    for (const word of ['shortly', 'soon', 'minutes', 'tonight']) {
      expect(html.toLowerCase()).not.toContain(word);
    }
  });

  it('a battle WITH a review offers the tape as before', () => {
    flagState.on = true;
    const html = render([battle({ dailyReviews: [{ date: '2026-09-01' }] })]);
    expect(html).toContain('Break down the tape');
    expect(html).not.toContain('Debrief on the way');
  });

  it('an undefined dailyReviews counts as pending, not as reviewed', () => {
    flagState.on = true;
    const b = battle(); delete b.dailyReviews;
    expect(render([b])).toContain('Debrief on the way.');
  });

  it('a still-active battle is never "pending" — it is not owed a debrief yet', () => {
    flagState.on = true;
    expect(render([battle({ status: 'active' })])).toContain('Break down the tape');
  });
});

describe('flag-OFF is byte-identical', () => {
  it('dark, a review-less battle renders exactly as a reviewed one', () => {
    flagState.on = false;
    const pending = render([battle()]);
    flagState.on = false;
    const reviewed = render([battle({ dailyReviews: [{ date: '2026-09-01' }] })]);
    expect(pending).toBe(reviewed);
    expect(pending).toContain('Break down the tape');
    expect(pending).not.toContain('Debrief');
  });
});
