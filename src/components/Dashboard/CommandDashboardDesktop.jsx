// src/components/Dashboard/CommandDashboardDesktop.jsx
//
// Desktop Command surface — the 3-column re-layout of the mobile loop-home
// (Read → Equip → Deploy → Manage → Review). A top bar (greeting + DeskLoopRail
// + wins chip) over a grid: left IdentityPanel · center act-now spine
// (Read → Equip → Deploy) · right battle lifecycle (Manage + Review). Renders
// behind COMMAND_DASHBOARD_DESKTOP_ENABLED in place of DashboardDesktop, with
// the mobile dashboard's prop bag.
//
// Phase-aware (mirrors mobile): idle shows Deploy (03); a live agent battle
// drops Deploy, locks the Equip bench, and shifts the loop rail to Manage.
//
// The shell owns all state (agent, accent, live/idle, deploy flag) and threads
// `accent` + handlers down; columns never re-derive the accent. ReadColumn and
// EquipBench own their own data hooks (DRB / forge+watchlist) so the brief and
// bench reflect live state without prop-drilling.

import React, { useState } from 'react';
import { Trophy, Activity, Award } from 'lucide-react';
import { CMD, Eyebrow, Mono, SectionLabel } from './commandUI';
import useAgent from '../../hooks/useAgent';
import useRecentCompletedAgentBattles from '../../hooks/useRecentCompletedAgentBattles';
import { deployAgent } from '../../services/agentDeploy';
import ManageStation from './ManageStation';
import ReviewStation from './ReviewStation';
import DeskLoopRail from './desktop/DeskLoopRail';
import IdentityPanel from './desktop/IdentityPanel';
import ReadColumn from './desktop/ReadColumn';
import EquipBench from './desktop/EquipBench';
import DeployCard from './desktop/DeployCard';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// idle empty-state for the right-column lifecycle blocks (Manage / Review)
function IdleBlock({ icon, title, sub }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', borderRadius: 16,
      background: CMD.surface, border: `1px dashed ${CMD.hair2}`, opacity: 0.9,
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: CMD.bg, border: `1px solid ${CMD.hair}` }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, color: CMD.ink2, fontWeight: 600 }}>{title}</div>
        <Mono style={{ fontSize: 10.5, color: CMD.ink3, marginTop: 2, display: 'block' }}>{sub}</Mono>
      </div>
    </div>
  );
}

export default function CommandDashboardDesktop({
  user,
  setScreen,
  setShowForge,
  setCurrentBattle,
  activeAgentBattles = [],
  onCreateAgentBattle,
  onOpenAgentBattle,
}) {
  // Resolve the agent by ownerId === odUserId — the same key the mobile
  // CommandDashboard uses (NOT user.uid, which keys a different path).
  const { agent, record, winRate, levelConfig, nextLevelInfo } = useAgent(user?.odUserId);

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
  const rulesOpen = (agent?.equippedBundleIds?.length || 0) === 0;

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
  const openAgent = () => setScreen?.('agent');
  const scrollToEquip = () => document.getElementById('cmd-desk-equip')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const colScroll = { minHeight: 0, overflowY: 'auto', overflowX: 'hidden' };

  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: CMD.bg, color: CMD.ink, position: 'relative', zIndex: 1 }}>
      {/* hide column scrollbars; interim narrow-desktop stack (full reflow is Phase 4) */}
      <style>{`
        .cmd-desk-col::-webkit-scrollbar { width: 0; height: 0; }
        .cmd-desk-col { scrollbar-width: none; }
        @media (max-width: 1199px) { .cmd-desk-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* top bar */}
      <div style={{
        flexShrink: 0, padding: '20px 30px 18px', borderBottom: `1px solid ${CMD.hair}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      }}>
        <div style={{ minWidth: 250 }}>
          <Eyebrow color={CMD.ink3}>{getGreeting()}, {user?.username || 'Director'}</Eyebrow>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2, color: CMD.ink }}>Command Center</div>
        </div>
        <DeskLoopRail active={activeStage} primary={accent} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 999,
          background: CMD.surface, border: `1px solid ${CMD.hair}`, minWidth: 250, justifyContent: 'flex-end',
        }}>
          <Trophy size={15} color={CMD.gold} />
          <Mono style={{ fontSize: 13, color: CMD.ink, fontWeight: 600 }}>{wins}</Mono>
          <span style={{ fontSize: 12, color: CMD.ink3 }}>wins</span>
        </div>
      </div>

      {/* body — three columns */}
      <div className="cmd-desk-grid" style={{
        flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px 1fr 358px', gap: 22, padding: '22px 30px 26px',
      }}>
        {/* LEFT — identity */}
        <div className="cmd-desk-col" style={colScroll}>
          <IdentityPanel
            agent={agent}
            accent={accent}
            live={isLive}
            record={record}
            winRate={winRate}
            levelConfig={levelConfig}
            nextLevelInfo={nextLevelInfo}
          />
        </div>

        {/* CENTER — the act-now spine: Read → Equip → Deploy */}
        <div className="cmd-desk-col" style={{ ...colScroll, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <ReadColumn
            accent={accent}
            agentName={agentName}
            onOpenAgent={openAgent}
            onDeploy={handleDeploy}
            deployDisabled={deployDisabled}
            deploying={deploying}
            isLive={isLive}
          />
          <div id="cmd-desk-equip">
            <EquipBench agent={agent} accent={accent} onOpenAgent={openAgent} setShowForge={setShowForge} isLive={isLive} />
          </div>
          {!isLive && (
            <div style={{ marginTop: 'auto' }}>
              <SectionLabel n="03" label="Deploy" color={accent} />
              <DeployCard
                agent={agent}
                accent={accent}
                deploying={deploying}
                onDeploy={handleDeploy}
                onAddRules={scrollToEquip}
                rulesOpen={rulesOpen}
                agentName={agentName}
              />
            </div>
          )}
        </div>

        {/* RIGHT — the battle lifecycle */}
        <div className="cmd-desk-col" style={{ ...colScroll, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <SectionLabel n="04" label={isLive ? 'Manage · live' : 'Manage'} color={isLive ? accent : CMD.ink3} />
            {isLive ? (
              <ManageStation battle={liveBattle} agent={agent} accent={accent} onOpen={onOpenAgentBattle} />
            ) : (
              <IdleBlock icon={<Activity size={18} color={CMD.ink3} />} title="No battle live" sub="Deploy to send your agent in" />
            )}
          </div>

          <div>
            <SectionLabel n="05" label={recentCompleted.length > 0 ? 'Review · last battle' : 'Review'} color={recentCompleted.length > 0 ? accent : CMD.ink3} />
            {recentCompleted.length > 0 ? (
              <ReviewStation battles={recentCompleted} agent={agent} accent={accent} onReview={openFilmRoom} />
            ) : (
              <IdleBlock icon={<Award size={18} color={CMD.ink3} />} title="No battles yet" sub="Your first grade unlocks here" />
            )}
          </div>

          <div style={{ marginTop: 'auto', textAlign: 'center', paddingTop: 6 }}>
            <Mono style={{ fontSize: 9, letterSpacing: '0.16em', color: CMD.ink3, textTransform: 'uppercase' }}>The loop closes · Review sharpens tomorrow’s Read</Mono>
          </div>
        </div>
      </div>
    </div>
  );
}
