// src/hooks/useBaggerShockwave.js
// Custom hook for concurrent BaggerBomb threshold shockwaves.
// Supports multiple overlapping shockwaves (capped at maxConcurrent),
// with separate audio for positive/negative events.

import { useState, useRef, useCallback, useEffect } from 'react';
import { BAGGER_SHOCKWAVE_CONFIG, prefersReducedMotion } from '../utils/shockwaveUtils';

/**
 * useBaggerShockwave — manages concurrent shockwave overlays for the
 * BaggerBomb battle view. Each threshold crossing gets its own shockwave
 * with unique ID, color, and tier-based intensity.
 *
 * @returns {{
 *   activeShockwaves: Array<{ id: string, x: number, y: number, type: string, isPositive: boolean, tier: string }>,
 *   triggerShockwave: (opts: { x: number, y: number, type: string, isPositive: boolean, tier: string }) => void,
 * }}
 */
export function useBaggerShockwave() {
  const [activeShockwaves, setActiveShockwaves] = useState([]);

  const positiveAudioRef = useRef(null);
  const negativeAudioRef = useRef(null);
  const cleanupTimersRef = useRef(new Map());

  // Preload both audio files on mount
  useEffect(() => {
    try {
      const posAudio = new Audio(BAGGER_SHOCKWAVE_CONFIG.positiveAudioPath);
      posAudio.volume = BAGGER_SHOCKWAVE_CONFIG.audioVolume;
      posAudio.preload = 'auto';
      positiveAudioRef.current = posAudio;
    } catch { /* silent */ }

    try {
      const negAudio = new Audio(BAGGER_SHOCKWAVE_CONFIG.negativeAudioPath);
      negAudio.volume = BAGGER_SHOCKWAVE_CONFIG.audioVolume;
      negAudio.preload = 'auto';
      negativeAudioRef.current = negAudio;
    } catch { /* silent */ }

    return () => {
      cleanupTimersRef.current.forEach((timer) => clearTimeout(timer));
      cleanupTimersRef.current.clear();
    };
  }, []);

  const triggerShockwave = useCallback(({ x, y, type, isPositive, tier }) => {
    // Play audio
    try {
      const audio = isPositive ? positiveAudioRef.current : negativeAudioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } catch { /* audio failure never blocks */ }

    // Haptic
    try {
      const pattern = isPositive
        ? BAGGER_SHOCKWAVE_CONFIG.positiveHaptic
        : BAGGER_SHOCKWAVE_CONFIG.negativeHaptic;
      navigator.vibrate?.(pattern);
    } catch { /* silent */ }

    // If reduced motion: skip overlay (audio + haptic already fired)
    if (prefersReducedMotion()) return;

    const id = Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const wave = { id, x, y, type, isPositive, tier };

    setActiveShockwaves((prev) => {
      const next = [...prev, wave];
      // Cap at maxConcurrent — drop oldest
      if (next.length > BAGGER_SHOCKWAVE_CONFIG.maxConcurrent) {
        const dropped = next.shift();
        // Clear the dropped wave's cleanup timer
        if (dropped) {
          const timer = cleanupTimersRef.current.get(dropped.id);
          if (timer) {
            clearTimeout(timer);
            cleanupTimersRef.current.delete(dropped.id);
          }
        }
      }
      return next;
    });

    // Schedule removal of this specific shockwave
    const removeDelay = (BAGGER_SHOCKWAVE_CONFIG.waveDuration + 0.2) * 1000;
    const timer = setTimeout(() => {
      setActiveShockwaves((prev) => prev.filter((w) => w.id !== id));
      cleanupTimersRef.current.delete(id);
    }, removeDelay);
    cleanupTimersRef.current.set(id, timer);
  }, []);

  return { activeShockwaves, triggerShockwave };
}
