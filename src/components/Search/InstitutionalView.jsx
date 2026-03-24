import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Check } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const FEATURES = [
  'Top institutional holdings',
  'New positions & exits',
  'Smart money conviction signals',
];

const InstitutionalView = () => {
  const { tokens } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 16px',
        textAlign: 'center',
      }}
    >
      {/* Icon */}
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'rgba(94,234,212,0.1)',
        border: '1px solid rgba(94,234,212,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
      }}>
        <Building2 size={26} color={tokens.teal} />
      </div>

      {/* Title */}
      <h2 style={{
        fontSize: '16px',
        fontWeight: 700,
        color: tokens.textPrimary,
        margin: '0 0 8px',
      }}>
        Institutional Intelligence
      </h2>

      {/* Subtitle */}
      <p style={{
        fontSize: '13px',
        color: tokens.textMuted,
        maxWidth: '280px',
        lineHeight: 1.5,
        margin: '0 0 24px',
      }}>
        See what hedge funds, mutual funds, and institutions are buying and selling from 13F filings.
      </p>

      {/* Feature list */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '24px',
        alignItems: 'flex-start',
      }}>
        {FEATURES.map((feature) => (
          <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'rgba(16,185,129,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Check size={12} color="#10b981" />
            </div>
            <span style={{ fontSize: '13px', color: tokens.textSecondary }}>
              {feature}
            </span>
          </div>
        ))}
      </div>

      {/* Coming soon badge */}
      <div style={{
        padding: '6px 16px',
        borderRadius: '20px',
        background: 'rgba(94,234,212,0.08)',
        border: '1px solid rgba(94,234,212,0.2)',
        fontSize: '12px',
        fontWeight: 600,
        color: tokens.teal,
      }}>
        Coming Soon
      </div>
    </motion.div>
  );
};

export default InstitutionalView;
