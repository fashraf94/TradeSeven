import { motion } from 'framer-motion';
import { designColors } from '../designConstants';

export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{
          width: '32px',
          height: '32px',
          border: `3px solid ${designColors.borderDefault}`,
          borderTopColor: designColors.cyan,
          borderRadius: '50%',
          marginBottom: '16px',
        }}
      />
      <span style={{
        fontSize: '14px',
        color: designColors.textSecondary,
      }}>
        {message}
      </span>
    </div>
  );
}
