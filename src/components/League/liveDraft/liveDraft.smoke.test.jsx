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

// useTheme() token names, still used by the picker / auto-draft / SlotCenter
// smokes below (those components are unchanged and consume the tokens prop).
const tokens = {
  bgApp: '#000', bgCard: '#111', textPrimary: '#fff', textMuted: '#888',
  textFaint: '#555', borderDivider: '#333', medalGold: '#fc0', teal: '#0cc', amber: '#f90',
};

// The enriched loadout module reads the agentLoadout prop (name + archetype +
// watchlist NAME — no rule chips, no tickers; the honest Q1/watchlist decision).
const loadout = { name: 'Momentum', archetype: 'Momentum Hunter', equippedWatchlistId: 'w1', equippedWatchlistName: 'Semis Momentum' };

describe('LiveDraftAwaiting', () => {
  it('shows the drafted state: chrome, Monday-open countdown, the 3 real picks, honest agent-six line, loadout', () => {
    const group = {
      battleStartWeek: { anchorEtDate: '2026-07-20', anchorIso: '2026-07-20T13:30:00.000Z' },
      players: [
        { odUserId: 'u1', picks: [{ symbol: 'NVDA' }, { symbol: 'AMD' }, { symbol: 'TSLA' }], isCpu: false },
        { odUserId: 'u2', picks: [], isCpu: false },
        { odUserId: 'cpu-1', picks: [], isCpu: true },
        { odUserId: 'cpu-2', picks: [], isCpu: true },
      ],
      seatNames: { u1: 'Ada', u2: 'Bo', 'cpu-1': 'Helios', 'cpu-2': 'Ember' },
    };
    const html = renderToString(<LiveDraftAwaiting group={group} currentUserId="u1" agentLoadout={loadout} onOpenForge={() => {}} />);
    expect(html).toContain('My game');            // shared chrome eyebrow
    expect(html).toContain('Weekly Pod');         // pod title
    expect(html).toContain('Monday, Jul 20');     // fmtAnchorDay('2026-07-20')
    expect(html).toContain('Trading opens');      // countdown hero eyebrow
    expect(html).toContain('Your three');         // the user lineup
    expect(html).toContain('NVDA');               // a real user pick
    // Honest-empty: the agent's six are NOT fabricated — an honest pending line.
    expect(html).toContain('Your agent drafts its six');
    expect(html).toContain('PENDING');
    // Loadout module (name + archetype + watchlist name; NO chips).
    expect(html).toContain('Your loadout');
    expect(html).toContain('Momentum Hunter');
    expect(html).toContain('Semis Momentum');
    expect(html).toContain('Edit in Forge');
    // No committed-state leave affordance.
    expect(html).not.toContain('Leave this slot');
  });
});

describe('LiveDraftGlimpse', () => {
  it('shows the forming state: chrome, slot countdown, four-seat pod, seat held, loadout, leave', () => {
    const group = { scheduledDraftAt: '2099-01-01T00:00:00.000Z', groupMembers: ['u1', 'u2'], seatNames: { u1: 'Ada', u2: 'Bo' } };
    const html = renderToString(
      <LiveDraftGlimpse group={group} currentUserId="u1" agentLoadout={loadout} onOpenForge={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('My game');            // shared chrome eyebrow
    expect(html).toContain('Weekly Pod');
    expect(html).toContain('Draft countdown');    // the slot countdown hero
    expect(html).toContain('YOUR SLOT');          // the countdown target tag
    expect(html).toContain('You');                // the current user's seat
    expect(html).toContain('Bo');                 // the rival by name
    expect(html).toContain('Open');               // two CPU-fill placeholders
    expect(html).toContain('Fills with CPU at draft');
    expect(html).toContain('Your seat is held');  // the confirmation card
    expect(html).toContain('Your loadout');       // the loadout module
    expect(html).toContain('Edit in Forge');
    expect(html).toContain('Leave this slot');
  });

  it('renders an honest loadout empty-state when no agent is equipped', () => {
    const group = { scheduledDraftAt: '2099-01-01T00:00:00.000Z', groupMembers: ['u1'], seatNames: { u1: 'Ada' } };
    const html = renderToString(
      <LiveDraftGlimpse group={group} currentUserId="u1" agentLoadout={null} onOpenForge={() => {}} onLeave={() => {}} />,
    );
    expect(html).toContain('No agent equipped yet');
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
