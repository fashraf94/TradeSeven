import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CollapsibleSection — Chevron-only accordion for Research modal.
 * Simplified version of BaggerBomb/AccordionSection (no status indicators).
 */
const CollapsibleSection = ({ title, icon, defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{
      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    }}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Icon */}
        {icon && (
          <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>
        )}

        {/* Title */}
        <span style={{
          flex: 1,
          fontSize: '12px',
          fontWeight: '700',
          color: '#e6edf3',
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
        }}>
          {title}
        </span>

        {/* Chevron */}
        <motion.span
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          style={{
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {'\u25B6'}
        </motion.span>
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
            <div style={{ paddingBottom: '12px' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollapsibleSection;
