import { motion } from 'framer-motion';
import { designColors } from '../designConstants';

export default function RiskProfile({ predictions }) {
  // Count predictions by risk level
  const riskCounts = {
    low: 0,
    medium: 0,
    high: 0,
    extreme: 0,
  };

  predictions.forEach(pred => {
    const level = pred.risk?.level || 'medium';
    if (riskCounts[level] !== undefined) {
      riskCounts[level]++;
    }
  });

  const maxCount = Math.max(...Object.values(riskCounts), 1);

  const riskConfig = [
    { key: 'low', label: 'Low', color: designColors.green },
    { key: 'medium', label: 'Med', color: designColors.cyan },
    { key: 'high', label: 'High', color: designColors.orange },
    { key: 'extreme', label: 'Ext', color: designColors.red },
  ];

  return (
    <div style={{
      padding: '16px',
      backgroundColor: designColors.bgCard,
      borderRadius: '12px',
      border: `1px solid ${designColors.borderDefault}`,
    }}>
      {/* Header */}
      <div style={{
        fontSize: '12px',
        fontWeight: 'bold',
        color: designColors.textSecondary,
        marginBottom: '12px',
        letterSpacing: '0.5px',
      }}>
        Risk Profile
      </div>

      {/* Bars */}
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-end',
        height: '48px',
      }}>
        {riskConfig.map((risk, index) => {
          const count = riskCounts[risk.key];
          const heightPercent = (count / maxCount) * 100;

          return (
            <div
              key={risk.key}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(heightPercent, 10)}%` }}
                transition={{ delay: index * 0.1, type: 'spring' }}
                style={{
                  width: '100%',
                  backgroundColor: count > 0 ? risk.color : designColors.borderDefault,
                  borderRadius: '2px',
                  minHeight: '4px',
                  opacity: count > 0 ? 1 : 0.3,
                }}
              />
              <span style={{
                fontSize: '9px',
                color: count > 0 ? risk.color : designColors.textMuted,
              }}>
                {risk.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
