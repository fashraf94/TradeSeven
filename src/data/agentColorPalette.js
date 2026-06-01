// src/data/agentColorPalette.js
//
// The fixed base palette for the onboarding color step. The user picks ONE
// primary color; that single value is what we store on the agent
// (agent.primaryColor) and what drives both the avatar gradient
// (agent.avatarColors) and the dashboard accent (t.accent, sourced downstream).
//
// Storing one primary — and DERIVING the two-stop gradient from it — is the
// locked decision: it gives the future "color fusion" mechanic one clean value
// to combine, instead of an opaque hand-picked pair. The user's pick overrides
// the model's auto-derived avatarColors.
//
// Scope note: v1 ships this fixed, on-brand palette only. Earned/fused colors
// and the legibility normalization needed for arbitrary colors on the obsidian
// background are a separate, out-of-scope workstream.

// On-brand base palette (teal / violet / gold / copper / emerald / azure). The
// primaries are drawn from the approved token palette (src/theme/tokens.js).
export const AGENT_COLOR_PALETTE = [
  { id: 'teal', label: 'Teal', primary: '#5eead4' },
  { id: 'violet', label: 'Violet', primary: '#a855f7' },
  { id: 'gold', label: 'Gold', primary: '#f0c75e' },
  { id: 'copper', label: 'Copper', primary: '#e8927c' },
  { id: 'emerald', label: 'Emerald', primary: '#34d399' },
  { id: 'azure', label: 'Azure', primary: '#3b82f6' },
];

export const DEFAULT_AGENT_COLOR_ID = 'teal';
export const DEFAULT_AGENT_COLOR = '#5eead4';

const HEX_RE = /^#?([0-9a-f]{6})$/i;

function hexToHsl(hex) {
  const m = HEX_RE.exec(String(hex || '').trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hslToHex({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Derive the two-stop avatar gradient from a single primary color. The second
 * stop is a hue-rotated, slightly deeper sibling — enough contrast to read as a
 * gradient, close enough to stay clearly "the same color." Falls back to the
 * default teal pair for an unparseable input.
 *
 * @param {string} primaryHex e.g. '#5eead4'
 * @returns {[string, string]} [primary, partner]
 */
export function deriveAvatarColors(primaryHex) {
  const hsl = hexToHsl(primaryHex);
  if (!hsl) return [DEFAULT_AGENT_COLOR, deriveAvatarColors(DEFAULT_AGENT_COLOR)[1]];
  const partner = hslToHex({
    h: hsl.h + 30,
    s: clamp(hsl.s + 0.04, 0, 1),
    l: clamp(hsl.l - 0.12, 0.2, 0.85),
  });
  const primary = primaryHex.startsWith('#') ? primaryHex : `#${primaryHex}`;
  return [primary, partner];
}

/** Palette entry for an id, or the default (teal) entry. */
export const getAgentColorById = (id) =>
  AGENT_COLOR_PALETTE.find((c) => c.id === id) || AGENT_COLOR_PALETTE[0];

export default AGENT_COLOR_PALETTE;
