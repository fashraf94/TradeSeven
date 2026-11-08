// src/components/Research/BombMode/useMeasuredWidth.js
// The drawn width of a box (ResizeObserver), so the SVG views lay out in real
// pixels at 320–430 px instead of scaling their text with a viewBox.
import { useEffect, useRef, useState } from 'react';

export default function useMeasuredWidth(fallback = 360) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => { const w = Math.round(el.getBoundingClientRect().width || el.clientWidth || 0); if (w > 0) setWidth(w); };
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
