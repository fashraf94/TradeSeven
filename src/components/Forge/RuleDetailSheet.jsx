// src/components/Forge/RuleDetailSheet.jsx
// Bottom sheet (mobile) / side panel (desktop) for rule detail view.

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Check } from 'lucide-react';

const CATEGORY_COLORS = {
  technical: '#5eead4',
  fundamental: '#f59e0b',
  risk: '#ef4444',
  allocation: '#8b5cf6',
};

const DIFFICULTY_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export default function RuleDetailSheet({ rule, isCollected, isAdding, onAdd, onClose }) {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lock body scroll while sheet is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!rule) return null;

  const catColor = CATEGORY_COLORS[rule.category] || '#5eead4';
  const catLabel = rule.category.charAt(0).toUpperCase() + rule.category.slice(1);
  const diffLabel = DIFFICULTY_LABELS[rule.difficulty] || rule.difficulty;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 50,
        }}
      />

      {/* Sheet / Panel */}
      <motion.div
        initial={isDesktop ? { x: '100%' } : { y: '100%' }}
        animate={isDesktop ? { x: 0 } : { y: 0 }}
        exit={isDesktop ? { x: '100%' } : { y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={isDesktop ? {
          position: 'fixed',
          top: 0,
          right: 0,
          width: 400,
          height: '100vh',
          background: '#0D0E12',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        } : {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '70vh',
          background: '#0D0E12',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Handle bar (mobile) or Close button (desktop) */}
        {isDesktop ? (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 16px 0',
          }}>
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: '1px solid #21262d',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={16} color="#8b949e" />
            </button>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 8,
            paddingBottom: 4,
          }}>
            <div style={{
              width: 32,
              height: 4,
              background: '#21262d',
              borderRadius: 2,
            }} />
          </div>
        )}

        {/* Scrollable content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
        }}>
          {/* Badge row */}
          <div style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <span style={{
              background: `${catColor}26`,
              color: catColor,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              borderRadius: 4,
              padding: '3px 10px',
            }}>
              {catLabel}
            </span>
            <span style={{
              background: '#21262d',
              color: '#8b949e',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              borderRadius: 4,
              padding: '3px 10px',
            }}>
              {diffLabel}
            </span>
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: 20,
            color: '#ffffff',
            fontWeight: 700,
            marginTop: 16,
            marginBottom: 0,
          }}>
            {rule.headline}
          </h2>

          {/* Description */}
          <p style={{
            fontSize: 15,
            color: '#e6edf3',
            lineHeight: 1.6,
            marginTop: 8,
            marginBottom: 0,
          }}>
            {rule.description}
          </p>

          {/* Learn more detail */}
          {rule.learnMore && (
            <p style={{
              fontSize: 14,
              color: '#8b949e',
              lineHeight: 1.5,
              marginTop: 8,
              marginBottom: 0,
            }}>
              {rule.learnMore}
            </p>
          )}

          {/* Divider */}
          <div style={{
            height: 1,
            background: 'rgba(255,255,255,0.06)',
            margin: '20px 0',
          }} />

          {/* How Your Agent Uses This */}
          {rule.agentUseDescription && (
            <div>
              <div style={{
                fontSize: 12,
                color: '#5eead4',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}>
                How Your Agent Uses This
              </div>
              <p style={{
                fontSize: 14,
                color: '#8b949e',
                lineHeight: 1.5,
                margin: 0,
              }}>
                {rule.agentUseDescription}
              </p>
            </div>
          )}
        </div>

        {/* Sticky CTA */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: '#0D0E12',
        }}>
          {isCollected ? (
            <button
              disabled
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                border: '1px solid #21262d',
                background: 'rgba(34, 197, 94, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'default',
                fontSize: 14,
                fontWeight: 600,
                color: '#22c55e',
                padding: 0,
              }}
            >
              <Check size={18} />
              Already in Your Rules
            </button>
          ) : (
            <button
              onClick={() => { if (!isAdding) onAdd(rule); }}
              disabled={isAdding}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #5eead4 0%, #00d9ff 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: isAdding ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: '#0D0E12',
                padding: 0,
                boxShadow: '0 4px 12px rgba(94, 234, 212, 0.3)',
                opacity: isAdding ? 0.6 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              <Plus size={18} />
              {isAdding ? 'Adding...' : 'Add to My Rules'}
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}
