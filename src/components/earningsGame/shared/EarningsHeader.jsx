import { motion } from 'framer-motion';
import { designColors } from '../designConstants';
import { buttonTap } from '../animationPresets';

export default function EarningsHeader({
  title,
  onBack,
  rightElement = null,
  showLive = false,
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px',
      backgroundColor: designColors.bgPrimary,
      borderBottom: `1px solid ${designColors.borderDefault}`,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Left: Back button + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <motion.button
          onClick={onBack}
          whileTap={buttonTap}
          style={{
            background: 'none',
            border: 'none',
            color: designColors.textPrimary,
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          ←
        </motion.button>
        <span style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: designColors.textPrimary,
          letterSpacing: '0.5px',
        }}>
          {title}
        </span>
      </div>

      {/* Right: Optional element or Live indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {showLive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: designColors.red,
              }}
            />
            <span style={{
              fontSize: '12px',
              color: designColors.red,
              fontWeight: 'bold',
            }}>
              LIVE
            </span>
          </div>
        )}
        {rightElement}
      </div>
    </div>
  );
}
