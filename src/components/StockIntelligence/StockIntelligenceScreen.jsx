// src/components/StockIntelligence/StockIntelligenceScreen.jsx
// Full-screen Stock Intelligence Agent — educational AI analysis for stocks and crypto.
// Replaces Build My Thesis in the Research Tools grid.

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HOLO_COLORS } from '../../constants/holoTheme';

// ─── Color Tokens (matches ResearchLandingPage.jsx) ─────────
const C = {
  bgPrimary: HOLO_COLORS.bgDeep,
  bgCard: HOLO_COLORS.bgCard,
  bgElevated: HOLO_COLORS.bgElevated,
  cyan: '#00d9ff',
  green: '#00ff88',
  red: '#ff4757',
  amber: '#f59e0b',
  purple: '#a78bfa',
  white: '#ffffff',
  textPrimary: HOLO_COLORS.textPrimary,
  textSecondary: HOLO_COLORS.textSecondary,
  textMuted: '#484f58',
  border: 'rgba(0,217,255,0.08)',
  borderHover: 'rgba(0,217,255,0.2)',
  cyanDim: 'rgba(0,217,255,0.12)',
  bgSurface: '#1c2128',
};

// ─── Suggested Questions ────────────────────────────────────
const DEFAULT_QUESTIONS = [
  "What's the technical setup?",
  "How are the fundamentals?",
  "Any upcoming catalysts?",
  "What are the key risk factors?",
];

// Follow-up questions based on what was just asked
const FOLLOWUP_MAP = {
  technical:    ["How do the fundamentals look?", "Any recent news?"],
  fundamental:  ["What's the technical picture?", "Any earnings coming up?"],
  earnings:     ["What do the technicals show?", "How has the stock reacted to past earnings?"],
  news:         ["What do the technicals show?", "How are the fundamentals?"],
  general:      ["Dive deeper into technicals", "What are the risk factors?"],
};

// Supply chain follow-up pills — shown when meta.hasSupplyChainData is true
const SUPPLY_CHAIN_PILLS = {
  products: "What products use {SYMBOL}'s components?",
  themes:   "What investment themes is {SYMBOL} part of?",
  scenarios: "What are the supply chain risks?",
  general:  "Who are {SYMBOL}'s key competitors?",
};

// ─── Pulsing Dots (loading indicator) ───────────────────────
const DOTS_KEYFRAMES = `
@keyframes pulseDot {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1.2); }
}`;

const ThinkingDots = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '16px 0' }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: C.cyan,
        animation: `pulseDot 1.4s infinite ease-in-out ${i * 0.2}s`,
      }} />
    ))}
    <span style={{ fontSize: '12px', color: C.textMuted, marginLeft: '4px' }}>Analyzing...</span>
  </div>
);

// ─── Value color helper for data point cards ────────────────
const getValueColor = (key, value) => {
  const k = key.toLowerCase();
  const v = String(value).toLowerCase();
  if (k.includes('growth') || k.includes('margin') || (k.includes('consensus') && v.includes('buy')))
    return '#4ade80';
  if (v.includes('risk') || v.includes('severe') || v.includes('vulnerability'))
    return '#f87171';
  if (['rsi', 'macd', 'sma', 'ema', 'atr', 'bollinger', 'volume'].some(t => k.includes(t)))
    return '#22d3ee';
  return C.textPrimary;
};

// ─── Stagger animation helper ────────────────────────────────
const stagger = (index) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: 'easeOut', delay: index * 0.05 },
});

