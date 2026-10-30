// src/components/AgentForm/engine/vocab.js
//
// The agent engine's vocabulary, ported from the design's af3-core.js
// (docs/design/agent-identity-v2/af3-standalone.js.txt:11-44, :380): states,
// growth tables, the form names and stills, the seeded random, the hash, the
// fit stagger and the still time. Pure: no three.js, no DOM, no clock, so the
// wrapper and Node tests read it without loading the engine. Palette COLOURS
// are not here: they come from tokens (src/theme/tokens.css) and arrive as an
// argument (agentFormTokens.js).

export const TAU = Math.PI * 2;

// Mood vocabulary (round 1). speed · coh(erence) · bright · lean(+fwd/−back) · spread · signals · bloom · beacon · open(+part/−tighten) · lift · scan
export const STATES = Object.freeze({
  idle:        Object.freeze({ speed: 1,    coh: 1,    bright: 1,    lean: 0,   spread: 1,    signals: 1,  bloom: 1, beacon: 0, open: 0,   lift: 0, scan: 0 }),
  researching: Object.freeze({ speed: 1.5,  coh: 1,    bright: 1.1,  lean: .1,  spread: 1.04, signals: 4,  bloom: 1, beacon: 0, open: .15, lift: 0, scan: 1 }),
  confident:   Object.freeze({ speed: 1.35, coh: 1.25, bright: 1.25, lean: 1,   spread: .9,   signals: 2,  bloom: 2, beacon: 0, open: .4,  lift: 0, scan: 0 }),
  worried:     Object.freeze({ speed: .65,  coh: .4,   bright: .68,  lean: -1,  spread: 1.22, signals: .5, bloom: 0, beacon: 0, open: -1,  lift: 0, scan: 0 }),
  waiting:     Object.freeze({ speed: .3,   coh: 1,    bright: .9,   lean: .3,  spread: .96,  signals: 0,  bloom: 0, beacon: 1, open: 0,   lift: 0, scan: 0 }),
  celebrating: Object.freeze({ speed: 1.6,  coh: 1,    bright: 1.4,  lean: .6,  spread: 1.18, signals: 3,  bloom: 4, beacon: 0, open: 1,   lift: 1, scan: 0 }),
});
export const MOODS = Object.freeze(Object.keys(STATES));

// Core grows with the partnership (shared by every set); armor grows with battles in that style.
export const CORE = Object.freeze([{ loops: 5, R: .5, core: .1, glow: 1, light: 1 }, { loops: 7, R: .56, core: .115, glow: 1.3, light: 1.9 }, { loops: 9, R: .62, core: .13, glow: 1.6, light: 3 }].map(Object.freeze));
export const ARMOR = Object.freeze([{ edge: .85, etch: 0, rim: .8, more: 0 }, { edge: 1, etch: 1, rim: 1.05, more: 1 }, { edge: 1.2, etch: 2, rim: 1.35, more: 2 }].map(Object.freeze));
export const KINDS = Object.freeze(['trend', 'contra', 'spec', 'preserve', 'divers', 'fund']);
/** Every form the engine draws, in its fixed build order (bare Shadow first). */
export const FORM_ORDER = Object.freeze(['none', ...KINDS]);
export const META = Object.freeze({
  none:     Object.freeze({ name: 'Shadow', desc: 'The brain: luminous threads around a white-hot core.', motion: 'Three families of tilted loops swing out on their own axes and return to a tight centre; the core breathes.', still: 7.3 }),
  trend:    Object.freeze({ name: 'Trend Follower', desc: 'Goes where the momentum is and leaves when it fades.', motion: 'Hull plates hold still while threads stream out of the rear vents; the fins sweep further back as it leans in.', still: 7.7 }),
  contra:   Object.freeze({ name: 'Contrarian', desc: 'Buys what everyone else is giving up on.', motion: 'The outer gimbal tumbles one way, the inner one turns the other; light spirals inward through the cage against the spin.', still: 4.1 }),
  spec:     Object.freeze({ name: 'Speculator', desc: 'Chases the biggest swings and wears the risk.', motion: 'Shards hover and twitch around the bare core; arcs re-strike between jagged edges every half second.', still: 3.3 }),
  preserve: Object.freeze({ name: 'Capital Preserver', desc: 'Protects the downside first.', motion: 'Overlapping shields breathe on a slow pulse; under stress the rows close rank and the seams go dark.', still: 5 }),
  divers:   Object.freeze({ name: 'Diversifier', desc: 'Spreads bets so no single one can sink you.', motion: 'Pods orbit in balanced formation, each spinning on its own axis; signals run the tethers back to the core.', still: 2.7 }),
  fund:     Object.freeze({ name: 'Fundamental Investor', desc: 'Buys quality and lets fundamentals work.', motion: 'Facets lock in sequence and then barely move; a slow turn lets the seams catch the core’s light.', still: 8.4 }),
});
/**
 * Each form's framing scale: bare Shadow draws larger than any set (af3-standalone.js.txt:345, :359, and each
 * builder's `frame`). One table, so a swap between forms can tween from one scale to the next (build S1, ruling R5).
 * Two frames are this app's own, not the design's (build S2, ruling R18), because the design's cut those sets off at
 * the box's edge at every size: the Diversifier's pods when it celebrates (.95 → .9), and the Trend Follower's rear
 * streams in five moods of six (.74 → .65, with FRAME_SHIFT). Measured over every mood and the whole motion range.
 */
