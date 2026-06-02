// src/components/Dashboard/CommandDashboard.jsx
//
// The mobile loop-home — directing an AI trading agent through the real loop:
// Read → Equip → Deploy → Manage → Review. Renders behind the
// COMMAND_DASHBOARD_ENABLED flag (or ?cmd query param) in place of
// DashboardLoop, called with the same props. Desktop is unaffected.
//
// PHASE 1: flag + loop scaffold + the Read station (powered by the net-new
// useDailyRegimeBrief hook) + the agent-identity Orb. Equip / Deploy / Manage /
// Review render as visible, labeled stubs and get wired in later phases.
//
// The Read station's two actions ("Deploy on this read", "Talk it over") are
// presentational only here: Deploy is wired in Phase 3; "Talk it over" is the
// future entry point for the deferred Voice Layer (no chat/debate is built).
//
// Theme: obsidian (DARK_TOKENS) surfaces + each agent's own accent
// (agent.primaryColor). Glow is restrained; red is reserved for downside only
// (via GainLossBadge, introduced in a later phase) and never appears here.

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Menu, BookOpen, Boxes, Rocket, Activity, Film, MessageCircle, ChevronRight } from 'lucide-react';
import HoloCard from '../shared/HoloCard';
import AgentOrb from '../shared/AgentOrb';
import EquipStation from './EquipStation';
import DeployStation from './DeployStation';
import ManageStation from './ManageStation';
import ReviewStation from './ReviewStation';
import { useTheme } from '../../contexts/ThemeContext';
import useAgent from '../../hooks/useAgent';
import useDailyRegimeBrief from '../../hooks/useDailyRegimeBrief';
import useRecentCompletedAgentBattles from '../../hooks/useRecentCompletedAgentBattles';
import { deployAgent } from '../../services/agentDeploy';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function hexToRgba(hex, a) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(94,234,212,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// Pick legible text (near-black or white) for a filled button of any agent hue.
function readableText(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0a0b10' : '#ffffff';
}

function prettyDate(forDate) {
  if (!forDate) return null;
  try {
    // forDate is YYYY-MM-DD; render without a TZ shift by anchoring to UTC.
    const [y, m, d] = forDate.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  } catch {
    return forDate;
  }
}

// The five loop stages. `read` is the only active stage in Phase 1.
const STAGES = [
  { key: 'read', n: '01', label: 'Read', Icon: BookOpen },
  { key: 'equip', n: '02', label: 'Equip', Icon: Boxes },
  { key: 'deploy', n: '03', label: 'Deploy', Icon: Rocket },
  { key: 'manage', n: '04', label: 'Manage', Icon: Activity },
  { key: 'review', n: '05', label: 'Review', Icon: Film },
];

// ─── Motion ──────────────────────────────────────────────────────────────────

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24, mass: 0.8 } },
};

// ─── Minimal loop rail ───────────────────────────────────────────────────────
// A thin connecting line with small dots; the current stage (Read) is accented
// and labeled, the rest are faint dots. Recedes rather than dominates.

