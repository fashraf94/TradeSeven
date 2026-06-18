// src/screens/LeagueScreen.jsx
//
// Front-door selector for the League tab.
//
// Flag/param OFF (default) → renders LeagueParticipantView, the extracted,
// byte-identical existing flow (board commit / battle / claims / draft) — the
// live tab is untouched until the redesign is flipped on.
//
// LEAGUE_REDESIGN_ENABLED (or the ?leagueRedesign=1 dev preview, mirroring the
// ?tournamentDev=1 idiom) ON → the redesigned spectate-and-enter lobby
// (LeagueHome) is the landing. "Open my game" pushes the real participant flow
// full-screen (its own full-width container + a back affordance) — per the
// front-door decision, the existing flow stays intact and reachable, not
// rebuilt or nested inside the redesign's centered column.

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { LEAGUE_REDESIGN_ENABLED } from '../config/featureFlags';
import { useTheme } from '../contexts/ThemeContext';
import LeagueParticipantView from './LeagueParticipantView';
import LeagueHome from '../components/League/LeagueHome';
import LeagueClimb from '../components/League/LeagueClimb';

const SP = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

const REDESIGN_ON = LEAGUE_REDESIGN_ENABLED || SP.get('leagueRedesign') === '1';

// Next-arc dev/dark preview: the Altitude Climb standings render ONLY for the
// explicit `?leagueClimb=1` param (with `&m=live|final&c=training|ranked`),
// mirroring the `?leagueRedesign=1` idiom. Nothing reads LEAGUE_NEXT_ARC_ENABLED
// yet — the flag is the future in-app entry's gate, inert until a later phase —
// so flag-on + no-param stays byte-unchanged.
const CLIMB_PREVIEW = SP.get('leagueClimb') === '1';
const CLIMB_MODE = ['live', 'final'].includes(SP.get('m')) ? SP.get('m') : 'live';
const CLIMB_CTX = ['training', 'ranked'].includes(SP.get('c')) ? SP.get('c') : 'training';

export default function LeagueScreen({ onOpenTrainingPod, hasAgent, agentLoadout } = {}) {
  const { tokens } = useTheme();
  const [view, setView] = React.useState('home');
  const [climb, setClimb] = React.useState(CLIMB_PREVIEW);

  // Next-arc dev/dark preview — the Altitude Climb standings, fixtures-backed.
  // Reachable only via ?leagueClimb=1; "League" (onBack) returns to the normal surface.
  if (climb) return <LeagueClimb mode={CLIMB_MODE} ctx={CLIMB_CTX} onBack={() => setClimb(false)} />;

  // Flag/param OFF → today's behavior, byte-identical.
  if (!REDESIGN_ON) return <LeagueParticipantView />;

  // Front door: redesigned lobby is the landing; "Open my game" pushes the real
  // participant flow full-screen with a back affordance.
  if (view === 'mygame') {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: tokens.bgApp }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center',
          padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px',
          background: tokens.bgApp, borderBottom: `1px solid ${tokens.borderDivider}`,
        }}>
          <button
            onClick={() => setView('home')}
            style={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: tokens.textMuted, fontSize: 13 }}
          >
            <ArrowLeft size={16} /> League
          </button>
        </div>
        <LeagueParticipantView />
      </div>
    );
  }

  return <LeagueHome onOpenMyGame={() => setView('mygame')} onOpenTrainingPod={onOpenTrainingPod} hasAgent={hasAgent} agentLoadout={agentLoadout} />;
}
