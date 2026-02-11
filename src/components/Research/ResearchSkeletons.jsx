import React from 'react';

const shimmerStyle = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '6px',
};

/**
 * ChartSkeleton — Placeholder while chart data is loading.
 */
export const ChartSkeleton = ({ height = 280 }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: `${height}px`, background: '#0a0e14',
  }}>
    <div style={{ width: '90%', height: `${height - 80}px`, ...shimmerStyle }} />
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  </div>
);

/**
 * LevelsSkeleton — Placeholder for Price Levels section.
 */
export const LevelsSkeleton = () => (
  <div style={{ padding: '8px 0' }}>
    {[1, 2, 3, 4].map(i => (
      <div key={i} style={{
        height: '36px', marginBottom: '6px', ...shimmerStyle,
      }} />
    ))}
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  </div>
);

/**
 * DrawerSkeleton — Placeholder for drawer content.
 */
export const DrawerSkeleton = () => (
  <div style={{ padding: '8px 0' }}>
    <div style={{ height: '14px', width: '40%', marginBottom: '10px', ...shimmerStyle }} />
    <div style={{ height: '12px', width: '90%', marginBottom: '6px', ...shimmerStyle }} />
    <div style={{ height: '12px', width: '70%', marginBottom: '6px', ...shimmerStyle }} />
    <div style={{ height: '12px', width: '80%', marginBottom: '6px', ...shimmerStyle }} />
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  </div>
);
