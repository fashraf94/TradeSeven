// src/components/League/DeskSeasonRail.jsx
//
// Weekly Ladder §5 — the right-rail standings rail.
//
// FLAG OFF (default): renders DeskLeaderboard and nothing else, so the rail is
// byte-identical to today's (acceptance 7). There is no tab strip, no extra
// wrapper, no state.
//
// FLAG ON: two complementary views behind one tab strip —
//   • THE FIELD  — the live current-week standing that ships today. The spec is
//     explicit that this STAYS; the season view is an addition, not a
//     replacement.
//   • SEASON     — the promoted monthly board (LeaderboardCard), cumulative
//     placement points with the per-week decomposition (§9).
//
// REUSE-FIRST: both views are the EXISTING components. This file adds a tab
// strip and nothing else — in particular it does NOT re-sort, re-rank or
// re-derive anything. The season ordering lives in exactly one place
// (tournamentSurfaces.rankLeaderboardEntries, consumed by LeaderboardCard); a
// second copy here is how the two views would silently drift apart.

import React, { useState } from 'react';
import { LTOKENS, alpha } from './leagueTokens';
import { Eyebrow } from './LeagueParts';
import { DeskLeaderboard } from './LeagueDeskParts';
import LeaderboardCard from '../Tournament/LeaderboardCard';
import { WEEKLY_LADDER_PLACEMENT_ENABLED } from '../../config/featureFlags';

const TABS = [
  { key: 'field', label: 'The Field', hint: 'this week' },
  { key: 'season', label: 'Season', hint: 'the month' },
];

export default function DeskSeasonRail({ st, accent, uid = null, onOpenGroup = null, tab: tabProp, onTabChange }) {
  // The tab is CONTROLLED when the parent supplies it. It must be, in the
  // desktop lobby: that rail swaps this component out for the docked
  // DeskPodPanel, so local state here would be unmounted — and silently reset
  // Season back to The Field — every time a player opened a pod. The
  // uncontrolled fallback keeps the component usable standalone.
  const [tabLocal, setTabLocal] = useState('field');
  const tab = tabProp ?? tabLocal;
  const setTab = onTabChange ?? setTabLocal;

  // Dark: the rail is exactly what it is today.
  if (!WEEKLY_LADDER_PLACEMENT_ENABLED) return <DeskLeaderboard st={st} accent={accent} />;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexShrink: 0 }} role="tablist">
        {TABS.map(t => {
          const on = tab === t.key;
          return (
            <button key={t.key} role="tab" aria-selected={on}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, cursor: 'pointer', borderRadius: 8, padding: '5px 8px', textAlign: 'left',
                background: on ? alpha(accent, 0.12) : 'transparent',
                border: `1px solid ${on ? alpha(accent, 0.34) : LTOKENS.hair}`,
              }}>
              <Eyebrow color={on ? accent : LTOKENS.ink3}>{t.label}</Eyebrow>
              <div style={{ fontSize: 9, color: LTOKENS.ink3, marginTop: 1 }}>{t.hint}</div>
            </button>
          );
        })}
      </div>

      <div className="lg-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {tab === 'field'
          ? <DeskLeaderboard st={st} accent={accent} />
          : <LeaderboardCard uid={uid} onOpenGroup={onOpenGroup} />}
      </div>
    </div>
  );
}
