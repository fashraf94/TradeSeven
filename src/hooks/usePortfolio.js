// /src/hooks/usePortfolio.js

import { useState, useCallback, useMemo } from 'react';

/**
 * usePortfolio - Manages portfolio building state
 *
 * @returns {Object} Portfolio state and actions
 */
export const usePortfolio = () => {
  // ============================================
  // STATE (moved from App.jsx)
  // ============================================

  const [portfolio, setPortfolio] = useState([]);
  const [portfolioType, setPortfolioType] = useState(null); // 'stocks' | 'crypto' | null
  const [portfolioName, setPortfolioName] = useState('');
  const [assetType, setAssetType] = useState('stocks');
  const [searchTerm, setSearchTerm] = useState('');
  const [builderCategory, setBuilderCategory] = useState('Leadership'); // Leadership/Momentum/Stable/Short tabs
  const [selectedCrypto, setSelectedCrypto] = useState(null); // { symbol: 'BTC', position: 'long' | 'short' }
  const [cryptoPercentage, setCryptoPercentage] = useState(10); // Default 10% for crypto

  // Builder mode state
  const [builderMode, setBuilderMode] = useState('create'); // 'create', 'join', or 'training'

  // Join code
  const [joinCode, setJoinCode] = useState('');

  // Rules modal state
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Track which assets are expanded in portfolio builder
  const [expandedAssets, setExpandedAssets] = useState(new Set());

  // Portfolio Manager Modal state
  const [showPortfolioManager, setShowPortfolioManager] = useState(false);

  // Portfolio Templates state
  const [portfolioTemplates, setPortfolioTemplates] = useState([]);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [saveTemplateModal, setSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Allocation constraints
  const MIN_ALLOCATION = 7.5;
  const MAX_ALLOCATION = 20;
  const MIN_ASSETS = 7;
  const MAX_ASSETS = 13;

  // ============================================
  // COMPUTED
  // ============================================

  const totalAllocation = useMemo(() =>
    portfolio.reduce((sum, asset) => sum + (asset.allocation || 0), 0),
    [portfolio]
  );

  const stockCount = useMemo(() =>
    portfolio.filter(a => a.type !== 'crypto').length,
    [portfolio]
  );

  const cryptoCount = useMemo(() =>
    portfolio.filter(a => a.type === 'crypto').length,
    [portfolio]
  );

  const isValidPortfolio = useMemo(() => {
    if (portfolio.length < MIN_ASSETS || portfolio.length > MAX_ASSETS) return false;
    if (Math.abs(totalAllocation - 100) > 0.1) return false;
    if (portfolio.some(a => a.allocation < MIN_ALLOCATION || a.allocation > MAX_ALLOCATION)) return false;
    return true;
  }, [portfolio, totalAllocation]);

  const remainingAllocation = useMemo(() =>
    100 - totalAllocation,
    [totalAllocation]
  );

  const portfolioSymbols = useMemo(() =>
    portfolio.map(p => p.symbol),
    [portfolio]
  );

  // ============================================
  // ACTIONS
  // ============================================

  const addAsset = useCallback((asset, defaultAllocation = 10) => {
    if (portfolio.some(p => p.symbol === asset.symbol)) return false;
    if (portfolio.length >= MAX_ASSETS) return false;

    const isCrypto = asset.type === 'crypto' || assetType === 'crypto';

    setPortfolio(prev => [...prev, {
      ...asset,
      type: isCrypto ? 'crypto' : 'stock',
      allocation: isCrypto ? cryptoPercentage : defaultAllocation
    }]);

    // Lock portfolio type on first add
    if (portfolio.length === 0) {
      setPortfolioType(assetType);
    }

    return true;
  }, [portfolio, assetType, cryptoPercentage]);

  const removeAsset = useCallback((symbol) => {
    setPortfolio(prev => prev.filter(p => p.symbol !== symbol));
    setExpandedAssets(prev => {
      const next = new Set(prev);
      next.delete(symbol);
      return next;
    });
  }, []);

  const updateAllocation = useCallback((symbol, newAllocation) => {
    const clamped = Math.min(MAX_ALLOCATION, Math.max(MIN_ALLOCATION, newAllocation));
    setPortfolio(prev => prev.map(p =>
      p.symbol === symbol ? { ...p, allocation: clamped } : p
    ));
  }, []);

  const autoBalance = useCallback(() => {
    if (portfolio.length === 0) return;

    const equalAllocation = 100 / portfolio.length;
    setPortfolio(prev => prev.map(p => ({
      ...p,
      allocation: Math.round(equalAllocation * 10) / 10
    })));
  }, [portfolio.length]);

  const resetPortfolio = useCallback(() => {
    setPortfolio([]);
    setPortfolioType(null);
    setPortfolioName('');
    setSearchTerm('');
    setBuilderCategory('Leadership');
    setSelectedCrypto(null);
    setCryptoPercentage(10);
    setJoinCode('');
    setBuilderMode('create');
    setExpandedAssets(new Set());
  }, []);

  const isInPortfolio = useCallback((symbol) =>
    portfolio.some(p => p.symbol === symbol),
    [portfolio]
  );

  const toggleAssetExpanded = useCallback((symbol) => {
    setExpandedAssets(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  }, []);

  const isAssetExpanded = useCallback((symbol) =>
    expandedAssets.has(symbol),
    [expandedAssets]
  );

  const loadFromTemplate = useCallback((template, stocksData = [], cryptoData = []) => {
    if (!template?.assets) return false;

    const allAssets = [...stocksData, ...cryptoData];
    const equalAllocation = 100 / template.assets.length;

    const newPortfolio = template.assets.map(symbol => {
      const asset = allAssets.find(a => a.symbol === symbol);
      const isCrypto = cryptoData.some(c => c.symbol === symbol);

      return {
        symbol,
        name: asset?.name || symbol,
        price: asset?.price || 0,
        type: isCrypto ? 'crypto' : 'stock',
        allocation: Math.round(equalAllocation * 10) / 10
      };
    }).filter(Boolean);

    setPortfolio(newPortfolio);
    setPortfolioType(template.type || 'stocks');
    setPortfolioName(template.name || '');

    return true;
  }, []);

  const saveAsTemplate = useCallback(() => {
    if (!portfolioName || portfolio.length === 0) return null;

    const template = {
      id: `template_${Date.now()}`,
      name: portfolioName || `Portfolio_${new Date().toISOString().split('T')[0]}`,
      type: portfolioType || 'stocks',
      assets: portfolio.map(p => p.symbol),
      allocations: portfolio.map(p => ({
        symbol: p.symbol,
        allocation: p.allocation
      })),
      createdAt: new Date().toISOString(),
      isUser: true
    };

    setPortfolioTemplates(prev => [...prev, template]);
    return template;
  }, [portfolio, portfolioName, portfolioType]);

  const deleteTemplate = useCallback((templateId) => {
    setPortfolioTemplates(prev => prev.filter(t => t.id !== templateId));
  }, []);

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    portfolio,
    setPortfolio,
    portfolioType,
    setPortfolioType,
    portfolioName,
    setPortfolioName,
    assetType,
    setAssetType,
    searchTerm,
    setSearchTerm,
    builderCategory,
    setBuilderCategory,
    selectedCrypto,
    setSelectedCrypto,
    cryptoPercentage,
    setCryptoPercentage,
    builderMode,
    setBuilderMode,
    joinCode,
    setJoinCode,

    // Rules modal
    showRulesModal,
    setShowRulesModal,

    // Expanded assets
    expandedAssets,
    setExpandedAssets,
    toggleAssetExpanded,
    isAssetExpanded,

    // Portfolio manager
    showPortfolioManager,
    setShowPortfolioManager,

    // Templates
    portfolioTemplates,
    setPortfolioTemplates,
    showTemplatesModal,
    setShowTemplatesModal,
    saveTemplateModal,
    setSaveTemplateModal,
    templateName,
    setTemplateName,
    loadFromTemplate,
    saveAsTemplate,
    deleteTemplate,

    // Computed
    totalAllocation,
    stockCount,
    cryptoCount,
    isValidPortfolio,
    remainingAllocation,
    portfolioSymbols,

    // Actions
    addAsset,
    removeAsset,
    updateAllocation,
    autoBalance,
    resetPortfolio,
    isInPortfolio,

    // Constants
    MIN_ALLOCATION,
    MAX_ALLOCATION,
    MIN_ASSETS,
    MAX_ASSETS
  };
};

export default usePortfolio;
