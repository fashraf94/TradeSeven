// src/components/SharedResearch/sharedResearchStyle.js
//
// Shared Research — the sheet's look, from the --ft-* tokens only (BUILD_RULES
// §10: cssVar for inline styles, the -rgb triplets for translucency; no hex).
// The body draws no motion of its own: the running line is a still dot and its
// words, disclosures open at once — so reduced motion is instant by
// construction (§11; the sheet's own entrance is HubSheet's).
//
// SR_DROP_LAYER: the SignalDrop modal's layer when the sheet opens it (founder
// ruling P-1, Nov 13, 2026) — above the hub sheet (hub/hubStyle.js
// HUB_LAYERS.sheet, 1000) and below the deploy ceremony (1010). The body may not
// import the hub, so the number is held here and pinned against both by
// sharedResearchLayer.test.js.

import { cssVar } from '../../theme/cssTokens';

export const SR_DROP_LAYER = 1001;

const rgba = (name, a) => `rgba(${cssVar(`${name}-rgb`)}, ${a})`;

export const T = Object.freeze({
  ink: cssVar('ink'),
  ink2: cssVar('ink-2'),
  ink3: cssVar('ink-3'),
  teal: cssVar('teal'),
  gold: cssVar('gold'),
  copper: cssVar('copper'),
  purple: cssVar('purple'),
  pos: cssVar('emerald'), // the saved idea's green: emerald, so its mark matches its wash (wash('pos') — review c12)
  neg: cssVar('neg'),
  bg: cssVar('bg-app'),
  surface: cssVar('bg-card'),
  raised: cssVar('bg-agent'),
  hair: cssVar('border-strong'),
});

/** A token's translucent wash, for a tag's or a notice's background. */
export const wash = (tone, a = 0.08) => rgba(tone === 'pos' ? 'emerald' : tone, a);

export const S = Object.freeze({
  col: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 },
  section: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 },
  box: { padding: '12px 14px', borderRadius: 14, background: T.surface, border: `1px solid ${T.hair}`, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  card: { padding: '12px 14px', borderRadius: 14, background: T.bg, border: `1px solid ${T.hair}`, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink3, margin: 0 },
  h3: { margin: 0, fontSize: 17, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em' },
  body: { margin: 0, fontSize: 14, color: T.ink, lineHeight: 1.5, overflowWrap: 'anywhere' },
  small: { margin: 0, fontSize: 12.5, color: T.ink3, lineHeight: 1.5, overflowWrap: 'anywhere' },
  meta: { margin: 0, fontSize: 12.5, color: T.ink2, lineHeight: 1.45, overflowWrap: 'anywhere' },
  row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 },
  actions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  input: {
    boxSizing: 'border-box', display: 'block', width: '100%', minHeight: 46, padding: '10px 14px', borderRadius: 12,
    background: T.bg, color: T.ink, border: `1px solid ${T.hair}`, font: 'inherit', fontSize: 15, lineHeight: 1.5,
  },
  label: { display: 'block', fontSize: 13.5, fontWeight: 600, color: T.ink2, marginBottom: 6 },
});

const buttonBase = {
  appearance: 'none', font: 'inherit', cursor: 'pointer', minHeight: 44, padding: '10px 16px', borderRadius: 12,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'left', lineHeight: 1.3,
  maxWidth: '100%', whiteSpace: 'normal', boxSizing: 'border-box',
};
/** A button's style by kind; `full` stretches it (the phone's single column). */
export function buttonStyle(kind = 'secondary', { full = false, disabled = false } = {}) {
  const look = {
    primary: { background: T.teal, color: T.bg, border: `1px solid ${T.teal}`, fontWeight: 700 },
    secondary: { background: T.surface, color: T.ink, border: `1px solid ${T.hair}`, fontWeight: 600 },
    ghost: { background: 'transparent', color: T.ink2, border: '1px solid transparent', fontWeight: 600 },
    danger: { background: wash('copper', 0.12), color: T.copper, border: `1px solid ${wash('copper', 0.5)}`, fontWeight: 700 },
  }[kind];
  return { ...buttonBase, ...look, ...(full ? { width: '100%' } : {}), ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}) };
}
/** A text link that is a button. */
export const linkStyle = {
  appearance: 'none', font: 'inherit', background: 'none', border: 'none', padding: '6px 0', minHeight: 44, display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
  color: T.teal, fontWeight: 600, textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: 3,
};
