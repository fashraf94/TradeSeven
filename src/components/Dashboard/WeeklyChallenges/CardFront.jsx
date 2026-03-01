// Front face of tarot-style challenge card
// Tall 1:2 layout with silhouette centerpiece, name, mode badge, and state-specific content

import { motion } from 'framer-motion';
import ProgressBar from './ProgressBar';
import WarriorSilhouette from './Silhouettes/WarriorSilhouette';
import SnakeSilhouette from './Silhouettes/SnakeSilhouette';
import JesterSilhouette from './Silhouettes/JesterSilhouette';
import ChampionSilhouette from './Silhouettes/ChampionSilhouette';
import { getDifficultyColor, getTimeUntilMidnight } from './challengeDefinitions';
import { useIsMobile } from '../../../hooks/useIsMobile';

const SILHOUETTE_MAP = {
  classic: WarriorSilhouette,
  snake: SnakeSilhouette,
  wildcard: JesterSilhouette,
  universal: ChampionSilhouette,
};

export default function CardFront({ challenge, state, progress, accentColor, cardHeight = 320 }) {
  const diffColor = getDifficultyColor(challenge.difficulty);
  const progressValue = progress || 0;
  const SilhouetteComponent = SILHOUETTE_MAP[challenge.slot] || SILHOUETTE_MAP[challenge.gameMode] || WarriorSilhouette;
  const isLocked = state === 'locked';
  const isCompleted = state === 'completed';
  const { isMobile } = useIsMobile();

  // Scale silhouette based on card height (base is 320px)
  const silhouetteScale = Math.min(1, cardHeight / 320);
  // Reduce padding on smaller cards
  const isMobileCard = cardHeight < 310;

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '10px 12px',
      filter: isLocked ? 'grayscale(0.7)' : 'none',
      opacity: isLocked ? 0.5 : 1,
      transition: 'filter 0.3s, opacity 0.3s',
    }}>
      {/* Center: Silhouette area */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: '100%',
        minHeight: 0,
        height: isMobileCard ? '90px' : '110px',
        marginBottom: isMobile ? '8px' : '0px',
      }}>
        {/* Silhouette with glow - scaled for card size */}
        <div style={{
          filter: isCompleted ? 'brightness(0.6) saturate(0.3)' : 'none',
          transform: isMobile ? `scale(${silhouetteScale * 0.85}) translateY(-6px)` : `scale(${silhouetteScale})`,
          transformOrigin: 'center center',
        }}>
          <SilhouetteComponent color={accentColor} />
        </div>

        {/* Completed overlay */}
        {isCompleted && (
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 10 }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(16, 185, 129, 0.4)',
                  '0 0 0 20px rgba(16, 185, 129, 0)',
                ],
              }}
              transition={{ duration: 0.6, repeat: 2 }}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
              }}
            >
              ✅
            </motion.div>
          </motion.div>
        )}

        {/* Locked overlay */}
        {isLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.4 }}
              style={{ textAlign: 'center' }}
            >
              <span style={{ fontSize: '28px' }}>🔒</span>
              <p style={{
                color: '#8b949e',
                fontSize: '10px',
                margin: '4px 0 0',
              }}>
                Available tomorrow
              </p>
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Bottom: Name, badge, progress */}
      <div style={{
        width: '100%',
        textAlign: 'center',
        flexShrink: 0, // Prevent bottom section from shrinking
      }}>
        {/* Challenge name */}
        <div style={{
          fontSize: isMobileCard ? '11px' : '13px',
          fontWeight: '700',
          color: isCompleted ? '#10b981' : '#e6edf3',
          marginBottom: isMobileCard ? '4px' : '6px',
          lineHeight: 1.2,
        }}>
          {challenge.name}
        </div>

        {/* Mode badge */}
        {!isCompleted && (
          <div style={{
            display: 'inline-block',
            background: `${accentColor}22`,
            border: `1px solid ${accentColor}44`,
            color: accentColor,
            fontSize: isMobileCard ? '8px' : '9px',
            fontWeight: '700',
            padding: isMobileCard ? '2px 6px' : '2px 8px',
            borderRadius: '4px',
            marginBottom: isMobileCard ? '6px' : '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {challenge.slotLabel}
          </div>
        )}

        {/* Completed badge */}
        {isCompleted && (
          <div style={{
            color: '#10b981',
            fontSize: isMobileCard ? '10px' : '11px',
            fontWeight: '700',
            marginBottom: '4px',
          }}>
            ✓ COMPLETED • +{challenge.xp} XP
          </div>
        )}

        {/* Active: progress bar + timer */}
        {state === 'active' && (
          <div style={{ width: '100%' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: '#8b949e',
              marginBottom: '4px',
            }}>
              <span>Progress</span>
              <span style={{ color: '#e6edf3', fontWeight: '600' }}>
                {progressValue}/{challenge.target}
              </span>
            </div>
            <ProgressBar current={progressValue} target={challenge.target} />
            <div style={{
              marginTop: '6px',
              fontSize: '10px',
              color: '#8b949e',
            }}>
              ⏱️ {getTimeUntilMidnight()}
            </div>
          </div>
        )}

        {/* Available: XP reward + difficulty */}
        {state === 'available' && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span style={{
              fontSize: '10px',
              fontWeight: '700',
              color: diffColor,
              textTransform: 'uppercase',
            }}>
              {challenge.difficulty}
            </span>
            <span style={{ fontSize: '9px', color: '#6e7681' }}>•</span>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: accentColor,
            }}>
              +{challenge.xp} XP
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
