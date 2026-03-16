// /src/components/shared/AnimatedScore.jsx
// Score display that counts up on mount and flashes green/red on value change

import { useState, useEffect, useRef } from 'react';

export default function AnimatedScore({
  value,
  defaultColor,
  activeUp = '#5eead4',
  activeDown = '#ef4444',
  size = 44,
  suffix = '',
}) {
  const [display, setDisplay] = useState(0);
  const [flash, setFlash] = useState(null);
  const prev = useRef(null);
  const mounted = useRef(false);

  useEffect(() => {
    const target = parseFloat(value) || 0;

    if (!mounted.current) {
      // Initial mount: count up from 0
      mounted.current = true;
      prev.current = target;
      const duration = 900;
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const p = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        setDisplay(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      return;
    }

    // Subsequent changes: animate between values with flash
    const diff = target - (prev.current || 0);
    if (Math.abs(diff) < 0.01) return;

    setFlash(diff > 0 ? 'up' : 'down');
    const startVal = prev.current || 0;
    const duration = 500;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(startVal + (target - startVal) * eased);
      if (p < 1) requestAnimationFrame(tick);
      else {
        prev.current = target;
        setTimeout(() => setFlash(null), 300);
      }
    };
    requestAnimationFrame(tick);
  }, [value]);

  const c = flash === 'up' ? activeUp : flash === 'down' ? activeDown : defaultColor;
  const shadow = flash ? `0 0 16px ${c}99` : 'none';

  // Format display value: integer for points, 1 decimal for %
  const formatted = suffix === '%'
    ? `${display >= 0 ? '+' : ''}${display.toFixed(1)}`
    : `${display >= 0 ? '+' : ''}${Math.round(display)}`;

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
        transition: 'color 0.25s ease, text-shadow 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: flash ? 'scale(1.15)' : 'scale(1)',
      }}
    >
      {formatted}{suffix}
    </span>
  );
}
