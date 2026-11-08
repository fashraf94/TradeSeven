// src/screens/LoadoutStatesSmoke.jsx
//
// SMOKE ONLY (claude/armory-flip-smoke, NEVER MERGE) — the armory flip's states page, `?loadoutStates=1`: the REAL
// loadout cards, Deploy lines, Deploy strip, armory context and League lines (src/components/CommandCenter/LoadoutCards.jsx,
// DeployStrip.jsx, sections/DeploySection.jsx, Armory.jsx, src/components/League/LeagueLoadoutLine.jsx) in every state, on
// fixture data, so the founder can see the League lock without a live week. Brought across from claude/armory-a2-smoke
// @ 06e5ff02 and refreshed: the League week is Nov 9–13, so the dated lock reads "Fri Nov 13"; added the states not yet
// seen on a phone — the Q3 dated and undated lines (cards, League line, armory context and Equip), the League line's
// Checking, the battle lock ("Locked while a game is running."), and the Deploy strip's refusal with its Retry. Then a
// phone frame built from the hub's own pieces for board 5's flow. Nothing here writes: the fixture agent has no id, so
// Equip and the book rows change nothing, and the refusal is a fixture result run through the real translators.

import React, { useRef, useState } from 'react';
import LoadoutCards, { DeployLoadoutLine, LoadoutCard } from '../components/CommandCenter/LoadoutCards';
import { ArmoryContextLine, ArmoryDetails, PhoneArmoryScope, armoryHeroRead } from '../components/CommandCenter/Armory';
import { PhoneStage } from '../components/CommandCenter/ShadowStage';
import { HubAgentFormContext } from '../components/CommandCenter/HubAgentForm';
import { HubLayoutContext } from '../components/CommandCenter/HubParts';
import DeployStrip from '../components/CommandCenter/DeployStrip';
import { PhoneDeployCard } from '../components/CommandCenter/sections/DeploySection';
import { useHubWidth } from '../components/CommandCenter/hub/useHubWidth';
import { PerGameLoadoutContext, scopeDeployLine, scopeSummary } from '../components/CommandCenter/hub/perGameLoadoutContext';
import { deriveLoadoutCards } from '../components/CommandCenter/hub/perGameLoadoutModel';
import { CEREMONY_PHASES, displayForAttempt, translateServiceResult } from '../components/CommandCenter/hub/selectors/attemptVocabulary';
import { C, HAIR } from '../components/CommandCenter/hub/hubStyle';
import { LeagueLoadoutLine, TrainingLoadoutLine } from '../components/League/LeagueLoadoutLine';
import { DEPLOY_OUTCOMES } from '../constants/deployOutcomes';
import { LOADOUT_COPY } from '../constants/loadoutCopy';

