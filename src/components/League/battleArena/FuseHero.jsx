// src/components/League/battleArena/FuseHero.jsx
//
// Branch A Phase 3 — THE FUSE HERO, desktop-first (compact geometry built in;
// Phase 6 verifies it on real viewports). The battleview's top half: x is the
// CLOCK, y is POINTS, and each seat renders as a glowing line with a burning
// tip carrying its head and running value. Replaces the ClimbArena scatter
// behind LEAGUE_FUSE_HERO_ENABLED (dark).
//
// Authority: LEAGUE_BATTLEVIEW_ADJUDICATION_V1 (R1-R14) + Branch A spec Phase 3
// + Amendments A/B. Every number drawn here is computed in fuseGeometry.js
// (pure, tested); this file is layout + chrome only.
//
// DATA CONTRACT (B2 — one source): the board reads the SESSION TRAIL
// (useSessionCompositeTrail via the model), whose snapshots share one clock
// (A3.2) and carry a seat forward through a dropped poll. The cut, the crown,
// the tips and the lines all derive from the SAME latest snapshot — never from
// seats[].score (mixed-basis) and never from a parallel scoresAtLast read
// (banked-floor flicker; see fuseGeometry.deriveCut).
//
// COLOUR RULES (spec, do not deviate): seat colour is IDENTITY; leader emphasis
// is the GOLD CROWN ONLY (the prototype's leader-gold value text is dropped —
// crown only means crown only); a negative running value renders in LX.neg,
// the one permitted override, applied to the value text and the line.
//
// PROHIBITED SCAFFOLDING, not present (R13): no flSeries, no 900ms burn timer /
// frac-stepKey loop, no useMarketPulse, no fixed stage, no candles, no tweaks
// panel.
//
// E1: the scrolling env tape is CUT. The backdrop is ArenaAtmosphere — texture
// without glyphs, so nothing competes with the fuses for attention (and the
// empty-plot reload state no longer leads with its own wallpaper).

import React from 'react';
import { Mono, LIcon } from '../LeagueParts';
import { LTOKENS, LX, alpha } from '../leagueTokens';
import AgentPresence, { archetypeToDisposition } from '../../AgentPresence';
import { isAgentPresenceOn } from '../../../config/featureFlags';
import { HEAD_FACE_LIFT } from './climbHeadLayout';
import { prefersReducedMotion } from './arenaEngineCore';
import { ArenaAtmosphere } from './arenaAtmosphere';
import {
  fuseFrame, makeScale, catmullPath, spreadLabels, thinYLabels, headerYieldsToNow,
  sessionFraction, DAY_XLABELS, WEEK_XLABELS, weekTipF,
  latestTrailSnapshot, deriveCut, seatDaySeries, seatWeekSeries,
} from './fuseGeometry';

// Deterministic spark offsets (R13: no randomness — a fixed constellation).
const SPARKS = [
  { dx: 9, dy: -8, dur: 0.8, delay: 0 },
  { dx: 15, dy: 4, dur: 1.1, delay: 0.3 },
  { dx: 12, dy: -3, dur: 0.9, delay: 0.55 },
  { dx: 18, dy: 8, dur: 1.3, delay: 0.15 },
];

