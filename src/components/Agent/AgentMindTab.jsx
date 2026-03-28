import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Swords, Shield, Newspaper, Target, Clock, BookOpen } from 'lucide-react';
import FantasyTimesStrip from './FantasyTimesStrip';
import PlaybookPanel from './PlaybookPanel';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24, mass: 0.8 } },
};

const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const SectionHeader = ({ icon: Icon, label, tokens }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
    <div style={{
      width: '3px', height: '16px',
      background: `linear-gradient(180deg, ${tokens.teal}, ${tokens.purple})`,
      borderRadius: '2px',
    }} />
    {Icon && <Icon size={14} color={tokens.textMuted} />}
    <span style={{
      fontSize: '13px', fontWeight: '700', color: tokens.textFaint,
      textTransform: 'uppercase', letterSpacing: '1.5px',
    }}>
      {label}
    </span>
  </div>
);

const cardStyle = (tokens) => ({
  background: tokens.bgCard,
  borderRadius: '16px',
  border: `1px solid ${tokens.borderDefault}`,
  padding: '16px 20px',
  boxShadow: `${tokens.obsidianShadow}, 0 4px 16px rgba(0,0,0,0.3)`,
  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)',
});

const BattleLogRow = ({ entry, tokens }) => {
  const isEvo = entry.type === 'evolution';
  const isWin = entry.result === 'win';
  const badge = isEvo ? 'E' : isWin ? 'W' : 'L';
  const badgeColor = isEvo ? tokens.teal : isWin ? tokens.emerald : tokens.red;
  const badgeBg = isEvo
    ? 'rgba(94,234,212,0.15)'
    : isWin ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 0',
      borderBottom: `1px solid ${tokens.borderDefault}`,
    }}>
      <span style={{
        width: '28px', height: '28px', borderRadius: '6px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: badgeBg, color: badgeColor,
        fontSize: '12px', fontWeight: '700', flexShrink: 0,
      }}>
        {badge}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: tokens.textPrimary, fontWeight: '600' }}>
          {isEvo ? `Evo: ${entry.mode}` : (entry.opponent ? `vs ${entry.opponent}` : entry.mode || 'Game')}
        </div>
        <div style={{
          fontSize: '11px', color: tokens.textFaint, marginTop: '2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {entry.summary}
        </div>
      </div>
      <span style={{
        fontSize: '13px', color: tokens.textSecondary, fontWeight: '600', fontFamily: 'monospace',
        flexShrink: 0,
      }}>
        {isEvo ? 'Evo' : entry.score}
      </span>
    </div>
  );
};

const SOURCE_CONFIG = {
  coaching: { label: 'Coaching' },
  pinned: { label: 'Pinned' },
  strategy_session: { label: 'Strategy Session' },
};

