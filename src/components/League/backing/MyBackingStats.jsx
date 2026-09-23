// src/components/League/backing/MyBackingStats.jsx
//
// Backing Beta PR 5 — MY BACKING STATS, PRIVATE (spec V1.3 §5 "My Backing
// stats — private. Net BP (season, career), pools backed, pools won, accuracy
// versus the naive baseline (§10), weeks played. No public ranked leaderboard
// in the beta (D-v)"). Mobile layout. Pure over GET /api/backing/my-stats's
// reply: no hook, no fetch. Nothing here is a ranking, a comparison to any
// other player, or a consequence (§9) — the naive baseline is a rule, stated
// as one. Tokens only (BUILD_RULES §10).

import React from 'react';
import { LTOKENS, LX } from '../leagueTokens';
import { Mono } from '../LeagueParts';
import { MonoAttr, Stat } from './BackingParts';
import { STATS } from './backingCopy';

const box = { borderRadius: 12, padding: '10px 12px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` };
const head = { fontSize: 9.5, color: LTOKENS.ink2, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 };

function Column({ title, bucket }) {
  const net = Number.isFinite(bucket?.net) ? bucket.net : 0;
  return (
    <div data-backing="stats-column" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Mono style={head}>{title}</Mono>
      <Stat k={STATS.net} v={STATS.signedNet(net)} color={net > 0 ? LTOKENS.gold : net < 0 ? LX.neg : LTOKENS.ink} />
      <Stat k={STATS.poolsBacked} v={String(bucket?.poolsBacked ?? 0)} />
      <Stat k={STATS.poolsWon} v={String(bucket?.poolsWon ?? 0)} />
      <Stat k={STATS.weeksPlayed} v={String(bucket?.weeksPlayed ?? 0)} />
      <Stat k={STATS.pending} v={STATS.inPlay(bucket?.pending ?? 0, bucket?.inPlayBp ?? 0)} color={LTOKENS.ink2} />
    </div>
  );
}

function Accuracy({ acc }) {
  const pools = acc?.pools ?? 0;
  return (
    <div data-backing="stats-accuracy" style={box}>
      <Mono style={head}>{STATS.accuracy}</Mono>
      {pools === 0 ? (
        <Mono style={{ fontSize: 11, color: LTOKENS.ink3 }}>{STATS.noPools}</Mono>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <Stat k={STATS.yours} v={STATS.accuracyLine(acc.youWon ?? 0, pools)} color={LTOKENS.ink} />
          <Stat k={STATS.baseline} v={STATS.accuracyLine(acc.baselineWon ?? 0, pools)} color={LTOKENS.ink2} />
        </div>
      )}
      <div style={{ fontSize: 11, color: LTOKENS.ink3, lineHeight: 1.45, marginTop: 7 }}>{STATS.baselineNote}</div>
      {acc?.excluded > 0 && <MonoAttr data-backing="stats-excluded" style={{ display: 'block', fontSize: 10, color: LTOKENS.ink3, marginTop: 4 }}>{STATS.excluded(acc.excluded)}</MonoAttr>}
    </div>
  );
}

export default function MyBackingStats({ stats }) {
  if (!stats || typeof stats !== 'object') return null;
  return (
    <div data-backing="my-stats" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...box, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Column title={STATS.season} bucket={stats.season} />
        <Column title={STATS.career} bucket={stats.career} />
      </div>
      <Accuracy acc={stats.accuracy?.career} />
      <Mono style={{ fontSize: 10, color: LTOKENS.ink3, lineHeight: 1.5 }}>{STATS.sub}</Mono>
    </div>
  );
}
