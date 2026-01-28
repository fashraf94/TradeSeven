// /src/components/Dashboard/WeeklyChallenges/LockedOverlay.jsx
// Animated lock overlay for challenges that cannot be accepted today

import { motion } from 'framer-motion';

export default function LockedOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.3 }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '12px',
        zIndex: 5,
      }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.4 }}
        style={{ textAlign: 'center' }}
      >
        <span style={{ fontSize: '24px' }}>🔒</span>
        <p style={{
          color: '#8b949e',
          fontSize: '12px',
          margin: '4px 0 0',
        }}>
          Available tomorrow
        </p>
      </motion.div>
    </motion.div>
  );
}
