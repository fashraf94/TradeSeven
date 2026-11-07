// src/screens/LoadoutStatesSmoke.jsx
//
// SMOKE ONLY (claude/armory-a2-smoke, NEVER MERGE) — build A2's states page, `?loadoutStates=1`: the REAL loadout
// cards, Deploy lines, armory context and League lines (src/components/CommandCenter/LoadoutCards.jsx, Armory.jsx,
// src/components/League/LeagueLoadoutLine.jsx) in every state, on fixture data, so the founder can see the League lock
// without a live week. Then a phone frame built from the hub's own pieces (the hero's stage with the armory in its box,
// the cards under it, one scroll box as the phone hub is) for board 5's flow and the AR-1 check. Nothing here writes:
// the fixture agent has no id, so Equip and the book rows change nothing.

import React, { useRef, useState } from 'react';
import LoadoutCards, { DeployLoadoutLine, LoadoutCard } from '../components/CommandCenter/LoadoutCards';
import { ArmoryContextLine, ArmoryDetails, PhoneArmoryScope, armoryHeroRead } from '../components/CommandCenter/Armory';
import { PhoneStage } from '../components/CommandCenter/ShadowStage';
import { HubAgentFormContext } from '../components/CommandCenter/HubAgentForm';
import { HubLayoutContext } from '../components/CommandCenter/HubParts';
import { useHubWidth } from '../components/CommandCenter/hub/useHubWidth';
import { PerGameLoadoutContext, scopeSummary } from '../components/CommandCenter/hub/perGameLoadoutContext';
import { deriveLoadoutCards } from '../components/CommandCenter/hub/perGameLoadoutModel';
import { C, HAIR } from '../components/CommandCenter/hub/hubStyle';
import { LeagueLoadoutLine, TrainingLoadoutLine } from '../components/League/LeagueLoadoutLine';

// ── Fixtures: one account, mid-week (Wednesday Nov 4) and between weeks ──────────────────────────────────────────
const LISTS = [
  { watchlistId: 'wl-energy', name: 'Energy Movers', status: 'committed', tickers: ['XOM', 'CVX', 'OXY', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'HAL', 'DVN', 'FANG', 'COP'] },
  { watchlistId: 'wl-ind', name: 'Industrials', status: 'committed', tickers: ['CAT', 'DE', 'HON', 'GE', 'UNP', 'LMT', 'RTX', 'MMM', 'ETN', 'ITW', 'EMR', 'PH', 'CMI', 'ROK', 'DOV', 'FDX', 'UPS', 'CSX'] },
];
const BB_SLOT = { archetype: 'degen', book: { ref: { watchlistId: 'wl-energy' }, name: 'Energy Movers', pin: null } };
const AGENT = (over = {}) => ({ id: null, ownerId: 'smoke', name: 'Shadow', archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials', loadouts: { baggerbomb: BB_SLOT }, ...over });
const NO_BOOK = AGENT({ loadouts: { baggerbomb: { archetype: 'degen', book: { ref: null, name: null, pin: null } } } });
// The week of Nov 2: battles Mon–Fri, so the lock ends Fri Nov 6 at the close.
const LOCKED = { locked: true, groupId: 'smoke-group', status: 'battle', endsAtMs: Date.parse('2026-11-06T21:00:00.000Z') };
const OPEN = { locked: false, groupId: null, status: null, endsAtMs: null };
const RUNNING = [{ id: 'smoke-bb', status: 'active', agentId: 'casual-agent-smoke', agentContext: { archetype: 'momentum_chaser' } }];
const LOCKED_GROUP = { id: 'smoke-group', status: 'battle', groupMembers: ['smoke'], updatedAt: '2026-11-04', startAnchor: { anchorEtDate: '2026-11-02' } };
const noop = () => {};

function scopeOf({ agent = AGENT(), lock = OPEN, lockFailed = false, activeBattles = [], armoryKind = 'baggerbomb' } = {}) {
  return { agent, lock, lockFailed, activeBattles, lists: { committed: LISTS, status: 'ready', retry: noop }, armoryKind, setArmoryKind: noop, bookKind: 'baggerbomb', setBookKind: noop };
}
const cardsOf = (scope) => deriveLoadoutCards({ agent: scope.agent, lock: scope.lock, lockFailed: scope.lockFailed, activeBattles: scope.activeBattles, committed: LISTS });

function Frame({ title, note, children, width = null }) {
  return (
    <section data-smoke-frame={title} style={{ marginBottom: 22, maxWidth: width ?? undefined }}>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.teal, marginBottom: 4 }}>{title}</div>
      {note ? <div style={{ fontSize: 12.5, color: C.ink3, marginBottom: 8, lineHeight: 1.45 }}>{note}</div> : null}
      <div style={{ background: C.surface, border: `1px solid ${HAIR}`, borderRadius: 18, padding: 12 }}>{children}</div>
    </section>
  );
}

