// AgentBattleScreen - Redesigned with 3-tab layout:
// Matchups (BaggerBomb matchup rows) | Command Center (agent controls + feed) | Game Tape (post-review)
//
// Data sources:
//   1. `battle` prop (training battle) — both portfolios + starting prices
//   2. useAgentBattle (agentBattles doc) — status feed, controls, scores, trades, thresholds
//   3. useWebSocketPrices + EODHD polling — live prices for matchup view

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, Activity, Bot, Bookmark } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import useAgentBattleId from '../hooks/useAgentBattleId';
import useAgentBattle from '../hooks/useAgentBattle';
import AnimatedScore from '../components/shared/AnimatedScore';
import { AgentPresenceMount } from '../components/AgentPresence';
import { isAgentPresenceOn, isMatchupsBackdropOn, isBattleViewControllerOn } from '../config/featureFlags';
import { TAB_KEYS, tabLabels } from './agentBattleTabs';
// Battle View controller, Phase A (BATTLE_VIEW_CONTROLLER_ENABLED — dark).
// Everything imported from ./battleView renders ONLY under the flag; flag-off
// the screen is byte-identical to the tabbed screen it was before Phase A.
import { getMarketState } from '../utils/marketSchedule';
import { deriveTurnLine } from './battleView/deriveTurnLine';
import { selectSymbolRoster } from './battleView/selectSymbolRoster';
import { countMentions, mergeRecordedTape } from './battleView/scopeTape';
import { deriveChatMessages } from '../components/Agent/deriveChatMessages';
import useCoarseNow from './battleView/useCoarseNow';
import { useLandingKey } from './battleView/landing';
import LandingWash from './battleView/LandingWash';
import TurnLine from './battleView/TurnLine';
import WhyPanel from './battleView/WhyPanel';
import { selectWhyState, selectTradesForSymbol, deriveTierPrices } from './battleView/selectWhyState';
import { selectDeployPlan, selectDeployPlanForSymbol } from './battleView/selectDeployPlan';
import { buildTape, checkEntryId } from './battleView/buildTape';
import { BATTLE_VIEW_COPY } from './battleView/battleViewCopy';
import { deriveReceipts } from './battleView/deriveReceipts';
import ThisTurnStrip from './battleView/ThisTurnStrip';
import useContentStable from './battleView/useContentStable';
import ChatSheet from './battleView/ChatSheet';
import { PeekStrip } from './battleView/PeekStrip';
import { derivePeekLine } from './battleView/derivePeekLine';
import { useChatSheet, useViewportHeight, isSheetOpen, SHEET_PEEK_PX, SHEET_DETENT } from './battleView/useChatSheet';
import { cssVar } from '../theme/cssTokens';
import { motionToken } from '../theme/motion';
// PRESERVED FOR POST-LAUNCH (2026-05-19): authority mode UX is auto-pilot only at launch.
// See AUTHORITY_MODE_POST_LAUNCH_BACKLOG.md. Uncomment to revive.
// import ExecutionModeToggle from '../components/Agent/ExecutionModeToggle';
import StrategyPresetBadge from '../components/Agent/StrategyPresetBadge';
import HypothesisTicker from '../components/Agent/HypothesisTicker';
import GameTapeView from '../components/Agent/GameTapeView';
import AgentChat from '../components/Agent/AgentChat';
import ForgeCitationCard from '../components/Agent/ForgeCitationCard';
// PRESERVED FOR POST-LAUNCH (2026-05-19): authority mode UX is auto-pilot only at launch.
// See AUTHORITY_MODE_POST_LAUNCH_BACKLOG.md. Uncomment to revive.
// import ProposalBanner from '../components/Agent/ProposalBanner';
import DebateModal from '../components/Agent/DebateModal';
import TacticalRow from '../components/BaggerBomb/TacticalRow';
import ClosedTradesSection from '../components/BaggerBomb/ClosedTradesSection';
import BaggerBombBackground from '../components/BaggerBomb/BaggerBombBackground';
import { useWebSocketPrices } from '../hooks/useWebSocketPrices';
import { stockAPI, POPULAR_CRYPTO } from '../services/eodhdAPI';
import { calculateAssetScoreV3 } from '../utils/baggerBombUtils';
import { DEFAULT_THRESHOLD, buildResearchAsset } from '../utils/researchAssetBuilder';
import AssetResearchModal from '../components/draft/AssetResearchModal';
import TermResearchModal from '../components/shared/TermResearchModal';
import ScoreBreakdownPopover from '../components/draft/ScoreBreakdownPopover';
import FilmRoomBanner from '../components/FilmRoom/FilmRoomBanner';
import { CONVICTION_MULTIPLIERS, THRESHOLD_POINTS } from '../constants/baggerBombScoring';
import { getEquippedWatchlistLabel } from '../utils/watchlistEquipUI';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRICE_POLL_INTERVAL = 60000; // 60s

// A2.4 (review RB-F11): the desktop chat column's id, so the two controls that
// expand and collapse it — the strip's whole top row and the column's own ▾ —
// can NAME what their `aria-expanded` is about. They live in each other's
// chrome, and the column is the one region that contains both the strip and
// the collapsed chat beneath it. One constant, because two spellings of an
// `aria-controls` target is a broken reference that nothing renders.
const CHAT_COLUMN_ID = 'battle-chat-column';

const TIERS = [
  { key: 'star', label: 'Star Picks', emoji: '⭐', allocation: '2x', slots: 2 },
  { key: 'core', label: 'Core Holds', emoji: '💎', allocation: '1.5x', slots: 2 },
  { key: 'support', label: 'Support Plays', emoji: '📊', allocation: '1x', slots: 3, hasCrypto: true },
];

// P4 flat6 (companion c): tournament battles are six stocks, flat 1x, no
// crypto slot — the tier rows render as honest lineup slots so the existing
// screen neither crashes nor lies pre-P7 (the full tournament view).
const FLAT6_TIERS = [
  { key: 'star', label: 'Lineup 1–2', emoji: '📈', allocation: '1x', slots: 2 },
  { key: 'core', label: 'Lineup 3–4', emoji: '📈', allocation: '1x', slots: 2 },
  { key: 'support', label: 'Lineup 5–6', emoji: '📈', allocation: '1x', slots: 2 },
];

const TIER_HEADER_COLORS = {
  star:    { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)' },
  core:    { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  support: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
};

// Matchups backdrop palette — teal/mint accent (NOT the PvP view's cyan).
const BACKDROP_COLORS = [{ r: 94, g: 234, b: 212 }, { r: 45, g: 212, b: 191 }]; // #5eead4, #2dd4bf
const BACKDROP_LINE = { r: 94, g: 234, b: 212 };
const BACKDROP_GLOW = [
  'radial-gradient(ellipse 800px 800px at 25% 20%, rgba(94, 234, 212, 0.16), transparent 70%)',
  'radial-gradient(ellipse 700px 700px at 75% 15%, rgba(45, 212, 191, 0.12), transparent 70%)',
];

// Tab identity lives in ./agentBattleTabs so it can be tested against the
// real flag rather than re-implemented in a test (D-1 / D-15).

const isCryptoSymbol = (symbol) => {
  return POPULAR_CRYPTO.some(c => c.symbol === symbol) || symbol?.endsWith('-USD');
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDayLabel(timing) {
  if (!timing) return '';
  const { tradingDays, currentTradingDay } = timing;
  const total = tradingDays?.length || 0;
  if (total <= 1) return '';
  const current = currentTradingDay || 1;
  return `Day ${current} of ${total}`;
}

function computeTugOfWarWidth(myScore, oppScore) {
  const total = Math.abs(myScore) + Math.abs(oppScore);
  if (total === 0) return 50;
  return Math.max(10, Math.min(90, (Math.abs(myScore) / total) * 100));
}

// The newest feed entry's own stamp (its ISO / Firestore timestamp as a
// millisecond key), for the controller's seen mark. Null when unreadable.
function feedStampOf(entry) {
  const ts = entry?.timestamp;
  if (ts == null) return null;
  if (typeof ts === 'string' || typeof ts === 'number') {
    const ms = new Date(ts).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return null;
}

// ─── Responsive hook ──────────────────────────────────────────────────────────

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' && window.innerWidth >= 768
  );
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

const staggerSpring = { type: 'spring', stiffness: 200, damping: 20 };

// ─── Tier Header ──────────────────────────────────────────────────────────────

function TierHeader({ tier }) {
  const colors = TIER_HEADER_COLORS[tier.key] || TIER_HEADER_COLORS.support;
  // Flag-on: adopt the PvP view's bolder gradient-header treatment (uppercase,
  // 15px/800/1.5px) in the teal/mint accent, plus a subtle teal band wash.
  // Flag-off: the current flat-dark band + subtler teal→purple label (unchanged).
  const backdropOn = isMatchupsBackdropOn();
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 12px 6px',
      position: 'sticky',
      top: 0,
      zIndex: 5,
      background: backdropOn
        ? 'linear-gradient(90deg, rgba(94, 234, 212, 0.10), rgba(13, 14, 18, 0.95) 55%)'
        : 'rgba(13, 14, 18, 0.95)',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: backdropOn ? 15 : 14 }}>{tier.emoji}</span>
        <span style={{
          fontSize: backdropOn ? 15 : 13,
          fontWeight: backdropOn ? 800 : 700,
          background: backdropOn
            ? 'linear-gradient(90deg, #5eead4, #2dd4bf)'
            : 'linear-gradient(90deg, #5eead4, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: backdropOn ? '1.5px' : '0.02em',
          textTransform: backdropOn ? 'uppercase' : undefined,
        }}>
          {tier.label}
        </span>
      </div>
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        color: colors.color,
        background: colors.bg,
        padding: '2px 8px',
        borderRadius: 6,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {tier.emoji} {tier.allocation} each
      </span>
    </div>
  );
}

// ─── Score Header ─────────────────────────────────────────────────────────────

