// BaggerBombLobby - Lobby screen for finding and creating BaggerBomb V3 battles
// Shows list of open battles waiting for opponents

import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Plus, Users, Clock, Zap, RefreshCw } from 'lucide-react';
import { HOLO_COLORS } from '../constants/holoTheme';

/**
 * Format time elapsed since battle creation
 */
function formatTimeAgo(createdAt) {
  if (!createdAt) return 'Just now';

  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

/**
 * Battle Card - Shows a single open battle in the lobby
 */
function BattleCard({ battle, onJoin, isOwn }) {
  const creator = battle.creator || {};
  const createdAt = battle.timing?.createdAt || battle.createdAt;

  // Count assets in portfolio
  const assetCount = useMemo(() => {
    const portfolio = creator.portfolio || {};
    const starCount = (portfolio.star || []).filter(Boolean).length;
    const coreCount = (portfolio.core || []).filter(Boolean).length;
    const supportCount = (portfolio.support || []).filter(Boolean).length;
    return starCount + coreCount + supportCount;
  }, [creator.portfolio]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ scale: 1.01 }}
      style={{
        backgroundColor: isOwn ? `${HOLO_COLORS.cyan}10` : HOLO_COLORS.bgCard,
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        border: `1px solid ${isOwn ? HOLO_COLORS.cyan : HOLO_COLORS.borderSubtle}`,
        cursor: isOwn ? 'default' : 'pointer',
      }}
      onClick={() => !isOwn && onJoin(battle)}
    >
      {/* Header Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Avatar */}
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: HOLO_COLORS.bgElevated,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            border: `2px solid ${isOwn ? HOLO_COLORS.cyan : HOLO_COLORS.borderSubtle}`,
          }}>
            {creator.avatar || '👤'}
          </div>

          {/* Creator Info */}
          <div>
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              color: HOLO_COLORS.textPrimary,
            }}>
              {creator.username || 'Anonymous'}
              {isOwn && (
                <span style={{
                  marginLeft: '8px',
                  fontSize: '10px',
                  backgroundColor: HOLO_COLORS.cyan,
                  color: HOLO_COLORS.bgDeep,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 700,
                }}>
                  YOU
                </span>
              )}
            </div>
            <div style={{
              fontSize: '12px',
              color: HOLO_COLORS.textMuted,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <Clock size={12} />
              {formatTimeAgo(createdAt)}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: `${HOLO_COLORS.gold}20`,
          color: HOLO_COLORS.gold,
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 600,
        }}>
          <Users size={14} />
          Waiting...
        </div>
      </div>

      {/* Portfolio Preview */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px',
        backgroundColor: HOLO_COLORS.bgElevated,
        borderRadius: '8px',
      }}>
        <div style={{
          fontSize: '13px',
          color: HOLO_COLORS.textSecondary,
        }}>
          <span style={{ color: HOLO_COLORS.textPrimary, fontWeight: 600 }}>
            {assetCount}
          </span> assets ready
        </div>

        {!isOwn && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: HOLO_COLORS.cyan,
              color: HOLO_COLORS.bgDeep,
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onJoin(battle);
            }}
          >
            <Zap size={14} />
            Join Battle
          </motion.button>
        )}

        {isOwn && (
          <div style={{
            fontSize: '12px',
            color: HOLO_COLORS.textMuted,
            fontStyle: 'italic',
          }}>
            Waiting for opponent...
          </div>
        )}
      </div>
    </motion.div>
  );
}

BattleCard.propTypes = {
  battle: PropTypes.object.isRequired,
  onJoin: PropTypes.func.isRequired,
  isOwn: PropTypes.bool,
};

/**
 * BaggerBombLobby - Main lobby component
 */