function Scoped({ scope, children }) {
  return <PerGameLoadoutContext.Provider value={scope}>{children}</PerGameLoadoutContext.Provider>;
}

/** The armory's context, its words and its Equip, as the dialog's aside and the phone's block show them. */
function ArmoryState({ scope, previewed }) {
  const card = cardsOf(scope)[scope.armoryKind];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
      <ArmoryContextLine card={card} />
      <ArmoryDetails previewed={previewed} equipped={card.archetype} working={false} error={null} notice={null} onEquip={noop} compact card={card} />
    </div>
  );
}

/** A phone frame made of the hub's own pieces: the hero's stage (the armory opens in its box), the cards under it. */
function PhoneFlow({ lock }) {
  const rootRef = useRef(null);
  // The hub's own measured width (hub/useHubWidth.js), as the phone hub hands PhoneArmoryScope and PhoneStage.
  const width = useHubWidth(rootRef);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('baggerbomb');
  const [opener, setOpener] = useState(null);
  const agent = AGENT();
  const scope = { ...scopeOf({ agent, lock, armoryKind: kind }), setArmoryKind: setKind };
  const read = { status: 'ready', agent: { ...agent, id: 'smoke-agent' }, retry: noop };
  return (
    <HubLayoutContext.Provider value="phone">
      <Scoped scope={scope}>
        <HubAgentFormContext.Provider value={armoryHeroRead(read)}>
          <section ref={rootRef} data-smoke-phone-hub="" data-hub-width={width ?? ''} tabIndex={-1} style={{ height: 760, overflowY: 'auto', overflowX: 'hidden', maxWidth: 430, margin: '0 auto', borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}`, padding: '10px 14px 24px', background: C.bg, boxSizing: 'border-box' }}>
            <PhoneArmoryScope open={open} agent={agent} onClose={() => setOpen(false)} opener={opener} width={width}>
              <PhoneStage size={typeof width === 'number' && width < 375 ? 196 : 200} status="ambient" processing={false} words="Ready" selectedArea={2} summaries={['Not in this release', 'Ready', scopeSummary(scope)]} reducedMotion={false} />
            </PhoneArmoryScope>
            <div style={{ height: 14 }} />
            <LoadoutCards onOpenArchetype={(event) => { setOpener(event.currentTarget); setOpen(true); }} onOpenBook={noop} onOpenForge={noop} />
          </section>
        </HubAgentFormContext.Provider>
      </Scoped>
    </HubLayoutContext.Provider>
  );
}

export default function LoadoutStatesSmoke() {
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' };
  return (
    <>
    <div data-loadout-states="" style={{ background: C.bg, color: C.ink, padding: '16px 16px 8px', boxSizing: 'border-box', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: C.copper, letterSpacing: '0.1em' }}>SMOKE ONLY · NEVER MERGE · fixture data, nothing writes</div>
      <h1 style={{ fontSize: 22, margin: '6px 0 4px' }}>Loadout states (build A2)</h1>
      <p style={{ fontSize: 13, color: C.ink2, margin: '0 0 18px', lineHeight: 1.5 }}>Every state of the two loadout cards, the Deploy card's line, the armory's context and the League lines. The League week here is Nov 2–6, so the lock ends Fri Nov 6, 4:00 PM.</p>

      <HubLayoutContext.Provider value="phone">
        <h2 style={{ fontSize: 16, margin: '8px 0 12px' }}>1 · The Loadout tab: the two cards</h2>
        <div style={grid}>
          <Frame title="Mid-week: BaggerBomb next deploy, League locked"><Scoped scope={scopeOf({ lock: LOCKED })}><LoadoutCards onOpenArchetype={noop} onOpenBook={noop} onOpenForge={noop} /></Scoped></Frame>
          <Frame title="Between weeks: League open"><Scoped scope={scopeOf({ lock: OPEN })}><LoadoutCards onOpenArchetype={noop} onOpenBook={noop} onOpenForge={noop} /></Scoped></Frame>
        </div>
        <div style={grid}>
          {[
            ['BaggerBomb · a game is running (Trend Follower)', scopeOf({ lock: LOCKED, activeBattles: RUNNING }), 'baggerbomb'],
            ['BaggerBomb · no book', scopeOf({ agent: NO_BOOK, lock: OPEN }), 'baggerbomb'],
            ['League · locked for the week', scopeOf({ lock: LOCKED }), 'league'],
            ['League · open between weeks', scopeOf({ lock: OPEN }), 'league'],
            ['League · checking (the lock read has not answered)', scopeOf({ lock: null }), 'league'],
          ].map(([title, scope, kind]) => (
            <Frame key={title} title={title}><LoadoutCard card={cardsOf(scope)[kind]} onArmor={noop} onBook={noop} /></Frame>
          ))}
        </div>

        <h2 style={{ fontSize: 16, margin: '18px 0 12px' }}>2 · The Deploy card's line</h2>
        <div style={grid}>
          <Frame title="Ready"><Scoped scope={scopeOf()}><DeployLoadoutLine onOpen={noop} /></Scoped></Frame>
          <Frame title="A game is running"><Scoped scope={scopeOf({ activeBattles: RUNNING })}><DeployLoadoutLine onOpen={noop} /></Scoped></Frame>
          <Frame title="No book · Deploy still works"><Scoped scope={scopeOf({ agent: NO_BOOK })}><DeployLoadoutLine onOpen={noop} /></Scoped></Frame>
        </div>

        <h2 style={{ fontSize: 16, margin: '18px 0 12px' }}>3 · The League lobby's lines</h2>
        <div style={grid}>
          <Frame title="League tab · locked mid-week"><LeagueLoadoutLine agentLoadout={{ archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials', openLoadout: noop }} group={LOCKED_GROUP} accent={C.teal} /></Frame>
          <Frame title="League tab · open between weeks (a door)"><LeagueLoadoutLine agentLoadout={{ archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials', openLoadout: noop }} group={null} accent={C.teal} /></Frame>
          <Frame title="Training tab"><TrainingLoadoutLine agentLoadout={{ archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials' }} /></Frame>
        </div>

        <h2 style={{ fontSize: 16, margin: '18px 0 12px' }}>4 · The armory with a loadout context</h2>
        <div style={grid}>
          <Frame title="For BaggerBomb · previewing the Trend Follower"><ArmoryState scope={scopeOf({ armoryKind: 'baggerbomb' })} previewed="momentum_chaser" /></Frame>
          <Frame title="For League · open"><ArmoryState scope={scopeOf({ lock: OPEN, armoryKind: 'league' })} previewed="guardian" /></Frame>
          <Frame title="For League · locked: previewing works, Equip is the lock line"><ArmoryState scope={scopeOf({ lock: LOCKED, armoryKind: 'league' })} previewed="guardian" /></Frame>
        </div>

        <h2 style={{ fontSize: 16, margin: '18px 0 6px' }}>5 · The flow on the phone (the hub's own pieces)</h2>
        <p style={{ fontSize: 12.5, color: C.ink3, margin: '0 0 10px', lineHeight: 1.45 }}>Full width, as the phone hub is, and its own scroll box. Tap a card's armor row: the armory opens in the hero's box. Try sets, then Close or Escape: the armor comes off in view and the box does not scroll to the card (AR-1). The League card is locked here: its armory previews, and its Equip is the lock line. Nothing writes.</p>
      </HubLayoutContext.Provider>
    </div>
    <PhoneFlow lock={LOCKED} />
    <div style={{ height: 60, background: C.bg }} />
    </>
  );
}
