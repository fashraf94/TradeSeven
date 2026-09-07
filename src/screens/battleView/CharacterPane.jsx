// src/screens/battleView/CharacterPane.jsx
//
// A3.2 — THE PANE (D-91, D-93).
//
// The conversation stops living in a footer strip and a pull-up drawer and
// becomes the agent's own place: a region with the character at its head, three
// sections, and one way out. On desktop it is the right column and the way out
// COLLAPSES it (the board takes the full width, the mark floats back onto it);
// on a phone it opens full-height over the dimmed board and the way out CLOSES
// it.
//
// THE SEGMENTED CONTROL IS A REAL TABLIST. The mock drew role="tablist" and
// role="tab" with no panels, no aria-controls and no aria-labelledby, which
// promises a widget a screen reader then cannot operate (Phase 0 §3 item 10).
// This builds the whole set: each tab owns an id, points at its panel through
// aria-controls, and each panel points back through aria-labelledby. Arrow keys
// move between tabs, as the pattern requires, and only the selected tab is in
// the tab order.
//
// THE CHAT IS NEVER UNMOUNTED (hazard 45, A2.4 review L2-F1). Bench and Tape
// HIDE it — `display: none`, the sheet's own idiom at peek — because the chat
// holds a typed draft, an in-flight send and a scroll position, and a component
// that changes tree position remounts and loses all three. This is why the
// three panels are siblings that all exist, rather than a switch that renders
// one: `hidden` on a panel that still exists is a different thing from a panel
// that is not there.
//
// ONE AgentChat PER LAYOUT holds by construction: the screen hands this
// component the single `chat` element and it is placed at exactly one point in
// the tree, on both shells.
//
// FOCUS IN lives here (it needs the region node); FOCUS OUT lives in the
// screen (it needs the mark, which this component cannot see). Review lens 2
// found the first draft wrong on three of four transitions: the effect keyed on
// MOUNT rather than on opening, its `wasOpenRef` guard was tautological — the
// body set the ref before the cleanup could ever read it false — and the
// return-focus target it restored was the board's mark, which UNMOUNTS while
// the pane is open, so focusing it was a no-op on a detached node.
//
// The contract now: focus moves into the region on the false → true edge of
// `open`, on the shell where the pane covers the board, and never on the mount
// pass (the Game Tape's review CR6 rule). The screen focuses the CURRENT mark
// after a close, through the same `pendingChatFocus` hand-off A2.4 built for
// its own collapse (review L2-F4).
//
// HAZARD 48. index.css forces every <button> to 16px !important, so every label
// in this file sizes an inner <span>, as ChatSheet's handle does.

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import AgentPresenceMount from '../../components/AgentPresence/AgentPresenceMount';
import { isAgentPresenceOn } from '../../config/featureFlags';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';
import { cssVar } from '../../theme/cssTokens';
import { motionToken } from '../../theme/motion';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';
import { PANE_SECTION, PANE_SECTIONS } from './useCharacterPane';

const SECTION_LABEL = {
  [PANE_SECTION.CHAT]: COPY.paneSectionChat,
  [PANE_SECTION.BENCH]: COPY.paneSectionBench,
  [PANE_SECTION.TAPE]: COPY.paneSectionTape,
};

const tabId = (section) => `pane-tab-${section}`;
const panelId = (section) => `pane-panel-${section}`;

/** The header face's box, in px. One literal, named once (the F2 box). */
const PANE_FACE_PX = 36;

/* ---------------------------------------------------------------------------
   WHEN THE ARCHETYPE LINE HAS ROOM (the founder's ruling on F2's ordering).
   ---------------------------------------------------------------------------
   F2 ruled: "on narrow widths the archetype line hides first, then the name
   wraps." The first build read that as the desktop/mobile shell split, which is
   the INVERSE on a narrow desktop — the archetype stayed and the name gave way.
   The review measured what that costs at the real breakpoint (768, not 1024,
   so an iPad in portrait is a "desktop" and opens the pane by default): the
   identity column collapses to 0 px, the agent's name becomes a vertical stack
   of single letters, the archetype's `nowrap` text paints over the tabs, and
   the controls group runs past the header's edge.

   The seam is still the shell gate — a second min-width query beside the first,
   NOT a container query (the repo has no such idiom and jsdom does no layout).
   The pane is a fixed FRACTION of the viewport, which is what makes a viewport
   query a faithful proxy for the pane's own width.

   The breakpoint is DERIVED, not chosen, so a reader can check it and a test can
   import it rather than restating a number: */

/** The header's fixed cost: 28 padding + 36 face + 20 gaps + 243 controls. */
export const PANE_HEADER_FIXED_PX = 327;

/** The widest archetype display name at `nowrap` — `Fundamental Investor`. */
export const PANE_ARCHETYPE_MIN_PX = 141;

/** The pane's share of the row: `flex: 2` beside a board at `flex: 3`. */
export const PANE_VIEWPORT_SHARE = 0.4;

