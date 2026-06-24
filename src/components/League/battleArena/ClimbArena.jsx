// src/components/League/battleArena/ClimbArena.jsx
//
// League Battle View V2 — THE HERO. The competition as a living climb: four
// players as positional presences ascending toward the summit, the leader
// crowned, the ranked cut line drawn, your teal presence the one to track.
// Altitude = composite (points, never percent — the callouts format via
// ArenaCount/fmtScore). When a star pops in the dock below, the points fly UP
// here and your presence surges.
//
// Translated from the locked Claude Design (battle-climb), re-skinned onto the
// shared League palette. Obsidian; reduced-motion safe (ambient motion is CSS the
// global guard neutralizes; the fly-up + surge are JS-gated and simply omit).

import React from 'react';
import { Mono, LIcon } from '../LeagueParts';
import { LTOKENS, LX, alpha, MONO } from '../leagueTokens';
import { fmtPoints } from '../../../utils/leagueFormat';
import { ArenaCount } from './ArenaPrimitives';
import { ST_GOOD } from './arenaTheme';
import { frameDayIdx } from './arenaStateMap';
import { prefersReducedMotion } from './arenaEngineCore';

// the living atmosphere — deep sky, drifting aurora, a deterministic star field.
function ClimbAtmosphere({ tone }) {
  const stars = React.useMemo(() => {
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    return Array.from({ length: 46 }, () => ({ x: rnd() * 100, y: rnd() * 100, r: 0.5 + rnd() * 1.4, d: 2 + rnd() * 4, delay: rnd() * 4 }));
  }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 18, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${alpha('#14304f', 0.55)} 0%, ${alpha('#0e2236', 0.4)} 34%, ${LTOKENS.bg} 78%)` }} />
      <div className="bv2-aurora1" style={{ position: 'absolute', top: '-12%', left: '8%', width: '60%', height: '70%', borderRadius: '50%',
        background: `radial-gradient(circle, ${alpha(tone, 0.16)}, transparent 64%)`, filter: 'blur(26px)' }} />
      <div className="bv2-aurora2" style={{ position: 'absolute', top: '-6%', right: '4%', width: '52%', height: '64%', borderRadius: '50%',
        background: `radial-gradient(circle, ${alpha(ST_GOOD, 0.1)}, transparent 66%)`, filter: 'blur(30px)' }} />
      <div className="bv2-particles" style={{ position: 'absolute', inset: '-30px 0' }}>
        {stars.map((st, i) => (
          <span key={i} className="bv2-twinkle" style={{ position: 'absolute', left: `${st.x}%`, top: `${st.y}%`, width: st.r * 2, height: st.r * 2,
            borderRadius: '50%', background: i % 7 === 0 ? alpha(tone, 0.9) : alpha('#CDE9F2', 0.8), boxShadow: `0 0 ${st.r * 3}px ${alpha('#CDE9F2', 0.5)}`,
            animationDelay: `${st.delay}s`, animationDuration: `${st.d}s` }} />
        ))}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '34%', background: `linear-gradient(180deg, transparent, ${alpha('#0a1722', 0.5)})` }} />
    </div>
  );
}

export function ClimbArena({ state, mode, seats, climb, youId, w, h, surge, onPlayer, dayIdx: dayIdxProp = null, compact = false }) {
  const live = state === 'live'; const calm = state === 'awaiting';
  const ranked = mode === 'ranked';
  // Real data supplies the true last-banked index; the fixture preview falls back
  // to frameDayIdx(state).
  const dayIdx = dayIdxProp != null ? dayIdxProp : frameDayIdx(state);
  const tone = ranked ? LTOKENS.gold : LTOKENS.teal;

  const rows = seats.map((s) => ({ ...s, scores: climb[s.id] || [] }));
  const lastIdx = calm ? 0 : dayIdx;
  const at = (s) => s.scores[lastIdx] ?? 0;
  const ranking = [...rows].sort((a, b) => at(b) - at(a));
  const leaderId = ranking[0]?.id;
  const rankOf = (id) => ranking.findIndex((s) => s.id === id) + 1;
  const youRow = rows.find((s) => s.id === youId);

  // geometry — `compact` tightens the axis + vertical padding for the ~374-wide
  // mobile hero. Default off → the desktop hero geometry is byte-identical.
  const axisW = compact ? 40 : 52; const padT = compact ? 32 : 40; const padB = compact ? 54 : 62;
  const plotT = padT; const plotB = h - padB;
  const laneW = (w - axisW) / rows.length;
  const laneX = (i) => axisW + laneW * (i + 0.5);
  const vals = rows.map(at);
  const dMin = Math.min(...vals); const dMax = Math.max(...vals);
  const DOM = calm ? [-3, 11] : [dMin - 1.5, dMax + 0.8];
  const Y = (a) => plotB - ((a - DOM[0]) / (DOM[1] - DOM[0])) * (plotB - plotT);

  // the cut sits midway between 2nd and 3rd; only a pod of ≥3 has a meaningful
  // cut, so a sparse/partial pod (live data) neither computes nor draws one.
  const hasCut = ranked && !calm && ranking.length >= 3;
  const cutAlt = ranking.length >= 3 ? (at(ranking[1]) + at(ranking[2])) / 2 : 0;
  const span = DOM[1] - DOM[0];
  const gstep = span > 9 ? 3 : span > 5 ? 2 : 1;
  const gridVals = [];
  for (let g = Math.ceil(DOM[0] / gstep) * gstep; g <= DOM[1] - 0.4; g += gstep) gridVals.push(g);

  const reduce = prefersReducedMotion();

  return (
    <div style={{ position: 'relative', width: w, height: h, overflow: 'hidden', borderRadius: 18, background: LTOKENS.bg, border: `1px solid ${LTOKENS.hair}` }}>
      <ClimbAtmosphere tone={tone} />
      <div style={{ position: 'absolute', top: -46, left: '50%', transform: 'translateX(-50%)', width: '64%', height: 170,
        background: `radial-gradient(circle, ${alpha(tone, 0.16)}, transparent 70%)`, pointerEvents: 'none' }} />

      <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {gridVals.map((g) => (
          <g key={g}>
            <line x1={axisW} y1={Y(g)} x2={w} y2={Y(g)} stroke={g === 0 ? LTOKENS.hair2 : LTOKENS.hair} strokeWidth={1} strokeDasharray={g === 0 ? '0' : '1 6'} />
            <text x={axisW - 7} y={Y(g) + 3.5} textAnchor="end" fontFamily={MONO} fontSize={10} fill={LTOKENS.ink3}>{g > 0 ? '+' : ''}{g}</text>
          </g>
        ))}
        {hasCut && (
          <g>
            <rect x={axisW} y={plotT} width={w - axisW} height={Y(cutAlt) - plotT} fill={alpha(LX.cut, 0.045)} />
            <line x1={axisW} y1={Y(cutAlt)} x2={w} y2={Y(cutAlt)} stroke={alpha(LX.cut, 0.55)} strokeWidth={1.3} strokeDasharray="8 5" />
          </g>
        )}
        {!calm && rows.map((s, i) => {
          const x = laneX(i); const yTop = Y(at(s));
          return (
            <g key={s.id}>
              <defs>
                <linearGradient id={`bv2cl${s.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={s.id === youId ? 0.7 : 0.5} />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1={x} y1={yTop} x2={x} y2={plotB} stroke={`url(#bv2cl${s.id})`} strokeWidth={s.id === youId ? 4 : 2.5} strokeLinecap="round" />
              {live && s.scores.slice(0, lastIdx).map((v, k) => (
                <circle key={k} cx={x} cy={Y(v)} r={2.2} fill={LTOKENS.bg} stroke={s.color} strokeWidth={1.3} strokeOpacity={0.5} />
              ))}
            </g>
          );
        })}
      </svg>

      {ranked && !calm && (
        <div style={{ position: 'absolute', left: axisW + 6, top: Y(cutAlt) - 18, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: alpha(LX.cut, 0.12), border: `1px solid ${alpha(LX.cut, 0.4)}` }}>
            <LIcon name="flag" size={10} color={LX.cut} stroke={2} />
            <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: LX.cut }}>CUT · TOP 2 ADVANCE</Mono>
          </span>
        </div>
      )}

      {/* the presences */}
      {rows.map((s, i) => {
        const you = s.id === youId; const lead = s.id === leaderId;
        const x = laneX(i); const y = calm ? plotB - 16 : Y(at(s));
        const sz = compact ? (you ? 44 : lead ? 40 : 36) : (you ? 52 : lead ? 46 : 40);
        const rk = rankOf(s.id);
        const bob = !calm && !reduce ? (you ? 'bv2-bob-you' : 'bv2-bob') : '';
        return (
          <div key={s.id}>
            <div style={{ position: 'absolute', left: x, top: plotB + 14, transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: s.color, boxShadow: you ? `0 0 6px ${alpha(s.color, 0.8)}` : 'none' }} />
                <span style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: you ? s.color : LTOKENS.ink2 }}>{s.name}</span>
                {you && <Mono style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: s.color }}>YOU</Mono>}
              </span>
              {s.arch && <Mono style={{ fontSize: 8.5, color: LTOKENS.ink3, marginTop: 1, display: 'block' }}>{s.arch}</Mono>}
            </div>

            {/* centering lives on the outer node; the bob + surge animate an inner
                wrapper each (they set translateY, which must not clobber the
                -50%,-50% centering — the design prototype's latent shift bug). */}
            <div onClick={onPlayer && !you && !calm ? () => onPlayer(s.id) : undefined}
              style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)', cursor: onPlayer && !you && !calm ? 'pointer' : 'default' }}>
              <div className={bob} style={{ position: 'relative' }}>
                <div className={you && surge && surge.key && !reduce ? 'bv2-surge' : ''} key={you && surge ? surge.key : undefined} style={{ position: 'relative' }}>
                  {!calm && (you || lead) && !reduce && (
                    <div className="bv2-halo" style={{ position: 'absolute', left: '50%', top: '50%', width: sz + 14, height: sz + 14, borderRadius: '50%', border: `1.5px solid ${s.color}`, pointerEvents: 'none' }} />
                  )}
                  <div style={{ width: sz, height: sz, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `radial-gradient(circle at 35% 30%, ${alpha(s.color, 0.95)}, ${alpha(s.color, 0.55)})`,
                    border: `2px solid ${alpha(s.color, you ? 1 : 0.7)}`, boxShadow: `0 0 ${you ? 22 : 14}px ${alpha(s.color, you ? 0.7 : 0.45)}` }}>
                    <Mono style={{ fontSize: compact ? (you ? 15 : 13) : (you ? 17 : 14), fontWeight: 700, color: '#0A0B0E' }}>{calm ? '·' : rk}</Mono>
                  </div>
                  {lead && !calm && (
                    <div style={{ position: 'absolute', top: -17, left: '50%', transform: 'translateX(-50%)' }}>
                      <LIcon name="crown" size={compact ? 15 : 17} color={LTOKENS.gold} stroke={2} />
                    </div>
                  )}
                </div>
                {!calm && (
                  <div style={{ position: 'absolute', left: sz / 2 + 11, top: '50%', transform: 'translateY(-50%)', whiteSpace: 'nowrap' }}>
                    <ArenaCount value={at(s)} size={compact ? (you ? 15 : 12) : (you ? 18 : 14)} weight={700} showSign={false} />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* you → cut gap + the fly-up token (live) */}
      {live && youRow && (() => {
        const yi = rows.findIndex((s) => s.id === youId);
        const yx = laneX(yi); const yy = Y(at(youRow));
        const youRank = rankOf(youId);
        const gap = ranked && youRank > 2 ? +(cutAlt - at(youRow)).toFixed(1) : null;
        const flyLabel = surge ? (typeof surge.pts === 'number' ? fmtPoints(surge.pts) : surge.pts) : null;
        return (
          <>
            {gap != null && gap > 0 && (
              <div className={reduce ? '' : 'bv2-rise'} style={{ position: 'absolute', left: yx, top: yy - 42, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: alpha(LX.cut, 0.12), border: `1px solid ${alpha(LX.cut, 0.4)}` }}>
                  <LIcon name="long" size={9} color={LX.cut} stroke={2.4} />
                  <Mono style={{ fontSize: 9, fontWeight: 700, color: LX.cut }}>{gap} to the cut</Mono>
                </span>
              </div>
            )}
            {surge && surge.key && !reduce && (
              <div key={`fly${surge.key}`} className="bv2-fly" style={{ position: 'absolute', left: yx, top: plotB - 10, transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 5 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, background: alpha(ST_GOOD, 0.95), boxShadow: `0 0 16px ${alpha(ST_GOOD, 0.8)}` }}>
                  <LIcon name="bolt" size={11} color="#0A0B0E" stroke={2.4} />
                  <Mono style={{ fontSize: 13, fontWeight: 800, color: '#0A0B0E' }}>{flyLabel}</Mono>
                </span>
              </div>
            )}
          </>
        );
      })()}

      {calm && (
        <div style={{ position: 'absolute', top: padT - 6, left: 0, right: 0, textAlign: 'center' }}>
          <Mono style={{ fontSize: 11, letterSpacing: '0.16em', color: LTOKENS.ink3, textTransform: 'uppercase' }}>The climb begins at the bell</Mono>
        </div>
      )}
    </div>
  );
}
