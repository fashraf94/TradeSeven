// /src/components/shared/TapGlint.jsx
// Reusable metallic sweep overlay — triggers on each tap via key-based remount

import { motion } from 'framer-motion';

export default function TapGlint({ triggerKey }) {
  return (
    <motion.div
      key={triggerKey}
      initial={{ x: '-100%' }}
      animate={{ x: '200%' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 50%, transparent 60%)',
        zIndex: 10,
      }}
    />
  );
}
