import React from 'react';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * BattleLoadingSkeleton - Polished loading state for Draft Battle
 *
 * Shows shimmer animations matching the holographic theme while
 * battle standings are being calculated.
 */
const BattleLoadingSkeleton = () => {
  return (
    <div style={{
      padding: '20px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      {/* Skeleton pods - simulate the altitude map loading */}
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px',
            background: HOLO_COLORS.bgCard,
            borderRadius: '12px',
            border: `1px solid ${HOLO_COLORS.borderSubtle}`,
          }}
        >
          {/* Rank skeleton */}
          <div style={{
            width: '50px',
            height: '28px',
            borderRadius: '6px',
            background: `linear-gradient(90deg, ${HOLO_COLORS.bgElevated} 25%, ${HOLO_COLORS.bgCard} 50%, ${HOLO_COLORS.bgElevated} 75%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }} />

          {/* Name skeleton */}
          <div style={{ flex: 1 }}>
            <div style={{
              width: '120px',
              height: '16px',
              borderRadius: '4px',
              background: `linear-gradient(90deg, ${HOLO_COLORS.bgElevated} 25%, ${HOLO_COLORS.bgCard} 50%, ${HOLO_COLORS.bgElevated} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              marginBottom: '8px',
            }} />
            <div style={{
              width: '80px',
              height: '12px',
              borderRadius: '4px',
              background: `linear-gradient(90deg, ${HOLO_COLORS.bgElevated} 25%, ${HOLO_COLORS.bgCard} 50%, ${HOLO_COLORS.bgElevated} 75%)`,
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              animationDelay: '0.2s',
            }} />
          </div>

          {/* Gain skeleton */}
          <div style={{
            width: '70px',
            height: '24px',
            borderRadius: '6px',
            background: `linear-gradient(90deg, ${HOLO_COLORS.bgElevated} 25%, ${HOLO_COLORS.bgCard} 50%, ${HOLO_COLORS.bgElevated} 75%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            animationDelay: '0.4s',
          }} />
        </div>
      ))}

      {/* Bottom console skeleton */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: HOLO_COLORS.bgDeep,
        borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
        padding: '16px',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}>
        {/* Grid skeleton */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          marginBottom: '12px',
        }}>
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              style={{
                height: '50px',
                borderRadius: '8px',
                background: `linear-gradient(90deg, ${HOLO_COLORS.bgElevated} 25%, ${HOLO_COLORS.bgCard} 50%, ${HOLO_COLORS.bgElevated} 75%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>

        {/* Buttons skeleton */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{
            flex: 1,
            height: '44px',
            borderRadius: '8px',
            background: `linear-gradient(90deg, ${HOLO_COLORS.bgElevated} 25%, ${HOLO_COLORS.bgCard} 50%, ${HOLO_COLORS.bgElevated} 75%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }} />
          <div style={{
            flex: 1,
            height: '44px',
            borderRadius: '8px',
            background: `linear-gradient(90deg, ${HOLO_COLORS.bgElevated} 25%, ${HOLO_COLORS.bgCard} 50%, ${HOLO_COLORS.bgElevated} 75%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            animationDelay: '0.2s',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
};

export default BattleLoadingSkeleton;
