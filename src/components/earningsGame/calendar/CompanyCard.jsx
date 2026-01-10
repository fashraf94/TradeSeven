import { motion } from 'framer-motion';
import { designColors, fontMono } from '../designConstants';

export default function CompanyCard({
  symbol,
  companyName,
  reportTime,      // 'BMO' | 'AMC'
  beatOdds,        // 0-1
  isPicked = false,
  onAdd,
  onView,
  isDesktop = false,
}) {
  const handleClick = () => {
    if (isPicked) {
      onView?.();
    } else {
      onAdd?.();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        backgroundColor: designColors.bgCardInner,
        borderColor: isPicked ? designColors.green : designColors.cyan,
      }}
      onClick={handleClick}
      style={{
        padding: '12px',
        backgroundColor: designColors.bgCard,
        border: `1px solid ${isPicked ? designColors.green : designColors.borderDefault}`,
        borderRadius: '10px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: isDesktop ? '140px' : 'auto',
      }}
    >
      {/* Top row: Ticker + Report Time Badge */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <span style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: designColors.textPrimary,
        }}>
          {symbol}
        </span>
        <span style={{
          fontSize: '10px',
          fontWeight: 'bold',
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: reportTime === 'BMO' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(139, 92, 246, 0.2)',
          color: reportTime === 'BMO' ? '#fbbf24' : '#a78bfa',
        }}>
          {reportTime}
        </span>
      </div>

      {/* Company name (truncated) */}
      <span style={{
        fontSize: '11px',
        color: designColors.textSecondary,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {companyName}
      </span>

      {/* Bottom row: Beat odds or Picked indicator */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '4px',
      }}>
        {isPicked ? (
          <span style={{
            fontSize: '11px',
            fontWeight: 'bold',
            color: designColors.green,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            ✓ PICKED
          </span>
        ) : (
          <span style={{
            fontSize: '12px',
            color: designColors.textSecondary,
          }}>
            <span style={{
              fontFamily: fontMono,
              color: designColors.cyan,
              fontWeight: 'bold',
            }}>
              {Math.round(beatOdds * 100)}%
            </span>
            {' '}beat
          </span>
        )}

        {/* Action indicator */}
        <span style={{
          fontSize: '16px',
          color: isPicked ? designColors.green : designColors.cyan,
        }}>
          {isPicked ? '→' : '+'}
        </span>
      </div>
    </motion.div>
  );
}
