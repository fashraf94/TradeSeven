// ThresholdPreview - Shows breakout thresholds for all portfolio assets
// Displays threshold difficulty and what each level means

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BAGGER_TIERS } from '../../constants/baggerBombScoring';

/**
 * ThresholdPreview
 * Shows breakout thresholds for all portfolio assets
 *
 * @param {Object} props
 * @param {Array} props.portfolio - Roster stocks with allocations
 * @param {Object} props.crypto - Roster crypto
 * @param {Array} props.bench - Bench stocks
 * @param {Object} props.benchCrypto - Bench crypto
 * @param {Object} props.thresholds - Threshold data keyed by symbol
 */
export default function ThresholdPreview({
  portfolio = [],
  crypto = null,
  bench = [],
  benchCrypto = null,
  thresholds = {}
}) {
  const [showInfo, setShowInfo] = useState(false);

  // Get threshold data for a symbol with defaults
  const getThreshold = (symbol) => {
    const data = thresholds[symbol?.toUpperCase()];
    if (data) {
      return {
        base: data.threshold || 2.5,
        rally: data.rallyThreshold || (data.threshold * 1.5),
        moonshot: data.moonshotThreshold || (data.threshold * 2.0),
        isDefault: data.isDefault || false
      };
    }
    // Default values
    return { base: 2.5, rally: 3.75, moonshot: 5.0, isDefault: true };
  };

  // Determine difficulty level based on threshold
  const getDifficulty = (threshold) => {
    if (threshold <= 2.0) return { label: 'Easy', color: 'text-emerald-500', bg: 'bg-emerald-500/20' };
    if (threshold <= 4.0) return { label: 'Medium', color: 'text-amber-500', bg: 'bg-amber-500/20' };
    if (threshold <= 7.0) return { label: 'Hard', color: 'text-orange-500', bg: 'bg-orange-500/20' };
    return { label: 'Expert', color: 'text-red-500', bg: 'bg-red-500/20' };
  };

  return (
    <div className="space-y-4">
      {/* Header with info toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Breakout Thresholds</h3>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className={cn(
            'flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors',
            showInfo ? 'bg-cyan-500/20 text-cyan-500' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {showInfo ? 'Hide Info' : 'What\'s This?'}
        </button>
      </div>

      {/* Info panel */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-sm space-y-2">
              <p className="font-medium text-cyan-500">How Thresholds Work</p>
              <p className="text-muted-foreground">
                Each asset has personalized thresholds based on its recent volatility.
                Higher volatility assets need bigger moves to score breakout bonuses.
              </p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {BAGGER_TIERS.map((tier) => (
                  <div key={tier.key} className="text-center p-2 rounded bg-emerald-500/10">
                    <div className="text-lg">{tier.emoji}</div>
                    <div className="text-xs font-medium text-emerald-500">{tier.label}</div>
                    <div className="text-xs text-muted-foreground">+{tier.points} pts</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roster Stocks */}
      {portfolio.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Roster Stocks ({portfolio.length})
          </div>
          <div className="space-y-1">
            {portfolio.map((asset) => (
              <ThresholdRow
                key={asset.symbol}
                symbol={asset.symbol}
                name={asset.name}
                allocation={asset.amount}
                threshold={getThreshold(asset.symbol)}
                difficulty={getDifficulty(getThreshold(asset.symbol).base)}
                isCrypto={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Roster Crypto */}
      {crypto && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Roster Crypto
          </div>
          <ThresholdRow
            symbol={crypto.symbol}
            name={crypto.name}
            allocation={10}
            threshold={getThreshold(crypto.symbol)}
            difficulty={getDifficulty(getThreshold(crypto.symbol).base)}
            isCrypto={true}
          />
        </div>
      )}

      {/* Bench */}
      {(bench.length > 0 || benchCrypto) && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Bench ({bench.length + (benchCrypto ? 1 : 0)})
          </div>
          <div className="space-y-1 opacity-70">
            {bench.map((asset) => (
              <ThresholdRow
                key={asset.symbol}
                symbol={asset.symbol}
                name={asset.name}
                threshold={getThreshold(asset.symbol)}
                difficulty={getDifficulty(getThreshold(asset.symbol).base)}
                isCrypto={false}
                isBench={true}
              />
            ))}
            {benchCrypto && (
              <ThresholdRow
                symbol={benchCrypto.symbol}
                name={benchCrypto.name}
                threshold={getThreshold(benchCrypto.symbol)}
                difficulty={getDifficulty(getThreshold(benchCrypto.symbol).base)}
                isCrypto={true}
                isBench={true}
              />
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Assets</span>
          <span className="font-medium">
            {portfolio.length + (crypto ? 1 : 0) + bench.length + (benchCrypto ? 1 : 0)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-muted-foreground">Thresholds Source</span>
          <span className="text-xs text-cyan-500">
            Based on 14-day ATR
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual threshold row
 */
function ThresholdRow({
  symbol,
  name,
  allocation,
  threshold,
  difficulty,
  isCrypto,
  isBench = false
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center gap-3 p-2 rounded-lg border transition-colors',
        isCrypto ? 'bg-amber-500/5 border-amber-500/20' : 'bg-card/50 border-border/50',
        isBench && 'bg-muted/30'
      )}
    >
      {/* Symbol and name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-bold text-sm',
            isCrypto && 'text-amber-500'
          )}>
            {symbol}
          </span>
          {allocation && (
            <span className="text-xs text-muted-foreground">
              {allocation}%
            </span>
          )}
          {isBench && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              Bench
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {name}
        </div>
      </div>

      {/* Thresholds */}
      <div className="flex items-center gap-3 text-xs">
        <div className="text-center">
          <div className="text-muted-foreground">🎯</div>
          <div className="font-medium">{threshold.base.toFixed(1)}%</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">🚀</div>
          <div className="font-medium">{threshold.rally.toFixed(1)}%</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">🌙</div>
          <div className="font-medium">{threshold.moonshot.toFixed(1)}%</div>
        </div>
      </div>

      {/* Difficulty badge */}
      <div className={cn(
        'text-xs font-medium px-2 py-0.5 rounded',
        difficulty.bg,
        difficulty.color
      )}>
        {difficulty.label}
      </div>
    </motion.div>
  );
}
