import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

const AgentSidebar = ({ agent, speech, isDesktop, isMobile, tokens, onDeploy, deploying }) => {
  const avatarSize = isDesktop ? 72 : 56;
  const nameSize = isDesktop ? '18px' : '16px';

  // Null-safe defaults
  const name = agent?.name || 'Agent';
  const avatarColors = agent?.avatarColors || ['#5eead4', '#a855f7'];
  const archetype = agent?.archetype
    ? agent.archetype.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
    : 'Unknown';
  const drift = agent?.archetypeDrift || null;
  const wins = agent?.stats?.wins || 0;
  const losses = agent?.stats?.losses || 0;
  const avgScore = agent?.stats?.avgScore || 0;
  const evoCycle = agent?.evolutionCycle || 0;

  const Avatar = () => (
    <div style={{
      width: `${avatarSize}px`, height: `${avatarSize}px`, borderRadius: '50%',
      background: `linear-gradient(135deg, ${avatarColors[0]}, ${avatarColors[1]})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: isDesktop ? '28px' : '22px', fontWeight: '700', color: '#fff',
      boxShadow: '0 0 20px rgba(94,234,212,0.3)',
      flexShrink: 0,
    }}>
      {name.charAt(0)}
    </div>
  );

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
      {deploying ? 'Thinking...' : 'Deploy to BaggerBomb'}
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
      <StatsRow />
      <DeployButton />
      <SpeechBubble />
    </div>
  );
};

export default AgentSidebar;
