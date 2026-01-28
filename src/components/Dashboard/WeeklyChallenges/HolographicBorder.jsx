// Holographic shimmer effect for tarot cards
// - Animated border that shifts with scroll position
// - Shine overlay that sweeps across card
// - Desktop hover effect with extra shimmer

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HolographicBorder({
  accentColor,
  scrollProgress = 0,
  muted = false,
  children,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const shimmerAngle = scrollProgress * 360;
  const opacity = muted ? 0.4 : 1;

  return (
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={{ scale: isHovered ? 1.02 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        opacity,
      }}
    >
      {/* Holographic border - gradient that rotates with scroll */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '16px',
        padding: '3px',
        background: `linear-gradient(
          ${shimmerAngle}deg,
          ${accentColor},
          #ffffff,
          ${accentColor},
          #ffffff,
          ${accentColor}
        )`,
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        pointerEvents: 'none',
      }} />

      {/* Holographic shine overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '16px',
        background: `linear-gradient(
          ${shimmerAngle + 45}deg,
          transparent 0%,
          rgba(255,255,255,0.06) 40%,
          rgba(255,255,255,0.15) 50%,
          rgba(255,255,255,0.06) 60%,
          transparent 100%
        )`,
        pointerEvents: 'none',
        zIndex: 2,
      }} />

      {/* Desktop hover shimmer sweep */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '16px',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
        )}
      </AnimatePresence>

      {/* Card content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        borderRadius: '16px',
        background: '#0d1117',
        margin: '3px',
      }}>
        {children}
      </div>
    </motion.div>
  );
}
