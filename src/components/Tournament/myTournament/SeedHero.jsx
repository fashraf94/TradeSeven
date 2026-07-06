// src/components/Tournament/myTournament/SeedHero.jsx
//
// STATE 3 hero — the two "where do I stand" identities, deliberately distinct:
//   SEED  = your transient position in THIS field (humans only, "N of M") —
//           the minimal-real derivation (deriveSeed). Live for V1.
//   RANK  = your persistent career tier across seasons — the REAL 7-tier ladder
//           via rankProgress(), shown as tier name + intra-tier progress.
//           NO fabricated percentile ("top 12%") — none exists.
// Standing (today's real composite + pod rank) sits below.

import React from 'react';
import { rankProgress } from '../../../constants/leagueTournament';
import { LTOKENS, LX, alpha } from '../../League/leagueTokens';
import { Eyebrow, Mono, LIcon, Score } from '../../League/LeagueParts';
import { TCard } from './TCard';

// The career-rank amber — the same tier color RankCard renders with.
const RANK_AMBER = '#F59E0B';

export function SeedHero({ seed, rank, standing, compact }) {
  const prog = rank ? rankProgress(rank) : null;
  const composite = standing?.composite;
  const podRank = standing?.podRank;
  return (
    <TCard accent={LTOKENS.gold} glow pad={compact ? 16 : 20}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: compact ? 14 : 16 }}>
        <LIcon name="ranked" size={13} color={LTOKENS.gold} stroke={2} />
        <Eyebrow color={LTOKENS.gold}>Your position</Eyebrow>
        <span style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
          background: alpha(LTOKENS.teal, 0.1), border: `1px solid ${alpha(LTOKENS.teal, 0.3)}`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: LTOKENS.teal, animation: 'lgLiveDot 1.8s infinite' }} />
          <Mono style={{ fontSize: 9, fontWeight: 700, color: LTOKENS.teal, letterSpacing: '0.08em' }}>COMPETING</Mono>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compact ? 12 : 18 }}>
        {/* SEED — transient, this field, humans only */}
        <div>
          <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', color: LTOKENS.gold, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Seed · this field
          </Mono>
          {seed ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <Mono style={{ fontSize: compact ? 44 : 54, fontWeight: 700, color: LTOKENS.gold, lineHeight: 0.85, textShadow: `0 0 28px ${alpha(LTOKENS.gold, 0.4)}` }}>
                {seed.n}
              </Mono>
              <Mono style={{ fontSize: 14, fontWeight: 700, color: LTOKENS.ink2, lineHeight: 1 }}>of {seed.m}</Mono>
            </div>
          ) : (
            <Mono style={{ fontSize: compact ? 17 : 19, fontWeight: 700, color: LTOKENS.ink2, lineHeight: 1.1, display: 'block', paddingTop: 6 }}>
              Unranked yet
            </Mono>
          )}
          <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, letterSpacing: '0.01em', marginTop: 9, display: 'block', lineHeight: 1.4 }}>
            {seed ? 'Among humans · recomputes with standings · CPUs excluded' : 'Your field position appears once your week banks'}
          </Mono>
        </div>

        {/* CAREER RANK — persistent, real tier, no percentile */}
        <div style={{ borderLeft: `1px solid ${LTOKENS.hair}`, paddingLeft: compact ? 12 : 18 }}>
          <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', color: alpha(RANK_AMBER, 0.95), textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Career rank · all seasons
          </Mono>
          {prog ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: compact ? 34 : 38, height: compact ? 34 : 38, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `linear-gradient(180deg, ${alpha(RANK_AMBER, 0.28)}, ${alpha(RANK_AMBER, 0.08)})`, border: `1px solid ${alpha(RANK_AMBER, 0.55)}`,
                  boxShadow: `0 0 18px -6px ${alpha(RANK_AMBER, 0.7)}`,
                }}>
                  <LIcon name="ranked" size={compact ? 17 : 19} color={RANK_AMBER} stroke={2} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: compact ? 19 : 23, fontWeight: 700, color: LTOKENS.ink, lineHeight: 0.95, letterSpacing: '-0.01em' }}>{prog.tierName}</div>
                  <Mono style={{ fontSize: 9, color: alpha(RANK_AMBER, 0.9), letterSpacing: '0.08em', marginTop: 3, display: 'block' }}>TIER</Mono>
                </div>
              </div>
              {/* intra-tier progress bar — withinTierPct, NOT a population percentile */}
              <div style={{ height: 5, borderRadius: 4, background: LTOKENS.hair2, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((prog.withinTierPct ?? 0) * 100)}%`, background: RANK_AMBER, borderRadius: 4 }} />
              </div>
              <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, letterSpacing: '0.01em', marginTop: 8, display: 'block', lineHeight: 1.4 }}>
                {prog.nextTierName ? <>Climbing toward {prog.nextTierName}</> : <>Top of the ladder</>}
              </Mono>
            </>
          ) : (
            <Mono style={{ fontSize: compact ? 15 : 17, fontWeight: 700, color: LTOKENS.ink2, lineHeight: 1.2, display: 'block', paddingTop: 4 }}>
              Unranked yet
            </Mono>
          )}
        </div>
      </div>

      {/* STANDING — today's real composite + pod rank */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: compact ? 14 : 16, paddingTop: compact ? 13 : 15, borderTop: `1px solid ${LTOKENS.hair}` }}>
        <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', color: LTOKENS.ink3, textTransform: 'uppercase' }}>Standing</Mono>
        {Number.isFinite(composite)
          ? <Score v={composite} size={compact ? 22 : 26} />
          : <Mono style={{ fontSize: compact ? 16 : 18, color: LTOKENS.ink3 }}>—</Mono>}
        {podRank != null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
            background: alpha(podRank <= 2 ? LTOKENS.teal : LX.neg, 0.12), border: `1px solid ${alpha(podRank <= 2 ? LTOKENS.teal : LX.neg, 0.34)}`,
          }}>
            <Mono style={{ fontSize: 11, fontWeight: 700, color: podRank <= 2 ? LTOKENS.teal : LX.neg }}>#{podRank} in pod</Mono>
          </span>
        )}
        <Mono style={{ marginLeft: 'auto', fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.04em' }}>TODAY</Mono>
      </div>
    </TCard>
  );
}