export const FRAME_SCALE = Object.freeze({ none: 1.25, trend: .65, contra: .95, spec: .9, preserve: .95, divers: .9, fund: .95 });
/** The framing scale of a form kind; anything unknown is bare Shadow's. */
export const frameScale = (kind) => (Object.hasOwn(FRAME_SCALE, kind) ? FRAME_SCALE[kind] : FRAME_SCALE.none);
/**
 * How far a form's frame moves it right of the box's centre, in world units along the camera's right (ruling R18). The
 * Trend Follower alone is lopsided, its streams reaching about 1.7 times as far as its nose, so it is framed around its
 * own extent: scale alone would have cost it 28 % of its size, and this costs 12 %.
 */
export const FRAME_SHIFT = Object.freeze({ trend: .27 });
/** The frame's shift of a form kind; 0 for every form but the Trend Follower. */
export const frameShift = (kind) => (Object.hasOwn(FRAME_SHIFT, kind) ? FRAME_SHIFT[kind] : 0);

/** The four palettes the engine knows; their colours come from tokens. */
export const PALETTES = Object.freeze(['teal', 'copper', 'mono', 'unlit']);

export function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function hash(a, b, c) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2246822519)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; h = (h ^ (h >>> 16)) >>> 0; return (h / 4294967296) * 2 - 1; }
export const lo = S => 1 - Math.min(1, S.coh);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const fitK = (fit, order, st = .6) => clamp(fit * (1 + st) - order * st, 0, 1);

/** The designed still: a per-form moment plus stage, seed and celebration offsets (af3-standalone.js.txt:380). */
export const stillT = spec => ((META[spec.kind] || META.none).still || 5) + (spec.core | 0) * .7 + (spec.armor | 0) * .4 + (spec.seed | 0) * .31 + (spec.state === 'celebrating' ? .6 : 0);
/** A view's time offset, so views of one form do not move in lockstep (af3-standalone.js.txt:393). */
export const viewT0 = spec => ((spec.seed | 0) * 1.37 + (spec.core | 0) * 2.1 + (spec.armor | 0) * .9) % 10;

// ── the equip tween (board 2, agent-boards-v2.jsx.txt:74-87) ──
// The board's five keys per direction, [ms, fit]. Fit runs piecewise-linearly through them; the per-plate
// curves (the stagger, the cubic ease-out, scale from 40 %, edge light on the square; unequip's power curve)
// stay in applyFit/fitK, exactly as the engine draws a given fit.
export const EQUIP_KEYS = Object.freeze([[0, 0], [220, .28], [450, .55], [700, .8], [900, 1]].map(Object.freeze));
export const UNEQUIP_KEYS = Object.freeze([[0, 1], [180, .72], [350, .45], [550, .18], [700, 0]].map(Object.freeze));
export const EQUIP_MS = 900;
export const UNEQUIP_MS = 700;

/** Fit at `ms` into a tween on `keys` (piecewise-linear; clamped at both ends). */
export function fitAtMs(keys, ms) {
  if (!(ms > 0)) return keys[0][1];
  for (let i = 1; i < keys.length; i += 1) {
    const [m1, f1] = keys[i];
    if (ms <= m1) { const [m0, f0] = keys[i - 1]; return f0 + (f1 - f0) * ((ms - m0) / (m1 - m0)); }
  }
  return keys[keys.length - 1][1];
}

