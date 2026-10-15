// src/components/CommandCenter/panels/LoadoutPanel.jsx
//
// Command Center hub, slice S1 — the Equipped Archetype panel ("Loadout" on
// the phone): the design's two-card frame (ff-stage.jsx ArchetypePanel), the
// archetype card and the watchlist card. S1 renders both in their loading
// state, with the pickers and the Forge destination disabled; S5 supplies the
// owner's current loadout and wires the retained entry points (spec §2: the
// archetype opens the existing ArchetypePicker, the watchlist its quick sheet,
// both keep their Forge actions).
//
// The design's further blocks (permitted controls, recorded outcomes) are
// records, so they arrive with S5 too.

import React from 'react';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { C, HAIR, MONO, tint } from '../hub/hubStyle';
import { Card, Eyebrow, HubButton, HubLink, LoadingLine, Mono, Tag, useHubComposition } from '../HubParts';

function SlotCard({ accent, children }) {
  return (
    <Card style={{ background: C.bg, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent, opacity: 0.85 }} />
      {children}
    </Card>
  );
}

export default function LoadoutPanel({ loadout, onChangeArchetype, onChangeWatchlist, onOpenForge }) {
  const phone = useHubComposition() === 'phone';
  const ready = loadout?.status === 'ready';
  const archetype = ready ? loadout.archetype : null;
  const watchlist = ready ? loadout.watchlist : null;
  const symbols = Array.isArray(watchlist?.symbols) ? watchlist.symbols : [];
  return (
    <div data-hub-panel="loadout" data-hub-status-of={loadout?.status || 'loading'} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
        <SlotCard accent={C.gold}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Eyebrow>{COPY.loadout.archetype}</Eyebrow>
            {archetype && <Tag tone="gold">{COPY.loadout.equipped}</Tag>}
          </div>
          {archetype ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.ink, marginTop: 8, letterSpacing: '-0.01em' }}>{archetype.name}</div>
              <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>{archetype.approach}</div>
            </>
          ) : (
            <LoadingLine style={{ marginTop: 10 }}>{COPY.loadout.loading}</LoadingLine>
          )}
          <div style={{ marginTop: 12 }}>
            <HubButton small onPress={onChangeArchetype}>{COPY.loadout.changeArchetype}</HubButton>
          </div>
        </SlotCard>
        <SlotCard accent={C.teal}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Eyebrow>{COPY.loadout.watchlist}</Eyebrow>
            {watchlist && <Mono style={{ fontSize: 11, color: C.ink3 }}>{COPY.loadout.names(symbols.length)}</Mono>}
          </div>
          {watchlist ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginTop: 8 }}>{watchlist.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                {symbols.map((symbol) => (
                  <span key={symbol} style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 500, padding: '3px 7px', borderRadius: 6, color: C.ink2, background: tint('scrim', 0.04), border: `1px solid ${HAIR}` }}>
                    {symbol}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <LoadingLine style={{ marginTop: 10 }}>{COPY.loadout.loading}</LoadingLine>
          )}
          <div style={{ marginTop: 12 }}>
            <HubButton small onPress={onChangeWatchlist}>{COPY.loadout.changeWatchlist}</HubButton>
          </div>
        </SlotCard>
      </div>
      <div style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.55 }}>
        <span>{COPY.loadout.nextDeploy}</span>
        <span>{' '}</span>
        <HubLink onPress={onOpenForge}>{COPY.loadout.changeInForge}</HubLink>
      </div>
    </div>
  );
}
