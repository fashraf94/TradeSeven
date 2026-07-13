// src/components/Forge/workshop/character/CharacterKit.jsx
//
// Release 3 (Character tab) — the "loadout" atoms that replace the retired trait
// mechanism: a derived behavior fingerprint, the standing-leans menu/slots, the
// tempo dial, the read-only Born-with kit, the state notice, and the battle
// snapshot. Ported from the Claude Design mockup (forge-character-kit.jsx) onto
// the app's forgeKit primitives (useFK / Icon / Mono / alpha) and wired to the
// REAL data layer — never the design's invented fixtures:
//   • fingerprint  → computeFingerprint (derived from resolved config; the dial
//                    moves Tempo/Reach/Patience, Concentration/Discipline are
//                    fixed archetype anchors — captioned, per founder Q3).
//   • lean text    → canonical directive VERBATIM (Display-Agreement §9); the
//                    "what this changes" read is DERIVED from policy.
//   • conflicts    → the SAME ADJUSTMENT_CONFLICT_GROUPS the server rejects on.

import React from 'react';
import { useFK, alpha, Icon, Mono } from '../forgeKit.jsx';
import {
  computeFingerprint,
  FINGERPRINT_AXES,
  FIXED_ANCHOR_AXES,
} from '../../../../../api/_utils/behaviorFingerprint.js';
import { STANDING_LEANS_CAP } from '../../../../../api/_utils/leanRevalidation.js';
import {
  deriveLeanGloss,
  deriveLeanNote,
  conflictDimension,
  TEMPO_POSITIONS,
  tempoLabel,
  tempoMeaning,
} from '../../../../data/characterLeanPresentation.js';

export const CH_ACCENT_TOKEN = 'allocation'; // the Character bench accent (purple)

// A few glyphs the base Icon set doesn't carry — everything else delegates.
const EXTRA_ICONS = {
  sliders: (p) => (<g {...p}><path d="M4 8h10M18 8h2M4 16h2M10 16h10" /><circle cx="16" cy="8" r="2.2" /><circle cx="8" cy="16" r="2.2" /></g>),
  refresh: (p) => (<g {...p}><path d="M20 11a8 8 0 10-2.3 5.7M20 20v-5h-5" /></g>),
  pulse: (p) => (<path {...p} d="M3 12h4l2-6 4 12 2-6h6" />),
  clock: (p) => (<g {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></g>),
};
function CIcon({ name, size = 18, color = 'currentColor', stroke = 1.7, style }) {
  const extra = EXTRA_ICONS[name];
  if (!extra) return <Icon name={name} size={size} color={color} stroke={stroke} style={style} />;
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0, ...style }}>{extra(p)}</svg>;
}

