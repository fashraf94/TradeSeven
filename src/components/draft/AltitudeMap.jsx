import React, { useMemo, useState, useEffect } from 'react';
import { HOLO_COLORS } from '../../constants/holoTheme';
import TacticalPod from './TacticalPod';
import OvertakeCallout from './OvertakeCallout';

/**
 * AltitudeMap - Main visualization for Draft Battle standings
 *
 * Displays a vertical map with:
 * - Y-axis showing point markers (+100, 0, -50, etc.)
 * - Glowing cyan "battle snake" path connecting player positions
 * - TacticalPod hexagons at each player's total points altitude
 * - OvertakeCallout badges showing gaps between players
 *
 * BaggerBomb Scoring Update: Y-axis now shows points instead of percentages.
 * Phase 5.5: Fixed horizontal distribution for pods with similar scores
 */
const AltitudeMap = ({
  standings,          // Array of player standings sorted by rank
  currentUserId,      // Current user's odUserId
  onScoutPlayer,      // Callback when opponent pod is tapped
  scoutedPlayerId = null, // ID of player currently being scouted (for highlighting)
  containerHeight = 500, // Height of the map area in pixels
  podRefsMap = null,  // Ref object (.current = Map<odUserId, HTMLElement>) for shockwave origin
  flashingPods = null, // Set of player IDs currently flashing from shockwave
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

  // Minimum vertical separation between pods (in pixels)
  const MIN_POD_SEPARATION = isMobile ? 95 : 130;

  // Calculate the Y-axis range based on standings (using POINTS now)
  const { minPoints, maxPoints, range } = useMemo(() => {
    if (!standings.length) return { minPoints: -50, maxPoints: 100, range: 150 };

    // Use totalPoints for BaggerBomb scoring
    const points = standings.map(p => p.totalPoints || 0);
    const min = Math.min(...points);
    const max = Math.max(...points);

    // Round to nearest 25 for points (larger scale than %)
    const padding = 25;
    const adjustedMin = Math.floor(min / 25) * 25 - padding;
    const adjustedMax = Math.ceil(max / 25) * 25 + padding;

    return {
      minPoints: Math.min(adjustedMin, -25),
      maxPoints: Math.max(adjustedMax, 50),
      range: Math.max(adjustedMax, 50) - Math.min(adjustedMin, -25),
    };
  }, [standings]);

  // Calculate Y position for a given point value
  const getYPosition = (points) => {
    // Normalize to 0-1 range where 1 is top
    const normalized = (points - minPoints) / range;
    // Invert: higher points = higher position (lower Y in SVG coordinates)
    // Add padding for pod visibility
    const paddedHeight = containerHeight - 80; // Leave room at top/bottom
    return 40 + paddedHeight * (1 - normalized);
  };

  // Group players by similar points (within 10 pts) for horizontal distribution
  const playerGroups = useMemo(() => {
    if (!standings.length) return [];

    const groups = [];
    const sorted = [...standings].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

    sorted.forEach((player) => {
      const playerPoints = player.totalPoints || 0;
      // Find existing group within 10 points of this player's score
      const existingGroup = groups.find(g =>
        Math.abs(g.points - playerPoints) < 10
      );

      if (existingGroup) {
        existingGroup.players.push(player);
      } else {
        groups.push({
          points: playerPoints,
          players: [player]
        });
      }
    });

    return groups;
  }, [standings]);

  // Calculate X position based on group distribution
  const getXPosition = (player) => {
    // Find which group this player belongs to
    const group = playerGroups.find(g =>
      g.players.some(p => p.odUserId === player.odUserId)
    );

    if (!group || group.players.length === 1) {
      // Single player at this level - center them
      return 50;
    }

    // Multiple players at same level - distribute horizontally
    const playerIndex = group.players.findIndex(p => p.odUserId === player.odUserId);
    const totalInGroup = group.players.length;

    // Distribute evenly from 15% to 85% of width
    const minX = isMobile ? 18 : 15;
    const maxX = isMobile ? 82 : 85;
    const step = (maxX - minX) / Math.max(1, totalInGroup - 1);

    return minX + (playerIndex * step);
  };

  // Calculate adjusted Y positions to ensure minimum separation between pods
  const adjustedYPositions = useMemo(() => {
    if (!standings.length) return {};

    // Sort standings by points (highest first)
    const sorted = [...standings].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

    // Calculate raw Y positions first
    const positions = {};
    sorted.forEach((player) => {
      positions[player.odUserId] = getYPosition(player.totalPoints || 0);
    });

    // Adjust positions to ensure minimum separation
    // Process from top to bottom (lowest Y value first in screen coords)
    for (let i = 1; i < sorted.length; i++) {
      const currentPlayer = sorted[i];
      const prevPlayer = sorted[i - 1];

      const currentY = positions[currentPlayer.odUserId];
      const prevY = positions[prevPlayer.odUserId];

      // If too close, push this pod down
      const separation = currentY - prevY;
      if (separation < MIN_POD_SEPARATION) {
        positions[currentPlayer.odUserId] = prevY + MIN_POD_SEPARATION;
      }
    }

    return positions;
  }, [standings, containerHeight, minPoints, range, MIN_POD_SEPARATION]);

  // Get adjusted Y position for a player
  const getAdjustedYPosition = (player) => {
    return adjustedYPositions[player.odUserId] || getYPosition(player.totalPoints || 0);
  };

  // Calculate actual container height needed based on adjusted positions
  const actualContainerHeight = useMemo(() => {
    if (!standings.length || !Object.keys(adjustedYPositions).length) return containerHeight;

    // Find the maximum Y position of any pod
    const maxY = Math.max(...Object.values(adjustedYPositions));
    // Add padding for pod height (half of pod = ~45px) plus "tap to scout" text (~30px) plus margin
    const neededHeight = maxY + 100;

    return Math.max(containerHeight, neededHeight);
  }, [adjustedYPositions, containerHeight, standings.length]);

  // Generate Y-axis tick marks for points
  const yAxisTicks = useMemo(() => {
    const ticks = [];
    const step = 25; // Use 25-point increments for readability
    // Start from bottom (minPoints) and go up
    for (let val = Math.floor(minPoints / step) * step; val <= maxPoints; val += step) {
      ticks.push(val);
    }
    return ticks;
  }, [minPoints, maxPoints]);

  // Calculate overtake gaps for callouts - using POINTS for separation
  const overtakeGaps = useMemo(() => {
    if (standings.length < 2 || !Object.keys(adjustedYPositions).length) return [];

    const gaps = [];
    const userIndex = standings.findIndex(p => p.odUserId === currentUserId);

    for (let i = 0; i < standings.length - 1; i++) {
      const higher = standings[i];     // Higher ranked player
      const lower = standings[i + 1];  // Lower ranked player
      const higherPoints = higher.totalPoints || 0;
      const lowerPoints = lower.totalPoints || 0;
      const gap = higherPoints - lowerPoints;

      // Only show callout if there's meaningful point gap (> 10 pts)
      if (Math.abs(gap) < 10) continue;

      // Show gap between user and player ahead (if user isn't 1st)
      // Or between 1st and 2nd for drama
      const isUserChasing = i === userIndex - 1;
      const isTopTwo = i === 0;

      if ((isUserChasing || isTopTwo) && gap > 5) {
        // Use adjusted Y positions for visual placement
        const higherY = adjustedYPositions[higher.odUserId] || getYPosition(higherPoints);
        const lowerY = adjustedYPositions[lower.odUserId] || getYPosition(lowerPoints);

        gaps.push({
          gap,
          yPosition: (higherY + lowerY) / 2,
          xPosition: '50%',
          isUserGap: isUserChasing,
          higherPlayer: higher,
          lowerPlayer: lower,
        });
      }
    }

    return gaps;
  }, [standings, currentUserId, containerHeight, minPoints, range, adjustedYPositions]);

  // Generate SVG path for the "battle snake" connecting pods
  const snakePath = useMemo(() => {
    if (standings.length < 2) return '';

    // Calculate actual positions for SVG using adjusted player positions
    const pathPoints = standings.map((player) => {
      return {
        x: getXPosition(player),
        y: getAdjustedYPosition(player),
      };
    });

    // Sort by Y position (top to bottom) for smoother path drawing
    const sortedPoints = [...pathPoints].sort((a, b) => a.y - b.y);

    // Create smooth curved path using quadratic bezier curves
    let path = `M ${sortedPoints[0].x} ${sortedPoints[0].y}`;

    for (let i = 1; i < sortedPoints.length; i++) {
      const prev = sortedPoints[i - 1];
      const curr = sortedPoints[i];

      // Calculate control point for smooth curve
      const midY = (prev.y + curr.y) / 2;
      const midX = (prev.x + curr.x) / 2;

      // Quadratic bezier curve: Q controlX,controlY endX,endY
      path += ` Q ${prev.x},${midY} ${midX},${midY}`;
      path += ` T ${curr.x},${curr.y}`;
    }

    return path;
  }, [standings, containerHeight, isMobile, playerGroups, minPoints, range]);

  // Energy node positions — midpoints between consecutive players along the river
  const energyNodes = useMemo(() => {
    if (standings.length < 2) return [];
    const pathPoints = standings.map((player) => ({
      x: getXPosition(player),
      y: getAdjustedYPosition(player),
    }));
    const sorted = [...pathPoints].sort((a, b) => a.y - b.y);
    return sorted.slice(0, -1).map((pt, i) => ({
      x: (pt.x + sorted[i + 1].x) / 2,
      y: (pt.y + sorted[i + 1].y) / 2,
    }));
  }, [standings, containerHeight, isMobile, playerGroups, minPoints, range]);

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
      height: `${actualContainerHeight}px`,
      width: '100%',
      overflow: 'visible',
    }}>
      {/* Background Grid — faint cyan topographic pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0, 217, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 217, 255, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
        zIndex: 0,
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

      {/* Y-Axis Labels - Points */}
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
              fontSize: '10px',
              color: isZero ? HOLO_COLORS.cyan : HOLO_COLORS.textMuted,
              fontWeight: isZero ? 700 : 400,
              fontFamily: 'monospace',
              zIndex: 5,
            }}>
              {tick > 0 ? '+' : ''}{tick} pts
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

          {/* Glow filter (tight — used by connection dots) */}
          <filter id="snakeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Wide soft glow filter for river pulse */}
          <filter id="riverGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
          </filter>
        </defs>

        {/* The snake path — layered: glow → main → centerline */}
        {snakePath && (
          <>
            {/* Wide pulsing glow layer */}
            <path
              d={snakePath}
              fill="none"
              stroke="url(#snakeGradient)"
              strokeWidth="15"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#riverGlow)"
            >
              <animate
                attributeName="opacity"
                values="0.15;0.3;0.15"
                dur="3s"
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
              />
            </path>

            {/* Main river path */}
            <path
              d={snakePath}
              fill="none"
              stroke="url(#snakeGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />

            {/* Thin bright centerline for depth */}
            <path
              d={snakePath}
              fill="none"
              stroke="url(#snakeGradient)"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.5"
              filter="url(#riverGlow)"
            />
          </>
        )}

        {/* Connection dots at each pod */}
        {standings.map((player) => {
          const xPercent = getXPosition(player);
          const yPos = getAdjustedYPosition(player);
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

        {/* Energy nodes — gentle pulsing dots at river bends */}
        {energyNodes.map((node, i) => (
          <circle
            key={`energy-${i}`}
            cx={node.x}
            cy={node.y}
            r="3"
            fill="#00d9ff"
            opacity="0.5"
          >
            <animate
              attributeName="opacity"
              values="0.3;0.7;0.3"
              dur="2.5s"
              begin={`${i * 0.5}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="2;3.5;2"
              dur="2.5s"
              begin={`${i * 0.5}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </svg>

      {/* User's Tether Line (connecting user pod to center axis) */}
      {standings.map((player) => {
        if (player.odUserId !== currentUserId) return null;
        const xPercent = getXPosition(player);
        const yPos = getAdjustedYPosition(player);

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
        const isBeingScouted = scoutedPlayerId === player.odUserId;
        const xPos = getXPosition(player);

        return (
          <div
            key={player.odUserId}
            ref={(el) => {
              if (podRefsMap?.current) {
                if (el) podRefsMap.current.set(player.odUserId, el);
                else podRefsMap.current.delete(player.odUserId);
              }
            }}
            style={{
              position: 'absolute',
              left: `${xPos}%`,
              top: `${getAdjustedYPosition(player)}px`,
              transform: 'translate(-50%, -50%)',
              zIndex: isUser ? 10 : 5,
            }}
          >
            <TacticalPod
              player={player}
              rank={rank}
              isUser={isUser}
              onScout={onScoutPlayer}
              isBeingScouted={isBeingScouted}
              isFlashing={flashingPods?.has(player.odUserId)}
            />
          </div>
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
