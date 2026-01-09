import React from 'react';

/**
 * SnakeConduit - Animated Slithering Snake Connecting Players
 *
 * SVG-based animated snake with glowing green neon effect that connects
 * player panels in an arc formation. Features slithering animation,
 * scale pattern, and tongue flick. Desktop only.
 */

const SnakeConduit = ({
  width = 800,
  height = 80,
  playerCount = 3,
  activeIndex = -1, // Which player is current picker (head points toward them)
  currentPickerPosition = 'center', // 'left', 'center', 'right'
}) => {
  // Generate main snake path based on player count
  const generateSnakePath = () => {
    if (playerCount === 3) {
      // Curved arc connecting 3 players with wave effect built into path
      return `M 60,${height / 2}
              C 150,${height * 0.3} 250,${height * 0.7} 350,${height / 2}
              C 450,${height * 0.3} 550,${height * 0.7} ${width - 60},${height / 2}`;
    }
    if (playerCount === 4) {
      const segment = width / 4;
      return `M 50,${height / 2}
              C ${segment},${height * 0.25} ${segment * 1.5},${height * 0.75} ${segment * 2},${height / 2}
              C ${segment * 2.5},${height * 0.25} ${segment * 3},${height * 0.75} ${width - 50},${height / 2}`;
    }
    // Default: single wave
    return `M 60,${height / 2}
            C ${width * 0.3},${height * 0.2} ${width * 0.7},${height * 0.8} ${width - 60},${height / 2}`;
  };

  // Calculate head position based on current picker
  const getHeadPosition = () => {
    switch (currentPickerPosition) {
      case 'left':
        return { x: 60, y: height / 2, rotation: 180 };
      case 'right':
        return { x: width - 60, y: height / 2, rotation: 0 };
      case 'center':
      default:
        return { x: width / 2, y: height / 2, rotation: activeIndex === 0 ? 180 : 0 };
    }
  };

  const headPos = getHeadPosition();

  return (
    <div
      className="snake-conduit-container"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%',
        maxWidth: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
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

          {/* Stronger glow for head */}
          <filter id="snake-glow-strong" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur1" />
            <feGaussianBlur stdDeviation="8" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Scale pattern */}
          <pattern id="snake-scales" patternUnits="userSpaceOnUse" width="12" height="8">
            <ellipse cx="6" cy="4" rx="5" ry="3" fill="none" stroke="#00ff88" strokeWidth="0.5" opacity="0.6" />
          </pattern>

          {/* Gradient along snake body */}
          <linearGradient id="snake-body-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00ff88" stopOpacity="0.6" />
            <stop offset="30%" stopColor="#00ff88" stopOpacity="1" />
            <stop offset="70%" stopColor="#00ff88" stopOpacity="1" />
            <stop offset="100%" stopColor="#00ff88" stopOpacity="0.6" />
          </linearGradient>

          {/* Animated shimmer gradient */}
          <linearGradient id="snake-shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent">
              <animate attributeName="offset" values="-0.3;1" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="15%" stopColor="rgba(0, 255, 255, 0.6)">
              <animate attributeName="offset" values="-0.15;1.15" dur="2s" repeatCount="indefinite" />
            </stop>
            <stop offset="30%" stopColor="transparent">
              <animate attributeName="offset" values="0;1.3" dur="2s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
        </defs>

        {/* Snake body - outer glow layer */}
        <path
          d={generateSnakePath()}
          stroke="#00ff88"
          strokeWidth="18"
          fill="none"
          strokeLinecap="round"
          filter="url(#snake-glow)"
          opacity="0.3"
          className="snake-body-glow"
        />

        {/* Snake body - main */}
        <path
          d={generateSnakePath()}
          stroke="url(#snake-body-gradient)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          filter="url(#snake-glow)"
          className="snake-body-main"
        />

        {/* Snake body - scale pattern overlay */}
        <path
          d={generateSnakePath()}
          stroke="url(#snake-scales)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          className="snake-scales"
          opacity="0.7"
        />

        {/* Snake body - center highlight */}
        <path
          d={generateSnakePath()}
          stroke="#88ffcc"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
          className="snake-highlight"
        />

        {/* Animated shimmer traveling along snake */}
        <path
          d={generateSnakePath()}
          stroke="url(#snake-shimmer)"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          className="snake-shimmer"
        />

        {/* Snake head */}
        <g
          className="snake-head"
          transform={`translate(${headPos.x}, ${headPos.y}) rotate(${headPos.rotation})`}
        >
          {/* Head shape - pointed oval */}
          <ellipse
            cx="12"
            cy="0"
            rx="16"
            ry="10"
            fill="#00ff88"
            filter="url(#snake-glow-strong)"
          />

          {/* Head gradient overlay */}
          <ellipse
            cx="12"
            cy="0"
            rx="15"
            ry="9"
            fill="url(#snake-body-gradient)"
          />

          {/* Snout */}
          <ellipse
            cx="24"
            cy="0"
            rx="8"
            ry="6"
            fill="#00ff88"
          />

          {/* Eyes */}
          <g className="snake-eyes">
            {/* Left eye */}
            <circle cx="8" cy="-4" r="3" fill="#0a0e14" />
            <circle cx="9" cy="-4.5" r="1.5" fill="#ffff00" className="eye-glow" />
            <circle cx="9.5" cy="-5" r="0.5" fill="#ffffff" />

            {/* Right eye */}
            <circle cx="8" cy="4" r="3" fill="#0a0e14" />
            <circle cx="9" cy="4.5" r="1.5" fill="#ffff00" className="eye-glow" />
            <circle cx="9.5" cy="5" r="0.5" fill="#ffffff" />
          </g>

          {/* Nostrils */}
          <circle cx="26" cy="-2" r="1" fill="#006644" />
          <circle cx="26" cy="2" r="1" fill="#006644" />

          {/* Forked tongue */}
          <g className="snake-tongue">
            <path
              d="M 30,0 L 45,0 L 52,-4 M 45,0 L 52,4"
              stroke="#ff3366"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              filter="url(#snake-glow)"
            />
          </g>
        </g>

        {/* Connection node indicators at player positions */}
        <g className="player-nodes">
          {/* Left node */}
          <circle cx="60" cy={height / 2} r="4" fill="#00ff88" filter="url(#snake-glow)" opacity="0.6" />

          {/* Center node (if 3 players) */}
          {playerCount >= 3 && (
            <circle cx={width / 2} cy={height / 2} r="4" fill="#00ff88" filter="url(#snake-glow)" opacity="0.6" />
          )}

          {/* Right node */}
          <circle cx={width - 60} cy={height / 2} r="4" fill="#00ff88" filter="url(#snake-glow)" opacity="0.6" />
        </g>
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

        /* Slithering wave animation for snake body */
        @keyframes snake-slither {
          0%, 100% {
            d: path("M 60,40 C 150,24 250,56 350,40 C 450,24 550,56 740,40");
          }
          25% {
            d: path("M 60,40 C 150,48 250,32 350,40 C 450,48 550,32 740,40");
          }
          50% {
            d: path("M 60,40 C 150,56 250,24 350,40 C 450,56 550,24 740,40");
          }
          75% {
            d: path("M 60,40 C 150,32 250,48 350,40 C 450,32 550,48 740,40");
          }
        }

        /* Body glow pulse */
        @keyframes body-pulse {
          0%, 100% {
            opacity: 0.3;
            stroke-width: 18px;
          }
          50% {
            opacity: 0.5;
            stroke-width: 22px;
          }
        }

        .snake-body-glow {
          animation: body-pulse 3s ease-in-out infinite;
        }

        /* Tongue flick animation */
        @keyframes tongue-flick {
          0%, 70%, 100% {
            transform: scaleX(0);
            opacity: 0;
          }
          75%, 85% {
            transform: scaleX(1);
            opacity: 1;
          }
          80% {
            transform: scaleX(1.2);
            opacity: 1;
          }
        }

        .snake-tongue {
          transform-origin: 30px 0;
          animation: tongue-flick 3s ease-in-out infinite;
        }

        /* Eye glow pulse */
        @keyframes eye-glow {
          0%, 100% {
            fill: #ffff00;
            filter: none;
          }
          50% {
            fill: #ffff88;
            filter: drop-shadow(0 0 3px #ffff00);
          }
        }

        .eye-glow {
          animation: eye-glow 2s ease-in-out infinite;
        }

        /* Subtle head bob */
        @keyframes head-bob {
          0%, 100% {
            transform: translate(var(--head-x, 400px), var(--head-y, 40px)) rotate(var(--head-rot, 0deg));
          }
          50% {
            transform: translate(var(--head-x, 400px), calc(var(--head-y, 40px) + 2px)) rotate(var(--head-rot, 0deg));
          }
        }

        /* Scale shimmer */
        @keyframes scale-shimmer {
          0% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            opacity: 0.5;
          }
        }

        .snake-scales {
          animation: scale-shimmer 4s ease-in-out infinite;
        }

        /* Draw-in animation on mount */
        .snake-body-main {
          stroke-dasharray: 2000;
          stroke-dashoffset: 2000;
          animation: snake-draw 1.5s ease-out forwards;
        }

        @keyframes snake-draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .snake-body-glow,
          .snake-tongue,
          .eye-glow,
          .snake-scales,
          .snake-body-main {
            animation: none !important;
          }

          .snake-tongue {
            transform: scaleX(0.8);
            opacity: 0.7;
          }

          .snake-body-main {
            stroke-dasharray: none;
            stroke-dashoffset: 0;
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
