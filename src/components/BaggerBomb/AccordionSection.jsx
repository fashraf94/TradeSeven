// AccordionSection - Collapsible accordion section for TD Portfolio Builder
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const colors = {
  background: '#0a0a0f',
  cardBg: 'rgba(255,255,255,0.03)',
  cardBgHover: 'rgba(255,255,255,0.06)',
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
 * AccordionSection - Collapsible section with status indicator
 *
 * @param {string} title - Section title
 * @param {string} status - 'complete' | 'incomplete' | 'info'
 * @param {boolean} defaultOpen - Whether section starts open
 * @param {React.ReactNode} children - Section content
 * @param {string} subtitle - Optional subtitle text
 */
export default function AccordionSection({
  title,
  status = 'incomplete',
  defaultOpen = false,
  children,
  subtitle
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const getStatusIcon = () => {
    switch (status) {
      case 'complete':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: colors.green,
            color: '#fff',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            ✓
          </span>
        );
      case 'incomplete':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: colors.yellow,
            color: '#000',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            !
          </span>
        );
      case 'info':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: colors.primary,
            color: '#000',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            i
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{
      marginBottom: '12px',
      borderRadius: '12px',
      border: `1px solid ${colors.border}`,
      backgroundColor: colors.cardBg,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = colors.cardBgHover}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        {/* Chevron */}
        <motion.span
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          style={{
            color: colors.textSecondary,
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          ▶
        </motion.span>

        {/* Title & Subtitle */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '700',
            color: colors.textPrimary,
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{
              fontSize: '12px',
              color: colors.textMuted,
              marginTop: '2px'
            }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Status Indicator */}
        {getStatusIcon()}
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 16px 16px 16px',
              borderTop: `1px solid ${colors.border}`
            }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