// ── smooth tween for the fingerprint vector (dial → shape moves in real time) ──
function useTweenVec(target, ms = 340) {
  const [disp, setDisp] = React.useState(target);
  const fromRef = React.useRef(target);
  const rafRef = React.useRef(0);
  const sig = JSON.stringify(target);
  React.useEffect(() => {
    const from = fromRef.current;
    const keys = Object.keys(target);
    const start = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    cancelAnimationFrame(rafRef.current);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      const cur = {};
      keys.forEach((k) => { cur[k] = from[k] + (target[k] - from[k]) * e; });
      setDisp(cur);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  return disp;
}

const fpAngle = (i) => (-90 + i * (360 / FINGERPRINT_AXES.length)) * Math.PI / 180;
const fpPoints = (vec, cx, cy, R) => FINGERPRINT_AXES.map((a, i) => {
  const ang = fpAngle(i), r = R * (vec[a.key] ?? 0.4);
  return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
});
const ptsStr = (pts) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

// ── The behavior fingerprint — disposition radar, never a forecast ──────────
// `tempo` = desired dial position; `liveTempo` = the effective (clamp-resolved)
// position. When they differ, the live shape is drawn as a dashed ghost.
export function Fingerprint({ archId, archName, tempo, liveTempo, equippedLeans = [], accent, compact, readonly, barFallback }) {
  const T = useFK();
  const c = accent || T[CH_ACCENT_TOKEN];
  const target = computeFingerprint(archId, tempo).axes;
  const live = computeFingerprint(archId, liveTempo || tempo).axes;
  const disp = useTweenVec(target);
  const pending = !readonly && liveTempo && tempo !== liveTempo;

  const S = compact ? 244 : 300, cx = S / 2, cy = compact ? 120 : 138, R = compact ? 78 : 96;
  const rings = [0.34, 0.67, 1];
  const solid = fpPoints(disp, cx, cy, R);
  const ghost = fpPoints(live, cx, cy, R);
  const fixed = new Set(FIXED_ANCHOR_AXES);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <Mono style={{ fontSize: compact ? 10 : 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.ink2, fontWeight: 600 }}>Disposition</Mono>
        <div style={{ flex: 1, height: 1, background: T.hair }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fw-mono)', fontSize: compact ? 8 : 8.5, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: T.ink3, border: `1px solid ${T.hair2}`, borderRadius: 6, padding: '3px 7px' }}>
          <CIcon name="pulse" size={compact ? 9 : 10} color={T.ink3} />Directional · uncalibrated</span>
      </div>

      {/* Mobile bar readout (radar degrades to labeled bars, never dropped) */}
      {barFallback ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FINGERPRINT_AXES.map((a) => {
            const v = disp[a.key] ?? 0.4;
            const lv = live[a.key] ?? v;
            const isFixed = fixed.has(a.key);
            return (
              <div key={a.key}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fw-mono)', fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: isFixed ? T.ink3 : T.ink2, fontWeight: 600 }}>
                    {isFixed && <CIcon name="lock" size={9} color={T.ink3} stroke={2.2} />}{a.label}
                  </span>
                  <Mono style={{ fontSize: 9, color: T.ink3 }}>{Math.round(v * 100)}</Mono>
                </div>
                <div style={{ position: 'relative', height: 6, borderRadius: 99, background: T.bg, border: `1px solid ${T.hair}`, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${v * 100}%`, background: isFixed ? alpha(T.ink2, 0.5) : c, transition: 'width .3s ease' }} />
                  {pending && Math.abs(lv - v) > 0.01 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${lv * 100}%`, width: 2, background: T.ink3 }} />}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: compact ? 4 : 16, alignItems: 'center', flexWrap: compact ? 'wrap' : 'nowrap' }}>
          {/* radar */}
          <div style={{ flexShrink: 0, position: 'relative', width: compact ? '100%' : S, display: 'flex', justifyContent: 'center' }}>
            <svg width={S} height={compact ? 232 : 268} viewBox={`0 0 ${S} ${compact ? 232 : 268}`} style={{ display: 'block', overflow: 'visible' }}>
              {rings.map((rr, i) => (
                <polygon key={i} points={ptsStr(FINGERPRINT_AXES.map((a, j) => { const ang = fpAngle(j); return [cx + R * rr * Math.cos(ang), cy + R * rr * Math.sin(ang)]; }))}
                  fill="none" stroke={T.hair} strokeWidth="1" />
              ))}
              {FINGERPRINT_AXES.map((a, i) => {
                const ang = fpAngle(i);
                const ex = cx + R * Math.cos(ang), ey = cy + R * Math.sin(ang);
                const lx = cx + (R + (compact ? 16 : 22)) * Math.cos(ang), ly = cy + (R + (compact ? 16 : 22)) * Math.sin(ang);
                const anchor = Math.abs(Math.cos(ang)) < 0.35 ? 'middle' : (Math.cos(ang) > 0 ? 'start' : 'end');
                const isFixed = fixed.has(a.key);
                // spoke: fixed anchors dashed + muted so the "dial doesn't move these" reads visually
                return (
                  <g key={a.key}>
                    <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={T.hair} strokeWidth="1" strokeDasharray={isFixed ? '2 3' : undefined} />
                    <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle"
                      style={{ fontFamily: 'var(--fw-mono)', fontSize: compact ? 8.5 : 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', fill: isFixed ? T.ink3 : T.ink2, fontWeight: 600 }}>{a.label}</text>
                  </g>
                );
              })}
              {pending && (
                <polygon points={ptsStr(ghost)} fill="none" stroke={T.ink3} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.9" />
              )}
              <polygon points={ptsStr(solid)} fill={alpha(c, 0.18)} stroke={c} strokeWidth="2"
                style={{ filter: `drop-shadow(0 2px 10px ${alpha(c, 0.4)})` }} />
              {solid.map((p, i) => {
                const isFixed = fixed.has(FINGERPRINT_AXES[i].key);
                return <circle key={i} cx={p[0]} cy={p[1]} r={compact ? 2.4 : 3} fill={isFixed ? T.ink2 : c} stroke={T.bg} strokeWidth="1.2" />;
              })}
            </svg>
          </div>

          {/* readout column */}
          <div style={{ flex: 1, minWidth: compact ? '100%' : 150 }}>
            <FingerprintReadout T={T} c={c} archName={archName} tempo={tempo} liveTempo={liveTempo} pending={pending} readonly={readonly} equippedLeans={equippedLeans} />
          </div>
        </div>
      )}

      {/* Q3 teaching caption — the two fixed axes are archetype anchors */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: barFallback ? 12 : 10, paddingTop: 10, borderTop: `1px solid ${T.hair}` }}>
        <CIcon name="lock" size={11} color={T.ink3} stroke={2} />
        <div style={{ fontSize: compact ? 10.5 : 11.5, color: T.ink3, lineHeight: 1.4 }}>
          <b style={{ color: T.ink2 }}>Concentration &amp; Discipline</b> are set by your archetype — the dial doesn't move these. Tempo, Reach and Patience respond to it.
        </div>
      </div>
    </div>
  );
}

