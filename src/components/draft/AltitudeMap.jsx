import React, { useMemo, useState, useEffect } from 'react';
import { HOLO_COLORS } from '../../constants/holoTheme';
import TacticalPod from './TacticalPod';
import OvertakeCallout from './OvertakeCallout';

/**
 * AltitudeMap - Main visualization for Draft Battle standings
 *
 * Displays a vertical map with:
 * - Y-axis showing percentage markers (+10%, 0%, -5%, etc.)
 * - Glowing cyan "battle snake" path connecting player positions
 * - TacticalPod hexagons at each player's gain percentage altitude
 * - OvertakeCallout badges showing gaps between players
 */
const AltitudeMap = ({
  standings,          // Array of player standings sorted by rank
  currentUserId,      // Current user's odUserId
  onScoutPlayer,      // Callback when opponent pod is tapped
  containerHeight = 500, // Height of the map area in pixels
}) => {
  // Mobile detection for responsive layout
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate the Y-axis range based on standings
  const { minGain, maxGain, range } = useMemo(() => {
    if (!standings.length) return { minGain: -10, maxGain: 10, range: 20 };

    const gains = standings.map(p => p.totalGain);
    const min = Math.min(...gains);
    const max = Math.max(...gains);

    // Round to nearest 5 and add padding
    const padding = 5;
    const adjustedMin = Math.floor(min / 5) * 5 - padding;
    const adjustedMax = Math.ceil(max / 5) * 5 + padding;

    return {
      minGain: Math.min(adjustedMin, -5),
      maxGain: Math.max(adjustedMax, 10),
      range: Math.max(adjustedMax, 10) - Math.min(adjustedMin, -5),
    };
  }, [standings]);

  // Calculate Y position for a given gain percentage
  const getYPosition = (gain) => {
    // Normalize to 0-1 range where 1 is top
    const normalized = (gain - minGain) / range;
    // Invert: higher gain = higher position (lower Y in SVG coordinates)
    // Add padding for pod visibility
    const paddedHeight = containerHeight - 80; // Leave room at top/bottom
    return 40 + paddedHeight * (1 - normalized);
  };

  // Calculate X position (alternate left/right based on rank)
  const getXPosition = (rank) => {
    if (isMobile) {
      // Tighter positioning on mobile
      return rank % 2 === 1 ? '30%' : '70%';
    }
    // Desktop: alternate sides for better visibility
    return rank % 2 === 1 ? '25%' : '68%';
  };

  // Generate Y-axis tick marks
  const yAxisTicks = useMemo(() => {
    const ticks = [];
    const step = 5;
    // Start from bottom (minGain) and go up
    for (let val = Math.floor(minGain / step) * step; val <= maxGain; val += step) {
      ticks.push(val);
    }
    return ticks;
  }, [minGain, maxGain]);

  // Calculate overtake gaps for callouts
  const overtakeGaps = useMemo(() => {
    if (standings.length < 2) return [];

    const gaps = [];
    const userIndex = standings.findIndex(p => p.odUserId === currentUserId);

    for (let i = 0; i < standings.length - 1; i++) {
      const higher = standings[i];     // Higher ranked player
      const lower = standings[i + 1];  // Lower ranked player
      const gap = higher.totalGain - lower.totalGain;

      // Show gap between user and player ahead (if user isn't 1st)
      // Or between 1st and 2nd for drama
      const isUserChasing = i === userIndex - 1;
      const isTopTwo = i === 0;

      if ((isUserChasing || isTopTwo) && gap > 0.1) {
        gaps.push({
          gap,
          yPosition: (getYPosition(higher.totalGain) + getYPosition(lower.totalGain)) / 2,
          xPosition: '50%',
          isUserGap: isUserChasing,
          higherPlayer: higher,
          lowerPlayer: lower,
        });
      }
    }

    return gaps;
  }, [standings, currentUserId, containerHeight]);

  // Generate SVG path for the "battle snake" connecting pods
  const snakePath = useMemo(() => {
    if (standings.length < 2) return '';

    // Calculate actual pixel positions for SVG
    const svgWidth = 100; // Percentage-based width reference
    const points = standings.map((player, idx) => {
      const rank = idx + 1;
      const xPercent = rank % 2 === 1 ? (isMobile ? 30 : 25) : (isMobile ? 70 : 68);
      return {
        x: xPercent,
        y: getYPosition(player.totalGain),
      };
    });

    // Create smooth curved path using quadratic bezier curves
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      // Calculate control point for smooth curve
      const midY = (prev.y + curr.y) / 2;
      const midX = (prev.x + curr.x) / 2;

      // Quadratic bezier curve: Q controlX,controlY endX,endY
      path += ` Q ${prev.x},${midY} ${midX},${midY}`;
      path += ` T ${curr.x},${curr.y}`;
    }

    return path;
  }, [standings, containerHeight, isMobile]);

  // Don't render if no standings
  if (!standings.length) {
    return (
      <div style={{
        height: `${containerHeight}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: HOLO_COLORS.textMuted,
      }}>
        No battle data available
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      height: `${containerHeight}px`,
      width: '100%',
      overflow: 'visible',
    }}>
      {/* Background Grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          linear-gradient(0deg, transparent 0%, transparent 99%, ${HOLO_COLORS.borderSubtle}33 100%),
          linear-gradient(90deg, transparent 0%, transparent 99%, ${HOLO_COLORS.borderSubtle}22 100%)
        `,
        backgroundSize: '100% 50px, 50px 100%',
        opacity: 0.5,
      }} />

      {/* Y-Axis Track */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '20px',
        bottom: '20px',
        width: '2px',
        background: `linear-gradient(180deg,
          ${HOLO_COLORS.cyan}44 0%,
          ${HOLO_COLORS.cyan} 30%,
          ${HOLO_COLORS.cyan} 70%,
          ${HOLO_COLORS.cyan}44 100%
        )`,
        transform: 'translateX(-50%)',
        boxShadow: `0 0 15px ${HOLO_COLORS.cyan}44`,
      }}>
        {/* Arrow at top */}
        <div style={{
          position: 'absolute',
          top: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderBottom: `10px solid ${HOLO_COLORS.cyan}`,
        }} />
      </div>

      {/* Y-Axis Labels */}
      {yAxisTicks.map((tick) => {
        const yPos = getYPosition(tick);
        const isZero = tick === 0;

        return (
          <React.Fragment key={tick}>
            {/* Tick label */}
            <div style={{
              position: 'absolute',
              right: isMobile ? 'auto' : '16px',
              left: isMobile ? '8px' : 'auto',
              top: `${yPos}px`,
              transform: 'translateY(-50%)',
              fontSize: '11px',
              color: isZero ? HOLO_COLORS.cyan : HOLO_COLORS.textMuted,
              fontWeight: isZero ? 700 : 400,
              fontFamily: 'monospace',
              zIndex: 5,
            }}>
              {tick > 0 ? '+' : ''}{tick}%
            </div>

            {/* Zero line - horizontal dashed line */}
            {isZero && (
              <div style={{
                position: 'absolute',
                left: '15%',
                right: '15%',
                top: `${yPos}px`,
                height: '1px',
                background: `repeating-linear-gradient(
                  90deg,
                  ${HOLO_COLORS.cyan}66 0px,
                  ${HOLO_COLORS.cyan}66 8px,
                  transparent 8px,
                  transparent 16px
                )`,
                zIndex: 1,
              }} />
            )}
          </React.Fragment>
        );
      })}

      {/* Battle Snake Path - SVG */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
        viewBox={`0 0 100 ${containerHeight}`}
        preserveAspectRatio="none"
      >
        <defs>
          {/* Gradient for the snake path */}
          <linearGradient id="snakeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={HOLO_COLORS.cyan} stopOpacity="0.9" />
            <stop offset="50%" stopColor={HOLO_COLORS.green} stopOpacity="0.7" />
            <stop offset="100%" stopColor={HOLO_COLORS.amber} stopOpacity="0.5" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="snakeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* The snake path */}
        {snakePath && (
          <>
            {/* Glow layer */}
            <path
              d={snakePath}
              fill="none"
              stroke={HOLO_COLORS.cyan}
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.3"
              filter="url(#snakeGlow)"
            />
            {/* Main path */}
            <path
              d={snakePath}
              fill="none"
              stroke="url(#snakeGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* Connection dots at each pod */}
        {standings.map((player, idx) => {
          const rank = idx + 1;
          const xPercent = rank % 2 === 1 ? (isMobile ? 30 : 25) : (isMobile ? 70 : 68);
          const yPos = getYPosition(player.totalGain);
          const isUser = player.odUserId === currentUserId;

          return (
            <circle
              key={player.odUserId}
              cx={xPercent}
              cy={yPos}
              r={isUser ? 5 : 4}
              fill={isUser ? HOLO_COLORS.cyan : HOLO_COLORS.textMuted}
              filter={isUser ? 'url(#snakeGlow)' : 'none'}
            />
          );
        })}
      </svg>

      {/* User's Tether Line (connecting user pod to center axis) */}
      {standings.map((player, idx) => {
        if (player.odUserId !== currentUserId) return null;
        const rank = idx + 1;
        const xPercent = rank % 2 === 1 ? (isMobile ? 30 : 25) : (isMobile ? 70 : 68);
        const yPos = getYPosition(player.totalGain);

        return (
          <div
            key={`tether-${player.odUserId}`}
            style={{
              position: 'absolute',
              top: `${yPos}px`,
              left: `${Math.min(xPercent, 50)}%`,
              width: `${Math.abs(50 - xPercent)}%`,
              height: '2px',
              background: `linear-gradient(
                ${xPercent < 50 ? '90deg' : '270deg'},
                ${HOLO_COLORS.cyan} 0%,
                ${HOLO_COLORS.cyan}44 100%
              )`,
              boxShadow: `0 0 8px ${HOLO_COLORS.cyan}66`,
              zIndex: 3,
            }}
          />
        );
      })}

      {/* Tactical Pods */}
      {standings.map((player, idx) => {
        const isUser = player.odUserId === currentUserId;
        const rank = idx + 1;

        return (
          <TacticalPod
            key={player.odUserId}
            player={player}
            rank={rank}
            isUser={isUser}
            onScout={onScoutPlayer}
            style={{
              left: getXPosition(rank),
              top: `${getYPosition(player.totalGain)}px`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        );
      })}

      {/* Overtake Callouts */}
      {overtakeGaps.map((gap, idx) => (
        <OvertakeCallout
          key={idx}
          gapPercent={gap.gap}
          isUserGap={gap.isUserGap}
          style={{
            left: gap.xPosition,
            top: `${gap.yPosition}px`,
          }}
        />
      ))}
    </div>
  );
};

export default AltitudeMap;
