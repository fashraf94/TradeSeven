// /src/services/scoring/breakoutDetection.js

import { BAGGERBOMB } from './constants';
import { calculateBaggerBombs, calculateBusts } from './baggerBombCalculator';

/**
 * Track breakout state for an asset during a session/day
 * Used to detect NEW breakouts without double-counting
 */
export class BreakoutTracker {
  constructor(symbol, threshold, baselinePrice) {
    this.symbol = symbol;
    this.threshold = threshold;
    this.baselinePrice = baselinePrice;

    // Track highest/lowest points reached
    this.highestPercent = 0;
    this.lowestPercent = 0;

    // Track triggered breakouts
    this.triggeredBaggerBombs = 0;
    this.triggeredBusts = 0;

    // Event log
    this.events = [];
  }

  /**
   * Update with new price and check for breakouts
   * @param {number} currentPrice - Current price
   * @param {number} timestamp - Optional timestamp
   * @returns {object|null} New breakout event or null
   */
  update(currentPrice, timestamp = Date.now()) {
    const percentChange = ((currentPrice - this.baselinePrice) / this.baselinePrice) * 100;

    let newEvent = null;

    // Check for new BaggerBomb (positive direction)
    if (percentChange > this.highestPercent) {
      this.highestPercent = percentChange;

      const totalBaggerBombs = calculateBaggerBombs(percentChange, this.threshold);
      const newBaggerBombs = totalBaggerBombs - this.triggeredBaggerBombs;

      if (newBaggerBombs > 0) {
        this.triggeredBaggerBombs = totalBaggerBombs;

        newEvent = {
          type: 'BAGGERBOMB',
          symbol: this.symbol,
          count: newBaggerBombs,
          totalCount: totalBaggerBombs,
          points: newBaggerBombs * BAGGERBOMB.POINTS_PER_THRESHOLD,
          percentChange,
          price: currentPrice,
          timestamp
        };

        this.events.push(newEvent);
      }
    }

    // Check for new Bust (negative direction)
    if (percentChange < this.lowestPercent) {
      this.lowestPercent = percentChange;

      const totalBusts = calculateBusts(percentChange, this.threshold);
      const newBusts = totalBusts - this.triggeredBusts;

      if (newBusts > 0) {
        this.triggeredBusts = totalBusts;

        newEvent = {
          type: 'BUST',
          symbol: this.symbol,
          count: newBusts,
          totalCount: totalBusts,
          points: newBusts * BAGGERBOMB.BUST_POINTS_PER_THRESHOLD,
          percentChange,
          price: currentPrice,
          timestamp
        };

        this.events.push(newEvent);
      }
    }

    return newEvent;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      symbol: this.symbol,
      threshold: this.threshold,
      highestPercent: this.highestPercent,
      lowestPercent: this.lowestPercent,
      triggeredBaggerBombs: this.triggeredBaggerBombs,
      triggeredBusts: this.triggeredBusts,
      totalPoints: (this.triggeredBaggerBombs * BAGGERBOMB.POINTS_PER_THRESHOLD) +
                   (this.triggeredBusts * BAGGERBOMB.BUST_POINTS_PER_THRESHOLD),
      events: this.events
    };
  }

  /**
   * Reset for new session/day
   * @param {number} newBaselinePrice - New baseline price
   */
  reset(newBaselinePrice) {
    this.baselinePrice = newBaselinePrice;
    this.highestPercent = 0;
    this.lowestPercent = 0;
    this.triggeredBaggerBombs = 0;
    this.triggeredBusts = 0;
    this.events = [];
  }
}

/**
 * Create trackers for a portfolio of assets
 * @param {Array} portfolio - Array of { symbol, price, threshold }
 * @returns {Map} Map of symbol -> BreakoutTracker
 */
export const createPortfolioTrackers = (portfolio) => {
  const trackers = new Map();

  for (const asset of portfolio) {
    trackers.set(
      asset.symbol,
      new BreakoutTracker(asset.symbol, asset.threshold, asset.price)
    );
  }

  return trackers;
};

/**
 * Update all trackers with new prices
 * @param {Map} trackers - Map of BreakoutTrackers
 * @param {object} prices - Map of symbol -> price
 * @returns {Array} Array of new breakout events
 */
export const updateTrackers = (trackers, prices) => {
  const events = [];

  for (const [symbol, tracker] of trackers) {
    const price = prices[symbol];
    if (price !== undefined) {
      const event = tracker.update(price);
      if (event) {
        events.push(event);
      }
    }
  }

  return events;
};

/**
 * Format breakout event for notification
 * @param {object} event - Breakout event
 * @returns {object} Formatted notification
 */
export const formatBreakoutNotification = (event) => {
  if (event.type === 'BAGGERBOMB') {
    const bombs = '\u{1F4A3}'.repeat(Math.min(event.count, 5));
    return {
      title: `${bombs} BaggerBomb!`,
      message: `${event.symbol} crossed ${event.count} threshold${event.count > 1 ? 's' : ''} (+${event.points} pts)`,
      type: 'success',
      points: event.points
    };
  } else {
    return {
      title: `\u{1F4C9} Bust`,
      message: `${event.symbol} dropped ${event.count} threshold${event.count > 1 ? 's' : ''} (${event.points} pts)`,
      type: 'warning',
      points: event.points
    };
  }
};
