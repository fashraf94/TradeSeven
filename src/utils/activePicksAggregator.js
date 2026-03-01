import { safePortfolioArray } from './portfolioHelpers';

/**
 * Aggregates all unique symbols the user currently has in active games.
 * Returns a deduplicated array of { symbol, name, sources } objects.
 */
export function aggregateActivePicks({
  uid,
  activeBattles = [],
  activeTrainingBattles = [],
  activeDraftBattles = [],
}) {
  const symbolMap = new Map(); // symbol -> { name, sources: Set }

  const allBattles = [...activeBattles, ...activeTrainingBattles];

  // 1. BaggerBomb battles (V3/V4 — tiered portfolio)
  allBattles
    .filter(b => b.state?.status === 'active' && (b._v === 3 || b._v === 4))
    .forEach(battle => {
      const isCreator = battle.creatorId === uid ||
                        battle.creator?.uid === uid ||
                        battle.creator?.odUserId === uid;
      const portfolio = isCreator ? battle.creator?.portfolio : battle.opponent?.portfolio;
      if (!portfolio) return;

      const assets = safePortfolioArray(portfolio);
      assets.forEach(asset => {
        addToMap(symbolMap, asset.symbol, asset.name, 'BaggerBomb');
      });
    });

  // 2. Classic 1v1 battles (flat array)
  allBattles
    .filter(b => b.state?.status === 'active' && (!b._v || b._v < 3))
    .forEach(battle => {
      const isCreator = battle.creatorId === uid ||
                        battle.creator === uid ||
                        battle.creator?.uid === uid;
      const portfolio = isCreator ? battle.creatorPortfolio : battle.opponentPortfolio;
      if (!Array.isArray(portfolio)) return;

      portfolio.forEach(asset => {
        addToMap(symbolMap, asset.symbol, asset.name, 'Classic');
      });
    });

  // 3. Snake Draft battles
  // draft.players is an ARRAY of { odUserId, username, portfolio: [...] }
  activeDraftBattles
    .filter(d => d.status === 'active' || d.status === 'in_progress')
    .forEach(draft => {
      const players = Array.isArray(draft.players) ? draft.players : [];
      const playerData = players.find(p => p.odUserId === uid);
      const portfolio = playerData?.portfolio || playerData?.picks || [];
      if (!Array.isArray(portfolio)) return;

      portfolio.forEach(asset => {
        addToMap(symbolMap, asset.symbol, asset.name, 'Snake Draft');
      });
    });

  // Convert map to sorted array
  return Array.from(symbolMap.entries())
    .map(([symbol, data]) => ({
      symbol,
      name: data.name,
      sources: Array.from(data.sources),
      sourceCount: data.sources.size,
    }))
    .sort((a, b) => b.sourceCount - a.sourceCount || a.symbol.localeCompare(b.symbol));
}

function addToMap(map, symbol, name, source) {
  if (!symbol) return;
  if (!map.has(symbol)) {
    map.set(symbol, { name: name || symbol, sources: new Set() });
  }
  map.get(symbol).sources.add(source);
}
