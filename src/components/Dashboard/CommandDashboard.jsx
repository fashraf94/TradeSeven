// src/components/Dashboard/CommandDashboard.jsx
//
// The mobile loop-home — directing an AI trading agent through the real loop:
// Read → Equip → Deploy → Manage → Review. Renders behind the
// COMMAND_DASHBOARD_ENABLED flag in place of DashboardLoop, with the
// same props. Desktop is unaffected.
//
// VISUAL PASS: restyled to the "command bridge" prototype (Command Dashboard.html)
// — obsidian CMD palette + agent.primaryColor accent, JetBrains-Mono station
// labels, the living Orb as a recurring anchor, and a composed top-to-bottom
// rhythm. Presentation only: all wiring (deploy / manage / review), the
// collapse-expand brief, and the agent-profile link are unchanged.
//
// The Read station's "Talk it over" button carries a "Soon" affordance with a
// no-op tap (the Voice Layer is deferred). The brief stays the current DRB text.

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Menu, Trophy, Zap, MessageCircle, ChevronRight } from 'lucide-react';
import AgentOrb from '../shared/AgentOrb';
import EquipStation from './EquipStation';
import DeployStation from './DeployStation';
import ManageStation from './ManageStation';
import ReviewStation from './ReviewStation';
import { CMD, alpha, readableOn, Eyebrow, Mono, SectionLabel } from './commandUI';
import useAgent from '../../hooks/useAgent';
import useDailyRegimeBrief from '../../hooks/useDailyRegimeBrief';
import useRecentCompletedAgentBattles from '../../hooks/useRecentCompletedAgentBattles';
import { deployAgent } from '../../services/agentDeploy';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function prettyDate(forDate) {
  if (!forDate) return null;
  try {
    const [y, m, d] = forDate.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  } catch {
    return forDate;
  }
}

const STAGES = [
  { k: 'read', label: 'Read' },
  { k: 'equip', label: 'Equip' },
  { k: 'deploy', label: 'Deploy' },
  { k: 'manage', label: 'Manage' },
  { k: 'review', label: 'Review' },
];

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const sectionVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26, mass: 0.8 } },
};

// ─── Loop rail — the cycle at a glance, restrained ───────────────────────────