/** The ms on `keys` where the tween's fit equals `fit` — so a reversal mid-tween continues from where the plates are. */
export function msAtFit(keys, fit) {
  const f = clamp(fit, 0, 1), rising = keys[keys.length - 1][1] > keys[0][1];
  for (let i = 1; i < keys.length; i += 1) {
    const [m0, f0] = keys[i - 1], [m1, f1] = keys[i];
    if (rising ? f <= f1 : f >= f1) return f1 === f0 ? m0 : m0 + (m1 - m0) * ((f - f0) / (f1 - f0));
  }
  return keys[keys.length - 1][0];
}

/**
 * A tween as data: `{ on, start }`, `start` the clock reading (ms) at which the board's timeline would have
 * begun. Starting from the current fit (a reversal mid-tween) back-dates `start`, so the plates never jump.
 */
export function startTween(on, nowMs, currentFit) {
  const keys = on ? EQUIP_KEYS : UNEQUIP_KEYS;
  return { on: !!on, start: nowMs - msAtFit(keys, currentFit), heldAt: null };
}

/** The tween's fit and whether it has finished, at clock reading `nowMs`. */
export function tweenFit(tween, nowMs) {
  const keys = tween.on ? EQUIP_KEYS : UNEQUIP_KEYS, ms = nowMs - tween.start;
  return { fit: fitAtMs(keys, ms), done: ms >= keys[keys.length - 1][0] };
}

// ── the swap's size step (build S1, ruling R5) ──
// Bare Shadow draws at 1.25 and the sets at .74–.95 (FRAME_SCALE), so a change of form would jump size at its first
// frame. During a swap the form's scale runs from the scale it was drawn at (`from`) to the new form's (`to`), as a
// pure function of the tween's fit: the share of the travel the plates have made since the tween began (`fit0`).
// Fit at the end of the tween gives exactly `to`, so a settled form draws at its own frame, as before. A frame's shift
// (ruling R18) travels the same way, so a change to or from the Trend Follower does not jump sideways either.

/** How far a swap's tween has travelled, 0 → 1, at fit `fit` (`on` the tween's direction, `fit0` its starting fit). */
export function swapProgress(on, fit0, fit) {
  const span = on ? 1 - fit0 : fit0;
  if (!(span > 0)) return 1;
  return clamp(on ? (fit - fit0) / span : (fit0 - fit) / span, 0, 1);
}

/** The scale a swapping form draws at: `from` → `to` with the tween's progress. */
export function swapScale(step, fit) {
  return step.from + (step.to - step.from) * swapProgress(step.on, step.fit0, fit);
}

/** The shift a swapping form draws at: `shiftFrom` → `shiftTo` with the tween's progress. */
export function swapShift(step, fit) {
  return step.shiftFrom + (step.shiftTo - step.shiftFrom) * swapProgress(step.on, step.fit0, fit);
}

// ── the response (build S2, ruling R19): the hub's two triggers brighten the form as they bloom today's Shadow ──
// The timing is S7's, held equal to the hub's by a row (the engine imports nothing from the hub): the bloom's 1.2 s and
// its sin(π p) curve on the form's own clock, and the reduced-motion flash's 420 ms at a steady ×1.25.

/** The response's length (hub/shadowCanvas.js BLOOM_SECONDS), in ms. */
export const RESPONSE_MS = 1200;
/** How much brighter the response's peak draws the part it lights. */
export const RESPONSE_PEAK = .7;
/** The reduced-motion flash's length (ShadowCanvas.jsx FLASH_MS) and its lift (ShadowStill.jsx). */
export const RESPONSE_FLASH_MS = 420;
export const RESPONSE_FLASH_LIFT = 1.25;
/** Which part of a form a response lights. */
export const RESPONSE_PARTS = Object.freeze(['armor', 'core', 'all']);

/** The light a response adds `ms` into it: 1 at both ends, 1 + RESPONSE_PEAK half way. */
export function responseLift(ms) {
  return 1 + RESPONSE_PEAK * Math.sin(Math.PI * clamp(ms / RESPONSE_MS, 0, 1));
}
