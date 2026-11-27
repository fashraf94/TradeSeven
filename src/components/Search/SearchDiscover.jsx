import React, { useState, lazy, Suspense, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { CORRELATION_LAB_ENABLED } from '../../config/featureFlags';
import { exploreMode } from '../../config/exploreFlags';
import { useTheme } from '../../contexts/ThemeContext';
import ExploreView from './ExploreView';
import SearchOverlay from './SearchOverlay';
import AssetResearchModal from '../draft/AssetResearchModal';

// Lazy load heavier sub-views
const RankingsView = lazy(() => import('./RankingsView'));
const InstitutionalView = lazy(() => import('./InstitutionalView'));
const ScreenerView = lazy(() => import('./ScreenerView'));
const CorrelationLab = lazy(() => import('../Research/CorrelationLab'));
// Explore Build 1 (docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md; dark: src/config/exploreFlags.js). Both load
// only when the switch is not 'off': at 'off' nothing of src/components/Explore/ is requested and this page is today's.
// The runtime holds the page's reads (the one research read, the stories, the bookmarks) and draws nothing; the tab
// is the Explore tab's content.
const ExploreRuntime = lazy(() => import('../Explore/ExploreRuntime'));
const ExploreTab = lazy(() => import('../Explore/ExploreTab'));
/** The Explore tab's id. Today's movers tab keeps 'explore' and is labelled "Markets" beside it. */
const EXPLORE_HOME = 'exploreHome';

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

const SearchDiscover = ({ user, isMobile, isDesktop, setScreen, stocksData, sidebarCollapsed }) => {
  const { tokens } = useTheme();
  // The switch, read at call time (spec §6): 'off' → this page exactly as before Explore.
  const mode = exploreMode();
  const [selectedTab, setActiveTab] = useState(() => (mode === 'on' ? EXPLORE_HOME : 'explore'));
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [researchAsset, setResearchAsset] = useState(null);
  // ExploreRuntime's snapshot ({ research, admitted, stories, bookmarks }); null at 'off' and until it loads.
  const [explore, setExplore] = useState(null);
  // Whether the player has tapped anything on the page (a tab, the search bar, a row, a card — spec §6; build prompt
  // K-5): at 'allowlist' the Explore tab, once added, opens by itself only before that. A tap is a click (a scroll
  // gesture on a phone is not one) or Enter / Space on a control.
  const touched = useRef(false);
  const markTouched = (event) => { if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') touched.current = true; };
  const withExplore = mode === 'on' || (mode === 'allowlist' && explore?.admitted === true);
  // The Explore tab is never shown without Explore (a player change at 'allowlist' resets the admission): Markets then.
  const activeTab = selectedTab === EXPLORE_HOME && !withExplore ? 'explore' : selectedTab;
  useEffect(() => {
    if (mode === 'allowlist' && withExplore && !touched.current) setActiveTab(EXPLORE_HOME);
  }, [mode, withExplore]);
  const tabs = withExplore
    ? [{ id: EXPLORE_HOME, label: 'Explore' }, ...TABS.map((tab) => (tab.id === 'explore' ? { ...tab, label: 'Markets' } : tab))]
    : TABS;
  // Inside a story the tab row is not drawn (founder ruling F-1, Nov 22), nor the page's heading (Explore Build 2,
  // ruling B-12; build prompt K-9: the phone's account control is reached from the front page only): the Explore tab
  // says so through onInStory (false when it unmounts). Hidden ONLY while Explore is on, its tab is the open one, and a
  // story shows — never on another tab, on Explore's home, or at 'off'.
  const [inStory, setInStory] = useState(false);
  const hideTabRow = withExplore && activeTab === EXPLORE_HOME && inStory;

  const onOpenResearch = (asset) => { touched.current = true; setResearchAsset(asset); };

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
      onClickCapture={markTouched}
      onKeyDownCapture={markTouched}
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
      {/* Header — not inside an Explore story */}
      {hideTabRow ? null : (
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
          {withExplore ? 'Explore' : 'Discover'}
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
      )}

      {/* Search Bar — on every tab but Explore, whose own search takes its place */}
      {activeTab === EXPLORE_HOME ? null : (
      <motion.div
        whileTap={{ scale: 0.99 }}
        onClick={() => { touched.current = true; setShowSearchOverlay(true); }}
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
      )}

      {/* Main Tabs — not inside an Explore story */}
      {hideTabRow ? null : (
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { touched.current = true; setResearchAsset(null); setActiveTab(tab.id); }}
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
      )}

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
        >
          {withExplore && activeTab === EXPLORE_HOME && (
            <Suspense fallback={<div style={{ color: tokens.textMuted, padding: '20px', textAlign: 'center', fontSize: '13px' }}>Loading Explore...</div>}>
              <ExploreTab
                explore={explore}
                onOpenResearch={onOpenResearch}
                stocksData={stocksData}
                isMobile={isMobile}
                sidebarCollapsed={sidebarCollapsed}
                onInStory={setInStory}
              />
            </Suspense>
          )}
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

      {/* Explore's reads, for this page's life (draws nothing); never at 'off' */}
      {mode !== 'off' ? (
        <Suspense fallback={null}>
          <ExploreRuntime key={user?.uid ?? ''} uid={user?.uid ?? null} mode={mode} onChange={setExplore} />
        </Suspense>
      ) : null}
    </motion.div>
  );
};

export default SearchDiscover;
