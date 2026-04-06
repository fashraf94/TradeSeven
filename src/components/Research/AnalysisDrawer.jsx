import React, { useRef, useEffect, useState } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';
import useDrawerSnap from './useDrawerSnap';
import { useIsMobile } from '../../hooks/useIsMobile';

const TAB_CONFIGS = [
  { key: 'marketContext', label: '\uD83C\uDF10 Market', activeColor: '#00D9FF' },
  { key: 'health', label: '\u26D3\uFE0F Health', activeColor: HOLO_COLORS.amber },
  { key: 'fundamental', label: 'Analysis', activeColor: HOLO_COLORS.primary },
  { key: 'holdings', label: 'Holdings', activeColor: '#a78bfa' },
  { key: 'compete', label: 'Ranks', activeColor: '#a78bfa' },
  { key: 'smartMoney', label: 'Smart Money', activeColor: '#06b6d4' },
  { key: 'sector', label: 'Sector', activeColor: HOLO_COLORS.amber },
  { key: 'technical', label: 'Technical', activeColor: HOLO_COLORS.primary },
  { key: 'baggerbomb', label: '\uD83D\uDCA3 Bomb', activeColor: HOLO_COLORS.green },
];

/**
 * AnalysisDrawer — Bottom pull-up drawer for the AI Analysis tabs.
 * Two states: mid (default, below chart) and full (covers chart).
 *
 * @param {Object} props
 * @param {number} containerHeight - Parent container height
 * @param {string} activeTab - Current active tab key
 * @param {function} setActiveTab - Tab setter
 * @param {function} onSnapStateChange - Callback when snap state changes
 * @param {React.ReactNode} children - Tab content to render
 */
const AnalysisDrawer = ({
  containerHeight,
  activeTab,
  setActiveTab,
  onSnapStateChange,
  children,
  isCrypto = false,
  isIndex = false,
  isSectorETF = false,
  hasBombData = false,
  isGameContext = false,
}) => {
  const { isMobile } = useIsMobile();
  const {
    y,
    snapState,
    MID_Y,
    onDragStart,
    onDragEnd,
    toggleDrawer,
    dragConstraints,
  } = useDrawerSnap(containerHeight, isMobile);

  const dragControls = useDragControls();
  const headerRef = useRef(null);
  const [scrollHeight, setScrollHeight] = useState(0);

  // Notify parent of snap state changes
  useEffect(() => {
    onSnapStateChange?.(snapState);
  }, [snapState, onSnapStateChange]);

  // Measure actual header height and compute scroll container height
  // Recalculates when snap state changes so scroll area matches visible drawer portion
  useEffect(() => {
    const headerH = headerRef.current?.getBoundingClientRect().height || 110;
    const currentY = snapState === 'full' ? 0 : MID_Y;
    const visibleDrawerH = containerHeight - currentY;
    setScrollHeight(visibleDrawerH - headerH);
  }, [containerHeight, snapState, MID_Y]);

  return (
    <motion.div
      data-drawer-root
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={dragConstraints}
      dragElastic={0.1}
      dragMomentum={false}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: containerHeight,
        display: 'flex',
        flexDirection: 'column',
        y,
        zIndex: 10,
        background: HOLO_COLORS.bgCard,
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px',
        borderTop: '1px solid rgba(0, 217, 255, 0.15)',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Fixed header — handle + tabs. Never scrolls. */}
      <div ref={headerRef} style={{ flexShrink: 0 }}>
        {/* Drag handle area — onPointerDown starts drag on root via dragControls */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          style={{
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          {/* Grab handle pill — tap toggles between mid/full */}
          <div
            onClick={toggleDrawer}
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '10px 0 6px',
            }}
          >
            <div style={{
              width: '36px',
              height: '4px',
              borderRadius: '2px',
              background: 'rgba(255, 255, 255, 0.3)',
            }} />
          </div>

          {/* Label row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px 8px',
            }}
          >
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.5px',
              color: HOLO_COLORS.textSecondary,
              textTransform: 'uppercase',
            }}>
              AI Analysis
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <div
          className="drawer-tabs-scroll"
          style={{
            display: 'flex',
            gap: '6px',
            padding: '0 12px 8px',
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <style>{`.drawer-tabs-scroll::-webkit-scrollbar { display: none; }`}</style>
          {TAB_CONFIGS.filter(t => {
            if (isIndex && ['fundamental', 'health', 'compete', 'sector', 'baggerbomb', 'holdings'].includes(t.key)) return false;
            if (!isIndex && t.key === 'marketContext') return false;
            if (isSectorETF && ['fundamental', 'health', 'marketContext', 'baggerbomb'].includes(t.key)) return false;
            if (!isSectorETF && t.key === 'holdings') return false;
            if (isCrypto && ['fundamental', 'compete', 'sector', 'holdings', 'smartMoney'].includes(t.key)) return false;
            if (t.key === 'smartMoney' && (isIndex || isSectorETF)) return false;
            if (!isCrypto && !isIndex && !isSectorETF && t.key === 'health') return false;
            if (t.key === 'baggerbomb' && !hasBombData && !isGameContext) return false;
            return true;
          }).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: activeTab === tab.key
                  ? `1px solid ${tab.activeColor}`
                  : '1px solid rgba(255, 255, 255, 0.1)',
                background: activeTab === tab.key
                  ? `${tab.activeColor}20`
                  : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === tab.key
                  ? tab.activeColor
                  : 'rgba(255, 255, 255, 0.6)',
                fontWeight: '600',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content — explicit height from measured header */}
      <div
        style={{
          height: scrollHeight > 0 ? scrollHeight : 'auto',
          flexShrink: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
          padding: '0 12px 80px',
        }}
      >
        {children}
      </div>
    </motion.div>
  );
};

export default AnalysisDrawer;
