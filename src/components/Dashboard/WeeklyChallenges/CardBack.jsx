// /src/components/Dashboard/WeeklyChallenges/CardBack.jsx
// Back face of challenge card - description + ACCEPT button

import { motion } from 'framer-motion';
import { getDifficultyColor } from './challengeDefinitions';

export default function CardBack({ challenge, onAccept }) {
  const diffColor = getDifficultyColor(challenge.difficulty);

  return (
    <div style={{
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '72px',
      gap: '12px',
    }}>
      <p style={{
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: '13px',
        margin: 0,
        textAlign: 'center',
        lineHeight: 1.5,
      }}>
        {challenge.description}
      </p>

      <div style={{
        fontSize: '11px',
        color: '#8b949e',
        textAlign: 'center',
      }}>
        Difficulty:{' '}
        <span style={{
          color: diffColor,
          fontWeight: '700',
          textTransform: 'uppercase',
        }}>
          {challenge.difficulty}
        </span>
        {' • '}
        <span style={{ color: '#a78bfa', fontWeight: '700' }}>
          {challenge.xp} XP
        </span>
      </div>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={(e) => {
          e.stopPropagation();
          onAccept();
        }}
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
          color: '#fff',
          border: 'none',
          padding: '10px 24px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '700',
          cursor: 'pointer',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}
      >
        ACCEPT CHALLENGE
      </motion.button>
    </div>
  );
}
