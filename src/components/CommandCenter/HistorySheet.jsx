// src/components/CommandCenter/HistorySheet.jsx
//
// Command Center hub, slice S1 — the History sheet's frame (the design's
// HistorySheet, ff-mobile.jsx; spec V1.2 §8.2): the stored career record with
// its §7 caption and the completed rows of the same fetched window. Opening
// it adds no read. It proves the HubSheet primitive; S3 supplies its rows and
// S5 the career record. In S1 only the layout fixtures can open it.

import React from 'react';
import { splitGames } from './hub/hubModel';
import { HUB_COPY as COPY } from './hub/hubCopy';
import { C } from './hub/hubStyle';
import HubSheet from './HubSheet';
import { Mono } from './HubParts';
import { GameRow } from './sections/GamesSection';

export default function HistorySheet({ games, career, phone, onClose, opener, fallbackFocus, reducedMotion }) {
  const { completed } = splitGames(games);
  const record = career?.status === 'ready' && career.record ? career.record : null;
  return (
    <HubSheet
      phone={phone}
      onClose={onClose}
      opener={opener}
      fallbackFocus={fallbackFocus}
      reducedMotion={reducedMotion}
      eyebrow={COPY.history.eyebrow(completed.length)}
      title={COPY.history.title}
      label={COPY.history.label}
    >
      {record && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <Mono style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>{record}</Mono>
          <span style={{ fontSize: 12.5, color: C.ink3 }}>{COPY.history.careerCaption}</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {completed.map((g) => <GameRow key={g.id} game={g} />)}
      </div>
    </HubSheet>
  );
}
