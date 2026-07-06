// src/components/Tournament/myTournament/MyTournamentPage.jsx
//
// The pure presentational composition for the "My Tournament" page: shared
// chrome + the active state's body. All data arrives as props (the data shell,
// MyTournamentScreen, does the subscriptions/derivations), so this renders
// synchronously — smoke-testable per state via react-dom/server.

import React from 'react';
import { LTOKENS, alpha } from '../../League/leagueTokens';
import { TourChrome } from './TourChrome';
import { AwaitingView } from './AwaitingView';
import { DraftView } from './DraftView';
import { BracketView } from './BracketView';

export function MyTournamentPage({
  state, title, meta, compact,
  awaiting = {}, draft = {}, bracket = {},
  onEditInForge, onOpenBattle,
}) {
  return (
    <div
      className="lg-scroll"
      style={{
        height: '100%', minHeight: '100vh', overflowY: 'auto', overflowX: 'hidden',
        background: LTOKENS.bg,
        backgroundImage: `radial-gradient(circle at 50% -8%, ${alpha(LTOKENS.gold, state === 'drafting' ? 0.03 : 0.06)}, transparent 46%)`,
        color: LTOKENS.ink,
      }}
    >
      <div style={{ padding: compact ? '20px 15px 44px' : '26px 30px 48px', maxWidth: compact ? '100%' : 1080, margin: '0 auto' }}>
        <TourChrome state={state} title={title} meta={meta} compact={compact} />
        {state === 'awaiting' && (
          <AwaitingView
            segments={awaiting.segments} lockLabel={awaiting.lockLabel} pips={awaiting.pips}
            loadout={awaiting.loadout} onEditInForge={onEditInForge} seatSub={awaiting.seatSub} compact={compact}
          />
        )}
        {state === 'drafting' && (
          <DraftView yourPicks={draft.yourPicks} agentPicks={draft.agentPicks} compact={compact} />
        )}
        {state === 'bracket' && (
          <BracketView
            seed={bracket.seed} rank={bracket.rank} standing={bracket.standing}
            pod={bracket.pod} battleDayLabel={bracket.battleDayLabel} onOpenBattle={onOpenBattle} compact={compact}
          />
        )}
      </div>
    </div>
  );
}
