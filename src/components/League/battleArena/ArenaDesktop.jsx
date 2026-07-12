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
import { FreeAgencyDoorway, OpponentSnapshot, FilmRoomOverlay, DepartedLedger } from './ArenaOverlays';
import { useArenaEngine } from './useArenaEngine';
import { frameDayIdx } from './arenaStateMap';
import { liveDayIdx } from './buildArenaModel';
import { buildFixtureModel } from './buildFixtureModel';
import { AD_W, AD_H, HERO_W, HERO_H, DOCK_H } from './arenaLayout';

// The arena renders from a single MODEL `D`. With real data the host passes
// `data` (buildArenaModel's output) + `handlers`; the dev preview passes neither,
// so `D` falls back to the fixtures packed into the SAME shape — keeping the
// ?battleViewV2=1 path (and its render smoke) byte-identical to Phase 2.
export function ArenaDesktop({ state, mode, headline = 'mult', onBack, data = null, handlers = null }) {
  const live = state === 'live';
  const done = state === 'complete';
  const calm = state === 'awaiting';

  // Keep the fixtures fallback MEMOIZED on [state] — a bare buildFixtureModel(state)
  // would mint a new object each render, churning D's identity and restarting the
  // engine's preview beat-loop. (Shared with ArenaMobile; see buildFixtureModel.)
  const fixtureModel = React.useMemo(() => buildFixtureModel(state), [state]);
  const D = data ?? fixtureModel;

  const eng = useArenaEngine({
    active: live, voice: D.voice, ask: D.ask,
    beats: data ? null : D.beats, // preview loops fixture beats; live uses liveBeats
    live: !!data, liveBeats: data ? D.beats : null,
    battleId: D.battleId ?? null, agentId: D.agentId ?? null, // two-way ask identity (live only)
    closeStart: calm ? (D.pod.toOpen ?? 0) : (D.pod.nextClose ?? 0),
    wireStart: D.wire.closes ?? 0,
  });

  const [opp, setOpp] = React.useState(null);
  const [filmOpen, setFilmOpen] = React.useState(false);
  const [faOpen, setFaOpen] = React.useState(false);
  const [departedView, setDepartedView] = React.useState(null); // 'swap' | 'drop' | null
  React.useEffect(() => { setOpp(null); setFilmOpen(false); setFaOpen(false); setDepartedView(null); }, [state, mode]);

  const lastIdx = data ? liveDayIdx(D.climb) : frameDayIdx(state);
  const youRank = D.youRank;
  const oppSeat = opp ? D.seats.find((s) => s.id === opp) : null;
  // With real data the bell countdown is deferred (pod.nextClose null) — show the
  // live badge as "LIVE", not a frozen 00:00 (StatusBadge prints the label when
  // clock is null). The preview keeps its real fixture countdown.
  const closeClock = data && D.pod.nextClose == null ? null : eng.closeClock;

  return (
    <div style={{ width: AD_W, height: AD_H, position: 'relative', display: 'flex', flexDirection: 'column', padding: '14px 22px 16px' }}>
      <ArenaTopStrip mode={mode} state={state} pod={D.pod} closeClock={closeClock} onBack={onBack} />

      {/* THE HERO — the competition climb */}
      <div style={{ position: 'relative', marginTop: 11 }}>
        <ClimbArena state={state} mode={mode} seats={D.seats} climb={D.climb} youId={D.youId} dayIdx={lastIdx}
          w={HERO_W} h={HERO_H} surge={live ? eng.surge : null} onPlayer={done ? null : setOpp} youLiveScore={D.youLiveScore} />
        {live && eng.beat && (
          <div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 25, pointerEvents: 'none' }}>
            <BeatCaption beat={eng.beat} />
          </div>
        )}
      </div>

      {/* THE COMMAND DOCK — your stars, always in reach */}
      <div style={{ height: DOCK_H, marginTop: 11, display: 'flex', gap: 12, minHeight: 0 }}>
        <DockAgentSix stars={D.agentStars} dormant={calm} complete={done} beatStar={live ? eng.beatStar : null}
          flareKey={live ? eng.flareKey : 0} headline={headline} move={D.agentMove} departed={D.agentDeparted}
          onOpenDeparted={() => setDepartedView('swap')} style={{ flex: 1.35 }} />
        <DockYourThree stars={D.userStars} dormant={calm} complete={done} state={state} wire={D.wire} wireClock={eng.wireClock}
          beatStar={live ? eng.beatStar : null} onFlip={handlers?.onFlip} onFlipDrama={eng.flip} onClaim={() => setFaOpen(true)} headline={headline}
          departed={D.userDeparted} onOpenDeparted={() => setDepartedView('drop')} style={{ flex: 1.3 }} />
        <DockStatePanel state={state} mode={mode} eng={eng} archName={D.voice.arch} voice={D.voice} pod={D.pod}
          ask={D.ask} youRank={youRank} onFilm={() => setFilmOpen(true)} style={{ flex: 1.02 }} />
      </div>

      {done && filmOpen && <FilmRoomOverlay onClose={() => setFilmOpen(false)} />}
      {faOpen && <FreeAgencyDoorway onClose={() => setFaOpen(false)} claim={data ? D.claim : null} onClaim={handlers?.onClaim} />}
      {oppSeat && <OpponentSnapshot seat={oppSeat} composite={D.climb[opp]?.[lastIdx] ?? 0} onClose={() => setOpp(null)} />}
      {departedView && (
        <DepartedLedger kind={departedView} departed={departedView === 'swap' ? D.agentDeparted : D.userDeparted} onClose={() => setDepartedView(null)} />
      )}
    </div>
  );
}
