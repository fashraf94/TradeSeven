// src/components/League/WhileYouWait.smoke.test.jsx
//
// Render smoke for the Seated Waiting Room ("While you wait"). The existing lobby
// smokes render via react-dom/server, so effects never run and activeGroup stays
// null — meaning they only ever exercise the NO-GAME (SlotCenter) center and can
// NEVER reach the seated arm. This test drives the seated module directly (by
// props), the way liveDraft.smoke renders the center pieces, to lock: the hero
// START vs RETURN swap (R1: never two training CTAs), the status-driven headline
// swap, the honest bracket footnote, the draft-not-bracket blurb, and the
// conditional Spectate row. (The BaggerBomb secondary was scoped then pulled —
// the underlying AWAITING_OPEN/agent-deploy conflict is ledgered instead; the
// module must carry no BaggerBomb affordance.)
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
  it('cold-start: hero START CTA + honesty line + Spectate + draft blurb + bracket footnote', () => {
    const html = renderToString(
      <WhileYouWait viewport="mobile" status={GROUP_STATUS.FORMING} st={liveSt} activeTrainingPod={null} onOpenTrainingPod={() => {}} hasAgent onSpectate={() => {}} />,
    );
    expect(html).toContain('While you wait');                              // the waiting headline
    expect(html).toContain('Sharpen up in a Training Pod');               // the hero START CTA
    expect(html).toContain('Practice runs never touch the leaderboard');  // the one quiet honesty line
    expect(html).toContain('Watch a live game');                          // secondary — a live pod exists
    expect(html).toContain('before the draft');                           // seated blurb references the draft…
    expect(html).not.toContain('next bracket');                           // …not a bracket (the user holds a slot pod)
    expect(html).toContain('opens when the season locks');                // the honest bracket footnote (precedent copy)
    expect(html).not.toContain('Return to your Training Pod');            // R1: no return CTA without an active pod
    expect(html).not.toContain('BaggerBomb');                             // the BaggerBomb secondary is pulled
  });

  it('active training pod: hero swaps to RETURN, never two training CTAs', () => {
    const pod = { id: 'tp1', status: GROUP_STATUS.BATTLE };
    const html = renderToString(
      <WhileYouWait viewport="desktop" status={GROUP_STATUS.DRAFTING} st={liveSt} activeTrainingPod={pod} onOpenTrainingPod={() => {}} hasAgent onSpectate={() => {}} />,
    );
    expect(html).toContain('Return to your Training Pod');
    expect(html).not.toContain('Sharpen up in a Training Pod');           // R1: exactly one training CTA
  });

  it('headline swaps to "Between sessions" for a BATTLE group (a live player is not waiting)', () => {
    const html = renderToString(<WhileYouWait status={GROUP_STATUS.BATTLE} st={liveSt} onOpenTrainingPod={() => {}} hasAgent />);
    expect(html).toContain('Between sessions');
    expect(html).not.toContain('While you wait');
  });

  it('no live pod → no "Watch a live game" row; the hero still renders', () => {
    const emptySt = { rounds: { r1: [], r2: [], r3: null }, baseGames: [] };
    const html = renderToString(<WhileYouWait status={GROUP_STATUS.AWAITING_OPEN} st={emptySt} onOpenTrainingPod={() => {}} hasAgent onSpectate={() => {}} />);
    expect(html).not.toContain('Watch a live game');
    expect(html).toContain('Sharpen up in a Training Pod');               // the hero still renders
  });
});

