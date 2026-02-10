import { useRef, useState, useCallback } from 'react';
import { useMotionValue, animate } from 'framer-motion';

/**
 * useDrawerSnap — Gesture-driven snap behavior for a bottom pull-up drawer.
 *
 * Three snap points (measured as drawer height from bottom):
 * - collapsed: 80px visible
 * - mid: 50% of container height
 * - full: 90% of container height
 *
 * @param {number} containerHeight - Height of the parent container (px)
 * @returns {Object} { y, snapState, snapTo, onDragStart, onDragEnd, drawerHeight }
 */
export default function useDrawerSnap(containerHeight) {
  const [snapState, setSnapState] = useState('collapsed'); // 'collapsed' | 'mid' | 'full'
  const dragging = useRef(false);

  const COLLAPSED = 80;
  const MID = Math.round(containerHeight * 0.5);
  const FULL = Math.round(containerHeight * 0.9);

  // y = 0 means collapsed, y goes negative as drawer rises
  // Drawer height = COLLAPSED - y (where y <= 0)
  // So: collapsed → y=0, mid → y=-(MID-COLLAPSED), full → y=-(FULL-COLLAPSED)
  const y = useMotionValue(0);

  const getYForState = useCallback((state) => {
    switch (state) {
      case 'collapsed': return 0;
      case 'mid': return -(MID - COLLAPSED);
      case 'full': return -(FULL - COLLAPSED);
      default: return 0;
    }
  }, [MID, FULL]);

  const getStateForY = useCallback((yVal) => {
    const midY = -(MID - COLLAPSED);
    const fullY = -(FULL - COLLAPSED);
    const distCollapsed = Math.abs(yVal);
    const distMid = Math.abs(yVal - midY);
    const distFull = Math.abs(yVal - fullY);

    if (distCollapsed <= distMid && distCollapsed <= distFull) return 'collapsed';
    if (distMid <= distFull) return 'mid';
    return 'full';
  }, [MID, FULL]);

  const snapTo = useCallback((state) => {
    const targetY = getYForState(state);
    animate(y, targetY, {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    });
    setSnapState(state);
  }, [y, getYForState]);

  const onDragStart = useCallback(() => {
    dragging.current = true;
  }, []);

  const onDragEnd = useCallback((_event, info) => {
    dragging.current = false;
    const currentY = y.get();
    const velocity = info.velocity.y;

    const VELOCITY_THRESHOLD = 500;

    let targetState;
    if (velocity < -VELOCITY_THRESHOLD) {
      // Fast flick up → go to next higher state
      if (snapState === 'collapsed') targetState = 'mid';
      else if (snapState === 'mid') targetState = 'full';
      else targetState = 'full';
    } else if (velocity > VELOCITY_THRESHOLD) {
      // Fast flick down → go to next lower state
      if (snapState === 'full') targetState = 'mid';
      else if (snapState === 'mid') targetState = 'collapsed';
      else targetState = 'collapsed';
    } else {
      // Low velocity → snap to nearest
      targetState = getStateForY(currentY);
    }

    snapTo(targetState);
  }, [y, snapState, getStateForY, snapTo]);

  const cycleState = useCallback(() => {
    if (snapState === 'collapsed') snapTo('mid');
    else if (snapState === 'mid') snapTo('full');
    else snapTo('collapsed');
  }, [snapState, snapTo]);

  // Current drawer height for layout
  const drawerHeight = snapState === 'collapsed' ? COLLAPSED
    : snapState === 'mid' ? MID
    : FULL;

  return {
    y,
    snapState,
    snapTo,
    onDragStart,
    onDragEnd,
    cycleState,
    drawerHeight,
    dragConstraints: {
      top: -(FULL - COLLAPSED),
      bottom: 0,
    },
  };
}
