// src/components/CommandCenter/panels/LoadoutPanel.jsx
//
// Command Center hub — the Equipped Archetype panel ("Loadout" on the phone):
// the design's two-card frame (ff-stage.jsx ArchetypePanel), the archetype card
// and the watchlist card. Slice S1 drew it in its loading state; slice S5
// (rulings R-S5-1 … R-S5-8) supplies the owner's DESIRED loadout from the
// agent document and wires the retained entry points (spec §2): the identity
// opens the agent record, the archetype opens the existing ArchetypePicker, the
// watchlist its quick sheet plus a Forge Lists door, the adjustments (where the
// shells have the traits slot) their sheet plus a Forge door named after the
// tab it opens. None of them is a copy of a legacy surface; each opens the
// shipped one.
//
// The Forge line keeps the design's words (ff-stage.jsx ArchetypePanel), less
// its Partnership clause (§8.3): "Locked in battle · …" while the loadout is
// locked in a live game (`loadout.lockedInGame`, one predicate for the line and
// every picker), and "— never rewrites a game in progress." (a game keeps the
// loadout it was deployed with; spec §2).
//
// The watchlist card wears the idea-first labels of the design note
// (docs/design/20261016_DESIGN_NOTE_IDEA_FIRST_FORGE.md): "Universe · N names"
// for a list that is an idea's universe, "Plain watchlist · no idea yet" for
// one that has none, and the neutral "N names" when the records are off or the
// pointer is malformed (hub/selectors/loadout.js ideaLabelKind). It never shows
// an idea's statement or status — that needs the gated idea reader (slice S6).
//
// The cards lay out in `repeat(auto-fit, minmax(LOADOUT_CARD_MIN, 1fr))` on the
// panel's own width: side by side only where each keeps a readable width,
// stacked otherwise (R-S5-8), with no breakpoint to remount over. Names wrap;
// nothing is ellipsized.

import React from 'react';
import { HUB_COPY as COPY } from '../hub/hubCopy';
import { LOADOUT_SYMBOL_LIMIT } from '../hub/hubModel';
import { FORGE_DOOR, IDEA_LABEL, LOADOUT_STATUS, WATCHLIST_STATE } from '../hub/selectors/loadout';
import { C, HAIR, LOADOUT_CARD_MIN, MONO, tint } from '../hub/hubStyle';
import { Card, EmptyNote, Eyebrow, HubButton, HubLink, LoadingLine, Mono, Tag } from '../HubParts';

function SlotCard({ accent, kind, children }) {
  return (
    <Card data-hub-card={kind} style={{ background: C.bg, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent, opacity: 0.85 }} />
      {children}
    </Card>
  );
}

const cardHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const cardActions = { marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 };
const wrapText = { overflowWrap: 'anywhere', minWidth: 0 };

// A watchlist section without a `state` is a resolved list (the S1 frame's shape: a name and its symbols).
const stateOf = (watchlist) => watchlist.state ?? WATCHLIST_STATE.READY;
const symbolsOf = (watchlist) => (Array.isArray(watchlist.symbols) ? watchlist.symbols : []);
const countOf = (watchlist) => watchlist.count ?? symbolsOf(watchlist).length;

/** The watchlist card's label over its names (R-S5-2). Only a resolved list wears one. */
function watchlistLabel(watchlist) {
  if (watchlist.idea === IDEA_LABEL.UNIVERSE) return COPY.loadout.universe(countOf(watchlist));
  if (watchlist.idea === IDEA_LABEL.PLAIN) return COPY.loadout.plainList;
  return COPY.loadout.names(countOf(watchlist));
}

function WatchlistBody({ watchlist, onRetryLists }) {
  const name = watchlist.name || COPY.loadout.watchlistFallback;
  switch (stateOf(watchlist)) {
    case WATCHLIST_STATE.NONE:
      return (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginTop: 8 }}>{COPY.loadout.noWatchlist}</div>
          <div style={{ fontSize: 13, color: C.ink2, marginTop: 6, lineHeight: 1.5 }}>{COPY.loadout.noWatchlistSub}</div>
        </>
      );
    case WATCHLIST_STATE.LOADING:
      return (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginTop: 8, ...wrapText }}>{name}</div>
          <LoadingLine style={{ marginTop: 8 }}>{COPY.loadout.loading}</LoadingLine>
        </>
      );
    case WATCHLIST_STATE.UNAVAILABLE:
      return (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginTop: 8, ...wrapText }}>{COPY.loadout.unavailable(name)}</div>
          <div style={{ fontSize: 13, color: C.ink2, marginTop: 6, lineHeight: 1.5 }}>{COPY.loadout.unavailableNote}</div>
        </>
      );
    case WATCHLIST_STATE.ERROR:
      return (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginTop: 8, ...wrapText }}>{name}</div>
          <div style={{ fontSize: 13, color: C.ink2, marginTop: 6, lineHeight: 1.5 }}>{COPY.loadout.listsError}</div>
          <div style={{ marginTop: 4 }}><HubLink onPress={onRetryLists}>{COPY.loadout.retry}</HubLink></div>
        </>
      );
    default: {
      const symbols = symbolsOf(watchlist);
      const shown = symbols.slice(0, LOADOUT_SYMBOL_LIMIT);
      const rest = symbols.length - shown.length;
      const chip = { fontFamily: MONO, fontSize: 10.5, fontWeight: 500, padding: '3px 7px', borderRadius: 6, color: C.ink2, background: tint('scrim', 0.04), border: `1px solid ${HAIR}`, maxWidth: '100%', ...wrapText };
      return (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginTop: 8, ...wrapText }}>{name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
            {shown.map((symbol) => <span key={symbol} style={chip}>{symbol}</span>)}
            {rest > 0 && <span style={chip}>{COPY.loadout.more(rest)}</span>}
          </div>
        </>
      );
    }
  }
}

