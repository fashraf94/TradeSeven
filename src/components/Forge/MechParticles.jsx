/**
 * MechParticles — Ambient canvas particle system behind the mech SVG.
 *
 * Three DNA-themed particle types:
 *   Rain (Instincts/teal)   — dots flowing upward with sinusoidal drift
 *   Grid (Strategy/amber)   — pulsing nodes connected by thin lines
 *   Embers (Discipline/red) — falling circles that shrink and fade
 *
 * Desktop only. Disabled in standby mode (no traits equipped).
 */

import React, { useRef, useEffect, useMemo } from 'react';

const MAX_PARTICLES = 30;
const TAU = Math.PI * 2;

// ── Particle configs ────────────────────────────

const COLORS = {
  rain:   { r: 94, g: 234, b: 212 },  // #5EEAD4
  grid:   { r: 245, g: 158, b: 11 },   // #F59E0B
  embers: { r: 239, g: 68, b: 68 },    // #EF4444
};

function rgba(c, a) {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

// ── Spawn helpers ───────────────────────────────

function spawnRain(w, h) {
  return {
    kind: 'rain',
    x: Math.random() * w,
    y: h + Math.random() * 20,
    size: 1 + Math.random() * 2,
    speed: 40 + Math.random() * 40,
    phase: Math.random() * TAU,
    opacity: 0,
    targetOpacity: 0.15 + Math.random() * 0.15,
    fadeIn: true,
    fadeOut: false,
  };
}

function spawnGrid(idx, count, w, h) {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  const cellW = w / (cols + 1);
  const cellH = h / (rows + 1);
  return {
    kind: 'grid',
    x: cellW * (col + 1) + (Math.random() - 0.5) * 30,
    y: cellH * (row + 1) + (Math.random() - 0.5) * 30,
    baseSize: 2 + Math.random(),
    size: 2,
    phase: Math.random() * TAU,
    opacity: 0,
    targetOpacity: 0.2 + Math.random() * 0.1,
    fadeIn: true,
    fadeOut: false,
  };
}

function spawnEmber(w, h) {
  const baseSize = 2 + Math.random() * 2;
  return {
    kind: 'embers',
    x: Math.random() * w,
    y: -(Math.random() * h * 0.2),
    size: baseSize,
    baseSize,
    speed: 20 + Math.random() * 30,
    wobblePhase: Math.random() * TAU,
    opacity: 0,
    targetOpacity: 0.15 + Math.random() * 0.1,
    fadeIn: true,
    fadeOut: false,
  };
}

// ── Update helpers ──────────────────────────────

function updateRain(p, dt, time, w, h) {
  p.y -= p.speed * dt;
  p.x += Math.sin(time * 2 + p.phase) * 0.5;
  if (p.y < -10) {
    p.y = h + 10;
    p.x = Math.random() * w;
  }
}

function updateGrid(p, dt, time) {
  p.size = p.baseSize + Math.sin(time * 1.5 + p.phase) * 0.8;
}

function updateEmber(p, dt, time, w, h) {
  p.y += p.speed * dt;
  p.x += Math.sin(time * 1.2 + p.wobblePhase) * 0.4;
  p.size -= 0.3 * dt;
  if (p.size <= 0.5 || p.y > h + 10) {
    // Respawn
    p.x = Math.random() * w;
    p.y = -(Math.random() * h * 0.2);
    p.size = p.baseSize;
    p.opacity = p.targetOpacity;
  }
}

function updateFade(p, dt) {
  if (p.fadeIn) {
    p.opacity = Math.min(p.opacity + 2.0 * dt, p.targetOpacity);
    if (p.opacity >= p.targetOpacity) p.fadeIn = false;
  }
  if (p.fadeOut) {
    p.opacity = Math.max(p.opacity - 2.0 * dt, 0);
  }
}

// ── Draw helpers ────────────────────────────────

function drawParticle(ctx, p) {
  if (p.opacity <= 0) return;
  const c = COLORS[p.kind];
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(p.size, 0.5), 0, TAU);
  ctx.fillStyle = rgba(c, p.opacity);
  ctx.fill();
}

