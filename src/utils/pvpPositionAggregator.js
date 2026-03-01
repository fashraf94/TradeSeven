import { flattenPortfolio } from './baggerBombUtils';
import { isTrainingBattle } from './battleHelpers';

/**
 * Aggregates positions from active PVP battles with entry prices,
 * thresholds, tier info, and game source metadata.
 *
 * Unlike activePicksAggregator (which deduplicates symbols),
 * this returns one row per position per battle for the Positions view.
 *
 * @returns {Array<{
 *   symbol: string,
 *   name: string,
 *   entryPrice: number,
 *   gameType: string,       // 'BB' | 'SD' | '1v1'
 *   gameId: string,
 *   tier: string | null,    // 'star'|'core'|'support' for BB only
 *   threshold: number|null, // ATR % for BB only
 *   battle: object,         // reference to battle/draft for navigation
 *   battleType: string,     // 'draft' | 'classic' — for navigation routing
 * }>}
 */
export function aggregatePvpPositions({ uid, activeBattles = [], activeDraftBattles = [] }) {
  const positions = [];

  // 1. BaggerBomb V3/V4 — PVP only (filter out training)
  // Require startingPrices to be populated (battle has actually begun)
  activeBattles
    .filter(b =>
      (b._v === 3 || b._v === 4) &&
      b.state?.status === 'active' &&
      !isTrainingBattle(b) &&
      b.startingPrices && Object.keys(b.startingPrices).length > 0
    )
    .forEach(battle => {
      const isCreator = battle.creatorId === uid ||
                        battle.creator?.uid === uid ||
                        battle.creator?.odUserId === uid;
      const portfolio = isCreator ? battle.creator?.portfolio : battle.opponent?.portfolio;
      if (!portfolio) return;

      const assets = flattenPortfolio(portfolio);
      assets.forEach(asset => {
        if (!asset.symbol) return;
        positions.push({
          symbol: asset.symbol,
          name: asset.name || asset.symbol,
          entryPrice: battle.startingPrices[asset.symbol] || battle.state?.startingPrices?.[asset.symbol] || 0,
          gameType: 'BB',
          gameId: battle.id,
          tier: asset.tier || null,
          threshold: battle.thresholds?.[asset.symbol]?.threshold || null,
          battle,
          battleType: 'classic',
        });
      });
    });

  // 2. Classic 1v1 — PVP only
  activeBattles
    .filter(b =>
      (!b._v || b._v < 3) &&
      b.state?.status === 'active' &&
      !isTrainingBattle(b)
    )
    .forEach(battle => {
      const isCreator = battle.creatorId === uid ||
                        battle.creator === uid ||
                        battle.creator?.uid === uid;
      const portfolio = isCreator ? battle.creatorPortfolio : battle.opponentPortfolio;
      if (!Array.isArray(portfolio)) return;

      portfolio.forEach(asset => {
        if (!asset.symbol) return;
        positions.push({
          symbol: asset.symbol,
          name: asset.name || asset.symbol,
          entryPrice: battle.lockedPrices?.[asset.symbol] || asset.lockedPrice || 0,
          gameType: '1v1',
          gameId: battle.id,
          tier: null,
          threshold: null,
          battle,
          battleType: 'classic',
        });
      });
    });

  // 3. Snake Draft — PVP only
  (activeDraftBattles || [])
    .filter(d =>
      (d.status === 'active' || d.status === 'in_progress') &&
      !isTrainingBattle(d)
    )
    .forEach(draft => {
      const players = Array.isArray(draft.players) ? draft.players : [];
      const playerData = players.find(p => p.odUserId === uid);
      const portfolio = playerData?.portfolio || playerData?.picks || [];
      if (!Array.isArray(portfolio)) return;

      portfolio.forEach(asset => {
        if (!asset.symbol) return;
        positions.push({
          symbol: asset.symbol,
          name: asset.name || asset.symbol,
          entryPrice: draft.lockedPrices?.[asset.symbol] || 0,
          gameType: 'SD',
          gameId: draft.id,
          tier: null,
          threshold: null,
          battle: draft,
          battleType: 'draft',
        });
      });
    });

  // Defensive filter: remove any positions without a valid entry price
  const validPositions = positions.filter(p => {
    if (!p.entryPrice || p.entryPrice <= 0) {
      console.warn(`[PVP Positions] Filtered phantom: ${p.symbol} from ${p.gameType} (battle: ${p.gameId}) — no entry price`);
      return false;
    }
    return true;
  });

  return validPositions;
}
