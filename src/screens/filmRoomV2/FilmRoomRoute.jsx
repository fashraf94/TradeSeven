// src/screens/filmRoomV2/FilmRoomRoute.jsx
//
// The 'filmRoom' route (src/App.jsx), Amendment E BA-40. Route id and entry
// points are unchanged, and so are the legacy screen's props; v2 alone also
// gets where it was opened from, so its back goes back (filmRoomBack.js).
// This wrapper only chooses the screen:
//
//   v2 does NOT resolve on for this battle's owner → the legacy FilmRoomScreen
//     with exactly the props App gave it — FILM_ROOM_V2_MODE 'off' (no request
//     is sent), and 'allowlist' for an owner the server does not admit. While
//     an 'allowlist' verdict is still on its way the legacy screen is what
//     renders (the cockpit's "the first paint is the off layout" precedent), so
//     a non-admitted owner sees the legacy screen at every paint, mounted once,
//     never swapped. The wrapper adds no DOM of its own: the page is the
//     pre-build page byte for byte (FilmRoomRoute.golden.jsdom.test.jsx).
//   v2 resolves on → FilmRoomScreenV2, loaded lazily: a dark build adds to the
//     main chunk only this gate, the copy table and the kit its fallback uses.
//
// A battle whose game mode the tape does not cover opens the legacy screen too,
// whatever the mode (Build B Amendment A RB-5): the tape writer tapes only
// tiered battles and records every other mode `skipped_mode` (BA-3), so v2
// would show such a battle nothing but "not taped". The test is the writer's
// own — resolveModeConfig(gameMode).label === 'tiered'
// (api/_utils/filmTape/writeTapeDay.js isTieredBattle) — imported, never
// re-implemented, so the day tournament battles are taped both sides change
// together. An absent or unknown mode resolves to tiered, as the writer's does.
// No verdict is asked for such a battle: it is the 'off' page, request and all.

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import FilmRoomScreen from '../FilmRoomScreen';
import { resolveModeConfig } from '../../constants/agentGameModes';
import { resolveFilmRoomV2Mode, filmRoomV2On, filmRoomBattleId, readFilmRoomVerdict, cachedFilmRoomVerdict } from '../../utils/filmRoomGate';
import { FILM_ROOM_COPY as COPY } from './filmRoomCopy';
import { C, mono } from './FilmRoomKit';

const FilmRoomScreenV2 = lazy(() => import('./FilmRoomScreenV2'));

function viewerUid() {
  try {
    const uid = getAuth().currentUser?.uid;
    return typeof uid === 'string' && uid ? uid : null;
  } catch {
    return null;
  }
}

/**
 * @param {object}   props.battle
 * @param {Function} props.onBack    App's back for the LEGACY screen — passed to it unchanged, its only other prop the battle
 * @param {string}   [props.origin]  v2 only: where the Film Room was opened from (filmRoomBack.js), the back label's destination
 * @param {Function} [props.onReturn] v2 only: returns there; absent → v2 uses onBack
 */
export default function FilmRoomRoute({ battle, onBack, origin = 'unknown', onReturn = null }) {
  const mode = resolveFilmRoomV2Mode();
  const battleId = filmRoomBattleId(battle);
  const ownerId = typeof battle?.ownerId === 'string' ? battle.ownerId : null;
  // RB-5: the writer's own mode test — a battle it does not tape is the legacy screen's.
  const taped = resolveModeConfig(battle?.gameMode).label === 'tiered';
  // The answer belongs to ONE battle: a verdict for another battle never stands for this one (review A2L2-8, the useCockpitStatus precedent).
  const [answer, setAnswer] = useState(() => ({ battleId, verdict: mode === 'allowlist' && battleId ? cachedFilmRoomVerdict(battleId, { ownerId }) : undefined }));
  useEffect(() => {
    if (mode !== 'allowlist' || !battleId || !taped) return undefined;
    let live = true;
    readFilmRoomVerdict(battleId, { ownerId }).then((v) => { if (live) setAnswer({ battleId, verdict: v === true }); });
    return () => { live = false; };
  }, [mode, battleId, ownerId, taped]);
  const verdict = answer.battleId === battleId ? answer.verdict : undefined;

  if (!taped || !filmRoomV2On(mode, verdict)) return <FilmRoomScreen battle={battle} onBack={onBack} />;
  return (
    <Suspense fallback={<div data-state="loading-v2" style={{ minHeight: '100vh', background: C.bg, ...mono(12, C.ink3, { padding: 40, textAlign: 'center' }) }}>{COPY.loading}</div>}>
      <FilmRoomScreenV2 battle={battle} onBack={onReturn || onBack} backTo={origin} viewerId={viewerUid()} />
    </Suspense>
  );
}
