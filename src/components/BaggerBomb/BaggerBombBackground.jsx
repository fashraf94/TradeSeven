// BaggerBombBackground - Command Center animated background for BaggerBomb battle views
// 3-layer system: base color (parent), CSS glow orbs, canvas particle network

import React, { useRef, useEffect, useCallback } from 'react';

const CONNECTION_DISTANCE = 150;
const CONNECTION_MAX_OPACITY = 0.2;
const CONNECTION_LINE_WIDTH = 0.75;
const RESIZE_DEBOUNCE_MS = 200;
const MAX_DPR = 2;
const HUB_CHANCE = 0.15;

const CYAN = { r: 0, g: 217, b: 255 };
const PURPLE = { r: 147, g: 51, b: 234 };

function createParticles(width, height) {
  const count = width >= 768 ? 55 : 25;
  const particles = [];

  for (let i = 0; i < count; i++) {
    const isCyan = Math.random() < 0.6;
    const color = isCyan ? CYAN : PURPLE;
    const isHub = Math.random() < HUB_CHANCE;
    const opacity = isHub
      ? 0.6 + Math.random() * 0.2   // hub: 0.6 - 0.8
      : 0.35 + Math.random() * 0.30; // normal: 0.35 - 0.65
    const radius = isHub
      ? 5 + Math.random() * 2        // hub: 5 - 7px
      : 1.5 + Math.random() * 2.5;   // normal: 1.5 - 4px
    const speed = 0.15 + Math.random() * 0.20; // 0.15 - 0.35
    const angle = Math.random() * Math.PI * 2;

    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      color,
      opacity,
    });
  }

  return particles;
}

const BaggerBombBackground = () => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const particlesRef = useRef([]);
  const resizeTimerRef = useRef(null);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    particlesRef.current = createParticles(width, height);
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = window.innerWidth;
    const height = window.innerHeight;
    const particles = particlesRef.current;

    ctx.clearRect(0, 0, width, height);

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

    // Draw connection lines FIRST (behind particles)
    ctx.lineWidth = CONNECTION_LINE_WIDTH;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONNECTION_DISTANCE) {
          const opacity = CONNECTION_MAX_OPACITY * (1 - dist / CONNECTION_DISTANCE);
          ctx.strokeStyle = `rgba(0, 217, 255, ${opacity})`;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw particles on top
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity})`;
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    setupCanvas();

    rafRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(setupCanvas, RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(resizeTimerRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [setupCanvas, animate]);

  return (
    <>
      {/* Layer 2: CSS Ambient Glow Orbs */}
      <div style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        backgroundImage: [
          'radial-gradient(ellipse 800px 800px at 25% 20%, rgba(0, 217, 255, 0.18), transparent 70%)',
          'radial-gradient(ellipse 700px 700px at 75% 15%, rgba(147, 51, 234, 0.14), transparent 70%)',
        ].join(', '),
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
