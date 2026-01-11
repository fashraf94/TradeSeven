import React from 'react';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * RefreshIndicator - Shows when standings are being updated
 *
 * A subtle floating indicator that appears during the 60-second
 * refresh cycle to show users that data is being updated.
 */
const RefreshIndicator = ({ visible, lastUpdated }) => {
  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '120px', // Below header and status bar
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0, 255, 255, 0.1)',
      border: `1px solid ${HOLO_COLORS.cyan}44`,
      borderRadius: '20px',
      padding: '6px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '11px',
      color: HOLO_COLORS.cyan,
      backdropFilter: 'blur(8px)',
      zIndex: 40,
      animation: 'refreshFadeIn 0.3s ease-out',
    }}>
      <div style={{
        width: '12px',
        height: '12px',
        border: `2px solid ${HOLO_COLORS.cyan}44`,
        borderTop: `2px solid ${HOLO_COLORS.cyan}`,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      Updating standings...

      <style>{`
        @keyframes refreshFadeIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default RefreshIndicator;
