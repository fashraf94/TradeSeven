// src/components/Forge/workshop/traits/TraitsExplorationKit.jsx
//
// Shared, platform-agnostic atoms for the Traits → Archetype Exploration surface.
// Ported faithfully from the Claude Design mock (forge-traits-kit.jsx) and adapted
// to the live forgeKit tokens / Icon / CSS classes. Every piece takes a `compact`
// flag (mobile = true) so mobile + desktop render the same character from the same
// code.
//
// HONESTY (build spec §0): no lifecycle — traits are equipped/in-use with a
// strength, nothing else. Hardness is COMPUTED from rules via getTraitEnforcement
// (soft nudge vs hard guardrail), never an authored tag. No forge/ready/draft, no
// "always soft", no view→commit path.

import React from 'react';
import { useFK, alpha, Icon, Mono } from '../forgeKit';
import { DNA_GROUPS } from '../../../../data/dnaGroups';
import { TRAIT_BY_ID } from '../../../../data/traitLibrary';
import { getTraitEnforcement } from '../../../../utils/traitEnforcement';
import { FACTOR_AXES, PILLAR_ICON, STRENGTH_META } from '../../../../data/archetypeCharacter';

// pillar display meta from live DNA_GROUPS (color/label/blurb) + the glyph map.
function pillarMeta(pillar) {
  const g = DNA_GROUPS[pillar] || {};
  return { color: g.color || '#9A9DAB', label: g.name || pillar, blurb: g.description || '', icon: PILLAR_ICON[pillar] || 'dna' };
}

// honest, computed hardness for a live trait id.
const isTraitHard = (traitId) => getTraitEnforcement(traitId).isEnforced;

// ── archetype sigil — a gradient disc seeded from the real color pair ──
export function ArchSigil({ arch, size = 46 }) {
  const [a, b] = arch.colors;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, position: 'relative',
      background: `conic-gradient(from 140deg, ${a}, ${b}, ${a})`, boxShadow: `0 0 0 1px ${alpha('#000', 0.25)}, 0 6px 18px ${alpha(b, 0.35)}` }}>
      <div style={{ position: 'absolute', inset: size * 0.18, borderRadius: '50%',
        background: `radial-gradient(circle at 36% 30%, ${alpha('#fff', 0.5)}, ${alpha(a, 0.15)} 55%, ${alpha('#05060A', 0.55)})`,
        backdropFilter: 'blur(1px)' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="dna" size={size * 0.42} color={alpha('#05060A', 0.8)} stroke={2} />
      </div>
    </div>
  );
}