function LoopRail({ accent, tokens }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: '14px', padding: '0 2px' }}>
      {/* Current stage: accented dot + label */}
      <span style={{
        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
        background: accent, boxShadow: `0 0 8px ${hexToRgba(accent, 0.7)}`,
      }} />
      <span style={{
        marginLeft: '7px', fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px',
        textTransform: 'uppercase', color: accent,
      }}>
        Read
      </span>
      {/* Remaining stages: connecting line + faint dot each */}
      {STAGES.slice(1).map((s) => (
        <React.Fragment key={s.key}>
          <div style={{ flex: 1, height: '1px', background: tokens.borderDefault, margin: '0 8px' }} />
          <span
            title={s.label}
            style={{ width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0, background: tokens.textFaintest }}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CommandDashboard({
  user,
  setScreen,
  setSidebarOpen,
  unreadCount,
  setShowForge,
  setCurrentBattle,
  activeAgentBattles = [],
  onCreateAgentBattle,
  onOpenAgentBattle,
  // The remaining DashboardLoop props (battles, modal setters, etc.) are passed
  // by the same call site and get destructured here as later phases wire
  // Deploy / Manage / Review. Unreferenced for now — harmlessly ignored.
}) {
  const { tokens } = useTheme();
  const { agent, record } = useAgent(user?.odUserId);
  const drb = useDailyRegimeBrief();

  // The user-picked primaryColor supersedes the Haiku-generated avatarColors
  // (onboarding rule); fall back to avatarColors only when it's absent (null
  // on agents created before the color picker).
  const accent = agent?.primaryColor || agent?.avatarColors?.[0] || tokens.teal;
  const accent2 = agent?.primaryColor || agent?.avatarColors?.[1] || accent;
  const agentName = agent?.name || user?.username || 'your agent';
  const archetype = agent?.archetype ? getArchetypeDisplayName(agent.archetype) : null;

  const orbState = drb.loading ? 'reading' : 'ready';

  // ── Deploy / Manage / Review (Phase 3) ────────────────────────────────────
  const liveBattles = (activeAgentBattles || []).filter(
    (b) => b.status === 'active' || b.status === 'market_closed'
  );
  const liveBattle = liveBattles[0] || null;
  const isLive = Boolean(liveBattle);
  const recentCompleted = useRecentCompletedAgentBattles(3);

  const [deploying, setDeploying] = useState(false);
  const deployDisabled = deploying || isLive || !agent;
  const handleDeploy = async () => {
    if (deployDisabled) return;
    setDeploying(true);
    try {
      await deployAgent(agent.id, onCreateAgentBattle);
    } catch (err) {
      console.error('[Deploy] Error:', err);
    }
    setDeploying(false);
  };
  const openFilmRoom = (battle) => {
    setCurrentBattle?.(battle);
    setScreen?.('filmRoom');
  };

  // Compact/expandable brief: collapsed shows ~3 clamped lines; tap expands.
  const [expanded, setExpanded] = useState(false);
  const [isTruncatable, setIsTruncatable] = useState(false);
  const briefRef = useRef(null);

  useEffect(() => {
    // Only measure in the collapsed state (when expanded the clamp is removed,
    // so scrollHeight === clientHeight). Keep the last value while expanded so
    // the "Show less" affordance stays visible.
    if (expanded) return;
    const el = briefRef.current;
    if (el) setIsTruncatable(el.scrollHeight > el.clientHeight + 1);
  }, [drb.dailyBrief, expanded]);

  const briefBase = { margin: 0, fontSize: '14.5px', lineHeight: 1.6, color: tokens.textSecondary };
  const briefStyle = expanded
    ? briefBase
    : { ...briefBase, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
  const canToggle = isTruncatable || expanded;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: tokens.bgApp,
      color: tokens.textPrimary,
      position: 'relative',
      zIndex: 1,
    }}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        background: tokens.bgCard,
        borderBottom: `1px solid ${tokens.borderDefault}`,
        padding: '12px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          {/* Left: menu */}
          <button
            onClick={() => setSidebarOpen?.(true)}
            aria-label="Open menu"
            style={{
              position: 'relative', minWidth: '44px', minHeight: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: accent, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Menu size={22} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '6px', right: '6px',
                minWidth: '18px', height: '18px', padding: '0 5px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: tokens.red, borderRadius: '9px', color: tokens.textWhite,
                fontSize: '10px', fontWeight: 700, lineHeight: 1, boxShadow: tokens.glowRedDot,
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Center: title + greeting */}
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '2.5px',
              textTransform: 'uppercase', color: accent,
            }}>
              Command
            </div>
            <div style={{
              fontSize: '13px', color: tokens.textMuted,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {getGreeting()}, {user?.username || 'Player'}
            </div>
          </div>

          {/* Right: avatar → profile */}
          <div
            onClick={() => setScreen?.('profile')}
            role="button"
            aria-label="Open profile"
            style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: tokens.bgCard, border: `2px solid ${accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', fontWeight: 600, color: tokens.textWhite,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            {(user?.username || 'P')[0].toUpperCase()}
          </div>
        </div>

        <LoopRail accent={accent} tokens={tokens} />
      </header>

      {/* ─── Feed ────────────────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          flex: 1, padding: '20px 16px 130px 16px',
          display: 'flex', flexDirection: 'column', gap: '16px',
          maxWidth: '600px', margin: '0 auto', width: '100%', boxSizing: 'border-box',
        }}
      >
        {/* ── 01 · READ ─────────────────────────────────────────────────── */}
        <motion.div variants={sectionVariants}>
          <HoloCard
            accentColor={accent}
            size="lg"
            style={{
              background: tokens.bgCard,
              border: `1px solid ${tokens.borderDefault}`,
              boxShadow: `${tokens.obsidianShadow}, 0 0 26px ${hexToRgba(accent, 0.10)}`,
              borderTop: `2px solid ${hexToRgba(accent, 0.55)}`,
            }}
          >
            {/* Header row: orb + title — tap to open the agent's full profile */}
            <div
              onClick={() => setScreen?.('agent')}
              role="button"
              aria-label="Open agent profile"
              style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px', cursor: 'pointer' }}
            >
              <AgentOrb colors={[accent, accent2]} size={60} state={orbState} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: '10px', fontWeight: 700, letterSpacing: '2px',
                  textTransform: 'uppercase', color: accent, marginBottom: '4px',
                }}>
                  01 · Read
                </div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: tokens.textWhite, lineHeight: 1.25 }}>
                  {agentName} on today&apos;s read
                </div>
                {archetype && (
                  <div style={{ fontSize: '12px', color: tokens.textMuted, marginTop: '2px' }}>
                    {archetype}{record ? ` · ${record}` : ''}
                  </div>
                )}
              </div>
              <ChevronRight size={18} color={tokens.textFaint} style={{ flexShrink: 0 }} />
            </div>

            {/* Brief body — compact (clamped to ~3 lines) with tap-to-expand */}
            {drb.loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[0.95, 0.85, 0.6].map((w, i) => (
                  <div key={i} style={{
                    height: '12px', width: `${w * 100}%`, borderRadius: '6px',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                  }} />
                ))}
              </div>
            ) : drb.dailyBrief ? (
              <div
                onClick={() => canToggle && setExpanded((e) => !e)}
                style={{ cursor: canToggle ? 'pointer' : 'default' }}
              >
                <p ref={briefRef} style={briefStyle}>{drb.dailyBrief}</p>
                {canToggle && (
                  <span style={{
                    display: 'inline-block', marginTop: '6px',
                    fontSize: '12px', fontWeight: 700, color: accent,
                  }}>
                    {expanded ? 'Show less' : 'More'}
                  </span>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: tokens.textMuted }}>
                {drb.error
                  ? 'Couldn’t load today’s brief just now — pull to retry shortly.'
                  : 'Today’s brief isn’t in yet. Your agent will read it the moment it lands.'}
              </p>
            )}

            {/* Theme chips (compact) */}
            {!drb.loading && drb.themes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '14px' }}>
                {drb.themes.slice(0, 3).map((t, i) => (
                  <span key={`t-${i}`} style={{
                    fontSize: '11px', fontWeight: 600, color: tokens.textSecondary,
                    padding: '4px 10px', borderRadius: '20px',
                    background: hexToRgba(accent, 0.10), border: `1px solid ${hexToRgba(accent, 0.20)}`,
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Expanded-only extras: key events + the brief's date/staleness */}
            {expanded && !drb.loading && drb.keyEvents.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {drb.keyEvents.slice(0, 4).map((e, i) => (
                  <span key={`e-${i}`} style={{
                    fontSize: '11px', fontWeight: 600, color: tokens.textMuted,
                    padding: '4px 10px', borderRadius: '20px',
                    background: tokens.bgIcon, border: `1px solid ${tokens.borderDefault}`,
                  }}>
                    {e?.label || ''}
                  </span>
                ))}
              </div>
            )}
            {expanded && !drb.loading && drb.forDate && (
              <div style={{ fontSize: '11px', color: tokens.textFaint, marginTop: '12px' }}>
                Brief for {prettyDate(drb.forDate)}{drb.isStale ? ' · showing the latest available' : ''}
              </div>
            )}

            {/* Actions — Deploy (wired Phase 3) + Talk it over (deferred Voice Layer) */}
            <div style={{
              display: 'flex', gap: '10px', marginTop: '16px',
              paddingTop: '14px', borderTop: `1px solid ${tokens.borderDefault}`,
            }}>
              <motion.button
                type="button"
                onClick={handleDeploy}
                disabled={deployDisabled}
                whileTap={deployDisabled ? undefined : { scale: 0.97 }}
                style={{
                  flex: 1.4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  padding: '11px 14px', borderRadius: '12px', border: 'none',
                  cursor: deployDisabled ? 'default' : 'pointer',
                  background: accent, color: readableText(accent), fontSize: '14px', fontWeight: 700,
                  boxShadow: `0 0 16px ${hexToRgba(accent, 0.30)}`,
                  opacity: deployDisabled ? 0.55 : 1,
                }}
              >
                <Rocket size={16} />
                {deploying ? 'Deploying…' : isLive ? 'Battle in progress' : 'Deploy on this read'}
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  padding: '11px 14px', borderRadius: '12px', cursor: 'pointer',
                  background: 'transparent', border: `1px solid ${hexToRgba(accent, 0.40)}`,
                  color: tokens.textSecondary, fontSize: '14px', fontWeight: 600,
                }}
              >
                <MessageCircle size={16} />
                Talk it over
              </motion.button>
            </div>
          </HoloCard>
        </motion.div>

        {/* ── 02 · Equip ─────────────────────────────────────────────────── */}
        <motion.div variants={sectionVariants}>
          <EquipStation agent={agent} accent={accent} tokens={tokens} setShowForge={setShowForge} onOpenAgent={() => setScreen?.('agent')} />
        </motion.div>

        {/* ── 03 · Deploy ────────────────────────────────────────────────── */}
        <motion.div variants={sectionVariants}>
          <DeployStation
            agent={agent}
            accent={accent}
            tokens={tokens}
            isLive={isLive}
            deploying={deploying}
            onDeploy={handleDeploy}
          />
        </motion.div>

        {/* ── 04 · Manage (only when a battle is live) ───────────────────── */}
        {isLive && (
          <motion.div variants={sectionVariants}>
            <ManageStation
              battle={liveBattle}
              agent={agent}
              accent={accent}
              tokens={tokens}
              onOpen={onOpenAgentBattle}
            />
          </motion.div>
        )}

        {/* ── 05 · Review (only when a recent completed battle exists) ────── */}
        {recentCompleted.length > 0 && (
          <motion.div variants={sectionVariants}>
            <ReviewStation
              battles={recentCompleted}
              agent={agent}
              accent={accent}
              tokens={tokens}
              onReview={openFilmRoom}
            />
          </motion.div>
        )}

        {/* Footer loop label */}
        <div style={{
          textAlign: 'center', marginTop: '4px',
          fontSize: '10px', fontWeight: 600, letterSpacing: '1px',
          textTransform: 'uppercase', color: tokens.textFaintest,
        }}>
          Read → Equip → Deploy → Manage → Review
        </div>
      </motion.div>
    </div>
  );
}
