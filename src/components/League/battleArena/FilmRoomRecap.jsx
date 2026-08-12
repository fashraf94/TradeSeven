// src/components/League/battleArena/FilmRoomRecap.jsx
//
// League Score History — the Film Room recap body (V1: Level 1 composite
// timeline + the per-day agent swap ledger). Presentational only; every number
// is handed in via `history` (buildScoreHistory), which is a pure read over
// already-banked data. Rendered inside FilmRoomOverlay when the flag is on and a
// battle chain is present; otherwise the overlay keeps its placeholder.
//
// DISPLAY-AGREEMENT (§9): the swap numbers come from buildScoreHistory, which
// sums the SAME buildSwapLedger the live decomposition strip uses — so today's
// swap subtotal here IS the strip's SWAPS term, by construction.
//
// HONESTY: per-symbol agent BASE for prior days is not persisted (aggregate
// only), so it is never shown per name — stated plainly, never approximated.

import React from 'react';
import { Mono, Eyebrow, LIcon, Icon } from '../LeagueParts';
import { LTOKENS, alpha, MONO } from '../leagueTokens';
import { fmtPoints, fmtScore } from '../../../utils/leagueFormat';
import { OWN_AGENT, ST_GOOD, ST_BAD } from './arenaTheme';

// Tints from the ROUNDED value so the color and the printed number come from one
// source (§9): a value that prints '0' / '0.0' is never painted green/red.
const tintPts = (v) => { const r = Math.round(v); return r > 0 ? ST_GOOD : r < 0 ? ST_BAD : LTOKENS.ink2; };
const tintScore = (v) => { const r = Math.round(v * 10); return r > 0 ? ST_GOOD : r < 0 ? ST_BAD : LTOKENS.ink2; };

// A tiny, dependency-free polyline of the composite climb — "the shape of the
// week". Non-scaling stroke so it stays crisp at any width; needs ≥2 points.
function Sparkline({ values, color = LTOKENS.gold }) {
  const n = values.length;
  if (n < 2) return null;
  const W = 100, H = 30, P = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1; // flat week → centre the line
  const x = (i) => P + (i * (W - 2 * P)) / (n - 1);
  const y = (v) => P + (H - 2 * P) * (1 - (v - min) / span);
  const pts = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="1.5" fill={color} />)}
    </svg>
  );
}

