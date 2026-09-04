// src/screens/battleView/CharacterAvatar.jsx
//
// A3.1 — THE CHARACTER ON THE BOARD (D-91), AND ITS ONE LINE (D-98).
//
// The agent stops being decoration on the score header and becomes the one
// persistent thing on the board that is not a row: a mark, bottom-right, that
// opens the pane. It replaces the bug-report button's spot (A3.5, D-95) and,
// under the pane flag, the footer strip and the drawer both retire behind it
// (D-93).
//
// THE THREE HONESTY RULES THIS FILE IS BUILT ON (brief §4):
//
//   1. IT NEVER MOVES BETWEEN EVENTS. There is no idle animation here — no
//      pulse, no breath, no blink, no glow that cycles, and no CSS keyframe.
//      The presence face is mounted at reactivityLevel 'static' (one painted
//      frame, no rAF) with its events withheld, so it cannot move even if the
//      raw statusFeed does. The ONLY animation in this file is the bubble's
//      arrival fade, keyed on the entry's id so it plays once per genuinely new
//      entry and then sits still through any number of re-renders (D-97).
//
//   2. THE BUBBLE MIRRORS THE TAPE. Every string in it comes whole out of
//      deriveBubble, which takes them from the helpers the stream itself
//      renders. This component chooses no words. NO TIMER CAN CREATE A BUBBLE:
//      there is no interval, no timeout and no clock read in this file — the
//      bubble is a pure function of the `bubble` prop, and that prop changes
//      only when the tape does.
//
//   3. UNREAD MEANS UNSEEN TAPE ENTRIES. The count is handed in already
//      computed from what the tape RENDERS (D-88); nothing here re-derives it,
//      and it is never the raw feed's length.
//
// THE BUBBLE IS SHARP AND UNSTRIPED (D-98). No tail, no side stripe, no
// asymmetric corner — the mock's `14px 14px 4px 14px` and its 3px coloured
// right edge are superseded. The kind carries its colour as TEXT, in the
// eyebrow, from the same map the stream's cards read. There is no radius token
// in this repo (grep -i radius src/theme/ is empty), so the corner is the
// literal below, written once.
//
// LAYOUT. Absolutely positioned inside the board column, which the screen makes
// `position: relative` and pads at the bottom so the mark never rests over a
// row's tap targets. The hit target is 48px at minimum on both shells (brief
// §2.1) even when the painted face is smaller.

import React from 'react';
import { motion } from 'framer-motion';
import AgentPresenceMount from '../../components/AgentPresence/AgentPresenceMount';
import { isAgentPresenceOn } from '../../config/featureFlags';
import { cssVar } from '../../theme/cssTokens';
import { motionToken } from '../../theme/motion';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

/**
 * THE ONE RADIUS. D-98 asks for "the smallest radius the tokens allow"; no
 * radius token exists, so this is the literal, in one place, with the ruling
 * beside it. If a radius token ever lands, this constant is the single edit.
 */
const BUBBLE_RADIUS = 4;

/** The hit target floor (brief §2.1). The painted face may be smaller. */
const TAP_MIN = 48;

export default function CharacterAvatar({
  agentBattle = null,
  bubble = null,
  unread = 0,
  onOpen,
  isDesktop = false,
  reducedMotion = false,
}) {
  const count = Number.isFinite(unread) && unread > 0 ? unread : 0;
  // NOTHING NEW → THE AVATAR STANDS ALONE (brief §5, state 8). The bubble is
  // not a persistent caption; it is the arrival of an entry the reader has not
  // seen.
  const showBubble = count > 0 && bubble && bubble.line;
  const faceSize = isDesktop ? 44 : 40;
  const fade = motionToken('fade', { reducedMotion });

  return (
    <div
      data-character-avatar="1"
      style={{
        position: 'absolute',
        right: isDesktop ? 16 : 12,
        bottom: isDesktop ? 16 : 14,
        zIndex: 4,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {showBubble && (
        <motion.button
          type="button"
          // ONE FADE PER ENTRY. The key is the tape entry's id, so a re-render
          // with the same newest entry re-uses this element and replays
          // nothing; a genuinely new entry mounts a new one and it fades in
          // once (the LandingWash idiom). Reduced motion skips `initial`
          // entirely, so there is no animation to sit through.
          key={bubble.id}
          data-character-bubble="1"
          data-bubble-kind={bubble.eyebrow || 'none'}
          aria-label={COPY.paneBubbleName(bubble.eyebrow)}
          onClick={onOpen}
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fade}
          style={{
            pointerEvents: 'auto',
            maxWidth: isDesktop ? 300 : 210,
            minWidth: 0,
            textAlign: 'left',
            cursor: 'pointer',
            // SHARP AND UNSTRIPED (D-98): one radius, no border on any single
            // side, no tail element anywhere in this subtree.
            borderRadius: BUBBLE_RADIUS,
            border: `1px solid rgba(var(--ft-scrim-rgb), 0.12)`,
            background: `rgba(var(--ft-shadow-rgb), 0.82)`,
            padding: '7px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            marginBottom: 4,
          }}
        >
          {bubble.eyebrow && (
            <span
              data-bubble-eyebrow="1"
              style={{
                // The kind's colour as TEXT — the stream's own value, imported
                // rather than restated (hazard 43).
                color: bubble.eyebrowColor,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              }}
            >
              {bubble.eyebrow}
            </span>
          )}
          <span
            data-bubble-line="1"
            style={{
              // ONE LINE, TRUNCATED — by the reader's width, not by a character
              // count chosen here (derivePeekLine's rule).
              color: cssVar('text-secondary'),
              fontSize: 12,
              lineHeight: 1.35,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
          >
            {bubble.line}
          </span>
        </motion.button>
      )}

      <button
        type="button"
        data-character-mark="1"
        data-unread={count > 0 ? String(count) : undefined}
        aria-label={COPY.paneOpenName(count)}
        onClick={onOpen}
        style={{
          pointerEvents: 'auto',
          position: 'relative',
          minWidth: TAP_MIN,
          minHeight: TAP_MIN,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isAgentPresenceOn() && agentBattle ? (
          <AgentPresenceMount
            surface="duel"
            agent={agentBattle}
            duel={{
              playerScore: agentBattle?.scoreState?.currentScore || 0,
              opponentScore: agentBattle?.scoreState?.opponentScore || 0,
              // WITHHELD (hazard 41). The mount drops events for a static face
              // anyway; passing null says so at the call site too.
              statusFeed: null,
            }}
            size={faceSize}
            enableEnvironment={false}
            reactivityLevel="static"
          />
        ) : (
          // The presence flag is off in every golden and render harness, and
          // could be off in production. The mark still has to be a mark: a
          // still disc in the agent's own accent, with no motion of any kind.
          <span
            aria-hidden="true"
            style={{
              width: faceSize,
              height: faceSize,
              borderRadius: '50%',
              background: `rgba(var(--ft-teal-rgb), 0.16)`,
              border: `1px solid rgba(var(--ft-teal-rgb), 0.45)`,
            }}
          />
        )}
        {count > 0 && (
          <span
            data-unread-badge="1"
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              paddingLeft: 4,
              paddingRight: 4,
              borderRadius: 8,
              background: cssVar('teal'),
              color: cssVar('bg-agent'),
              fontSize: 10,
              fontWeight: 800,
              lineHeight: '16px',
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count}
          </span>
        )}
      </button>
    </div>
  );
}
