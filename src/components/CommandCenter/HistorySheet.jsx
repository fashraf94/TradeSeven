// src/components/CommandCenter/HistorySheet.jsx
//
// Command Center hub, slice S1 — the History sheet's frame (the design's
// HistorySheet, ff-mobile.jsx; spec V1.2 §8.2): the stored career record with
// its §7 caption and the completed rows of the same fetched window. Opening
// it adds no read. It proves the HubSheet primitive; S3 supplies its rows and
// S5 the career record. In S1 only the layout fixtures can open it.
//
// Slice S3: the rows are the ten-game window's, each with its outcome and its
// review line, opening the game and its battle tape as Games does. Only a read
// window has a count and rows: a sheet left open across an identity change
// shows the new owner's window loading, or failed with Retry — never an empty
// history (spec §3; review T2-7).

import React from 'react';
import { splitGames } from './hub/hubModel';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { C } from './hub/hubStyle';
import HubSheet from './HubSheet';
import { Mono } from './HubParts';
import { GameRow, GamesLoadingLine, GamesReadNote } from './sections/GamesSection';

export default function HistorySheet({ games, career, phone, onClose, opener, fallbackFocus, reducedMotion, onOpenGame, onOpenTape, onRetry }) {
  const { completed } = splitGames(games);
  const ready = games?.status === 'ready';
  const failed = games?.status === 'error';
  const record = career?.status === 'ready' && career.record ? career.record : null;
  const unavailable = career?.status === 'unavailable';
  return (
    <HubSheet
      phone={phone}
      onClose={onClose}
      opener={opener}
      fallbackFocus={fallbackFocus}
      reducedMotion={reducedMotion}
      eyebrow={ready ? COPY.history.eyebrow(completed.length) : COPY.history.label}
      title={COPY.history.title}
      label={COPY.history.label}
    >
      {record && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <Mono style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>{record}</Mono>
          <span style={{ fontSize: 12.5, color: C.ink3 }}>{COPY.history.careerCaption}</span>
        </div>
      )}
      {unavailable && (
        <div data-hub-career-unavailable="" style={{ marginBottom: 12, fontSize: 12.5, color: C.ink3 }}>{COPY.history.careerUnavailable}</div>
      )}
      {!ready && !failed && <GamesLoadingLine games={games} />}
      {failed && <GamesReadNote games={games} onRetry={onRetry} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {completed.map((g) => <GameRow key={g.id} game={g} onOpen={onOpenGame} onOpenTape={onOpenTape} />)}
      </div>
    </HubSheet>
  );
}
