// BottomActionBar - Sticky bottom action bar for TD Portfolio Builder
import React from 'react';

const colors = {
  background: '#0a0a0f',
  cardBg: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.1)',
  primary: '#00d9ff',
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)'
};

/**
 * BottomActionBar - Sticky bottom bar with status and action buttons
 *
 * @param {boolean} rosterComplete - Whether roster is complete (6-12 stocks, 90% allocated)
 * @param {boolean} cryptoComplete - Whether crypto is selected
 * @param {boolean} benchComplete - Whether bench is complete (4 stocks + 1 crypto)
 * @param {boolean} nameComplete - Whether portfolio name is entered
 * @param {Function} onCreateBattle - Callback to create battle
 * @param {Function} onSaveTemplate - Optional callback to save as template
 * @param {boolean} isLoading - Whether creation is in progress
 */
export default function BottomActionBar({
  rosterComplete = false,
  cryptoComplete = false,
  benchComplete = false,
  nameComplete = false,
  onCreateBattle,
  onSaveTemplate,
  isLoading = false
}) {
  const allComplete = rosterComplete && cryptoComplete && benchComplete && nameComplete;

  const StatusItem = ({ label, isComplete }) => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '12px',
      color: isComplete ? colors.green : colors.yellow
    }}>
      {label}
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        backgroundColor: isComplete ? colors.green : colors.yellow,
        color: isComplete ? '#fff' : '#000',
        fontSize: '10px',
        fontWeight: 'bold'
      }}>
        {isComplete ? '✓' : '!'}
      </span>
    </span>
  );

  return (
    <div style={{
      position: 'sticky',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '12px 16px',
      backgroundColor: 'rgba(10,10,15,0.95)',
      backdropFilter: 'blur(12px)',
      borderTop: `1px solid ${colors.border}`,
      zIndex: 100
    }}>
      {/* Status Summary - Mobile: Horizontal scroll, Desktop: Inline */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '12px',
        overflowX: 'auto',
        paddingBottom: '4px'
      }}>
        <StatusItem label="Roster" isComplete={rosterComplete} />
        <StatusItem label="Crypto" isComplete={cryptoComplete} />
        <StatusItem label="Bench" isComplete={benchComplete} />
        <StatusItem label="Name" isComplete={nameComplete} />
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '12px'
      }}>
        {onSaveTemplate && (
          <button
            onClick={onSaveTemplate}
            disabled={!allComplete || isLoading}
            style={{
              flex: '0 0 auto',
              padding: '12px 20px',
              borderRadius: '10px',
              border: `1px solid ${colors.border}`,
              background: 'transparent',
              color: allComplete ? colors.textPrimary : colors.textMuted,
              fontSize: '14px',
              fontWeight: '600',
              cursor: allComplete && !isLoading ? 'pointer' : 'not-allowed',
              opacity: allComplete ? 1 : 0.5,
              transition: 'all 0.2s'
            }}
          >
            Save Template
          </button>
        )}

        <button
          onClick={onCreateBattle}
          disabled={!allComplete || isLoading}
          style={{
            flex: 1,
            padding: '14px 24px',
            borderRadius: '10px',
            border: 'none',
            background: allComplete
              ? 'linear-gradient(135deg, #00d9ff 0%, #0891b2 100%)'
              : colors.cardBg,
            color: allComplete ? '#000' : colors.textMuted,
            fontSize: '16px',
            fontWeight: '700',
            cursor: allComplete && !isLoading ? 'pointer' : 'not-allowed',
            opacity: allComplete ? 1 : 0.6,
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {isLoading ? (
            <>
              <span style={{
                width: '16px',
                height: '16px',
                border: '2px solid transparent',
                borderTopColor: '#000',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              Creating...
            </>
          ) : (
            <>
              Create Battle
              <span style={{ fontSize: '18px' }}>→</span>
            </>
          )}
        </button>
      </div>

      {/* Keyframes for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