function drawGridConnections(ctx, gridParticles) {
  const maxDist = 60;
  const maxDistSq = maxDist * maxDist;
  const c = COLORS.grid;
  ctx.lineWidth = 0.5;

  for (let i = 0; i < gridParticles.length; i++) {
    const a = gridParticles[i];
    if (a.opacity <= 0) continue;
    for (let j = i + 1; j < gridParticles.length; j++) {
      const b = gridParticles[j];
      if (b.opacity <= 0) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < maxDistSq) {
        const alpha = Math.min(a.opacity, b.opacity) * 0.3 * (1 - distSq / maxDistSq);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = rgba(c, alpha);
        ctx.stroke();
      }
    }
  }
}

// ── Component ───────────────────────────────────

export default function MechParticles({ slotUsage, mechMode }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const sizeRef = useRef({ w: 0, h: 0 });
  const prevAllocRef = useRef(null);

  // Compute allocation from slot usage
  const allocation = useMemo(() => {
    const inst = slotUsage?.instincts?.used || 0;
    const strat = slotUsage?.strategy?.used || 0;
    const disc = slotUsage?.discipline?.used || 0;
    const total = inst + strat + disc;
    if (total === 0 || mechMode === 'standby') {
      return { rain: 0, grid: 0, embers: 0 };
    }
    const rain = Math.round((inst / total) * MAX_PARTICLES);
    const grid = Math.round((strat / total) * MAX_PARTICLES);
    const embers = Math.max(0, MAX_PARTICLES - rain - grid);
    return { rain, grid, embers };
  }, [slotUsage, mechMode]);

  // ResizeObserver for canvas sizing
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: width, h: height };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Spawn/despawn particles on allocation change
  useEffect(() => {
    const prev = prevAllocRef.current;
    const { w, h } = sizeRef.current;
    const safeW = w || 280;
    const safeH = h || 392;

    // Mark existing particles for fade-out if their type count decreased
    if (prev) {
      const existing = particlesRef.current;
      for (const kind of ['rain', 'grid', 'embers']) {
        if (allocation[kind] < (prev[kind] || 0)) {
          const kindParticles = existing.filter(p => p.kind === kind && !p.fadeOut);
          const toRemove = kindParticles.length - allocation[kind];
          for (let i = 0; i < toRemove && i < kindParticles.length; i++) {
            kindParticles[i].fadeOut = true;
            kindParticles[i].fadeIn = false;
          }
        }
      }
    }

    // Spawn new particles if type count increased
    const existing = particlesRef.current.filter(p => !p.fadeOut);
    for (const kind of ['rain', 'grid', 'embers']) {
      const currentCount = existing.filter(p => p.kind === kind).length;
      const needed = allocation[kind] - currentCount;
      for (let i = 0; i < needed; i++) {
        if (kind === 'rain') particlesRef.current.push(spawnRain(safeW, safeH));
        else if (kind === 'grid') particlesRef.current.push(spawnGrid(currentCount + i, allocation.grid, safeW, safeH));
        else particlesRef.current.push(spawnEmber(safeW, safeH));
      }
    }

    prevAllocRef.current = { ...allocation };
  }, [allocation]);

  // Animation loop
  useEffect(() => {
    let rafId;
    let lastTime = performance.now();

    const tick = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const canvas = canvasRef.current;
      const { w, h } = sizeRef.current;
      if (!canvas || !w) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);

      const time = now / 1000;
      const particles = particlesRef.current;

      // Update and draw
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        updateFade(p, dt);

        // Remove fully faded-out particles
        if (p.fadeOut && p.opacity <= 0) {
          particles.splice(i, 1);
          continue;
        }

        if (p.kind === 'rain') updateRain(p, dt, time, w, h);
        else if (p.kind === 'grid') updateGrid(p, dt, time);
        else updateEmber(p, dt, time, w, h);

        drawParticle(ctx, p);
      }

      // Grid connections
      drawGridConnections(ctx, particles.filter(p => p.kind === 'grid'));

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Standby: render nothing
  if (mechMode === 'standby') return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
