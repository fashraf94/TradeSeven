// src/components/CommandCenter/HubParts.jsx
//
// Command Center hub, slice S1 — the small parts every section uses, ported
// from the design's primitives (ff-ui.jsx: FfMono, FfEyebrow, FfTag, FfIco,
// FfBtn, FfCard, FfSection, FfRow, FfEmpty; ff-stage.jsx: RingGlyph).
//
// Production deltas from the prototype, all deliberate:
//   - colours are tokens (hub/hubStyle.js), never hex;
//   - a control with no handler renders disabled (S1 wires no action; S2b–S6
//     supply them), so nothing on screen pretends to work;
//   - on the phone every control is at least 44 px tall (spec §10);
//   - no CSS transition strings: motion goes through the motion tokens.

import React, { createContext, useContext } from 'react';
import { cssVar } from '../../theme/cssTokens';
import { AREA_TOKEN, C, HAIR, HAIR_2, MONO, PHONE_TARGET, tint } from './hub/hubStyle';

/** The composition the hub is drawing ('phone' | 'desktop' | 'tablet' | 'stacked'). */
export const HubLayoutContext = createContext('stacked');
export const useHubComposition = () => useContext(HubLayoutContext);
const usePhone = () => useHubComposition() === 'phone';

export function Mono({ children, style, ...rest }) {
  return <span style={{ fontFamily: MONO, ...style }} {...rest}>{children}</span>;
}

export function Eyebrow({ children, color = C.ink3, style, as: Tag = 'div' }) {
  return (
    <Tag style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color, fontWeight: 600, margin: 0, ...style }}>
      {children}
    </Tag>
  );
}

/** A small label chip. `tone` is a token with an -rgb triplet; `dim` is the outlined grey variant. */
export function Tag({ children, tone = 'teal', dim = false, style }) {
  return (
    <span
      style={{
        fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
        color: dim ? C.ink2 : cssVar(tone),
        background: dim ? 'transparent' : tint(tone, 0.14),
        border: `1px solid ${dim ? HAIR_2 : tint(tone, 0.34)}`,
        padding: '3px 7px', borderRadius: 5, whiteSpace: 'nowrap', lineHeight: 1.3, ...style,
      }}
    >
      {children}
    </span>
  );
}

/** The design's line icons (FfIco), drawn in currentColor. */
const ICON_PATHS = {
  chevR: <path d="M9 5l7 7-7 7" />,
  chevD: <path d="M5 9l7 7 7-7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M4 12.5l5 5L20 6" />,
  film: <g><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 10h4M17 10h4M3 15h4M17 15h4" /></g>,
  sword: <g><path d="M14.5 3.5L20 3l-.5 5.5-8 8-5-5 8-8z" /><path d="M6.5 17.5L3 21M4.5 15.5l4 4" /></g>,
  lock: <g><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></g>,
  pencil: <g><path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" /><path d="M14 6l3 3" /></g>,
  search: <g><circle cx="11" cy="11" r="7" /><path d="M16 16l5 5" /></g>,
  info: <g><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></g>,
  hammer: <g><path d="M14 7l4 4M16 5l3 3-2.5 2.5-3-3L16 5zM13.5 9.5L5 18l1.5 1.5L15 11" /></g>,
};

export function Icon({ name, size = 16, weight = 1.7, style }) {
  if (name === 'bolt') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0, ...style }}>
        <path d="M13 2L4 13h6l-1 9 9-12h-6l1-8z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0, ...style }}>
      <g fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
        {ICON_PATHS[name] || <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />}
      </g>
    </svg>
  );
}

/**
 * The shipped HoldToDeployButton takes an `Icon` component; this is the
 * design's bolt in that shape. It draws in the button's text colour, so the
 * hub's disabled style greys it as the design does.
 */
export function BoltIcon({ size = 17, style }) {
  return <Icon name="bolt" size={size} style={style} />;
}

const BUTTON_KINDS = {
  primary: { background: C.blue, color: C.white, boxShadow: `0 8px 24px ${tint('blue-action', 0.28)}`, border: '1px solid transparent' },
  accent: { background: tint('teal', 0.13), color: C.teal, border: `1px solid ${tint('teal', 0.4)}` },
  secondary: { background: C.raised, color: C.ink, border: `1px solid ${HAIR_2}` },
  ghost: { background: 'transparent', color: C.ink2, border: '1px solid transparent' },
};

