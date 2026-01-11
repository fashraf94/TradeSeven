import { motion } from 'framer-motion';
import { designColors } from '../designConstants';

export default function EmptyState({
  icon = '📋',
  title,
  message,
  actionLabel,
  onAction,
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      textAlign: 'center',
    }}>
      <span style={{ fontSize: '48px', marginBottom: '16px' }}>
        {icon}
      </span>

      {title && (
        <h3 style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: designColors.textPrimary,
          marginBottom: '8px',
        }}>
          {title}
        </h3>
      )}

      {message && (
        <p style={{
          fontSize: '14px',
          color: designColors.textSecondary,
          marginBottom: '20px',
        }}>
          {message}
        </p>
      )}

      {onAction && actionLabel && (
        <motion.button
          onClick={onAction}
          whileTap={{ scale: 0.97 }}
          style={{
            padding: '12px 24px',
            backgroundColor: designColors.cyan,
            color: designColors.bgPrimary,
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </motion.button>
      )}
    </div>
  );
}