function FingerprintReadout({ T, c, archName, tempo, liveTempo, pending, readonly, equippedLeans }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: alpha(c, 0.12), border: `1px solid ${alpha(c, 0.3)}` }}>
          <CIcon name="sliders" size={11} color={c} />
          <Mono style={{ fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink, fontWeight: 700 }}>Tempo · {tempoLabel(tempo)}</Mono>
        </span>
        {pending && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, background: alpha(T.gold, 0.1), border: `1px solid ${alpha(T.gold, 0.3)}` }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.gold }} />
          <Mono style={{ fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.gold, fontWeight: 600 }}>Pending</Mono></span>}
      </div>

      {pending ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="22" height="8"><line x1="1" y1="4" x2="21" y2="4" stroke={T.ink3} strokeWidth="1.5" strokeDasharray="4 4" /></svg>
            <Mono style={{ fontSize: 9.5, color: T.ink3 }}>Live now · {tempoLabel(liveTempo)}</Mono>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 20, height: 8, borderRadius: 2, background: alpha(c, 0.25), border: `1.5px solid ${c}` }} />
            <Mono style={{ fontSize: 9.5, color: T.ink2 }}>After this change</Mono>
          </div>
        </div>
      ) : readonly ? (
        <div style={{ fontSize: 12, color: T.ink2, lineHeight: 1.5, marginBottom: 11 }}>
          How a <b style={{ color: T.ink }}>{archName}</b> is disposed at Standard tempo — its natural shape.
        </div>
      ) : (
        <div style={{ fontSize: 12, color: T.ink2, lineHeight: 1.5, marginBottom: 11 }}>
          {archName}'s shape at <b style={{ color: T.ink }}>{tempoLabel(tempo)}</b> tempo. Move the dial to reshape it.
        </div>
      )}

      {!readonly && (
        <div style={{ paddingTop: 10, borderTop: `1px solid ${T.hair}` }}>
          <Mono style={{ fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink3, display: 'block', marginBottom: 8 }}>Leans annotate the read — they don't reshape it</Mono>
          {equippedLeans.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {equippedLeans.map((l) => (
                <div key={l.adjustmentId} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 4, background: c, boxShadow: `0 0 0 3px ${alpha(c, 0.15)}` }} />
                  <div style={{ minWidth: 0, fontSize: 11.5 }}>
                    <span style={{ fontWeight: 700, color: T.ink }}>{l.adjustmentId}</span>
                    <span style={{ color: T.ink3 }}> — {deriveLeanNote(l.policy)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: T.ink3, lineHeight: 1.45 }}>No leans equipped. Equip one and it appears here as a note on the shape — never as a new spike.</div>
          )}
        </div>
      )}
    </>
  );
}

