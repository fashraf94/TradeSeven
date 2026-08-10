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
// Mastery P3: the owner profile behind the RecordSheet's mastery cards —
// zero reads and null while MASTERY_SURFACE_ENABLED is false (dark).
import useMasteryProfile from '../../hooks/useMasteryProfile';
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
import ScoutingBoardSheet from './ScoutingBoardSheet';
import DeployCeremony from './deployCeremony/DeployCeremony';
// isStarfieldOn (Delight Layer Task 2, spec V2 D4): this component's root paints
// an OPAQUE CMD.bg over the z0 background slot, so it is what hides the
// starfield. Flag on => transparent and the field shows through; off =>
// byte-identical to today.
import { SCOUTING_BOARD_ENABLED, CASUAL_CLONE_CONCURRENCY_ENABLED, isDeployCeremonyOn, isStarfieldOn } from '../../config/featureFlags';
import { deriveDeployGate } from '../../utils/commandCenterLiveBattles';

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
  onEnterBattle,
}) {
  // Resolve the agent by ownerId === odUserId — the same key the mobile
  // CommandDashboard uses.
  const { agent, loading: agentLoading, record, winRate, levelConfig, nextLevelInfo, deployText, activeDirectives } = useAgent(user?.odUserId);
  const masteryProfile = useMasteryProfile(agent?.ownerId || null);

  // The user-picked primaryColor supersedes the Haiku avatarColors.
  const accent = agent?.primaryColor || agent?.avatarColors?.[0] || CMD.teal;
  const agentName = agent?.name || user?.username || 'your agent';
  const wins = agent?.stats?.wins ?? 0;

  // ── Deploy / Manage / Review ──────────────────────────────────────────────
  const liveBattles = (activeAgentBattles || []).filter((b) => b.status === 'active');
  const liveBattle = liveBattles[0] || null;
  const isLive = Boolean(liveBattle);
  // Per-Battle Concurrency (Phase 1.5) — the per-type deploy gate, shared with the
  // mobile shell via deriveDeployGate (identical logic, one source). Flag-OFF every
  // value reduces to the legacy `isLive` gate, byte-identical.
  const concurrencyOn = CASUAL_CLONE_CONCURRENCY_ENABLED;
  const { orderedLiveBattles, deployBlockedByLive, deployBlockReason, equipLocked } =
    deriveDeployGate({ liveBattles, agent, concurrencyEnabled: concurrencyOn });
  const recentCompleted = useRecentCompletedAgentBattles(3);
  // Loop rail. Kept on isLive by design: it marks the FURTHEST beat the daily loop has
  // reached (a concurrent BaggerBomb stays deployable beside a live ranked battle, but
  // the furthest beat is still Manage). (Phase 1.5 deliberate disposition; mirrors mobile.)
  const activeStage = isLive ? 'manage' : 'read';

  const [deploying, setDeploying] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const deployDisabled = deploying || deployBlockedByLive || !agent;

  // ── Deploy Ceremony (flag-gated) — mirrors the mobile shell (ruling #2). ────
  const ceremonyOn = isDeployCeremonyOn();
  const starfieldOn = isStarfieldOn();
  const [ceremonyOpen, setCeremonyOpen] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [ceremonyRun, setCeremonyRun] = useState(0); // bump remounts the ceremony (retry)

  const handleDeploy = async () => {
    if (deployDisabled) return { success: false };
    if (ceremonyOn) { setCeremonyOpen(true); setDeployResult({ status: 'pending' }); }
    setDeploying(true);
    let result = { success: false };
    try {
      result = await deployAgent(agent.id, onCreateAgentBattle);
    } catch (err) {
      console.error('[Deploy] Error:', err);
      if (ceremonyOn) result = { success: false, error: err?.message };
    }
    setDeploying(false);
    if (ceremonyOn) {
      setDeployResult(result?.success
        ? { status: 'success', agentBattleId: result.agentBattleId }
        : { status: 'error', error: result?.error, details: result?.details });
    }
    return result;
  };
  const handleCeremonyRetry = () => { setCeremonyRun((r) => r + 1); handleDeploy(); };
  const openFilmRoom = (battle) => { setCurrentBattle?.(battle); setScreen?.('filmRoom'); };
  const openAgentRecord = () => setRecordOpen(true);

  const colScroll = { minHeight: 0, overflowY: 'auto', overflowX: 'hidden' };

  return (
    <div className="cmd-desk-root" style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: starfieldOn ? 'transparent' : CMD.bg, color: CMD.ink, position: 'relative', zIndex: 1 }}>
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
            onOpenRecord={openAgentRecord}
          />
        </div>

        {/* CENTER — the act-now spine: Read → Equip → Deploy */}
        <div className="cmd-desk-col" style={{ ...colScroll, gridArea: 'center', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <ReadColumn
            accent={accent}
            agentName={agentName}
            onOpenAgentRecord={openAgentRecord}
            onDeploy={handleDeploy}
            deployDisabled={deployDisabled}
            deploying={deploying}
            isLive={deployBlockedByLive}
            blockReason={deployBlockReason}
            boardEnabled={SCOUTING_BOARD_ENABLED}
            onSeeEyeing={() => setBoardOpen(true)}
          />
          <div id="cmd-desk-equip">
            <EquipBench agent={agent} accent={accent} setShowForge={setShowForge} isLive={equipLocked} />
          </div>
          {/* Deploy card shows while a BaggerBomb can start (flag-off === !isLive,
              byte-identical); flag-on it stays available beside a live ranked battle. */}
          {!deployBlockedByLive && (
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
            {/* Flag-ON: every live battle, each labeled by type, deterministically
                ordered — no unsorted liveBattles[0] (acceptance #4). Flag-OFF: the
                single legacy card, byte-identical. */}
            {!isLive ? (
              <IdleBlock icon={<Activity size={18} color={CMD.ink3} />} title="No battle live" sub="Deploy to send your agent in" />
            ) : concurrencyOn ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {orderedLiveBattles.map((b) => (
                  <ManageStation key={b.id} battle={b} showType agent={agent} accent={accent} onOpen={onOpenAgentBattle} />
                ))}
              </div>
            ) : (
              <ManageStation battle={liveBattle} agent={agent} accent={accent} onOpen={onOpenAgentBattle} />
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
        loading={agentLoading}
        accent={accent}
        levelConfig={levelConfig}
        nextLevelInfo={nextLevelInfo}
        masteryProfile={masteryProfile}
        dock="center"
      />

      {SCOUTING_BOARD_ENABLED && (
        <ScoutingBoardSheet
          open={boardOpen}
          onClose={() => setBoardOpen(false)}
          dock="center"
          agent={agent}
          accent={accent}
          deploying={deploying}
          deployDisabled={deployDisabled}
          isLive={deployBlockedByLive}
          onDeploy={handleDeploy}
        />
      )}

      {ceremonyOn && ceremonyOpen && (
        <DeployCeremony
          key={ceremonyRun}
          agent={agent}
          accent={accent}
          agentName={agentName}
          directiveCount={activeDirectives?.length || 0}
          deployResult={deployResult}
          onEnterBattle={() => { onEnterBattle?.(); setCeremonyOpen(false); }}
          onDismiss={() => setCeremonyOpen(false)}
          onRetry={handleCeremonyRetry}
        />
      )}
    </div>
  );
}