// ── the burning tip ─────────────────────────────────────────────────────────
// The mech keys off the seat's STABLE CODE-ID (Phase 4 / R12 — seat.archId;
// display-label fallback for older callers). Unresolved → archetypeToDisposition
// returns 'neutral' → the generic mech renders. A tip never crashes on an
// unknown archetype.
function FhTip({ x, tipY, headY, color, seat, lead, you, value, subValue, dead, compact, reduce, onTap, showHead }) {
  const hs = compact ? (you ? 30 : 25) : (you ? 44 : 36);
  const displaced = Math.abs(headY - tipY) > 4;
  const neg = typeof value === 'string' && value.startsWith('-');
  const valueColor = neg ? LX.neg : color; // crown only — never leader-gold text
  return (
    <div data-fh-tip={seat.id} style={{ position: 'absolute', left: x, top: 0 }}>
      {!dead && (
        <React.Fragment>
          <span style={{ position: 'absolute', left: -17, top: tipY - 17, width: 34, height: 34, borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(color, 0.55)}, transparent 68%)`, filter: 'blur(3px)', pointerEvents: 'none',
            animation: reduce ? 'none' : 'fhHeat 1.5s ease-in-out infinite' }} />
          <span style={{ position: 'absolute', left: -4, top: tipY - 4, width: 8, height: 8, borderRadius: '50%',
            background: '#FFF6E0', boxShadow: `0 0 9px 2px ${color}, 0 0 20px 5px ${alpha(color, 0.6)}`, pointerEvents: 'none',
            animation: reduce ? 'none' : 'fhEmber 0.9s ease-in-out infinite' }} />
          {!reduce && SPARKS.map((sp, i) => (
            <span key={i} style={{ position: 'absolute', left: 0, top: tipY, width: 2.5, height: 2.5, borderRadius: '50%',
              background: i % 2 ? '#FFD9A0' : color, pointerEvents: 'none', '--fh-dx': `${sp.dx}px`, '--fh-dy': `${sp.dy}px`,
              animation: `fhSpark ${sp.dur}s ease-out ${sp.delay}s infinite` }} />
          ))}
        </React.Fragment>
      )}
      {dead && <span style={{ position: 'absolute', left: -3.5, top: tipY - 3.5, width: 7, height: 7, borderRadius: '50%', background: color, pointerEvents: 'none' }} />}
      {displaced && <span style={{ position: 'absolute', left: 0, top: Math.min(tipY, headY), width: 12, height: Math.abs(headY - tipY),
        borderLeft: `1px solid ${alpha(color, 0.45)}`, borderTop: `1px solid ${alpha(color, 0.45)}`, pointerEvents: 'none' }} />}
      <div className={onTap ? 'bv2-tap' : ''} onClick={onTap || undefined}
        style={{ position: 'absolute', left: 12, top: headY - hs / 2, display: 'flex', alignItems: 'center', gap: compact ? 5 : 7,
          whiteSpace: 'nowrap', cursor: onTap ? 'pointer' : 'default' }}>
        <div style={{ position: 'relative', width: hs, height: hs, filter: `drop-shadow(0 0 8px ${alpha(color, 0.6)})` }}>
          {showHead ? (
            <div style={{ position: 'absolute', left: '50%', top: '50%',
              transform: `translate(-50%, calc(-50% - ${(HEAD_FACE_LIFT * hs).toFixed(1)}px))`,
              width: hs * 140 / 156, height: hs }}>
              <AgentPresence
                disposition={archetypeToDisposition(seat.archId ?? seat.arch)}
                accent={color}
                standing={0}
                size={hs}
                enableEnvironment={false}
                radial={false}
                reactivityLevel="static"
              />
            </div>
          ) : (
            <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
              width: hs * 0.5, height: hs * 0.5, borderRadius: '50%',
              background: `radial-gradient(circle at 35% 30%, ${alpha(color, 0.95)}, ${alpha(color, 0.55)})`,
              border: `2px solid ${alpha(color, you ? 1 : 0.7)}` }} />
          )}
          {lead && (
            <span data-fh-crown style={{ position: 'absolute', top: -(compact ? 9 : 12), left: '50%', transform: 'translateX(-50%)' }}>
              <LIcon name="crown" size={compact ? 11 : 14} color={LTOKENS.gold} stroke={2.2} />
            </span>
          )}
        </div>
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          <Mono style={{ fontSize: compact ? (you ? 12.5 : 11) : (you ? 17 : 14), fontWeight: 700, lineHeight: 1.05,
            color: valueColor, textShadow: `0 0 12px ${alpha(valueColor, 0.55)}` }}>{value}</Mono>
          {/* E2.2 — the crowned seat shows the TOTAL that earned its crown, so
              the crown's basis is visible rather than merely implied. Today
              scope only: in The Week the value already IS the total.
              PROVISIONAL (E2.2): if this crowds the bunched case at re-review,
              delete this one block and E2.1's microcopy stands alone. */}
          {subValue != null && (
            <span data-fh-subvalue>
              <Mono style={{ fontSize: compact ? 7 : 8.5, fontWeight: 600, letterSpacing: '0.04em',
                color: alpha(color, 0.7), marginTop: 1 }}>{subValue}</Mono>
            </span>
          )}
          {you && <Mono style={{ fontSize: compact ? 6.5 : 7.5, fontWeight: 700, letterSpacing: '0.1em', color, marginTop: 1 }}>YOU</Mono>}
        </span>
      </div>
    </div>
  );
}

// ── the scope toggle ────────────────────────────────────────────────────────
function FhScopeToggle({ scope, onScope, compact }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, padding: 3, borderRadius: 999, background: alpha('#0B0C10', 0.9),
      border: `1px solid ${LTOKENS.hair2}` }}>
      {[['day', 'Today'], ['week', 'The week']].map(([id, label]) => (
        <button key={id} type="button" className="bv2-tap" onClick={() => onScope(id)} style={{ all: 'unset', cursor: 'pointer',
          padding: compact ? '3px 8px' : '4px 11px', borderRadius: 999,
          background: scope === id ? alpha(LTOKENS.teal, 0.18) : 'transparent',
          border: `1px solid ${scope === id ? alpha(LTOKENS.teal, 0.5) : 'transparent'}` }}>
          <Mono style={{ fontSize: compact ? 8.5 : 9.5, fontWeight: 700, letterSpacing: '0.06em',
            color: scope === id ? LTOKENS.teal : LTOKENS.ink3 }}>{label}</Mono>
        </button>
      ))}
    </span>
  );
}

const fmt = (v, signed) => `${signed && v > 0 ? '+' : ''}${v.toFixed(1)}`;

// ════════════════════════ THE HERO ══════════════════════════════════════════
export function FuseHero({
  state, mode, seats = [], climb = {}, youId = null, dayIdx = 0,
  w, h, surge = null, onPlayer = null, compact = false, voided = false,
  trail = null, scope: scopeProp = null, onScope: onScopeProp = null, initialScope = null,
  nowFn = Date.now,
}) {
  const live = state === 'live';
  const done = state === 'complete';
  const calm = state === 'awaiting';
  const ranked = mode === 'ranked';
  const reduce = prefersReducedMotion();
  const showHead = isAgentPresenceOn();

  // Scope: controlled when the host passes scope/onScope; else self-managed.
  // Defaults to Today while live, The Week at the close (spec) — a user's
  // explicit pick sticks for the session.
  // `scope` is a hard control (host-driven); `initialScope` only SEEDS the
  // self-managed pick, so a reviewer's toggle still works after it (D2).
  const [scopePick, setScopePick] = React.useState(null);
  const scope = scopeProp ?? scopePick ?? initialScope ?? (done ? 'week' : 'day');
  const onScope = onScopeProp ?? setScopePick;
  const DAY = scope === 'day';

  const ids = seats.map((s) => s.id);
  const banked = {};
  for (const id of ids) banked[id] = climb[id]?.[dayIdx] ?? 0;

  // ── B2: the ONE snapshot everything derives from ──
  const snap = latestTrailSnapshot(trail, ids, banked);
  const { leaderId, cutTotal, needToday } = deriveCut(snap, ids, youId);
  const seed = {};
  for (const id of ids) {
    seed[id] = Number.isFinite(trail?.seeds?.[id]) ? trail.seeds[id] : banked[id];
  }

  // ── the frame + clock ──
  const F = fuseFrame({ w, h, compact });
  const X = (f) => F.padL + Math.max(0, Math.min(1, f)) * (F.plotR - F.padL);
  const dayFrac = snap.t != null ? sessionFraction(snap.t) : (live ? sessionFraction(nowFn()) : done ? 1 : 0);
  const bankedCount = Math.max(...ids.map((id) => (climb[id] || []).length), 0);

  // ── per-seat series + display values ──
  const seatData = seats.map((s) => {
    const dispVal = calm ? 0 : (DAY ? snap.values[s.id] - seed[s.id] : snap.values[s.id]);
    let pts;
    let spine = false;
    if (calm) {
      pts = [{ f: 0, v: 0 }];
    } else if (DAY) {
      pts = seatDaySeries({ samples: trail?.samples?.[s.id], seed: seed[s.id] });
      if (pts.length === 0) {
        // The designed reload state (R3): the last close as a FLAT SPINE to the
        // clock's now, plus the live tip. Never a fabricated curve, never empty.
        pts = [{ f: 0, v: 0 }, { f: Math.max(dayFrac, 0.02), v: 0 }];
        spine = true;
      }
    } else {
      pts = seatWeekSeries({
        closes: climb[s.id],
        tipValue: snap.values[s.id],
        tipF: weekTipF(bankedCount, dayFrac),
        live: live && !voided,
      });
    }
    return { seat: s, pts, dispVal, spine, neg: dispVal < 0 };
  });

  // ── the scale, over EVERY drawn value (tips and path points) ──
  const allVals = seatData.flatMap((d) => d.pts.map((p) => p.v)).concat(seatData.map((d) => d.dispVal));
  const { HI, LO, basement, zeroY, Y } = makeScale({ values: allVals, day: DAY, plotT: F.plotT, floorY: F.floorY });

  // ── the cut (ranked only; never in training, never when voided/calm) ──
  const targetVal = DAY ? needToday : cutTotal;
  const showTarget = ranked && !calm && !voided && (DAY ? (needToday > 0 && needToday <= HI) : true);
  const targetY = Y(Math.min(targetVal, HI));

  // ── tips: x at the clock's newest sample; head anchors spread apart ──
  const tipF = calm ? 0 : DAY ? Math.max(dayFrac, 0.02) : weekTipF(bankedCount, done ? 1 : dayFrac);
  const burnX = X(done && !DAY ? (seatData[0]?.pts?.[seatData[0].pts.length - 1]?.f ?? 1) : tipF);
  const tipYOf = (d) => Y(d.pts[d.pts.length - 1]?.v ?? 0);
  const headY = spreadLabels(
    seatData.map((d) => ({ id: d.seat.id, y: tipYOf(d) })),
    F.headGap, F.plotT + (compact ? 14 : 20), F.floorY - 4,
  );

  // ── the header microcopy + its E4 yield (both need burnX) ──
  const headerText = calm ? 'At the start line' : DAY ? 'Today · since the open' : 'The week · running total';
  const headerYield = !calm && !compact && headerYieldsToNow({
    burnX, headerText, headerLeft: compact ? 10 : 16, headerSize: compact ? 8 : 9.5,
  });

  // ── y labels: priority top → cut → zero/open → floor, greedily thinned ──
  const yLabels = calm ? [] : thinYLabels([
    { v: HI, t: fmt(HI, DAY), y: Y(HI) },
    ...(showTarget ? [{ v: targetVal, t: 'CUT', y: targetY }] : []),
    { v: 0, t: DAY ? 'OPEN' : '0', y: Y(0) },
    ...(LO < 0 ? [{ v: LO, t: fmt(LO), y: Y(LO) }] : []),
  ], F.yLabelGap);

  const xLabels = DAY ? DAY_XLABELS : WEEK_XLABELS;
  const ordered = [...seatData].sort((a, b) => (a.seat.id === leaderId ? 1 : 0) - (b.seat.id === leaderId ? 1 : 0)); // leader drawn last (on top)

  return (
    <div data-testid="fuse-hero" style={{ position: 'relative', width: w, height: h, overflow: 'hidden', borderRadius: 18,
      background: LTOKENS.bg, border: `1px solid ${LTOKENS.hair}` }}>
      <ArenaAtmosphere tone={ranked ? LTOKENS.gold : LTOKENS.teal} />

      {/* head row: microcopy + the scope toggle */}
      <div style={{ position: 'absolute', top: compact ? 8 : 12, left: compact ? 10 : 16, right: compact ? 10 : 16,
        display: 'flex', alignItems: 'center', gap: 8, zIndex: 6 }}>
        {/* E2.1 — the header NAMES the quantity. In Today the tip values are
            changes since the open while the crown reads standing, and nothing
            previously said so; that mismatch is what made a crowned +0.3 beside
            an uncrowned +0.4 look like a bug (D4).
            E4 — it YIELDS to the NOW pill (a clean disappearance, never a
            truncation) and returns the moment the pill clears. */}
        {!headerYield && (
          <span data-fh-header>
            <Mono style={{ fontSize: compact ? 8 : 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: LTOKENS.ink3 }}>
              {headerText}
            </Mono>
          </span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          {!calm && <FhScopeToggle scope={scope} onScope={onScope} compact={compact} />}
        </span>
      </div>

      <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id="fhGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        {/* time columns at the label positions — recessive grid */}
        {xLabels.map((l) => {
          const x = X(l.f);
          const past = !calm && l.f <= tipF;
          return <line key={l.t} x1={x} y1={F.plotT - 6} x2={x} y2={F.plotB} stroke={past ? LTOKENS.hair2 : LTOKENS.hair} strokeWidth={1} strokeDasharray={past ? '0' : '2 6'} />;
        })}
        {/* the open / zero level + the basement band */}
        <line x1={F.padL} y1={zeroY} x2={w - F.padR} y2={zeroY} stroke={alpha('#FFFFFF', 0.22)} strokeWidth={1} />
        {basement > 0 && <rect x={F.padL} y={zeroY} width={w - F.padL - F.padR} height={F.floorY - zeroY} fill={alpha(LX.neg, 0.05)} />}
        {/* the cut — dashed gold, tinted make-it band above */}
        {showTarget && (
          <g data-fh-cut>
            <line x1={F.padL} y1={targetY} x2={w - F.padR} y2={targetY} stroke={alpha(LX.cut, 0.5)} strokeWidth={1.2} strokeDasharray="8 5" />
            <rect x={F.padL} y={F.plotT} width={w - F.padL - F.padR} height={Math.max(0, targetY - F.plotT)} fill={alpha(LX.cut, 0.04)} />
          </g>
        )}
        {/* compact NOW: a text-free cursor line (the pill is desktop-only) */}
        {!calm && compact && <line x1={burnX} y1={F.plotT - 6} x2={burnX} y2={F.plotB} stroke={alpha(LX.cut, 0.5)} strokeWidth={1} />}
        {/* the fuses */}
        {ordered.map((d) => {
          const s = d.seat;
          const you = s.you;
          const c = d.neg ? LX.neg : s.color;
          const pts = d.pts.map((p) => ({ x: X(p.f), y: Y(p.v) }));
          const path = catmullPath(pts);
          const tipY = pts[pts.length - 1]?.y ?? Y(0);
          return (
            <g key={s.id} data-fh-fuse={s.id}>
              {pts.length > 1 && <path d={path} fill="none" stroke={c} strokeWidth={you ? 8 : 6} strokeOpacity={0.28} strokeLinecap="round" filter="url(#fhGlow)" />}
              {pts.length > 1 && <path d={path} fill="none" stroke={c} strokeWidth={you ? 2.8 : 2} strokeOpacity={d.spine ? 0.6 : you ? 1 : 0.84} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={d.spine ? '2 5' : undefined} />}
              {/* the still-burning futures dashes — motion, so dropped entirely under reduce */}
              {live && !reduce && (
                <line x1={burnX} y1={tipY} x2={w - F.padR} y2={tipY} stroke={c} strokeWidth={you ? 1.8 : 1.4} strokeOpacity={0.2}
                  strokeDasharray="3 7" style={{ animation: `fhCreep ${you ? 1.4 : 2}s linear infinite` }} />
              )}
            </g>
          );
        })}
      </svg>

      {/* y labels — left gutter, thinned */}
      {yLabels.map((g, i) => (
        <div key={i} style={{ position: 'absolute', left: 5, top: g.y - 6, width: F.padL - 11, textAlign: 'right' }}>
          <Mono style={{ fontSize: /CUT|OPEN/.test(g.t) ? (compact ? 7 : 8) : (compact ? 8 : 9.5), fontWeight: 700,
            letterSpacing: /CUT|OPEN/.test(g.t) ? '0.1em' : 0,
            color: g.t === 'CUT' ? LX.cut : g.v < 0 ? LX.neg : LTOKENS.ink3 }}>{g.t}</Mono>
        </div>
      ))}
      {DAY && showTarget && !compact && (
        <div style={{ position: 'absolute', left: F.padL + 8, top: targetY - 15 }}>
          <Mono style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', color: LX.cut }}>+{fmt(needToday)} TODAY MAKES THE CUT</Mono>
        </div>
      )}
      {basement > 0 && !calm && !compact && (
        <div style={{ position: 'absolute', left: F.padL + 8, top: zeroY + 5 }}>
          <Mono style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: '0.12em', color: alpha(LX.neg, 0.9) }}>BASEMENT · COMPRESSED</Mono>
        </div>
      )}

      {/* x labels */}
      {xLabels.map((l) => (
        <div key={l.t} style={{ position: 'absolute', left: X(l.f), top: F.plotB + (compact ? 5 : 9), transform: 'translateX(-50%)' }}>
          <Mono style={{ fontSize: compact ? 8 : 9.5, fontWeight: 700, letterSpacing: '0.06em',
            color: !calm && l.f <= tipF ? LTOKENS.ink2 : LTOKENS.ink3, opacity: !calm && l.f <= tipF ? 1 : 0.5 }}>{l.t}</Mono>
        </div>
      ))}
      {/* NOW — desktop pill; compact uses the cursor line + ember instead */}
      {!calm && !compact && (
        <div style={{ position: 'absolute', left: burnX, top: F.plotT - 22, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
          <span style={{ display: 'inline-flex', padding: '2px 7px', borderRadius: 999, background: alpha('#0B0C10', 0.9), border: `1px solid ${alpha(LX.cut, 0.45)}` }}>
            <Mono style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color: LX.cut }}>NOW</Mono>
          </span>
        </div>
      )}

      {/* the tips */}
      {seatData.map((d) => (
        <FhTip key={d.seat.id}
          x={burnX}
          tipY={tipYOf(d)}
          headY={headY[d.seat.id] ?? tipYOf(d)}
          color={d.neg ? LX.neg : d.seat.color}
          seat={d.seat}
          lead={d.seat.id === leaderId && !calm && !voided}
          you={!!d.seat.you}
          value={calm ? '—' : fmt(d.dispVal, DAY)}
          subValue={!calm && DAY && d.seat.id === leaderId && !voided ? `${fmt(snap.values[d.seat.id])} total` : null}
          dead={calm || done}
          compact={compact}
          reduce={reduce}
          showHead={showHead}
          onTap={onPlayer && !d.seat.you && !calm ? () => onPlayer(d.seat.id) : null}
        />
      ))}

      {/* R11's pulse-and-badge, driven by REAL beats: a star popping in the dock
          flies its points up here (never a timer — the surge comes from the
          shipped beat engine). */}
      {live && surge?.key != null && !reduce && !voided && (
        <div key={`fly${surge.key}`} style={{ position: 'absolute', left: burnX, top: F.plotB - 8, transform: 'translateX(-50%)',
          pointerEvents: 'none', animation: 'fhFly 1.5s ease-out forwards', zIndex: 7 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999,
            background: alpha(LTOKENS.teal, 0.95), boxShadow: `0 0 16px ${alpha(LTOKENS.teal, 0.8)}` }}>
            <LIcon name="bolt" size={11} color="#0A0B0E" stroke={2.4} />
            <Mono style={{ fontSize: 13, fontWeight: 800, color: '#0A0B0E' }}>{surge.pts}</Mono>
          </span>
        </div>
      )}

      {calm && (
        <div style={{ position: 'absolute', left: '52%', right: compact ? 10 : 16, top: F.plotB - (compact ? 16 : 20), textAlign: 'right' }}>
          <Mono style={{ fontSize: compact ? 9 : 11, letterSpacing: '0.16em', color: LTOKENS.ink3, textTransform: 'uppercase' }}>
            The fuses light at the bell
          </Mono>
        </div>
      )}
    </div>
  );
}

export default FuseHero;
