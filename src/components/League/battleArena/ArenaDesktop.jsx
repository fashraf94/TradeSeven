// src/components/League/battleArena/ArenaDesktop.jsx
//
// League Battle View V2 — THE DESKTOP ARENA. Three bands: the top strip, the
// competition climb HERO, and the nine-star COMMAND DOCK (agent's six · your
// three · the state panel). The live engine fires beats that flare a star and
// fly points up the climb; awaiting locks at rest; complete shows the verdict.
//
// Translated from the locked Claude Design (battle-arena-desktop ArenaDesktop),
// re-skinned onto the shared League palette and fed by the Phase-1-shaped preview
// fixtures. Fixed design geometry (1316-wide hero) — the entry (LeagueBattleArena)
// scales it to fit the viewport.

import React from 'react';
import { ArenaTopStrip, BeatCaption } from './ArenaPrimitives';
import { ClimbArena } from './ClimbArena';
import { DockAgentSix, DockYourThree, DockStatePanel } from './CommandDock';
import { FreeAgencyDoorway, OpponentSnapshot, FilmRoomOverlay } from './ArenaOverlays';
import { useArenaEngine } from './useArenaEngine';
import { frameDayIdx } from './arenaStateMap';
import { AD_W, AD_H, HERO_W, HERO_H, DOCK_H } from './arenaLayout';
import {
  ARENA_SEATS, ARENA_CLIMB, ARENA_YOU, ARENA_POD, ARENA_WIRE, ARENA_VOICE, ARENA_ASK,
  ARENA_BEATS, ARENA_AGENT_MOVE, arenaAgentStars, arenaUserStars,
} from './arenaFixtures';

export function ArenaDesktop({ state, mode, headline = 'mult', onBack }) {
  const live = state === 'live';
  const done = state === 'complete';
  const calm = state === 'awaiting';

  const eng = useArenaEngine({
    active: live, voice: ARENA_VOICE, beats: ARENA_BEATS, ask: ARENA_ASK,
    closeStart: calm ? ARENA_POD.toOpen : ARENA_POD.nextClose, wireStart: ARENA_WIRE.closes,
  });

  const [opp, setOpp] = React.useState(null);
  const [filmOpen, setFilmOpen] = React.useState(false);
  const [faOpen, setFaOpen] = React.useState(false);
  React.useEffect(() => { setOpp(null); setFilmOpen(false); setFaOpen(false); }, [state, mode]);

  const lastIdx = frameDayIdx(state);
  const ranking = ARENA_SEATS.map((s) => ({ id: s.id, v: ARENA_CLIMB[s.id]?.[lastIdx] ?? 0 })).sort((a, b) => b.v - a.v);
  const youIdx = ranking.findIndex((s) => s.id === ARENA_YOU);
  const youRank = youIdx >= 0 ? youIdx + 1 : ranking.length; // not found → last, never 0 / a false "advanced"

  const agentStars = arenaAgentStars(state);
  const userStars = arenaUserStars(state);
  const oppSeat = opp ? ARENA_SEATS.find((s) => s.id === opp) : null;

  return (
    <div style={{ width: AD_W, height: AD_H, position: 'relative', display: 'flex', flexDirection: 'column', padding: '14px 22px 16px' }}>
      <ArenaTopStrip mode={mode} state={state} pod={ARENA_POD} closeClock={eng.closeClock} onBack={onBack} />

      {/* THE HERO — the competition climb */}
      <div style={{ position: 'relative', marginTop: 11 }}>
        <ClimbArena state={state} mode={mode} seats={ARENA_SEATS} climb={ARENA_CLIMB} youId={ARENA_YOU}
          w={HERO_W} h={HERO_H} surge={live ? eng.surge : null} onPlayer={done ? null : setOpp} />
        {live && eng.beat && (
          <div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 25, pointerEvents: 'none' }}>
            <BeatCaption beat={eng.beat} />
          </div>
        )}
      </div>

      {/* THE COMMAND DOCK — your stars, always in reach */}
      <div style={{ height: DOCK_H, marginTop: 11, display: 'flex', gap: 12, minHeight: 0 }}>
        <DockAgentSix stars={agentStars} dormant={calm} complete={done} beatStar={live ? eng.beatStar : null}
          flareKey={live ? eng.flareKey : 0} headline={headline} move={ARENA_AGENT_MOVE} style={{ flex: 1.35 }} />
        <DockYourThree stars={userStars} dormant={calm} complete={done} state={state} wire={ARENA_WIRE} wireClock={eng.wireClock}
          beatStar={live ? eng.beatStar : null} onFlip={eng.flip} onClaim={() => setFaOpen(true)} headline={headline} style={{ flex: 1.3 }} />
        <DockStatePanel state={state} mode={mode} eng={eng} archName={ARENA_VOICE.arch} voice={ARENA_VOICE} pod={ARENA_POD}
          ask={ARENA_ASK} youRank={youRank} onFilm={() => setFilmOpen(true)} style={{ flex: 1.02 }} />
      </div>

      {done && filmOpen && <FilmRoomOverlay onClose={() => setFilmOpen(false)} />}
      {faOpen && <FreeAgencyDoorway onClose={() => setFaOpen(false)} />}
      {oppSeat && <OpponentSnapshot seat={oppSeat} composite={ARENA_CLIMB[opp]?.[lastIdx] ?? 0} onClose={() => setOpp(null)} />}
    </div>
  );
}