/**
 * The design's FfBtn. With no `onPress` it renders disabled — the S1 rule for
 * every action a later slice wires.
 */
export function HubButton({ kind = 'secondary', icon, children, onPress, small = false, full = false, ariaLabel, style }) {
  const phone = usePhone();
  const disabled = typeof onPress !== 'function';
  const height = small && !phone ? 36 : PHONE_TARGET;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onPress}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        appearance: 'none', font: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        minHeight: height, padding: small ? '0 12px' : '0 16px', borderRadius: 12,
        fontWeight: 600, fontSize: small ? 13 : 14, width: full ? '100%' : 'auto', whiteSpace: 'nowrap',
        ...BUTTON_KINDS[kind],
        ...(disabled ? { opacity: 0.5, boxShadow: 'none' } : null),
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

/**
 * The design's inline link (.ff-link). On the phone it is a 44 px target; on
 * wider compositions it sits in the line of text, as designed.
 */
export function HubLink({ children, onPress, ariaExpanded, ariaLabel, style }) {
  const phone = usePhone();
  const disabled = typeof onPress !== 'function';
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onPress}
      disabled={disabled}
      aria-expanded={ariaExpanded}
      aria-label={ariaLabel}
      style={{
        appearance: 'none', font: 'inherit', background: 'transparent', border: 'none', padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: phone ? 'inline-flex' : 'inline', alignItems: 'center', minHeight: phone ? PHONE_TARGET : undefined,
        color: C.teal, fontWeight: 600, lineHeight: 1.3, opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      <span style={{ borderBottom: `1px solid ${tint('teal', 0.35)}`, paddingBottom: 1 }}>{children}</span>
    </button>
  );
}

export function Card({ children, style, pad = 16, accent = null, dashed = false, ...rest }) {
  return (
    <div
      style={{
        padding: pad, borderRadius: 16, background: C.surface,
        border: `1px ${dashed ? 'dashed' : 'solid'} ${accent ? tint(accent, 0.3) : HAIR}`, ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/** A labelled section: an eyebrow heading on the left, an optional slot on the right. */
export function Section({ label, right = null, children, style, ...rest }) {
  return (
    <section aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 10, ...style }} {...rest}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 20, flexWrap: 'wrap' }}>
        <Eyebrow as="h2" style={{ minWidth: 0 }}>{label}</Eyebrow>
        {right}
      </div>
      {children}
    </section>
  );
}

/** The design's FfRow: a full-width row button with a chevron. Disabled with no `onPress`. */
export function Row({ onPress, children, right = null, ariaLabel, style }) {
  const disabled = typeof onPress !== 'function';
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onPress}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        appearance: 'none', font: 'inherit', color: 'inherit', background: 'transparent', border: 'none',
        cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        minHeight: 52, padding: '10px 12px', borderRadius: 12, textAlign: 'left', ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {right}
      <span style={{ color: C.ink3, display: 'flex' }}><Icon name="chevR" size={15} /></span>
    </button>
  );
}

/** The design's FfEmpty: an icon tile, a title and a line. */
export function EmptyNote({ icon, title, sub }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 16, borderRadius: 14, border: `1px dashed ${HAIR_2}`, background: C.bg }}>
      <span style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.surface, border: `1px solid ${HAIR}`, flexShrink: 0, color: C.ink3 }}>
        <Icon name={icon} size={17} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: C.ink2, marginTop: 4, lineHeight: 1.5, textWrap: 'pretty' }}>{sub}</div>}
      </div>
    </div>
  );
}

/** A section's loading line: a still dot and the section's own "Checking …" words. Not a live region. */
export function LoadingLine({ children, style }) {
  return (
    <div data-hub-loading="" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.ink2, lineHeight: 1.45, ...style }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: C.ink3, flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}

/** The design's RingGlyph, in an area's colour when `on`. */
export function RingGlyph({ on, area }) {
  const tone = AREA_TOKEN[area] || 'teal';
  const color = cssVar(tone);
  return (
    <span
      aria-hidden="true"
      style={{
        width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${on ? color : C.ink3}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: on ? `0 0 12px ${tint(tone, 0.45)}` : 'none',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? color : 'transparent' }} />
    </span>
  );
}
