import React from 'react';

/**
 * SnakeConduit - Glowing Neon Lines Connecting Players
 *
 * SVG-based curved lines with green neon glow that connect
 * player panels in an arc formation. Desktop only.
 * Features animated traveling glow effect.
 */

const SnakeConduit = ({
  width = 800,
  height = 60,
  playerCount = 3,
  activeIndex = -1, // Which segment should glow brighter (-1 = none)
}) => {
  // Generate path based on player count
  const generatePath = () => {
    if (playerCount === 3) {
      // Curved arc connecting 3 players
      // Left player -> Center player -> Right player
      return `M 80,${height / 2}
              Q ${width * 0.25},${height * 0.2} ${width * 0.4},${height / 2}
              L ${width * 0.6},${height / 2}
              Q ${width * 0.75},${height * 0.8} ${width - 80},${height / 2}`;
    }
    if (playerCount === 4) {
      // For 4 players - more complex path
      const segment = width / 4;
      return `M 60,${height / 2}
              Q ${segment},${height * 0.3} ${segment * 1.5},${height / 2}
              L ${segment * 2.5},${height / 2}
              Q ${segment * 3},${height * 0.7} ${width - 60},${height / 2}`;
    }
    // Default: simple curved line
    return `M 60,${height / 2} Q ${width / 2},${height * 0.2} ${width - 60},${height / 2}`;
  };

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
          {/* Glow filter */}
          <filter id="conduit-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Stronger glow for active segments */}
          <filter id="conduit-glow-active" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Animated gradient for traveling glow */}
          <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00ff88" stopOpacity="0.3">
              <animate
                attributeName="offset"
                values="-0.5;1"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="10%" stopColor="#00ff88" stopOpacity="1">
              <animate
                attributeName="offset"
                values="-0.4;1.1"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="20%" stopColor="#00ff88" stopOpacity="0.3">
              <animate
                attributeName="offset"
                values="-0.3;1.2"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>

          {/* Static gradient for base line */}
          <linearGradient id="base-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00ff88" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#00ffff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00ff88" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Background path (dimmer) */}
        <path
          d={generatePath()}
          stroke="url(#base-gradient)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          filter="url(#conduit-glow)"
          opacity="0.5"
        />

        {/* Main conduit path */}
        <path
          d={generatePath()}
          stroke="#00ff88"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          filter="url(#conduit-glow)"
          className="conduit-main"
        />

        {/* Animated flow overlay */}
        <path
          d={generatePath()}
          stroke="url(#flow-gradient)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          className="conduit-flow"
        />

        {/* Connection nodes at player positions */}
        <g className="connection-nodes">
          {/* Left node */}
          <circle
            cx="80"
            cy={height / 2}
            r="6"
            fill="#00ff88"
            filter="url(#conduit-glow)"
            className="node-pulse"
          />
          <circle cx="80" cy={height / 2} r="3" fill="#ffffff" />

          {/* Center node */}
          <circle
            cx={width / 2}
            cy={height / 2}
            r="8"
            fill={activeIndex === 1 ? '#00ffff' : '#00ff88'}
            filter={activeIndex === 1 ? 'url(#conduit-glow-active)' : 'url(#conduit-glow)'}
            className={activeIndex === 1 ? 'node-active' : 'node-pulse'}
          />
          <circle cx={width / 2} cy={height / 2} r="4" fill="#ffffff" />

          {/* Right node */}
          <circle
            cx={width - 80}
            cy={height / 2}
            r="6"
            fill="#00ff88"
            filter="url(#conduit-glow)"
            className="node-pulse"
          />
          <circle cx={width - 80} cy={height / 2} r="3" fill="#ffffff" />
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

        @keyframes node-pulse {
          0%, 100% {
            opacity: 0.8;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }

        @keyframes node-active-pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.3);
          }
        }

        .node-pulse {
          animation: node-pulse 2s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }

        .node-active {
          animation: node-active-pulse 1s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }

        .conduit-main {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: draw-line 2s ease-out forwards;
        }

        @keyframes draw-line {
          to {
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
