import React from 'react';

/**
 * SnakeConduit - Animated Snake Wave Connecting Players
 *
 * SVG-based animated snake with glowing green neon effect that flows
 * in a wave pattern AROUND player panels (not through them).
 * The wave peaks occur BETWEEN cards, troughs are where cards ARE.
 * Desktop only.
 */

/**
 * SnakeHead - Reusable snake head component with eyes and forked tongue
 */
const SnakeHead = ({ x, y, rotation = 0, color = '#00ff88', side = 'left' }) => (
  <g
    transform={`translate(${x}, ${y}) rotate(${rotation})`}
    className={`snake-head snake-head-${side}`}
  >
    {/* Head shape - pointed oval */}
    <ellipse
      cx="0"
      cy="0"
      rx="14"
      ry="9"
      fill={color}
      filter="url(#rainbow-glow)"
    />
    {/* Darker top for 3D effect - uses transparent overlay */}
    <ellipse
      cx="0"
      cy="-2"
      rx="12"
      ry="6"
      fill="rgba(255, 255, 255, 0.3)"
    />
    {/* Snout point */}
    <ellipse
      cx="16"
      cy="0"
      rx="6"
      ry="5"
      fill={color}
      filter="url(#rainbow-glow)"
    />
    {/* Left eye socket */}
    <circle cx="-3" cy="-3" r="4" fill="#0a0e14" />
    {/* Left eye pupil */}
    <circle cx="-2" cy="-3" r="2" fill="#ffcc00" />
    {/* Left eye highlight */}
    <circle cx="-3" cy="-4" r="1" fill="#ffffff" opacity="0.9" />
    {/* Right eye socket */}
    <circle cx="7" cy="-3" r="4" fill="#0a0e14" />
    {/* Right eye pupil */}
    <circle cx="8" cy="-3" r="2" fill="#ffcc00" />
    {/* Right eye highlight */}
    <circle cx="7" cy="-4" r="1" fill="#ffffff" opacity="0.9" />
    {/* Nostril dots */}
    <circle cx="14" cy="-2" r="1" fill="#0a0e14" opacity="0.6" />
    <circle cx="14" cy="2" r="1" fill="#0a0e14" opacity="0.6" />
    {/* Forked tongue */}
    <g className={`snake-tongue snake-tongue-${side}`}>
      <path
        d="M 20,0 L 34,0 L 42,-6 M 34,0 L 42,6"
        stroke="#ff4466"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </g>
);