function ScoreHeader({
  agentBattle, tokens, isDesktop, playerScore, opponentScore, statusFeed,
  // Phase A (controller flag): the turn line and its landing tick. All null /
  // zero flag-off, which renders nothing extra.
  turnLine = null, landingKey = null, rowCount = 0, reducedMotion = false,
  // Phase A: tap the score header → the book-level Why? (D-53: Direct is
  // book-level; Why? on the header is the book's own panel). Absent flag-off.
  // A4.3 (review F16): a SHORT accessible name for that button instead of
  // its whole content (names, scores, the day label).
  onOpenBook = null, bookOpen = false, bookName = null,
}) {
  const myScore = playerScore ?? (agentBattle?.scoreState?.currentScore || 0);
  const oppScore = opponentScore ?? (agentBattle?.scoreState?.opponentScore || 0);
  const dayLabel = computeDayLabel(agentBattle?.timing);
  const agentName = agentBattle?.agentContext?.agentName || 'Your Agent';
  const tradeCount = agentBattle?.scoreState?.tradeCount || 0;

  const myWidth = computeTugOfWarWidth(myScore, oppScore);
  const isLeading = myScore >= oppScore;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...staggerSpring, delay: 0 }}
      style={{
        padding: isDesktop ? '14px 24px 10px' : '10px 16px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Names + Scores row — under the controller flag this is the book's
          Why? tap surface (role=button, keyboard-reachable). Flag-off: no
          extra attribute, byte-identical. */}
      <div
        {...(typeof onOpenBook === 'function' ? {
          role: 'button',
          tabIndex: 0,
          'aria-expanded': bookOpen ? 'true' : 'false',
          // D-89: the panel's close hands focus back HERE, and this is how it
          // finds the control — the same query-by-attribute idiom the panel's
          // own landing used. Controller-gated with the rest of this spread,
          // so a flag-off render emits none of it. AFTER `aria-expanded`
          // deliberately: `AgentBattleScreen.controller.test.jsx` counts the
          // tap surfaces with a regex over the rendered attribute ORDER, and
          // that triple is the contract it means to guard.
          'data-why-book-toggle': '1',
          // The short name, DESCRIBED by the names and scores it contains
          // (review CR2): button children are presentational, so without the
          // description the scores would leave the accessibility tree.
          ...(bookName ? { 'aria-label': bookName, 'aria-describedby': 'why-book-agent why-book-day why-book-cpu' } : {}),
          onClick: onOpenBook,
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenBook(); }
          },
        } : {})}
        style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...(typeof onOpenBook === 'function' ? { cursor: 'pointer' } : {}),
      }}>
        {/* Left: Agent — face → name → score (mirrors the CPU side on the right).
            The reactive presence face lives HERE now, immediately left of the name
            and score it reflects (mood = standingFromDuel(myScore, oppScore)); it
            replaces the old lucide Bot glyph. Flag-off omits the face entirely. */}
        <div {...(bookName ? { id: 'why-book-agent' } : {})} style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? 12 : 8 }}>
          {isAgentPresenceOn() && agentBattle && (
            <AgentPresenceMount
              surface="duel"
              agent={agentBattle}
              duel={{ playerScore: myScore, opponentScore: oppScore, statusFeed }}
              size={isDesktop ? 60 : 44}
              enableEnvironment={false}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: tokens.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 2,
            }}>
              {agentName}
            </span>
            <AnimatedScore value={myScore} defaultColor="#5eead4" size={28} />
          </div>
        </div>

        {/* Center: Day label + trade count */}
        <div {...(bookName ? { id: 'why-book-day' } : {})} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}>
          {dayLabel && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: tokens.textFaint,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              {dayLabel}
            </span>
          )}
          {tradeCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              color: tokens.textFaint,
            }}>
              <Activity size={9} />
              <span>{tradeCount} trade{tradeCount !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Right: CPU */}
        <div {...(bookName ? { id: 'why-book-cpu' } : {})} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 2,
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: tokens.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              CPU
            </span>
          </div>
          <AnimatedScore
            value={oppScore}
            defaultColor={tokens.textFaint || '#64748b'}
            size={28}
          />
        </div>
      </div>

      {/* Tug-of-war bar */}
      <div style={{
        width: '100%',
        height: 6,
        borderRadius: 3,
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
        display: 'flex',
      }}>
        <motion.div
          animate={{ width: `${myWidth}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          style={{
            height: '100%',
            background: isLeading
              ? 'linear-gradient(90deg, #5eead4, #2dd4bf)'
              : 'rgba(94,234,212,0.4)',
            borderRadius: '3px 0 0 3px',
          }}
        />
        <div style={{
          width: 2,
          height: '100%',
          background: 'rgba(255,255,255,0.15)',
          flexShrink: 0,
        }} />
        <div style={{
          flex: 1,
          height: '100%',
          background: !isLeading
            ? 'linear-gradient(90deg, #ef4444, #dc2626)'
            : 'rgba(239,68,68,0.3)',
          borderRadius: '0 3px 3px 0',
        }} />
      </div>

      {/* Turn line (Phase A, controller flag only): checked · next, from the
          same adapter arithmetic the Desk ships. Null flag-off. */}
      {turnLine && (
        <TurnLine
          turn={turnLine}
          landingKey={landingKey}
          rowCount={rowCount}
          reducedMotion={reducedMotion}
        />
      )}
    </motion.div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function TabBar({ activeTab, onTabChange, hasCommandDot, commandDotColor, hasGameTapeDot, isDesktop }) {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: isDesktop ? '6px 24px 8px' : '6px 12px 8px',
      background: 'transparent',
    }}>
      {TAB_KEYS.map(key => {
        const isActive = activeTab === key;
        const showDot = (key === 'command' && hasCommandDot) || (key === 'gametape' && hasGameTapeDot);
        const dotColor = key === 'command' ? commandDotColor : '#5eead4';
        return (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            style={{
              flex: 1,
              padding: '7px 4px',
              fontSize: 11,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#0D0E12' : 'rgba(255,255,255,0.5)',
              background: isActive ? '#5eead4' : 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.15s ease',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {tabLabels()[key]}
            {showDot && (
              <span style={{
                position: 'absolute',
                top: 3,
                right: 6,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: dotColor,
                border: '1.5px solid #0D0E12',
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 9,
      fontWeight: 700,
      color: 'rgba(255,255,255,0.25)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      padding: '0 2px',
      marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AgentBattleScreen({ battle, user, onBack, onOpenFilmRoom }) {
  const { tokens } = useTheme();
  const isDesktop = useIsDesktop();

  // Battle View controller (Phase A). Read at RENDER scope, never module scope
  // (the featureFlags mock hazard). Flag OR the ?battleViewController=1 smoke
  // override; the flip PR deletes the override.
  const controllerOn = isBattleViewControllerOn();
  const prefersReducedMotion = useReducedMotion();
  const reducedMotion = Boolean(prefersReducedMotion);
  // A coarse clock for the turn line: once a minute or on visibilitychange,
  // never a per-second tick. Inert (no interval) flag-off.
  const now = useCoarseNow(controllerOn);

  // Tab state
  const [activeTab, setActiveTab] = useState('matchups');

  // Modal state
  const [filterTicker, setFilterTicker] = useState(null);
  const [debateOpen, setDebateOpen] = useState(false);
  const [debateSymbol, setDebateSymbol] = useState(null);
  const [citationOpen, setCitationOpen] = useState(false);
  const [citationRuleId, setCitationRuleId] = useState(null);
  const [researchAsset, setResearchAsset] = useState(null);
  const [breakdownAsset, setBreakdownAsset] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(null);

  // Price state
  const [currentPrices, setCurrentPrices] = useState({});
  const [previousClosePrices, setPreviousClosePrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(true);

  // Notification dot tracking
  const lastSeenFeedLengthRef = useRef(0);

  // Why? (Phase A, controller flag): which player row is open, the book
  // panel, and the composer prefill the panel's one door hands the chat.
  const [whyOpen, setWhyOpen] = useState(null); // { key, symbol } | null
  const [bookWhyOpen, setBookWhyOpen] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState(null); // { text, nonce } | null
  // A2.3 (D-73): the piece the tape is scoped to — display filtering only,
  // nothing sent, nothing persisted. Null flag-off and when unscoped.
  const [scopeSymbol, setScopeSymbol] = useState(null);
  // A2.4 (review L2-F4): which desktop chat control should take focus after
  // the next collapse or expand, resolved in an effect once it has rendered.
  const [pendingChatFocus, setPendingChatFocus] = useState(null);
  const collapseControlRef = useRef(null);
  const expandControlRef = useRef(null);
  // D-89: the evaluation `Read the full check` names. The handler is defined
  // above the derivation that produces it — the turn line needs the score
  // header, which needs the layout — so the value reaches it through a ref
  // written in an EFFECT rather than during render. An effect commits before
  // any tap on the render that produced it, so the ref is never stale when the
  // door is pressed, and nothing is written during a render pass.
  const latestDecisionRef = useRef(null);

  // The layout (A4, controller flag): the mobile chat sheet's detent (inert
  // on desktop and flag-off), the viewport height it is sized from, the
  // full-screen Game Tape, and the feed length the chat has SEEN — moved by
  // an effect, never during render (rulings §3.9). Flag-off keeps the
  // shipped render-time clear above, byte for byte.
  // A2.4 (ruling 7): ONE detent for both shells. Desktop reads it as two —
  // peek is the strip at the bottom of the board column, open is the column
  // itself — which is what makes the detent survive a breakpoint crossing by
  // construction. Each shell OPENS at its own default: the phone at peek (the
  // board is the page), the desktop at half (the column is the layout).
  const sheet = useChatSheet(controllerOn, isDesktop ? SHEET_DETENT.HALF : SHEET_DETENT.PEEK);
  const chatOpen = isSheetOpen(sheet.detent);
  // The visible viewport height sizes the mobile sheet's detents AND the
  // desktop page (a fixed 100vh is the large viewport on iOS — review L2-F11).
  const viewportHeight = useViewportHeight(controllerOn);
  const [gameTapeOpen, setGameTapeOpen] = useState(false);
  // The mark of what the chat has SEEN: the feed's length AND its newest
  // entry's stamp. The server caps the feed (100 entries, sliced on every
  // tick) and other writers push past the cap between ticks, so the length
  // alone plateaus and can even shrink while entries keep arriving (review
  // refuter A on L2-F8); the stamp keeps `new activity` honest at the cap.
  const [seenFeed, setSeenFeed] = useState({ length: 0, stamp: null });
  const gameTapeReturnRef = useRef(null);
  const gameTapeBackRef = useRef(null);
  const gameTapeLinkRef = useRef(null);
  const gameTapeWasOpenRef = useRef(false);

  // ── Agent battle data ─────────────────────────────────────────────────────

  // Use direct agentBattleId if available (from dashboard), else look up via agentId
  const directId = battle?.agentBattleId || null;
  const { agentBattleId: queriedId, loading: idLoading } = useAgentBattleId(directId ? null : battle?.agentId);
  const agentBattleId = directId || queriedId;
  const {
    battle: agentBattle,
    statusFeed,
    executionMode,
    pendingProposal,
    strategyPreset,
    gameplanMeeting,
    chatExchanges,
    feedBookmarks,
    loading: battleLoading,
  } = useAgentBattle(agentBattleId);

  const loading = idLoading || battleLoading;

  // Mark feed as seen when switching to Command Center
  if (activeTab === 'command') {
    lastSeenFeedLengthRef.current = statusFeed.length;
  }

  // ── Row sources ───────────────────────────────────────────────────────────
  //
  // Flag-off (shipped): the rows read the `battle` PROP — a client-built
  // snapshot of the polled agentBattles doc (DashboardDesktop.jsx:79-93,
  // App.jsx handleOpenAgentBattle) that nothing refreshes while the screen is
  // open. After an agent swap the row keeps the pre-swap symbol until the
  // battle is re-opened (Phase 0 §6 bug 1 — fixed separately, NOT here).
  //
  // Under the controller flag (D-59): the rows read the SUBSCRIBED doc — the
  // same doc the turn line and Why? read — so the landing cannot lie after a
  // swap. The player's rows enrich from `agentBattle.portfolio` and its
  // `startingPrices`; the CPU rows from `agentBattle.opponent.portfolio`
  // (static from deploy, agentBattleService.js:167). The prop is the fallback
  // only when the live field is absent (null).
  //
  // The live doc is a fresh object on every Firestore snapshot (a chat
  // message, a feed entry, a tick), so the live sources are held by CONTENT:
  // their identity changes only when their values do (review finding F3 —
  // otherwise every snapshot restarted the 60 s price poll with an immediate
  // extra REST fetch). Flag-off the prop is frozen and reaches nothing new.
  const livePlayerPortfolio = useContentStable(controllerOn ? (agentBattle?.portfolio || null) : null);
  const liveOpponentPortfolio = useContentStable(controllerOn ? (agentBattle?.opponent?.portfolio || null) : null);
  const playerPortfolioSource = livePlayerPortfolio || battle?.creator?.portfolio;
  const opponentPortfolioSource = liveOpponentPortfolio || battle?.opponent?.portfolio;

  // ── Symbol extraction ─────────────────────────────────────────────────────

  const startingPrices = (livePlayerPortfolio && livePlayerPortfolio.startingPrices)
    || battle?.state?.startingPrices
    || {};
  const thresholds = agentBattle?.scoring?.thresholds || {};

  const allSymbols = useMemo(() => {
    const symbols = new Set();
    const addFromPortfolio = (portfolio) => {
      if (!portfolio) return;
      ['star', 'core', 'support'].forEach(tier => {
        (portfolio[tier] || []).forEach(a => { if (a?.symbol) symbols.add(a.symbol); });
      });
    };
    addFromPortfolio(playerPortfolioSource);
    addFromPortfolio(opponentPortfolioSource);
    return [...symbols];
  }, [playerPortfolioSource, opponentPortfolioSource]);

  // ── WebSocket prices ──────────────────────────────────────────────────────

  const { prices: wsPrices } = useWebSocketPrices(allSymbols);

  const effectivePrices = useMemo(() => {
    if (!wsPrices || Object.keys(wsPrices).length === 0) return currentPrices;
    return { ...currentPrices, ...wsPrices };
  }, [currentPrices, wsPrices]);

  // ── EODHD price polling ───────────────────────────────────────────────────

  const fetchPrices = useCallback(async () => {
    if (allSymbols.length === 0) {
      setLoadingPrices(false);
      return;
    }
    try {
      const prices = {};
      const stockSymbols = allSymbols.filter(s => !isCryptoSymbol(s));
      const cryptoSymbols = allSymbols.filter(s => isCryptoSymbol(s));

      const [stockData, cryptoData] = await Promise.all([
        stockSymbols.length > 0 ? stockAPI.getMultipleStockPrices(stockSymbols) : {},
        cryptoSymbols.length > 0 ? stockAPI.getMultipleCryptoPrices(cryptoSymbols) : {},
      ]);

      const newPreviousCloses = {};
      Object.entries(stockData).forEach(([symbol, data]) => {
        if (data?.price) prices[symbol] = data.price;
        if (data?.previousClose) newPreviousCloses[symbol] = data.previousClose;
      });
      Object.entries(cryptoData).forEach(([symbol, data]) => {
        if (data?.price) prices[symbol] = data.price;
        if (data?.previousClose) newPreviousCloses[symbol] = data.previousClose;
      });

      if (Object.keys(newPreviousCloses).length > 0) {
        setPreviousClosePrices(prev => ({ ...prev, ...newPreviousCloses }));
      }

      // Fallback to starting prices for missing symbols
      for (const symbol of allSymbols) {
        if (!prices[symbol] && startingPrices[symbol]) {
          prices[symbol] = startingPrices[symbol];
        }
      }

      setCurrentPrices(prev => ({ ...prev, ...prices }));
      setLoadingPrices(false);
    } catch (error) {
      console.error('[AgentBattle] Error fetching prices:', error);
      setCurrentPrices(startingPrices);
      setLoadingPrices(false);
    }
  }, [allSymbols, startingPrices]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, PRICE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // ── Price beacon: removed 2026-07-16 (founder ruling) ────────────────────
  //
  // A client-side `livePriceBeacon` write once lived here: it pushed the live
  // (websocket) prices onto the agentBattles doc so the swap cron could prefer
  // them over its ~15-min-delayed REST feed. It never worked in production — the
  // agentBattles Firestore rules allowlist (hasOnly) omitted `livePriceBeacon`,
  // so every write was permission-denied and swallowed by a .catch.
  //
  // The founder ruling (Phase 0 discovery, 2026-07-16) is to RETIRE it rather
  // than restore it. The server has no real-time price feed of its own (only the
  // delayed EODHD REST endpoint), so the only way to produce a fresh beacon is
  // either (a) trusting a client-written price that feeds a SCORED input
  // (exit/entry price -> lockedPoints), which is exactly the client-trust the
  // Firestore hardening removed — cf. `portfolio.startingPrices` staying denied —
  // or (b) net-new realtime price infrastructure. Neither is worth it for a
  // no-real-money game: uniform (delayed) REST pricing for all agents is safe,
  // consistent, and fair. Agent swaps deliberately price on the server-trusted
  // REST fallback (see agentSwapExecution.js getPrice()); the beacon is
  // intentionally never written. Fresh pricing, if the product ever justifies it,
  // is backlogged as "real-time price infrastructure".

  // ── Asset enrichment ──────────────────────────────────────────────────────

  const enrichAsset = useCallback((asset, tier) => {
    if (!asset) return null;

    if (asset.isCash) {
      return {
        ...asset,
        priceChange: 0,
        baseATR: 0,
        points: 0,
        badges: [],
        history: { maxMultiplier: 0, minMultiplier: 0 },
      };
    }

    const openPrice = asset.swapPrice || startingPrices[asset.symbol] || asset.price || 0;
    const curPrice = effectivePrices[asset.symbol] || openPrice;
    const threshold = thresholds[asset.symbol] || {};
    const baseATR = threshold.threshold || DEFAULT_THRESHOLD;

    let priceChange = openPrice > 0
      ? ((curPrice - openPrice) / openPrice) * 100
      : 0;

    if (asset.direction === 'short') {
      priceChange = -priceChange;
    }

    // Day-1 activation gate — mirrors the server boundary at
    // api/cron/agent-evaluate.js:303 (and agent-daily-scores.js:60-64): compare
    // today's ET calendar date to the battle's activation date. On the activation
    // day the threshold/badge baseline is the ENTRY price (startingPrices), so a
    // stock that gapped from its prior close and then sat flat from entry can't
    // fabricate Bust/Crash/Meltdown while the display reads +0.00%. previousClose
    // only takes over on day 2+.
    //
    // A wall-clock ET-date comparison is used on purpose, NOT timing.currentTradingDay:
    // currentTradingDay is a denormalized value the daily-scores cron writes only
    // when it runs (agent-daily-scores.js:51,188 — calendar-derived but
    // idempotency-gated with no missed-day catch-up), so a skipped nightly run
    // would leave it stale at 1 while the server's date-based gate had already
    // rolled to day 2 — a full-day client/server divergence. The date comparison
    // advances with the clock, exactly like the server's authoritative gate.
    // Falls back to "activation day" when no timestamp exists (conservative: entry
    // baseline, never a phantom badge).
    //
    // activatedAt/createdAt are ISO strings on the agentBattles doc
    // (agentBattleService.js:44,75-76), so new Date(it) is correct today. The
    // .toDate?.() normalization is defensive: were either ever stored as a
    // Firestore Timestamp, new Date(timestamp) would be Invalid Date and the gate
    // would silently fall to false → phantom badges return. .toDate?.() is a no-op
    // for strings/numbers (?. short-circuits) and unwraps a Timestamp if present.
    const toEtDate = (raw) => {
      const d = raw?.toDate?.() ?? new Date(raw);
      return d.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    };
    const activationTs = agentBattle?.activatedAt || agentBattle?.createdAt;
    const isActivationDay = activationTs ? toEtDate(Date.now()) === toEtDate(activationTs) : true;

    // Threshold baseline must match the asset's entry into the portfolio.
    // For swapped-in assets, swapPrice prevents retroactive BaggerBomb credit
    // for pre-swap moves since previousClose (first in both branches, regardless
    // of day). On the activation day entry beats previousClose; on day 2+ the
    // original previousClose-first order is preserved.
    const thresholdBaseline = asset.swapPrice
      || (isActivationDay
        ? (startingPrices[asset.symbol] || previousClosePrices[asset.symbol] || openPrice)
        : (previousClosePrices[asset.symbol] || startingPrices[asset.symbol] || openPrice));
    let thresholdPriceChange = thresholdBaseline > 0
      ? ((curPrice - thresholdBaseline) / thresholdBaseline) * 100
      : priceChange;

    if (asset.direction === 'short') {
      thresholdPriceChange = -thresholdPriceChange;
    }

    const multiplier = baseATR > 0 ? thresholdPriceChange / baseATR : 0;

    // Merge server-persisted peaks (maintained by the agent-evaluate cron) with
    // the live multiplier so threshold bonus points stay visible when the price
    // reverses between cron ticks. Core invariant: maxMultiplier monotonically
    // increases, minMultiplier monotonically decreases.
    const persistedHistory = agentBattle?.thresholdHistory?.[asset.symbol] || {};
    const history = {
      maxMultiplier: Math.max(persistedHistory.maxMultiplier || 0, multiplier > 0 ? multiplier : 0),
      minMultiplier: Math.min(persistedHistory.minMultiplier || 0, multiplier < 0 ? multiplier : 0),
    };

    // P8 hygiene item 1 — apply the direction sign EXACTLY ONCE. priceChange,
    // thresholdPriceChange, multiplier and history above are already in
    // position-P&L terms (the two `direction === 'short'` adjustments). The
    // canonical scorer ALSO negates priceChange/thresholdPriceChange internally
    // for a short, so it is called WITHOUT `direction`: forwarding it would
    // double-negate and silently flip a short's score to a long's. Dormant for
    // long-only agents (the only portfolios this screen renders today), but the
    // contract is load-bearing the moment any short reaches here. Note we keep
    // the caller-owns-direction convention (not flat6's scorer-owns) because the
    // scorer negates the scalar args but NOT the caller-supplied `history`,
    // which is already adjusted above. Locked by agentBattleScoring.test.js —
    // do NOT add `direction` back to this call.
    // LOAD-BEARING full-asset spread: on tournament docs the D2 flat6
    // `tierMultiplier: 1.0` stamp rides `...asset` into the scorer's override —
    // narrowing this to a field subset re-scores flat6 display at slot labels
    // (the C-2 server defect class, fixed 2026-08).
    const score = calculateAssetScoreV3(
      { ...asset, baseATR, tier, direction: undefined },
      priceChange,
      history,
      {},
      thresholdPriceChange
    );

    return {
      ...asset,
      priceChange,
      thresholdPriceChange,
      baseATR,
      points: score.totalPoints,
      badges: score.badges,
      history,
      currentPrice: curPrice,
      // Phase A: the entry the row's % is computed from, carried so the Why?
      // facts read the ROW's number (never the adapter's book — rulings §3.3).
      openPrice,
      // A2.1 (ruling 1): the baseline the THRESHOLD percent is measured from —
      // the one field the Why? tier lines need. `Bagger $ · Bust $` is
      // `thresholdBaseline × (1 ± baseATR/100)`, the exact inverse of the
      // percent the row renders beside it (deriveTierPrices). Computed here
      // already; before A2.1 it was simply not returned.
      thresholdBaseline,
    };
  }, [effectivePrices, startingPrices, thresholds, previousClosePrices, agentBattle?.thresholdHistory, agentBattle?.activatedAt, agentBattle?.createdAt]);

  // ── Enriched portfolios ───────────────────────────────────────────────────

  const enrichedPlayerPortfolio = useMemo(() => {
    const p = playerPortfolioSource;
    if (!p) return { star: [], core: [], support: [] };
    return {
      star: (p.star || []).map(a => enrichAsset(a, 'star')),
      core: (p.core || []).map(a => enrichAsset(a, 'core')),
      support: (p.support || []).map(a => enrichAsset(a, 'support')),
    };
  }, [playerPortfolioSource, enrichAsset]);

  const enrichedOpponentPortfolio = useMemo(() => {
    const p = opponentPortfolioSource;
    if (!p) return { star: [], core: [], support: [] };
    return {
      star: (p.star || []).map(a => enrichAsset(a, 'star')),
      core: (p.core || []).map(a => enrichAsset(a, 'core')),
      support: (p.support || []).map(a => enrichAsset(a, 'support')),
    };
  }, [opponentPortfolioSource, enrichAsset]);

  // ── The plan at deploy (A2.1b, D-76) ──────────────────────────────────────
  // Derived ONCE from the subscribed doc: frozen at creation, so it changes
  // only when the doc's identity does. Null whenever it must not render — a
  // tournament battle's plan and the algorithmic fallback's template are
  // system strings (the gates live in selectDeployPlan.js, with the reasons).
  const deployPlan = useMemo(
    () => (controllerOn ? selectDeployPlan(agentBattle) : null),
    [controllerOn, agentBattle?.agentContext, agentBattle?.gameMode, agentBattle?.activatedAt, agentBattle?.createdAt],
  );

  // ── Known tickers for chat ticker linking ─────────────────────────────────

  // A2.3 (ruling 8, hazard 27): under the flag the roster is the battle's own
  // UNIVERSE — the book plus the three persisted bench lists — so a message
  // about a name the agent is one tick from buying is underlined and counted.
  // Flag-off it is the book alone, byte for byte: widening it would widen what
  // the shipped chat underlines, and the underline opens a research modal.
  const knownTickers = useMemo(() => {
    const tickers = new Set();
    // The BOOK, from the same source the rows render (review L1-F5 / L5-F10):
    // `selectSymbolRoster` reads `agentBattle.portfolio`, and on a document
    // that has none the board still renders from the prop fallback — so the
    // roster would have been empty while seven pieces were on screen.
    ['star', 'core', 'support'].forEach(tier => {
      (enrichedPlayerPortfolio[tier] || []).forEach(a => {
        if (a?.symbol) tickers.add(a.symbol);
      });
    });
    if (!controllerOn) return tickers;
    // …plus the three bench lists, under the flag only (hazard 27).
    for (const symbol of selectSymbolRoster(agentBattle)) tickers.add(symbol);
    return tickers;
    // Narrowed to the three subtrees `selectSymbolRoster` reads (review
    // L2-F11): `agentBattle` is a fresh object on every Firestore snapshot, so
    // depending on it rebuilt this Set — and the chat's whole timeline behind
    // it — on writes that touch nothing in the roster, on the SHIPPED path too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerOn, enrichedPlayerPortfolio, agentBattle?.portfolio, agentBattle?.watchlist, agentBattle?.agentContext]);

  // ── Computed scores ───────────────────────────────────────────────────────

  const sumPortfolioPoints = (portfolio) => {
    let total = 0;
    ['star', 'core', 'support'].forEach(tier => {
      (portfolio[tier] || []).forEach(a => { if (a) total += (a.points || 0); });
    });
    return total;
  };

  // Banked score = sum of locked points from closed trades. Swapped-out assets
  // keep their earned threshold bonuses here; without this the client would
  // show activeScore only and diverge from server scoreState.currentScore after
  // any agent swap.
  const bankedScore = useMemo(() => {
    return (agentBattle?.trades || []).reduce((sum, t) => {
      return sum + (Number.isFinite(t?.lockedPoints) ? t.lockedPoints : 0);
    }, 0);
  }, [agentBattle?.trades]);

  const playerTotalScore = useMemo(
    () => Math.round(sumPortfolioPoints(enrichedPlayerPortfolio) + bankedScore),
    [enrichedPlayerPortfolio, bankedScore]
  );
  const opponentTotalScore = useMemo(
    () => Math.round(sumPortfolioPoints(enrichedOpponentPortfolio)),
    [enrichedOpponentPortfolio]
  );

  // Use live score when prices loaded, fallback to cron score.
  // For completed battles, freeze on the server's final currentScore so the
  // display doesn't drift once prices reload post-market.
  const displayPlayerScore = loadingPrices
    ? (agentBattle?.scoreState?.currentScore || 0)
    : agentBattle?.status === 'completed'
      ? (agentBattle?.scoreState?.currentScore ?? playerTotalScore)
      : playerTotalScore;
  const displayOpponentScore = loadingPrices
    ? (agentBattle?.scoreState?.opponentScore || 0)
    : agentBattle?.status === 'completed'
      ? (agentBattle?.scoreState?.opponentScore ?? opponentTotalScore)
      : opponentTotalScore;

  // ── Notification dots ─────────────────────────────────────────────────────

  const hasPendingProposal = pendingProposal && !pendingProposal.resolvedAt;
  // A4 (controller flag, hazard 14 / rulings §3.9): the chat is VISIBLE when
  // the desktop column is on screen or the mobile sheet sits at half / full,
  // and never while the Game Tape covers the page. The seen-count moves in
  // this effect, keyed on the feed length and the visibility — never during
  // render. Desktop under the flag therefore never shows a dot; on mobile it
  // lives on the sheet's handle and clears when the sheet opens.
  //
  // A2.4 (D-74): the desktop can now be COLLAPSED, so "visible" is the one
  // detent question on both shells. The dot therefore lives on the desktop
  // strip while it is collapsed — the mobile rule, applied to the desktop's
  // own collapsed state — and still never shows while the column is open.
  const chatVisible = controllerOn && !gameTapeOpen && chatOpen;
  const newestFeedStamp = feedStampOf(statusFeed[statusFeed.length - 1]);
  useEffect(() => {
    if (!chatVisible) return;
    setSeenFeed({ length: statusFeed.length, stamp: newestFeedStamp });
  }, [chatVisible, statusFeed.length, newestFeedStamp]);
  const hasNewFeedEntries = controllerOn
    ? (statusFeed.length > seenFeed.length
      || (seenFeed.stamp != null && newestFeedStamp != null && newestFeedStamp !== seenFeed.stamp))
    : statusFeed.length > lastSeenFeedLengthRef.current;
  const hasCommandDot = hasPendingProposal || hasNewFeedEntries;
  const commandDotColor = hasPendingProposal ? '#f59e0b' : '#5eead4';
  const hasGameTapeDot = (feedBookmarks?.length || 0) > 0;

  // ── Turn line + landing (Phase A, controller flag) ────────────────────────
  //
  // One source: the adapter over the subscribed doc, null cache, null agent —
  // no cache read, no rules contact. `now` is the coarse clock above and
  // marketState is read once per derivation (the useCommandCenterSync idiom).
  // Null flag-off, so the header renders nothing extra.
  const turnLine = useMemo(() => {
    if (!controllerOn || !agentBattle) return null;
    return deriveTurnLine(agentBattle, now, getMarketState());
    // `now` is the memo's clock; the doc is the only other input.
  }, [controllerOn, agentBattle, now]);

  // The landing fires on the snapshot change of lastScoredAt only — never on
  // a timer, never on open. Null flag-off (the hook is inert when disabled).
  const landingKey = useLandingKey(agentBattle?.scoreState?.lastScoredAt, controllerOn, Boolean(agentBattle));
  const activeTiers = agentBattle?.gameMode === 'baggerbomb_tournament' ? FLAT6_TIERS : TIERS;
  const rowCount = activeTiers.reduce((n, t) => n + t.slots, 0);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleTickerTap = useCallback((symbol) => {
    setFilterTicker(prev => prev === symbol ? null : symbol);
  }, []);

  const handleChallenge = useCallback((entry) => {
    setDebateSymbol(entry.symbolOut);
    setDebateOpen(true);
  }, []);

  const handleCitationTap = useCallback((ruleId) => {
    setCitationRuleId(ruleId);
    setCitationOpen(true);
  }, []);

  // Phase 2.5 Voice Layer Rework — payload may now be a term descriptor from
  // the chat highlighter ({ type: 'term', token: 'VWAP' }) in addition to the
  // existing ticker-asset shapes from TacticalRow, TradeTickerCard, and
  // AgentChat ticker matches ({ symbol: 'NVDA' } or full asset objects).
  const handleSymbolClick = useCallback((payload) => {
    if (payload?.type === 'term') {
      setSelectedTerm(payload.token);
      return;
    }
    setResearchAsset(payload);
  }, []);

  const handlePointsClick = useCallback((asset) => {
    setBreakdownAsset(asset);
  }, []);

  // ── Why? (Phase A, controller flag) ───────────────────────────────────────
  // A tap on the LEFT side of a row toggles that row's panel; the score header
  // toggles the book's. The one door prefills the composer with a string the
  // user edits and sends through the shipped chat path (C2) — in the tabbed
  // layout that means switching to the chat tab, where AgentChat mounts and
  // consumes the prefill once.
  const handleWhyToggle = useCallback((rowKey, asset) => {
    if (!asset?.symbol) return;
    // Toggle on the row AND its symbol: after a swap replaced the open row's
    // piece, the first tap on the new piece opens it (review finding F5).
    setWhyOpen(prev => (
      prev?.key === rowKey && prev.symbol === asset.symbol
        ? null
        : { key: rowKey, symbol: asset.symbol }
    ));
  }, []);
  const handleBookWhyToggle = useCallback(() => setBookWhyOpen(open => !open), []);
  // D-89 — the book panel's close. It closes the panel AND hands focus back to
  // the score header, which is the control that owns its `aria-expanded`: a
  // disclosure that leaves focus on a region it has just unmounted drops a
  // keyboard reader to `document.body`. Queried rather than held in a ref for
  // the same reason the panel's own landing was: the header renders in a
  // sibling component, and one attribute is a smaller seam than a ref threaded
  // through it.
  const handleCloseBookWhy = useCallback(() => {
    setBookWhyOpen(false);
    if (typeof document === 'undefined') return;
    document.querySelector('[data-why-book-toggle]')?.focus?.();
  }, []);

  // `Read the full check` on a row (D-89). It used to open the BOOK panel
  // above the board and move focus to its heading (A2.1 / A2.3 ruling 4).
  // Two things were wrong with that and only a ruling could fix them: the
  // panel is the LATEST check for the whole book, which is not necessarily the
  // check the row's extract came from; and it opens above the board, so a
  // reader on a low row was thrown to the top of the page to read one
  // paragraph with no way back to where they were.
  //
  // The door now opens THE CHECK'S OWN CARD in the conversation — where the
  // check sits between the checks either side of it, and where the reader can
  // keep going. The card is named by `checkEntryId`, the builder's own rule,
  // so the screen cannot ask for an id the tape does not stamp.
  //
  // The nonce re-fires the landing when the same card is asked for twice,
  // exactly as the old tick did for the panel.
  //
  // The nonce is a COUNTER, not `Date.now()`: two taps inside the same
  // millisecond — or under a pinned clock, which is how this screen is tested
  // — produce the same stamp, and an unchanged nonce is an effect that does
  // not re-run. The old book-panel tick was a counter for exactly this reason.
  const [openCheck, setOpenCheck] = useState(null);
  const handleReadFullCheck = useCallback(() => {
    const invoker = typeof document !== 'undefined' ? document.activeElement : null;
    const id = checkEntryId(latestDecisionRef.current);
    if (!id) return;
    setOpenCheck((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }));
    // The conversation has to be OPEN, and at FULL rather than half: the card
    // may be far up a long tape and the reader was promised the whole check.
    // One call for both shells — since ruling 7 the detent is one thing, and
    // FULL is an open detent on the desktop too, which renders the column.
    sheet.setDetent(SHEET_DETENT.FULL, invoker);
  }, [sheet.setDetent]);
  const handleAskFollowUp = useCallback((symbol) => {
    // The invoking control, captured synchronously so the mobile sheet can
    // hand focus back to it on collapse (A4).
    const invoker = typeof document !== 'undefined' ? document.activeElement : null;
    setComposerPrefill({
      text: symbol ? BATTLE_VIEW_COPY.followUpPrefill(symbol) : '',
      nonce: Date.now(),
    });
    // No tab change — there is no tab bar under the flag. The question is the
    // DETENT's, not the breakpoint's (review RA-F3): this read `!isDesktop`
    // and its comment said "the chat column is always on screen", which A2.4
    // made false — a collapsed desktop dropped the player into a prefilled
    // composer with the conversation still folded behind `display: none`,
    // through a door the seed calls "a door into the conversation". Its twin,
    // the scope door, was corrected for exactly this at review L2-F2; leaving
    // this one on the old rule was the inconsistency that fix meant to close.
    // Open, then let the chat's prefill effect focus the textarea inside it
    // (F13's draft rule stands, on both shells).
    if (!chatOpen) sheet.open(invoker);
  }, [chatOpen, sheet.open]);
  const handleComposerPrefillConsumed = useCallback(() => setComposerPrefill(null), []);

  // The landing for the door above now lives in the CHAT (D-89), beside the
  // card it lands on — `AgentChat`'s `openCheck` layout effect. It has to: the
  // card may be inside a fold on the render that requests it, so the scroll
  // can only run after the list has committed with that fold opened, and this
  // component never sees the list.
  //
  // What used to be here — a scroll to `#why-book-heading` and a focus on it —
  // went with the retarget. The book panel is still reachable (the score
  // header opens it) and now opens collapsed, so there is nothing above the
  // board to bring into view.

  // A2.3: the second door. Scope is DISPLAY FILTERING — nothing is sent — and
  // the composer prefill is the existing one, so the door reads the
  // conversation and the follow-up door still writes to it. Mobile opens the
  // sheet to at least half (the same rule the follow-up door uses), because a
  // filtered stream behind a peek strip is a filter nobody can see.
  const handleScopeToPiece = useCallback((symbol, count) => {
    if (!symbol) return;
    const invoker = typeof document !== 'undefined' ? document.activeElement : null;
    // ZERO OPENS THE WHOLE TAPE (seed §A2.3, review L1-F3 / L2-F3 / L5-F5).
    // `In the chat · 0` is a true thing to say about a piece, and the ruling
    // says the tap opens the UNSCOPED tape at the piece's prefill. Scoping to
    // an empty filter instead dropped the chat through to its EmptyState —
    // the fresh-battle onboarding copy — on a battle with a conversation.
    setScopeSymbol(count > 0 ? symbol : null);
    setComposerPrefill({ text: BATTLE_VIEW_COPY.followUpPrefill(symbol), nonce: Date.now() });
    // …and the chat has to be ON SCREEN for a filter to mean anything
    // (review L2-F2): since A2.4 the DESKTOP can be collapsed too, so the
    // question is the detent's, not the breakpoint's.
    if (!chatOpen) sheet.open(invoker);
  }, [chatOpen, sheet.open]);
  const handleClearScope = useCallback(() => setScopeSymbol(null), []);

  // A2.3 (review L2-F7): the scope clears itself when its piece leaves the
  // battle's universe — the agent swapped it out, or the doc changed under
  // the player. A chip naming a piece the battle no longer has filters a
  // stream nobody can get back to except by tapping it.
  useEffect(() => {
    if (!scopeSymbol) return;
    if (!knownTickers.has(scopeSymbol)) setScopeSymbol(null);
  }, [scopeSymbol, knownTickers]);

  // A2.4 (D-74): the desktop's two states, through the SAME detent the mobile
  // sheet uses. Expanding opens at HALF rather than FULL so a crossing to the
  // phone lands on half, which is the ruled behaviour; the choice lives in
  // the hook's state for the session and is never stored.
  //
  // FOCUS GOES TO THE CONTROL THAT REPLACES THE ONE THAT VANISHED (review
  // L2-F4). Each control lives inside the chrome the other renders, so a
  // keyboard user who collapsed the chat was dropped to `document.body` and
  // their next Tab restarted at the top of the document. The mobile sheet has
  // had a return-focus contract for this transition since A4 (review CR4);
  // this is the desktop's.
  const handleExpandChat = useCallback(() => {
    sheet.open(null);
    setPendingChatFocus('collapse');
  }, [sheet.open]);
  const handleCollapseChat = useCallback(() => {
    sheet.collapse();
    setPendingChatFocus('expand');
  }, [sheet.collapse]);
  useEffect(() => {
    if (!pendingChatFocus) return;
    const target = pendingChatFocus === 'expand' ? expandControlRef.current : collapseControlRef.current;
    target?.focus?.();
    setPendingChatFocus(null);
  }, [pendingChatFocus]);

  // Game Tape (A4, rulings §2.5): one header link renders the shipped view
  // full-screen over the page, with a way back. Focus goes to the way back on
  // open and returns to the link on close. The chat stays mounted beneath
  // (its draft survives); the page beneath is hidden from pointer, keyboard
  // and assistive tech while the tape is up.
  const openGameTape = useCallback(() => {
    gameTapeReturnRef.current = typeof document !== 'undefined' ? document.activeElement : null;
    setGameTapeOpen(true);
  }, []);
  const closeGameTape = useCallback(() => setGameTapeOpen(false), []);
  useEffect(() => {
    if (!controllerOn) return;
    if (gameTapeOpen) {
      gameTapeWasOpenRef.current = true;
      gameTapeBackRef.current?.focus?.();
      // The page beneath must not scroll under the tape (review L2-F10):
      // lock the document while it is up, restore on close or unmount.
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = previousOverflow; };
    }
    // Only after a CLOSE — never on mount (review CR6: the mount pass must
    // not steal focus to the link). Back to the control that opened the tape,
    // or to the link itself when the pointer left nothing focused (Safari
    // does not focus a clicked button).
    if (!gameTapeWasOpenRef.current) return;
    gameTapeWasOpenRef.current = false;
    const back = gameTapeReturnRef.current;
    gameTapeReturnRef.current = null;
    const usable = back && back !== document.body && back.isConnected && typeof back.focus === 'function';
    if (usable) back.focus();
    else gameTapeLinkRef.current?.focus?.();
  }, [controllerOn, gameTapeOpen]);
  const lastScoredAt = agentBattle?.scoreState?.lastScoredAt ?? null;
  const latestDecision = turnLine?.decision ?? null;
  useEffect(() => { latestDecisionRef.current = latestDecision; }, [latestDecision]);

  // ── Receipts + This turn (Phase A, controller flag) ───────────────────────
  // Pure, from the subscribed doc; the chat and the strip only render what
  // they are handed. Null flag-off, so AgentChat keeps its shipped card.
  const receipts = useMemo(() => {
    if (!controllerOn || !agentBattle) return null;
    return deriveReceipts(chatExchanges, agentBattle.directive ?? null, agentBattle.status ?? null);
  }, [controllerOn, agentBattle, chatExchanges]);
  // ── The tape (A2.2, D-72) ─────────────────────────────────────────────────
  // Built ONCE here, from the subscribed doc, and passed down: the chat merges
  // it into the one timeline it already sorts. No second list, and the screen
  // stays the only place that reads the document (rulings §3.3).
  const tapeEntries = useMemo(() => (controllerOn ? buildTape({
    trades: agentBattle?.trades,
    statusFeed: agentBattle?.statusFeed,
    evaluations: agentBattle?.evaluations,
    receipts,
    chatExchanges: agentBattle?.chatExchanges,
  }) : null), [
    controllerOn,
    agentBattle?.trades,
    agentBattle?.statusFeed,
    agentBattle?.evaluations,
    agentBattle?.chatExchanges,
    receipts,
  ]);

  // A2.3: the merged, UNFOLDED stream over the persisted record — messages
  // (the chat's own derivation, so the count and the bubbles are one list) plus
  // the tape's cards, one concat and one sort exactly as the chat merges them.
  // Null flag-off, so nothing here runs on the shipped path.
  const recordedTape = useMemo(() => (controllerOn
    ? mergeRecordedTape(deriveChatMessages(chatExchanges), tapeEntries)
    : null), [controllerOn, chatExchanges, tapeEntries]);

  // `In the chat · {n}` for the OPEN row's piece — the length of the list the
  // door opens, computed with the same function the chat filters with
  // (BUILD_RULES §9). Only the open row needs it, so a board of seven pieces
  // costs one scan, not seven.
  const openWhySymbol = whyOpen?.symbol ?? null;
  const mentionCount = useMemo(() => (controllerOn && openWhySymbol
    ? countMentions(recordedTape, openWhySymbol, knownTickers)
    : null), [controllerOn, openWhySymbol, recordedTape, knownTickers]);

  // A2.4 (D-74): the newest tape entry as one line, folded exactly as the
  // stream is, so the strip and the stream cannot name one moment two ways.
  // Null flag-off and on an empty tape.
  const peekLine = useMemo(
    () => (controllerOn ? derivePeekLine(recordedTape) : null),
    [controllerOn, recordedTape],
  );

  const thisTurnStrip = controllerOn && agentBattle ? (
    <ThisTurnStrip
      directive={agentBattle.directive ?? null}
      receipts={receipts}
      battleStatus={agentBattle.status ?? null}
      turn={turnLine}
    />
  ) : null;

  // Memoize enriched research asset to avoid re-renders on every price tick
  const stableResearchAsset = useMemo(() => {
    if (!researchAsset) return null;
    return buildResearchAsset(researchAsset, {
      livePrices: effectivePrices,
      thresholds,
      startingPrices,
      useDefaultThreshold: true,
    });
  }, [researchAsset, effectivePrices, thresholds, startingPrices]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading && !agentBattle) {
    return (
      <div style={{
        minHeight: '100vh',
        background: tokens.bgApp || '#0D0E12',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          >
            <Bot size={24} color="#5eead4" />
          </motion.div>
          <span style={{ fontSize: 13, color: tokens.textMuted }}>Loading agent battle...</span>
        </div>
      </div>
    );
  }

  // The board — the tier rows, shared by both layouts (one tree, one
  // landing order: `index` runs top to bottom across the seven slots).
  const boardRows = (
    <>
    {activeTiers.map((tier, tierIndex) => (
      <div key={tier.key}>
        <TierHeader tier={tier} />
        {Array.from({ length: tier.slots }).map((_, i) => {
          const rowKey = `${tier.key}-${i}`;
          const leftAsset = enrichedPlayerPortfolio[tier.key]?.[i] || null;
          const whyable = controllerOn && !!leftAsset?.symbol && !leftAsset.isCash;
          const isWhyOpen = whyable && whyOpen?.key === rowKey && whyOpen.symbol === leftAsset.symbol;
          const row = (
            <TacticalRow
              key={rowKey}
              leftAsset={leftAsset}
              rightAsset={enrichedOpponentPortfolio[tier.key]?.[i] || null}
              tier={tier.key}
              allocationLabel={`${tier.emoji} ${tier.allocation}`}
              isCryptoSlot={tier.hasCrypto && i === tier.slots - 1}
              onSymbolClick={handleSymbolClick}
              onPointsClick={handlePointsClick}
              // A2 (D-85): the player's current price beside the % change.
              // Keyed on the FLAG, not on `whyable` — the price is a fact about
              // a piece, not a property of the Why? door — and read inside the
              // row off `asset.currentPrice`, the field it already hands
              // computeProximity, so the row's price and the panel's tier
              // dollars cannot come from two sources (BUILD_RULES §9). Absent
              // flag-off, so the shipped row markup is byte-identical.
              {...(controllerOn ? { showCurrentPrice: true } : {})}
              {...(whyable ? {
                onWhy: (asset) => handleWhyToggle(rowKey, asset),
                whyOpen: isWhyOpen,
                whyLabel: BATTLE_VIEW_COPY.why,
                // A4.3: the button's short name and the id root of the facts
                // that describe it (the price change, the proximity text).
                whyName: BATTLE_VIEW_COPY.whyName(leftAsset.symbol),
                whyId: `why-${rowKey}`,
                // The row hands the panel the SAME proximity it just
                // rendered — one call, one number (hazard 15).
                renderWhy: (proximity) => (
                  <WhyPanel
                    key={`why-${rowKey}`}
                    symbol={leftAsset.symbol}
                    state={selectWhyState(latestDecision, leftAsset.symbol, lastScoredAt)}
                    proximity={proximity}
                    entryPrice={leftAsset.openPrice ?? null}
                    heldSince={leftAsset.swappedInAt || agentBattle?.activatedAt || null}
                    // A2.1: the two scoring tiers as prices, from the row's own
                    // baseline and its own baseATR — never a third source.
                    lines={deriveTierPrices(leftAsset.thresholdBaseline, leftAsset.baseATR, leftAsset.direction)}
                    // A2.1b: only the sentences of THIS tier's deploy
                    // rationale that name THIS piece — else nothing.
                    deployPlan={deployPlan}
                    deployPlanForSymbol={selectDeployPlanForSymbol(deployPlan, leftAsset.symbol, tier.key)}
                    trades={selectTradesForSymbol(agentBattle?.trades, leftAsset.symbol)}
                    onAskFollowUp={handleAskFollowUp}
                    onReadFullCheck={handleReadFullCheck}
                    // A2.3: the count and the door that opens the filtered
                    // tape. The count is only computed for the OPEN row, and
                    // this panel only renders when its row is the open one.
                    mentionCount={mentionCount}
                    onScopeToPiece={handleScopeToPiece}
                    reducedMotion={reducedMotion}
                    headingId={`why-${rowKey}-heading`}
                  />
                ),
              } : {})}
            />
          );
          if (!controllerOn) return row;
          // Controller flag: the row's slot in the landing sequence
          // (top to bottom across tiers). The wrapper exists only to
          // host the wash; flag-off renders the bare row above.
          const rowIndex = activeTiers.slice(0, tierIndex).reduce((n, t) => n + t.slots, 0) + i;
          return (
            <div key={`${tier.key}-${i}`} style={{ position: 'relative' }}>
              {row}
              <LandingWash
                landingKey={landingKey}
                index={rowIndex}
                count={rowCount}
                reducedMotion={reducedMotion}
              />
            </div>
          );
        })}
      </div>
    ))}
    </>
  );
  const closedTrades = (
    <ClosedTradesSection
      closedTrades={agentBattle?.trades || []}
      defaultExpanded={false}
    />
  );

  // The chat — ONE AgentChat per layout (rulings §3.10): the desktop column
  // or the mobile sheet, never both, so `ensure-opener` fires once per mount
  // as today. Under the controller layout the chat renders alone (no
  // LiveActivityPanel, no sub-tabs).
  const chat = controllerOn ? (
    <AgentChat
      battleId={agentBattleId}
      agentId={agentBattle?.agentId}
      agentName={agentBattle?.agentContext?.agentName || 'Your Agent'}
      chatExchanges={chatExchanges}
      battleStatus={agentBattle?.status}
      statusFeed={statusFeed}
      trades={agentBattle?.trades || []}
      onSymbolClick={handleSymbolClick}
      onSwitchToGameTape={openGameTape}
      knownTickers={knownTickers}
      dailyGrades={agentBattle?.dailyGrades || {}}
      chatBudgetUsed={agentBattle?.chatBudgetUsed || 0}
      reviewBudgetUsed={agentBattle?.reviewBudgetUsed || 0}
      proposalHistory={agentBattle?.proposalHistory || []}
      composerPrefill={composerPrefill}
      onComposerPrefillConsumed={handleComposerPrefillConsumed}
      receipts={receipts}
      // A2.2: the tape's trade and check cards, merged into the chat's one
      // timeline. Built above from the subscribed doc; null flag-off.
      tapeEntries={tapeEntries}
      // A2.3: the scoped stream and the way out of it.
      scopeSymbol={scopeSymbol}
      onClearScope={handleClearScope}
      openCheck={openCheck}
      controllerLayout
      // Item 11: the controller's own line when a send never reaches the
      // model. Passed on the FLAG, beside the layout rather than through it.
      controllerCopy
      // Peek is the composer alone: the message list is collapsed so the
      // sheet can size itself to the handle + the composer, however tall the
      // draft grows (review CR3).
      // A2.4: at peek the chat is its composer — on both shells now, since the
      // desktop strip is the same collapsed state.
      listCollapsed={!chatOpen}
    />
  ) : null;

  // Game Tape, full-screen (A4): the shipped view over the page, with the
  // way back first in the tab order. Nothing in GameTapeView changes.
  const gameTapeOverlay = controllerOn && gameTapeOpen ? (
    <motion.div
      role="region"
      aria-label={BATTLE_VIEW_COPY.gameTape}
      data-game-tape="open"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={motionToken('fade', { reducedMotion })}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        background: cssVar('bg-dashboard'),
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: isDesktop ? '8px 24px 0' : '8px 12px 0',
        background: cssVar('bg-agent'),
      }}>
        <button
          ref={gameTapeBackRef}
          type="button"
          onClick={closeGameTape}
          data-game-tape-back="1"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: cssVar('teal'),
            fontSize: 13,
            fontWeight: 600,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 6px',
            minHeight: 44,
            borderRadius: 8,
          }}
        >
          <ChevronLeft size={16} />
          <span>{BATTLE_VIEW_COPY.gameTapeBack}</span>
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <GameTapeView
          agentBattle={agentBattle}
          agentBattleId={agentBattleId}
          statusFeed={statusFeed}
          feedBookmarks={feedBookmarks}
          tokens={tokens}
          onCitationTap={handleCitationTap}
        />
      </div>
    </motion.div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      // Desktop under the flag: the columns fill the viewport and the board
      // column scrolls, so the chat column has a bounded height. Mobile and
      // flag-off: the page scrolls as today.
      ...(controllerOn && isDesktop ? { height: viewportHeight } : { minHeight: '100vh' }),
      background: tokens.bgApp || '#0D0E12',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Matchups animated backdrop (flag-gated) — canvas particle/constellation
          network, teal/mint, pointer-events:none. Fixed full-viewport but below
          all interactive layers (canvas z1 < tab content z2 < chrome z3) and only
          mounted on the Matchups tab, so it never runs on Command/Game Tape. */}
      {isMatchupsBackdropOn() && (controllerOn ? !gameTapeOpen : activeTab === 'matchups') && (
        <BaggerBombBackground
          colors={BACKDROP_COLORS}
          lineColor={BACKDROP_LINE}
          glowColors={BACKDROP_GLOW}
          honorReducedMotion
        />
      )}

      {/* ═══ PERSISTENT TOP SECTION ═══ */}
      <div style={{
        flexShrink: 0,
        background: tokens.bgAgent || '#1C1A27',
        position: 'relative',
        zIndex: 3,
        ...(controllerOn && gameTapeOpen ? { visibility: 'hidden' } : {}),
      }}>
        {/* Back button bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isDesktop ? '8px 24px 0' : '8px 12px 0',
        }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: '#5eead4',
              fontSize: 13,
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 6px',
              minHeight: 44,
              borderRadius: 8,
            }}
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Agent Presence face was moved into ScoreHeader (next to the name/score
                it reflects). This chrome cluster keeps the watchlist chip + status dot. */}
            {/* Phase 5B2 — read-only equipped-watchlist indicator (Q7c).
                Sourced from the frozen agentContext.equippedWatchlist snapshot. */}
            {getEquippedWatchlistLabel(agentBattle?.agentContext?.equippedWatchlist) && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#5eead4',
                background: 'rgba(94,234,212,0.12)',
                border: '1px solid rgba(94,234,212,0.24)',
              }}>
                <Bookmark size={10} />
                {getEquippedWatchlistLabel(agentBattle.agentContext.equippedWatchlist)}
              </span>
            )}

            {/* Game Tape (A4, controller flag): the one header link. */}
            {controllerOn && (
              <button
                ref={gameTapeLinkRef}
                type="button"
                onClick={openGameTape}
                data-game-tape-link="1"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  minHeight: 32,
                  borderRadius: 8,
                  border: `1px solid rgba(${cssVar('teal-rgb')}, 0.24)`,
                  background: 'transparent',
                  color: cssVar('teal'),
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                }}
              >
                {BATTLE_VIEW_COPY.gameTape}
                {hasGameTapeDot && (
                  <span
                    aria-hidden="true"
                    data-game-tape-dot="1"
                    style={{ width: 6, height: 6, borderRadius: '50%', background: cssVar('teal') }}
                  />
                )}
              </button>
            )}

            {agentBattle?.status && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10,
                fontWeight: 600,
                color: agentBattle.status === 'active' ? '#5eead4' : tokens.textFaint,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: agentBattle.status === 'active' ? '#5eead4' : tokens.textFaint,
                }} />
                {agentBattle.status}
              </div>
            )}
          </div>
        </div>

        {/* Score header */}
        <ScoreHeader
          agentBattle={agentBattle}
          tokens={tokens}
          isDesktop={isDesktop}
          playerScore={displayPlayerScore}
          opponentScore={displayOpponentScore}
          statusFeed={statusFeed}
          turnLine={turnLine}
          landingKey={landingKey}
          rowCount={rowCount}
          reducedMotion={reducedMotion}
          onOpenBook={controllerOn ? handleBookWhyToggle : null}
          bookOpen={bookWhyOpen}
          bookName={controllerOn ? BATTLE_VIEW_COPY.whyBookName : null}
        />

        {/* Book-level Why? (Phase A, controller flag): the latest decision for
            the whole book, then This turn (A3), then the one door. */}
        {controllerOn && (
          <AnimatePresence initial={false}>
            {bookWhyOpen ? (
              <WhyPanel
                key="book"
                symbol={null}
                state={selectWhyState(latestDecision, null, lastScoredAt)}
                deployPlan={deployPlan}
                onAskFollowUp={handleAskFollowUp}
                onCloseBook={handleCloseBookWhy}
                reducedMotion={reducedMotion}
                headingId="why-book-heading"
              />
            ) : null}
          </AnimatePresence>
        )}

        {/* Film Room banner — appears once the first daily review has been filed */}
        {onOpenFilmRoom && Array.isArray(agentBattle?.dailyReviews) && agentBattle.dailyReviews.length >= 1 && (
          <FilmRoomBanner
            onOpen={() => onOpenFilmRoom(agentBattle)}
            dailyReviewCount={agentBattle.dailyReviews.length}
            status={agentBattle.status}
            tokens={tokens}
          />
        )}

        {/* Tab bar — not rendered under the controller flag (A4): the board
            and the chat share the page; Game Tape is the header link above. */}
        {!controllerOn && (
          <TabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            hasCommandDot={hasCommandDot}
            commandDotColor={commandDotColor}
            hasGameTapeDot={hasGameTapeDot}
            isDesktop={isDesktop}
          />
        )}
      </div>

      {controllerOn ? (
        /* ═══ THE CONTROLLER LAYOUT (A4) — board and chat, no tab bar ═══
           Desktop: board left (~60%), the chat right (~40%), both under the
           score header; the board column scrolls. Mobile: header, This turn,
           the board as the page; the chat as a non-modal sheet (ChatSheet). */
        <div
          data-layout={isDesktop ? 'desktop' : 'mobile'}
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'row',
            // A2.4: collapsed, the desktop chat column sits on its own line
            // beneath a full-width board — as a COLUMN, not as a wrapped row
            // (review RB-F12, then RA-F7). Either way the chat keeps ONE
            // parent across the collapse, which is the property that matters
            // (see the column); the direction is how the two lines are sized.
            //
            // Wrapping got the picture and lost the scrolling. A multi-line
            // flex container sizes each line to its CONTENT (CSS Flexbox
            // §9.4), not to the container, so the board's line grew to the
            // board's full height, the board's own `overflow-y: auto` scroller
            // inside it never had a bounded height to scroll within, and the
            // PAGE scrolled instead — carrying the strip, and the unread dot
            // the seed puts on it, below the fold. `alignContent:'flex-start'`
            // fixed only the opposite case, a board shorter than the viewport.
            //
            // A column is single-line: the board takes `1 1 0%` of a definite
            // height with `minHeight: 0`, so its inner scroller bounds; the
            // strip takes `0 0 auto` and stays pinned at the bottom of the
            // viewport, which is the ruled picture. Children stretch to the
            // full width on the cross axis, so nothing needs a width.
            //
            // jsdom does no layout, so what the rows below can hold is the
            // style contract — the direction and both children's flex — not
            // the pixels. The pixels want the founder's smoke.
            ...(isDesktop && !chatOpen ? { flexDirection: 'column' } : {}),
            position: 'relative',
            zIndex: 2,
            ...(gameTapeOpen ? { visibility: 'hidden' } : {}),
          }}
        >
          {/* The board column. A2.4: on the desktop it takes the FULL width
              while the chat is collapsed, and carries the strip at its
              bottom — so the collapse is a real gain of board, not a gap
              where the column was. The board itself keeps its own scroller
              inside, so the strip stays put while the board scrolls. */}
          <div
            data-board="1"
            style={isDesktop ? {
              // Open, the board is the wide side of a row. Collapsed, the row
              // IS a column and the board is its growing item: `1 1 0%` plus
              // `minHeight: 0` is what gives the scroller inside it a definite
              // height to bound against (review RA-F7). `0 0 100%` here would
              // be a basis of 100% of the HEIGHT under a column direction.
              flex: chatOpen ? '3 1 0%' : '1 1 0%',
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            } : {
              flex: '1 1 auto',
              minWidth: 0,
              paddingBottom: SHEET_PEEK_PX + 32,
            }}
          >
            <div
              data-board-scroll={isDesktop ? '1' : undefined}
              style={isDesktop ? { flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 24 } : undefined}
            >
              {/* This turn (Phase A) — its one home, above the board. */}
              {thisTurnStrip}
              {boardRows}
              {closedTrades}
            </div>
          </div>
          {isDesktop && (
            /* THE CHAT'S ONE HOME ON THE DESKTOP (A2.4, review L2-F1 / L5-F7).
               Collapsed and open are the SAME element with different chrome
               and a different flex basis — never two tree positions. React
               reconciles by position, so rendering `{chat}` in two places made
               every collapse and every expand a full unmount: the typed draft,
               the optimistic bubbles of a send still in flight, the error
               banner and the scope's own scroll memory all went with it. A4
               paid for the draft-survival rule explicitly (F13); a one-click
               control that discards a half-typed message is not a layout
               choice.

               Collapsed, the row wraps: the board takes the whole first line
               and this column takes the whole second, which is the ruled
               layout (the board at full width, the strip beneath it). */
            <div
              id={CHAT_COLUMN_ID}
              data-chat-column="1"
              data-chat-collapsed={chatOpen ? 'false' : 'true'}
              style={{
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                ...(chatOpen ? {
                  flex: '2 1 0%',
                  borderLeft: `1px solid rgba(${cssVar('scrim-rgb')}, 0.07)`,
                } : {
                  // Collapsed: hug the strip's own content at the bottom of
                  // the column, and drop the border that separated two side-
                  // by-side panes — there is nothing to its left any more.
                  flex: '0 0 auto',
                  width: '100%',
                }),
              }}
            >
              {chatOpen ? (
                /* The way out of the column, named for what it does next. */
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px 0' }}>
                  <button
                    ref={collapseControlRef}
                    type="button"
                    onClick={handleCollapseChat}
                    aria-expanded="true"
                    aria-controls={CHAT_COLUMN_ID}
                    aria-label={BATTLE_VIEW_COPY.sheetCollapse}
                    data-chat-collapse="1"
                    style={{
                      background: 'transparent',
                      border: `1px solid rgba(${cssVar('scrim-rgb')}, 0.12)`,
                      borderRadius: 8,
                      color: cssVar('text-secondary'),
                      cursor: 'pointer',
                      width: 32,
                      height: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      lineHeight: 1,
                    }}
                  >
                    <span aria-hidden="true">▾</span>
                  </button>
                </div>
              ) : (
                <PeekStrip
                  expandRef={expandControlRef}
                  controlsId={CHAT_COLUMN_ID}
                  turnText={turnLine?.text ?? null}
                  line={peekLine}
                  unread={Boolean(hasCommandDot)}
                  unreadColor={hasPendingProposal ? cssVar('amber') : cssVar('teal')}
                  onExpand={handleExpandChat}
                />
              )}
              {chat}
            </div>
          )}
        </div>
      ) : (
      /* ═══ TAB CONTENT (flag-off: the shipped tabbed screen) ═══ */
      <div style={activeTab === 'matchups' ? {
        flex: 1,
        overflowY: 'auto',
        paddingBottom: 100,
        position: 'relative',
        zIndex: 2,
      } : {
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }}>
        <AnimatePresence mode="wait">
          {/* ── Matchups Tab ──────────────────────────────────────────── */}
          {activeTab === 'matchups' && (
            <motion.div
              key="matchups"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              {/* This turn (Phase A, controller flag) — above the board. */}
              {thisTurnStrip}
              {boardRows}

              {/* Closed trades */}
              {closedTrades}
            </motion.div>
          )}

          {/* ── Command Center Tab ────────────────────────────────────── */}
          {activeTab === 'command' && (
            <motion.div
              key="command"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <AgentChat
                battleId={agentBattleId}
                agentId={agentBattle?.agentId}
                agentName={agentBattle?.agentContext?.agentName || 'Your Agent'}
                chatExchanges={chatExchanges}
                battleStatus={agentBattle?.status}
                statusFeed={statusFeed}
                trades={agentBattle?.trades || []}
                onSymbolClick={handleSymbolClick}
                onSwitchToGameTape={() => setActiveTab('gametape')}
                knownTickers={knownTickers}
                // Phase 6: review-mode props
                dailyGrades={agentBattle?.dailyGrades || {}}
                chatBudgetUsed={agentBattle?.chatBudgetUsed || 0}
                reviewBudgetUsed={agentBattle?.reviewBudgetUsed || 0}
                // pendingProposal prop removed (2026-05-19): dropped on the floor by
                // AgentChat pending post-launch revival of the proposal flow.
                // See AUTHORITY_MODE_POST_LAUNCH_BACKLOG.md.
                proposalHistory={agentBattle?.proposalHistory || []}
                // Phase A (controller flag): the Why? door's prefill. Null
                // flag-off — the chat never sees the prop.
                composerPrefill={controllerOn ? composerPrefill : null}
                onComposerPrefillConsumed={controllerOn ? handleComposerPrefillConsumed : null}
                receipts={receipts}
                // A2.2: null flag-off, so this shipped mount keeps the slim
                // trade line byte for byte (the tabbed tree is not rendered
                // under the flag — the controller layout replaces it).
                tapeEntries={controllerOn ? tapeEntries : null}
              />
            </motion.div>
          )}

          {/* ── Game Tape Tab ─────────────────────────────────────────── */}
          {activeTab === 'gametape' && (
            <motion.div
              key="gametape"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
              style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <GameTapeView
                agentBattle={agentBattle}
                agentBattleId={agentBattleId}
                statusFeed={statusFeed}
                feedBookmarks={feedBookmarks}
                tokens={tokens}
                onCitationTap={handleCitationTap}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* The mobile sheet sits OUTSIDE the layout container (review CR1): a
          `position: fixed` element inside that `z-index: 2` stacking context
          would be painted over by the header (`z-index: 3`) at the full
          detent. Here it stacks at the root, above the header, below the
          Game Tape overlay — and hides with the page while the tape is up. */}
      {controllerOn && !isDesktop && (
        <ChatSheet
          detent={sheet.detent}
          onDetentChange={sheet.setDetent}
          returnFocusRef={sheet.returnFocusRef}
          viewportHeight={viewportHeight}
          turnText={turnLine?.text ?? null}
          peekLine={peekLine}
          unread={Boolean(hasCommandDot)}
          unreadColor={hasPendingProposal ? cssVar('amber') : cssVar('teal')}
          reducedMotion={reducedMotion}
          hidden={gameTapeOpen}
        >
          {chat}
        </ChatSheet>
      )}

      {gameTapeOverlay}

      {/* ═══ MODALS ═══ */}
      <DebateModal
        isOpen={debateOpen}
        onClose={() => setDebateOpen(false)}
        battleId={agentBattleId}
        targetSymbol={debateSymbol}
        tokens={tokens}
      />

      <ForgeCitationCard
        isOpen={citationOpen}
        onClose={() => setCitationOpen(false)}
        ruleId={citationRuleId}
        battleData={agentBattle}
        statusFeed={statusFeed}
        tokens={tokens}
      />

      {stableResearchAsset && (
        <AssetResearchModal
          asset={stableResearchAsset}
          onClose={() => setResearchAsset(null)}
          showActionButton={false}
          isGameContext={true}
          version={2}
          defaultTab="baggerbomb"
          defaultTimeframe="bomb"
          wsPrice={effectivePrices[stableResearchAsset?.symbol]}
        />
      )}

      <TermResearchModal
        termToken={selectedTerm}
        isOpen={!!selectedTerm}
        onClose={() => setSelectedTerm(null)}
      />


      {breakdownAsset && (
        <ScoreBreakdownPopover
          asset={{
            symbol: breakdownAsset.symbol,
            gain: breakdownAsset.priceChange || 0,
            threshold: thresholds[breakdownAsset.symbol]?.threshold || breakdownAsset.baseATR || 2.5,
            // P4 flat6: the per-asset override (tournament docs) wins; tiered
            // assets never carry it — resolution unchanged for them.
            tierMultiplier: breakdownAsset.tierMultiplier ?? (CONVICTION_MULTIPLIERS[breakdownAsset.tier] || 1.0),
            baggerBombs: breakdownAsset.badges?.filter(b =>
              b === 'bagger' || b === 'doubleBagger' || b === 'tenBagger'
            ).length || 0,
            busts: breakdownAsset.badges?.filter(b =>
              b === 'bust' || b === 'crash' || b === 'meltdown'
            ).length || 0,
            basePoints: Math.round((breakdownAsset.priceChange || 0) * 10 * (breakdownAsset.tierMultiplier ?? (CONVICTION_MULTIPLIERS[breakdownAsset.tier] || 1.0))),
            // P4 (companion c): badge values sourced from the canonical
            // constants instead of inline literals — value-identical today,
            // drift-proof tomorrow (the scoring-copy lesson, BUILD_RULES §4).
            baggerBombPoints: breakdownAsset.badges?.reduce((sum, b) => {
              if (b === 'bagger' || b === 'doubleBagger' || b === 'tenBagger') return sum + THRESHOLD_POINTS[b];
              return sum;
            }, 0) || 0,
            bustPoints: breakdownAsset.badges?.reduce((sum, b) => {
              if (b === 'bust' || b === 'crash' || b === 'meltdown') return sum + THRESHOLD_POINTS[b];
              return sum;
            }, 0) || 0,
            totalScore: breakdownAsset.points || 0,
            startingPrice: startingPrices?.[breakdownAsset.symbol] || breakdownAsset.swapPrice || 0,
            currentPrice: breakdownAsset.currentPrice || 0,
          }}
          events={[]}
          onClose={() => setBreakdownAsset(null)}
          entryPrice={startingPrices?.[breakdownAsset.symbol] || breakdownAsset.swapPrice || 0}
          battleCreatedAt={agentBattle?.createdAt || null}
          priceHistory={[]}
          bankedBadgePoints={0}
        />
      )}
    </div>
  );
}
