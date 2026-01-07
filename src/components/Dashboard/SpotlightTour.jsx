// /src/components/Dashboard/SpotlightTour.jsx

import React, { useState, useEffect } from 'react';

// Tour constants
const DEFAULT_TOUR_CONSTANTS = {
  Z_INDEX: 9999,
  SPOTLIGHT_PADDING: 8,
  TOOLTIP_HEIGHT: 220,
  TOOLTIP_OFFSET: 16,
  MIN_TOP_MARGIN: 20,
  MAX_BOTTOM_MARGIN: 220,
  ARROW_OFFSET: 6,
  SCROLL_OFFSET_ABOVE: 200,
  SCROLL_OFFSET_BELOW: 100,
  ANIMATION_DELAY: 400
};

/**
 * TourProgressDots - Progress indicator for tour steps
 */
const TourProgressDots = ({ currentStep, totalSteps }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '16px'
  }}>
    {Array.from({ length: totalSteps }).map((_, index) => (
      <div
        key={index}
        style={{
          width: index === currentStep ? '20px' : '6px',
          height: '6px',
          borderRadius: '3px',
          background: index <= currentStep ? '#10b981' : 'rgba(255,255,255,0.2)',
          transition: 'all 0.3s ease'
        }}
      />
    ))}
  </div>
);

/**
 * SpotlightTour - Interactive guided tour with spotlight effect
 * Highlights UI elements and provides step-by-step instructions
 *
 * @param {Object} props
 * @param {boolean} props.show - Whether to show the tour
 * @param {number} props.currentStep - Current step index
 * @param {Array} props.steps - Array of tour step objects
 * @param {Function} props.onNext - Handler for next step
 * @param {Function} props.onBack - Handler for previous step
 * @param {Function} props.onClose - Handler to close tour
 * @param {Function} props.onStartTraining - Handler to start training mode
 * @param {Object} props.constants - Optional tour constants override
 */
