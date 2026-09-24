// src/components/League/backing/TrainerStats.jsx
//
// Backing Beta PR 5 — TRAINER STATS, PRIVATE TO THE TRAINER, LABELED "beta
// stats" (spec V1.3 §5 "Trainer stats — private to the trainer, labeled 'beta
// stats.' Unique backers on you, BP backed on you, backers' net on you.
// Non-ranked, no consequences attach (D-w)"; §8). Mobile layout. Pure over
// GET /api/backing/trainer-stats's reply: no hook, no fetch. Tokens only.
//
// CLOSED WEEKS ONLY (SEAL-1, the desktop review record; the desktop design's
// "this week's pool is sealed even to the trainer"): the reply counts no
// stake on an open pool, and says `thisWeek: { sealed: true }` when the
// trainer's team sits in one. Then the design's sealed "This week" row
// renders — a ruled absence with no figure in it — and, with no closed week
// to count, the design's first-week line rather than "Nobody has backed your
// team yet", which the trainer cannot know of a sealed book (SEAL-R-2). The
// row keys on the reply's marker, which the server reads from the POOL, never
// from whether a stake exists. The same view is the trainer stats' home on
// both viewports (EquipStation; IdentityPanel beside the pitch).

import React from 'react';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import { Icon, Mono } from '../LeagueParts';
import { Stat } from './BackingParts';
import { POD_LIST, STATS, bp } from './backingCopy';

const box = { borderRadius: 12, padding: '10px 12px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` };
const head = { fontSize: 9.5, color: LTOKENS.ink2, letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 };

function Column({ title, bucket }) {
  const net = Number.isFinite(bucket?.backersNet) ? bucket.backersNet : 0;
  return (
    <div data-backing="stats-column" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Mono style={head}>{title}</Mono>
      <Stat k={STATS.trainer.uniqueBackers} v={String(bucket?.uniqueBackers ?? 0)} />
      <Stat k={STATS.trainer.bpBacked} v={`${bp(bucket?.bpBacked ?? 0)} BP`} />
      <Stat k={STATS.trainer.backersNet} v={`${STATS.signedNet(net)} BP`} color={net > 0 ? LTOKENS.gold : net < 0 ? LX.neg : LTOKENS.ink} />
      <Stat k={STATS.trainer.pending} v={`${bp(bucket?.pending ?? 0)} BP`} color={LTOKENS.ink2} />
      <Stat k={STATS.trainer.poolsBackedOn} v={String(bucket?.poolsBackedOn ?? 0)} color={LTOKENS.ink2} />
    </div>
  );
}

/** The design's sealed "This week" row — the week named, a lock, SEALED; no figure. */
function SealedWeek() {
  return (
    <div data-backing="trainer-sealed-week" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '8px 11px', borderRadius: 10, border: `1px dashed ${LTOKENS.hair2}`, background: alpha(LTOKENS.bg, 0.4) }}>
      <Mono style={{ fontSize: 10.5, color: LTOKENS.ink2 }}>{STATS.trainer.sealedWeek}</Mono>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icon name="lock" size={10} color={LTOKENS.ink3} stroke={2} />
        <Mono style={{ fontSize: 9.5, color: LTOKENS.ink2, letterSpacing: '0.12em', fontWeight: 600 }}>{POD_LIST.sealed}</Mono>
        <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3 }}>· {STATS.trainer.sealedUntil}</Mono>
      </span>
    </div>
  );
}

export default function TrainerStats({ stats }) {
  if (!stats || typeof stats !== 'object') return null;
  const empty = (stats.career?.stakes ?? 0) === 0;
  const sealed = stats.thisWeek?.sealed === true;
  return (
    <div data-backing="trainer-stats" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: LTOKENS.ink2, lineHeight: 1.45 }}>{STATS.trainer.sub}</div>
      {sealed && <SealedWeek />}
      {empty ? (
        <div data-backing="trainer-empty" style={{ ...box, fontSize: 12, color: LTOKENS.ink3 }}>{sealed ? STATS.trainer.sealedFirst : STATS.trainer.empty}</div>
      ) : (
        <div style={{ ...box, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <Column title={STATS.season} bucket={stats.season} />
          <Column title={STATS.career} bucket={stats.career} />
        </div>
      )}
      <Mono style={{ fontSize: 10, color: LTOKENS.ink3, lineHeight: 1.5 }}>{STATS.sub}</Mono>
    </div>
  );
}
