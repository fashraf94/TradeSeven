// src/components/League/liveDraft/liveDraft.smoke.test.jsx
//
// Render smoke for the Phase-4 Competitive Live Draft client surfaces: the picker,
// the FORMING lobby glimpse, and the AWAITING_OPEN holding state. react-dom/server
// (no DOM → no effects/network), so these prove each surface composes and shows
// its honest copy. The picker's schedule action is stubbed so the Firebase client
// never evals.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../../../services/liveDraftActions', () => ({
  fetchSlotSchedule: () => Promise.resolve({ slots: [] }),
  claimSlot: () => Promise.resolve({}),
  releaseSlot: () => Promise.resolve({}),
  mapSlotActionError: () => 'error',
}));
// AutoDraftFallback pulls the lobby actions (fetchWithAuth → env-gated Firebase
// client) — stubbed for the same reason as the slot actions above.
vi.mock('../../../services/tournamentLobbyActions', () => ({
  quickPlay: () => Promise.resolve({}),
  mapLobbyError: () => 'error',
}));

const LiveDraftAwaiting = (await import('./LiveDraftAwaiting')).default;
const LiveDraftGlimpse = (await import('./LiveDraftGlimpse')).default;
const LiveDraftPicker = (await import('./LiveDraftPicker')).default;
const AutoDraftFallback = (await import('./AutoDraftFallback')).default;
const SlotCenter = (await import('./SlotCenter')).default;

const tokens = {
  bgApp: '#000', bgCard: '#111', textPrimary: '#fff', textMuted: '#888',
  textFaint: '#555', borderDivider: '#333', medalGold: '#fc0', teal: '#0cc', amber: '#f90',
};

describe('LiveDraftAwaiting', () => {
  it('shows the holding state with the Monday anchor + picks', () => {
    const group = {
      battleStartWeek: { anchorEtDate: '2026-07-20', anchorIso: '2026-07-20T13:30:00.000Z' },
      players: [{ odUserId: 'u1', picks: [{ symbol: 'NVDA' }, { symbol: 'AMD' }, { symbol: 'TSLA' }] }],
    };
    const html = renderToString(<LiveDraftAwaiting group={group} tokens={tokens} currentUserId="u1" />);
    expect(html).toContain('Your pod is set');
    expect(html).toContain('Monday, Jul 20'); // fmtAnchorDay('2026-07-20')
    expect(html).toContain('NVDA');
  });
});

describe('LiveDraftGlimpse', () => {
  it('shows seats (you + rival by name), open placeholders, countdown, and leave', () => {
    const group = { scheduledDraftAt: '2099-01-01T00:00:00.000Z', groupMembers: ['u1', 'u2'], seatNames: { u1: 'Ada', u2: 'Bo' } };
    const html = renderToString(<LiveDraftGlimpse group={group} tokens={tokens} currentUserId="u1" onLeave={() => {}} />);
    expect(html).toContain('Your slot is set');
    expect(html).toContain('Draft in');
    expect(html).toContain('You');           // the current user
    expect(html).toContain('Bo');            // the rival by name
    expect(html).toContain('Open');          // two CPU-fill placeholders
    expect(html).toContain('Leave this slot');
  });
});

describe('LiveDraftPicker', () => {
  it('composes the picker shell (loading state before the async schedule read)', () => {
    const html = renderToString(<LiveDraftPicker tokens={tokens} currentUserId="u1" />);
    expect(html).toContain('Pick a draft slot');
    expect(html).toContain('Loading slots…'); // effects/network don't run in SSR
  });
});

describe('AutoDraftFallback', () => {
  it('composes the fallback lane — and NEVER says "training" (it forms a real ranked group)', () => {
    const html = renderToString(<AutoDraftFallback tokens={tokens} />);
    expect(html).toContain('Auto-draft');
    expect(html).toContain('we draft your board Monday');
    expect(html).not.toMatch(/training/i);
  });
});

describe('SlotCenter', () => {
  it('composes the no-game center: picker + Auto-draft below + the demoted bracket footnote', () => {
    const html = renderToString(<SlotCenter currentUserId="u1" />);
    expect(html).toContain('Pick a draft slot');
    expect(html).toContain('Auto-draft');
    expect(html).toContain('opens when the season locks');
  });
});
