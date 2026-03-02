// src/hooks/useShockwave.js
// Custom hook encapsulating shockwave state, audio preloading, and cleanup.

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  SHOCKWAVE_CONFIG,
  prefersReducedMotion,
  calculateCardDelays,
  getMaxDelay,
} from '../utils/shockwaveUtils';

/**
 * useShockwave — manages the full shockwave lifecycle:
 *   1. Preloads audio on mount
 *   2. On trigger: calculates card delays, sets origin, plays audio
 *   3. Auto-cleans all state after animations complete
 *
 * @returns {{
 *   shockwaveOrigin: { x: number, y: number } | null,
 *   cardDelays: Map<string, number> | null,
 *   triggerShockwave: (x: number, y: number, cardRefs: Map) => void,
 * }}
 */
export function useShockwave() {
  const [shockwaveOrigin, setShockwaveOrigin] = useState(null);
  const [cardDelays, setCardDelays] = useState(null);

  const audioRef = useRef(null);
  const cleanupTimerRef = useRef(null);

  // Preload audio on mount
  useEffect(() => {
    try {
      const audio = new Audio(SHOCKWAVE_CONFIG.audioPath);
      audio.volume = SHOCKWAVE_CONFIG.audioVolume;
      audio.preload = 'auto';
      audioRef.current = audio;
    } catch {
      // Audio not available — silent fallback
    }
    return () => {
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    };
  }, []);

  const triggerShockwave = useCallback((originX, originY, cardRefs) => {
    // Play audio immediately (user-gesture context, so autoplay is allowed)
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } catch {
      // Audio failure — never block the draft action
    }

    const reducedMotion = prefersReducedMotion();

    // If reduced motion: skip overlay + card ripple (audio + haptic + recoil still fire)
    if (reducedMotion) {
      return;
    }

    // Calculate delays using requestAnimationFrame for accurate layout reads
    requestAnimationFrame(() => {
      const delays = calculateCardDelays(originX, originY, cardRefs);
      setShockwaveOrigin({ x: originX, y: originY });
      setCardDelays(delays);

      // Schedule cleanup after the longest card animation settles
      const longestDelay = getMaxDelay(delays);
      const totalDuration = (longestDelay + 0.4) * 1000; // +400ms for flinch animation

      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = setTimeout(() => {
        setShockwaveOrigin(null);
        setCardDelays(null);
      }, totalDuration);
    });
  }, []);

  return { shockwaveOrigin, cardDelays, triggerShockwave };
}
