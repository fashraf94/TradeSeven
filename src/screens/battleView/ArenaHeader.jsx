// src/screens/battleView/ArenaHeader.jsx
//
// A3.0 — THE SCORE HEADER BECOMES THE ARENA (D-96).
//
// The shipped ScoreHeader in AgentBattleScreen.jsx is untouched and still
// renders pane-off, byte for byte (AgentBattleScreen.paneOff.golden.test.jsx).
// This is its replacement under the character-pane flag: the same four facts —
// the agent's mark and score, the day, the CPU's score, the turn line — laid
// out as a contest rather than as a status bar.
//
// WHAT MAKES IT AN ARENA, and what each choice is bound to:
//
// • TWO SIDES, TWO COLOURS. The player's side is --ft-teal (the colour its
//   score has worn since the screen shipped) and the CPU's is --ft-copper, a
//   token this commit adds from a value the repo already carries twice in
//   legacy JS. Deliberately NOT --ft-red: the CPU is an opponent, not an error,
//   and red already means loss on the rows below.
//
// • THE BAR IS THE SEAM. The tint of each side and the width of each half of
//   the bar come from ONE number — computeTugOfWarWidth, the shipped helper,
//   now shared (§9 display-agreement). The mock drew its own arithmetic for the
//   arena; two derivations of one displayed quantity is exactly the bug family
//   §9 exists to close, so the mock's is not built.
//
// • `VS` IN THE CENTRE. The accessible order is player → VS → CPU by DOM order,
//   which is both the reading order and the order the numbers mean. The centre
//   slot also carries the day label and the trade count, as the shipped header's
//   centre does.
//
// • THE NUMBERS FIRST. The brief asks for the loudest thing on the page that
//   still reads its numbers first: the scores are the largest type here, the
//   chrome (name, day, hint) is 10–12px, and nothing animates on a state.
//
// • THE STARFIELD IS THE FLOOR (hazard 39). The shipped header paints an opaque
//   background over the existing BaggerBombBackground canvas. This one lets that
//   canvas through — a translucent scrim plus the two side tints, no background
//   of its own — and it does NOT mount a second starfield. The mock's per-frame
//   CSS starfield is prototype chrome.
//
// • THE MARK IS STILL (D-91, hazard 41). AgentPresenceMount at reactivityLevel
//   'static': one painted frame, no rAF, no idle, no breath, and its events
//   withheld. It keeps the agent's DNA accent, which is a per-agent document
//   value no token can express — the only colour on this surface that is not a
//   token, and it is not authored here.
//
// • THE BOOK SURFACE IS THE SHIPPED ONE. Same role/tabIndex/aria-expanded, same
//   `data-why-book-toggle` the panel's close queries to hand focus back
//   (AgentBattleScreen handleCloseBookWhy), same aria-label + aria-describedby
//   triple. Moving the header must not silently retire the book (D-89). What is
//   NEW is that a sighted player can now see it: `Tap for the book`, desktop
//   only.
//
// MOTION. The mount-in stagger is the one transition, an identifier from
// motionToken so reduced motion resolves to `instant` (BUILD_RULES §11); there
// is no other animation on this surface. The bar's width tweens through the same
// token rather than the shipped raw spring literal. The turn line is rehosted
// unchanged, with the same props, so its own landing tick is the last thing that
// moves in a check landing, exactly as in A1.
//
// TOKENS ONLY. Every colour is cssVar() or rgba(var(--ft-*-rgb), a). This file
// is on tokens.guard.test.js's GUARDED_FILES and motion.guard.test.js's list
// from birth, with both baselines in this commit (hazard 34).

import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import AnimatedScore from '../../components/shared/AnimatedScore';
import AgentPresenceMount from '../../components/AgentPresence/AgentPresenceMount';
import { isAgentPresenceOn } from '../../config/featureFlags';
import { cssVar } from '../../theme/cssTokens';
import { motionToken } from '../../theme/motion';
import TurnLine from './TurnLine';
import { computeTugOfWarWidth } from './computeTugOfWarWidth';
import { BATTLE_VIEW_COPY } from './battleViewCopy';

