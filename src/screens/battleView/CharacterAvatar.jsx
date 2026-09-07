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
// LAYOUT — AND IT DIFFERS BY SHELL (F3, the founder's smoke).
//
// DESKTOP: absolutely positioned inside the board column, which the screen
// makes `position: relative`. The column is itself the scroller's parent, so
// the mark stays put while the board scrolls beneath it.
//
// MOBILE: FIXED TO THE VISUAL VIEWPORT. The phone's board column is not a
// scroller — the PAGE scrolls — so an absolutely-positioned mark hung at
// `bottom` sat at the bottom of the board's CONTENT, off screen until the
// player scrolled to the very end. That is what the founder saw. `fixed` puts
// it where the mark has to be: the one door back into the pane, always
// reachable. `viewportInset` is the visual-viewport half of it (A2.4's rule,
// one step further on) — `fixed` anchors to the LAYOUT viewport, so without
// the offset the mark hides behind iOS's toolbar.
//
// The bubble is a sibling INSIDE this container, so it travels with the mark by
// construction, and the hit target is 48px at minimum on both shells (brief
// §2.1) even when the painted face is smaller.
//
// WHAT AVATAR_CLEARANCE_PX BUYS CHANGED WITH F3, and the old comment claimed
// more than it now delivers (the review caught it). While the mark was
// absolutely positioned at the end of the board's content, the board's bottom
// padding cleared it exactly. Fixed to the viewport, that padding only
// guarantees the SCROLL END: mid-scroll, whatever row happens to sit at the
// viewport's bottom is under the mark's 48px box. The damage is bounded — the
// container is `pointerEvents: 'none'` and only the button and the bubble take
// pointer events, so it is the mark's own footprint and not a full-width
// blocker — but brief §2.1's promise is no longer delivered on the phone at
// every scroll position. That is the cost of the founder's `fixed` ruling,
// written down rather than left as a comment that says otherwise.

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
  // The pair the BOARD IS SHOWING (review lens 1 F6). The presence face derives
  // its standing from these, and presenceBinding's Gate 1 forbids a parallel
  // recompute: reading scoreState.currentScore here while the arena header two
  // inches away renders the live pair put two marks on one page reading
  // different numbers — in sign, not just in magnitude.
  playerScore = null,
  opponentScore = null,
  // The screen focuses this node after a collapse (review lens 2 F3): the mark
  // the player pressed to open the pane is gone by then, so the hand-off has to
  // reach the one that came back.
  markRef = null,
  bubble = null,
  unread = 0,
  onOpen,
  // The BUBBLE opens the conversation, not the remembered section (the seed:
  // "tap either → the pane, count cleared"). For a TAPE bubble that is exact:
  // it names an entry, so landing anywhere but the stream holding it would show
  // a section the player did not ask for and leave the count standing.
  //
  // A3.6's bagger bubble is `standalone` and names no tape entry, so this
  // reasoning does not cover it (the review caught the comment claiming it
  // did). It still opens Chat, deliberately: the bagger's own record is the
  // row's footer, which is already on screen behind the pane, and Chat is where
  // the character's next word about it will land. Its own source clears it when
  // the pane opens; there is no count to clear.
  onOpenBubble,
  isDesktop = false,
  // F3: the px of layout viewport hidden behind browser chrome, from
  // viewportInsetFrom(). Mobile only — desktop is absolute inside the column
  // and has no viewport to miss.
  viewportInset = 0,
  reducedMotion = false,
}) {
  const count = Number.isFinite(unread) && unread > 0 ? unread : 0;
  // NOTHING NEW → THE AVATAR STANDS ALONE (brief §5, state 8). The bubble is
  // not a persistent caption; it is the arrival of an entry the reader has not
  // seen.
  // A3.6 (D-97): a STANDALONE bubble has no unread count to be gated on. The
  // bagger line is not a tape entry — it is keyed on the persisted crossing —
  // so `count > 0` would silence the loudest thing that can happen to a piece
  // whenever the tape happened to be caught up. Its own source clears it (the
  // pane opening), exactly as the count clears this one.
  const showBubble = Boolean(bubble && bubble.line && (count > 0 || bubble.standalone === true));
  const faceSize = isDesktop ? 44 : 40;
  const fade = motionToken('fade', { reducedMotion });

  return (
    <div
      data-character-avatar="1"
      data-avatar-anchor={isDesktop ? 'column' : 'viewport'}
      style={{
        // See the header note. The phone's mark is fixed to the viewport; the
        // desktop's is absolute inside a board column that scrolls under it.
        position: isDesktop ? 'absolute' : 'fixed',
        right: isDesktop ? 16 : 12,
        // The inset lifts the phone's mark off the browser chrome that `fixed`
        // cannot see. It is 0 on every desktop and on any browser without a
        // visual viewport, so this reads as the plain offset there.
        bottom: isDesktop ? 16 : 14 + viewportInset,
        // Above the board (2) and clear of the app's bottom nav (50,
        // BottomNav.jsx:57). That bar does not render here today — 'battle' is
        // in GAMEPLAY_SCREENS (App.jsx:1083) — so this is headroom, not a live
        // fight. The screen gates the mark off while the Game Tape (30) is up,
        // so it never floats over that either.
        zIndex: isDesktop ? 4 : 51,
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
          onClick={onOpenBubble || onOpen}
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
        ref={markRef}
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
              playerScore: playerScore ?? (agentBattle?.scoreState?.currentScore || 0),
              opponentScore: opponentScore ?? (agentBattle?.scoreState?.opponentScore || 0),
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
