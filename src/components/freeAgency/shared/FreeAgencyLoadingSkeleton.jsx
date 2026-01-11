import React from 'react';
import { HOLO_COLORS } from '../../../constants/holoTheme';

/**
 * FreeAgencyLoadingSkeleton - Shimmer loading state for Free Agency
 *
 * Features:
 * - Responsive (mobile/desktop variants)
 * - Animated shimmer effect
 * - Matches actual layout structure
 */
const FreeAgencyLoadingSkeleton = ({ isMobile = true }) => {
  const shimmerStyle = {
    background: `linear-gradient(90deg, ${HOLO_COLORS.bgElevated} 25%, ${HOLO_COLORS.bgCard} 50%, ${HOLO_COLORS.bgElevated} 75%)`,
    backgroundSize: '200% 100%',
    animation: 'skeletonShimmer 1.5s infinite',
    borderRadius: '8px',
  };

  if (isMobile) {
    return (
      <div style={{ padding: '16px' }}>
        {/* Window Status Skeleton */}
        <div style={{ ...shimmerStyle, height: '60px', marginBottom: '16px' }} />

        {/* Roster Section Header */}
        <div style={{ ...shimmerStyle, height: '16px', width: '140px', marginBottom: '12px' }} />

        {/* Roster Cards - Horizontal */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', overflowX: 'hidden' }}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                ...shimmerStyle,
                width: '100px',
                height: '90px',
                flexShrink: 0,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>

        {/* Category Tabs Skeleton */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              style={{
                ...shimmerStyle,
                flex: 1,
                height: '50px',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>

        {/* Free Agent Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                ...shimmerStyle,
                height: '70px',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>

        <style>{`
          @keyframes skeletonShimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
      </div>
    );
  }

  // Desktop skeleton
  return (
    <div style={{
      padding: '24px',
      maxWidth: '1400px',
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: '380px 1fr',
      gap: '24px',
    }}>
      {/* Left Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Roster Grid Skeleton */}
        <div style={{
          background: HOLO_COLORS.bgCard,
          borderRadius: '12px',
          padding: '20px',
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        }}>
          <div style={{ ...shimmerStyle, height: '20px', width: '120px', marginBottom: '16px' }} />

          {/* 3x3 Grid */}
          {[...Array(3)].map((_, row) => (
            <div key={row} style={{ marginBottom: '16px' }}>
              <div style={{ ...shimmerStyle, height: '14px', width: '80px', marginBottom: '10px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[...Array(3)].map((_, col) => (
                  <div
                    key={col}
                    style={{
                      ...shimmerStyle,
                      height: '80px',
                      animationDelay: `${(row * 3 + col) * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Swap Panel Skeleton */}
        <div style={{
          ...shimmerStyle,
          height: '180px',
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
        }} />
      </div>

      {/* Right Column */}
      <div style={{
        background: HOLO_COLORS.bgCard,
        borderRadius: '12px',
        padding: '20px',
        border: `1px solid ${HOLO_COLORS.borderSubtle}`,
      }}>
        <div style={{ ...shimmerStyle, height: '20px', width: '180px', marginBottom: '16px' }} />

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ ...shimmerStyle, flex: 1, height: '55px' }} />
          ))}
        </div>

        {/* 2-Column Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              style={{
                ...shimmerStyle,
                height: '75px',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes skeletonShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
};

export default FreeAgencyLoadingSkeleton;
