import React, { useState, useEffect, useRef } from 'react';

/**
 * RosterGauges - Circular "Roster Power Cores" Gauges
 *
 * Three circular progress gauges showing pick progress for each category.
 * Features progress rings that fill as picks are made with glow effects.
 * Includes animated fill transitions and celebration effects.
 */

const RosterGauges = ({
  steady = { picked: 0, required: 3 },
  risky = { picked: 0, required: 3 },
  defensive = { picked: 0, required: 3 },
  onGaugeClick,
}) => {
  // Track previous values for animation triggers
  const prevValuesRef = useRef({ steady: 0, risky: 0, defensive: 0 });
  const [flashingGauge, setFlashingGauge] = useState(null);
  const [celebratingGauge, setCelebratingGauge] = useState(null);

  // Detect value changes and trigger animations
  useEffect(() => {
    const checkChange = (key, currentPicked, required) => {
      const prev = prevValuesRef.current[key];
      if (currentPicked > prev) {
        // Value increased - trigger flash
        setFlashingGauge(key);
        setTimeout(() => setFlashingGauge(null), 400);

        // Check for completion celebration
        if (currentPicked >= required && prev < required) {
          setCelebratingGauge(key);
          setTimeout(() => setCelebratingGauge(null), 1000);
        }
      }
      prevValuesRef.current[key] = currentPicked;
    };

    checkChange('steady', steady.picked, steady.required);
    checkChange('risky', risky.picked, risky.required);
    checkChange('defensive', defensive.picked, defensive.required);
  }, [steady.picked, risky.picked, defensive.picked, steady.required, risky.required, defensive.required]);
  // Category configurations
  const categories = [
    {
      key: 'steady',
      letter: 'S',
      label: 'Steady',
      color: '#00ffff',      // Cyan
      glowColor: 'rgba(0, 255, 255, 0.5)',
      bgColor: 'rgba(0, 255, 255, 0.1)',
      data: steady,
    },
    {
      key: 'risky',
      letter: 'R',
      label: 'Risky',
      color: '#f59e0b',      // Amber/Orange
      glowColor: 'rgba(245, 158, 11, 0.5)',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      data: risky,
    },
    {
      key: 'defensive',
      letter: 'D',
      label: 'Defensive',
      color: '#10b981',      // Green
      glowColor: 'rgba(16, 185, 129, 0.5)',
      bgColor: 'rgba(16, 185, 129, 0.1)',
      data: defensive,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      {categories.map(({ key, letter, label, color, glowColor, bgColor, data }) => {
        const progress = data.required > 0 ? data.picked / data.required : 0;
        const isComplete = data.picked >= data.required;
        const progressDegrees = progress * 360;
        const isFlashing = flashingGauge === key;
        const isCelebrating = celebratingGauge === key;

        return (
          <div
            key={key}
            onClick={() => onGaugeClick?.(key)}
            className={`gauge-container ${isFlashing ? 'gauge-flash' : ''} ${isCelebrating ? 'gauge-celebrate' : ''}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '8px 14px',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: `1.5px solid ${color}40`,
              boxShadow: data.picked > 0
                ? `0 0 ${4 + data.picked * 4}px ${color}${isComplete ? '40' : '25'}, inset 0 0 8px ${color}08`
                : 'none',
              cursor: onGaugeClick ? 'pointer' : 'default',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              if (onGaugeClick) {
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isCelebrating) {
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
            title={`${label}: ${data.picked}/${data.required}`}
          >
            {/* Circular Gauge */}
            <div
              style={{
                position: 'relative',
                width: '52px',
                height: '52px',
              }}
            >
              {/* Outer glow ring */}
              <div
                style={{
                  position: 'absolute',
                  inset: '-2px',
                  borderRadius: '50%',
                  background: `conic-gradient(
                    ${glowColor} 0deg,
                    ${glowColor} ${progressDegrees}deg,
                    transparent ${progressDegrees}deg,
                    transparent 360deg
                  )`,
                  filter: 'blur(4px)',
                  opacity: progress > 0 ? 0.8 : 0,
                  transition: 'opacity 0.3s ease',
                }}
              />

              {/* Progress ring background (track) */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '3px solid rgba(255, 255, 255, 0.1)',
                }}
              />

              {/* Progress ring (filled portion) - Animated fill */}
              <div
                className="gauge-progress-ring"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: `conic-gradient(
                    ${color} 0deg,
                    ${color} ${progressDegrees}deg,
                    transparent ${progressDegrees}deg,
                    transparent 360deg
                  )`,
                  mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), black calc(100% - 4px))',
                  WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), black calc(100% - 4px))',
                  transition: 'background 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  filter: isFlashing ? 'brightness(1.5)' : 'none',
                }}
              />

              {/* Inner circle with letter */}
              <div
                style={{
                  position: 'absolute',
                  inset: '6px',
                  borderRadius: '50%',
                  background: bgColor,
                  border: `1px solid ${color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isComplete
                    ? `inset 0 0 15px ${glowColor}`
                    : 'none',
                  transition: 'box-shadow 0.3s ease',
                }}
              >
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: '800',
                    color: color,
                    textShadow: isComplete
                      ? `0 0 10px ${color}`
                      : 'none',
                  }}
                >
                  {letter}
                </span>
              </div>

              {/* Completion checkmark overlay */}
              {isComplete && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 10px ${glowColor}`,
                    zIndex: 2,
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#0a0e14',
                      fontWeight: '700',
                    }}
                  >
                    ✓
                  </span>
                </div>
              )}

              {/* Scanline effect */}
              <div
                style={{
                  position: 'absolute',
                  inset: '6px',
                  borderRadius: '50%',
                  background: `repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 2px,
                    rgba(0, 255, 255, 0.02) 2px,
                    rgba(0, 255, 255, 0.02) 4px
                  )`,
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Count label */}
            <div
              style={{
                marginTop: '6px',
                fontSize: '11px',
                fontWeight: '700',
                color: color,
                letterSpacing: '0.5px',
                textShadow: `0 0 8px ${glowColor}`,
              }}
            >
              {data.picked}/{data.required}
            </div>
          </div>
        );
      })}

      {/* Label below gauges */}
      <div
        style={{
          fontSize: '9px',
          color: '#6e7681',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
          letterSpacing: '0.5px',
          marginLeft: '4px',
        }}
      >
        ROSTER CORES
      </div>

      {/* Animations and classes consolidated in index.css: gauge-flash, gauge-celebrate, .gauge-flash, .gauge-celebrate */}
    </div>
  );
};

/**
 * Alternative compact version for mobile
 */
export const RosterGaugesCompact = ({
  steady = { picked: 0, required: 3 },
  risky = { picked: 0, required: 3 },
  defensive = { picked: 0, required: 3 },
  onGaugeClick,
}) => {
  const categories = [
    { key: 'steady', letter: 'S', color: '#00ffff', data: steady },
    { key: 'risky', letter: 'R', color: '#f59e0b', data: risky },
    { key: 'defensive', letter: 'D', color: '#10b981', data: defensive },
  ];

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {categories.map(({ key, letter, color, data }) => {
        const isComplete = data.picked >= data.required;

        return (
          <div
            key={key}
            onClick={() => onGaugeClick?.(key)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: `${color}15`,
              border: `2px solid ${isComplete ? color : `${color}40`}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: onGaugeClick ? 'pointer' : 'default',
              boxShadow: isComplete
                ? `0 0 15px ${color}50`
                : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: '700',
                color: color,
              }}
            >
              {letter}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: '600',
                color: color,
                opacity: 0.8,
              }}
            >
              {data.picked}/{data.required}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default RosterGauges;