// ── the bold color-pair gradient header band ──
export function ArchBand({ arch, isOwn, compact, right }) {
  const [a, b] = arch.colors;
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: compact ? 18 : 20,
      background: `linear-gradient(125deg, ${alpha(a, 0.9)} 0%, ${alpha(b, 0.78)} 100%)`,
      border: `1px solid ${alpha('#fff', 0.12)}` }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 84% 16%, ${alpha('#fff', 0.22)}, transparent 46%)` }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${alpha('#05060A', 0.05)} 0%, ${alpha('#05060A', 0.5)} 100%)` }} />
      <div style={{ position: 'relative', padding: compact ? '15px 16px 16px' : '20px 22px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 12 : 15, minWidth: 0 }}>
            <ArchSigil arch={arch} size={compact ? 46 : 58} />
            <div style={{ minWidth: 0 }}>
              {arch.combo && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 5, padding: '2px 8px', borderRadius: 999,
                  background: alpha('#05060A', 0.32), border: `1px solid ${alpha('#fff', 0.18)}` }}>
                  <Icon name="spark" size={compact ? 9 : 10} color="#fff" />
                  <span style={{ fontFamily: 'var(--fw-mono)', fontSize: compact ? 8.5 : 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: '#fff' }}>{arch.combo}</span>
                </div>
              )}
              <div style={{ fontSize: compact ? 21 : 27, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1.05,
                textShadow: `0 1px 12px ${alpha('#05060A', 0.4)}` }}>{arch.name}</div>
              <div style={{ fontSize: compact ? 12 : 13.5, color: alpha('#fff', 0.92), marginTop: 5, lineHeight: 1.35, fontWeight: 500, textWrap: 'pretty',
                textShadow: `0 1px 8px ${alpha('#05060A', 0.45)}`, maxWidth: compact ? 280 : 440 }}>{arch.disposition}</div>
            </div>
          </div>
          {right}
          {isOwn && !right && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: '5px 9px', borderRadius: 999,
              background: alpha('#05060A', 0.38), border: `1px solid ${alpha('#fff', 0.2)}` }}>
              <Icon name="lock" size={11} color="#fff" stroke={2.2} />
              <span style={{ fontFamily: 'var(--fw-mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, color: '#fff' }}>Set at creation</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── reveal paragraph + voice quote (the soul) ──
export function RevealVoice({ arch, compact, accent }) {
  const T = useFK();
  const c = accent || arch.colors[0];
  return (
    <div>
      <div style={{ fontSize: compact ? 13 : 14.5, color: T.ink2, lineHeight: 1.6, textWrap: 'pretty' }}>{arch.reveal}</div>
      <div style={{ position: 'relative', marginTop: compact ? 14 : 18, padding: compact ? '13px 15px 13px 18px' : '16px 18px 16px 22px',
        borderRadius: compact ? 13 : 15, background: alpha(c, 0.06), border: `1px solid ${alpha(c, 0.2)}` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 3, background: c }} />
        <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: compact ? 15 : 18, fontStyle: 'italic', color: T.ink,
          lineHeight: 1.5, letterSpacing: '-0.01em', textWrap: 'pretty' }}>“{arch.voice}”</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9 }}>
          <Icon name="chat" size={compact ? 11 : 12} color={c} />
          <Mono style={{ fontSize: compact ? 9 : 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: alpha(c, 0.85) }}>In its own words</Mono>
        </div>
      </div>
    </div>
  );
}

// ── hardness badge — soft nudge vs hard guardrail (honest, from rules) ──
export function HardnessBadge({ hard, compact }) {
  const T = useFK();
  if (hard) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fw-mono)', fontSize: compact ? 8.5 : 9.5,
        letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: T.risk,
        background: `repeating-linear-gradient(45deg, ${alpha(T.risk, 0.14)}, ${alpha(T.risk, 0.14)} 4px, ${alpha(T.risk, 0.05)} 4px, ${alpha(T.risk, 0.05)} 8px)`,
        border: `1px solid ${alpha(T.risk, 0.45)}`, padding: '3px 8px 3px 6px', borderRadius: 7, whiteSpace: 'nowrap' }}>
        <Icon name="lock" size={compact ? 9 : 10} color={T.risk} stroke={2.4} />Hard guardrail
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fw-mono)', fontSize: compact ? 8.5 : 9.5,
      letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, color: T.ink3,
      background: alpha(T.ink2, 0.08), border: `1px solid ${T.hair}`, padding: '3px 8px 3px 6px', borderRadius: 7, whiteSpace: 'nowrap' }}>
      <span style={{ width: compact ? 6 : 7, height: compact ? 6 : 7, borderRadius: 2, background: alpha(T.ink2, 0.55) }} />Soft nudge
    </span>
  );
}