// ─── Analysis Response Card ─────────────────────────────────
const AnalysisCard = ({ analysis, meta }) => {
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [showAllDataPoints, setShowAllDataPoints] = useState(false);

  if (!analysis) return null;

  // Defensive: if analysis is a raw string (fallback), render as plain text
  if (typeof analysis === 'string') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ fontSize: '13.5px', lineHeight: 1.65, color: C.textSecondary, whiteSpace: 'pre-wrap' }}>
        {analysis}
      </motion.div>
    );
  }

  // Normalize dataPoints to entries array — handles object, array, or missing
  const dpEntries = (() => {
    if (!analysis.dataPoints) return [];
    if (Array.isArray(analysis.dataPoints)) return analysis.dataPoints.map((v, i) => [String(i), v]);
    if (typeof analysis.dataPoints === 'object') return Object.entries(analysis.dataPoints);
    return [];
  })();

  const isLongContent = analysis.content && analysis.content.length > 600;
  const hasBullBear = analysis.bullCase || analysis.bearCase;

  const visibleDpEntries = showAllDataPoints ? dpEntries : dpEntries.slice(0, 6);
  const hiddenDpCount = dpEntries.length - 6;

  let sectionIdx = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 0' }}>
      {/* Stale data warning */}
      {meta?.staleData && (
        <motion.div {...stagger(sectionIdx++)} style={{
          fontSize: '11px',
          color: C.amber,
          background: `${C.amber}10`,
          border: `1px solid ${C.amber}25`,
          borderRadius: '8px',
          padding: '8px 12px',
        }}>
          Note: some data may be delayed ({meta.staleFields?.join(', ')})
        </motion.div>
      )}

      {/* Headline */}
      {analysis.headline && (
        <motion.div {...stagger(sectionIdx++)} style={{
          fontSize: '18px',
          fontWeight: 700,
          color: C.textPrimary,
          paddingBottom: '10px',
          borderBottom: '1px solid rgba(0,217,255,0.12)',
        }}>
          {analysis.headline}
        </motion.div>
      )}

      {/* Content with Read more / Show less */}
      {analysis.content && (
        <motion.div {...stagger(sectionIdx++)}>
          <div style={{ position: 'relative' }}>
            <div style={{
              fontSize: '13.5px',
              lineHeight: 1.65,
              color: C.textSecondary,
              whiteSpace: 'pre-wrap',
              ...(isLongContent && !isContentExpanded ? {
                maxHeight: '200px',
                overflow: 'hidden',
              } : {}),
            }}>
              {analysis.content}
            </div>
            {/* Fade gradient overlay when collapsed */}
            {isLongContent && !isContentExpanded && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '60px',
                background: `linear-gradient(transparent, ${C.bgPrimary})`,
                pointerEvents: 'none',
              }} />
            )}
          </div>
          {isLongContent && (
            <button
              onClick={() => setIsContentExpanded(prev => !prev)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 0',
                fontSize: '12px',
                color: C.cyan,
                cursor: 'pointer',
                marginTop: '4px',
              }}
            >
              {isContentExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </motion.div>
      )}

      {/* Data Points — card grid */}
      {dpEntries.length > 0 && (
        <motion.div {...stagger(sectionIdx++)} style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '8px',
        }}>
          {visibleDpEntries.map(([key, val]) => {
            const isObj = val && typeof val === 'object' && !Array.isArray(val);
            const displayValue = isObj ? (val.value ?? val.signal ?? JSON.stringify(val)) : String(val);
            const context = isObj ? (val.context || val.explanation) : null;

            return (
              <div key={key} style={{
                background: 'rgba(13, 17, 23, 0.8)',
                border: '1px solid rgba(0,217,255,0.12)',
                borderRadius: '8px',
                padding: '10px 12px',
                transition: 'border-color 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,217,255,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0,217,255,0.12)'}
              >
                <div style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: '#6b7280',
                  marginBottom: '4px',
                }}>
                  {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                </div>
                <div style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: getValueColor(key, displayValue),
                }}>
                  {String(displayValue)}
                </div>
                {context && (
                  <div style={{
                    fontSize: '11px',
                    color: '#6b7280',
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {context}
                  </div>
                )}
              </div>
            );
          })}

          {/* "+N more" chip */}
          {!showAllDataPoints && hiddenDpCount > 0 && (
            <div
              onClick={() => setShowAllDataPoints(true)}
              style={{
                background: 'rgba(0,217,255,0.08)',
                border: '1px solid rgba(0,217,255,0.2)',
                borderRadius: '8px',
                padding: '10px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,217,255,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0,217,255,0.2)'}
            >
              <span style={{ fontSize: '13px', color: C.cyan, fontWeight: 600 }}>
                +{hiddenDpCount} more
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Bull / Bear Cases */}
      {hasBullBear && (
        <motion.div {...stagger(sectionIdx++)} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {analysis.bullCase && (
            <div style={{
              flex: '1 1 200px',
              background: 'rgba(74, 222, 128, 0.06)',
              borderLeft: '3px solid #4ade80',
              borderRadius: '8px',
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#4ade80', marginBottom: '6px' }}>
                <span style={{ marginRight: '6px' }}>●</span>Bull Case
              </div>
              <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#9ca3af' }}>
                {analysis.bullCase}
              </div>
            </div>
          )}
          {analysis.bearCase && (
            <div style={{
              flex: '1 1 200px',
              background: 'rgba(248, 113, 113, 0.06)',
              borderLeft: '3px solid #f87171',
              borderRadius: '8px',
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#f87171', marginBottom: '6px' }}>
                <span style={{ marginRight: '6px' }}>●</span>Bear Case
              </div>
              <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#9ca3af' }}>
                {analysis.bearCase}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Educational Note */}
      {analysis.educationalNote && (
        <motion.div {...stagger(sectionIdx++)} style={{
          background: 'rgba(139, 92, 246, 0.06)',
          borderLeft: '3px solid rgba(139, 92, 246, 0.4)',
          borderRadius: '8px',
          padding: '12px 14px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#8b5cf6', marginBottom: '4px' }}>
              Key Insight
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#9ca3af', fontStyle: 'italic' }}>
              {analysis.educationalNote}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════

const StockIntelligenceScreen = ({ onBack, stocksData, cryptoData, colors, user }) => {
  // ─── State ────────────────────────────────────────────────
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState(null);

  const conversationEndRef = useRef(null);
  const inputRef = useRef(null);

  // ─── Derived Data ─────────────────────────────────────────
  const allAssets = useMemo(() => [
    ...(stocksData || []),
    ...(cryptoData || []),
  ], [stocksData, cryptoData]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !allAssets?.length) return [];
    const q = searchQuery.toLowerCase();
    return allAssets
      .filter(a => a.symbol.toLowerCase().includes(q) || (a.name && a.name.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [searchQuery, allAssets]);

  const showDropdown = searchFocused && searchResults.length > 0;

  // Last assistant message's question types (for follow-up pills)
  const lastAssistantMsg = [...conversation].reverse().find(m => m.role === 'assistant');
  const lastQuestionTypes = lastAssistantMsg?.meta?.questionTypes || [];

  const followUpPills = useMemo(() => {
    if (!lastAssistantMsg || !selectedSymbol) return [];
    const pills = [];
    for (const type of lastQuestionTypes) {
      const suggestions = FOLLOWUP_MAP[type] || FOLLOWUP_MAP.general;
      for (const s of suggestions) {
        if (!pills.includes(s)) pills.push(s);
      }
    }
    if (!pills.includes('Tell me more')) pills.push('Tell me more');
    return pills.slice(0, 4);
  }, [lastAssistantMsg, lastQuestionTypes, selectedSymbol]);

  // Supply chain follow-up pills (only when supply chain data exists for symbol)
  const supplyChainPills = useMemo(() => {
    if (!lastAssistantMsg?.meta?.hasSupplyChainData || !selectedSymbol) return [];
    const coverage = lastAssistantMsg.meta.supplyChainCoverage || [];
    const sym = selectedSymbol.symbol;
    const pills = [];
    for (const type of coverage) {
      const template = SUPPLY_CHAIN_PILLS[type];
      if (template) pills.push(template.replace('{SYMBOL}', sym));
    }
    pills.push(SUPPLY_CHAIN_PILLS.general.replace('{SYMBOL}', sym));
    return pills.slice(0, 3);
  }, [lastAssistantMsg, selectedSymbol]);

  // ─── Handlers ─────────────────────────────────────────────
  const handleSelectSymbol = useCallback((asset) => {
    setSelectedSymbol(asset);
    setSearchQuery('');
    setSearchFocused(false);
    setConversation([]);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleClearSymbol = useCallback(() => {
    setSelectedSymbol(null);
    setSearchQuery('');
    setConversation([]);
    setError(null);
  }, []);

  const handleAsk = useCallback(async (questionText) => {
    if (!selectedSymbol || !questionText.trim() || isLoading) return;

    const userMsg = { role: 'user', content: questionText };
    setConversation(prev => [...prev.slice(-4), userMsg]);
    setQuestion('');
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stock-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedSymbol.symbol,
          question: questionText,
          context: { currentScreen: 'stockIntelligence' },
        }),
      });
      const data = await res.json();

      // Safety net A: if analysis.content contains raw JSON, try to reparse entirely
      if (data.success && data.analysis && typeof data.analysis.content === 'string') {
        const c = data.analysis.content;
        if (c.includes('"headline"') && c.includes('"content"')) {
          try {
            const cleaned = c.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const reparsed = JSON.parse(cleaned.match(/\{[\s\S]*\}/)?.[0] || '{}');
            if (reparsed.headline && reparsed.content) {
              data.analysis = reparsed;
            }
          } catch {
            // Keep original analysis — secondary parse failed
          }
        }
      }

      // Safety net B: if dataPoints is empty but content has data-point-like text,
      // the backend fallback likely dumped structured data into content.
      // Try to extract key-value pairs from content patterns like "value: 32.4x"
      if (data.success && data.analysis &&
          (!data.analysis.dataPoints || Object.keys(data.analysis.dataPoints).length === 0) &&
          typeof data.analysis.content === 'string' &&
          data.analysis.content.includes('value:')) {
        try {
          const text = data.analysis.content;
          // Pattern: "MetricName:\n    value: xxx," or "MetricName:\n  value: xxx,"
          const blockPattern = /([A-Z][A-Za-z_/ ]+?):\s*\n\s*value:\s*([^\n,]+)/g;
          const extracted = {};
          let match;
          while ((match = blockPattern.exec(text)) !== null) {
            const name = match[1].trim();
            const value = match[2].trim();
            // Also try to grab context on the next line
            const contextMatch = text.slice(match.index + match[0].length).match(/^\s*,?\s*\n?\s*context:\s*([^\n,]+)/);
            extracted[name] = { value, context: contextMatch ? contextMatch[1].trim() : '' };
          }
          if (Object.keys(extracted).length > 0) {
            data.analysis.dataPoints = extracted;
            // Clean the content: strip the extracted data-point blocks
            data.analysis.content = text
              .replace(/[A-Z][A-Za-z_/ ]+?:\s*\n\s*value:[^\n]*(?:\n\s*(?:context|explanation):[^\n]*)*/g, '')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
          }
        } catch {
          // Extraction failed — keep content as-is
        }
      }

      if (data.success && data.analysis) {
        setConversation(prev => [...prev, {
          role: 'assistant',
          content: data.analysis.content,
          analysis: data.analysis,
          meta: data.meta,
        }]);
      } else {
        setError(data.error || 'Analysis unavailable. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol, isLoading]);

  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    if (question.trim()) handleAsk(question.trim());
  }, [question, handleAsk]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, isLoading]);

  // ─── Render ───────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: C.bgPrimary,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style>{DOTS_KEYFRAMES}</style>

      {/* ═══ Header ═══ */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${C.border}`,
        background: C.bgCard,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: C.white }}>
              Stock Intelligence
            </div>
            <div style={{ fontSize: '12px', color: C.textMuted }}>
              Educational market analysis powered by AI
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Search Bar ═══ */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        {selectedSymbol ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: C.bgElevated,
            border: `1px solid ${C.cyan}33`,
            borderRadius: '12px',
            padding: '10px 14px',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: C.cyan }}>
                  {selectedSymbol.symbol}
                </span>
                <span style={{ fontSize: '12px', color: C.textSecondary }}>
                  {selectedSymbol.name}
                </span>
              </div>
              {selectedSymbol.price != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: C.white }}>
                    ${typeof selectedSymbol.price === 'number' ? selectedSymbol.price.toFixed(2) : selectedSymbol.price}
                  </span>
                  {selectedSymbol.change != null && (
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: selectedSymbol.change >= 0 ? C.green : C.red,
                    }}>
                      {selectedSymbol.change >= 0 ? '+' : ''}{typeof selectedSymbol.change === 'number' ? selectedSymbol.change.toFixed(1) : selectedSymbol.change}%
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleClearSymbol}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search for a stock or crypto..."
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  background: C.bgElevated,
                  border: `1px solid ${searchFocused ? C.cyan + '66' : C.border}`,
                  borderRadius: '12px',
                  color: C.textPrimary,
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: searchFocused ? `0 0 20px ${C.cyan}10` : 'none',
                  transition: 'all 0.2s',
                }}
              />
            </div>

            {/* Dropdown */}
            {showDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                background: C.bgElevated,
                border: `1px solid ${C.borderHover}`,
                borderRadius: '12px',
                overflow: 'hidden',
                zIndex: 20,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                {searchResults.map(asset => (
                  <div
                    key={asset.symbol}
                    onMouseDown={() => handleSelectSymbol(asset)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: `1px solid ${C.border}`,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${C.cyan}0a`}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: C.cyan }}>{asset.symbol}</span>
                      <span style={{ fontSize: '12px', color: C.textMuted, marginLeft: '8px' }}>{asset.name}</span>
                    </div>
                    {asset.price != null && (
                      <span style={{ fontSize: '12px', color: C.textSecondary }}>
                        ${typeof asset.price === 'number' ? asset.price.toFixed(2) : asset.price}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Main Content Area (scrollable) ═══ */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        paddingBottom: '80px', // room for input bar
      }}>
        {/* Empty state — no symbol selected */}
        {!selectedSymbol && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5" style={{ opacity: 0.4, marginBottom: '16px' }}>
              <path d="M12 2a8 8 0 0 1 8 8c0 2.1-.8 4-2.1 5.4A8 8 0 0 1 12 18a8 8 0 0 1-5.9-2.6A8 8 0 0 1 4 10a8 8 0 0 1 8-8z" />
              <path d="M12 18v4" /><path d="M8 22h8" />
            </svg>
            <div style={{ fontSize: '15px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>
              Search for a stock or crypto to get started
            </div>
            <div style={{ fontSize: '12px', color: C.textMuted }}>
              Ask any question and get educational, data-backed analysis
            </div>
          </div>
        )}

        {/* Suggested questions — shown when symbol selected, no conversation yet */}
        {selectedSymbol && conversation.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: C.textMuted, marginBottom: '10px' }}>
              SUGGESTED QUESTIONS
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {DEFAULT_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleAsk(q)}
                  style={{
                    background: C.bgCard,
                    border: `1px solid ${C.cyan}30`,
                    borderRadius: '20px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: C.cyan,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = `${C.cyan}12`;
                    e.currentTarget.style.borderColor = `${C.cyan}60`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = C.bgCard;
                    e.currentTarget.style.borderColor = `${C.cyan}30`;
                  }}
                >
                  {q}
                </button>
              ))}
              {/* Stress Test — Coming Soon */}
              <button
                title="Coming Soon — Phase 6"
                style={{
                  background: C.bgCard,
                  border: `1px dashed ${C.purple}40`,
                  borderRadius: '20px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: C.purple,
                  cursor: 'default',
                  opacity: 0.5,
                }}
              >
                Stress Test
              </button>
            </div>
          </motion.div>
        )}

        {/* Conversation */}
        <AnimatePresence>
          {conversation.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              style={{ marginTop: i === 0 && conversation.length > 0 && selectedSymbol ? '0' : '16px' }}
            >
              {msg.role === 'user' ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: '12px',
                }}>
                  <div style={{
                    background: `${C.cyan}12`,
                    border: `1px solid ${C.cyan}20`,
                    borderRadius: '16px 16px 4px 16px',
                    padding: '10px 14px',
                    maxWidth: '80%',
                    fontSize: '13px',
                    color: C.textPrimary,
                  }}>
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '16px' }}>
                  <AnalysisCard analysis={msg.analysis} meta={msg.meta} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading */}
        {isLoading && <ThinkingDots />}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: `${C.red}10`,
              border: `1px solid ${C.red}25`,
              borderRadius: '10px',
              padding: '12px 14px',
              marginTop: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '12px', color: C.red }}>{error}</span>
            <button
              onClick={() => { setError(null); }}
              style={{
                background: 'none',
                border: `1px solid ${C.red}40`,
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                color: C.red,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* Follow-up pills (after assistant response) */}
        {selectedSymbol && !isLoading && followUpPills.length > 0 && conversation.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}
          >
            {followUpPills.map((pill) => (
              <button
                key={pill}
                onClick={() => handleAsk(pill)}
                style={{
                  background: C.bgCard,
                  border: `1px solid ${C.cyan}25`,
                  borderRadius: '16px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: C.cyan,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = `${C.cyan}0a`;
                  e.currentTarget.style.borderColor = `${C.cyan}50`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = C.bgCard;
                  e.currentTarget.style.borderColor = `${C.cyan}25`;
                }}
              >
                {pill}
              </button>
            ))}
            {/* Supply chain follow-up pills (amber accent) */}
            {supplyChainPills.map((pill) => (
              <button
                key={pill}
                onClick={() => handleAsk(pill)}
                style={{
                  background: C.bgCard,
                  border: `1px solid ${C.amber || '#f59e0b'}25`,
                  borderRadius: '16px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: C.amber || '#f59e0b',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = `${C.amber || '#f59e0b'}0a`;
                  e.currentTarget.style.borderColor = `${C.amber || '#f59e0b'}50`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = C.bgCard;
                  e.currentTarget.style.borderColor = `${C.amber || '#f59e0b'}25`;
                }}
              >
                {pill}
              </button>
            ))}
            {/* Stress Test follow-up — coming soon */}
            <button
              title="Coming Soon — Phase 6"
              style={{
                background: C.bgCard,
                border: `1px dashed ${C.purple}30`,
                borderRadius: '16px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 500,
                color: C.purple,
                cursor: 'default',
                opacity: 0.4,
              }}
            >
              Stress Test
            </button>
          </motion.div>
        )}

        <div ref={conversationEndRef} />
      </div>

      {/* ═══ Query Input Bar (fixed bottom) ═══ */}
      {selectedSymbol && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: C.bgCard,
          borderTop: `1px solid ${C.border}`,
          padding: '10px 16px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          zIndex: 30,
        }}>
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder={`Ask about ${selectedSymbol.symbol}...`}
              maxLength={500}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px 14px',
                background: C.bgElevated,
                border: `1px solid ${C.border}`,
                borderRadius: '12px',
                color: C.textPrimary,
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                opacity: isLoading ? 0.5 : 1,
              }}
            />
            <button
              type="submit"
              disabled={!question.trim() || isLoading}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: question.trim() && !isLoading ? C.cyan : C.bgElevated,
                border: 'none',
                cursor: question.trim() && !isLoading ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={question.trim() && !isLoading ? C.bgPrimary : C.textMuted}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default StockIntelligenceScreen;
