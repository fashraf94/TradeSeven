import React from 'react';
import { motion } from 'framer-motion';
import { Zap, ChevronRight } from 'lucide-react';
import HoloCard from '../shared/HoloCard';

const STATUS_CONFIG = {
  active: { label: 'Live', color: '#34D399' },
  market_closed: { label: 'Market closed', color: '#F0C75E' },
  completed: { label: 'Completed', color: '#8B949E' },
};

const GAME_MODE_LABEL = {
  baggerbomb_agent: 'BaggerBomb',
  baggerbomb: 'BaggerBomb',
};

const DeploymentCard = ({ battle, onTap, isDesktop, index = 0 }) => {
  if (!battle) return null;

  const status = battle.status || 'active';
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const gameModeLabel = GAME_MODE_LABEL[battle.gameMode] || 'BaggerBomb';
  const score = battle.scoreState?.currentScore ?? 0;
  const tradeCount = battle.scoreState?.tradeCount ?? 0;
  const executionMode = battle.executionMode || 'copilot';

  const handleClick = () => {
    if (onTap) onTap(battle);
  };

  const isInteractive = typeof onTap === 'function';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: 'spring', stiffness: 300, damping: 24 }}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={isInteractive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onTap(battle);
        }
      } : undefined}
    >
      <HoloCard
        variant="interactive"
        accentColor="cyan"
        onClick={isInteractive ? handleClick : undefined}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          minHeight: 56,
        }}>
          {/* Left: icon + game mode */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
            flex: '0 0 auto',
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 217, 255, 0.08)',
              border: '1px solid rgba(0, 217, 255, 0.3)',
              flexShrink: 0,
            }}>
              <Zap size={16} color="#00d9ff" />
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              minWidth: 0,
            }}>
              <span style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#E6EDF3',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {gameModeLabel}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#8B949E',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                {executionMode}
              </span>
            </div>
          </div>

          {/* Center: score + trade count */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            flex: 1,
            minWidth: 0,
          }}>
            <span style={{
              fontSize: 16,
              fontWeight: 700,
              color: score >= 0 ? '#34D399' : '#EF4444',
              fontFamily: 'monospace',
              lineHeight: 1,
            }}>
              {score >= 0 ? '+' : ''}{score}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              color: '#8B949E',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
            }}>
              {tradeCount} {tradeCount === 1 ? 'trade' : 'trades'}
            </span>
          </div>

          {/* Right: status badge + chevron */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              borderRadius: 10,
              background: `${statusConfig.color}22`,
              border: `1px solid ${statusConfig.color}66`,
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: statusConfig.color,
                boxShadow: `0 0 6px ${statusConfig.color}`,
              }} />
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: statusConfig.color,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
              }}>
                {statusConfig.label}
              </span>
            </div>
            {onTap && <ChevronRight size={16} color="#8B949E" />}
          </div>
        </div>
      </HoloCard>
    </motion.div>
  );
};

export default DeploymentCard;
