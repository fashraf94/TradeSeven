// src/components/League/draft/draftTokens.js
//
// Design tokens for the League draft board — the visual source of truth is the
// Claude Design project ("Draft Board.html"). Ported verbatim from the design's
// components.jsx (TOKENS) + draft-data.jsx (the draft palette, DX), so the
// redesigned training board mirrors the design exactly. Shared by every atom in
// this directory; the ranked tournament draft reuses these later (spec §5/§7).

// Obsidian depth system + warm low-sat ink + accents.
export const TOKENS = {
  bg:      '#0D0E12',
  surface: '#15171E',
  raised:  '#1C1A27',
  hair:    'rgba(255,255,255,0.07)',   // hairline border
  hair2:   'rgba(255,255,255,0.12)',
  // text
  ink:     '#F4F5F8',
  ink2:    '#9A9DAB',
  ink3:    '#5E6170',
  // accents
  teal:    '#5EEAD4',
  gold:    '#F0C75E',
  copper:  '#E8927C',
};

// Draft-local palette (built on TOKENS): you = teal, CPU = violet, snipe = copper.
export const DX = {
  you:   '#5EEAD4',  // teal — you / your turn / your fit (brand primary)
  cpu:   '#9A8CE0',  // violet — CPU opponents
  pos:   '#5EEAD4',  // gains
  neg:   '#F2766B',  // losses — honest, never shamed
  snipe: '#E8927C',  // copper — a name taken from near the top of your board
  gold:  '#F0C75E',  // trophy / first overall
};

// hex (+ optional alpha) → rgba(). Mirrors the design's alpha().
export function alpha(hex, a) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Fit-track / fit-number color by tier (the design's fitColor).
export function fitColor(tier) {
  return tier === 'top' ? DX.you
    : tier === 'strong' ? '#7FD9C8'
    : tier === 'solid' ? TOKENS.ink2
    : TOKENS.ink3;
}

const STYLE_ID = '__league_draft_css';

// Inject the design's keyframes + base helpers once. Idempotent. Honors
// prefers-reduced-motion (the spec §4 requirement) by neutralizing animation
// and transition durations under the media query — the legacy room precedent.
export function injectDraftCSS() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes ldOrbPulse { 0%,100% { transform: scale(1); opacity: .9 } 50% { transform: scale(1.06); opacity: 1 } }
    @keyframes ldOrbSpin  { to { transform: rotate(360deg) } }
    @keyframes ldOrbSpinR { to { transform: rotate(-360deg) } }
    @keyframes ldBlink    { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
    @keyframes ldRise     { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
    @keyframes ldFadeIn   { from { opacity: 0 } to { opacity: 1 } }
    @keyframes ldLiveDot  { 0%,100% { box-shadow: 0 0 0 0 rgba(94,234,212,.5) } 50% { box-shadow: 0 0 0 6px rgba(94,234,212,0) } }
    .ld-scope * { -webkit-font-smoothing: antialiased; box-sizing: border-box; }
    .ld-scroll { scrollbar-width: none; }
    .ld-scroll::-webkit-scrollbar { width: 0; height: 0; }
    .ld-tap { cursor: pointer; transition: transform .12s ease, background .15s ease, border-color .15s ease, box-shadow .2s ease; -webkit-tap-highlight-color: transparent; }
    .ld-tap:active { transform: scale(.985); }
    @media (prefers-reduced-motion: reduce) {
      .ld-scope *, .ld-scope *::before, .ld-scope *::after {
        animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important;
      }
    }
  `;
  document.head.appendChild(s);
}

// Font stacks for the scope container's CSS vars (no external font load — system
// monospace for numerals, the app font for everything else).
export const FONT_VARS = {
  '--ld-mono': "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  '--ld-ui': "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};