// ── the four decision-factor rows (directional + comparable) ──
export function FactorRow({ axis, value, tempPos, accent, compact }) {
  const T = useFK();
  const constraint = axis.constraint;
  const c = constraint ? T.risk : accent;
  return (
    <div style={{ display: 'flex', gap: compact ? 11 : 13, padding: compact ? '11px 0' : '13px 2px', borderTop: `1px solid ${T.hair}` }}>
      <div style={{ width: compact ? 30 : 34, height: compact ? 30 : 34, flexShrink: 0, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: alpha(c, constraint ? 0.12 : 0.1), border: `1px solid ${alpha(c, constraint ? 0.35 : 0.2)}`, color: c }}>
        <Icon name={axis.icon} size={compact ? 15 : 17} color={c} stroke={1.9} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mono style={{ fontSize: compact ? 9.5 : 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, color: constraint ? T.risk : T.ink }}>{axis.label}</Mono>
          {constraint && <Icon name="lock" size={compact ? 9 : 10} color={T.risk} stroke={2.2} />}
          <div style={{ flex: 1 }} />
          <Mono style={{ fontSize: compact ? 8 : 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>{axis.note}</Mono>
        </div>
        <div style={{ fontSize: compact ? 12 : 13, color: T.ink2, lineHeight: 1.5, marginTop: 5, textWrap: 'pretty' }}>{value}</div>
        {axis.spectrum && typeof tempPos === 'number' && (
          <div style={{ marginTop: 9 }}>
            <div style={{ position: 'relative', height: 5, borderRadius: 3, background: `linear-gradient(90deg, ${alpha(T.ink2, 0.25)}, ${alpha(accent, 0.4)})`, border: `1px solid ${T.hair}` }}>
              <div style={{ position: 'absolute', top: '50%', left: `${tempPos * 100}%`, transform: 'translate(-50%,-50%)',
                width: compact ? 12 : 14, height: compact ? 12 : 14, borderRadius: '50%', background: accent,
                border: `2px solid ${T.bg}`, boxShadow: `0 0 0 1px ${alpha(accent, 0.5)}, 0 2px 6px ${alpha('#000', 0.4)}` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <Mono style={{ fontSize: compact ? 8 : 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink3 }}>{axis.spectrum[0]}</Mono>
              <Mono style={{ fontSize: compact ? 8 : 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink3 }}>{axis.spectrum[1]}</Mono>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DecisionFactors({ arch, compact, accent }) {
  const T = useFK();
  const c = accent || arch.colors[0];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: compact ? 2 : 4 }}>
        <Mono style={{ fontSize: compact ? 10 : 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.ink2, fontWeight: 600 }}>How it decides</Mono>
        <div style={{ flex: 1 }} />
        <Mono style={{ fontSize: compact ? 8.5 : 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Directional · uncalibrated</Mono>
      </div>
      {FACTOR_AXES.map((axis) => (
        <FactorRow key={axis.key} axis={axis} value={arch.factors[axis.key]} tempPos={arch.tempPos} accent={c} compact={compact} />
      ))}
    </div>
  );
}

// ── strength toggle (Subtle / Moderate / Dominant) — battle-lockable ──
export function StrengthToggle({ value, onChange, color, compact, disabled }) {
  const T = useFK();
  return (
    <div style={{ display: 'inline-flex', gap: 3, padding: 3, borderRadius: 9, background: alpha('#000', 0.28), border: `1px solid ${T.hair}`, opacity: disabled ? 0.55 : 1 }}>
      {Object.keys(STRENGTH_META).map((s) => {
        const on = s === value;
        const dots = STRENGTH_META[s].dots;
        return (
          <button key={s} className="fw-tap" disabled={disabled} onClick={() => !disabled && onChange && onChange(s)} style={{ all: 'unset', cursor: disabled ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, padding: compact ? '5px 8px' : '6px 10px', borderRadius: 7,
            background: on ? alpha(color, 0.18) : 'transparent', border: `1px solid ${on ? alpha(color, 0.45) : 'transparent'}` }}>
            <span style={{ display: 'flex', gap: 2 }}>
              {[0, 1, 2].map((i) => <span key={i} style={{ width: compact ? 4 : 4.5, height: compact ? 4 : 4.5, borderRadius: '50%', background: i < dots ? (on ? color : T.ink3) : alpha(T.ink2, 0.25) }} />)}
            </span>
            <Mono style={{ fontSize: compact ? 9 : 9.5, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: on ? 700 : 500, color: on ? T.ink : T.ink3 }}>{STRENGTH_META[s].label}</Mono>
          </button>
        );
      })}
    </div>
  );
}

// ── DNA pillar header ──
export function DnaPillarHeader({ pillar, count, compact }) {
  const T = useFK();
  const p = pillarMeta(pillar);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: compact ? 10 : 12 }}>
      <div style={{ width: compact ? 26 : 30, height: compact ? 26 : 30, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: alpha(p.color, 0.13), border: `1px solid ${alpha(p.color, 0.28)}`, color: p.color }}>
        <Icon name={p.icon} size={compact ? 14 : 16} color={p.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: compact ? 13.5 : 15, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em' }}>{p.label}</div>
          <Mono style={{ fontSize: compact ? 9 : 9.5, color: T.ink3 }}>{p.blurb}</Mono>
        </div>
      </div>
      {typeof count === 'number' && <Mono style={{ fontSize: compact ? 9.5 : 10.5, color: T.ink3 }}>{count}</Mono>}
    </div>
  );
}

// ── "born with" mark ──
export function BornWith({ compact }) {
  const T = useFK();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--fw-mono)', fontSize: compact ? 8 : 8.5,
      letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, color: T.gold,
      background: alpha(T.gold, 0.1), border: `1px solid ${alpha(T.gold, 0.3)}`, padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      <Icon name="star" size={compact ? 8 : 9} color={T.gold} />Born with
    </span>
  );
}

// ── trait library card (read-only browse) ──
export function TraitLibCard({ trait, compact, bornWith }) {
  const T = useFK();
  const p = pillarMeta(trait.dnaGroup);
  const hard = isTraitHard(trait.id);
  return (
    <div style={{ position: 'relative', overflow: 'hidden', padding: compact ? '12px 13px' : '14px 15px', borderRadius: compact ? 13 : 14,
      background: T.surface, border: `1px solid ${hard ? alpha(T.risk, 0.3) : T.hair}` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: p.color, opacity: 0.7 }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <div style={{ fontSize: compact ? 13.5 : 14.5, fontWeight: 700, color: T.ink }}>{trait.name}</div>
            {bornWith && <BornWith compact={compact} />}
          </div>
          <div style={{ fontSize: compact ? 11.5 : 12.5, color: T.ink2, marginTop: 4, lineHeight: 1.45, textWrap: 'pretty' }}>{trait.identityStatement}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: compact ? 11 : 12 }}>
        <Mono style={{ fontSize: compact ? 8.5 : 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: p.color }}>{p.label}</Mono>
        <HardnessBadge hard={hard} compact={compact} />
      </div>
    </div>
  );
}

// ── loadout trait (equipped, with strength toggle) ──
export function LoadoutTrait({ trait, strength, bornWith, onStrength, compact, locked }) {
  const T = useFK();
  const p = pillarMeta(trait.dnaGroup);
  const hard = isTraitHard(trait.id);
  return (
    <div style={{ position: 'relative', overflow: 'hidden', padding: compact ? '13px 14px' : '15px 16px', borderRadius: compact ? 14 : 15,
      background: T.surface, border: `1px solid ${hard ? alpha(T.risk, 0.32) : alpha(p.color, 0.22)}` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: p.color }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <div style={{ fontSize: compact ? 14 : 15, fontWeight: 700, color: T.ink }}>{trait.name}</div>
            {bornWith && <BornWith compact={compact} />}
          </div>
          <div style={{ fontSize: compact ? 11.5 : 12.5, color: T.ink2, marginTop: 4, lineHeight: 1.45, textWrap: 'pretty' }}>{trait.identityStatement}</div>
        </div>
        <HardnessBadge hard={hard} compact={compact} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: compact ? 12 : 13, paddingTop: compact ? 12 : 13, borderTop: `1px solid ${T.hair}` }}>
        <Mono style={{ fontSize: compact ? 8.5 : 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink3 }}>Strength</Mono>
        <StrengthToggle value={strength} onChange={onStrength} color={p.color} compact={compact} disabled={locked} />
      </div>
      {locked && <Mono style={{ display: 'block', fontSize: compact ? 8.5 : 9, color: T.ink3, marginTop: 8 }}>Strength locks while a battle is live.</Mono>}
    </div>
  );
}

// ── view ≠ commit reminder (persistent in Explore) ──
export function ViewNotCommit({ compact, agentName }) {
  const T = useFK();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: compact ? '9px 12px' : '10px 14px', borderRadius: 999,
      background: alpha(T.gold, 0.06), border: `1px solid ${alpha(T.gold, 0.22)}` }}>
      <Icon name="eye" size={compact ? 13 : 14} color={T.gold} />
      <div style={{ fontSize: compact ? 11 : 12, color: T.ink2, lineHeight: 1.35 }}>
        You're <b style={{ color: T.ink }}>viewing</b> the roster — this won't change {agentName || 'your agent'}. Switching archetype stays a deliberate action on the dashboard.
      </div>
    </div>
  );
}

