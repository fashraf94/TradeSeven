// /src/components/Dashboard/SlotMachineOverlay.jsx

import React from 'react';
import { motion } from 'framer-motion';

/**
 * SlotMachineOverlay - Weekly challenges reveal animation
 * Shows slot-machine style reveal of new weekly challenges
 *
 * @param {Object} props
 * @param {boolean} props.show - Whether to show the overlay
 * @param {Array} props.challenges - Array of weekly challenge objects
 * @param {Function} props.onClose - Handler to close overlay
 * @param {Function} props.getGameModeColor - Function to get color for game mode
 * @param {Function} props.getDifficultyColor - Function to get color for difficulty
 * @param {Object} props.colors - Design tokens
 */
const SlotMachineOverlay = ({
  show,
  challenges,
  onClose,
  getGameModeColor,
  getDifficultyColor,
  colors
}) => {
  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px'
      }}
    >
      <motion.h2
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          color: '#fff',
          fontSize: '24px',
          fontWeight: '700',
          marginBottom: '8px',
          textAlign: 'center'
        }}
      >
        NEW WEEKLY CHALLENGES
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '14px',
          marginBottom: '32px'
        }}
      >
        Your challenges for this week are...
      </motion.p>

      {/* Slot Reels */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        maxWidth: '350px'
      }}>
        {challenges.map((challenge, index) => (
          <motion.div
            key={challenge.id}
            initial={{ x: -300, opacity: 0, rotateY: 90 }}
            animate={{ x: 0, opacity: 1, rotateY: 0 }}
            transition={{
              delay: 0.8 + (index * 0.4),
              type: 'spring',
              stiffness: 100,
              damping: 15
            }}
            style={{
              background: `linear-gradient(135deg, ${getGameModeColor(challenge.gameMode)}22, ${colors.cardBg})`,
              border: `2px solid ${getGameModeColor(challenge.gameMode)}`,
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '12px',
              background: `${getGameModeColor(challenge.gameMode)}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              {challenge.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <span style={{
                  color: '#fff',
                  fontWeight: '700',
                  fontSize: '14px'
                }}>
                  {challenge.name}
                </span>
                <span style={{
                  background: getDifficultyColor(challenge.difficulty),
                  color: '#000',
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}>
                  {challenge.difficulty}
                </span>
              </div>
              <p style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: '12px',
                margin: 0
              }}>
                {challenge.slotLabel}
              </p>
            </div>
            <div style={{
              color: getGameModeColor(challenge.gameMode),
              fontWeight: '700',
              fontSize: '14px'
            }}>
              +{challenge.xp} XP
            </div>
          </motion.div>
        ))}
      </div>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.8 }}
        onClick={onClose}
        style={{
          marginTop: '32px',
          background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
          color: '#fff',
          border: 'none',
          padding: '16px 48px',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: '700',
          cursor: 'pointer'
        }}
      >
        LET'S GO!
      </motion.button>
    </motion.div>
  );
};

export default SlotMachineOverlay;
