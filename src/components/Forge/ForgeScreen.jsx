// src/components/Forge/ForgeScreen.jsx
// Top-level Forge container with 4-tab navigation shell.
// Discover tab is fully implemented; My Rules, My Bundles, Stats are placeholders.

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Compass, List, Package, BarChart3 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useForge } from '../../hooks/useForge';
import useAgent from '../../hooks/useAgent';
import DiscoverTab from './DiscoverTab';
import MyRulesTab from './MyRulesTab';
import MyBundlesTab from './MyBundlesTab';

const TABS = [
  { id: 'discover', label: 'Discover', Icon: Compass },
  { id: 'myRules', label: 'My Rules', Icon: List },
  { id: 'myBundles', label: 'My Bundles', Icon: Package },
  { id: 'stats', label: 'Stats', Icon: BarChart3 },
];

function PlaceholderTab({ label, tokens }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '300px',
      gap: '12px',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
      }}>
        {label === 'My Rules' ? '📜' : label === 'My Bundles' ? '📦' : '📊'}
      </div>
      <span style={{
        fontSize: '16px',
        fontWeight: '600',
        color: tokens.textPrimary,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: '13px',
        color: tokens.textMuted,
      }}>
        Coming soon
      </span>
    </div>
  );
}

export default function ForgeScreen({ isMobile, onClose, user }) {
  const { tokens } = useTheme();
  const { agent } = useAgent(user?.uid);
  const agentId = agent?.id || null;

  const forge = useForge(agentId);

  return (
    <div style={{
      minHeight: '100vh',
      background: tokens.bgApp,
      paddingBottom: isMobile ? '80px' : '0',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: isMobile ? '16px 16px 12px' : '20px 24px 16px',
        borderBottom: `1px solid ${tokens.borderDefault}`,
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: tokens.textMuted,
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = tokens.teal; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = tokens.textMuted; }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: tokens.textWhite,
          margin: 0,
        }}>
          The Forge
        </h1>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: isMobile ? '12px 16px' : '12px 24px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {TABS.map((tab) => {
          const isActive = forge.activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => forge.setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                border: isActive ? `1px solid ${tokens.teal}4D` : '1px solid rgba(255,255,255,0.08)',
                background: isActive ? `${tokens.teal}26` : 'rgba(255,255,255,0.04)',
                color: isActive ? tokens.teal : tokens.textMuted,
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            >
              <tab.Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={forge.activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {forge.activeTab === 'discover' && (
            <DiscoverTab
              isMobile={isMobile}
              forge={forge}
              tokens={tokens}
            />
          )}
          {forge.activeTab === 'myRules' && (
            <MyRulesTab
              forge={forge}
              tokens={tokens}
              isMobile={isMobile}
            />
          )}
          {forge.activeTab === 'myBundles' && (
            <MyBundlesTab
              forge={forge}
              tokens={tokens}
              isMobile={isMobile}
              agent={agent}
            />
          )}
          {forge.activeTab === 'stats' && (
            <PlaceholderTab label="Stats" tokens={tokens} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {forge.toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed',
              bottom: isMobile ? '80px' : '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: tokens.bgCard,
              border: `1px solid ${tokens.teal}33`,
              borderRadius: '12px',
              padding: '12px 20px',
              fontSize: '13px',
              fontWeight: '500',
              color: tokens.teal,
              boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${tokens.teal}15`,
              zIndex: 100,
              whiteSpace: 'nowrap',
            }}
          >
            {forge.toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
