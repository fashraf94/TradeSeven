// src/components/Agent/GameplanMeetingCard.render.test.jsx
//
// The meeting card shows the deadline the server wrote (BUILD_RULES §9). The
// meeting expires at the earlier of 60 minutes after creation and 4:00 PM ET
// (api/cron/agent-evaluate.js gameplanMeetingExpiresAt), so the old fixed
// "Expires EOD" was wrong for every meeting created before 3:00 PM ET. The card
// renders `meeting.expiresAt` as an ET wall-clock time through etTime()
// (Intl, America/New_York), so the words do not depend on the host timezone.
// An unreadable deadline shows no time rather than an invented one.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

// The card reaches firebase through agentService; rendering never calls it.
vi.mock('../../services/agentService', () => ({
  resolveGameplanMeeting: vi.fn(), appendBattleLedger: vi.fn(),
}));

import GameplanMeetingCard from './GameplanMeetingCard';

const TOKENS = { bgCard: '#111827', textFaint: '#64748b', textMuted: '#94a3b8', textPrimary: '#ffffff', textSecondary: '#cbd5e1' };
const meeting = (expiresAt) => ({
  id: 'gpm_1', status: 'pending', diagnosis: 'Consumer Cyclical sector dragging performance.',
  opportunity: 'Technology showing strength.', suggestedSwaps: [{ symbolOut: 'TSLA', symbolIn: 'AMD', rationale: 'r' }],
  createdAt: '2026-07-15T14:30:00.000Z', expiresAt,
});
const render = (m) => renderToString(<GameplanMeetingCard battleId="b1" meeting={m} tokens={TOKENS} />);

describe('GameplanMeetingCard — the deadline the server wrote, in ET', () => {
  it('a 60-minute deadline (created 10:30 AM EDT) reads "Expires 11:30 AM ET"', () => {
    expect(render(meeting('2026-07-15T15:30:00.000Z'))).toContain('Expires 11:30 AM ET');
  });

  it('a 4:00 PM deadline in winter time (EST, 21:00 UTC) reads "Expires 4:00 PM ET"', () => {
    expect(render(meeting('2026-11-02T21:00:00.000Z'))).toContain('Expires 4:00 PM ET');
  });

  it('never the old fixed "Expires EOD"', () => {
    expect(render(meeting('2026-07-15T15:30:00.000Z'))).not.toContain('EOD');
  });

  it.each([
    ['missing', undefined],
    ['not a date', 'not a date'],
    ['a number', 1789000000000],
    ['an owner-written object whose toString is not a function', { toString: 1 }],
  ])('an unreadable deadline (%s) shows no time and the card still renders', (_label, expiresAt) => {
    const html = render(meeting(expiresAt));
    expect(html).toContain('Consumer Cyclical sector dragging performance.');
    expect(html).not.toContain('Expires');
  });
});
