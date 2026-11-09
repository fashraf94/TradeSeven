import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { HOLO_COLORS, CATEGORY_CONFIG, getSectorColor, getRatingColor } from '../../constants/holoTheme';
import { getCompanyProfile } from '../../services/fundamentalsService';
import { getStockPrice } from '../../services/eodhdAPI';
import { formatLargeNumber } from '../../utils/formatters';
import ChartHeader from '../Research/ChartHeader';
import WhyMovingPopup from '../Research/WhyMovingPopup';
import StockChart from '../Research/StockChart';
import useResearchData, { sessionDateOf, sideLevelsAt, sideOfShownPrice } from '../Research/useResearchData';
import AnalysisDrawer from '../Research/AnalysisDrawer';
import TechnicalTabV2 from '../Research/TechnicalTabV2';
import { useIsMobile } from '../../hooks/useIsMobile';
import TechnicalAnalysisTab from './ResearchTabs/TechnicalAnalysisTab';
import BaggerBombTab from './ResearchTabs/BaggerBombTab';
import HealthTab from '../Research/HealthTab';
import { CRYPTO_SYMBOLS } from '../../services/sessionScoringService';
import AnalysisQATab from '../Research/AnalysisQATab';
import CompeteTab from './CompeteTab';
import SectorTab from './SectorTab';
import { isIndex, INDEX_REGISTRY } from '../../constants/indexRegistry';
import MarketContextTab from '../Research/MarketContextTab';
import { SECTORS } from '../../constants/sectors';
import HoldingsTab from '../Research/HoldingsTab';
import SectorETFRanksTab from '../Research/SectorETFRanksTab';
import SmartMoneyTab from '../Research/SmartMoneyTab';
import { getVolatilityThresholds } from '../../services/volatilityService';
import { resolveBombMode } from '../Research/BombMode/bombModeGate';
import useBombView from '../Research/BombMode/useBombView';
import BombPlot, { RedZoneChip } from '../Research/BombMode/BombPlot';
import BombSheet from '../Research/BombMode/BombSheet';
import useSheetView from '../Research/Sheet/useSheetView';
import AnalysisSheet, { SheetActionRow } from '../Research/Sheet/AnalysisSheet';
import { ST } from '../Research/Sheet/sheetTheme';
import { visibleViewportHeight } from '../Research/Sheet/sheetViewport';
import { opensInRedZone } from '../Research/Sheet/sheetOpen';

/**
 * AssetResearchModal - Detailed asset research view (reusable across screens)
 *
 * Shows comprehensive asset information with AI Analysis:
 * - Stock hero section (symbol, name, price, change)
 * - AI Analysis with Fundamental/Technical/News tabs
 * - Key metrics: Market Cap, P/E Ratio, Revenue Growth, Profit Margin
 * - Strengths & Weaknesses
 * - Real-time news from EODHD API
 * - Flexible action button (draft acquire, custom actions, or research-only mode)
 *
 * Props:
 * - asset: { symbol, name, price, percentChange?, change?, sector? }
 * - sector: string (for sector badge color)
 * - category: 'neutral' | 'aggressive' | 'defensive' (optional, for draft context)
 * - isMyTurn: boolean (default: false) - shows ON THE CLOCK alert
 * - timeRemaining: number (default: 0) - seconds remaining in draft
 * - canPick: boolean (default: false) - enables acquire button in draft
 * - onAcquire: (asset) => void (optional) - acquire handler for draft
 * - onClose: () => void - close handler
 * - actionConfig: { label, onClick, variant, disabled? } (optional) - custom action button
 *   - variant: 'primary' | 'danger' | 'secondary'
 * - showActionButton: boolean (default: true) - show/hide action section
 * - controlledQuote / onNavigateAdmission: optional battle-screen contracts
 *   (Shadow vs CPU quote integrity) — see the note at the component.
 * - bombContext: optional Bomb mode contract (Research Modal Build A) — see the
 *   note at the component.
 * - sheetContext: optional in-battle sheet contract (Research Modal Build C) —
 *   see the note at the component.
 */

// Mock fundamental data (in production, fetch from API)
const getMockFundamentals = (symbol) => {
  const defaults = {
    marketCap: '$500B',
    peRatio: '25x',
    revenueGrowth: '+15%',
    profitMargin: '20%',
    strengths: ['Strong market position', 'Growing revenue', 'Solid fundamentals'],
    weaknesses: ['Valuation concerns', 'Market competition', 'Economic sensitivity'],
    low52w: 100,
    high52w: 200,
  };

  // Custom data for popular stocks
  const stockData = {
    'AAPL': { marketCap: '$3.0T', peRatio: '30x', revenueGrowth: '+8%', profitMargin: '25%', low52w: 164, high52w: 199, strengths: ['Strong ecosystem', 'Brand loyalty', 'Services growth'], weaknesses: ['iPhone dependency', 'China exposure', 'Premium pricing'] },
    'MSFT': { marketCap: '$2.9T', peRatio: '35x', revenueGrowth: '+15%', profitMargin: '36%', low52w: 309, high52w: 430, strengths: ['Cloud dominance', 'AI integration', 'Enterprise strength'], weaknesses: ['Gaming struggles', 'Regulatory scrutiny', 'Valuation'] },
    'GOOGL': { marketCap: '$2.0T', peRatio: '25x', revenueGrowth: '+12%', profitMargin: '24%', low52w: 120, high52w: 180, strengths: ['Search dominance', 'YouTube growth', 'Cloud expansion'], weaknesses: ['Ad market risks', 'Antitrust concerns', 'AI competition'] },
    'AMZN': { marketCap: '$1.9T', peRatio: '60x', revenueGrowth: '+11%', profitMargin: '7%', low52w: 118, high52w: 201, strengths: ['AWS leadership', 'E-commerce scale', 'Prime ecosystem'], weaknesses: ['Thin retail margins', 'Labor costs', 'Competition'] },
    'NVDA': { marketCap: '$1.2T', peRatio: '65x', revenueGrowth: '+122%', profitMargin: '55%', low52w: 108, high52w: 505, strengths: ['AI chip dominance', 'Data center growth', 'CUDA ecosystem'], weaknesses: ['Concentration risk', 'Competition', 'Valuation'] },
    'TSLA': { marketCap: '$800B', peRatio: '70x', revenueGrowth: '+19%', profitMargin: '11%', low52w: 138, high52w: 299, strengths: ['EV leadership', 'Manufacturing scale', 'Energy business'], weaknesses: ['Competition growing', 'Execution risks', 'Valuation premium'] },
    'META': { marketCap: '$1.3T', peRatio: '28x', revenueGrowth: '+23%', profitMargin: '29%', low52w: 274, high52w: 531, strengths: ['User engagement', 'Ad efficiency', 'AI investment'], weaknesses: ['Metaverse losses', 'Privacy concerns', 'Competition'] },
    'JPM': { marketCap: '$550B', peRatio: '11x', revenueGrowth: '+8%', profitMargin: '33%', low52w: 135, high52w: 200, strengths: ['Scale advantage', 'Diverse revenue', 'Strong management'], weaknesses: ['Rate sensitivity', 'Regulatory burden', 'Credit risk'] }
  };

  return { ...defaults, ...(stockData[symbol] || {}) };
};

// Bomb mode: an in-battle mount always shows the 💣 pill (BA-5), even before a
// ladder can be drawn (the plot then says why) — this stands in for bombData.
const BOMB_MODE_PILL = Object.freeze({ bombMode: true });

