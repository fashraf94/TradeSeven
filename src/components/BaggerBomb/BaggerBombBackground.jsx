// BaggerBombBackground - Command Center animated background for BaggerBomb battle views
// 3-layer system: base color (parent), CSS glow orbs, canvas particle network
//
// Defaults reproduce the original PvP-view look EXACTLY (cyan/purple, 55/25
// particles, cyan links, always-on). Optional props let another surface
// (AgentBattleScreen Matchups) recolor / re-density it and opt into
// prefers-reduced-motion. The PvP view passes no props, so it is byte-identical.

import React, { useRef, useEffect, useCallback } from 'react';
import { useReducedMotion } from 'framer-motion';

const CONNECTION_DISTANCE = 150;
const CONNECTION_MAX_OPACITY = 0.2;
const CONNECTION_LINE_WIDTH = 0.75;
const RESIZE_DEBOUNCE_MS = 200;
const MAX_DPR = 2;
const HUB_CHANCE = 0.15;

const CYAN = { r: 0, g: 217, b: 255 };
const PURPLE = { r: 147, g: 51, b: 234 };

// Stable default references (so a caller that passes nothing never triggers the
// particle-recreation effect on re-render).
const DEFAULT_COLORS = [CYAN, PURPLE];
const DEFAULT_LINE = CYAN;
const DEFAULT_DENSITY = { desktop: 55, mobile: 25 };
const DEFAULT_SPEED = { min: 0.15, max: 0.35 };
const DEFAULT_GLOW = [
  'radial-gradient(ellipse 800px 800px at 25% 20%, rgba(0, 217, 255, 0.18), transparent 70%)',
  'radial-gradient(ellipse 700px 700px at 75% 15%, rgba(147, 51, 234, 0.14), transparent 70%)',
];

function createParticles(width, height, { colors, primaryRatio, density, speed }) {
  const count = width >= 768 ? density.desktop : density.mobile;
  const particles = [];

  for (let i = 0; i < count; i++) {
    const isPrimary = Math.random() < primaryRatio;
    const color = isPrimary ? colors[0] : colors[1];
    const isHub = Math.random() < HUB_CHANCE;
    const opacity = isHub
      ? 0.6 + Math.random() * 0.2   // hub: 0.6 - 0.8
      : 0.35 + Math.random() * 0.30; // normal: 0.35 - 0.65
    const radius = isHub
      ? 5 + Math.random() * 2        // hub: 5 - 7px
      : 1.5 + Math.random() * 2.5;   // normal: 1.5 - 4px
    const spd = speed.min + Math.random() * (speed.max - speed.min);
    const angle = Math.random() * Math.PI * 2;

    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      radius,
      color,
      opacity,
    });
  }

  return particles;
}

const BaggerBombBackground = ({
  colors = DEFAULT_COLORS,
  primaryRatio = 0.6,
  lineColor = DEFAULT_LINE,
  glowColors = DEFAULT_GLOW,
  density = DEFAULT_DENSITY,
  speed = DEFAULT_SPEED,
  // Opt-in: default false keeps the PvP view's existing always-animate behavior.
  honorReducedMotion = false,
} = {}) => {
  const prefersReduced = useReducedMotion();
  const reduce = honorReducedMotion && prefersReduced;

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const particlesRef = useRef([]);
  const resizeTimerRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  // Latest style opts in refs so the once-mounted rAF loop reads fresh values
  // without re-subscribing (avoids stale closures + particle recreation).
  const lineColorRef = useRef(lineColor);
  lineColorRef.current = lineColor;
  const optsRef = useRef({ colors, primaryRatio, density, speed });
  optsRef.current = { colors, primaryRatio, density, speed };

  const applyCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Skip if dimensions haven't actually changed (mobile scroll address bar)
    if (width === sizeRef.current.w && height === sizeRef.current.h) return;
    sizeRef.current = { w: width, h: height };

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    // Reset transform before applying scale (prevents compounding)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  // Draw the current frame (lines behind particles). No position update, no
  // rAF reschedule — reused for both the animated loop and the static frame.
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { w: width, h: height } = sizeRef.current;
    const particles = particlesRef.current;

    ctx.clearRect(0, 0, width, height);

    // Connection lines FIRST (behind particles)
    const lc = lineColorRef.current;
    ctx.lineWidth = CONNECTION_LINE_WIDTH;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONNECTION_DISTANCE) {
          const opacity = CONNECTION_MAX_OPACITY * (1 - dist / CONNECTION_DISTANCE);
          ctx.strokeStyle = `rgba(${lc.r}, ${lc.g}, ${lc.b}, ${opacity})`;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Particles on top
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity})`;
      ctx.fill();
    }
  }, []);

  const animate = useCallback(() => {
    const { w: width, h: height } = sizeRef.current;
    const particles = particlesRef.current;

    // Update positions with edge wrapping
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x > width) p.x = 0;
      else if (p.x < 0) p.x = width;
      if (p.y > height) p.y = 0;
      else if (p.y < 0) p.y = height;
    }

    draw();
    rafRef.current = requestAnimationFrame(animate);
  }, [draw]);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    sizeRef.current = { w: width, h: height };

    // Init canvas dimensions + DPR scale
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Create particles once
    particlesRef.current = createParticles(width, height, optsRef.current);

    if (reduce) {
      // prefers-reduced-motion: paint ONE static frame, never start the loop.
      draw();
    } else {
      rafRef.current = requestAnimationFrame(animate);
    }

    // Resize only updates canvas dimensions, never recreates particles.
    // Repaint the static frame after a reduced-motion resize.
    const handleResize = () => {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        applyCanvasSize();
        if (reduce) draw();
      }, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener('resize', handleResize);

    // Pause the loop while the tab is backgrounded (no-op under reduced motion).
    const handleVisibility = () => {
      if (reduce) return;
      cancelAnimationFrame(rafRef.current);
      if (!document.hidden) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(resizeTimerRef.current);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [animate, applyCanvasSize, draw, reduce]);

  return (
    <>
      {/* Layer 2: CSS Ambient Glow Orbs */}
      <div style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        backgroundImage: glowColors.join(', '),
      }} />

      {/* Layer 3: Canvas Particle Network */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
    </>
  );
};

export default BaggerBombBackground;