/**
 * The two-tint wash behind the header. One gradient, hinged on the seam, so the
 * colours meet exactly where the bar's divider sits. Alpha is low on purpose —
 * the starfield underneath is the floor, not a backdrop to bury.
 */
function arenaWash(seamPct) {
  const me = 'var(--ft-teal-rgb)';
  const cpu = 'var(--ft-copper-rgb)';
  return `linear-gradient(90deg,`
    + ` rgba(${me}, 0.20) 0%,`
    + ` rgba(${me}, 0.05) ${Math.max(0, seamPct - 8)}%,`
    + ` rgba(${me}, 0) ${seamPct}%,`
    + ` rgba(${cpu}, 0.05) ${Math.min(100, seamPct + 8)}%,`
    + ` rgba(${cpu}, 0.20) 100%)`;
}

export default function ArenaHeader({
  agentBattle,
  isDesktop = false,
  playerScore,
  opponentScore,
  dayLabel = '',
  turnLine = null,
  landingKey = null,
  rowCount = 0,
  reducedMotion = false,
  onOpenBook = null,
  bookOpen = false,
  bookName = null,
}) {
  const myScore = playerScore ?? (agentBattle?.scoreState?.currentScore || 0);
  const oppScore = opponentScore ?? (agentBattle?.scoreState?.opponentScore || 0);
  const agentName = agentBattle?.agentContext?.agentName || 'Your Agent';
  const tradeCount = agentBattle?.scoreState?.tradeCount || 0;

  // THE one number. The tint's hinge and both halves of the bar read it.
  const myWidth = computeTugOfWarWidth(myScore, oppScore);
  const isLeading = myScore >= oppScore;

  const transition = motionToken('smooth', { reducedMotion });
  const bookable = typeof onOpenBook === 'function';
  const scoreSize = isDesktop ? 40 : 30;

  return (
    <motion.div
      data-arena-header="1"
      initial={reducedMotion ? false : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: isDesktop ? '14px 24px 12px' : '10px 16px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: isDesktop ? 8 : 6,
      }}
    >
      {/* The wash. Hazard 39: no background of its own and no second starfield —
          the existing canvas shows through both of these layers. */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: arenaWash(myWidth) }} />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '55%',
          background: `linear-gradient(180deg, rgba(var(--ft-shadow-rgb), 0) 0%, rgba(var(--ft-shadow-rgb), 0.55) 100%)`,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: isDesktop ? 8 : 6 }}>
        {/* Names + scores — the book's Why? tap surface, with the shipped
            attribute contract. Absent (and byte-identical) when onOpenBook is
            null, exactly as ScoreHeader's is. */}
        <div
          {...(bookable ? {
            role: 'button',
            tabIndex: 0,
            'aria-expanded': bookOpen ? 'true' : 'false',
            // D-89: the panel's close finds this control by attribute to hand
            // focus back. Same key, same position after aria-expanded, as the
            // shipped header — the controller suite counts tap surfaces by the
            // rendered attribute ORDER and that triple is the contract.
            'data-why-book-toggle': '1',
            ...(bookName ? { 'aria-label': bookName, 'aria-describedby': 'why-book-agent why-book-day why-book-cpu' } : {}),
            onClick: onOpenBook,
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenBook(); }
            },
          } : {})}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: isDesktop ? 20 : 10,
            ...(bookable ? { cursor: 'pointer' } : {}),
          }}
        >
          {/* Player — the mark, then the name, then the score. */}
          <div
            {...(bookName ? { id: 'why-book-agent' } : {})}
            style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? 12 : 8, minWidth: 0 }}
          >
            {isAgentPresenceOn() && agentBattle && (
              <AgentPresenceMount
                surface="duel"
                agent={agentBattle}
                duel={{ playerScore: myScore, opponentScore: oppScore, statusFeed: null }}
                size={isDesktop ? 56 : 40}
                enableEnvironment={false}
                // D-91: still, and deaf to the raw feed. The mount wires the two
                // together — see its header note.
                reactivityLevel="static"
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
              <span
                style={{
                  fontSize: isDesktop ? 11 : 10,
                  fontWeight: 700,
                  color: cssVar('teal'),
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {agentName}
              </span>
              <AnimatedScore value={myScore} defaultColor={cssVar('teal')} size={scoreSize} />
            </div>
          </div>

          {/* Centre — VS, then the day and the trade count. The accessible
              order is player → VS → CPU because that is the DOM order. */}
          <div
            {...(bookName ? { id: 'why-book-day' } : {})}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
          >
            <span
              data-arena-vs="1"
              style={{
                fontSize: isDesktop ? 11 : 10,
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: cssVar('text-muted'),
              }}
            >
              {BATTLE_VIEW_COPY.arenaVs}
            </span>
            {dayLabel && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: cssVar('text-muted'),
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                }}
              >
                {dayLabel}
              </span>
            )}
            {tradeCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: cssVar('text-muted') }}>
                <Activity size={9} />
                <span>{tradeCount} trade{tradeCount !== 1 ? 's' : ''}</span>
              </span>
            )}
          </div>

          {/* CPU — the copper side. */}
          <div
            {...(bookName ? { id: 'why-book-cpu' } : {})}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
          >
            <span
              style={{
                fontSize: isDesktop ? 11 : 10,
                fontWeight: 700,
                color: cssVar('copper'),
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 2,
              }}
            >
              CPU
            </span>
            <AnimatedScore value={oppScore} defaultColor={cssVar('copper')} size={scoreSize} />
          </div>
        </div>

        {/* The seam. Both halves read myWidth; the divider sits on it. */}
        <div
          data-arena-bar="1"
          // The seam as a NUMBER, so a test (and the jsdom suites) can read the
          // one derivation directly rather than inferring it from a gradient
          // string or from a framer `animate` value, which SSR does not paint.
          data-seam-pct={Math.round(myWidth)}
          aria-hidden="true"
          style={{
            position: 'relative',
            width: '100%',
            height: isDesktop ? 8 : 7,
            borderRadius: 4,
            background: `rgba(var(--ft-shadow-rgb), 0.55)`,
            boxShadow: `inset 0 0 0 1px rgba(var(--ft-scrim-rgb), 0.10)`,
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          <motion.div
            // The number the BAR was given, stated (review lens 4 F7). SSR does
            // not paint a framer `animate` value, so without this the bar's own
            // width was readable by no test and a second derivation used only
            // here survived the §9 row that claims there is one seam.
            data-bar-pct={Math.round(myWidth)}
            animate={{ width: `${myWidth}%` }}
            transition={transition}
            style={{
              height: '100%',
              borderRadius: '4px 0 0 4px',
              background: `linear-gradient(90deg, rgba(var(--ft-teal-rgb), ${isLeading ? 0.35 : 0.2}), rgba(var(--ft-teal-rgb), ${isLeading ? 1 : 0.55}))`,
            }}
          />
          <div style={{ width: 2, height: '100%', flexShrink: 0, background: `rgba(var(--ft-scrim-rgb), 0.55)` }} />
          <div
            style={{
              flex: 1,
              height: '100%',
              borderRadius: '0 4px 4px 0',
              background: `linear-gradient(90deg, rgba(var(--ft-copper-rgb), ${!isLeading ? 1 : 0.55}), rgba(var(--ft-copper-rgb), ${!isLeading ? 0.35 : 0.2}))`,
            }}
          />
        </div>

        {/* The turn line, rehosted unchanged — same props, same landing tick.
            The book hint rides beside it on desktop only. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 14 }}>
          <TurnLine turn={turnLine} landingKey={landingKey} rowCount={rowCount} reducedMotion={reducedMotion} />
          {isDesktop && bookable && (
            <span
              data-arena-book-hint="1"
              style={{ fontSize: 10.5, color: cssVar('text-muted'), whiteSpace: 'nowrap' }}
            >
              {BATTLE_VIEW_COPY.arenaBookHint}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
