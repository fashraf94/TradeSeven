// src/components/Forge/workshop/forgeKit.jsx
//
// The Forge (mobile redesign) — shared workshop frame primitives.
//
// This is the cohesion layer of the new Forge: one segmented switcher, one
// stage rail, one finalize ritual, one set of shelf cards — reused identically
// across all three build areas. Ported faithfully from the Claude Design mockup
// (forge2-kit.jsx) and adapted to the app's DARK_TOKENS.
//
// Tokens: we do NOT introduce a parallel palette. `fkTokens(tokens)` is a thin
// live adapter that maps DARK_TOKENS (from useTheme()) onto the design's
// shorter names, plus alpha() for translucency on the hex accents. The adapter
// is distributed via context so the ported primitives stay close to the
// original source.

import React, { createContext, useContext } from 'react';

// hex + alpha → rgba (accents in DARK_TOKENS are hex; borders are already rgba
// and are used directly, never passed through here).
export function alpha(hex, a) {
  if (typeof hex !== 'string' || hex[0] !== '#') return hex;
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Live adapter: DARK_TOKENS → the design's palette names. Every value derives
// from the passed tokens, so it tracks the theme rather than drifting.
export function fkTokens(t) {
  return {
    bg: t.bgApp,
    surface: t.bgCard,
    raised: t.bgAgent,
    hair: t.borderDefault,
    hair2: t.borderInput,
    ink: t.textWhite,
    ink2: t.textMuted,
    ink3: t.textFaint,
    teal: t.teal,
    gold: t.medalGold,
    copper: t.warmCopper,
    risk: t.red,
    // forge category colors (for the NEW frame accents)
    technical: t.teal,
    fundamental: t.amber,
    allocation: t.purpleText,
  };
}

// ── token context ───────────────────────────────────────────────────────────
const ForgeKitContext = createContext(null);
export function ForgeKitProvider({ tokens, children }) {
  const T = React.useMemo(() => fkTokens(tokens), [tokens]);
  return <ForgeKitContext.Provider value={T}>{children}</ForgeKitContext.Provider>;
}
export function useFK() {
  return useContext(ForgeKitContext) || fkTokens({
    // Defensive fallback (dark obsidian) so primitives never crash if rendered
    // outside the provider during a transient.
    bgApp: '#0D0E12', bgCard: '#15171E', bgAgent: '#1C1A27',
    borderDefault: 'rgba(255,255,255,0.07)', borderInput: 'rgba(255,255,255,0.12)',
    textWhite: '#F4F5F8', textMuted: '#9A9DAB', textFaint: '#5E6170',
    teal: '#5eead4', medalGold: '#F0C75E', warmCopper: '#E8927C',
    red: '#ef4444', amber: '#f59e0b', purpleText: '#a78bfa',
  });
}

// ── one-time CSS (keyframes + fonts + helpers) ───────────────────────────────
export function injectForgeWorkshopCSS() {
  if (typeof document === 'undefined' || document.getElementById('__forge_workshop_css')) return;
  // Fonts (idempotent — harmless if the app already loads them)
  if (!document.getElementById('__forge_workshop_fonts')) {
    const link = document.createElement('link');
    link.id = '__forge_workshop_fonts';
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }
  const s = document.createElement('style');
  s.id = '__forge_workshop_css';
  s.textContent = FORGE_WORKSHOP_CSS;
  document.head.appendChild(s);
}

// Exported so tests can inject the REAL shipped rules (e.g. the .fw-scroll border-box
// fix) into a headless browser instead of a hand-rolled subset that could drift.
export const FORGE_WORKSHOP_CSS = `
    @keyframes fwHeat   { 0%{transform:translateX(-130%)} 100%{transform:translateX(130%)} }
    @keyframes fwGlow   { 0%{opacity:0} 28%{opacity:1} 100%{opacity:0} }
    @keyframes fwStamp  { 0%{transform:scale(1.7);opacity:0} 55%{transform:scale(.9);opacity:1} 100%{transform:scale(1)} }
    @keyframes fwRise   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
    @keyframes fwSheet  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
    @keyframes fwEmber  { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
    @keyframes fwFade   { from{opacity:0} to{opacity:1} }
    @keyframes fwOrbPulse { 0%,100%{transform:scale(1);opacity:.9} 50%{transform:scale(1.06);opacity:1} }
    @keyframes fwOrbSpin  { to{transform:rotate(360deg)} }
    @keyframes fwOrbSpinR { to{transform:rotate(-360deg)} }
    .fw-stagger > * { animation: fwRise .42s cubic-bezier(.22,.8,.3,1) both; }
    .fw-stagger > *:nth-child(2){animation-delay:.05s} .fw-stagger > *:nth-child(3){animation-delay:.1s}
    .fw-stagger > *:nth-child(4){animation-delay:.15s} .fw-stagger > *:nth-child(5){animation-delay:.2s}
    .fw-stagger > *:nth-child(6){animation-delay:.25s} .fw-stagger > *:nth-child(7){animation-delay:.3s}
    .fw-scroll::-webkit-scrollbar { width: 0; height: 0; }
    /* Forge scroll owners set height:100% + their own padding. Without border-box the
       padding is added OUTSIDE the 100% height, so the owner's border-box overflows the
       fixed-height body frame (overflow:hidden) by the padding amount; that overhang is
       clipped, and in the viewport band where content sits between the frame height and
       frame+padding the owner reports NOT scrollable while content still exceeds the
       visible frame — the bottom is stranded and unreachable ("Explore can't scroll").
       (The app's global border-box reset is not reaching these nodes.) */
    .fw-scroll { scrollbar-width: none; box-sizing: border-box; }
    .fw-tap { cursor: pointer; transition: transform .12s ease, background .15s ease, border-color .15s ease, box-shadow .2s ease; -webkit-tap-highlight-color: transparent; }
    .fw-tap:active { transform: scale(.985); }
  `;

// ── Icons (line glyphs, ported from the design) ──────────────────────────────
export function Icon({ name, size = 18, color = 'currentColor', stroke = 1.7, style }) {
  const T = useFK();
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    target: <g {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" /></g>,
    rules: <g {...p}><path d="M5 5h14M5 12h14M5 19h14" /><circle cx="9" cy="5" r="2" fill={T.bg} /><circle cx="15" cy="12" r="2" fill={T.bg} /><circle cx="8" cy="19" r="2" fill={T.bg} /></g>,
    plus: <path {...p} d="M12 6v12M6 12h12" />,
    chevR: <path {...p} d="M9 5l7 7-7 7" />,
    check: <path {...p} d="M4 12.5l5 5L20 6" />,
    x: <path {...p} d="M6 6l12 12M18 6L6 18" />,
    spark: <path {...p} d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z" />,
    lock: <g {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></g>,
    shield: <path {...p} d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />,
    trend: <path {...p} d="M3 17l5-6 4 3 6-8M16 6h5v5" />,
    scale: <g {...p}><path d="M12 4v16M6 8h12M6 8l-3 6h6l-3-6zM18 8l-3 6h6l-3-6z" /></g>,
    sparkles: <g {...p}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" /><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z" /></g>,
    chat: <g {...p}><path d="M5 5h14a2 2 0 012 2v7a2 2 0 01-2 2h-7l-4 3v-3H5a2 2 0 01-2-2V7a2 2 0 012-2z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></g>,
    compass: <g {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" fill={color} stroke="none" /></g>,
    upload: <g {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 20h14" /></g>,
    pencil: <g {...p}><path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" /><path d="M14 6l3 3" /></g>,
    dna: <g {...p}><path d="M7 4c0 5 10 7 10 12M17 4c0 5-10 7-10 12M7 4h10M7 20h10M8.5 8h7M8.5 16h7" /></g>,
    trash: <g {...p}><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13h10l1-13" /></g>,
    hammer: <g {...p}><path d="M14 7l4 4M16 5l3 3-2.5 2.5-3-3L16 5zM13.5 9.5L5 18l1.5 1.5L15 11" /></g>,
    book: <g {...p}><path d="M5 4h11a2 2 0 012 2v14H7a2 2 0 01-2-2V4z" /><path d="M5 16h13" /></g>,
    arrowR: <path {...p} d="M5 12h14M13 6l6 6-6 6" />,
    send: <path {...p} d="M4 12l16-7-6 16-3-7-7-2z" />,
    eye: <g {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></g>,
    layers: <g {...p}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5M3 17l9 5 9-5" /></g>,
    star: <path {...p} d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8L12 3z" />,
    grid: <g {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></g>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0, ...style }}>
      {paths[name] || null}
    </svg>
  );
}

// ── The agent Orb — living state element, CSS-only motion ─────────────────────
export function Orb({ state = 'ready', size = 56, color }) {
  const T = useFK();
  const hue = color || T.teal;
  const live = state === 'live';
  const reading = state === 'reading';
  const intensity = live ? 0.7 : reading ? 0.5 : 0.34;
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0, animation: `fwOrbPulse ${live ? 2.2 : 3.4}s ease-in-out infinite` }}>
      <div style={{ position: 'absolute', inset: -size * 0.28, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(hue, intensity)} 0%, transparent 68%)`, filter: 'blur(2px)' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', padding: Math.max(2, size * 0.05),
        background: `conic-gradient(from 0deg, ${alpha(hue, 0)}, ${alpha(hue, 0.95)}, ${alpha(hue, 0)} 55%, ${alpha(hue, 0)})`,
        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))',
        mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))',
        animation: `${live ? 'fwOrbSpin 4s' : reading ? 'fwOrbSpin 7s' : 'fwOrbSpin 14s'} linear infinite` }} />
      <div style={{ position: 'absolute', inset: size * 0.26, borderRadius: '50%',
        background: `radial-gradient(circle at 38% 32%, ${alpha(hue, 0.95)}, ${alpha(hue, 0.22)} 70%, ${alpha(hue, 0.08)})`,
        boxShadow: `inset 0 0 ${size * 0.12}px ${alpha(hue, 0.5)}` }} />
    </div>
  );
}

// ── small primitives ─────────────────────────────────────────────────────────
export function Eyebrow({ children, color, style }) {
  const T = useFK();
  return <div style={{ fontFamily: 'var(--fw-mono)', fontSize: 10.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: color || T.ink3, fontWeight: 500, ...style }}>{children}</div>;
}
export function Mono({ children, style }) {
  return <span style={{ fontFamily: 'var(--fw-mono)', ...style }}>{children}</span>;
}
export function Tag({ children, color, bg }) {
  const T = useFK();
  const c = color || T.ink2;
  return <span style={{ fontFamily: 'var(--fw-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: c, background: bg || alpha(c, 0.12), border: `1px solid ${alpha(c, 0.25)}`, padding: '3px 7px', borderRadius: 6, fontWeight: 500, whiteSpace: 'nowrap' }}>{children}</span>;
}

// status pill — draft → ready → equipped, legible everywhere a component appears
export function StatusPill({ status, color }) {
  const T = useFK();
  const map = {
    draft: { label: 'Draft', c: T.ink3, icon: 'pencil' },
    ready: { label: 'Ready', c: color || T.teal, icon: 'check' },
    equipped: { label: 'Equipped', c: T.gold, icon: 'shield' },
  };
  const s = map[status] || map.draft;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fw-mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: s.c, background: alpha(s.c, status === 'draft' ? 0.07 : 0.13), border: `1px solid ${alpha(s.c, status === 'draft' ? 0.18 : 0.32)}`, padding: '3px 8px 3px 6px', borderRadius: 999, fontWeight: 600, whiteSpace: 'nowrap' }}>
      <Icon name={s.icon} size={10} color={s.c} stroke={2.2} />{s.label}
    </span>
  );
}

// a quiet read-only "in use" badge — the ONLY hint at equipment, never a control
export function InUseBadge() {
  const T = useFK();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--fw-mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink3, background: alpha(T.ink2, 0.08), border: `1px solid ${T.hair}`, padding: '2px 7px', borderRadius: 999, fontWeight: 600 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.gold }} />In use
    </span>
  );
}

// ── The Forge wordmark — warm brand anchor against the cool UI ────────────────
export function ForgeMark({ size = 30 }) {
  const T = useFK();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: size, height: size, borderRadius: 9, position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(150deg, ${alpha(T.copper, 0.22)}, ${alpha(T.gold, 0.08)})`, border: `1px solid ${alpha(T.copper, 0.35)}` }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 9, background: alpha(T.copper, 0.5), filter: 'blur(9px)', opacity: 0.5, animation: 'fwEmber 3.4s ease-in-out infinite' }} />
        <Icon name="hammer" size={size * 0.56} color={T.gold} />
      </div>
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontFamily: 'var(--fw-ui)', fontSize: 16, fontWeight: 700, letterSpacing: '0.02em', color: T.ink }}>Forge</div>
        <Mono style={{ fontSize: 7.5, letterSpacing: '0.26em', color: T.ink3, textTransform: 'uppercase', display: 'block', marginTop: 2 }}>Workshop</Mono>
      </div>
    </div>
  );
}