const AgentMindTab = ({ agent, scouting, battleLog, news, tokens, isDesktop, isMobile, onNavigateToForge }) => {
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const sourceColorMap = {
    coaching: tokens.purple,
    pinned: tokens.teal,
    strategy_session: tokens.amber,
  };

  // Group directives by source (null-safe)
  const directiveGroups = {};
  (agent?.directives || []).forEach(d => {
    if (!directiveGroups[d.source]) directiveGroups[d.source] = [];
    directiveGroups[d.source].push(d);
  });
  const hasDirectives = Object.keys(directiveGroups).length > 0;

  // Extract recent memory from agent (null-safe)
  const memory = agent?.memory || [];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible"
      style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      {/* 1. Scouting Report */}
      <motion.div variants={sectionVariants} style={{
        ...cardStyle(tokens),
        borderLeft: `3px solid ${tokens.amber}`,
      }}>
        <SectionHeader icon={Eye} label="Scouting Report" tokens={tokens} />
        {scouting ? (
          <p style={{ fontSize: '14px', color: tokens.textPrimary, lineHeight: '1.6', margin: 0 }}>
            {scouting}
          </p>
        ) : (
          <p style={{ fontSize: '14px', color: tokens.textMuted, lineHeight: '1.6', margin: 0, fontStyle: 'italic' }}>
            Deploy your agent to generate a scouting report.
          </p>
        )}
      </motion.div>

      {/* 2. Consolidated Insight */}
      {agent?.consolidatedInsight && (
        <motion.div variants={sectionVariants} style={cardStyle(tokens)}>
          <SectionHeader icon={Target} label="Agent Insight" tokens={tokens} />
          <p style={{ fontSize: '14px', color: tokens.textSecondary, lineHeight: '1.6', margin: 0 }}>
            {agent.consolidatedInsight}
          </p>
        </motion.div>
      )}

      {/* 3. Two-column grid: Battle Log + Memory/Directives */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isDesktop ? '3fr 2fr' : '1fr',
        gap: '16px',
      }}>
        {/* 3a. Battle Log */}
        <motion.div variants={sectionVariants} style={cardStyle(tokens)}>
          <SectionHeader icon={Swords} label="Battle Log" tokens={tokens} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {battleLog.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: tokens.textMuted, fontSize: '13px' }}>
                No battles yet. Deploy your agent to start competing.
              </div>
            ) : (
              battleLog.map((entry, i) => (
                <BattleLogRow key={entry.id || i} entry={entry} tokens={tokens} />
              ))
            )}
          </div>
        </motion.div>

        {/* 3b. Memory + Directives */}
        <motion.div variants={sectionVariants} style={{
          ...cardStyle(tokens),
          display: 'flex', flexDirection: 'column', gap: '20px',
        }}>
          {/* Recent Memory */}
          {memory.length > 0 && (
            <div>
              <SectionHeader icon={Clock} label="Recent Memory" tokens={tokens} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {memory.map((m, i) => (
                  <div key={i} style={{
                    padding: '8px 10px', borderRadius: '8px',
                    background: tokens.bgElevated,
                    border: `1px solid ${tokens.borderDefault}`,
                  }}>
                    <div style={{
                      fontSize: '10px', fontWeight: '600', color: tokens.textFaint,
                      textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px',
                    }}>
                      {m.mode || m.gameMode || 'Game'}
                    </div>
                    <div style={{ fontSize: '12px', color: tokens.textSecondary, lineHeight: '1.4' }}>
                      {m.lesson}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Directives */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionHeader icon={Shield} label="Directives" tokens={tokens} />
              <button
                onClick={() => setPlaybookOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '8px',
                  border: `1px solid ${tokens.borderDefault}`,
                  background: 'transparent', color: tokens.teal,
                  fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit', marginBottom: '12px',
                }}
              >
                <BookOpen size={11} /> Manage Playbook
              </button>
            </div>
            {hasDirectives ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(directiveGroups).map(([source, directives]) => {
                  const color = sourceColorMap[source] || tokens.textMuted;
                  const config = SOURCE_CONFIG[source] || { label: source };
                  return (
                    <div key={source}>
                      <span style={{
                        fontSize: '10px', fontWeight: '600', color: tokens.textFaint,
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        marginBottom: '6px', display: 'block',
                      }}>
                        {config.label}
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {directives.map((d, i) => {
                          const isExpired = d.expiresAt && new Date(d.expiresAt) < new Date();
                          return (
                            <span key={d.id || i} style={{
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              padding: '4px 10px', borderRadius: '6px',
                              background: hexToRgba(color, 0.12),
                              border: `1px solid ${hexToRgba(color, 0.25)}`,
                              color: color,
                              fontSize: '11px', fontWeight: '500',
                              opacity: isExpired ? 0.5 : 1,
                            }}>
                              {d.text}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '12px', color: tokens.textMuted, fontSize: '12px' }}>
                No active directives. Coach your agent after a game to add directives.
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* 4. Fantasy Times Intel Strip */}
      {news?.length > 0 && (
        <motion.div variants={sectionVariants}>
          <SectionHeader icon={Newspaper} label="Fantasy Times Intel" tokens={tokens} />
          <FantasyTimesStrip stories={news} tokens={tokens} isDesktop={isDesktop} isMobile={isMobile} />
        </motion.div>
      )}
      {/* Playbook Modal */}
      <PlaybookPanel
        isOpen={playbookOpen}
        onClose={() => setPlaybookOpen(false)}
        agent={agent}
        tokens={tokens}
        onNavigateToForge={onNavigateToForge}
      />
    </motion.div>
  );
};

export default AgentMindTab;