// ── PRE-OPEN PHASE (PREOPEN_PHASE_ROUTING_ENABLED) ───────────────────────────
// `preOpen` is bound by the caller to the same activeGroup that supplies
// `status`. A pre-open player IS still waiting, so the room must not claim the
// game is live.
describe('WhileYouWait — pre-open phase', () => {
  const emptySt2 = { baseGames: [], rounds: { r1: [], r2: [], r3: null } };

  it('a pre-open BATTLE pod keeps "While you wait", not "Between sessions"', () => {
    const html = renderToString(
      <WhileYouWait status={GROUP_STATUS.BATTLE} preOpen st={emptySt2} onOpenTrainingPod={() => {}} hasAgent />,
    );
    expect(html).toContain('While you wait');
    expect(html).toContain('Your seat is locked in');
    expect(html).not.toContain('Between sessions');
    expect(html).not.toContain('Your game is live');
  });

  it('a pre-open pod is NOT told to sharpen up "before the draft" — it already drafted', () => {
    // Phase 5 review finding F3. Before this phase existed the non-inBattle arm was
    // reachable only for a FORMING pod. A pre-open pod has already drafted — for the
    // Mon 08:45 slot, minutes earlier — so inheriting pre-draft copy is a lie.
    const html = renderToString(
      <WhileYouWait status={GROUP_STATUS.BATTLE} preOpen st={emptySt2} onOpenTrainingPod={() => {}} hasAgent />,
    );
    expect(html).not.toContain('before the draft');
    expect(html).toContain('The battle opens at the next market open.');
  });

  it('a FORMING pod KEEPS the pre-draft copy (the arm it was written for)', () => {
    const html = renderToString(
      <WhileYouWait status={GROUP_STATUS.FORMING} st={emptySt2} onOpenTrainingPod={() => {}} hasAgent />,
    );
    expect(html).toContain('before the draft');
  });

  it('the SAME pod reads live once the bell has rung', () => {
    const html = renderToString(
      <WhileYouWait status={GROUP_STATUS.BATTLE} preOpen={false} st={emptySt2} onOpenTrainingPod={() => {}} hasAgent />,
    );
    expect(html).toContain('Between sessions');
    expect(html).toContain('Your game is live');
  });

  it('flag-off arm: omitting preOpen is byte-identical to passing false', () => {
    const omitted = renderToString(
      <WhileYouWait status={GROUP_STATUS.BATTLE} st={emptySt2} onOpenTrainingPod={() => {}} hasAgent />,
    );
    const explicit = renderToString(
      <WhileYouWait status={GROUP_STATUS.BATTLE} preOpen={false} st={emptySt2} onOpenTrainingPod={() => {}} hasAgent />,
    );
    expect(omitted).toBe(explicit);
  });

  it('preOpen does not disturb a non-BATTLE status', () => {
    const html = renderToString(
      <WhileYouWait status={GROUP_STATUS.AWAITING_OPEN} preOpen st={emptySt2} onOpenTrainingPod={() => {}} hasAgent />,
    );
    expect(html).toContain('While you wait');
  });
});

// ── DOCUMENTED LIMIT (Phase 5 review finding F2) ─────────────────────────────
// This is an executable record of a KNOWN, deliberately-deferred incoherence, not
// an endorsement of it. `liveWatchPod` (WhileYouWait.jsx:83-91) classifies pods by
// the adapter's `status === 'live'`, which is chokepoint B — untouched by ruling
// R-9 until the startAnchor stamp lands. So with the pre-open flag ON, this one
// component can simultaneously say "While you wait" AND offer to spectate the
// viewer's own pod as live.
//
// The row below PINS that contradiction. When chokepoint B lands it will fail,
// which is the point: it forces this surface to be revisited rather than letting
// the contradiction survive silently. The prior suite could not see it at all —
// every case passed an empty `st`, so liveWatchPod was always null.
describe('WhileYouWait — documented limit: the live-watch CTA still reads chokepoint B', () => {
  const livePodSt = {
    baseGames: [{ id: 'g-live', status: 'live', seats: [{ id: 's1', you: true }] }],
    rounds: { r1: [], r2: [], r3: null },
  };

  it('offers "Watch a live game" for a pod the same render calls pre-open (KNOWN GAP)', () => {
    const html = renderToString(
      <WhileYouWait
        status={GROUP_STATUS.BATTLE}
        preOpen
        st={livePodSt}
        onOpenTrainingPod={() => {}}
        onSpectate={() => {}}
        hasAgent
      />,
    );
    expect(html).toContain('While you wait');       // the pre-open half
    expect(html).toContain('Watch a live game');    // the chokepoint-B half — contradictory
  });

  it('the contradiction needs a live pod in `st` — an empty field cannot show it', () => {
    // Guards against the blind spot the original suite had: with an empty `st` the
    // CTA never renders, so a test written that way proves nothing about F2.
    const html = renderToString(
      <WhileYouWait status={GROUP_STATUS.BATTLE} preOpen st={{ baseGames: [], rounds: { r1: [], r2: [], r3: null } }}
        onOpenTrainingPod={() => {}} onSpectate={() => {}} hasAgent />,
    );
    expect(html).not.toContain('Watch a live game');
  });
});
