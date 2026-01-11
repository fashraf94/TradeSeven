import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { designColors } from '../designConstants';

export default function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again',
  onRetry,
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
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
      }}>
        <AlertTriangle size={28} color={designColors.red} />
      </div>

      <h3 style={{
        fontSize: '16px',
        fontWeight: 'bold',
        color: designColors.textPrimary,
        marginBottom: '8px',
      }}>
        {title}
      </h3>

      <p style={{
        fontSize: '14px',
        color: designColors.textSecondary,
        marginBottom: '20px',
      }}>
        {message}
      </p>

      {onRetry && (
        <motion.button
          onClick={onRetry}
          whileTap={{ scale: 0.97 }}
          style={{
            padding: '10px 20px',
            backgroundColor: designColors.bgCard,
            border: `1px solid ${designColors.borderDefault}`,
            borderRadius: '8px',
            color: designColors.textPrimary,
            cursor: 'pointer',
          }}
        >
          Try Again
        </motion.button>
      )}
    </div>
  );
}
