// /src/components/Dashboard/WeeklyChallenges/ProgressBar.jsx
// Animated progress bar using Framer Motion spring physics

import { motion } from 'framer-motion';

export default function ProgressBar({ current, target }) {
  const percentage = Math.min((current / target) * 100, 100);

  return (
    <div style={{
      height: '6px',
      background: '#21262d',
      borderRadius: '3px',
      overflow: 'hidden',
    }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        style={{
          height: '100%',
          background: percentage >= 100
            ? 'linear-gradient(90deg, #10b981, #34d399)'
            : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
          borderRadius: '3px',
        }}
      />
    </div>
  );
}