function SectionHead({ color, icon, eyebrow, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: alpha(color, 0.12), border: `1px solid ${alpha(color, 0.34)}` }}>
        <LIcon name={icon} size={17} color={color} stroke={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <Eyebrow color={color}>{eyebrow}</Eyebrow>
        <div style={{ fontSize: 15, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', marginTop: 2 }}>{title}</div>
      </div>
    </div>
  );
}

const rowBase = {
  display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', borderRadius: 9,
  background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}`,
};

export function FilmRoomRecap({ history = null }) {
  if (!history) return null;
  const {
    timeline = [], swapDays = [], swapTotal = 0, currentSwapSubtotal = 0, swapCount = 0,
  } = history;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', width: '100%', textAlign: 'left' }}>
      {/* ── LEVEL 1 — the composite climb, day by day ── */}
      <section style={{ marginBottom: 22 }}>
        <SectionHead color={LTOKENS.gold} icon="crown" eyebrow="Your climb · day by day" title="How the week was built" />
        {timeline.length ? (
          <>
            <div style={{ padding: '12px 12px 8px', borderRadius: 12, background: alpha(LTOKENS.gold, 0.06), border: `1px solid ${alpha(LTOKENS.gold, 0.22)}`, marginBottom: 9 }}>
              <Sparkline values={timeline.map((t) => t.composite)} color={LTOKENS.gold} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {timeline.map((t, i) => (
                <div key={t.day ?? i} style={rowBase}>
                  <Mono style={{ fontSize: 10.5, fontWeight: 700, color: LTOKENS.ink3, width: 44, flexShrink: 0 }}>
                    DAY {t.day ?? i + 1}
                  </Mono>
                  <Mono style={{ flex: 1, fontSize: 13, fontWeight: 800, color: LTOKENS.ink, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtScore(t.composite)}
                  </Mono>
                  <Mono style={{ fontSize: 11.5, fontWeight: 700, color: t.delta == null ? LTOKENS.ink3 : alpha(tintScore(t.delta), 0.95), fontVariantNumeric: 'tabular-nums' }}>
                    {t.delta == null ? 'start' : fmtScore(t.delta)}
                  </Mono>
                </div>
              ))}
            </div>
            <Mono style={{ display: 'block', marginTop: 9, fontSize: 10, color: LTOKENS.ink3, lineHeight: 1.5 }}>
              Composite at each day&rsquo;s close — the cumulative standing the climb is drawn from. This is banked, so it reads the same here after the battle ends.
            </Mono>
          </>
        ) : (
          <Mono style={{ display: 'block', fontSize: 11.5, color: LTOKENS.ink2, lineHeight: 1.6 }}>
            No banked days yet — your climb appears after the first daily close.
          </Mono>
        )}
      </section>

      {/* ── SWAPS — the per-day ledger ── */}
      <section style={{ marginBottom: 20 }}>
        <SectionHead color={OWN_AGENT} icon="scissors" eyebrow="Agent swaps · day by day" title="Every swap, and what it locked" />
        {swapCount ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {swapDays.map((d) => (
                <div key={d.day}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                    <Mono style={{ fontSize: 10.5, fontWeight: 800, color: LTOKENS.ink2, letterSpacing: '0.04em' }}>
                      DAY {d.day}{d.isCurrent ? ' · today' : ''}
                    </Mono>
                    <span style={{ flex: 1, height: 1, background: LTOKENS.hair }} />
                    <Mono style={{ fontSize: 11.5, fontWeight: 800, color: alpha(tintPts(d.subtotal), 0.95), fontVariantNumeric: 'tabular-nums' }}>
                      {fmtPoints(d.subtotal)}
                    </Mono>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {d.items.map((it, i) => (
                      <div key={`${it.out}-${it.in}-${i}`} style={rowBase}>
                        <LIcon name="scissors" size={12} color={LTOKENS.ink3} stroke={2} />
                        <Mono style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: LTOKENS.ink2 }}>
                          <span style={{ color: LTOKENS.ink3, textDecoration: 'line-through' }}>{it.out ?? '—'}</span>
                          <span style={{ color: OWN_AGENT, margin: '0 6px' }}>&rarr;</span>
                          <span style={{ color: LTOKENS.ink }}>{it.in ?? '—'}</span>
                          {(it.entryPrice != null && it.exitPrice != null) && (
                            <Mono style={{ display: 'block', fontSize: 9.5, color: LTOKENS.ink3, marginTop: 2 }}>
                              {it.entryPrice} &rarr; {it.exitPrice}{it.gainPct != null ? ` · ${fmtScore(it.gainPct)}%` : ''}
                            </Mono>
                          )}
                        </Mono>
                        <Mono style={{ fontSize: 12.5, fontWeight: 800, color: alpha(tintPts(it.pts), 0.95), fontVariantNumeric: 'tabular-nums' }}>
                          {fmtPoints(it.pts)}
                        </Mono>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 10,
              background: alpha(OWN_AGENT, 0.08), border: `1px solid ${alpha(OWN_AGENT, 0.3)}` }}>
              <Mono style={{ flex: 1, fontSize: 11, fontWeight: 700, color: LTOKENS.ink2, letterSpacing: '0.02em' }}>ALL SWAPS · THIS BATTLE</Mono>
              <Mono style={{ fontSize: 14, fontWeight: 800, color: alpha(tintPts(swapTotal), 0.95), fontVariantNumeric: 'tabular-nums' }}>{fmtPoints(swapTotal)}</Mono>
            </div>
            <Mono style={{ display: 'block', marginTop: 9, fontSize: 10, color: LTOKENS.ink3, lineHeight: 1.5 }}>
              Today&rsquo;s swaps ({fmtPoints(currentSwapSubtotal)}) are the <b style={{ color: LTOKENS.ink2 }}>SWAPS</b> term on the live strip — the same number. Earlier days&rsquo; swaps are already banked into your altitude (they sit inside <b style={{ color: LTOKENS.ink2 }}>BANKED</b>).
            </Mono>
          </>
        ) : (
          <Mono style={{ display: 'block', fontSize: 11.5, color: LTOKENS.ink2, lineHeight: 1.6 }}>
            No swaps yet — your agent hasn&rsquo;t subbed a name this week. When it does, each swap&rsquo;s locked points land here.
          </Mono>
        )}
      </section>

      {/* ── HONESTY — what is and isn't recorded ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '11px 13px', borderRadius: 10,
        background: alpha(LTOKENS.ink3, 0.08), border: `1px solid ${LTOKENS.hair2}` }}>
        <Icon name="lock" size={13} color={LTOKENS.ink3} style={{ marginTop: 1 }} />
        <Mono style={{ fontSize: 10, color: LTOKENS.ink2, lineHeight: 1.55 }}>
          Every number here is already earned — locked swap points and banked daily closes, nothing live. Your agent&rsquo;s <b style={{ color: LTOKENS.ink2 }}>per-symbol base for past days isn&rsquo;t recorded</b> (only each day&rsquo;s total is), so it&rsquo;s never shown per name — per-symbol badges arrive in the next update.
        </Mono>
      </div>
    </div>
  );
}