const SpotlightTour = ({
  show,
  currentStep: tourStep,
  steps: TOUR_STEPS,
  onNext,
  onBack,
  onClose,
  onStartTraining,
  constants
}) => {
  const TOUR_CONSTANTS = constants || DEFAULT_TOUR_CONSTANTS;

  const [spotlightRect, setSpotlightRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, arrowTop: 0, arrowDirection: 'up' });
  const [isReady, setIsReady] = useState(false);

  const currentStepData = TOUR_STEPS[tourStep];

  // Calculate spotlight position when step changes
  useEffect(() => {
    if (!show) return;

    setIsReady(false);
    setSpotlightRect(null);

    if (!currentStepData?.target) {
      setIsReady(true);
      return;
    }

    const element = document.getElementById(currentStepData.target);
    if (!element) {
      // Silent fallback - element not found, showing centered tooltip
      setSpotlightRect(null);
      setTooltipPos({
        top: window.innerHeight / 2 - 110,
        arrowTop: 0,
        arrowDirection: 'none'
      });
      setIsReady(true);
      return;
    }

    // Scroll element into view
    const rect = element.getBoundingClientRect();
    const absoluteTop = window.pageYOffset + rect.top;

    if (currentStepData.position === 'spotlight-above') {
      const scrollTarget = absoluteTop - window.innerHeight + rect.height + TOUR_CONSTANTS.SCROLL_OFFSET_ABOVE;
      window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
    } else {
      const scrollTarget = absoluteTop - TOUR_CONSTANTS.SCROLL_OFFSET_BELOW;
      window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
    }

    setTimeout(() => {
      const newRect = element.getBoundingClientRect();
      const padding = TOUR_CONSTANTS.SPOTLIGHT_PADDING;

      setSpotlightRect({
        top: newRect.top - padding,
        left: newRect.left - padding,
        width: newRect.width + padding * 2,
        height: newRect.height + padding * 2
      });

      // Calculate tooltip position with clamping
      if (currentStepData.position === 'spotlight-above') {
        const tooltipHeight = TOUR_CONSTANTS.TOOLTIP_HEIGHT;
        const calculatedTop = newRect.top - tooltipHeight - TOUR_CONSTANTS.TOOLTIP_OFFSET;
        setTooltipPos({
          top: Math.max(TOUR_CONSTANTS.MIN_TOP_MARGIN, calculatedTop),
          arrowTop: Math.max(tooltipHeight + TOUR_CONSTANTS.TOOLTIP_OFFSET, newRect.top - TOUR_CONSTANTS.ARROW_OFFSET),
          arrowDirection: 'down'
        });
      } else {
        const calculatedTop = newRect.bottom + TOUR_CONSTANTS.TOOLTIP_OFFSET;
        const maxTop = window.innerHeight - TOUR_CONSTANTS.MAX_BOTTOM_MARGIN;
        setTooltipPos({
          top: Math.min(calculatedTop, maxTop),
          arrowTop: newRect.bottom + TOUR_CONSTANTS.ARROW_OFFSET,
          arrowDirection: 'up'
        });
      }

      setIsReady(true);
    }, TOUR_CONSTANTS.ANIMATION_DELAY);
  }, [show, tourStep, currentStepData, TOUR_CONSTANTS]);

  // Escape key to close tour
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [show, onClose]);

  if (!show || !currentStepData) return null;

  const handleStartTraining = (mode) => {
    onClose();
    if (onStartTraining) {
      onStartTraining(mode);
    }
  };

  // CENTERED MODAL (Welcome and Final steps)
  if (currentStepData.position === 'center') {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.92)',
        zIndex: TOUR_CONSTANTS.Z_INDEX,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'linear-gradient(145deg, #1a2332 0%, #0d1117 100%)',
          borderRadius: '20px',
          border: '2px solid #10b981',
          padding: '32px 28px',
          maxWidth: '380px',
          width: '100%',
          textAlign: 'center'
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: '800', color: '#fff' }}>
            {currentStepData.title}
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: '15px', color: '#9CA3AF', lineHeight: 1.6 }}>
            {currentStepData.description}
          </p>

          {currentStepData.showActions ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => handleStartTraining('classic')} style={{
                padding: '14px', background: 'linear-gradient(135deg, #00d9ff, #0099cc)',
                border: 'none', borderRadius: '10px', color: '#0d1117', fontSize: '15px', fontWeight: '700', cursor: 'pointer'
              }}>⚔️ Try Classic Training</button>
              <button onClick={() => handleStartTraining('draft')} style={{
                padding: '14px', background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer'
              }}>🐍 Try Snake Draft Training</button>
              <button onClick={onClose} style={{
                padding: '12px', background: 'transparent', border: '1px solid #21262d',
                borderRadius: '8px', color: '#6e7681', fontSize: '13px', cursor: 'pointer'
              }}>I'll explore on my own</button>
            </div>
          ) : (
            <button onClick={onNext} style={{
              width: '100%', padding: '14px', background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none', borderRadius: '10px', color: '#fff', fontSize: '16px', fontWeight: '700', cursor: 'pointer'
            }}>Let's Go!</button>
          )}
          <TourProgressDots currentStep={tourStep} totalSteps={TOUR_STEPS.length} />
        </div>
      </div>
    );
  }

  // SPOTLIGHT VIEW - Loading
  if (!isReady) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.88)', zIndex: TOUR_CONSTANTS.Z_INDEX
      }} />
    );
  }

  // SPOTLIGHT VIEW - Ready
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: TOUR_CONSTANTS.Z_INDEX, pointerEvents: 'none'
    }}>
      {/* Dark overlay with spotlight hole */}
      {spotlightRect && (
        <svg style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          pointerEvents: 'auto'
        }} onClick={onClose}>
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={spotlightRect.left} y={spotlightRect.top}
                width={spotlightRect.width} height={spotlightRect.height}
                rx="12" fill="black"
              />
            </mask>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.88)" mask="url(#spotlight-mask)" />
        </svg>
      )}

      {/* If no spotlight (fallback), just show dark overlay */}
      {!spotlightRect && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            pointerEvents: 'auto'
          }}
          onClick={onClose}
        />
      )}

      {/* Green border glow */}
      {spotlightRect && (
        <div style={{
          position: 'absolute',
          top: spotlightRect.top, left: spotlightRect.left,
          width: spotlightRect.width, height: spotlightRect.height,
          borderRadius: '12px',
          border: '2px solid #10b981',
          boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
          pointerEvents: 'none'
        }} />
      )}

      {/* Arrow */}
      {spotlightRect && tooltipPos.arrowDirection !== 'none' && (
        <div style={{
          position: 'absolute',
          top: tooltipPos.arrowTop,
          left: spotlightRect.left + spotlightRect.width / 2 - 10,
          width: 0, height: 0,
          borderLeft: '10px solid transparent',
          borderRight: '10px solid transparent',
          borderBottom: tooltipPos.arrowDirection === 'up' ? '12px solid #1a2332' : 'none',
          borderTop: tooltipPos.arrowDirection === 'down' ? '12px solid #1a2332' : 'none',
          pointerEvents: 'none', zIndex: 10001
        }} />
      )}

      {/* Tooltip */}
      <div style={{
        position: 'absolute',
        top: tooltipPos.top,
        left: '50%', transform: 'translateX(-50%)',
        width: '340px', maxWidth: 'calc(100% - 40px)',
        background: 'linear-gradient(145deg, #1a2332 0%, #0d1117 100%)',
        borderRadius: '16px', border: '1px solid #21262d',
        padding: '20px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        pointerEvents: 'auto', zIndex: 10000
      }} onClick={(e) => e.stopPropagation()}>

        <div style={{
          fontSize: '10px', fontWeight: '700', color: '#10b981',
          marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1.5px'
        }}>
          Step {tourStep} of {TOUR_STEPS.length - 1}
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#fff' }}>
          {currentStepData.title}
        </h3>

        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#9CA3AF', lineHeight: 1.6 }}>
          {currentStepData.description}
        </p>

        <div style={{ display: 'flex', gap: '8px' }}>
          {tourStep > 1 && (
            <button onClick={onBack} style={{
              padding: '10px 16px', background: 'transparent', border: '1px solid #21262d',
              borderRadius: '8px', color: '#9CA3AF', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
            }}>← Back</button>
          )}
          <button onClick={onNext} style={{
            flex: 1, padding: '10px 16px', background: 'linear-gradient(135deg, #10b981, #059669)',
            border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer'
          }}>{tourStep === TOUR_STEPS.length - 2 ? 'Finish' : 'Next'}</button>
        </div>

        <button onClick={onClose} style={{
          width: '100%', marginTop: '10px', padding: '8px',
          background: 'transparent', border: 'none', color: '#6e7681', fontSize: '11px', cursor: 'pointer'
        }}>Skip tour</button>
      </div>

      {/* Progress dots at bottom */}
      <div style={{
        position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '6px', pointerEvents: 'none', zIndex: 10002
      }}>
        {TOUR_STEPS.map((_, index) => (
          <div key={index} style={{
            width: index === tourStep ? '20px' : '6px', height: '6px', borderRadius: '3px',
            background: index <= tourStep ? '#10b981' : 'rgba(255,255,255,0.2)'
          }} />
        ))}
      </div>
    </div>
  );
};

export default SpotlightTour;