const SnakeConduit = ({
  width = 900,
  height = 200,
  playerCount = 3,
}) => {
  // Generate wave path that flows AROUND player positions
  // Cards are roughly at: left (150), center (450), right (750) in a 900-width viewBox
  // Wave troughs (lowest points) should be BETWEEN cards
  // Wave peaks (highest points) should align with card positions (so snake goes behind/below)
  const generateWavePath = () => {
    // The wave goes: low -> high -> low -> high -> low -> high -> low
    // Low points at edges and between cards, high points at card positions
    return `M -50,120
            Q 75,180 150,120
            Q 225,60 300,120
            Q 375,180 450,120
            Q 525,60 600,120
            Q 675,180 750,120
            Q 825,60 950,120`;
  };

  // Alternate wave for animation
  const generateWavePathAlt = () => {
    return `M -50,120
            Q 75,160 150,120
            Q 225,80 300,120
            Q 375,160 450,120
            Q 525,80 600,120
            Q 675,160 750,120
            Q 825,80 950,120`;
  };

  return (
    <div
      className="snake-conduit-container"
      style={{
        position: 'absolute',
        top: '-30px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none',
        zIndex: 1, // Below player cards (cards should be z-index: 5+)
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Snake glow filter */}
          <filter id="snake-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur1" />
            <feGaussianBlur stdDeviation="6" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Rainbow glow filter for sector colors */}
          <filter id="rainbow-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Static multi-sector gradient */}
          <linearGradient id="sector-snake-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00d9ff" />
            <stop offset="16%" stopColor="#10b981" />
            <stop offset="32%" stopColor="#f59e0b" />
            <stop offset="48%" stopColor="#ec4899" />
            <stop offset="64%" stopColor="#ef4444" />
            <stop offset="80%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#00d9ff" />
          </linearGradient>

          {/* Animated sector gradient - flowing rainbow effect */}
          <linearGradient id="animated-sector-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00d9ff">
              <animate attributeName="stop-color"
                values="#00d9ff;#10b981;#f59e0b;#ec4899;#ef4444;#8b5cf6;#00d9ff"
                dur="12s"
                repeatCount="indefinite" />
            </stop>
            <stop offset="25%" stopColor="#10b981">
              <animate attributeName="stop-color"
                values="#10b981;#f59e0b;#ec4899;#ef4444;#8b5cf6;#00d9ff;#10b981"
                dur="12s"
                repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#f59e0b">
              <animate attributeName="stop-color"
                values="#f59e0b;#ec4899;#ef4444;#8b5cf6;#00d9ff;#10b981;#f59e0b"
                dur="12s"
                repeatCount="indefinite" />
            </stop>
            <stop offset="75%" stopColor="#ec4899">
              <animate attributeName="stop-color"
                values="#ec4899;#ef4444;#8b5cf6;#00d9ff;#10b981;#f59e0b;#ec4899"
                dur="12s"
                repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#ef4444">
              <animate attributeName="stop-color"
                values="#ef4444;#8b5cf6;#00d9ff;#10b981;#f59e0b;#ec4899;#ef4444"
                dur="12s"
                repeatCount="indefinite" />
            </stop>
          </linearGradient>

          {/* Gradient along snake body with opacity fade */}
          <linearGradient id="snake-body-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00ff88" stopOpacity="0.2" />
            <stop offset="20%" stopColor="#00ff88" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#00ff88" stopOpacity="1" />
            <stop offset="80%" stopColor="#00ff88" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#00ff88" stopOpacity="0.2" />
          </linearGradient>

          {/* Animated shimmer gradient */}
          <linearGradient id="snake-shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent">
              <animate attributeName="offset" values="-0.3;1" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="15%" stopColor="rgba(255, 255, 255, 0.4)">
              <animate attributeName="offset" values="-0.15;1.15" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="30%" stopColor="transparent">
              <animate attributeName="offset" values="0;1.3" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>

          {/* Scale pattern for snake texture - now rainbow */}
          <pattern id="snake-scales-pattern" patternUnits="userSpaceOnUse" width="20" height="12">
            <ellipse cx="10" cy="6" rx="8" ry="4" fill="none" stroke="url(#sector-snake-gradient)" strokeWidth="0.5" opacity="0.5" />
          </pattern>
        </defs>

        {/* Snake body - outer glow layer with sector colors */}
        <path
          d={generateWavePath()}
          stroke="url(#animated-sector-gradient)"
          strokeWidth="18"
          fill="none"
          strokeLinecap="round"
          filter="url(#rainbow-glow)"
          opacity="0.35"
          className="snake-body-glow"
        />

        {/* Snake body - main stroke with animated sector gradient */}
        <path
          d={generateWavePath()}
          stroke="url(#animated-sector-gradient)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          filter="url(#rainbow-glow)"
          className="snake-body-main"
        />

        {/* Snake body - scale pattern overlay */}
        <path
          d={generateWavePath()}
          stroke="url(#snake-scales-pattern)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          className="snake-scales"
          opacity="0.6"
        />

        {/* Snake body - center highlight line */}
        <path
          d={generateWavePath()}
          stroke="rgba(255, 255, 255, 0.6)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
          className="snake-highlight"
        />

        {/* Animated dash pattern for slithering effect - using static gradient */}
        <path
          d={generateWavePath()}
          stroke="url(#sector-snake-gradient)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="50 30"
          className="snake-slither-dash"
          opacity="0.5"
        />

        {/* Shimmer overlay */}
        <path
          d={generateWavePath()}
          stroke="url(#snake-shimmer)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          className="snake-shimmer"
        />

        {/* Left snake head - entering from left, pointing right (Cyan - Technology) */}
        <SnakeHead x={-30} y={120} rotation={0} color="#00d9ff" side="left" />

        {/* Right snake head - exiting to right, pointing right (Purple - Industrial) */}
        <SnakeHead x={930} y={120} rotation={0} color="#8b5cf6" side="right" />
      </svg>

      {/* CSS for animations */}
      <style>{`
        .snake-conduit-container {
          display: none;
        }

        @media (min-width: 1024px) {
          .snake-conduit-container {
            display: block;
          }
        }

        /* Slithering dash animation - dashes move along the path */
        @keyframes slither-dash {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -130;
          }
        }

        .snake-slither-dash {
          animation: slither-dash 2s linear infinite;
        }

        /* Wave undulation animation */
        @keyframes snake-wave {
          0%, 100% {
            d: path('M -50,120 Q 75,180 150,120 Q 225,60 300,120 Q 375,180 450,120 Q 525,60 600,120 Q 675,180 750,120 Q 825,60 950,120');
          }
          50% {
            d: path('M -50,120 Q 75,160 150,120 Q 225,80 300,120 Q 375,160 450,120 Q 525,80 600,120 Q 675,160 750,120 Q 825,80 950,120');
          }
        }

        .snake-body-main,
        .snake-body-glow,
        .snake-scales,
        .snake-highlight,
        .snake-slither-dash {
          animation: snake-wave 4s ease-in-out infinite;
        }

        /* Stagger the dash animation */
        .snake-slither-dash {
          animation: slither-dash 2s linear infinite, snake-wave 4s ease-in-out infinite;
        }

        /* Body glow pulse */
        @keyframes body-pulse {
          0%, 100% {
            opacity: 0.25;
            stroke-width: 16px;
          }
          50% {
            opacity: 0.4;
            stroke-width: 20px;
          }
        }

        .snake-body-glow {
          animation: body-pulse 3s ease-in-out infinite, snake-wave 4s ease-in-out infinite;
        }

        /* Scale shimmer */
        @keyframes scale-shimmer {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.7;
          }
        }

        .snake-scales {
          animation: scale-shimmer 3s ease-in-out infinite, snake-wave 4s ease-in-out infinite;
        }

        /* Snake head bobbing animation */
        @keyframes head-bob {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }

        .snake-head {
          animation: head-bob 2s ease-in-out infinite;
        }

        .snake-head-right {
          animation-delay: 1s;
        }

        /* Tongue flick animation */
        @keyframes tongue-flick {
          0%, 80%, 100% {
            opacity: 0;
            transform: scaleX(0);
          }
          85%, 95% {
            opacity: 1;
            transform: scaleX(1);
          }
        }

        .snake-tongue {
          transform-origin: left center;
          animation: tongue-flick 3s ease-in-out infinite;
        }

        /* Offset the animations so they don't flick at the same time */
        .snake-tongue-left {
          animation-delay: 0s;
        }

        .snake-tongue-right {
          animation-delay: 1.5s;
        }

        /* Eye glow effect */
        @keyframes eye-glow {
          0%, 100% {
            filter: drop-shadow(0 0 2px #ffcc00);
          }
          50% {
            filter: drop-shadow(0 0 6px #ffcc00);
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .snake-body-glow,
          .snake-body-main,
          .snake-scales,
          .snake-highlight,
          .snake-slither-dash,
          .snake-shimmer,
          .snake-head,
          .snake-tongue {
            animation: none !important;
          }
          .snake-tongue {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

/**
 * Simplified horizontal connector for tighter spaces
 */
export const SnakeConnector = ({ glowing = false }) => (
  <div
    style={{
      width: '60px',
      height: '2px',
      background: glowing
        ? 'linear-gradient(90deg, var(--neon-green) 0%, var(--neon-cyan) 100%)'
        : 'linear-gradient(90deg, rgba(0, 255, 136, 0.4) 0%, rgba(0, 255, 255, 0.4) 100%)',
      boxShadow: glowing
        ? '0 0 15px rgba(0, 255, 136, 0.6), 0 0 30px rgba(0, 255, 136, 0.3)'
        : '0 0 8px rgba(0, 255, 136, 0.3)',
      borderRadius: '1px',
    }}
  />
);

/**
 * Vertical connector for mobile layout
 */
export const SnakeConnectorVertical = ({ glowing = false, height = 16 }) => (
  <div
    style={{
      width: '2px',
      height: `${height}px`,
      background: glowing
        ? 'var(--neon-green, #00ff88)'
        : 'rgba(0, 255, 136, 0.4)',
      boxShadow: glowing
        ? '0 0 15px rgba(0, 255, 136, 0.6)'
        : '0 0 8px rgba(0, 255, 136, 0.3)',
      borderRadius: '1px',
    }}
  />
);

export default SnakeConduit;
