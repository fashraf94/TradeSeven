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
import AgentRecordSheet from './AgentRecordSheet';
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
  const { agent, record, winRate, levelConfig, nextLevelInfo, deployText } = useAgent(user?.odUserId);

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

  const [deploying, setDeploying] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
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
  const openAgent = () => setRecordOpen(true);

  const colScroll = { minHeight: 0, overflowY: 'auto', overflowX: 'hidden' };

  return (
    <div className="cmd-desk-root" style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: CMD.bg, color: CMD.ink, position: 'relative', zIndex: 1 }}>
      {/* Responsive (spec D2): ≥1200 = 3-col, fixed viewport height, columns scroll
          independently. 769–1199 = 2-col reflow — left identity rail kept; the
          right lifecycle (Manage 04 / Review 05) folds beneath the center spine;
          the surface page-scrolls. ≤768 never reaches here (App.jsx serves the
          mobile CommandDashboard). */}
      <style>{`
        .cmd-desk-col::-webkit-scrollbar { width: 0; height: 0; }
        .cmd-desk-col { scrollbar-width: none; }
        @media (max-width: 1199px) {
          .cmd-desk-root { height: auto !important; overflow: visible !important; }
          .cmd-desk-grid {
            flex: none !important;
            grid-template-columns: minmax(220px, 280px) minmax(0, 1fr) !important;
            grid-template-areas: "identity center" "identity lifecycle" !important;
            align-items: start !important;
            gap: 16px !important;
            padding: 20px 20px 24px !important;
          }
          .cmd-desk-col { overflow: visible !important; }
          .cmd-desk-topbar { flex-wrap: wrap !important; padding: 16px 20px 14px !important; }
          .cmd-desk-greet, .cmd-desk-wins { min-width: 0 !important; }
          .cmd-desk-wins { order: 2 !important; }
          .cmd-desk-railwrap { order: 3 !important; flex-basis: 100% !important; margin-top: 12px !important; }
          .cmd-loop-pill { padding: 6px 9px !important; gap: 6px !important; }
          .cmd-loop-label { font-size: 9px !important; letter-spacing: 0.08em !important; }
          .cmd-loop-conn { width: 16px !important; margin: 0 3px !important; }
        }
      `}</style>


      {/* top bar — at ≤1199 the rail folds to its own centered row (see <style>) */}
      <div className="cmd-desk-topbar" style={{
        flexShrink: 0, padding: '20px 30px 18px', borderBottom: `1px solid ${CMD.hair}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
      }}>
        <div className="cmd-desk-greet" style={{ minWidth: 250 }}>
          <Eyebrow color={CMD.ink3}>{getGreeting()}, {user?.username || 'Director'}</Eyebrow>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2, color: CMD.ink }}>Command Center</div>
        </div>
        <div className="cmd-desk-railwrap" style={{ display: 'flex', justifyContent: 'center', flex: '0 1 auto' }}>
          <DeskLoopRail active={activeStage} primary={accent} />
        </div>
        <div className="cmd-desk-wins" style={{
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
        flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px 1fr 358px',
        gridTemplateAreas: '"identity center lifecycle"', gap: 22, padding: '22px 30px 26px',
      }}>
        {/* LEFT — identity */}
        <div className="cmd-desk-col" style={{ ...colScroll, gridArea: 'identity' }}>
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
        <div className="cmd-desk-col" style={{ ...colScroll, gridArea: 'center', display: 'flex', flexDirection: 'column', gap: 22 }}>
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
            <EquipBench agent={agent} accent={accent} setShowForge={setShowForge} isLive={isLive} />
          </div>
          {!isLive && (
            <div style={{ marginTop: 'auto' }}>
              <SectionLabel n="03" label="Deploy" color={accent} />
              <DeployCard
                agent={agent}
                accent={accent}
                deploying={deploying}
                onDeploy={handleDeploy}
                agentName={agentName}
                deployText={deployText}
              />
            </div>
          )}
        </div>

        {/* RIGHT — the battle lifecycle (folds beneath center at ≤1199) */}
        <div className="cmd-desk-col" style={{ ...colScroll, gridArea: 'lifecycle', display: 'flex', flexDirection: 'column', gap: 22 }}>
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

      <AgentRecordSheet
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        agent={agent}
        accent={accent}
        levelConfig={levelConfig}
        nextLevelInfo={nextLevelInfo}
        dock="center"
      />
    </div>
  );
}
