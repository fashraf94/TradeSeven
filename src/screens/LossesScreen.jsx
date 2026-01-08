// /src/screens/LossesScreen.jsx

import React from 'react';
import { ChevronUp } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

/**
 * Helper to get username from player object
 */
const getUsername = (player) => {
  if (!player) return 'Unknown';
  return player.username || player.odUsername || player.displayName || 'Unknown';
};

/**
 * LossesScreen - Display all lost battles
 *
 * @param {Object} props
 * @param {Array} props.battles - Array of previous battles
 * @param {Function} props.onBack - Handler to go back
 * @param {Function} props.onViewBattle - Handler to view a specific battle
 * @param {Function} props.onNavigate - Handler for screen navigation
 * @param {Object} props.battleTimer - Battle timer utilities
 * @param {Object} props.colors - Design tokens
 * @param {Object} props.containerStyle - Container style from App
 */
const LossesScreen = ({
  battles = [],
  onBack,
  onViewBattle,
  onNavigate,
  battleTimer,
  colors,
  containerStyle
}) => {
  const { user } = useUser();

  // Filter to only losses
  const lostBattles = battles.filter(b => b.result && b.result.winner !== user?.username);

  return (
    <div style={containerStyle}>
      <div className="min-h-screen pb-20" style={{ background: colors?.background || '#0d1117' }}>
        {/* Header */}
        <div className="bg-[#161b22] border-b border-gray-800 p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-cyan-500 hover:text-cyan-400"
            >
              <ChevronUp className="w-5 h-5 rotate-[-90deg]" />
              <span>Back</span>
            </button>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-white">
              <span className="text-red-500">💀</span>
              Your Losses
            </h1>
            <div className="w-16"></div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-4">
          {/* Stats Summary */}
          <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-xl p-6 mb-6 text-center text-white">
            <div className="text-6xl mb-2 font-bold">{user?.losses || 0}</div>
            <div className="text-xl font-semibold">Total Losses</div>
            <div className="text-sm mt-2 opacity-90">Every loss is a learning opportunity 💪</div>
          </div>

          {/* Lost Battles List */}
          <h2 className="text-lg font-bold mb-4 text-white">Battle History</h2>

          {lostBattles.length > 0 ? (
            <div className="space-y-3">
              {lostBattles.map(battle => {
                const result = battle.result;
                const userReturn = getUsername(battle.creator) === user?.username ? result.creatorReturn : result.opponentReturn;
                const opponentReturn = getUsername(battle.creator) === user?.username ? result.opponentReturn : result.creatorReturn;
                const opponent = getUsername(battle.creator) === user?.username ? getUsername(battle.opponent) : getUsername(battle.creator);
                const xpEarned = result.xpAwarded?.[user?.username] || 0;

                return (
                  <div
                    key={battle.id}
                    onClick={() => onViewBattle?.(battle)}
                    className="bg-[#161b22] border border-red-500/30 rounded-xl p-4 cursor-pointer hover:border-red-500 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-white">{battle.portfolioName || 'Unnamed Portfolio'}</h3>
                      <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">LOSS</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                      <span>vs. {opponent}</span>
                      <span>{battleTimer?.formatDate?.(battle.completedAt || battle.archivedAt) || 'Unknown date'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-red-500 font-semibold">You: {userReturn >= 0 ? '+' : ''}{userReturn?.toFixed(2)}%</span>
                      <span className="text-green-500 font-semibold">Them: {opponentReturn >= 0 ? '+' : ''}{opponentReturn?.toFixed(2)}%</span>
                    </div>
                    {xpEarned > 0 && (
                      <div className="text-xs text-yellow-500 mt-2">+{xpEarned} XP</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#161b22] border border-gray-700 rounded-xl p-12 text-center">
              <div className="text-6xl mb-4">🎯</div>
              <p className="text-gray-400 mb-2">No losses yet</p>
              <p className="text-sm text-gray-500">You're undefeated! Keep it up!</p>
            </div>
          )}
        </div>

        {/* Mobile Bottom Nav - Losses Screen */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-[#161b22] border-t-2 border-gray-800 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex justify-around items-center">
            <button onClick={() => onNavigate?.('wins')} className="flex flex-col items-center gap-1 min-w-[70px] transition-colors text-gray-400">
              <span className="text-2xl">🏆</span>
              <span className="text-xs font-semibold">Wins</span>
            </button>
            <button onClick={() => onNavigate?.('losses')} className="flex flex-col items-center gap-1 min-w-[70px] transition-colors text-red-500">
              <span className="text-2xl">💀</span>
              <span className="text-xs font-semibold">Losses</span>
            </button>
            <button onClick={() => onNavigate?.('profile')} className="flex flex-col items-center gap-1 min-w-[70px] transition-colors text-gray-400">
              <span className="text-2xl">👤</span>
              <span className="text-xs font-semibold">Profile</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default LossesScreen;