export default function LoadoutPanel({
  loadout, onOpenRecord, onChangeArchetype, onChangeWatchlist, onChangeAdjustments,
  onOpenForge, onOpenForgeLists, onOpenForgeCharacter, onRetryLists,
}) {
  const status = loadout?.status || LOADOUT_STATUS.LOADING;
  if (status === LOADOUT_STATUS.NONE) {
    return (
      <div data-hub-panel="loadout" data-hub-status-of={status}>
        <EmptyNote icon="info" title={COPY.loadout.noAgent} />
      </div>
    );
  }
  const ready = status === LOADOUT_STATUS.READY;
  const archetype = ready ? loadout.archetype : null;
  const watchlist = ready ? loadout.watchlist : null;
  const adjustments = ready ? loadout.adjustments : null;
  const locked = ready && loadout.lockedInGame === true;
  // The identity row belongs to the live shape (hub/selectors/loadout.js); the S1 frame's fixtures carry none.
  const identity = ready ? loadout.identity : null;
  const agentName = identity ? identity.name || COPY.loadout.agentFallback : null;
  return (
    <div data-hub-panel="loadout" data-hub-status-of={status} data-hub-locked={locked ? '' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {identity && (
        <div data-hub-loadout-identity="" style={{ ...cardHead, gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, letterSpacing: '-0.01em', ...wrapText }}>{agentName}</div>
          <HubButton small onPress={onOpenRecord} ariaLabel={COPY.loadout.recordLabel(agentName)}>{COPY.loadout.openRecord}</HubButton>
        </div>
      )}
      <div data-hub-loadout-cards="" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${LOADOUT_CARD_MIN}px, 1fr))`, gap: 10 }}>
        <SlotCard accent={C.gold} kind="archetype">
          <div style={cardHead}>
            <Eyebrow>{COPY.loadout.archetype}</Eyebrow>
            {archetype && <Tag tone="gold">{COPY.loadout.equipped}</Tag>}
          </div>
          {archetype ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.ink, marginTop: 8, letterSpacing: '-0.01em', ...wrapText }}>{archetype.name}</div>
              {archetype.approach && (
                <div style={{ fontSize: 13.5, color: C.ink2, marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>{archetype.approach}</div>
              )}
            </>
          ) : (
            <LoadingLine style={{ marginTop: 10 }}>{COPY.loadout.loading}</LoadingLine>
          )}
          <div style={{ marginTop: 12 }}>
            <HubButton small onPress={ready && !locked ? onChangeArchetype : undefined} style={{ whiteSpace: 'normal', textAlign: 'center', maxWidth: '100%' }}>{COPY.loadout.changeArchetype}</HubButton>
          </div>
        </SlotCard>
        <SlotCard accent={C.teal} kind="watchlist">
          <div style={cardHead}>
            <Eyebrow>{COPY.loadout.watchlist}</Eyebrow>
            {watchlist && stateOf(watchlist) === WATCHLIST_STATE.READY && <Mono style={{ fontSize: 11, color: C.ink3, ...wrapText }}>{watchlistLabel(watchlist)}</Mono>}
          </div>
          {watchlist ? <WatchlistBody watchlist={watchlist} onRetryLists={onRetryLists} /> : <LoadingLine style={{ marginTop: 10 }}>{COPY.loadout.loading}</LoadingLine>}
          <div style={cardActions}>
            <HubButton small onPress={ready && !locked ? onChangeWatchlist : undefined} style={{ whiteSpace: 'normal', textAlign: 'center', maxWidth: '100%' }}>{COPY.loadout.changeWatchlist}</HubButton>
            {ready && typeof onOpenForgeLists === 'function' && <HubLink onPress={onOpenForgeLists}>{COPY.loadout.forgeLists}</HubLink>}
          </div>
        </SlotCard>
        {adjustments && (
          <SlotCard accent={C.copper} kind="adjustments">
            <div style={cardHead}>
              <Eyebrow>{COPY.loadout.adjustments}</Eyebrow>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginTop: 8, ...wrapText }}>{adjustments.name}</div>
            <div style={{ fontSize: 13, color: C.ink2, marginTop: 6, lineHeight: 1.5 }}>{adjustments.sub}</div>
            <div style={cardActions}>
              <HubButton small onPress={locked ? undefined : onChangeAdjustments} style={{ whiteSpace: 'normal', textAlign: 'center', maxWidth: '100%' }}>{COPY.loadout.changeAdjustments}</HubButton>
              {typeof onOpenForgeCharacter === 'function' && (
                <HubLink onPress={onOpenForgeCharacter}>{adjustments.door === FORGE_DOOR.CHARACTER ? COPY.loadout.forgeCharacter : COPY.loadout.forgeTraits}</HubLink>
              )}
            </div>
          </SlotCard>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.55 }}>
        <span>{locked ? COPY.loadout.nextDeployLocked : COPY.loadout.nextDeploy}</span>
        <span>{' '}</span>
        <HubLink onPress={onOpenForge}>{COPY.loadout.changeInForge}</HubLink>
        <span>{COPY.loadout.neverRewrites}</span>
      </div>
    </div>
  );
}
