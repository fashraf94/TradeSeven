// src/screens/filmRoomV2/FilmRoomRoute.jsx
//
// The 'filmRoom' route (src/App.jsx), Amendment E BA-40. Route id, entry
// points and props are unchanged; this wrapper only chooses the screen:
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

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import FilmRoomScreen from '../FilmRoomScreen';
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

export default function FilmRoomRoute({ battle, onBack }) {
  const mode = resolveFilmRoomV2Mode();
  const battleId = filmRoomBattleId(battle);
  const ownerId = typeof battle?.ownerId === 'string' ? battle.ownerId : null;
  // The answer belongs to ONE battle: a verdict for another battle never stands for this one (review A2L2-8, the useCockpitStatus precedent).
  const [answer, setAnswer] = useState(() => ({ battleId, verdict: mode === 'allowlist' && battleId ? cachedFilmRoomVerdict(battleId, { ownerId }) : undefined }));
  useEffect(() => {
    if (mode !== 'allowlist' || !battleId) return undefined;
    let live = true;
    readFilmRoomVerdict(battleId, { ownerId }).then((v) => { if (live) setAnswer({ battleId, verdict: v === true }); });
    return () => { live = false; };
  }, [mode, battleId, ownerId]);
  const verdict = answer.battleId === battleId ? answer.verdict : undefined;

  if (!filmRoomV2On(mode, verdict)) return <FilmRoomScreen battle={battle} onBack={onBack} />;
  return (
    <Suspense fallback={<div data-state="loading-v2" style={{ minHeight: '100vh', background: C.bg, ...mono(12, C.ink3, { padding: 40, textAlign: 'center' }) }}>{COPY.loading}</div>}>
      <FilmRoomScreenV2 battle={battle} onBack={onBack} viewerId={viewerUid()} />
    </Suspense>
  );
}
