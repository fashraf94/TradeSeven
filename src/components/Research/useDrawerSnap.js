import { useRef, useState, useCallback, useEffect } from 'react';
import { useMotionValue, animate } from 'framer-motion';

const SPRING_CONFIG = { type: 'spring', stiffness: 300, damping: 30 };

/**
 * useDrawerSnap — Gesture-driven snap behavior for a bottom pull-up drawer.
 *
 * Two snap points:
 * - mid (default): tabs visible below chart
 * - full: covers chart, maximum content space
 *
 * Coordinate system: y = how far DOWN the drawer is pushed from bottom:0.
 * y = 0 → full (fully visible), y = MID_Y → mid (partially pushed down).
 *
 * @param {number} containerHeight - Height of the parent container (px)
 * @param {boolean} isMobile - Whether the viewport is mobile-sized
 * @returns {Object} { y, snapState, snapTo, toggleDrawer, onDragStart, onDragEnd, dragConstraints }
 */
export default function useDrawerSnap(containerHeight, isMobile = false) {
  const [snapState, setSnapState] = useState('mid');
  const dragging = useRef(false);
  const prevContainer = useRef(containerHeight);

  const FULL_Y = 0;
  const MID_Y = Math.round(containerHeight * 0.9 - containerHeight * (isMobile ? 0.4 : 0.5));

  // Start at mid position
  const y = useMotionValue(MID_Y);

  const getYForState = useCallback((state) => {
    return state === 'full' ? FULL_Y : MID_Y;
  }, [MID_Y]);

  // Re-snap when container resizes (e.g. ResizeObserver updates real height)
  useEffect(() => {
    if (prevContainer.current !== containerHeight) {
      prevContainer.current = containerHeight;
      y.set(getYForState(snapState));
    }
  }, [containerHeight, getYForState, snapState, y]);

  const snapTo = useCallback((state) => {
    animate(y, getYForState(state), SPRING_CONFIG);
    setSnapState(state);
  }, [y, getYForState]);

  const onDragStart = useCallback(() => {
    dragging.current = true;
  }, []);

  const onDragEnd = useCallback((_event, info) => {
    dragging.current = false;
    const currentY = y.get();
    const velocity = info.velocity.y;

    // Fast flick up OR past midpoint → full
    if (velocity < -500 || currentY < MID_Y / 2) {
      snapTo('full');
    } else {
      snapTo('mid');
    }
  }, [y, MID_Y, snapTo]);

  const toggleDrawer = useCallback(() => {
    snapTo(snapState === 'mid' ? 'full' : 'mid');
  }, [snapState, snapTo]);

  return {
    y,
    snapState,
    snapTo,
    onDragStart,
    onDragEnd,
    toggleDrawer,
    dragConstraints: {
      top: FULL_Y,
      bottom: MID_Y,
    },
  };
}