// ── Fixtures: one account, the weekend before the week of Nov 9 and mid-week ──────────────────────────────────────
const LISTS = [
  { watchlistId: 'wl-energy', name: 'Energy Movers', status: 'committed', tickers: ['XOM', 'CVX', 'OXY', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'HAL', 'DVN', 'FANG', 'COP'] },
  { watchlistId: 'wl-ind', name: 'Industrials', status: 'committed', tickers: ['CAT', 'DE', 'HON', 'GE', 'UNP', 'LMT', 'RTX', 'MMM', 'ETN', 'ITW', 'EMR', 'PH', 'CMI', 'ROK', 'DOV', 'FDX', 'UPS', 'CSX'] },
];
const BB_SLOT = { archetype: 'degen', book: { ref: { watchlistId: 'wl-energy' }, name: 'Energy Movers', pin: null } };
const AGENT = (over = {}) => ({ id: null, ownerId: 'smoke', name: 'Shadow', archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials', loadouts: { baggerbomb: BB_SLOT }, ...over });
const NO_BOOK = AGENT({ loadouts: { baggerbomb: { archetype: 'degen', book: { ref: null, name: null, pin: null } } } });
// A game on the ranked record (A2R-3 (a)): League locks undated, in A1's words, whatever the week says.
const IN_GAME = AGENT({ activeBattleId: 'smoke-ranked-battle' });
// The week of Nov 9: battles Mon–Fri, so the lock ends after the close on Fri Nov 13 (ruling Q3, date only).
const LOCKED = { locked: true, groupId: 'smoke-group', status: 'battle', endsAtMs: Date.parse('2026-11-13T21:00:00.000Z') };
// A group the calendar cannot date: the lock holds and names no day (Q3's undated line).
const LOCKED_UNDATED = { locked: true, groupId: 'smoke-group-u', status: 'forming', endsAtMs: null };
const OPEN = { locked: false, groupId: null, status: null, endsAtMs: null };
const RUNNING = [{ id: 'smoke-bb', status: 'active', agentId: 'casual-agent-smoke', agentContext: { archetype: 'momentum_chaser' } }];
const LOCKED_GROUP = { id: 'smoke-group', status: 'battle', groupMembers: ['smoke'], updatedAt: '2026-11-11', startAnchor: { anchorEtDate: '2026-11-09' } };
const UNDATED_GROUP = { id: 'smoke-group-u', status: 'forming', groupMembers: ['smoke'], updatedAt: '2026-11-08' };
const LEAGUE_LOADOUT = { archetype: 'contrarian', equippedWatchlistId: 'wl-ind', equippedWatchlistName: 'Industrials', openLoadout: () => {} };
const noop = () => {};

// The deploy's refusal when the casual clone cannot be ensured (A2R-3 (b), src/services/agentDeploy.js), as the service
// returns it, through the real translators the provider uses (translateServiceResult, then displayForAttempt): the
// strip and the Deploy card read it as a refusal with its line and a Retry. postIssued is false, so no cooldown.
const REFUSED_RESULT = { outcome: DEPLOY_OUTCOMES.REFUSED, success: false, postIssued: false, error: 'casual_clone_unavailable', details: LOADOUT_COPY.deployCloneFailed };
const refusedDeploy = (() => {
  const t = translateServiceResult(REFUSED_RESULT);
  const shown = displayForAttempt({ phase: t.phase, ceremonyPhase: CEREMONY_PHASES.ERROR, result: t.detail });
  // The attempt branch of deriveHubDeployState (hub/selectors/deployState.js) with nothing else in the way: its words,
  // its line, its one action (Retry, as the refusal admits a new request: no cooldown, the agent ready).
  return Object.freeze({
    displayState: shown.displayState, canStart: false, gateBlocked: null,
    freshness: Object.freeze({ asOf: null, stale: false, refreshing: false }),
    retryAction: null, reason: shown.line ?? null, action: shown.action, recovered: false, battleId: null,
    cooldownUntil: null, holdControlId: null, retryBlock: null, dismiss: shown.dismiss === true,
  });
})();

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

/** The phone's Deploy strip in place: it is fixed to the bottom of the screen, so a transformed box holds it here. */
function StripInPlace({ deploy, scope }) {
  return (
    <div style={{ position: 'relative', height: 76, transform: 'translateZ(0)', overflow: 'hidden', borderRadius: 12 }}>
      <DeployStrip deploy={deploy} liveGame={null} loadoutLine={scopeDeployLine(scope) ?? ''} placement={{ stripBottom: 0, stripPadsSafeArea: false }} onOpenLoadout={noop} onOpenGame={noop} onDeploy={noop} onAction={noop} />
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
  const isNew = (title) => `New · ${title}`;
  return (
    <>
    <div data-loadout-states="" style={{ background: C.bg, color: C.ink, padding: '16px 16px 8px', boxSizing: 'border-box', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: C.copper, letterSpacing: '0.1em' }}>SMOKE ONLY · NEVER MERGE · fixture data, nothing writes</div>
      <h1 style={{ fontSize: 22, margin: '6px 0 4px' }}>Loadout states (the armory flip)</h1>
      <p style={{ fontSize: 13, color: C.ink2, margin: '0 0 18px', lineHeight: 1.5 }}>Every state of the two loadout cards, the Deploy card's line and strip, the armory's context and the League lines. The League week here is Nov 9–13, so a dated lock reads "Fri Nov 13". Frames marked New were not on the A2 smoke page.</p>

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
            [isNew('League · locked for the week, dated (Q3)'), scopeOf({ lock: LOCKED }), 'league'],
            [isNew('League · locked, undated (Q3)'), scopeOf({ lock: LOCKED_UNDATED }), 'league'],
            [isNew('League · locked while a game is running (the battle lock)'), scopeOf({ agent: IN_GAME, lock: OPEN }), 'league'],
            ['League · open between weeks', scopeOf({ lock: OPEN }), 'league'],
            ['League · checking (the lock read has not answered)', scopeOf({ lock: null }), 'league'],
          ].map(([title, scope, kind]) => (
            <Frame key={title} title={title}><LoadoutCard card={cardsOf(scope)[kind]} onArmor={noop} onBook={noop} /></Frame>
          ))}
        </div>

        <h2 style={{ fontSize: 16, margin: '18px 0 12px' }}>2 · The Deploy card's line and the strip</h2>
        <div style={grid}>
          <Frame title="Ready"><Scoped scope={scopeOf()}><DeployLoadoutLine onOpen={noop} /></Scoped></Frame>
          <Frame title="A game is running"><Scoped scope={scopeOf({ activeBattles: RUNNING })}><DeployLoadoutLine onOpen={noop} /></Scoped></Frame>
          <Frame title="No book · Deploy still works"><Scoped scope={scopeOf({ agent: NO_BOOK })}><DeployLoadoutLine onOpen={noop} /></Scoped></Frame>
        </div>
        <div style={grid}>
          <Frame title={isNew('The strip · the BaggerBomb game could not start')} note="The casual clone could not be ensured, so the deploy is refused before anything is sent (A2R-3 (b)): the line and its Retry. Retry here does nothing.">
            <Scoped scope={scopeOf()}><StripInPlace deploy={refusedDeploy} scope={scopeOf()} /></Scoped>
          </Frame>
          <Frame title={isNew('The Deploy card · the same refusal, its full words')}>
            <Scoped scope={scopeOf()}><PhoneDeployCard deploy={refusedDeploy} onAction={noop} /></Scoped>
          </Frame>
        </div>

        <h2 style={{ fontSize: 16, margin: '18px 0 12px' }}>3 · The League lobby's lines</h2>
        <div style={grid}>
          <Frame title={isNew('League tab · locked mid-week, dated (Q3)')}><LeagueLoadoutLine agentLoadout={LEAGUE_LOADOUT} group={LOCKED_GROUP} groupKnown accent={C.teal} /></Frame>
          <Frame title={isNew('League tab · locked, undated (Q3)')}><LeagueLoadoutLine agentLoadout={LEAGUE_LOADOUT} group={UNDATED_GROUP} groupKnown accent={C.teal} /></Frame>
          <Frame title="League tab · open between weeks (a door)"><LeagueLoadoutLine agentLoadout={LEAGUE_LOADOUT} group={null} groupKnown accent={C.teal} /></Frame>
          <Frame title={isNew('League tab · checking (the group read has not answered)')}><LeagueLoadoutLine agentLoadout={LEAGUE_LOADOUT} group={null} groupKnown={false} accent={C.teal} /></Frame>
          <Frame title="Training tab"><TrainingLoadoutLine agentLoadout={LEAGUE_LOADOUT} /></Frame>
        </div>

        <h2 style={{ fontSize: 16, margin: '18px 0 12px' }}>4 · The armory with a loadout context</h2>
        <div style={grid}>
          <Frame title="For BaggerBomb · previewing the Trend Follower"><ArmoryState scope={scopeOf({ armoryKind: 'baggerbomb' })} previewed="momentum_chaser" /></Frame>
          <Frame title="For League · open"><ArmoryState scope={scopeOf({ lock: OPEN, armoryKind: 'league' })} previewed="guardian" /></Frame>
          <Frame title={isNew('For League · locked, dated (Q3): previewing works, Equip is the lock line')}><ArmoryState scope={scopeOf({ lock: LOCKED, armoryKind: 'league' })} previewed="guardian" /></Frame>
          <Frame title={isNew('For League · locked, undated (Q3)')}><ArmoryState scope={scopeOf({ lock: LOCKED_UNDATED, armoryKind: 'league' })} previewed="guardian" /></Frame>
          <Frame title={isNew('For League · locked while a game is running')}><ArmoryState scope={scopeOf({ agent: IN_GAME, lock: OPEN, armoryKind: 'league' })} previewed="guardian" /></Frame>
        </div>

        <h2 style={{ fontSize: 16, margin: '18px 0 6px' }}>5 · The flow on the phone (the hub's own pieces)</h2>
        <p style={{ fontSize: 12.5, color: C.ink3, margin: '0 0 10px', lineHeight: 1.45 }}>Full width, as the phone hub is, and its own scroll box. Tap a card's armor row: the armory opens in the hero's box. Try sets, then Close or Escape: the armor comes off in view and the box does not scroll to the card (AR-1). The League card is locked here (Fri Nov 13): its armory previews, and its Equip is the lock line. Nothing writes.</p>
      </HubLayoutContext.Provider>
    </div>
    <PhoneFlow lock={LOCKED} />
    <div style={{ height: 60, background: C.bg }} />
    </>
  );
}
