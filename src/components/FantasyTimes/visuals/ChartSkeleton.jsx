// src/components/FantasyTimes/visuals/ChartSkeleton.jsx
// Pulsing skeleton placeholder for chart loading states.
// Reserves exact container height to prevent layout shift (CLS).

import React from 'react';
import { DARK_TOKENS } from '../../../theme/tokens';

let styleInjected = false;

export default function ChartSkeleton({ height }) {
  // Inject keyframes once
  if (!styleInjected && typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `@keyframes skeletonShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`;
    document.head.appendChild(style);
    styleInjected = true;
  }

  return (
    <div
      style={{
        height: height,
        width: '100%',
        backgroundColor: DARK_TOKENS.bgCard,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: '100%',
          background: `linear-gradient(90deg, transparent 0%, rgba(94,234,212,0.06) 50%, transparent 100%)`,
          backgroundSize: '200% 100%',
          animation: 'skeletonShimmer 1.5s ease-in-out infinite',
        }}
      />
    </div>
  );
}
