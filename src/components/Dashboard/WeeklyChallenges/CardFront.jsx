// /src/components/Dashboard/WeeklyChallenges/CardFront.jsx
// Front face of challenge card - shows different content per state

import { motion } from 'framer-motion';
import ProgressBar from './ProgressBar';
import { getDifficultyColor, getGameModeColor, getTimeUntilMidnight } from './challengeDefinitions';

export default function CardFront({ challenge, state, progress }) {
  const gameModeColor = getGameModeColor(challenge.gameMode);
  const diffColor = getDifficultyColor(challenge.difficulty);
  const progressValue = progress || 0;

  return (
    <div style={{ padding: '14px', minHeight: '72px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Icon */}
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          background: state === 'completed'
            ? 'rgba(16, 185, 129, 0.2)'
            : `${gameModeColor}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          flexShrink: 0,
        }}>
          {state === 'completed' ? '✅' : challenge.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '4px',
            flexWrap: 'wrap',
          }}>
            <span style={{
              color: state === 'completed' ? '#10b981' : '#e6edf3',
              fontWeight: '600',
              fontSize: '14px',
            }}>
              {challenge.name}
            </span>
            {state !== 'completed' && (
              <span style={{
                background: gameModeColor,
                color: '#000',
                fontSize: '9px',
                fontWeight: '700',
                padding: '2px 5px',
                borderRadius: '4px',
              }}>
                {challenge.slotLabel}
              </span>
            )}
          </div>

          {/* Available: show difficulty badge */}
          {state === 'available' && (
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 6px',
              borderRadius: '4px',
              background: `${diffColor}22`,
              color: diffColor,
              textTransform: 'uppercase',
            }}>
              {challenge.difficulty}
            </span>
          )}

          {/* Active: show progress bar and timer */}
          {state === 'active' && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}>
                <span style={{ fontSize: '11px', color: '#8b949e' }}>Progress</span>
                <span style={{ fontSize: '11px', color: '#e6edf3', fontWeight: '600' }}>
                  {progressValue} / {challenge.target}
                </span>
              </div>
              <ProgressBar current={progressValue} target={challenge.target} />
              <div style={{
                marginTop: '6px',
                fontSize: '11px',
                color: '#8b949e',
              }}>
                ⏱️ Resets in {getTimeUntilMidnight()}
              </div>
            </div>
          )}

          {/* Completed: show checkmark with celebration animation */}
          {state === 'completed' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 10 }}
            >
              <motion.span
                animate={{
                  boxShadow: [
                    '0 0 0 0 rgba(16, 185, 129, 0.4)',
                    '0 0 0 8px rgba(16, 185, 129, 0)',
                  ],
                }}
                transition={{ duration: 0.6, repeat: 2 }}
                style={{
                  fontSize: '12px',
                  color: '#10b981',
                  fontWeight: '600',
                  display: 'inline-block',
                }}
              >
                ✓ COMPLETED
              </motion.span>
            </motion.div>
          )}
        </div>

        {/* Right side: XP reward */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {state === 'completed' ? (
            <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '700' }}>
              +{challenge.xp} XP
            </span>
          ) : (
            <span style={{ color: diffColor, fontSize: '13px', fontWeight: '700' }}>
              +{challenge.xp}
            </span>
          )}
        </div>

        {/* Flip hint chevron for available cards */}
        {state === 'available' && (
          <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '14px' }}>▼</span>
        )}
      </div>
    </div>
  );
}
