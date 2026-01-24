import React from 'react';
import { BookOpen } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * ConfirmationPopup - Reusable modal for confirming actions
 *
 * @param {boolean} show - Whether to show the popup
 * @param {function} onClose - Handler for closing the popup
 * @param {function} onConfirm - Handler for primary action button
 * @param {React.ReactNode} icon - Icon to display in the header
 * @param {string} iconBgColor - Background color for icon container
 * @param {string} title - Popup title
 * @param {string} subtitle - Popup subtitle/description
 * @param {Array<{label: string, value: string, highlight?: boolean, highlightColor?: string}>} details - Detail rows
 * @param {string} confirmText - Text for primary action button
 * @param {string} confirmColor - Color for primary action button
 * @param {string} tutorialModeType - Tutorial mode identifier (for "How to Play" button)
 * @param {React.ReactNode} customContent - Optional custom content before details
 * @param {function} secondaryAction - Handler for secondary button
 * @param {string} secondaryText - Text for secondary button
 * @param {string} secondaryColor - Color for secondary button
 * @param {string} cancelText - Text for cancel button (defaults to "Cancel")
 * @param {boolean} hideTutorial - Hide the tutorial button
 * @param {function} onShowTutorial - Callback when tutorial button clicked (receives tutorialModeType)
 */
const ConfirmationPopup = ({
  show,
  onClose,
  onConfirm,
  icon,
  iconBgColor,
  title,
  subtitle,
  details,
  confirmText,
  confirmColor,
  tutorialModeType,
  customContent,
  secondaryAction,
  secondaryText,
  secondaryColor,
  cancelText,
  hideTutorial,
  onShowTutorial,
}) => {
  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1f2e 0%, #0d1117 100%)',
          borderRadius: '24px',
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
          maxWidth: '380px',
          width: '100%',
          padding: '32px 24px 24px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
          animation: 'slideUp 0.3s ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: iconBgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 8px 24px ${iconBgColor}44`
          }}>
            {icon}
          </div>
        </div>

        {/* Title */}
        <h2 style={{
          margin: '0 0 8px',
          fontSize: '22px',
          fontWeight: '700',
          color: '#ffffff',
          textAlign: 'center'
        }}>
          {title}
        </h2>

        {/* Subtitle */}
        <p style={{
          margin: '0 0 20px',
          fontSize: '15px',
          color: HOLO_COLORS.textSecondary,
          textAlign: 'center'
        }}>
          {subtitle}
        </p>

        {/* Custom Content (e.g., mode toggle) */}
        {customContent}

        {/* Details Box */}
        <div style={{
          background: HOLO_COLORS.bgCard,
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          {details.map((detail, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: index < details.length - 1 ? `1px solid ${HOLO_COLORS.borderSubtle}` : 'none'
              }}
            >
              <span style={{ color: HOLO_COLORS.textSecondary, fontSize: '14px' }}>{detail.label}</span>
              <span style={{
                color: detail.highlight ? detail.highlightColor || HOLO_COLORS.amber : '#ffffff',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {detail.value}
              </span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Primary buttons row - Join Game + Create Game when secondary exists */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {secondaryAction && secondaryText && (
              <button
                onClick={secondaryAction}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  border: `1px solid ${secondaryColor || confirmColor || HOLO_COLORS.borderSubtle}`,
                  background: 'transparent',
                  color: secondaryColor || confirmColor || HOLO_COLORS.textSecondary,
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {secondaryText}
              </button>
            )}
            <button
              onClick={onConfirm}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: confirmColor,
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: `0 4px 12px ${confirmColor}44`
              }}
            >
              {confirmText}
            </button>
          </div>

          {/* Cancel button - full width below */}
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              background: 'transparent',
              color: HOLO_COLORS.textSecondary,
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {cancelText || 'Cancel'}
          </button>
        </div>

        {/* Tutorial Button - only show if tutorialModeType provided and not hidden */}
        {tutorialModeType && !hideTutorial && onShowTutorial && (
          <button
            onClick={() => onShowTutorial(tutorialModeType)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              marginTop: '12px',
              padding: '12px 16px',
              background: 'transparent',
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              borderRadius: '10px',
              color: HOLO_COLORS.textMuted,
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = '#30363d';
              e.currentTarget.style.color = HOLO_COLORS.textSecondary;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = HOLO_COLORS.borderSubtle;
              e.currentTarget.style.color = HOLO_COLORS.textMuted;
            }}
          >
            <BookOpen size={16} />
            <span>How to Play</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ConfirmationPopup;