const AssetResearchModal = ({
  asset,
  sector,
  category,
  // Draft-specific props - optional with safe defaults
  isMyTurn = false,
  timeRemaining = 0,
  canPick = false,
  onAcquire = null,
  // Optional per-DISPLAYED-symbol draft gate: (symbol) => boolean. When provided,
  // the acquire CTA shows only if the currently-displayed asset passes it — so a
  // modal that navigates internally to an off-board name goes research-only.
  // Absent (default) → today's behavior for every existing caller.
  isAcquirable = null,
  onClose,
  // Flexible action button configuration
  // actionConfig: { label: string, onClick: fn, variant: 'primary'|'danger'|'secondary', disabled?: boolean }
  actionConfig = null,
  showActionButton = true,
  isGameContext: isGameContextProp,
  version = 2,
  defaultTab = null,
  defaultTimeframe = null,
  realtimeExtremes = null,
  wsPrice = null,
  // Shadow vs CPU quote integrity (SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md
  // §7.2 items 2–5, A-3, B-9; build record
  // docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md). Both
  // are supplied only by the gated battle screen; absent, nothing changes.
  //
  // controlledQuote: { posKey, symbol, price, extremes } for a HELD position
  //   whose current quote qualified. The modal then shows exactly the parent's
  //   payload (no symbol-keyed saved price), never fetches a price (both fill
  //   effects and the hook's extremes poll are off), ignores wsPrice, hands
  //   the session-qualified extremes to the research hook, allows no internal
  //   navigation or back history, and sends "Why is it moving?" the hook's
  //   daily change only when finite. A malformed contract fails closed.
  // onNavigateAdmission(symbol, name) → boolean: for a NON-held view; every
  //   internal navigation (forward or back) asks first. `false` means the
  //   screen took the held name through its own admission — the modal stays
  //   put and makes no request for it.
  controlledQuote = null,
  onNavigateAdmission = null,
  // Research Modal Build A — Bomb mode (spec
  // docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md §4.2). Passed ONLY by
  // the in-battle mounts, and only when RESEARCH_MODAL_BOMB_MODE resolves on
  // for them: { kind: 'agent', battleId, held, record } (the agent Battle View;
  // `record` from selectBombRecord) | { kind: 'v4', dailyLevels } (a V4
  // BaggerBomb battle) | { kind: 'bench' } (a name in a battle the player does
  // not hold). With it, the 💣 view is the Fuse / red zone and the Bomb tab is
  // the one sheet. Without it and with the mode 'on', this mount shows no 💣
  // pill and no Bomb tab (BA-5). With the mode off nobody passes it and nothing
  // here changes.
  bombContext = null,
  // Research Modal Build C — the sheet in battle (spec
  // docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md §4.2, BC-1). Passed ONLY
  // by the agent Battle View's three mounts, and only when
  // RESEARCH_MODAL_SHEET_MODE resolves on for them: { battleId, agentId,
  // archetype, agentName, row: { held, posKey | positionId }, incumbent?,
  // onOpenCockpit?, battle, calls?, standing, directive } — `battle` is the
  // screen's own subscribed document (no second listener), `calls` its cockpit
  // reader when it holds one, `standing` the score pair its header shows,
  // `directive` the slot its THIS TURN strip shows. With it, the modal opens on
  // the Analysis tab and 1D, and that tab is the sheet (the archetype's lens:
  // stance, latest sentence, questions, packs, the Ask) — the profile and the
  // preset questions are not shown there. Without it nothing here changes.
  sheetContext = null,
}) => {
  const controlledMode = controlledQuote != null;
  const controlledValid = controlledMode
    && typeof controlledQuote === 'object'
    && typeof controlledQuote.posKey === 'string' && controlledQuote.posKey.length > 0
    && typeof controlledQuote.symbol === 'string' && controlledQuote.symbol === asset?.symbol
    && typeof controlledQuote.price === 'number' && Number.isFinite(controlledQuote.price) && controlledQuote.price > 0
    && (controlledQuote.extremes == null
      || (typeof controlledQuote.extremes === 'object' && typeof controlledQuote.extremes.sessionDate === 'string'));
  const failClosed = controlledMode && !controlledValid;
  const controlledPrice = controlledValid ? controlledQuote.price : null;

  // Stock navigation — allows swapping to a different stock via leaderboard
  const [navAsset, setCurrentAsset] = useState(asset);
  const [stockHistory, setStockHistory] = useState([]);
  // Controlled: the CURRENT parent payload, bound to the qualified current.
  const controlledAsset = useMemo(() => (
    controlledPrice != null ? { ...asset, price: controlledPrice, currentPrice: controlledPrice } : null
  ), [asset, controlledPrice]);
  const currentAsset = controlledMode ? controlledAsset : navAsset;

  // Sync when the external prop changes (modal opened for a different stock)
  useEffect(() => {
    setCurrentAsset(asset);
    setStockHistory([]);
    // Assets opened without a price (index ETFs, stocks from FantasyTimes) — fetch from EODHD
    if (!controlledMode && !(asset?.price > 0)) {
      getStockPrice(asset.symbol).then(data => {
        if (!data?.price || isNaN(data.price)) return;
        setCurrentAsset(prev => {
          if (prev?.symbol !== data.symbol) return prev;
          return { ...prev, price: data.price, percentChange: data.percentChange || 0 };
        });
      }).catch(err => console.warn('[AssetPrice] Failed:', err.message));
    }
  }, [asset?.symbol]);

  const isCrypto = useMemo(() => (
    currentAsset?.isCrypto || currentAsset?.category === 'crypto' || CRYPTO_SYMBOLS.has(currentAsset?.symbol)
  ), [currentAsset?.symbol, currentAsset?.isCrypto, currentAsset?.category]);

  const isIndexAsset = useMemo(() => isIndex(currentAsset?.symbol), [currentAsset?.symbol]);
  const isSectorETF = useMemo(() => !!SECTORS[currentAsset?.symbol], [currentAsset?.symbol]);
  // Build C: the sheet is shown for a stock or a crypto in battle (never an index or a sector ETF),
  // and the modal then opens on it — the Analysis tab, on 1D (BC-1, §1 "opens on one line and a question").
  const sheetOn = version >= 2 && sheetContext != null && typeof sheetContext === 'object' && !isIndexAsset && !isSectorETF;
  // FQ-9 (founder ruling 2026-11-08): with Bomb mode also on, a measured held stock
  // inside the red-zone band when the modal OPENS opens on 💣 in the red zone, not the
  // sheet. Decided ONCE, at open, from the price the screen already holds (none yet →
  // the sheet); never switched after open (this state is never set again).
  const [sheetOpensOnBomb] = useState(() => sheetOn && version >= 2 && bombContext != null && typeof bombContext === 'object'
    && opensInRedZone({ bombContext, symbol: asset?.symbol, live: controlledMode ? controlledPrice : (wsPrice || asset?.price || asset?.currentPrice || null), nowMs: Date.now(), isCrypto }));
  const openTab = sheetOpensOnBomb ? 'baggerbomb' : sheetOn ? 'fundamental' : defaultTab;

  const isGameContext = isGameContextProp !== undefined
    ? isGameContextProp
    : (onAcquire !== null || showActionButton);
  // Bomb mode: on for a mount that passes bombContext; under 'on', a mount that
  // does not is a browse / acquire mount and loses the 💣 pill and the Bomb tab.
  const bombOn = version >= 2 && bombContext != null && typeof bombContext === 'object';
  const bombHidden = !bombOn && resolveBombMode() === 'on';
  const [activeTab, setActiveTab] = useState(openTab || (isCrypto ? 'health' : isIndexAsset ? 'marketContext' : isSectorETF ? 'holdings' : 'fundamental'));
  const [whyMovingOpen, setWhyMovingOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileSymbol, setProfileSymbol] = useState(null); // the symbol `profile` was fetched for
  const [profileLoading, setProfileLoading] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [highlightedLevel, setHighlightedLevel] = useState(null);
  // The chart's S/R pill, as the chart reports it (onToggleSR).
  const [srOn, setSrOn] = useState(false);
  const [drawerSnapState, setDrawerSnapState] = useState('mid');
  const [v2ContainerHeight, setV2ContainerHeight] = useState(600);
  const v2ContainerRef = useRef(null);
  const isInternalNavRef = useRef(false);
  const { isMobile, isTablet } = useIsMobile();

  // A new symbol gets a new chart (key) with S/R off and nothing tapped, so the
  // old symbol's S/R state and tapped level are dropped in the same render,
  // before that chart mounts.
  const [chartSymbol, setChartSymbol] = useState(currentAsset?.symbol);
  if (chartSymbol !== currentAsset?.symbol) {
    setChartSymbol(currentAsset?.symbol);
    setHighlightedLevel(null);
    setSrOn(false);
  }
  // BA-5: a hidden Bomb tab is never the open one.
  if (bombHidden && activeTab === 'baggerbomb') {
    setActiveTab(isCrypto ? 'health' : isIndexAsset ? 'marketContext' : isSectorETF ? 'holdings' : 'fundamental');
  }

  const handleNavigateToStock = useCallback((ticker, name) => {
    if (controlledMode) return;
    if (typeof onNavigateAdmission === 'function' && onNavigateAdmission(ticker, name) === false) return;
    isInternalNavRef.current = true;
    setStockHistory(prev => [...prev, currentAsset]);
    setCurrentAsset({ symbol: ticker, name: name || ticker });
  }, [currentAsset, controlledMode, onNavigateAdmission]);

  const handleNavigateBack = useCallback(() => {
    if (controlledMode) return;
    if (stockHistory.length === 0) return;
    const prev = stockHistory[stockHistory.length - 1];
    if (typeof onNavigateAdmission === 'function' && onNavigateAdmission(prev?.symbol, prev?.name) === false) return;
    isInternalNavRef.current = true;
    setStockHistory(h => h.slice(0, -1));
    setCurrentAsset(prev);
  }, [stockHistory, controlledMode, onNavigateAdmission]);

  const canGoBack = !controlledMode && stockHistory.length > 0;
  const isOriginalAsset = currentAsset?.symbol === asset?.symbol;

  const handleClose = useCallback(() => {
    setStockHistory([]);
    onClose();
  }, [onClose]);

  // v2: Responsive chart height — scale to container so date axis clears drawer at mid snap.
  // Drawer mid-top sits at 55% (desktop/tablet) or 62% (mobile) of container.
  // Mobile: 50% of container (min 280) + 40px padding — clears the 62% drawer line.
  // Desktop/tablet: capped at old fixed max but shrinks to 45% when container is small,
  // guaranteeing ≥5% gap (~30px) between chart bottom and drawer top.
  const chartHeight = version >= 2
    ? isMobile
      ? Math.max(Math.round(v2ContainerHeight * 0.5), 280)
      : Math.min(isTablet ? 260 : 300, Math.round(v2ContainerHeight * 0.45))
    : isMobile ? 200 : isTablet ? 260 : 300;
  // Build C (BC-2): the sheet's chart height — a quarter of the container on a
  // phone (150–210 px), a third elsewhere (up to 260 px). Reported in the build report.
  const sheetChartHeight = isMobile
    ? Math.max(150, Math.min(210, Math.round(v2ContainerHeight * 0.25)))
    : Math.max(180, Math.min(260, Math.round(v2ContainerHeight * 0.34)));

  // One price for the whole sheet (BUILD_RULES §9): the live price the header's
  // "% today" and the chart's live candle follow — wsPrice for the original
  // asset, the fetched price for a navigated stock — or, in a held view, the
  // accepted observation. The header price, "Current", the level sides and
  // distances and the chart's S/R colors all read `shownAsset.price`.
  const sheetPrice = controlledMode
    ? (controlledPrice ?? 0)
    : (isOriginalAsset ? wsPrice : null) || currentAsset?.price || currentAsset?.currentPrice || 0;
  const shownAsset = useMemo(() => (
    currentAsset && sheetPrice > 0 && sheetPrice !== currentAsset.price ? { ...currentAsset, price: sheetPrice } : currentAsset
  ), [currentAsset, sheetPrice]);

  // v2: Research data hook for chart + enhanced technical tab
  const researchData = useResearchData(version >= 2 && !failClosed ? currentAsset?.symbol : null, {
    currentPrice: sheetPrice,
    isCrypto: isCrypto,
    // A mount that loses the 💣 view (BA-5) opens on 1D, never fetching the bomb series it cannot show;
    // the sheet (Build C) opens on 1D, the chart its record is pinned to.
    initialTimeframe: sheetOpensOnBomb ? 'bomb' : sheetOn || (bombHidden && (defaultTimeframe === 'bomb' || defaultTimeframe === 'spectate')) ? '1D' : defaultTimeframe,
    technicalActive: activeTab === 'technical',
    srRequested: srOn,
    ...(controlledMode ? { controlled: { extremes: controlledValid ? (controlledQuote.extremes || null) : null } } : {}),
    ...(bombOn ? { bombMode: true } : {}),
  });

  // The chart is on screen exactly when it has bars; it starts with S/R off
  // each time it mounts (after a failed request it unmounts), so the pill's
  // reported state goes with it.
  const chartShown = version >= 2 && !!researchData.ohlcvData && researchData.ohlcvData.length > 0;
  if (srOn && !chartShown) setSrOn(false);

  // The chart's S/R lines and its highlighted level are sided from the same
  // shown price as the Technical tab's rows ("Current"), by the same helper —
  // never by the close detectLevels used. The chart redraws its lines whenever
  // the levels object changes, so a new one is made only when a level changes
  // side: a live tick that moves no level across redraws nothing here (a
  // throttled live-candle update rebuilds the chart, and its lines, anyway).
  const shownPrice = shownAsset?.price;
  const sidedLevels = sideLevelsAt(researchData.levels, shownPrice);
  const sidesKey = sidedLevels
    ? `${(sidedLevels.support || []).map(l => l.price).join(',')}|${(sidedLevels.resistance || []).map(l => l.price).join(',')}`
    : '';
  const chartLevels = useMemo(() => sidedLevels, [researchData.levels, sidesKey]); // eslint-disable-line react-hooks/exhaustive-deps -- the shown price reaches it through sidesKey
  const tappedSide = highlightedLevel && typeof shownPrice === 'number' && Number.isFinite(shownPrice) && shownPrice > 0
    ? sideOfShownPrice(highlightedLevel.price, shownPrice)
    : highlightedLevel?.type;
  const chartHighlight = useMemo(() => (
    highlightedLevel ? { ...highlightedLevel, type: tappedSide } : null
  ), [highlightedLevel, tappedSide]);

  // Always prefer daily change from OHLCV data over parent-provided percentChange.
  // Parent components (BaggerBomb, Snake Draft) pass entry-based cumulative % change
  // for scoring context, but the research modal should show today's daily change.
  const enrichedAsset = useMemo(() => {
    if (researchData.dailyChange != null) {
      return { ...shownAsset, percentChange: researchData.dailyChange };
    }
    return shownAsset;
  }, [shownAsset, researchData.dailyChange]);

  // v2: Bomb chart data — only available when asset has battle context (threshold + baseline price)
  // Prefer previousClose from OHLCV daily data (most accurate daily baseline) over
  // asset properties. This ensures the bomb chart and BaggerBombTab use yesterday's close
  // as the starting point, matching the scoring engine's daily reset behavior.
  // BaggerBomb stock thresholds v2, Ruling 15: a measured-model position's
  // chart draws its committed context's six exact targets from the fill, and
  // its HITs are that context's crossed tiers (StockChart `measured`). An
  // unavailable context draws nothing. Keyed on the context's CONTENT, not its
  // identity: the screen rebuilds an equal context on every render, and a new
  // object here would tear the chart down each time (review B3-2).
  const measuredContext = currentAsset?.stockRewardRoute ? currentAsset.rewardContext : null;
  const measuredBombKey = currentAsset?.stockRewardRoute
    ? (measuredContext?.status === 'valid'
      ? JSON.stringify([measuredContext.fill, measuredContext.targets.map(t => [t.key, t.target]), measuredContext.crossedTiers])
      : 'unavailable')
    : null;
  const bombData = useMemo(() => {
    if (measuredBombKey) {
      if (measuredBombKey === 'unavailable') return null;
      const [fill, targets, crossedTiers] = JSON.parse(measuredBombKey);
      return { measured: true, baselinePrice: fill, targets: targets.map(([key, price]) => ({ key, price })), crossedTiers };
    }
    const threshold = currentAsset?.threshold;
    const baselinePrice =
      researchData.previousClose || // OHLCV-derived yesterday's close (most accurate)
      currentAsset?.baselinePrice ||
      currentAsset?.lockedPrice ||
      currentAsset?.startPrice ||
      currentAsset?.startingPrice ||
      currentAsset?.basePrice ||
      currentAsset?.draftPrice ||
      currentAsset?.price ||          // Fallback to current price (aligns with BaggerBombTab)
      currentAsset?.currentPrice ||
      null;
    if (!threshold || threshold <= 0 || !baselinePrice || baselinePrice <= 0) return null;
    return { threshold, baselinePrice };
  }, [researchData.previousClose, currentAsset?.threshold, currentAsset?.lockedPrice, currentAsset?.baselinePrice,
      currentAsset?.startPrice, currentAsset?.startingPrice, currentAsset?.basePrice, currentAsset?.draftPrice,
      currentAsset?.price, currentAsset?.currentPrice, measuredBombKey]);

  // Bomb mode's one view model (Fuse / red zone / sheet), or null when off. A
  // measured position's ladder IS bombData.measured (spec §3.1); a preview —
  // and, by the 2026-11-07 ruling on §0.4(a), a held legacy-scored position
  // (bombView.buildLadder) — takes yesterday's close for the chart and the
  // sheet alike (BA-1), never the fallback chain above (which stays the
  // mode-off chart's, byte for byte).
  const [bombThreshold, setBombThreshold] = useState(null); // { symbol, threshold } — the sheet's thresholds answer
  const bombView = useBombView({
    on: bombOn,
    context: bombContext,
    symbol: currentAsset?.symbol,
    isOriginal: isOriginalAsset,
    bombData,
    assetThreshold: currentAsset?.threshold,
    fetchedThreshold: bombThreshold && bombThreshold.symbol === currentAsset?.symbol ? bombThreshold.threshold : null,
    isCrypto,
    previousClose: researchData.previousClose,
    live: shownAsset?.price,
    timeframe: researchData.timeframe,
    setTimeframe: researchData.setTimeframe,
    bars: researchData.ohlcvData,
  });
  // The sheet asks for a threshold exactly when BaggerBombTab does today (the
  // tab is showing, the asset carries none, it is not a measured position) —
  // and once when the 💣 view opens without one, which the Fuse needs as much
  // as the sheet does (review B, N2: otherwise the 💣 view says "no ladder yet"
  // until the tab is opened). The same request.
  const bombViewOpen = researchData.timeframe === 'bomb' || researchData.timeframe === 'spectate';
  const haveBombThreshold = !!bombThreshold && bombThreshold.symbol === currentAsset?.symbol;
  const askBombThreshold = bombOn && (activeTab === 'baggerbomb' || (bombViewOpen && !haveBombThreshold));
  useEffect(() => {
    if (!askBombThreshold) return undefined;
    if (currentAsset?.stockRewardRoute || currentAsset?.threshold) return undefined;
    const symbol = currentAsset?.symbol;
    if (!symbol) return undefined;
    let cancelled = false;
    getVolatilityThresholds([symbol], currentAsset?.isCrypto ? 'crypto' : 'stock')
      .then(result => { if (!cancelled && result?.[symbol]) setBombThreshold({ symbol, threshold: result[symbol].threshold }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [askBombThreshold, currentAsset?.symbol, currentAsset?.threshold, currentAsset?.isCrypto, currentAsset?.stockRewardRoute]);

  // Build C: the sheet's view model, or null when off (no clock, no listener, no read).
  const sheetActive = sheetOn && activeTab === 'fundamental';
  const sheetView = useSheetView({
    on: sheetOn,
    context: sheetContext,
    symbol: currentAsset?.symbol,
    isOriginal: isOriginalAsset,
    live: shownAsset?.price,
    rawData: researchData.rawData,
    timeframe: researchData.timeframe,
    isCrypto,
    analysisActive: sheetActive,
  });
  // BC-2: on the sheet the chart is shorter and the drawer sits right under it, so
  // Layer 0 — everything above the action row, the chart included — fits a phone's
  // fold; the action row is pinned under the drawer's scroll area. Measured in a
  // headless browser at 390×844 and 430×932 (the build report).
  const sheetGeom = !!sheetView && sheetActive;
  // The chart section's height in sheet mode: the sheet's on 1D / 1W; on 💣 / spectate
  // the Fuse keeps its full height and the measured section moves the drawer down (the
  // fold is the 1D view's — review D2). The skeleton and the error box use it too, so
  // the drawer never opens low and jumps when the chart lands (review D7).
  const sheetChartH = sheetGeom && !bombViewOpen ? sheetChartHeight : chartHeight;
  // In sheet mode the skeleton and the error box stand in for the WHOLE chart — its
  // control row (StockChart's timeframe and overlay pills: 44 px, measured at
  // 320/390/430/1440) and its plot — so the drawer sits where it will stay (review D7).
  const sheetChartBoxH = sheetGeom ? sheetChartH + 44 : chartHeight;
  const sheetChartRef = useRef(null);
  const [sheetChartBox, setSheetChartBox] = useState(null);
  // The drawer sits on the chart section's measured bottom: re-measured after every
  // render (the chart replaces its skeleton in a later render) and on any resize;
  // a section with no chart in it yet (only its padding) is not a measure.
  const measureSheetChart = useCallback(() => {
    const h = sheetChartRef.current ? sheetChartRef.current.offsetHeight : 0;
    const next = h > 40 ? h : null;
    setSheetChartBox((prev) => (prev === next ? prev : next));
  }, []);
  React.useLayoutEffect(() => { if (sheetGeom) measureSheetChart(); });
  useEffect(() => {
    if (!sheetGeom || !sheetChartRef.current) return undefined;
    const observer = new ResizeObserver(measureSheetChart);
    observer.observe(sheetChartRef.current);
    return () => observer.disconnect();
  }, [sheetGeom, measureSheetChart]);

  // v2: Measure container height for drawer snap points
  useEffect(() => {
    if (version < 2 || !v2ContainerRef.current) return;
    const measure = () => {
      if (v2ContainerRef.current) {
        setV2ContainerHeight(v2ContainerRef.current.clientHeight);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(v2ContainerRef.current);
    return () => observer.disconnect();
  }, [version]);

  const handleDrawerSnapChange = useCallback((state) => {
    setDrawerSnapState(state);
  }, []);

  // Reset tab default when asset or defaultTab changes (e.g. "View Chart" click while modal is open)
  // Skip reset on internal navigation (leaderboard tap / back button) to preserve tab context,
  // UNLESS the asset type changed (e.g. index → stock), in which case reset to avoid showing
  // an invalid tab (marketContext for a stock, or fundamental for an index).
  useEffect(() => {
    const correctTab = openTab || (isCrypto ? 'health' : isIndexAsset ? 'marketContext' : isSectorETF ? 'holdings' : 'fundamental');
    if (isInternalNavRef.current) {
      isInternalNavRef.current = false;
      // Reset tab if it's invalid for the new asset type
      if (
        (activeTab === 'marketContext' && !isIndexAsset) ||
        (activeTab === 'health' && !isCrypto) ||
        (activeTab === 'holdings' && !isSectorETF) ||
        (isIndexAsset && activeTab !== 'marketContext' && activeTab !== 'technical') ||
        (isSectorETF && !['holdings', 'compete', 'sector', 'technical'].includes(activeTab)) ||
        (isCrypto && activeTab !== 'health' && !(sheetOn && activeTab === 'fundamental'))
      ) {
        setActiveTab(correctTab);
      }
      return;
    }
    setActiveTab(correctTab);
  }, [currentAsset?.symbol, openTab]);

  useEffect(() => {
    if (failClosed) return;
    // A symbol change clears the previous symbol's profile — and its analyst
    // rating — at once, and a late answer for the old symbol is dropped.
    let cancelled = false;
    const symbol = currentAsset?.symbol;
    setProfile(null);
    setProfileSymbol(null);
    if (symbol && !isCrypto) {
      setProfileLoading(true);
      setDescExpanded(false);
      getCompanyProfile(symbol)
        .then(data => { if (!cancelled) { setProfile(data); setProfileSymbol(symbol); } })
        .finally(() => { if (!cancelled) setProfileLoading(false); });
    } else {
      setProfileLoading(false);
    }
    return () => { cancelled = true; };
  }, [currentAsset?.symbol]);

  // Fetch current price for internally-navigated stocks (not the original asset).
  // The original asset gets wsPrice from parent; navigated stocks need their own price fetch.
  useEffect(() => {
    if (controlledMode) return; // Controlled held research never fetches a price.
    if (isOriginalAsset || !currentAsset?.symbol) return;
    if (currentAsset?.price > 0) return; // Already has price (e.g., restored from history)

    let cancelled = false;
    getStockPrice(currentAsset.symbol).then(data => {
      if (cancelled || !data?.price) return;
      setCurrentAsset(prev => {
        if (prev?.symbol !== data.symbol) return prev;
        return { ...prev, price: data.price, percentChange: data.percentChange || 0 };
      });
    });
    return () => { cancelled = true; };
  }, [currentAsset?.symbol, isOriginalAsset]);

  if (!asset) return null;
  if (failClosed) return null;

  const sectorColor = getSectorColor(sector);
  const fundamentals = getMockFundamentals(currentAsset.symbol);
  const priceChange = enrichedAsset.percentChange || enrichedAsset.change || 0;

  // The Analysis-tab rating is Wall Street analyst consensus, labeled as such,
  // from the resolved profile of the DISPLAYED symbol alone: nothing while it
  // is pending or missing, and "no coverage" when no analyst covers the stock
  // (the server's rating reads "Hold" there).
  const analystTotal = profile?.analystConsensus?.totalAnalysts;
  const analystChip = profile && !profileLoading && profileSymbol === currentAsset?.symbol
    && typeof analystTotal === 'number' && Number.isFinite(analystTotal)
    ? (analystTotal === 0
      ? { text: 'Wall St: no coverage', color: HOLO_COLORS.textMuted }
      : profile.ratingText
        ? { text: `Wall St: ${profile.ratingText} · ${analystTotal} analyst${analystTotal === 1 ? '' : 's'}`, color: getRatingColor(profile.ratingText) }
        : null)
    : null;
  const analystChipEl = analystChip && (
    <span style={{
      color: analystChip.color, fontWeight: '600', fontSize: '12px',
      padding: '2px 8px', borderRadius: '8px',
      background: `${analystChip.color}15`, border: `1px solid ${analystChip.color}40`,
    }}>
      {analystChip.text}
    </span>
  );

  // Whether the CURRENTLY-DISPLAYED asset can be drafted right now: the draft
  // preconditions (your turn + canPick + an onAcquire handler) AND, when the
  // caller supplies isAcquirable, that predicate for the displayed symbol. So a
  // modal that navigates to an off-board name hides the draft CTA and falls back
  // to the research-only Close button below.
  const acquirePreconditions = isMyTurn && canPick && !!onAcquire;
  const acquirable = acquirePreconditions
    && (typeof isAcquirable === 'function' ? !!isAcquirable(currentAsset?.symbol) : true);
  // The acquire preconditions are met but the per-symbol gate hid the CTA (the
  // displayed name is off-board) — the ONLY new state this prop introduces, so
  // it gets the research-only Close fallback below. When isAcquirable is absent,
  // acquirable === acquirePreconditions, so gatedOut is always false and every
  // existing caller's action section is byte-identical.
  const gatedOut = acquirePreconditions && !acquirable;

  // Category styles derived from CATEGORY_CONFIG
  const getCategoryStyle = (cat) => {
    const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.neutral;
    const color = config.color;
    // Convert hex to rgba for backgrounds/borders
    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    return {
      bg: hexToRgba(color, 0.2),
      color: color,
      border: hexToRgba(color, 0.4),
    };
  };
  const catStyle = getCategoryStyle(category);

  // v2: Compute responsive modal size overrides
  const v2ModalStyle = version >= 2 ? (
    isMobile ? {
      width: '100vw',
      // FQ-6 (2026-11-08): in sheet mode, the visible viewport (100dvh, else 100vh) —
      // the action row is never under Safari's toolbar. Mode off: 100vh, as before.
      height: sheetOn ? visibleViewportHeight() : '100vh',
      top: 0,
      left: 0,
      transform: 'none',
      borderRadius: 0,
      maxHeight: 'none',
    } : {
      width: '90vw',
      maxWidth: '900px',
      height: '90vh',
      maxHeight: '90vh',
      borderRadius: '12px',
    }
  ) : {};

  // Use Portal to render at document.body level, bypassing any parent CSS constraints
  return ReactDOM.createPortal(
    <>
      {/* Backdrop - matches TopPerformersModal pattern */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1100,
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Modal - matches TopPerformersModal pattern */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(calc(100vw - 40px), 480px)',
          maxHeight: 'calc(100vh - 40px)',
          background: '#0d1117',
          borderRadius: '16px',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 255, 255, 0.15)',
          zIndex: 1101,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalSlideIn 0.3s ease-out',
          ...v2ModalStyle,
        }}
      >
        {/* ON THE CLOCK Alert - Shows when it's user's turn */}
        {isMyTurn && (
          <div
            className={timeRemaining <= 15 ? 'on-the-clock-urgent' : 'on-the-clock-alert'}
            style={{
              background: timeRemaining <= 15
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : 'linear-gradient(90deg, #ff9500, #ff6b00)',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>{timeRemaining <= 15 ? '🚨' : '⏰'}</span>
              <div>
                <div style={{
                  fontWeight: 'bold',
                  color: timeRemaining <= 15 ? '#fff' : '#000',
                  fontSize: '14px',
                }}>
                  {timeRemaining <= 15 ? 'HURRY! TIME ALMOST UP!' : "YOU'RE ON THE CLOCK!"}
                </div>
                <div style={{
                  color: timeRemaining <= 15 ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                  fontSize: '12px',
                }}>
                  Make your pick before time runs out
                </div>
              </div>
            </div>

            {/* Time remaining */}
            <div style={{
              background: timeRemaining <= 15 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 'bold',
              color: timeRemaining <= 15 ? '#fff' : '#000',
              fontSize: '18px',
              fontFamily: 'monospace',
              minWidth: '60px',
              textAlign: 'center',
            }}>
              {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
            </div>
          </div>
        )}

        {/* CSS for ON THE CLOCK animations */}
        <style>{`
          @keyframes pulse-alert {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(255, 149, 0, 0.7);
            }
            50% {
              box-shadow: 0 0 0 8px rgba(255, 149, 0, 0);
            }
          }

          @keyframes pulse-urgent {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8);
            }
            50% {
              box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
            }
          }

          .on-the-clock-alert {
            animation: pulse-alert 1.5s ease-in-out infinite;
          }

          .on-the-clock-urgent {
            animation: pulse-urgent 0.5s ease-in-out infinite;
          }

          @media (prefers-reduced-motion: reduce) {
            .on-the-clock-alert,
            .on-the-clock-urgent {
              animation: none !important;
            }
          }
        `}</style>

        {/* Header: v2 compact header vs v1 original header */}
        {version >= 2 ? (
          <ChartHeader asset={enrichedAsset} sector={sector} category={category} isIndex={isIndexAsset} onClose={handleClose} onWhyMoving={() => setWhyMovingOpen(true)} onBack={canGoBack ? handleNavigateBack : undefined} />
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              flexShrink: 0,
            }}
          >
            {canGoBack && (
              <button
                onClick={handleNavigateBack}
                style={{
                  background: 'rgba(0, 217, 255, 0.1)', border: '1px solid rgba(0, 217, 255, 0.2)',
                  borderRadius: '6px', color: '#00d9ff', fontSize: '11px', fontWeight: '600',
                  padding: '4px 10px', cursor: 'pointer', marginRight: '8px',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                {'\u2190'} Back
              </button>
            )}
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#00d9ff',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Close
            </button>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '20px',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Content Area — v2: positioned container for chart+drawer, v1: scrollable */}
        <div
          ref={version >= 2 ? v2ContainerRef : undefined}
          style={version >= 2
            ? { flex: 1, position: 'relative', overflow: 'visible' }
            : { flex: 1, overflowY: 'auto' }
          }
        >

          {/* v1: Stock Hero Section */}
          {version < 2 && (
            <div
              style={{
                padding: '24px',
                margin: '16px',
                background: `linear-gradient(180deg, ${sectorColor}15 0%, transparent 100%)`,
                border: `1px solid ${sectorColor}40`,
                borderRadius: '16px',
                textAlign: 'center',
              }}
            >
              <h1
                style={{
                  fontSize: '32px',
                  fontWeight: '800',
                  color: '#ffffff',
                  margin: 0,
                  textShadow: `0 0 20px ${sectorColor}40`,
                }}
              >
                {currentAsset.symbol}
              </h1>
              <p
                style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  margin: '4px 0 0',
                  fontSize: '14px',
                }}
              >
                {currentAsset.name}
              </p>

              {/* Sector Badge */}
              {sector && (
                <div
                  style={{
                    display: 'inline-block',
                    marginTop: '8px',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    background: `${sectorColor}20`,
                    color: sectorColor,
                    border: `1px solid ${sectorColor}40`,
                  }}
                >
                  {sector}
                </div>
              )}

              <div
                style={{
                  fontSize: '36px',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: '16px 0 8px',
                  fontFamily: 'monospace',
                }}
              >
                ${currentAsset.price?.toFixed(2) || '\u2014'}
              </div>
              <div
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  background: priceChange >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: priceChange >= 0 ? '#10b981' : '#ef4444',
                }}
              >
                {priceChange >= 0 ? '\u25B2' : '\u25BC'} {Math.abs(priceChange)?.toFixed(2)}% today
              </div>
            </div>
          )}

          {/* v1: Draft Category Section */}
          {version < 2 && category && (
            <div
              style={{
                padding: '16px 20px',
                margin: '0 16px 16px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px' }}>Draft Category</span>
              <span
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  background: catStyle.bg,
                  color: catStyle.color,
                  border: `1px solid ${catStyle.border}`,
                }}
              >
                {category}
              </span>
            </div>
          )}

          {/* v2: Chart Section */}
          {version >= 2 && (
            <div ref={sheetGeom ? sheetChartRef : undefined} style={{ flexShrink: 0, position: 'relative', zIndex: 1, paddingBottom: sheetGeom ? '6px' : '40px' }}>
              {researchData.loading && !researchData.ohlcvData && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: `${sheetChartBoxH}px`, background: '#0a0e14',
                }}>
                  <div style={{
                    width: '90%', height: sheetGeom ? `${Math.max(60, sheetChartH - 24)}px` : '200px', borderRadius: '8px',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                  }} />
                </div>
              )}
              {researchData.error && !researchData.ohlcvData && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: `${sheetChartBoxH}px`, background: '#0a0e14', gap: '12px',
                }}>
                  <span style={{ color: HOLO_COLORS.textSecondary, fontSize: '14px' }}>
                    Chart data unavailable
                  </span>
                  <button
                    onClick={researchData.retry}
                    style={{
                      padding: '6px 16px', borderRadius: '6px',
                      border: '1px solid rgba(0, 217, 255, 0.3)',
                      background: 'rgba(0, 217, 255, 0.1)',
                      color: '#00d9ff', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
              {chartShown && (
                <StockChart
                  key={currentAsset?.symbol}
                  ohlcvData={researchData.ohlcvData}
                  rawData={researchData.rawData}
                  timeframe={researchData.timeframe}
                  onTimeframeChange={researchData.setTimeframe}
                  levels={chartLevels}
                  smaData={researchData.smaData}
                  activeHighlight={chartHighlight}
                  height={sheetChartH}
                  bombData={bombHidden ? null : bombOn ? (bombData || BOMB_MODE_PILL) : bombData}
                  symbol={currentAsset?.symbol}
                  todayDailyCandle={researchData.todayDailyCandle}
                  realtimeExtremes={isOriginalAsset && !controlledMode ? realtimeExtremes : null}
                  controlledSession={controlledMode ? { crypto: !!isCrypto } : undefined}
                  onToggleSR={setSrOn}
                  {...(bombView ? { bombPlot: <BombPlot view={bombView} height={chartHeight} />, bombChip: <RedZoneChip mode={bombView.mode} /> } : {})}
                  {...(sheetView?.chart ? { markers: sheetView.chart.markers, priceLines: sheetView.chart.priceLines } : {})}
                />
              )}
            </div>
          )}

          {/* v2: Chart dim overlay when drawer is at full */}
          {version >= 2 && drawerSnapState === 'full' && (
            <div
              onClick={() => setDrawerSnapState('mid')}
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(10, 14, 20, 0.7)',
                zIndex: 5,
                transition: 'opacity 0.3s ease',
              }}
            />
          )}

          {/* v2: AnalysisDrawer with tab content inside */}
          {version >= 2 && (
            <AnalysisDrawer
              containerHeight={v2ContainerHeight}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onSnapStateChange={handleDrawerSnapChange}
              isCrypto={isCrypto}
              isIndex={isIndexAsset}
              isSectorETF={isSectorETF}
              hasBombData={bombOn ? true : bombHidden ? false : !!bombData}
              isGameContext={bombHidden ? false : isGameContext}
              {...(sheetGeom ? { midY: sheetChartBox ?? (sheetChartBoxH + 6), footer: <SheetActionRow view={sheetView} /> } : {})}
              {...(sheetOn ? { analysisAlways: true } : {})}
            >
              {activeTab === 'fundamental' && sheetView && (
                <AnalysisSheet
                  view={sheetView}
                  wallSt={analystChipEl || null}
                  about={profile && !profileLoading && profileSymbol === currentAsset?.symbol && (profile.description || (profile.sector && profile.sector !== 'Unknown')) ? (
                    <div data-sheet-about-body style={{ padding: '8px 10px', borderRadius: '8px', background: ST.surface, border: `1px solid ${ST.hair}` }}>
                      {(profile.sector && profile.sector !== 'Unknown') && (
                        <div style={{ fontSize: '10px', fontWeight: '600', color: HOLO_COLORS.textSecondary, marginBottom: profile.description ? '6px' : 0 }}>
                          {[profile.sector, profile.industry && profile.industry !== 'Unknown' ? profile.industry : null].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {profile.description && <p style={{ color: ST.ink2, fontSize: '11px', lineHeight: '1.5', margin: 0 }}>{profile.description}</p>}
                    </div>
                  ) : null}
                />
              )}
              {activeTab === 'fundamental' && !sheetView && (
                <div style={{ padding: '8px 0' }}>
                  {/* Wall Street analyst consensus */}
                  {analystChipEl && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      {analystChipEl}
                    </div>
                  )}
                  {/* Company profile: sector/industry pills + description */}
                  {profileLoading && (
                    <div style={{ marginBottom: '12px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                      <div style={{ height: '12px', width: '40%', borderRadius: '6px', background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginBottom: '8px' }} />
                      <div style={{ height: '10px', width: '90%', borderRadius: '5px', background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    </div>
                  )}
                  {profile && !profileLoading && (profile.sector !== 'Unknown' || profile.description) && (
                    <div style={{ marginBottom: '12px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: profile.description ? '8px' : 0 }}>
                        {profile.sector && profile.sector !== 'Unknown' && (
                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '600' }}>
                            {profile.sector}
                          </span>
                        )}
                        {profile.industry && profile.industry !== 'Unknown' && (
                          <span style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '600' }}>
                            {profile.industry}
                          </span>
                        )}
                      </div>
                      {profile.description && (
                        <>
                          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', lineHeight: '1.5', margin: 0, overflow: 'hidden', maxHeight: descExpanded ? 'none' : '48px' }}>
                            {profile.description}
                          </p>
                          {profile.description.length > 150 && (
                            <button
                              onClick={() => setDescExpanded(!descExpanded)}
                              style={{ color: '#14b8a6', background: 'none', border: 'none', fontSize: '10px', cursor: 'pointer', padding: '4px 0 0', fontWeight: '500' }}
                            >
                              {descExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {/* Q&A Cards — Ask About This Stock */}
                  <AnalysisQATab
                    symbol={currentAsset?.symbol}
                    companyName={profile?.Name || currentAsset?.name}
                  />
                </div>
              )}

              {activeTab === 'health' && (
                <HealthTab asset={currentAsset} symbol={currentAsset?.symbol} />
              )}

              {activeTab === 'technical' && (
                <TechnicalTabV2
                  asset={shownAsset}
                  dailyData={researchData.dailyData}
                  indicators={researchData.indicators}
                  levels={researchData.levels}
                  sessionDate={sessionDateOf(Date.now(), !!isCrypto)}
                  onLevelHighlight={setHighlightedLevel}
                />
              )}

              {activeTab === 'baggerbomb' && (
                bombView ? <BombSheet view={bombView} /> : <BaggerBombTab asset={currentAsset} />
              )}

              {activeTab === 'holdings' && isSectorETF && (
                <HoldingsTab
                  symbol={currentAsset?.symbol}
                  onNavigateToStock={handleNavigateToStock}
                />
              )}

              {activeTab === 'compete' && !isSectorETF && (
                <CompeteTab
                  symbol={currentAsset?.symbol}
                  isMobile={isMobile}
                  onNavigateToStock={handleNavigateToStock}
                />
              )}

              {activeTab === 'compete' && isSectorETF && (
                <SectorETFRanksTab
                  symbol={currentAsset?.symbol}
                  onNavigateToStock={handleNavigateToStock}
                />
              )}

              {activeTab === 'smartMoney' && (
                <SmartMoneyTab symbol={currentAsset?.symbol} isMobile={isMobile} />
              )}

              {activeTab === 'sector' && (
                <SectorTab
                  symbol={currentAsset?.symbol}
                  isMobile={isMobile}
                  onNavigateToStock={handleNavigateToStock}
                />
              )}

              {activeTab === 'marketContext' && (
                <MarketContextTab
                  symbol={currentAsset?.symbol}
                  onNavigateToStock={handleNavigateToStock}
                />
              )}
            </AnalysisDrawer>
          )}

          {/* v1: AI Analysis Section (original layout) */}
          {version < 2 && (
          <div
            style={{
              padding: '20px',
              margin: '0 16px 16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                color: '#ffffff',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
              <h2 style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '0.5px', margin: 0 }}>
                AI ANALYSIS
              </h2>
            </div>

            {/* Tabs - Horizontal scroll carousel for mobile */}
            <div
              className="ai-tabs-scroll"
              style={{
                display: 'flex',
                gap: '6px',
                marginBottom: '16px',
                overflowX: 'auto',
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                marginLeft: '-20px',
                marginRight: '-20px',
                paddingLeft: '20px',
                paddingRight: '20px',
                paddingBottom: '4px',
              }}
            >
              <style>{`
                .ai-tabs-scroll::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {isCrypto && (
              <button
                onClick={() => setActiveTab('health')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: activeTab === 'health' ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeTab === 'health' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'health' ? '#f59e0b' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {'\u26D3\uFE0F'} Health
              </button>
              )}
              {!isCrypto && (
              <button
                onClick={() => setActiveTab('fundamental')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: activeTab === 'fundamental' ? '1px solid #00d9ff' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeTab === 'fundamental' ? 'rgba(0, 217, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'fundamental' ? '#00d9ff' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Analysis
              </button>
              )}
              {!isCrypto && (
              <button
                onClick={() => setActiveTab('compete')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: activeTab === 'compete' ? '1px solid #a78bfa' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeTab === 'compete' ? 'rgba(167, 139, 250, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'compete' ? '#a78bfa' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Ranks
              </button>
              )}
              {!isCrypto && (
              <button
                onClick={() => setActiveTab('sector')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: activeTab === 'sector' ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeTab === 'sector' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'sector' ? '#f59e0b' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Sector
              </button>
              )}
              <button
                onClick={() => setActiveTab('technical')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: activeTab === 'technical' ? '1px solid #00d9ff' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: activeTab === 'technical' ? 'rgba(0, 217, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === 'technical' ? '#00d9ff' : 'rgba(255, 255, 255, 0.6)',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                Technical
              </button>
              {(bombData || isGameContext) && (
                <button
                  onClick={() => setActiveTab('baggerbomb')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: activeTab === 'baggerbomb' ? '1px solid #00ff88' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: activeTab === 'baggerbomb' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: activeTab === 'baggerbomb' ? '#00ff88' : 'rgba(255, 255, 255, 0.6)',
                    fontWeight: '600',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  💣 Bomb
                </button>
              )}
            </div>

            {activeTab === 'fundamental' && (
              <div>
                {/* Wall Street analyst consensus */}
                {analystChipEl && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                    }}
                  >
                    {analystChipEl}
                  </div>
                )}

                {/* Company Profile Section */}
                {profileLoading && (
                  <div style={{
                    padding: '16px',
                    marginBottom: '16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                  }}>
                    <div style={{
                      height: '14px', width: '40%', borderRadius: '7px',
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      marginBottom: '10px',
                    }} />
                    <div style={{
                      height: '12px', width: '90%', borderRadius: '6px',
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                      marginBottom: '6px',
                    }} />
                    <div style={{
                      height: '12px', width: '70%', borderRadius: '6px',
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite',
                    }} />
                    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
                  </div>
                )}

                {profile && !profileLoading && (profile.sector !== 'Unknown' || profile.description) && (
                  <div style={{
                    padding: '14px 16px',
                    marginBottom: '16px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}>
                    {/* Sector · Industry pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: profile.description ? '10px' : 0 }}>
                      {profile.sector && profile.sector !== 'Unknown' && (
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          padding: '3px 10px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}>
                          {profile.sector}
                        </span>
                      )}
                      {profile.industry && profile.industry !== 'Unknown' && (
                        <span style={{
                          background: 'rgba(139, 92, 246, 0.15)',
                          color: '#818cf8',
                          padding: '3px 10px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: '600',
                        }}>
                          {profile.industry}
                        </span>
                      )}
                    </div>
                    {/* Company description */}
                    {profile.description && (
                      <>
                        <p style={{
                          color: 'rgba(255, 255, 255, 0.55)',
                          fontSize: '12px',
                          lineHeight: '1.55',
                          margin: 0,
                          overflow: 'hidden',
                          maxHeight: descExpanded ? 'none' : '54px',
                        }}>
                          {profile.description}
                        </p>
                        {profile.description.length > 150 && (
                          <button
                            onClick={() => setDescExpanded(!descExpanded)}
                            style={{
                              color: '#14b8a6',
                              background: 'none',
                              border: 'none',
                              fontSize: '11px',
                              cursor: 'pointer',
                              padding: '4px 0 0',
                              fontWeight: '500',
                            }}
                          >
                            {descExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Q&A Cards — Ask About This Stock */}
                <AnalysisQATab
                  symbol={currentAsset?.symbol}
                  companyName={profile?.Name || currentAsset?.name}
                />
              </div>
            )}

            {activeTab === 'health' && (
              <HealthTab asset={currentAsset} symbol={currentAsset?.symbol} />
            )}

            {activeTab === 'technical' && (
              <TechnicalAnalysisTab asset={currentAsset} fundamentals={fundamentals} />
            )}

            {activeTab === 'baggerbomb' && (
              <BaggerBombTab asset={currentAsset} />
            )}

            {activeTab === 'compete' && (
              <CompeteTab
                symbol={currentAsset?.symbol}
                isMobile={isMobile}
                onNavigateToStock={handleNavigateToStock}
              />
            )}

            {activeTab === 'sector' && (
              <SectorTab
                symbol={currentAsset?.symbol}
                isMobile={isMobile}
                onNavigateToStock={handleNavigateToStock}
              />
            )}
          </div>
          )}
        </div>

        {/* Action Button Section - Flexible Configuration */}
        {showActionButton && (
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(0, 0, 0, 0.3)',
              flexShrink: 0,
            }}
          >
            {/* Draft Mode: ON THE CLOCK - drafts the DISPLAYED asset (follows
                internal navigation); gated by `acquirable` so it hides for an
                off-board displayed name. */}
            {acquirable && (
              <button
                onClick={() => {
                  onAcquire(currentAsset);
                  handleClose();
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.3) 0%, rgba(0, 255, 136, 0.1) 100%)',
                  border: '2px solid #00ff88',
                  borderRadius: '10px',
                  color: '#e6edf3',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Acquire {currentAsset.symbol}
              </button>
            )}

            {/* Custom Action Button - New flexible option */}
            {!isMyTurn && actionConfig && (
              <button
                onClick={actionConfig.onClick}
                disabled={actionConfig.disabled}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: actionConfig.variant === 'danger'
                    ? 'linear-gradient(135deg, rgba(255, 51, 102, 0.3) 0%, rgba(255, 51, 102, 0.1) 100%)'
                    : actionConfig.variant === 'secondary'
                    ? 'transparent'
                    : 'linear-gradient(135deg, rgba(0, 255, 136, 0.3) 0%, rgba(0, 255, 136, 0.1) 100%)',
                  border: `2px solid ${
                    actionConfig.variant === 'danger'
                      ? '#ff3366'
                      : actionConfig.variant === 'secondary'
                      ? '#374151'
                      : '#00ff88'
                  }`,
                  borderRadius: '10px',
                  color: actionConfig.variant === 'secondary'
                    ? '#8b949e'
                    : '#e6edf3',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: actionConfig.disabled ? 'not-allowed' : 'pointer',
                  opacity: actionConfig.disabled ? 0.5 : 1,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  transition: 'all 0.2s ease',
                }}
              >
                {actionConfig.label}
              </button>
            )}

            {/* Research Only Mode - Just close button. Original condition
                (!isMyTurn) plus the new gated-out case (your turn, but the
                displayed name is off-board → research-only). */}
            {!actionConfig && (!isMyTurn || gatedOut) && (
              <button
                onClick={handleClose}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'transparent',
                  border: '1px solid #374151',
                  borderRadius: '10px',
                  color: '#8b949e',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Close
              </button>
            )}
          </div>
        )}

        {/* Animations - matches TopPerformersModal */}
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes modalSlideIn {
            from {
              opacity: 0;
              transform: translate(-50%, -45%);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%);
            }
          }
        `}</style>
      </div>

      {/* Why is it moving? bottom sheet */}
      <WhyMovingPopup
        symbol={currentAsset?.symbol}
        name={currentAsset?.name}
        change={controlledMode
          ? (Number.isFinite(researchData.dailyChange) ? researchData.dailyChange : undefined)
          : currentAsset?.percentChange || currentAsset?.change}
        price={currentAsset?.price}
        isOpen={whyMovingOpen}
        onClose={() => setWhyMovingOpen(false)}
        open={researchData.todayDailyCandle?.open}
        high={researchData.todayDailyCandle?.high}
        low={researchData.todayDailyCandle?.low}
        close={researchData.todayDailyCandle?.close}
      />
    </>,
    document.body
  );
};

export default AssetResearchModal;