// ── roster strip — the six as a switchable cast (mobile horizontal nav) ──
export function RosterStrip({ roster, activeId, onPick, compact, ownId }) {
  const T = useFK();
  return (
    <div className="fw-scroll" style={{ display: 'flex', gap: compact ? 8 : 10, overflowX: 'auto', padding: '2px 0 6px' }}>
      {roster.map((arch) => {
        const on = arch.id === activeId;
        const [a] = arch.colors;
        return (
          <button key={arch.id} className="fw-tap" onClick={() => onPick(arch.id)} style={{ all: 'unset', cursor: 'pointer', flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, width: compact ? 64 : 78, padding: compact ? '8px 4px' : '10px 4px',
            borderRadius: compact ? 12 : 14, background: on ? alpha(a, 0.1) : 'transparent', border: `1px solid ${on ? alpha(a, 0.45) : 'transparent'}` }}>
            <div style={{ position: 'relative' }}>
              <ArchSigil arch={arch} size={compact ? 34 : 40} />
              {arch.id === ownId && <div style={{ position: 'absolute', bottom: -2, right: -2, width: compact ? 13 : 15, height: compact ? 13 : 15, borderRadius: '50%',
                background: T.gold, border: `2px solid ${T.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={compact ? 7 : 8} color={T.bg} stroke={3} /></div>}
            </div>
            <Mono style={{ fontSize: compact ? 8 : 8.5, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: on ? 700 : 500,
              color: on ? T.ink : T.ink3, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'normal' }}>{arch.name.split(' ')[0]}</Mono>
          </button>
        );
      })}
    </div>
  );
}

// ── roster rail item (desktop vertical nav) ──
export function RosterRailItem({ arch, active, isOwn, onPick }) {
  const T = useFK();
  const [a] = arch.colors;
  return (
    <button className="fw-tap" onClick={() => onPick(arch.id)} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%',
      display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 12,
      background: active ? alpha(a, 0.1) : 'transparent', border: `1px solid ${active ? alpha(a, 0.45) : 'transparent'}` }}>
      <div style={{ position: 'relative' }}>
        <ArchSigil arch={arch} size={34} />
        {isOwn && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: T.gold,
          border: `2px solid ${T.surface}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={7} color={T.bg} stroke={3} /></div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: active ? 700 : 600, color: active ? T.ink : T.ink2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{arch.name}</div>
        <Mono style={{ fontSize: 8.5, letterSpacing: '0.04em', color: T.ink3 }}>{isOwn ? 'Your agent' : (arch.combo || 'Archetype')}</Mono>
      </div>
      {active && <Icon name="chevR" size={14} color={a} />}
    </button>
  );
}

// ── signature cluster (the born-with combo, with flavor title) ──
export function SignatureCluster({ arch, compact }) {
  const T = useFK();
  const traits = arch.signature.map((id) => TRAIT_BY_ID[id]).filter(Boolean);
  return (
    <div style={{ padding: compact ? '13px 14px' : '15px 16px', borderRadius: compact ? 14 : 15, background: T.surface, border: `1px solid ${T.hair}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: compact ? 11 : 12 }}>
        <Icon name="star" size={compact ? 13 : 14} color={T.gold} />
        <Mono style={{ fontSize: compact ? 9.5 : 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink2, fontWeight: 600 }}>Born with</Mono>
        {arch.combo && (
          <>
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: T.ink3 }} />
            <Mono style={{ fontSize: compact ? 9.5 : 10.5, letterSpacing: '0.04em', color: T.gold, fontWeight: 600 }}>{arch.combo}</Mono>
          </>
        )}
        <div style={{ flex: 1 }} />
        <Mono style={{ fontSize: compact ? 8.5 : 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>natural lean</Mono>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 9 }}>
        {traits.map((tr) => {
          const p = pillarMeta(tr.dnaGroup);
          return (
            <div key={tr.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, flexShrink: 0, background: p.color }} />
              <div style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 600, color: T.ink }}>{tr.name}</div>
              <div style={{ flex: 1 }} />
              <HardnessBadge hard={isTraitHard(tr.id)} compact={compact} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── create-your-own foreshadow (honest "coming soon" — display only, NO handler) ──
export function ComingSoonAuthor({ compact }) {
  const T = useFK();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: compact ? '13px 14px' : '15px 16px', borderRadius: compact ? 14 : 15,
      background: T.surface, border: `1px dashed ${T.hair2}` }}>
      <div style={{ width: compact ? 34 : 38, height: compact ? 34 : 38, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: alpha(T.ink2, 0.08), color: T.ink3 }}>
        <Icon name="pencil" size={compact ? 16 : 18} color={T.ink3} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: T.ink2 }}>Author your own trait</div>
        <div style={{ fontSize: compact ? 11 : 12, color: T.ink3, marginTop: 2 }}>Define a custom emphasis from scratch.</div>
      </div>
      <span style={{ fontFamily: 'var(--fw-mono)', fontSize: compact ? 8.5 : 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
        color: T.ink3, background: alpha(T.ink2, 0.08), border: `1px solid ${T.hair}`, padding: '4px 9px', borderRadius: 999 }}>Coming soon</span>
    </div>
  );
}

// ── segmented sub-control: Your Character / Explore ──
export function TraitSubTabs({ value, onChange, accent, compact }) {
  const T = useFK();
  const items = [{ id: 'character', label: 'Your Character', icon: 'dna' }, { id: 'explore', label: 'Explore', icon: 'grid' }];
  const idx = items.findIndex((i) => i.id === value);
  return (
    <div style={{ position: 'relative', display: 'flex', padding: 3, borderRadius: 12, background: alpha('#000', 0.3), border: `1px solid ${T.hair}` }}>
      <div style={{ position: 'absolute', top: 3, bottom: 3, left: `calc(3px + ${idx} * (100% - 6px) / 2)`, width: 'calc((100% - 6px) / 2)',
        borderRadius: 9, background: T.raised, border: `1px solid ${T.hair2}`, boxShadow: `0 2px 8px ${alpha('#000', 0.4)}`, transition: 'left .24s cubic-bezier(.34,1.2,.4,1)' }} />
      {items.map((it) => {
        const on = it.id === value;
        return (
          <button key={it.id} className="fw-tap" onClick={() => onChange(it.id)} style={{ all: 'unset', cursor: 'pointer', position: 'relative', zIndex: 1, flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: compact ? '9px 4px' : '10px 4px' }}>
            <Icon name={it.icon} size={compact ? 13 : 14} color={on ? accent : T.ink3} />
            <span style={{ fontFamily: 'var(--fw-ui)', fontSize: compact ? 12.5 : 13.5, fontWeight: on ? 700 : 500, color: on ? T.ink : T.ink3 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── titled pane (desktop two-column character sheet / reader) ──
export function Pane({ title, kicker, accent, pad = 18, children }) {
  const T = useFK();
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: `${pad}px ${pad}px 0` }}>
        {kicker && <Mono style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent || T.allocation, fontWeight: 700 }}>{kicker}</Mono>}
        {title && <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em' }}>{title}</div>}
      </div>
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}