function LoopRail({ active, primary }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {STAGES.map((s, i) => {
        const on = s.k === active;
        return (
          <React.Fragment key={s.k}>
            {i > 0 && <div style={{ width: 10, height: 1, background: CMD.hair }} />}
            <div title={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <motion.div
                animate={on ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: on ? 7 : 5, height: on ? 7 : 5, borderRadius: '50%',
                  background: on ? primary : CMD.ink3, boxShadow: on ? `0 0 8px ${alpha(primary, 0.7)}` : 'none',
                }}
              />
              {on && <Mono style={{ fontSize: 9.5, letterSpacing: '0.16em', color: CMD.ink2, textTransform: 'uppercase' }}>{s.label}</Mono>}
            </div>
          </React.Fragment>
        );
      })}
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
}) {
  const { agent } = useAgent(user?.odUserId);
  const drb = useDailyRegimeBrief();

  // The user-picked primaryColor supersedes the Haiku avatarColors.
  const accent = agent?.primaryColor || agent?.avatarColors?.[0] || CMD.teal;
  const agentName = agent?.name || user?.username || 'your agent';
  const wins = agent?.stats?.wins ?? 0;

  // ── Deploy / Manage / Review ──────────────────────────────────────────────
  const liveBattles = (activeAgentBattles || []).filter((b) => b.status === 'active');
  const liveBattle = liveBattles[0] || null;
  const isLive = Boolean(liveBattle);
  const recentCompleted = useRecentCompletedAgentBattles(3);
  const activeStage = isLive ? 'manage' : 'read';

  const equippedCount = 1
    + (agent?.equippedWatchlistId ? 1 : 0)
    + ((agent?.equippedTraits?.length || 0) > 0 ? 1 : 0);

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
  const openFilmRoom = (battle) => { setCurrentBattle?.(battle); setScreen?.('filmRoom'); };

  // ── Compact / expandable brief ────────────────────────────────────────────
  const [expanded, setExpanded] = useState(false);
  const [isTruncatable, setIsTruncatable] = useState(false);
  const briefRef = useRef(null);
  useEffect(() => {
    if (expanded) return;
    const el = briefRef.current;
    if (el) setIsTruncatable(el.scrollHeight > el.clientHeight + 1);
  }, [drb.dailyBrief, expanded]);

  const orbState = drb.loading ? 'reading' : 'ready';
  const briefBase = { margin: 0, fontSize: 15.5, lineHeight: 1.6, letterSpacing: '-0.005em', color: CMD.ink };
  const briefStyle = expanded
    ? briefBase
    : { ...briefBase, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
  const canToggle = isTruncatable || expanded;
  const dateLabel = prettyDate(drb.forDate);

  return (
    <div style={{ minHeight: '100vh', background: CMD.bg, color: CMD.ink, position: 'relative', zIndex: 1 }}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 18px 130px',
          display: 'flex', flexDirection: 'column', gap: 22,
          maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div variants={sectionVariants}>
          {/* utility row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              onClick={() => setSidebarOpen?.(true)}
              aria-label="Open menu"
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, marginLeft: -8, background: 'transparent', border: 'none', cursor: 'pointer', color: CMD.ink2 }}
            >
              <Menu size={22} />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EF4444', borderRadius: 8, color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <div
              onClick={() => setScreen?.('profile')}
              role="button"
              aria-label="Open profile"
              style={{ width: 34, height: 34, borderRadius: '50%', background: CMD.surface, border: `1.5px solid ${alpha(accent, 0.6)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: CMD.ink, cursor: 'pointer' }}
            >
              {(user?.username || 'P')[0].toUpperCase()}
            </div>
          </div>

          {/* headline */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <Eyebrow color={CMD.ink3}>{getGreeting()}, {user?.username || 'Director'}</Eyebrow>
              <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 3, color: CMD.ink }}>Command</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: 999, background: CMD.surface, border: `1px solid ${CMD.hair}`, flexShrink: 0 }}>
              <Trophy size={14} color={CMD.gold} />
              <Mono style={{ fontSize: 12, color: CMD.ink, fontWeight: 600 }}>{wins}</Mono>
              <span style={{ fontSize: 11, color: CMD.ink3 }}>wins</span>
            </div>
          </div>

          {/* divider + rail */}
          <div style={{ marginTop: 14, paddingTop: 13, borderTop: `1px solid ${CMD.hair}` }}>
            <LoopRail active={activeStage} primary={accent} />
          </div>
        </motion.div>

        {/* ── 01 · READ ──────────────────────────────────────────────────── */}
        <motion.div variants={sectionVariants}>
          <SectionLabel
            n="01"
            label="Read · today’s read"
            color={accent}
            right={dateLabel ? <Mono style={{ fontSize: 10.5, color: CMD.ink3 }}>{dateLabel}</Mono> : null}
          />
          <div style={{
            padding: '16px 17px 15px', borderRadius: 18,
            background: `linear-gradient(180deg, ${alpha(accent, 0.1)}, ${alpha(accent, 0.02)} 62%, ${CMD.surface})`,
            border: `1px solid ${alpha(accent, 0.26)}`, boxShadow: `inset 0 1px 0 ${alpha(accent, 0.07)}`,
          }}>
            {/* orb anchor + activity label — tap → agent profile */}
            <div
              onClick={() => setScreen?.('agent')}
              role="button"
              aria-label="Open agent profile"
              style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}
            >
              <AgentOrb state={orbState} size={32} color={accent} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Mono style={{ fontSize: 9.5, letterSpacing: '0.17em', color: accent, textTransform: 'uppercase', fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agentName} is reading the market</Mono>
                <Mono style={{ fontSize: 9.5, letterSpacing: '0.04em', color: CMD.ink3, marginTop: 2, display: 'block' }}>Today’s desk brief{dateLabel ? ` · ${dateLabel}` : ''}</Mono>
              </div>
              <ChevronRight size={15} color={CMD.ink3} style={{ flexShrink: 0 }} />
            </div>

            {/* narrative */}
            {drb.loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0.95, 0.85, 0.6].map((w, i) => (
                  <div key={i} style={{ height: 13, width: `${w * 100}%`, borderRadius: 6, background: 'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }} />
                ))}
              </div>
            ) : drb.dailyBrief ? (
              <div onClick={() => canToggle && setExpanded((e) => !e)} style={{ cursor: canToggle ? 'pointer' : 'default' }}>
                <p ref={briefRef} style={briefStyle}>{drb.dailyBrief}</p>
                {canToggle && <span style={{ display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 700, color: accent }}>{expanded ? 'Show less' : 'More'}</span>}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: CMD.ink2 }}>
                {drb.error
                  ? 'Couldn’t load today’s brief just now — pull to retry shortly.'
                  : 'Today’s brief isn’t in yet. Your agent will read it the moment it lands.'}
              </p>
            )}

            {/* theme chips */}
            {!drb.loading && drb.themes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                {drb.themes.slice(0, 3).map((t, i) => (
                  <span key={`t-${i}`} style={{ fontSize: 11, fontWeight: 600, color: CMD.ink2, padding: '4px 10px', borderRadius: 20, background: alpha(accent, 0.1), border: `1px solid ${alpha(accent, 0.2)}` }}>{t}</span>
                ))}
              </div>
            )}
            {expanded && !drb.loading && drb.keyEvents.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {drb.keyEvents.slice(0, 4).map((e, i) => (
                  <span key={`e-${i}`} style={{ fontSize: 11, fontWeight: 600, color: CMD.ink3, padding: '4px 10px', borderRadius: 20, background: alpha('#FFFFFF', 0.04), border: `1px solid ${CMD.hair}` }}>{e?.label || ''}</span>
                ))}
              </div>
            )}
            {expanded && !drb.loading && drb.forDate && drb.isStale && (
              <div style={{ fontSize: 11, color: CMD.ink3, marginTop: 12 }}>Showing the latest available brief ({dateLabel}).</div>
            )}

            {/* the read flows into the decision */}
            <div style={{ display: 'flex', gap: 9, marginTop: 15 }}>
              <motion.button
                type="button"
                onClick={handleDeploy}
                disabled={deployDisabled}
                whileTap={deployDisabled ? undefined : { scale: 0.985 }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: 12, borderRadius: 12, border: 'none', cursor: deployDisabled ? 'default' : 'pointer', fontFamily: 'inherit',
                  background: accent, color: readableOn(accent), fontWeight: 700, fontSize: 13.5, opacity: deployDisabled ? 0.55 : 1,
                }}
              >
                <Zap size={16} color={readableOn(accent)} fill={readableOn(accent)} />
                <span>{deploying ? 'Deploying…' : isLive ? 'Battle in progress' : 'Deploy on this read'}</span>
              </motion.button>
              {/* Voice Layer deferred — visible "coming soon" entry point, no-op tap */}
              <button
                type="button"
                aria-label="Talk it over — coming soon"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '12px 15px', borderRadius: 12, cursor: 'default', fontFamily: 'inherit',
                  background: 'transparent', border: `1px solid ${CMD.hair2}`, color: CMD.ink2, fontWeight: 600, fontSize: 13.5,
                }}
              >
                <MessageCircle size={16} color={CMD.ink3} />
                <span>Talk it over</span>
                <Mono style={{
                  fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: CMD.ink3,
                  background: alpha('#FFFFFF', 0.05), border: `1px solid ${CMD.hair}`, padding: '2px 5px', borderRadius: 5,
                }}>Soon</Mono>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── 02 · EQUIP ─────────────────────────────────────────────────── */}
        <motion.div variants={sectionVariants} id="cmd-equip">
          <SectionLabel
            n="02"
            label={isLive ? 'Equip · locked in battle' : 'Equip · loadout bench'}
            color={isLive ? CMD.ink3 : accent}
            right={<Mono style={{ fontSize: 10.5, color: CMD.ink3 }}>{equippedCount}/3 slots</Mono>}
          />
          <EquipStation agent={agent} accent={accent} onOpenAgent={() => setScreen?.('agent')} setShowForge={setShowForge} />
        </motion.div>

        {/* ── 03 · DEPLOY  /  04 · MANAGE (when live) ────────────────────── */}
        {!isLive ? (
          <motion.div variants={sectionVariants}>
            <SectionLabel n="03" label="Deploy" color={accent} />
            <DeployStation agent={agent} accent={accent} deploying={deploying} onDeploy={handleDeploy} />
          </motion.div>
        ) : (
          <motion.div variants={sectionVariants}>
            <SectionLabel n="04" label="Manage · live" color={accent} />
            <ManageStation battle={liveBattle} agent={agent} accent={accent} onOpen={onOpenAgentBattle} />
          </motion.div>
        )}

        {/* ── 05 · REVIEW ────────────────────────────────────────────────── */}
        {recentCompleted.length > 0 && (
          <motion.div variants={sectionVariants}>
            <SectionLabel n="05" label="Review · last battle" color={accent} />
            <ReviewStation battles={recentCompleted} agent={agent} accent={accent} onReview={openFilmRoom} />
          </motion.div>
        )}

        {/* footer */}
        <motion.div variants={sectionVariants} style={{ textAlign: 'center', paddingTop: 4 }}>
          <Mono style={{ fontSize: 9.5, letterSpacing: '0.18em', color: CMD.ink3, textTransform: 'uppercase' }}>Read → Equip → Deploy → Manage → Review</Mono>
        </motion.div>
      </motion.div>
    </div>
  );
}
