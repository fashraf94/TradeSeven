/* eslint-disable react-refresh/only-export-components -- the chrome + its state rail are co-located page primitives */
// src/components/Tournament/myTournament/TourChrome.jsx
//
// Shared chrome for the "My Tournament" page: the "My tournament" eyebrow + a
// gold "Ranked" pill, the honest title/meta (the real week + "Ranked" — no
// fabricated "16 → 8 → 4 → champion" bracket topology, per the founder framing
// decision), and the three-step StateRail (Awaiting → Drafting → Live) that
// tracks the real forming → resolution → battle lifecycle.

import React from 'react';
import { LTOKENS, alpha } from '../../League/leagueTokens';
import { Eyebrow, Mono, LIcon } from '../../League/LeagueParts';

// The journey the rail walks — honest labels: "Live" is the battle/launchpad
// stage, not a live bracket.
export const TOUR_STEPS = [
  { key: 'awaiting', label: 'Awaiting draft', verb: 'Waiting' },
  { key: 'drafting', label: 'Drafting', verb: 'Drafting' },
  { key: 'bracket', label: 'Live', verb: 'Live' },
];

export function TourChrome({ state, title, meta, compact }) {
  const gold = LTOKENS.gold;
  return (
    <div style={{ marginBottom: compact ? 16 : 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: compact ? 7 : 9 }}>
            <Eyebrow color={gold}>My tournament</Eyebrow>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
              background: alpha(gold, 0.1), border: `1px solid ${alpha(gold, 0.3)}`,
            }}>
              <LIcon name="ranked" size={11} color={gold} stroke={2} />
              <Mono style={{ fontSize: 9.5, color: gold, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Ranked</Mono>
            </span>
          </div>
          <div style={{
            fontSize: compact ? 26 : 34, fontWeight: 700, lineHeight: 1.02,
            color: LTOKENS.ink, letterSpacing: '-0.02em',
          }}>
            {title}
          </div>
          {meta && (
            <Mono style={{ fontSize: compact ? 10.5 : 11.5, color: LTOKENS.ink2, letterSpacing: '0.04em', marginTop: 6, display: 'block' }}>
              {meta}
            </Mono>
          )}
        </div>
      </div>
      <StateRail state={state} compact={compact} style={{ marginTop: compact ? 15 : 18 }} />
    </div>
  );
}

// The three-step journey rail: waiting → drafting → live. Past steps get a
// crown + teal; the current step glows gold with a live dot; future steps are
// muted.
export function StateRail({ state, compact, style }) {
  const idx = TOUR_STEPS.findIndex((s) => s.key === state);
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: compact ? 6 : 9, ...style }}>
      {TOUR_STEPS.map((s, i) => {
        const done = i < idx;
        const cur = i === idx;
        const c = cur ? LTOKENS.gold : done ? LTOKENS.teal : LTOKENS.ink3;
        return (
          <div key={s.key} style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{
              height: 3, borderRadius: 3, background: cur || done ? c : LTOKENS.hair2,
              boxShadow: cur ? `0 0 10px ${alpha(c, 0.7)}` : 'none',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {cur ? (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0,
                  boxShadow: `0 0 0 3px ${alpha(c, 0.18)}`, animation: 'lgLiveDot 1.8s infinite',
                }} />
              ) : done ? (
                <LIcon name="crown" size={11} color={c} stroke={2.2} />
              ) : (
                <span style={{ width: 6, height: 6, borderRadius: '50%', border: `1.5px solid ${LTOKENS.hair2}`, flexShrink: 0 }} />
              )}
              <Mono style={{
                fontSize: compact ? 9 : 10, fontWeight: cur ? 700 : 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: cur ? c : done ? LTOKENS.ink2 : LTOKENS.ink3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {compact ? s.verb : s.label}
              </Mono>
            </div>
          </div>
        );
      })}
    </div>
  );
}
