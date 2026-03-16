// /src/components/Dashboard/QuickPlayModal.jsx
// Centered overlay modal with open lobbies + instant AI start options
// Opened from "Quick Play" CTA button on the dashboard

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, ChevronRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import TapGlint from '../shared/TapGlint';
import CenteredModal from '../shared/CenteredModal';
import PendingLobbiesSection from './PendingLobbiesSection';

// ─── AI game options ─────────────────────────────────────────────────────────

const AI_GAMES = [
  {
    id: 'baggerbomb',
    name: 'BaggerBomb AI',
    tagline: 'Start instantly vs AI',
    Icon: Flame,
    iconColor: '#f59e0b',
  },
  {
    id: 'snakeDraft',
    name: 'Snake Draft AI',
    tagline: 'Draft against 3 AI players',
    Icon: TrendingUp,
    iconColor: '#34d399',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function QuickPlayModal({
  isOpen,
  onClose,
  lobbyBattles,
  user,
  setCurrentBattle,
  setCurrentDraft,
  setScreen,
  setBattleToJoin,
  copyToClipboard,
  setShowBaggerBombTrainingConfirm,
  setShowTrainingConfirmModal,
  setTrainingConfirmType,
}) {
  const { tokens } = useTheme();
  const [tapCounts, setTapCounts] = useState({});

  const handleAiSelect = (gameId) => {
    onClose();
    if (gameId === 'baggerbomb') setShowBaggerBombTrainingConfirm(true);
    if (gameId === 'snakeDraft') {
      setTrainingConfirmType('stocks');
      setShowTrainingConfirmModal(true);
    }
  };

  const hasLobbies = lobbyBattles && lobbyBattles.length > 0;

  return (
    <CenteredModal isOpen={isOpen} onClose={onClose} title="Quick Play">
            {/* Scrollable content */}
            <div style={{
              overflowY: 'auto',
              flex: 1,
              padding: '0 20px',
              paddingBottom: '24px',
            }}>
              {/* Section 1: Open Lobbies */}
              <div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: tokens.textFaint,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  marginBottom: '12px',
                  padding: '0 4px',
                }}>
                  Join a Game
                </div>
                {hasLobbies ? (
                  <PendingLobbiesSection
                    lobbyBattles={lobbyBattles}
                    user={user}
                    setCurrentBattle={setCurrentBattle}
                    setCurrentDraft={setCurrentDraft}
                    setScreen={setScreen}
                    setBattleToJoin={setBattleToJoin}
                    copyToClipboard={copyToClipboard}
                  />
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: tokens.textFaint,
                    fontSize: '14px',
                  }}>
                    No open lobbies right now
                  </div>
                )}
              </div>

              {/* Section 2: Instant AI Play */}
              <div style={{ marginTop: '24px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: tokens.textFaint,
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  marginBottom: '12px',
                  padding: '0 4px',
                }}>
                  Instant Play
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {AI_GAMES.map((game) => (
                    <motion.button
                      key={game.id}
                      onClick={() => {
                        setTapCounts(prev => ({ ...prev, [game.id]: (prev[game.id] || 0) + 1 }));
                        handleAiSelect(game.id);
                      }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      style={{
                        position: 'relative',
                        overflow: 'hidden',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '16px',
                        background: tokens.bgCard,
                        border: `1px solid ${tokens.borderDefault}`,
                        borderRadius: '14px',
                        boxShadow: tokens.obsidianShadow,
                        backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <TapGlint triggerKey={tapCounts[game.id] || 0} />
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: tokens.bgIcon,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <game.Icon size={24} color={game.iconColor} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: tokens.textPrimary }}>
                          {game.name}
                        </div>
                        <div style={{ fontSize: '13px', color: tokens.textMuted, marginTop: '2px' }}>
                          {game.tagline}
                        </div>
                      </div>
                      <ChevronRight size={16} color={tokens.textFaintest} style={{ flexShrink: 0 }} />
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
    </CenteredModal>
  );
}
