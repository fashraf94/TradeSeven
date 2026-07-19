// src/components/League/WhileYouWait.smoke.test.jsx
//
// Render smoke for the Seated Waiting Room ("While you wait"). The existing lobby
// smokes render via react-dom/server, so effects never run and activeGroup stays
// null — meaning they only ever exercise the NO-GAME (SlotCenter) center and can
// NEVER reach the seated arm. This test drives the seated module directly (by
// props), the way liveDraft.smoke renders the center pieces, to lock: the hero
// START vs RETURN swap (R1: never two training CTAs), the status-driven headline
// swap, the honest bracket footnote, and the conditional secondary rows.
//
// quickPlayTraining / mapLobbyError transitively pull the env-gated Firebase
// client; stub them (the sibling lobby-smoke pattern) so the render stays pure.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GROUP_STATUS } from '../../constants/leagueTournament';

vi.mock('../../services/tournamentLobbyActions', () => ({
  quickPlayTraining: () => Promise.resolve({}),
  mapLobbyError: () => 'error',
}));

const WhileYouWait = (await import('./WhileYouWait')).default;

// A surface state with one live pod (so the "Watch a live game" row shows).
const liveSt = { rounds: { r1: [{ id: 'p1', status: 'live', seats: [{ id: 's1', you: true }] }], r2: [], r3: null }, baseGames: [] };

describe('WhileYouWait (Seated Waiting Room) render smoke', () => {
  it('cold-start: hero START CTA + honesty line + both secondaries + bracket footnote', () => {
    const html = renderToString(
      <WhileYouWait viewport="mobile" status={GROUP_STATUS.FORMING} st={liveSt} activeTrainingPod={null} onOpenTrainingPod={() => {}} hasAgent onOpenBaggerBomb={() => {}} onSpectate={() => {}} />,
    );
    expect(html).toContain('While you wait');                              // the waiting headline
    expect(html).toContain('Sharpen up in a Training Pod');               // the hero START CTA
    expect(html).toContain('Practice runs never touch the leaderboard');  // the one quiet honesty line
    expect(html).toContain('Play a BaggerBomb round');                    // secondary — BaggerBomb
    expect(html).toContain('Watch a live game');                          // secondary — a live pod exists
    expect(html).toContain('opens when the season locks');                // the honest bracket footnote (precedent copy)
    expect(html).not.toContain('Return to your Training Pod');            // R1: no return CTA without an active pod
  });

  it('active training pod: hero swaps to RETURN, never two training CTAs', () => {
    const pod = { id: 'tp1', status: GROUP_STATUS.BATTLE };
    const html = renderToString(
      <WhileYouWait viewport="desktop" status={GROUP_STATUS.DRAFTING} st={liveSt} activeTrainingPod={pod} onOpenTrainingPod={() => {}} hasAgent onOpenBaggerBomb={() => {}} onSpectate={() => {}} />,
    );
    expect(html).toContain('Return to your Training Pod');
    expect(html).not.toContain('Sharpen up in a Training Pod');           // R1: exactly one training CTA
  });

  it('headline swaps to "Between sessions" for a BATTLE group (a live player is not waiting)', () => {
    const html = renderToString(<WhileYouWait status={GROUP_STATUS.BATTLE} st={liveSt} onOpenTrainingPod={() => {}} hasAgent />);
    expect(html).toContain('Between sessions');
    expect(html).not.toContain('While you wait');
  });

  it('no live pod → no "Watch a live game" row; no bagger handler → no bagger row', () => {
    const emptySt = { rounds: { r1: [], r2: [], r3: null }, baseGames: [] };
    const html = renderToString(<WhileYouWait status={GROUP_STATUS.AWAITING_OPEN} st={emptySt} onOpenTrainingPod={() => {}} hasAgent />);
    expect(html).not.toContain('Watch a live game');
    expect(html).not.toContain('Play a BaggerBomb round');
    expect(html).toContain('Sharpen up in a Training Pod');               // the hero still renders
  });
});