export default function BaggerBombLobby({
  user,
  openBattles = [],
  loading = false,
  onCreateBattle,
  onJoinBattle,
  onBack,
  onRefresh,
}) {
  const userId = user?.odUserId || user?.username;

  // Separate own battles from others
  const { ownBattles, otherBattles } = useMemo(() => {
    const own = [];
    const others = [];

    openBattles.forEach(battle => {
      const creatorId = battle.creator?.odUserId || battle.creator?.uid;
      if (creatorId === userId) {
        own.push(battle);
      } else {
        others.push(battle);
      }
    });

    return { ownBattles: own, otherBattles: others };
  }, [openBattles, userId]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: HOLO_COLORS.bgDeep,
      padding: '16px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 0',
            marginBottom: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: HOLO_COLORS.cyan,
            fontSize: '14px',
          }}
        >
          <ChevronLeft size={20} />
          Back
        </button>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 700,
              color: HOLO_COLORS.textPrimary,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <span style={{ fontSize: '28px' }}>💣</span>
              BaggerBomb Lobby
            </h1>
            <p style={{
              fontSize: '13px',
              color: HOLO_COLORS.textMuted,
              margin: '4px 0 0 0',
            }}>
              Join an open battle or create your own
            </p>
          </div>

          {/* Refresh Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRefresh}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              backgroundColor: HOLO_COLORS.bgCard,
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              borderRadius: '10px',
              cursor: 'pointer',
              color: HOLO_COLORS.textSecondary,
            }}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </motion.button>
        </div>
      </div>

      {/* Create Battle Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onCreateBattle}
        style={{
          width: '100%',
          padding: '16px',
          marginBottom: '24px',
          backgroundColor: HOLO_COLORS.cyan,
          color: HOLO_COLORS.bgDeep,
          border: 'none',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <Plus size={20} />
        Create New Battle
      </motion.button>

      {/* Your Pending Battles */}
      {ownBattles.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{
            fontSize: '14px',
            fontWeight: 600,
            color: HOLO_COLORS.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '12px',
          }}>
            Your Open Battles
          </h2>

          <AnimatePresence>
            {ownBattles.map(battle => (
              <BattleCard
                key={battle.id}
                battle={battle}
                onJoin={() => {}}
                isOwn
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Open Battles */}
      <div>
        <h2 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: HOLO_COLORS.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          Open Battles
          {otherBattles.length > 0 && (
            <span style={{
              backgroundColor: HOLO_COLORS.cyan,
              color: HOLO_COLORS.bgDeep,
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
            }}>
              {otherBattles.length}
            </span>
          )}
        </h2>

        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            color: HOLO_COLORS.textMuted,
          }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{
                width: '32px',
                height: '32px',
                border: `3px solid ${HOLO_COLORS.cyan}30`,
                borderTopColor: HOLO_COLORS.cyan,
                borderRadius: '50%',
                marginBottom: '12px',
              }}
            />
            <span>Loading battles...</span>
          </div>
        ) : otherBattles.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            backgroundColor: HOLO_COLORS.bgCard,
            borderRadius: '12px',
            border: `1px dashed ${HOLO_COLORS.borderSubtle}`,
          }}>
            <span style={{ fontSize: '48px', marginBottom: '12px' }}>🏜️</span>
            <span style={{
              fontSize: '16px',
              fontWeight: 600,
              color: HOLO_COLORS.textPrimary,
              marginBottom: '4px',
            }}>
              No open battles
            </span>
            <span style={{
              fontSize: '13px',
              color: HOLO_COLORS.textMuted,
              textAlign: 'center',
            }}>
              Be the first to create a battle!
            </span>
          </div>
        ) : (
          <AnimatePresence>
            {otherBattles.map(battle => (
              <BattleCard
                key={battle.id}
                battle={battle}
                onJoin={onJoinBattle}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

BaggerBombLobby.propTypes = {
  /** Current user object */
  user: PropTypes.object,
  /** List of open battles from Firebase */
  openBattles: PropTypes.array,
  /** Loading state */
  loading: PropTypes.bool,
  /** Callback when user wants to create a new battle */
  onCreateBattle: PropTypes.func.isRequired,
  /** Callback when user wants to join a battle */
  onJoinBattle: PropTypes.func.isRequired,
  /** Callback when back button is pressed */
  onBack: PropTypes.func.isRequired,
  /** Callback to refresh battles list */
  onRefresh: PropTypes.func,
};

BaggerBombLobby.defaultProps = {
  user: null,
  openBattles: [],
  loading: false,
  onRefresh: () => {},
};
