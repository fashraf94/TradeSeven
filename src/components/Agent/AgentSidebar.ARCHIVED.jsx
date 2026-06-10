import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import MechSVG from '../Forge/MechSVG';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';

const AgentSidebar = ({ agent, speech, deployText, currentLevel, levelConfig, nextLevelInfo, isDesktop, isMobile, tokens, onDeploy, deploying }) => {
  const nameSize = isDesktop ? '18px' : '16px';

  // Null-safe defaults
  const name = agent?.name || 'Agent';
  const avatarColors = agent?.avatarColors || ['#5eead4', '#a855f7'];
  const archetype = getArchetypeDisplayName(agent?.archetype);
  const drift = agent?.archetypeDrift || null;
  const wins = agent?.stats?.wins || 0;
  const losses = agent?.stats?.losses || 0;
  const avgScore = agent?.stats?.avgScore || 0;
  const evoCycle = agent?.evolutionCycle || 0;

  // Mech personality for the compact hub avatar.
  // TODO(phase-3+): Wire getMechColors(slotUsage) via useForge for Forge color parity.
  const mechPrimaryGlow = avatarColors[0] || '#5EEAD4';
  const mechVisorColor = avatarColors[1] || mechPrimaryGlow;
  const hasBundleEquipped = (agent?.equippedBundleIds?.length || 0) > 0;
  const mechState = hasBundleEquipped ? 'idle' : 'dormant';

  const Avatar = () => {
    const frameWidth = isDesktop ? 140 : 100;
    const frameHeight = isDesktop ? 160 : 115;
    const mechWidth = isDesktop ? 130 : 100;
    const frameMarginBottom = isDesktop ? 8 : 4;
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: frameWidth,
        height: frameHeight,
        margin: `0 auto ${frameMarginBottom}px`,
        flexShrink: 0,
      }}>
        <MechSVG
          size="compact"
          compactWidth={mechWidth}
          state={mechState}
          primaryGlow={mechPrimaryGlow}
          visorColor={mechVisorColor}
          mode="active"
          glowIntensity={1}
        />
      </div>
    );
  };

  const NameBlock = () => (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isDesktop ? 'center' : 'flex-start',
      gap: '6px',
    }}>
      <span style={{
        fontSize: nameSize, fontWeight: '700', color: tokens.textWhite,
        letterSpacing: '-0.02em',
      }}>
        {name}
      </span>
      <span style={{
        display: 'inline-block', padding: '4px 12px', borderRadius: '20px',
        background: 'rgba(147,51,234,0.15)', color: tokens.purple,
        border: '1px solid rgba(147,51,234,0.3)',
        fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        {archetype}
      </span>
      {drift && (
        <span style={{
          fontSize: '12px', color: tokens.textFaint, fontStyle: 'italic',
          textAlign: isDesktop ? 'center' : 'left', lineHeight: '1.4',
        }}>
          {drift}
        </span>
      )}
    </div>
  );

  const LevelProgress = () => {
    const badgeColor = levelConfig?.color || '#6b7280';
    const gamesPlayed = agent?.stats?.gamesPlayed || 0;
    const next = nextLevelInfo;
    let progressPct = 100;
    if (next) {
      const currentMin = levelConfig?.minGames || 0;
      const nextMin = next.level === 'starter' ? 5 : 15;
      const range = nextMin - currentMin;
      progressPct = range > 0 ? Math.min(100, ((gamesPlayed - currentMin) / range) * 100) : 0;
    }
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 700,
            background: `${badgeColor}22`, color: badgeColor, letterSpacing: '0.3px',
          }}>
            {levelConfig?.label || 'Rookie'}
          </span>
          {next && (
            <span style={{ fontSize: '10px', color: tokens.textFaint }}>
              {next.gamesNeeded} game{next.gamesNeeded !== 1 ? 's' : ''} to {next.label}
            </span>
          )}
        </div>
        <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
          <div style={{
            width: `${progressPct}%`, height: '100%', borderRadius: '2px',
            background: badgeColor, transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
    );
  };

  const StatsRow = () => (
    <div style={{
      display: 'flex', gap: '0', width: '100%',
      borderTop: `1px solid ${tokens.borderDefault}`,
      borderBottom: `1px solid ${tokens.borderDefault}`,
    }}>
      {[
        { label: 'Record', value: `${wins}W-${losses}L` },
        { label: 'Avg', value: avgScore },
        { label: 'Evo', value: evoCycle },
      ].map((stat, i) => (
        <div key={stat.label} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '10px 4px', gap: '2px',
          borderLeft: i > 0 ? `1px solid ${tokens.borderDefault}` : 'none',
        }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: tokens.textWhite }}>
            {stat.value}
          </span>
          <span style={{
            fontSize: '10px', fontWeight: '600', color: tokens.textFaint,
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );

  const DeployButton = () => (
    <motion.button
      onClick={onDeploy}
      disabled={deploying}
      whileTap={deploying ? {} : { scale: 0.97 }}
      whileHover={deploying ? {} : { scale: 1.02 }}
      style={{
        width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
        background: 'linear-gradient(135deg, #5eead4, #0d9488)',
        color: '#0f172a', fontSize: '14px', fontWeight: '700',
        cursor: deploying ? 'wait' : 'pointer',
        opacity: deploying ? 0.7 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        boxShadow: `0 4px 16px rgba(94,234,212,0.3), ${tokens.obsidianShadow}`,
      }}
    >
      <Zap size={16} />
      {deploying ? 'Thinking...' : (deployText || 'Deploy to BaggerBomb')}
    </motion.button>
  );

  const SpeechBubble = () => (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '4px', width: '100%',
    }}>
      <span style={{ fontSize: '10px', color: tokens.textFaint, fontWeight: '600', letterSpacing: '0.5px' }}>
        AGENT SAYS
      </span>
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${tokens.borderDefault}`,
        borderRadius: '4px 12px 12px 12px',
        padding: '12px 14px',
      }}>
        <span style={{
          fontStyle: 'italic', fontSize: '13px', color: tokens.textSecondary, lineHeight: '1.5',
        }}>
          "{speech || "..."}"
        </span>
      </div>
    </div>
  );

  // Desktop: vertical column, center-aligned
  if (isDesktop) {
    return (
      <div style={{
        width: '220px', minWidth: '220px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '24px 16px', gap: '16px',
        borderRight: `1px solid ${tokens.borderDefault}`,
        position: 'sticky', top: '24px', alignSelf: 'flex-start',
        height: 'fit-content',
      }}>
        <Avatar />
        <NameBlock />
        <LevelProgress />
        <StatsRow />
        <DeployButton />
        <SpeechBubble />
      </div>
    );
  }

  // Mobile: horizontal hero card
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      padding: '20px 16px', gap: '14px',
      borderBottom: `1px solid ${tokens.borderDefault}`,
    }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
        <Avatar />
        <NameBlock />
      </div>
      <LevelProgress />
      <StatsRow />
      <DeployButton />
      <SpeechBubble />
    </div>
  );
};

export default AgentSidebar;