// ── Segmented control (default switcher) ─────────────────────────────────────
export function SegmentSwitcher({ items, active, onPick }) {
  const T = useFK();
  const idx = Math.max(0, items.findIndex((i) => i.id === active));
  const n = items.length;
  return (
    <div style={{ position: 'relative', display: 'flex', padding: 3, borderRadius: 13, background: alpha('#000000', 0.34), border: `1px solid ${T.hair}`, boxShadow: `inset 0 1px 3px ${alpha('#000000', 0.4)}` }}>
      <div style={{ position: 'absolute', top: 3, bottom: 3, left: `calc(3px + ${idx} * (100% - 6px) / ${n})`, width: `calc((100% - 6px) / ${n})`, borderRadius: 10, background: T.raised, border: `1px solid ${T.hair2}`, boxShadow: `0 2px 8px ${alpha('#000000', 0.4)}`, transition: 'left .26s cubic-bezier(.34,1.2,.4,1)' }} />
      {items.map((it) => {
        const on = it.id === active;
        const c = on ? it.accent : T.ink3;
        return (
          <button key={it.id} className="fw-tap" onClick={() => onPick(it.id)} style={{ all: 'unset', cursor: 'pointer', position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 2px 7px' }}>
            {it.n
              ? <Mono style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', color: c, transition: 'color .2s' }}>{it.n}</Mono>
              : <Icon name={it.icon} size={12} color={c} />}
            <Mono style={{ fontSize: 8.5, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: on ? 700 : 500, color: on ? T.ink : T.ink3, transition: 'color .2s' }}>{it.label}</Mono>
          </button>
        );
      })}
    </div>
  );
}

// ── Stage rail — the 4-node skeleton shown identically in every build ─────────
export function StageRail({ stages, current, accent, onJump }) {
  const T = useFK();
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 2px' }}>
      {stages.map((label, i) => {
        const done = i < current, on = i === current, reach = i <= current;
        return (
          <React.Fragment key={label}>
            {i > 0 && <div style={{ flex: 1, height: 1.5, margin: '0 6px', borderRadius: 2, position: 'relative', background: T.hair2, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: accent, transformOrigin: 'left', transform: `scaleX(${done ? 1 : 0})`, transition: 'transform .3s ease' }} />
            </div>}
            <button className="fw-tap" onClick={() => reach && onJump && onJump(i)} style={{ all: 'unset', cursor: reach ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{ width: on ? 26 : 22, height: on ? 26 : 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .25s cubic-bezier(.34,1.2,.4,1)', background: done ? accent : on ? alpha(accent, 0.16) : T.surface, border: `1.5px solid ${done || on ? accent : T.hair2}`, boxShadow: on ? `0 0 0 4px ${alpha(accent, 0.12)}` : 'none' }}>
                {done ? <Icon name="check" size={12} color={T.bg} stroke={2.6} /> : <Mono style={{ fontSize: 10, fontWeight: 700, color: on ? accent : T.ink3 }}>{i + 1}</Mono>}
              </div>
              <Mono style={{ fontSize: 7.5, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: on ? 700 : 500, color: on ? T.ink : done ? T.ink2 : T.ink3, whiteSpace: 'nowrap' }}>{label}</Mono>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── The primary forge CTA — heat-tinged signature action ──────────────────────
export function ForgeButton({ label, onClick, disabled, icon = 'hammer' }) {
  const T = useFK();
  return (
    <button className="fw-tap" onClick={onClick} disabled={disabled} style={{ all: 'unset', boxSizing: 'border-box', cursor: disabled ? 'default' : 'pointer', width: '100%', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '16px', borderRadius: 14,
      background: disabled ? T.surface : `linear-gradient(180deg, ${alpha(T.gold, 0.16)}, ${alpha(T.copper, 0.1)}), ${T.raised}`,
      border: `1px solid ${disabled ? T.hair : alpha(T.copper, 0.5)}`,
      boxShadow: disabled ? 'none' : `0 8px 26px ${alpha(T.copper, 0.22)}, inset 0 1px 0 ${alpha(T.gold, 0.25)}`,
      color: disabled ? T.ink3 : T.ink, fontFamily: 'var(--fw-ui)', fontWeight: 700, fontSize: 15.5 }}>
      {!disabled && <Icon name={icon} size={18} color={T.gold} />}
      <span style={{ letterSpacing: '-0.01em' }}>{label}</span>
    </button>
  );
}

// ── Mix meter — the hard/soft balance (rules differentiator + bundle cards) ────
export function MixMeter({ soft, hard, compact = false }) {
  const T = useFK();
  const total = soft + hard || 1;
  const h = compact ? 6 : 10;
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', height: h, borderRadius: 99, overflow: 'hidden', background: T.bg, border: `1px solid ${T.hair}` }}>
        <div style={{ width: `${(soft / total) * 100}%`, background: alpha(T.ink2, 0.5), transition: 'width .3s ease' }} />
        <div style={{ width: `${(hard / total) * 100}%`, background: `repeating-linear-gradient(45deg, ${T.risk}, ${T.risk} 4px, ${alpha(T.risk, 0.65)} 4px, ${alpha(T.risk, 0.65)} 8px)`, transition: 'width .3s ease' }} />
      </div>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: alpha(T.ink2, 0.5) }} />
            <Mono style={{ fontSize: 11, color: T.ink2 }}><b style={{ color: T.ink }}>{soft}</b> preference{soft !== 1 ? 's' : ''}</Mono>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="lock" size={11} color={hard ? T.risk : T.ink3} stroke={2.2} />
            <Mono style={{ fontSize: 11, color: hard ? T.ink : T.ink3 }}><b style={{ color: hard ? T.risk : T.ink3 }}>{hard}</b> hard limit{hard !== 1 ? 's' : ''}</Mono>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shelf card — the "it joins your shelf" payoff, one grammar per type ────────
export function ShelfCard({ accent, status, children, onClick }) {
  const T = useFK();
  const draft = status === 'draft';
  return (
    <div className={onClick ? 'fw-tap' : ''} onClick={onClick} style={{ position: 'relative', overflow: 'hidden', padding: '14px 15px', borderRadius: 16, background: T.surface, border: `1px solid ${draft ? T.hair : alpha(accent, 0.28)}` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: draft ? `repeating-linear-gradient(180deg, ${T.hair2}, ${T.hair2} 5px, transparent 5px, transparent 10px)` : accent }} />
      {children}
    </div>
  );
}

// ── The finalize ritual — restrained ceremony: heat sweep + status stamp ──────
export function ForgeFlash({ name, kindLabel, accent, onDone }) {
  const T = useFK();
  React.useEffect(() => {
    const id = setTimeout(onDone, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha('#050609', 0.78), backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', animation: 'fwFade .2s ease' }}>
      <div style={{ width: 232, padding: '26px 22px 22px', borderRadius: 22, position: 'relative', overflow: 'hidden', background: T.surface, border: `1px solid ${alpha(T.copper, 0.4)}`, textAlign: 'center', boxShadow: `0 24px 70px rgba(0,0,0,0.6), 0 0 60px ${alpha(T.copper, 0.18)}` }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `linear-gradient(105deg, transparent 30%, ${alpha(T.gold, 0.5)} 50%, transparent 70%)`, animation: 'fwHeat 1s ease-in-out .15s both' }} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(circle at 50% 38%, ${alpha(T.copper, 0.4)}, transparent 62%)`, animation: 'fwGlow 1.3s ease-out both' }} />
        <div style={{ position: 'relative', width: 60, height: 60, margin: '0 auto 16px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(160deg, ${alpha(T.copper, 0.2)}, ${alpha(T.gold, 0.06)})`, border: `1px solid ${alpha(T.copper, 0.4)}` }}>
          <Icon name="hammer" size={28} color={T.gold} />
          <div style={{ position: 'absolute', bottom: -8, right: -8, width: 26, height: 26, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${alpha(accent, 0.5)}`, animation: 'fwStamp .5s cubic-bezier(.34,1.4,.4,1) .6s both' }}>
            <Icon name="check" size={14} color={T.bg} stroke={3} />
          </div>
        </div>
        <Mono style={{ fontSize: 9, letterSpacing: '0.22em', color: T.gold, textTransform: 'uppercase', fontWeight: 600 }}>Tempered · Ready</Mono>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginTop: 7, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 11.5, color: T.ink2, marginTop: 3 }}>joins your {kindLabel} shelf</div>
      </div>
    </div>
  );
}

// ── Toast — bottom pill ──────────────────────────────────────────────────────
export function ForgeToast({ msg, accent }) {
  const T = useFK();
  return (
    <div style={{ position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 130, maxWidth: '88%', display: 'flex', alignItems: 'center', gap: 9, padding: '11px 16px', borderRadius: 999, background: T.raised, border: `1px solid ${alpha(accent || T.teal, 0.4)}`, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', animation: 'fwRise .3s ease both', whiteSpace: 'nowrap', fontFamily: 'var(--fw-ui)' }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: accent || T.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={11} color={T.bg} stroke={2.8} />
      </div>
      <span style={{ fontSize: 12.5, color: T.ink, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg}</span>
    </div>
  );
}

// ── Build-entry banner shared by every area ──────────────────────────────────
export function BuildEntry({ title, sub, onBuild }) {
  const T = useFK();
  return (
    <button className="fw-tap" onClick={onBuild} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 13, padding: '16px 16px', borderRadius: 16, marginBottom: 22, background: `linear-gradient(135deg, ${alpha(T.copper, 0.1)}, ${T.surface} 70%)`, border: `1px solid ${alpha(T.copper, 0.35)}` }}>
      <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(160deg, ${alpha(T.copper, 0.25)}, ${alpha(T.gold, 0.06)})`, border: `1px solid ${alpha(T.copper, 0.4)}` }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 13, background: alpha(T.copper, 0.5), filter: 'blur(10px)', opacity: 0.5, animation: 'fwEmber 3.2s ease-in-out infinite' }} />
        <Icon name="hammer" size={21} color={T.gold} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{title}</div>
        <div style={{ fontSize: 11.5, color: T.ink2, marginTop: 2, lineHeight: 1.35 }}>{sub}</div>
      </div>
      <Icon name="chevR" size={16} color={T.copper} />
    </button>
  );
}

export function AreaHeader({ n, name, slotLine, accent }) {
  const T = useFK();
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
        <Mono style={{ fontSize: 12, letterSpacing: '0.14em', color: accent, fontWeight: 700 }}>{n}</Mono>
        <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.02em', color: T.ink }}>{name}</div>
      </div>
      <div style={{ fontSize: 12, color: T.ink2, marginTop: 5 }}>{slotLine}</div>
    </div>
  );
}

export function ShelfHeader({ label, count }) {
  const T = useFK();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
      <Eyebrow color={T.ink2}>{label}</Eyebrow>
      <div style={{ flex: 1, height: 1, background: T.hair }} />
      <Mono style={{ fontSize: 10, color: T.ink3 }}>{count}</Mono>
    </div>
  );
}

// "The polished desktop workbench lands next" banner — shared by the Rules and
// Traits desktop preview surfaces. The full interactive build/edit workbench is
// a future task; building/editing route to the current (viewport-agnostic) bench.
export function WorkbenchBanner({ text }) {
  const T = useFK();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '0 0 16px', padding: '11px 14px', borderRadius: 12, background: alpha(T.copper, 0.05), border: `1px solid ${alpha(T.copper, 0.18)}` }}>
      <Icon name="hammer" size={14} color={T.copper} />
      <Mono style={{ fontSize: 9.5, letterSpacing: '0.04em', color: T.ink2, lineHeight: 1.45 }}>{text}</Mono>
    </div>
  );
}