// ── Tempo dial — 3 segments ──────────────────────────────────────────────────
export function TempoControl({ archId, archName, value, onChange, locked, compact }) {
  const T = useFK();
  const c = T[CH_ACCENT_TOKEN];
  const meaning = tempoMeaning(archId);
  return (
    <div>
      <div style={{ display: 'inline-flex', gap: 3, padding: 3, borderRadius: 11, background: alpha('#000', 0.3), border: `1px solid ${T.hair}`, opacity: locked ? 0.55 : 1, width: '100%' }}>
        {TEMPO_POSITIONS.map((tp) => {
          const on = tp.id === value;
          return (
            <button key={tp.id} className="fw-tap" disabled={locked} onClick={() => !locked && onChange && onChange(tp.id)} style={{ all: 'unset', cursor: locked ? 'default' : 'pointer',
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: compact ? '8px 4px' : '10px 6px', borderRadius: 8,
              background: on ? alpha(c, 0.18) : 'transparent', border: `1px solid ${on ? alpha(c, 0.5) : 'transparent'}` }}>
              <span style={{ display: 'flex', gap: 3 }}>
                {[0, 1, 2].map((i) => <span key={i} style={{ width: compact ? 5 : 5.5, height: compact ? 5 : 5.5, borderRadius: '50%',
                  background: i < tp.dots ? (on ? c : T.ink3) : alpha(T.ink2, 0.22) }} />)}
              </span>
              <Mono style={{ fontSize: compact ? 10 : 11, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: on ? 700 : 500, color: on ? T.ink : T.ink3 }}>{tp.label}</Mono>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 9, marginTop: 12, padding: compact ? '11px 12px' : '12px 14px', borderRadius: 12, background: alpha(c, 0.05), border: `1px solid ${alpha(c, 0.18)}` }}>
        <CIcon name="compass" size={compact ? 15 : 16} color={c} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: compact ? 11.5 : 12.5, color: T.ink2, lineHeight: 1.5 }}>{meaning}</div>
          <div style={{ fontSize: compact ? 10.5 : 11, color: T.ink3, marginTop: 6, lineHeight: 1.45 }}>
            The dial tunes how <b style={{ color: T.ink2 }}>{archName}</b> expresses itself — it never turns it into something else.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Born-with kit — the agent's ACTUAL equipped traits, read-only (founder Q4) ──
// Shows every equipped trait (incl. non-default strengths) so nothing is
// invisible-but-active; marks which are the archetype's born-with signature.
const STRENGTH_LABEL = { subtle: 'Subtle', moderate: 'Moderate', dominant: 'Dominant' };
const STRENGTH_DOTS = { subtle: 1, moderate: 2, dominant: 3 };
export function BornWithKit({ archName, equippedTraits = [], signatureIds = [], compact }) {
  const T = useFK();
  const sig = new Set(signatureIds);
  return (
    <div>
      <div style={{ fontSize: compact ? 11.5 : 12.5, color: T.ink3, lineHeight: 1.5, marginBottom: 12 }}>
        What <b style={{ color: T.ink2 }}>{archName}</b> comes with. Part of who it is — not something you tune here.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {equippedTraits.length ? equippedTraits.map((tr) => {
          const id = tr.traitId || tr.id;
          const born = sig.has(id);
          const strength = tr.strength || 'moderate';
          return (
            <div key={id} style={{ position: 'relative', overflow: 'hidden', padding: compact ? '11px 13px' : '12px 14px', borderRadius: 12,
              background: alpha('#000', 0.18), border: `1px solid ${T.hair}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: T.ink2 }}>{tr.name || id}</div>
                {born && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--fw-mono)', fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, color: T.gold, background: alpha(T.gold, 0.1), border: `1px solid ${alpha(T.gold, 0.3)}`, padding: '2px 6px', borderRadius: 999 }}>
                  <CIcon name="star" size={8} color={T.gold} />Born with</span>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 'auto', fontFamily: 'var(--fw-mono)', fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>
                  <span style={{ display: 'flex', gap: 2 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: i < (STRENGTH_DOTS[strength] || 2) ? T.ink2 : alpha(T.ink2, 0.25) }} />)}</span>
                  {STRENGTH_LABEL[strength] || strength}
                </span>
              </div>
              {tr.identityStatement && <div style={{ fontSize: compact ? 11.5 : 12, color: T.ink3, marginTop: 4, lineHeight: 1.45 }}>{tr.identityStatement}</div>}
            </div>
          );
        }) : (
          <div style={{ fontSize: 12, color: T.ink3, lineHeight: 1.5 }}>This agent's kit is its archetype defaults — nothing extra equipped.</div>
        )}
      </div>
    </div>
  );
}

// ── Standing-leans equipped slots ────────────────────────────────────────────
export function LeanSlots({ equipped = [], locked, onRemove, onFocusMenu, compact }) {
  const T = useFK();
  const c = T[CH_ACCENT_TOKEN];
  const cells = [];
  for (let i = 0; i < STANDING_LEANS_CAP; i++) cells.push(equipped[i] || null);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {cells.map((l, i) => l ? (
        <div key={l.adjustmentId} style={{ position: 'relative', overflow: 'hidden', minHeight: compact ? 96 : 104, padding: compact ? '12px 13px' : '13px 14px', borderRadius: 14,
          background: T.surface, border: `1px solid ${alpha(c, 0.4)}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <Mono style={{ fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: c, display: 'block' }}>Slot {i + 1} · {l.adjustmentId}</Mono>
            </div>
            {!locked && <button className="fw-tap" onClick={() => onRemove(l.adjustmentId)} title="Remove lean" style={{ all: 'unset', cursor: 'pointer', width: 22, height: 22, flexShrink: 0,
              borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(T.ink2, 0.1), border: `1px solid ${T.hair}` }}>
              <CIcon name="x" size={12} color={T.ink3} stroke={2.2} /></button>}
          </div>
          <div style={{ fontSize: compact ? 11 : 12, color: T.ink, lineHeight: 1.4, fontWeight: 500,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.text}</div>
        </div>
      ) : (
        <button key={`empty-${i}`} className="fw-tap" onClick={locked ? undefined : onFocusMenu} style={{ all: 'unset', boxSizing: 'border-box', cursor: locked ? 'default' : 'pointer',
          minHeight: compact ? 96 : 104, padding: compact ? '12px 13px' : '13px 14px', borderRadius: 14, border: `1.4px dashed ${T.hair2}`,
          background: alpha('#fff', 0.012), display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 8, opacity: locked ? 0.45 : 1 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${T.hair2}` }}>
            <CIcon name="plus" size={15} color={T.ink2} /></div>
          <div>
            <div style={{ fontSize: compact ? 12.5 : 13.5, color: T.ink2, fontWeight: 600 }}>Add a standing lean</div>
            <Mono style={{ fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink3, display: 'block', marginTop: 3 }}>Slot {i + 1} · from the menu below</Mono>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── One menu entry ────────────────────────────────────────────────────────────
// state: 'available' | 'equipped' | 'blocked' | 'stale' (stale = deprecated version)
export function LeanEntry({ archId, lean, state, blockedBy, slotsFull, locked, busy, onEquip, onRemove, onReconfirm, compact }) {
  const T = useFK();
  const c = T[CH_ACCENT_TOKEN];
  const equipped = state === 'equipped';
  const blocked = state === 'blocked';
  const stale = state === 'stale';
  const disabled = blocked || (!equipped && slotsFull) || locked || busy;
  const barColor = stale ? T.gold : equipped ? c : blocked ? T.ink3 : 'transparent';
  const gloss = deriveLeanGloss(lean.policy);
  const dim = blocked && blockedBy ? conflictDimension(archId, lean.id) : null;

  return (
    <div style={{ position: 'relative', overflow: 'hidden', padding: compact ? '13px 14px 13px 16px' : '14px 16px 14px 18px', borderRadius: 14,
      background: equipped ? alpha(c, 0.06) : stale ? alpha(T.gold, 0.05) : T.surface,
      border: `1px solid ${stale ? alpha(T.gold, 0.4) : equipped ? alpha(c, 0.42) : T.hair}`,
      opacity: blocked ? 0.62 : 1 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: barColor }} />
      {/* head */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <Mono style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: c }}>{lean.id}</Mono>
          {equipped && <Badge T={T} c={c} icon="check" label="Equipped" />}
          {stale && <Badge T={T} c={T.gold} icon="refresh" label="Revised" />}
          {blocked && <Badge T={T} c={T.ink3} icon="lock" label="Blocked" muted />}
        </div>
        {!stale && (equipped ? (
          !locked && <button className="fw-tap" disabled={busy} onClick={() => !busy && onRemove(lean.id)} style={{ all: 'unset', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--fw-ui)', fontSize: 12, fontWeight: 600,
            color: T.ink3, padding: '6px 12px', borderRadius: 9, background: alpha(T.ink2, 0.08), border: `1px solid ${T.hair}`, whiteSpace: 'nowrap' }}>Remove</button>
        ) : (
          <button className="fw-tap" disabled={disabled} onClick={() => !disabled && onEquip(lean.id)} style={{ all: 'unset', cursor: disabled ? 'default' : 'pointer', fontFamily: 'var(--fw-ui)',
            fontSize: 12, fontWeight: 700, color: disabled ? T.ink3 : '#0D0E12', padding: '6px 13px', borderRadius: 9, whiteSpace: 'nowrap',
            background: disabled ? alpha(T.ink2, 0.08) : c, border: `1px solid ${disabled ? T.hair : c}` }}>
            {slotsFull && !blocked ? 'Slots full' : 'Equip'}</button>
        ))}
      </div>

      {/* directive — the CANONICAL text, verbatim */}
      <div style={{ marginTop: 10, padding: compact ? '9px 11px' : '10px 12px', borderRadius: 10, background: alpha('#000', 0.2), border: `1px solid ${stale ? alpha(T.gold, 0.3) : T.hair}` }}>
        <Mono style={{ fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: stale ? T.gold : alpha(c, 0.9), display: 'block', marginBottom: 4 }}>{stale ? 'Now · agent directive' : 'Agent directive · verbatim'}</Mono>
        <div style={{ fontSize: compact ? 12 : 13, color: T.ink, lineHeight: 1.5 }}>{lean.canonical}</div>
      </div>

      {/* derived gloss — shown ONLY when it synthesizes across dimensions (it
          earns its place only when it adds beyond the verbatim directive) */}
      {gloss && (
        <div style={{ fontSize: compact ? 11.5 : 12, color: T.ink2, marginTop: 9, lineHeight: 1.45 }}>
          <span style={{ color: T.ink3, fontWeight: 600 }}>What this changes: </span>{gloss}
        </div>
      )}

      {/* blocked reason — always shown */}
      {blocked && blockedBy && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, padding: '8px 11px', borderRadius: 9, background: alpha(T.ink2, 0.06), border: `1px solid ${T.hair}` }}>
          <CIcon name="lock" size={12} color={T.ink3} stroke={2.2} />
          <div style={{ fontSize: compact ? 11 : 11.5, color: T.ink3, lineHeight: 1.4 }}>
            Can't run alongside <b style={{ color: T.ink2 }}>{blockedBy}</b>{dim ? <> — they pull opposite directions on {dim}.</> : '.'}
          </div>
        </div>
      )}

      {/* re-confirm action (stale) */}
      {stale && !locked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11, flexWrap: 'wrap' }}>
          <button className="fw-tap" disabled={busy} onClick={() => !busy && onReconfirm(lean.id)} style={{ all: 'unset', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--fw-ui)', fontSize: 12, fontWeight: 700,
            color: '#0D0E12', padding: '7px 14px', borderRadius: 9, background: T.gold, border: `1px solid ${T.gold}` }}>Re-confirm</button>
          <button className="fw-tap" disabled={busy} onClick={() => !busy && onRemove(lean.id)} style={{ all: 'unset', cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--fw-ui)', fontSize: 12, fontWeight: 600,
            color: T.ink3, padding: '7px 12px', borderRadius: 9, background: alpha(T.ink2, 0.08), border: `1px solid ${T.hair}` }}>Drop it</button>
          <Mono style={{ fontSize: 9.5, color: T.ink3 }}>Stays paused until you confirm</Mono>
        </div>
      )}
    </div>
  );
}

function Badge({ T, c, icon, label, muted }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fw-mono)', fontSize: 8.5, letterSpacing: '0.08em',
      textTransform: 'uppercase', fontWeight: muted ? 600 : 700, color: c, background: alpha(muted ? T.ink2 : c, muted ? 0.08 : 0.14), border: `1px solid ${muted ? T.hair : alpha(c, 0.4)}`, padding: '2px 7px 2px 5px', borderRadius: 999 }}>
      <CIcon name={icon} size={9} color={c} stroke={muted ? 2.2 : 3} />{label}</span>
  );
}

// ── The state notice band ────────────────────────────────────────────────────
export function StateNotice({ state, archName, agentName, droppedCount, pending, compact }) {
  const T = useFK();
  const c = T[CH_ACCENT_TOKEN];
  // preactivation copy is §2.2-correct: "activates when live", not "next deploy".
  const map = {
    preactivation: { icon: 'clock', color: T.gold, title: 'Equipped — not live yet',
      body: <>These controls aren't live yet. Anything you set here <b style={{ color: T.ink }}>activates when {pending?.leans && pending?.tempo ? 'standing leans and the tempo dial go' : pending?.tempo ? 'the tempo dial goes' : 'standing leans go'} live</b>.</> },
    empty: { icon: 'sliders', color: c, title: 'Two open slots',
      body: <>Add a standing lean to sharpen how <b style={{ color: T.ink }}>{archName}</b> expresses itself. This is where tuning starts.</> },
    battle: { icon: 'lock', color: T.risk, title: `${agentName} is in a live battle`,
      body: <>The loadout is <b style={{ color: T.ink }}>frozen</b> for this run. Anything you change here applies to the next deployment, not the battle underway.</> },
    changed: { icon: 'refresh', color: T.gold, title: `Now a ${archName}`,
      body: <><b style={{ color: T.ink }}>{droppedCount} lean{droppedCount === 1 ? '' : 's'} didn't carry to {archName}</b> — its menu is different. Re-pick from the menu below.</> },
    reconfirm: { icon: 'refresh', color: T.gold, title: 'A lean was revised',
      body: <>Its directive text changed. <b style={{ color: T.ink }}>Re-confirm</b> it below to keep it equipped — it stays paused until you do.</> },
  };
  const m = map[state];
  if (!m) return null; // 'live' → no banner
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: compact ? '12px 14px' : '13px 16px', borderRadius: 14,
      background: `linear-gradient(120deg, ${alpha(m.color, 0.1)}, ${T.surface} 78%)`, border: `1px solid ${alpha(m.color, 0.3)}` }}>
      <div style={{ width: compact ? 30 : 34, height: compact ? 30 : 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: alpha(m.color, 0.14), border: `1px solid ${alpha(m.color, 0.35)}` }}>
        <CIcon name={m.icon} size={compact ? 15 : 17} color={m.color} stroke={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 13.5 : 14.5, fontWeight: 700, color: T.ink }}>{m.title}</div>
        <div style={{ fontSize: compact ? 11.5 : 12.5, color: T.ink2, marginTop: 3, lineHeight: 1.45 }}>{m.body}</div>
      </div>
    </div>
  );
}

// ── Battle snapshot — what's locked in for the running battle ─────────────────
export function BattleSnapshot({ leans = [], tempo, compact }) {
  const T = useFK();
  const c = T[CH_ACCENT_TOKEN];
  return (
    <div style={{ padding: compact ? '13px 14px' : '14px 16px', borderRadius: 14, background: alpha(T.risk, 0.05), border: `1px solid ${alpha(T.risk, 0.28)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
        <CIcon name="lock" size={13} color={T.risk} stroke={2.2} />
        <Mono style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.risk, fontWeight: 700 }}>Locked in for this battle</Mono>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {leans.length ? leans.map((l) => (
          <div key={l.adjustmentId} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />
            <span style={{ fontSize: compact ? 12.5 : 13, color: T.ink, lineHeight: 1.4 }}><b style={{ fontFamily: 'var(--fw-mono)', fontSize: 11, color: c }}>{l.adjustmentId}</b> — {l.text}</span>
          </div>
        )) : <div style={{ fontSize: 12, color: T.ink3 }}>No standing leans in this run.</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 2, paddingTop: 9, borderTop: `1px solid ${T.hair}` }}>
          <CIcon name="sliders" size={13} color={T.ink2} />
          <span style={{ fontSize: compact ? 12.5 : 13.5, color: T.ink2, whiteSpace: 'nowrap' }}>Tempo · <b style={{ color: T.ink }}>{tempoLabel(tempo)}</b></span>
        </div>
      </div>
    </div>
  );
}

// ── numbered loadout sub-section header ──────────────────────────────────────
export function LoadoutSubHead({ icon, title, meta, accent, compact }) {
  const T = useFK();
  const c = accent || T[CH_ACCENT_TOKEN];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{ width: compact ? 26 : 28, height: compact ? 26 : 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: alpha(c, 0.13), border: `1px solid ${alpha(c, 0.28)}` }}>
        <CIcon name={icon} size={compact ? 14 : 15} color={c} />
      </div>
      <div style={{ fontSize: compact ? 14 : 15.5, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em', whiteSpace: 'nowrap', flexShrink: 0 }}>{title}</div>
      <div style={{ flex: 1, height: 1, background: T.hair }} />
      {meta && <Mono style={{ fontSize: compact ? 9 : 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3, whiteSpace: 'nowrap', flexShrink: 0 }}>{meta}</Mono>}
    </div>
  );
}
