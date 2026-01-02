// SubstitutionPanel - Panel for making substitutions during sub windows
// Allows swapping bench players into active roster

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  getRemainingSubstitutions,
  getCurrentSubstitutionWindow,
  SUBSTITUTION_RULES
} from '../../services/substitutionService';

/**
 * SubstitutionPanel
 * Panel for making substitutions during sub windows
 *
 * @param {Object} props
 * @param {Object} props.battle - Battle document
 * @param {string} props.playerId - 'creator' or 'opponent'
 * @param {Object} props.currentPrices - Map of symbol -> current price
 * @param {Function} props.onSubstitute - Callback when substitution is requested
 */
export default function SubstitutionPanel({
  battle,
  playerId,
  currentPrices = {},
  onSubstitute
}) {
  const [selectedOut, setSelectedOut] = useState(null);
  const [selectedIn, setSelectedIn] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Get current substitution window
  const windowInfo = useMemo(() => getCurrentSubstitutionWindow(), []);
  const isWindowOpen = windowInfo !== null;

  // Get remaining substitutions
  const remaining = useMemo(() => {
    return getRemainingSubstitutions(battle, playerId);
  }, [battle, playerId]);

  // Get player's roster and bench
  const playerData = battle?.[playerId];
  const portfolio = playerData?.portfolio || [];
  const bench = playerData?.bench || [];

  // Filter bench to only show valid subs (matching asset type)
  const getValidBenchAssets = (outAsset) => {
    if (!outAsset) return bench;
    const isCrypto = ['BTC', 'ETH', 'SOL', 'ADA', 'DOGE', 'XRP'].includes(
      outAsset.symbol?.toUpperCase()
    );
    return bench.filter((asset) => {
      const benchIsCrypto = ['BTC', 'ETH', 'SOL', 'ADA', 'DOGE', 'XRP'].includes(
        asset.symbol?.toUpperCase()
      );
      return isCrypto === benchIsCrypto;
    });
  };

  // Update countdown timer
  useEffect(() => {
    if (!isWindowOpen) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
      const et = new Date(etString);

      const endHour = windowInfo.end.hour;
      const endMinute = windowInfo.end.minute;

      const endTime = new Date(et);
      endTime.setHours(endHour, endMinute, 0, 0);

      const diff = endTime - et;
      if (diff > 0) {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining({ minutes, seconds });
      } else {
        setTimeRemaining(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isWindowOpen, windowInfo]);

  // Handle substitution
  const handleSubstitute = () => {
    if (!selectedOut || !selectedIn || !onSubstitute) return;

    onSubstitute({
      outSymbol: selectedOut.symbol,
      inSymbol: selectedIn.symbol,
      windowNumber: windowInfo?.windowNumber
    });

    // Reset selections
    setSelectedOut(null);
    setSelectedIn(null);
    setShowConfirm(false);
  };

  // Closed window state
  if (!isWindowOpen) {
    return (
      <div className="rounded-lg border border-border/30 bg-card/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Substitutions</span>
          <span className="text-xs text-muted-foreground">
            {remaining.total} remaining
          </span>
        </div>

        <div className="text-center py-4">
          <div className="text-2xl mb-2">⏰</div>
          <div className="text-sm text-muted-foreground">
            Substitution window closed
          </div>
          <div className="text-xs text-muted-foreground/70 mt-1">
            Next window: {getNextWindowTime()}
          </div>
        </div>

        {/* Windows used */}
        <div className="mt-3 pt-3 border-t border-border/30">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Window 1 (11:30 AM)</span>
            <span>{remaining.window1Used ? '✓ Used' : 'Available'}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Window 2 (2:00 PM)</span>
            <span>{remaining.window2Used ? '✓ Used' : 'Available'}</span>
          </div>
        </div>
      </div>
    );
  }

  // No subs remaining
  if (remaining.total === 0) {
    return (
      <div className="rounded-lg border border-border/30 bg-card/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Substitutions</span>
          <span className="text-xs text-amber-500">All used</span>
        </div>

        <div className="text-center py-4">
          <div className="text-2xl mb-2">🔒</div>
          <div className="text-sm text-muted-foreground">
            No substitutions remaining
          </div>
          <div className="text-xs text-muted-foreground/70 mt-1">
            You've used both substitutions
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-cyan-500/30 bg-card/30 overflow-hidden">
      {/* Header with timer */}
      <div className="px-4 py-3 bg-cyan-500/10 border-b border-cyan-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-cyan-500"
            />
            <span className="text-sm font-medium text-cyan-500">
              Sub Window Open
            </span>
          </div>

          {timeRemaining && (
            <div className="text-sm font-mono text-cyan-500">
              {timeRemaining.minutes}:{timeRemaining.seconds.toString().padStart(2, '0')}
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {remaining.total} substitution{remaining.total !== 1 ? 's' : ''} remaining
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Active Roster */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Active Roster (Sub Out)
          </div>
          <div className="space-y-2">
            {portfolio.map((asset) => (
              <AssetButton
                key={asset.symbol}
                asset={asset}
                price={currentPrices[asset.symbol]}
                isSelected={selectedOut?.symbol === asset.symbol}
                onClick={() => {
                  setSelectedOut(selectedOut?.symbol === asset.symbol ? null : asset);
                  setSelectedIn(null);
                }}
                type="out"
              />
            ))}
          </div>
        </div>

        {/* Bench */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Bench (Sub In)
          </div>
          <div className="space-y-2">
            {(selectedOut ? getValidBenchAssets(selectedOut) : bench).map((asset) => (
              <AssetButton
                key={asset.symbol}
                asset={asset}
                price={currentPrices[asset.symbol]}
                isSelected={selectedIn?.symbol === asset.symbol}
                onClick={() => setSelectedIn(selectedIn?.symbol === asset.symbol ? null : asset)}
                type="in"
                disabled={!selectedOut}
              />
            ))}
          </div>

          {selectedOut && getValidBenchAssets(selectedOut).length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-2">
              No matching assets on bench
            </div>
          )}
        </div>

        {/* Confirm Button */}
        <AnimatePresence>
          {selectedOut && selectedIn && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              {!showConfirm ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="w-full py-3 rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-600 transition-colors"
                >
                  Confirm Substitution
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-center text-muted-foreground">
                    Replace <strong>{selectedOut.symbol}</strong> with{' '}
                    <strong>{selectedIn.symbol}</strong>?
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="flex-1 py-2 rounded-lg border border-border bg-card text-sm hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubstitute}
                      className="flex-1 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-colors"
                    >
                      Execute Sub
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Asset button for selection
 */
function AssetButton({ asset, price, isSelected, onClick, type, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 p-2 rounded-lg border transition-all text-left',
        'hover:bg-accent/50',
        disabled && 'opacity-50 cursor-not-allowed',
        isSelected && type === 'out' && 'border-red-500/50 bg-red-500/10',
        isSelected && type === 'in' && 'border-emerald-500/50 bg-emerald-500/10',
        !isSelected && 'border-border/30 bg-card/30'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{asset.symbol}</div>
        <div className="text-xs text-muted-foreground truncate">
          {asset.name || asset.symbol}
        </div>
      </div>

      {price !== undefined && (
        <div className="text-xs text-muted-foreground">
          ${price?.toFixed(2) || '—'}
        </div>
      )}

      {isSelected && (
        <div
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded',
            type === 'out' && 'bg-red-500/20 text-red-500',
            type === 'in' && 'bg-emerald-500/20 text-emerald-500'
          )}
        >
          {type === 'out' ? 'OUT' : 'IN'}
        </div>
      )}
    </button>
  );
}

/**
 * Get next substitution window time
 */
function getNextWindowTime() {
  const now = new Date();
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etString);
  const currentMinutes = et.getHours() * 60 + et.getMinutes();

  const window1Start = 11 * 60 + 30; // 11:30 AM
  const window2Start = 14 * 60;      // 2:00 PM

  if (currentMinutes < window1Start) {
    return '11:30 AM ET';
  } else if (currentMinutes < window2Start) {
    return '2:00 PM ET';
  } else {
    return 'Tomorrow 11:30 AM ET';
  }
}