/**
 * The viewport width at which the pane can hold the name AND the archetype AND
 * the segmented control. Below it the ARCHETYPE goes first — which is the whole
 * of the ruling — and the name keeps its room. Below the plain desktop
 * breakpoint the phone's header takes over and the line is gone anyway.
 */
export const ARCHETYPE_MIN_VIEWPORT_PX = Math.ceil(
  (PANE_HEADER_FIXED_PX + PANE_ARCHETYPE_MIN_PX) / PANE_VIEWPORT_SHARE,
);

/** The label span every control wraps its text in (hazard 48). */
const labelSpan = (size = 12, weight = 700) => ({
  fontSize: size,
  fontWeight: weight,
  letterSpacing: '0.04em',
  lineHeight: 1.2,
});

function SegmentedControl({ section, onSelect }) {
  const onKeyDown = (e) => {
    const i = PANE_SECTIONS.indexOf(section);
    if (i < 0) return;
    // The tablist keyboard contract: left/right wrap, Home/End jump. Without
    // it the roles above would be a promise the widget does not keep.
    if (e.key === 'ArrowRight') { e.preventDefault(); onSelect(PANE_SECTIONS[(i + 1) % PANE_SECTIONS.length]); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); onSelect(PANE_SECTIONS[(i - 1 + PANE_SECTIONS.length) % PANE_SECTIONS.length]); }
    else if (e.key === 'Home') { e.preventDefault(); onSelect(PANE_SECTIONS[0]); }
    else if (e.key === 'End') { e.preventDefault(); onSelect(PANE_SECTIONS[PANE_SECTIONS.length - 1]); }
  };

  return (
    <div
      role="tablist"
      aria-label={COPY.paneName}
      data-pane-tablist="1"
      onKeyDown={onKeyDown}
      style={{
        display: 'flex',
        gap: 2,
        padding: 2,
        borderRadius: 6,
        background: `rgba(var(--ft-shadow-rgb), 0.45)`,
        border: `1px solid rgba(var(--ft-scrim-rgb), 0.08)`,
      }}
    >
      {PANE_SECTIONS.map((s) => {
        const selected = s === section;
        return (
          <button
            key={s}
            type="button"
            role="tab"
            id={tabId(s)}
            aria-selected={selected ? 'true' : 'false'}
            aria-controls={panelId(s)}
            // Only the SELECTED tab is in the tab order; the arrows move within
            // the list. That is the pattern, and it is what stops a three-tab
            // control costing three tab stops on the way to the composer.
            tabIndex={selected ? 0 : -1}
            data-pane-tab={s}
            onClick={() => onSelect(s)}
            style={{
              border: 'none',
              cursor: 'pointer',
              padding: '5px 10px',
              minHeight: 30,
              borderRadius: 5,
              background: selected ? `rgba(var(--ft-teal-rgb), 0.16)` : 'transparent',
              color: selected ? cssVar('teal') : cssVar('text-muted'),
            }}
          >
            <span style={labelSpan()}>{SECTION_LABEL[s]}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function CharacterPane({
  agentBattle = null,
  // Whether the archetype line has room (the founder's ruling on F2). Decided
  // by the SCREEN, from the same shell gate that decides `isDesktop`, so this
  // component stays free of media queries and a test can drive the contract
  // directly. Default false: the line is the first thing to go.
  showArchetype = false,
  // The pair the BOARD IS SHOWING — see CharacterAvatar's note (lens 1 F6).
  playerScore = null,
  opponentScore = null,
  open = true,
  section = PANE_SECTION.CHAT,
  onSelectSection,
  onClose,
  isDesktop = false,
  reducedMotion = false,
  chat = null,
  bench = null,
  tape = null,
  overflow = null,
}) {
  const regionRef = React.useRef(null);
  const wasOpenRef = React.useRef(open);
  const agentName = agentBattle?.agentContext?.agentName || 'Your Agent';
  const archetype = agentBattle?.agentContext?.archetype
    ? getArchetypeDisplayName(agentBattle.agentContext.archetype)
    : null;

  // FOCUS IN ON OPEN, BACK ON CLOSE — the shell where the pane covers the board
  // only. On desktop the pane is a column beside the board and moving focus into
  // it on every expand would fight the player's own place on the page.
  const modal = !isDesktop;
  React.useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    // The EDGE, not the state: a re-render with the pane already open must not
    // pull focus back out of whatever the player is using inside it, and the
    // mount pass (which seeds `wasOpenRef` from `open`) must not steal focus at
    // all.
    if (!modal || !open || wasOpen) return;
    regionRef.current?.focus?.();
  }, [modal, open]);

  const panel = (s, content) => (
    <div
      key={s}
      role="tabpanel"
      id={panelId(s)}
      aria-labelledby={tabId(s)}
      data-pane-section={s}
      // HIDDEN, NOT UNMOUNTED (hazard 45). `display: none` keeps the subtree —
      // and the chat's draft, in-flight send and scroll — alive. `hidden` also
      // takes it out of the accessibility tree, which is the other half of what
      // an unselected tabpanel must do.
      hidden={s !== section}
      style={{
        display: s === section ? 'flex' : 'none',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      }}
    >
      {content}
    </div>
  );

  return (
    <motion.section
      ref={regionRef}
      data-character-pane="1"
      data-pane-shell={isDesktop ? 'desktop' : 'mobile'}
      data-pane-open={open ? 'true' : 'false'}
      role="region"
      aria-label={COPY.paneName}
      tabIndex={-1}
      // HIDDEN, NEVER UNMOUNTED — the same rule the SECTIONS follow, applied to
      // the pane itself (hazard 45, rulings §4: "one tree position across
      // collapse / expand and sections"). The first draft honoured the sections
      // and unmounted on collapse, which lost the typed draft, the in-flight
      // send and the scroll on every fold — review lens 2 F2 / lens 5 F1.
      hidden={!open}
      initial={reducedMotion ? false : { opacity: 0, y: isDesktop ? 0 : 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionToken('smooth', { reducedMotion })}
      style={{
        display: open ? 'flex' : 'none',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%',
        background: `rgba(${cssVar('shadow-rgb')}, 0.72)`,
        borderLeft: isDesktop ? `1px solid rgba(${cssVar('scrim-rgb')}, 0.08)` : 'none',
      }}
    >
      {/* The pane's head: the character, its name, the sections, the way out. */}
      <div
        data-pane-header="1"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: isDesktop ? '10px 14px' : '10px 12px',
          borderBottom: `1px solid rgba(var(--ft-scrim-rgb), 0.08)`,
          flexShrink: 0,
        }}
      >
        {isAgentPresenceOn() && agentBattle && (
          // BOXED (F2) — see ArenaHeader's note at its own face. EnvStage's root
          // is `width: 100%; height: 100%`, so bare as a flex item it claimed
          // the whole header: the face drew small inside a huge box (the mark
          // and the name read as "far apart") and the name was squeezed under
          // the segmented control to `S..`. Both dashboard call sites already
          // box it and say why (IdentityPanel.jsx:80, EquipStation.jsx:218).
          <div data-pane-face="1" style={{ width: PANE_FACE_PX, height: PANE_FACE_PX, flexShrink: 0 }}>
            <AgentPresenceMount
              surface="duel"
              agent={agentBattle}
              duel={{
                playerScore: playerScore ?? (agentBattle?.scoreState?.currentScore || 0),
                opponentScore: opponentScore ?? (agentBattle?.scoreState?.opponentScore || 0),
                statusFeed: null,
              }}
              size={PANE_FACE_PX}
              enableEnvironment={false}
              reactivityLevel="static"
            />
          </div>
        )}
        {/* THE NAME TAKES THE SLACK, and gives it back last (F2). `1 1 auto`
            with `minWidth: 0` lets the block use the room the boxed face and
            the content-sized controls leave, and wrap rather than ellipse when
            there is not enough. */}
        <div data-pane-identity="1" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 auto' }}>
          <span
            data-pane-agent-name="1"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: cssVar('teal'),
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              // THE NAME NEVER TRUNCATES (F2) — it wraps. `anywhere` because
              // agent names are single tokens with no break opportunity of
              // their own; without it a long one would overflow instead.
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
            }}
          >
            {agentName}
          </span>
          {/* The archetype's DISPLAY name, from the one map that owns it — the
              persisted code-id never reaches the screen.
              THE FIRST THING TO GO (F2's ruled ordering). It renders only where
              the pane can hold it beside the name and the control; below that
              width it hides and the name keeps its room, which is the order the
              ruling asks for. The screen decides, from the same shell gate that
              decides `isDesktop` — see ARCHETYPE_MIN_VIEWPORT_PX above for the
              arithmetic. The phone never shows it: its header has the sections
              and the close to fit. */}
          {showArchetype && archetype && (
            <span
              data-pane-archetype="1"
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: cssVar('text-muted'),
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
              }}
            >
              {archetype}
            </span>
          )}
        </div>

        {/* Sized to its CONTENT and never shrunk (F2): the segmented control's
            three labels are the thing the player aims at, and a control that
            gives up width first turns three tabs into three slivers. The name
            beside it wraps instead. */}
        <div data-pane-controls="1" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <SegmentedControl section={section} onSelect={onSelectSection} />
          {overflow}
          <button
            type="button"
            data-pane-close="1"
            aria-label={isDesktop ? COPY.paneCollapse : COPY.paneClose}
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 32,
              minHeight: 32,
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: cssVar('text-muted'),
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {isDesktop ? <ChevronRight size={18} /> : <X size={18} />}
          </button>
        </div>
      </div>

      {/* The three sections. All three exist; the unselected two are hidden. */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {panel(PANE_SECTION.CHAT, chat)}
        {panel(PANE_SECTION.BENCH, bench)}
        {panel(PANE_SECTION.TAPE, tape)}
      </div>
    </motion.section>
  );
}
