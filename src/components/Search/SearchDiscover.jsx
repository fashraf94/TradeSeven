import React, { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { CORRELATION_LAB_ENABLED } from '../../config/featureFlags';
import { useTheme } from '../../contexts/ThemeContext';
import ExploreView from './ExploreView';
import SearchOverlay from './SearchOverlay';
import AssetResearchModal from '../draft/AssetResearchModal';

// Lazy load heavier sub-views
const RankingsView = lazy(() => import('./RankingsView'));
const InstitutionalView = lazy(() => import('./InstitutionalView'));
const ScreenerView = lazy(() => import('./ScreenerView'));
const CorrelationLab = lazy(() => import('../Research/CorrelationLab'));

const TABS = [
  { id: 'explore', label: 'Explore' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'institutional', label: 'Institutional' },
  { id: 'screen', label: 'Screen' },
  // Flag-gated so CORRELATION_LAB_ENABLED stays a true instant-rollback lever:
  // flag off → the tab never appears and the surface renders nothing (matches
  // the endpoint's 404 gate and the featureFlags.js rollback contract).
  ...(CORRELATION_LAB_ENABLED ? [{ id: 'correlations', label: 'Correlations' }] : []),
];

const SearchDiscover = ({ user, isMobile, isDesktop, setScreen, stocksData }) => {
  const { tokens } = useTheme();
  const [activeTab, setActiveTab] = useState('explore');
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [researchAsset, setResearchAsset] = useState(null);

  const onOpenResearch = (asset) => setResearchAsset(asset);

  const mainTabStyle = (isActive) => ({
    padding: '10px 20px',
    borderRadius: '24px',
    border: isActive ? '1px solid rgba(94,234,212,0.3)' : '1px solid transparent',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: isActive ? 'rgba(94,234,212,0.15)' : 'transparent',
    color: isActive ? '#5eead4' : '#6b7280',
    position: 'relative',
    fontFamily: 'inherit',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        minHeight: '100vh',
        background: tokens.bgApp,
        padding: isMobile ? '16px' : '24px',
        paddingBottom: isMobile ? '80px' : '24px',
        maxWidth: isDesktop ? '1200px' : undefined,
        margin: isDesktop ? '0 auto' : undefined,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <h1 style={{
          color: tokens.textPrimary,
          fontSize: '22px',
          fontWeight: 700,
          margin: 0,
        }}>
          Discover
        </h1>
        {isMobile && (
          <div
            onClick={() => setScreen('profile')}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: tokens.bgCard,
              border: `2px solid ${tokens.teal}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
              fontWeight: 600,
              color: tokens.textWhite,
              cursor: 'pointer',
            }}
          >
            {(user?.username || 'P')[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Search Bar */}
      <motion.div
        whileTap={{ scale: 0.99 }}
        onClick={() => setShowSearchOverlay(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: tokens.bgCard,
          borderRadius: '12px',
          padding: '12px 14px',
          border: `1px solid rgba(94,234,212,0.15)`,
          cursor: 'pointer',
          marginBottom: '16px',
        }}
      >
        <Search size={18} color={tokens.teal} />
        <span style={{ color: tokens.textMuted, fontSize: '14px' }}>
          Search stocks by ticker or name...
        </span>
      </motion.div>

      {/* Main Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setResearchAsset(null); setActiveTab(tab.id); }}
            style={mainTabStyle(activeTab === tab.id)}
          >
            {tab.label}
            {tab.badge && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                fontSize: '8px',
                fontWeight: 700,
                color: '#5eead4',
                background: 'rgba(94,234,212,0.15)',
                padding: '2px 5px',
                borderRadius: '6px',
                lineHeight: 1,
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'explore' && (
            <ExploreView
              stocksData={stocksData}
              onOpenResearch={onOpenResearch}
              isMobile={isMobile}
            />
          )}
          {activeTab === 'rankings' && (
            <Suspense fallback={<div style={{ color: tokens.textMuted, padding: '20px', textAlign: 'center', fontSize: '13px' }}>Loading rankings...</div>}>
              <RankingsView
                onOpenResearch={onOpenResearch}
                isMobile={isMobile}
              />
            </Suspense>
          )}
          {activeTab === 'institutional' && (
            <Suspense fallback={<div style={{ color: tokens.textMuted, padding: '20px', textAlign: 'center', fontSize: '13px' }}>Loading institutional data...</div>}>
              <InstitutionalView
                onOpenResearch={onOpenResearch}
                stocksData={stocksData}
                isMobile={isMobile}
              />
            </Suspense>
          )}
          {activeTab === 'screen' && (
            <Suspense fallback={<div style={{ color: tokens.textMuted, padding: '20px', textAlign: 'center', fontSize: '13px' }}>Loading screener...</div>}>
              <ScreenerView
                onOpenResearch={onOpenResearch}
                isMobile={isMobile}
              />
            </Suspense>
          )}
          {CORRELATION_LAB_ENABLED && activeTab === 'correlations' && (
            <Suspense fallback={<div style={{ color: tokens.textMuted, padding: '20px', textAlign: 'center', fontSize: '13px' }}>Loading correlations...</div>}>
              <CorrelationLab isDesktop={isDesktop} embedded />
            </Suspense>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Search Overlay */}
      <SearchOverlay
        visible={showSearchOverlay}
        onClose={() => setShowSearchOverlay(false)}
        onSelectStock={onOpenResearch}
        stocksData={stocksData}
        isMobile={isMobile}
      />

      {/* Research Modal */}
      {researchAsset && (
        <AssetResearchModal
          asset={researchAsset}
          onClose={() => setResearchAsset(null)}
          showActionButton={false}
          version={2}
        />
      )}
    </motion.div>
  );
};

export default SearchDiscover;
