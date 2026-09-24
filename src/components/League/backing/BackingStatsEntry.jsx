// src/components/League/backing/BackingStatsEntry.jsx
//
// Backing Beta PR 5 — THE PRIVATE STATS' PROFILE HOME on mobile: the two
// surfaces (My Backing stats, Trainer beta stats) under the identity bench
// where the scouting pitch lives (EquipStation), reached from the viewer's own
// agent area (spec V1.3 §5; D-v, D-w). Gated at CALL time on
// BACKING_BETA_ENABLED so the flag-off bench is byte-identical and runs no
// fetch (the ScoutingLine shape: the outer component holds no hook; the inner
// one owns the two reads). Mounted BARE by its host — it renders null while
// dark, and a wrapper of the host's own would survive that null render.
//
// Private, no consequences, no comparison: the server answers the token's
// own record and nothing else; the words say so on the surface.

import React, { useState } from 'react';
import { BACKING_BETA_ENABLED } from '../../../config/featureFlags';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Eyebrow, Mono } from '../LeagueParts';
import useMyBackingStats from '../../../hooks/useMyBackingStats';
import useTrainerStats from '../../../hooks/useTrainerStats';
import MyBackingStats from './MyBackingStats';
import TrainerStats from './TrainerStats';
import { STATS } from './backingCopy';

const tabStyle = (on, accent) => ({
  all: 'unset', boxSizing: 'border-box', cursor: 'pointer', padding: '6px 10px', borderRadius: 9, fontSize: 11.5, fontWeight: 600,
  color: on ? LTOKENS.bg : LTOKENS.ink2, background: on ? accent : 'transparent', border: `1px solid ${on ? accent : LTOKENS.hair2}`,
});

/**
 * The two stats' home, pure over the two reads (each hook's return) — the live
 * mount below feeds it; the dev preview page feeds it fixtures (Backing
 * desktop layouts: the stats' desktop home beside the pitch), so the preview
 * shows THIS view. `initialTab` opens a tab (the preview's "as a team" state).
 */
export function StatsEntryView({ mine, trainer, accent = LX.energy, compact = false, initialTab = 'mine' }) {
  const [tab, setTab] = useState(initialTab);
  const current = tab === 'mine' ? mine : trainer;
  return (
    <div data-backing="stats-entry" style={{ marginTop: compact ? 12 : 0, borderRadius: 14, padding: compact ? '11px 13px' : '13px 15px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <Eyebrow color={LTOKENS.ink3}>{STATS.eyebrow}</Eyebrow>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', marginBottom: 8 }}>{STATS.title}</div>
      <div role="tablist" aria-label={STATS.title} style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {['mine', 'trainer'].map((id) => (
          <button key={id} type="button" role="tab" className="lg-tap" data-backing="stats-tab" data-tab={id} aria-selected={tab === id} onClick={() => setTab(id)} style={tabStyle(tab === id, accent)}>
            {STATS.tabs[id]}
          </button>
        ))}
      </div>
      {current.loading && !current.data && <Mono style={{ fontSize: 11, color: LTOKENS.ink3 }}>{STATS.loading}</Mono>}
      {!current.loading && !current.data && <div role="alert" style={{ fontSize: 12, color: LTOKENS.ink2 }}>{STATS.unavailable}</div>}
      {current.data && (tab === 'mine' ? <MyBackingStats stats={mine.data} /> : <TrainerStats stats={trainer.data} />)}
      <div style={{ marginTop: 9, padding: '6px 9px', borderRadius: 8, background: alpha(LTOKENS.bg, 0.5), display: 'inline-block' }}>
        <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{STATS.label}</Mono>
      </div>
    </div>
  );
}

function BackingStatsEntryLive({ accent, compact }) {
  const mine = useMyBackingStats(true);
  const trainer = useTrainerStats(true);
  return <StatsEntryView mine={mine} trainer={trainer} accent={accent} compact={compact} />;
}

/** The profile home. Renders nothing — and runs nothing — while the flag is dark. */
export default function BackingStatsEntry({ uid, accent = LX.energy, compact = false }) {
  if (!BACKING_BETA_ENABLED) return null;
  if (!uid) return null;
  return <BackingStatsEntryLive accent={accent} compact={compact} />;
}
