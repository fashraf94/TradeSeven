// Back face of tarot-style challenge card
// Description, difficulty, reward, ACCEPT button - tall centered layout

import { motion } from 'framer-motion';
import { getDifficultyColor } from './challengeDefinitions';

export default function CardBack({ challenge, accentColor, onAccept }) {
  const diffColor = getDifficultyColor(challenge.difficulty);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 12px',
      gap: '10px',
      textAlign: 'center',
    }}>
      {/* Challenge icon */}
      <span style={{ fontSize: '24px' }}>{challenge.icon}</span>

      {/* Description */}
      <p style={{
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: '12px',
        margin: 0,
        lineHeight: 1.5,
        maxWidth: '140px',
      }}>
        {challenge.description}
      </p>

      {/* Divider */}
      <div style={{
        width: '60%',
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${accentColor}66, transparent)`,
      }} />

      {/* Difficulty + reward */}
      <div style={{ fontSize: '11px', color: '#8b949e' }}>
        <div style={{ marginBottom: '4px' }}>
          Difficulty:{' '}
          <span style={{
            color: diffColor,
            fontWeight: '700',
            textTransform: 'uppercase',
          }}>
            {challenge.difficulty}
          </span>
        </div>
        <div>
          Reward:{' '}
          <span style={{ color: accentColor, fontWeight: '700' }}>
            +{challenge.xp} XP
          </span>
        </div>
      </div>

      {/* Accept button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={(e) => {
          e.stopPropagation();
          onAccept();
        }}
        style={{
          background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
          color: '#fff',
          border: 'none',
          padding: '8px 20px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: '800',
          cursor: 'pointer',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          boxShadow: `0 0 20px ${accentColor}44`,
        }}
      >
        ACCEPT
      </motion.button>
    </div>
  );
}
