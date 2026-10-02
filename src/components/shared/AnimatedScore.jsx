// /src/components/shared/AnimatedScore.jsx
// Score display that counts up on mount and flashes green/red on value change

import { useState, useEffect, useRef } from 'react';

/**
 * Round for DISPLAY only, normalizing a rounded negative zero to +0 — in
 * JavaScript `(-0.001).toFixed(2)` is "-0.00", which no score should read.
 */
function roundForDisplay(value, digits) {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return rounded === 0 ? 0 : rounded;
}

/**
 * The counter's text for a value — the ONE formatter, exported so any label
 * that states a score can be derived from exactly what the digits show
 * (BUILD_RULES §9; Shadow vs CPU quote integrity C-1 item 5, B-3+).
 *
 * `fractionDigits` ABSENT is the shipped format, byte for byte: whole numbers
 * with `+` for ≥ 0 (so a small negative reads `0`, never `-0`), and the
 * dashboard's `suffix="%"` one-decimal form. SET, the value is rounded to that
 * many digits with negative zero normalized (`+0.00`, never `-0.00`).
 */
export function formatScoreDisplay(display, { suffix = '', fractionDigits } = {}) {
  if (fractionDigits === undefined || fractionDigits === null) {
    return suffix === '%'
      ? `${display >= 0 ? '+' : ''}${display.toFixed(1)}`
      : `${display >= 0 ? '+' : ''}${Math.round(display)}`;
  }
  const rounded = roundForDisplay(display, fractionDigits);
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(fractionDigits)}`;
}

export default function AnimatedScore({
  value,
  defaultColor,
  activeUp = '#5eead4',
  activeDown = '#ef4444',
  size = 44,
  suffix = '',
  // Shadow vs CPU quote integrity (V-1). `instant` set: THIS render shows the
  // target from the `value` prop — no count-up, no ramp, no flash, no CSS fade —
  // and its effect stops every in-flight ramp and timer. Absent: unchanged.
  instant = false,
  // C-1 item 5: digits after the point for stored/final pairs. Absent:
  // today's formatting, threshold and ramps exactly.
  fractionDigits,
}) {
  const [display, setDisplay] = useState(0);
  const [flash, setFlash] = useState(null);
  const prev = useRef(null);
  const mounted = useRef(false);
  const flashTimer = useRef(null);
  const rafId = useRef(null);
  // V-1: the ramp generation. Every ramp captures it and checks it at the top
  // of each tick; an instant switch advances it, so an OLDER overlapping ramp —
  // one the single rafId no longer names — stops at its next frame too. Only an
  // instant switch ever advances it, so with `instant` absent the check always
  // passes and the shipped behaviour (overlap included) is untouched.
  const rampGen = useRef(0);

  // F1: the component's two async channels both outlived it.
  //
  //   The flash-clear timer: unmounting inside its 300 ms window left it armed
  //   to call setFlash on unmounted state.
  //
  //   The rAF ramp: never cancelled, so unmounting MID-ramp left the loop
  //   ticking on a dead component until it reached p === 1, whereupon it armed
  //   a FRESH flash-clear *after* this cleanup had already run. Cancelling the
  //   timer alone therefore did not close the leak — hence both, here, together.
  //
  // BOTH ramps assign rafId on EVERY schedule, the in-loop re-schedules
  // included, not just where each loop is kicked off. A loop that only recorded
  // its first frame would leave this ref holding an id that has already fired,
  // and the cancel below would be a silent no-op from frame two onward.
  //
  // Empty deps ON PURPOSE, so this cleanup runs only on UNMOUNT. Hanging it on
  // the [value] effect instead would also cancel a pending clear on every value
  // change, and the sub-0.01 early-return path below arms no replacement — that
  // would strand an on-screen flash lit until the next material change.
  useEffect(() => () => {
    clearTimeout(flashTimer.current);
    cancelAnimationFrame(rafId.current);
  }, []);

  useEffect(() => {
    // An instant render's own effect (below) owns this commit: no count-up and
    // no ramp may start from it. `instant` and `fractionDigits` are constant
    // for every shipped caller, so the deps below re-run nothing for them.
    if (instant) return;
    const target = parseFloat(value) || 0;
    const gen = rampGen.current;

    if (!mounted.current) {
      // Initial mount: count up from 0
      mounted.current = true;
      prev.current = target;
      const duration = 900;
      const start = Date.now();
      const tick = () => {
        if (gen !== rampGen.current) return;
        const elapsed = Date.now() - start;
        const p = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        setDisplay(target * eased);
        if (p < 1) rafId.current = requestAnimationFrame(tick);
      };
      rafId.current = requestAnimationFrame(tick);
      return;
    }

    // Subsequent changes: animate between values with flash
    const diff = target - (prev.current || 0);
    // C-1 (b): with `fractionDigits` the "ignore tiny change" test compares the
    // DISPLAYED digits — in floating point 0.03 − 0.02 = 0.00999…, which the raw
    // test would discard, leaving 0.02 on screen while 0.03 is selected.
    const unchanged = fractionDigits === undefined || fractionDigits === null
      ? Math.abs(diff) < 0.01
      : roundForDisplay(target, fractionDigits) === roundForDisplay(prev.current || 0, fractionDigits);
    if (unchanged) return;

    setFlash(diff > 0 ? 'up' : 'down');
    const startVal = prev.current || 0;
    const duration = 500;
    const start = Date.now();
    const tick = () => {
      if (gen !== rampGen.current) return;
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      // C-1 (c): a two-decimal ramp ends EXACTLY on its target.
      setDisplay(fractionDigits !== undefined && fractionDigits !== null && p >= 1
        ? target
        : startVal + (target - startVal) * eased);
      if (p < 1) rafId.current = requestAnimationFrame(tick);
      else {
        prev.current = target;
        flashTimer.current = setTimeout(() => setFlash(null), 300);
      }
    };
    rafId.current = requestAnimationFrame(tick);
  }, [value, instant, fractionDigits]);

  // V-1 item 2 — the instant switch's effect, in the SAME commit as the render
  // that showed the target. It depends on `instant` as well as `value`: a switch
  // to a numerically identical value (browser 10 → stored 10.00, B-11) must
  // still stop the old ramp and flash, or they would keep writing after it.
  useEffect(() => {
    if (!instant) return;
    const target = parseFloat(value) || 0;
    rampGen.current += 1;
    cancelAnimationFrame(rafId.current);
    clearTimeout(flashTimer.current);
    setFlash(null);
    prev.current = target;
    mounted.current = true;
    setDisplay(target);
  }, [instant, value]);

  // V-1 item 1: an instant render formats from the `value` prop and shows no
  // flash colour, glow, scale or CSS transition, so a flash lit before the
  // switch cannot visibly fade under the new label.
  const shown = instant ? (parseFloat(value) || 0) : display;
  const lit = instant ? null : flash;
  const c = lit === 'up' ? activeUp : lit === 'down' ? activeDown : defaultColor;
  const shadow = lit ? `0 0 16px ${c}99` : 'none';

  // Format display value: integer for points, 1 decimal for %
  const formatted = formatScoreDisplay(shown, { suffix, fractionDigits });

  return (
    <span
      style={{
        fontSize: size,
        fontWeight: 700,
        color: c,
        letterSpacing: '-0.06em',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        display: 'inline-block',
        textShadow: shadow,
        transition: instant ? 'none' : 'color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: lit ? 'scale(1.15)' : 'scale(1)',
      }}
    >
      {formatted}{suffix}
    </span>
  );
}
