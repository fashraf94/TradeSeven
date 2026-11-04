// src/components/CommandCenter/Armory.jsx
//
// Agent form build A1 — the armory (board 6, docs/design/agent-identity-v2/agent-cc-v2.jsx.txt; Phase 0 armory
// report docs/audits/20261102_PHASE0_ARMORY.md §7, §9 A1), behind AGENT_FORM_ARMORY_ENABLED
// (src/config/agentFormFlags.js). It replaces the hub's Change archetype sheet; ArchetypePicker.jsx stays, untouched,
// for the League chooser and the fallback shells until A2.
//
//   - The wide compositions (LoadoutSheets.jsx mounts the default export where the picker was): board 6's dialog.
//     Shadow at 300 px live in the centre wearing the previewed set; the six sets on a ring; an aside with the set's
//     name, one-liner and paragraph, the status line and Equip. The tablet and stacked compositions take the same
//     dialog at a smaller scale, the aside under the ring. The hero behind it is paused (CommandCenterHub.jsx).
//   - The phone (founder ruling FD-8): the armory opens in the hero's own box. PhoneArmoryScope (around PhoneStage in
//     CommandCenterHub.jsx) holds the state; ShadowStage.jsx's PhoneArmoryStage lays it out around the hero itself,
//     which stays mounted, shrinks to PHONE_ARMORY.centre and wears the previewed set. So nothing remounts on open or
//     close (no flash, no black square), and taking a preview off on close is drawn at once, never a second suit-up.
//
// A set on its hook is the set alone (no brain), pewter unless it is the equipped one (agentFormSpec.js SET_ALONE,
// UNLIT). It is a still until hovered or touched, then live, then a still again (FD-9): only the centre figure and at
// most one set draw live. Selecting a set previews it: the centre plays the engine's swap (900 ms on, 700 ms off, the
// size tweened across it, ruling R5); under reduced motion everything is a still and a preview switches at once. Not
// built: the seam flash, the ring burst, the slot's return to its hook. Not built on purpose (D4, FD-6): any count,
// stage, level or growth; the status line is "Equipped" or "Previewing" only.
//
// Equip is today's write, exactly the picker's: agentService.changeArchetype (immediate; 409 while the ranked agent is
// in a battle), so the footnote says so (FD-1). A battle lock shows the hub's own "Locked in battle" line; any other
// failure the server's words, else the picker's. The server's tempo-dial reset is never silent: its notice shows and
// the armory stays open. On success the armory closes; the hero suits up through its own change path.
//
// The words: hub/hubCopy.js ARMORY_COPY; the names, one-liners and paragraphs through hub/archetypeLines.js alone (the
// §2.3 ratchet's one hub line). No effect, timer or listener lives here (commandCenterHub.mount.guard.test.js): focus
// on open is a ref callback, a late result is dropped by a session token bumped on close and at unmount.

import React, { createContext, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { changeArchetype } from '../../services/agentService';
import { ARCHETYPE_ORDER } from '../Dashboard/ArchetypePicker';
import AgentForm from '../AgentForm/AgentForm';
import { SET_ALONE, UNLIT, hasWebGL } from '../AgentForm/agentFormSpec';
import { getAgentGrowth } from '../AgentForm/agentGrowth';
import { armoryLines } from './hub/archetypeLines';
import { HUB_COMPOSITIONS } from './hub/composition';
import { ARMORY_COPY, HUB_COPY as COPY } from './hub/hubCopy';
import { C, HAIR, HAIR_2, MONO, PHONE_TARGET, tint } from './hub/hubStyle';
import HubSheet from './HubSheet';
import { Eyebrow, HubButton, Icon, useHubComposition } from './HubParts';

/** The six sets, in the locked Identity Contract order the picker uses (clockwise from the top). */
export const ARMORY_SETS = ARCHETYPE_ORDER;

const LIVE = 'live';
const STILL = 'still';

/**
 * The ring's sizes, in CSS px. DESKTOP is board 6's dialog exactly (a 690 × 700 listbox, Shadow at 300, cards of 150
 * holding the set at 112 on a ring of 252). COMPACT is the tablet and stacked compositions' (the dialog narrower than
 * board 6's 1040, so the aside goes under the ring). PHONE is FD-8's, in the hero's box: see PHONE_ARMORY.
 */
export const DESKTOP_RING = Object.freeze({ width: 690, height: 700, radius: 252, centre: 300, slot: 112, card: 150, cardTop: 86, dialog: 1040 });
export const COMPACT_RING = Object.freeze({ width: 520, height: 530, radius: 192, centre: 220, slot: 84, card: 124, cardTop: 66, dialog: 600 });

/**
 * The phone armory (FD-8): the hero at `centre`, six sets of `slot` px on a ring of `radius`, all inside an `extent`
 * square, which is the widest thing the armory draws. The numbers are the smallest ring on which no set's tap area
 * meets the hero's box: a set at ±30° from the horizontal sits radius·cos 30° from the centre, and its box clears the
 * hero's when radius·cos 30° − slot/2 ≥ centre/2 (116 × 0.866 − 24 = 76.5 ≥ 76). Each set's tap area is its whole
 * `slot` square, 48 ≥ the 44 px phone target (hubStyle.js PHONE_TARGET). At 320 px the stage's inner width is 290
 * (320 − the hub's 2 × 14 gutter − the stage's 2 × 1 border), so the 280 px ring fits with the stage's 5 px padding.
 */
export const PHONE_ARMORY = Object.freeze({ centre: 152, slot: 48, radius: 116, extent: 280, padding: '10px 5px 16px' });

/** The six points of a ring of `radius` around (cx, cy), clockwise from the top (board 6: −90° + i·60°). */
export function ringPoints(radius, cx = 0, cy = 0, count = ARMORY_SETS.length) {
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  });
}

/** The set a fresh armory previews: the equipped one, or the first set when the agent's archetype is none of the six. */
export function firstPreview(equipped) {
  return ARMORY_SETS.includes(equipped) ? equipped : ARMORY_SETS[0];
}

/** A battle lock (change-archetype.js: 409 `battle_active`). The route's other 409s are not locks, so they keep their own words. */
export function isBattleLock(error) {
  return error?.status === 409 && error?.code === 'battle_active';
}

/** The words a failed equip shows: the hub's lock line for a battle lock, else the server's message, else the picker's. */
export function equipErrorOf(error) {
  if (isBattleLock(error)) return COPY.loadout.nextDeployLocked;
  return typeof error?.message === 'string' && error.message ? error.message : ARMORY_COPY.equipFailed;
}

/**
 * The status line (FD-6): "Equipped" when the previewed set is the equipped one, else "Previewing · Equipped set is X".
 * Never a count or a stage (D4).
 */
export function armoryStatus(previewed, equipped) {
  return previewed === equipped ? ARMORY_COPY.equipped : ARMORY_COPY.previewingOver(armoryLines(equipped).name);
}

const IDLE_EQUIP = Object.freeze({ working: false, error: null, notice: null });

/**
 * The equip, exactly the picker's write (ArchetypePicker.jsx handleConfirm): one changeArchetype call for the agent and
 * the chosen set, nothing while one is in flight. A result that lands after `cancel()` (the armory closed) is dropped.
 * `onEquipped(codeId, { stay })` hears a success; `stay` is true when the server reset the tempo dial, so the notice shows.
 * `detach` is a ref callback for the armory's root, the same function on every render, so React calls it at the attach
 * and at the unmount only: the unmount drops a result in flight, with no effect.
 */
export function useArmoryEquip({ agent, onEquipped }) {
  const [state, setState] = useState(IDLE_EQUIP);
  const session = useRef(0);
  const [detach] = useState(() => (el) => { if (!el) session.current += 1; });
  const equip = async (codeId) => {
    if (!agent?.id || !codeId || codeId === agent.archetype || state.working) return;
    const mine = session.current;
    setState({ working: true, error: null, notice: null });
    try {
      const result = await changeArchetype(agent.id, codeId);
      if (session.current !== mine) return;
      if (result?.dialInvalidated) {
        setState({ working: false, error: null, notice: ARMORY_COPY.dialReset(armoryLines(codeId).name) });
        onEquipped(codeId, { stay: true });
        return;
      }
      setState(IDLE_EQUIP);
      onEquipped(codeId, { stay: false });
    } catch (error) {
      if (session.current !== mine) return;
      setState({ working: false, error: equipErrorOf(error), notice: null });
    }
  };
  const cancel = () => {
    session.current += 1;
    setState(IDLE_EQUIP);
  };
  return { ...state, equip, cancel, detach };
}

/**
 * The ring's keys (a single-select listbox; selection follows focus): the arrows move round the ring, Home and End go to
 * the first and last set. Each move previews the set and focuses its option.
 */
export function useRingKeys(previewed, choose) {
  const options = useRef({});
  const onKeyDown = (event) => {
    const at = Math.max(0, ARMORY_SETS.indexOf(previewed));
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next = null;
    if (step) next = ARMORY_SETS[(at + step + ARMORY_SETS.length) % ARMORY_SETS.length];
    else if (event.key === 'Home') next = ARMORY_SETS[0];
    else if (event.key === 'End') next = ARMORY_SETS[ARMORY_SETS.length - 1];
    if (!next) return;
    event.preventDefault();
    choose(next);
    options.current[next]?.focus();
  };
  const optionRef = (codeId) => (el) => { options.current[codeId] = el; };
  return { onKeyDown, optionRef };
}

/** Hover (desktop) and touch (phone) make a set live; leaving or lifting makes it a still again. One at a time. */
function hotHandlers(codeId, setHot) {
  const on = () => setHot(codeId);
  const off = () => setHot((hot) => (hot === codeId ? null : hot));
  return { onPointerEnter: on, onPointerDown: on, onPointerLeave: off, onPointerUp: off, onPointerCancel: off };
}

/**
 * One figure that is hidden until its view has reported, so the wrapper's placeholder never shows for the frame before
 * the engine draws (no flash on open). Without WebGL nothing reports and the wrapper's still shows at once.
 */
function Figure({ style, ...form }) {
  const [shown, setShown] = useState(() => !hasWebGL());
  return (
    <div aria-hidden="true" data-armory-figure="" style={{ visibility: shown ? 'visible' : 'hidden', ...style }}>
      <AgentForm {...form} label={null} bloom="css" batched clip onStatus={() => setShown(true)} />
    </div>
  );
}

/** A set on its hook: the set alone, pewter unless equipped, a still unless it is the one hot set. */
export function SetFigure({ codeId, size, equipped, hot, reducedMotion, style }) {
  return (
    <Figure
      style={style}
      archetype={codeId}
      coreStage={SET_ALONE}
      allegiance={equipped ? 'player' : UNLIT}
      size={size}
      rate={hot && !reducedMotion ? LIVE : STILL}
      reducedMotion={reducedMotion}
    />
  );
}

/** The centre of the wide dialog: Shadow wearing the previewed set, live, suiting up on each preview. */
function CentreFigure({ archetype, size, reducedMotion }) {
  const { coreStage, armorStage } = getAgentGrowth(null);
  return (
    <Figure archetype={archetype} coreStage={coreStage} armorStage={armorStage} allegiance="player" size={size} rate={LIVE} reducedMotion={reducedMotion} equipOnChange />
  );
}

/** The ring's dashed circle, drawn in currentColor (SVG paint never takes a var(), hazard H8). */
function RingLine({ cx, cy, radius }) {
  return (
    <svg aria-hidden="true" data-armory-ring-line="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', color: HAIR_2 }}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" strokeDasharray="2 6" />
    </svg>
  );
}

const statusStyle = (tone) => ({ fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: tone, textAlign: 'center', lineHeight: 1.35, minHeight: 14 });

/** One option of the wide ring: board 6's SetSlot card — the set, its name, and "Equipped" or "Previewing" under it. */
function SetCard({ codeId, ring, x, y, previewed, equipped, hot, setHot, choose, optionRef, reducedMotion }) {
  const selected = codeId === previewed;
  const isEquipped = codeId === equipped;
  const { name } = armoryLines(codeId);
  const status = isEquipped ? ARMORY_COPY.equipped : selected ? ARMORY_COPY.previewing : '';
  return (
    <button
      ref={optionRef(codeId)}
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={name}
      tabIndex={selected ? 0 : -1}
      data-armory-set={codeId}
      data-armory-equipped={isEquipped ? '' : undefined}
      onClick={() => choose(codeId)}
      {...hotHandlers(codeId, setHot)}
      style={{
        appearance: 'none', font: 'inherit', color: C.ink, cursor: 'pointer', position: 'absolute', left: x - ring.card / 2, top: y - ring.cardTop,
        width: ring.card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 8px 10px', borderRadius: 16,
        background: selected ? tint('teal', 0.08) : C.surface,
        border: `1px solid ${selected ? tint('teal', 0.5) : HAIR}`,
        boxShadow: selected ? `0 0 0 3px ${tint('teal', 0.1)}` : 'none',
      }}
    >
      <SetFigure codeId={codeId} size={ring.slot} equipped={isEquipped} hot={hot === codeId} reducedMotion={reducedMotion} />
      <span style={{ fontSize: 13.5, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{name}</span>
      <span style={statusStyle(isEquipped ? C.teal : C.ink2)}>{status}</span>
    </button>
  );
}

/**
 * The set's words, the status line, the equip and its footnote: the wide dialog's aside, and the phone's block under the
 * ring. The status line is a polite live region, so a preview is read out.
 */
export function ArmoryDetails({ previewed, equipped, working, error, notice, onEquip, compact = false }) {
  const lines = armoryLines(previewed);
  const isEquipped = previewed === equipped;
  return (
    <>
      <Eyebrow color={isEquipped ? C.teal : C.ink3}>{isEquipped ? ARMORY_COPY.equipped : ARMORY_COPY.previewing}</Eyebrow>
      <h3 style={{ fontSize: compact ? 19 : 21, fontWeight: 700, letterSpacing: '-0.015em', margin: '8px 0 0', color: C.ink, lineHeight: 1.15 }}>{lines.name}</h3>
      {lines.approach && <div style={{ fontSize: compact ? 13.5 : 14, fontWeight: 600, marginTop: 6, lineHeight: 1.4, color: C.ink, textWrap: 'pretty' }}>{lines.approach}</div>}
      {lines.paragraph && <p style={{ margin: '8px 0 0', fontSize: 13, color: C.ink2, lineHeight: 1.55, textWrap: 'pretty' }}>{lines.paragraph}</p>}
      <div role="status" aria-live="polite" data-armory-status="" style={{ ...statusStyle(isEquipped ? C.teal : C.ink2), textAlign: 'left', marginTop: 12 }}>
        {armoryStatus(previewed, equipped)}
      </div>
      {error && <div role="alert" data-armory-error="" style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: C.copper }}>{error}</div>}
      {notice && <div data-armory-notice="" style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: C.ink, padding: '10px 12px', borderRadius: 10, background: tint('teal', 0.1), border: `1px solid ${tint('teal', 0.35)}` }}>{notice}</div>}
      <div style={{ flex: compact ? 'none' : 1, minHeight: compact ? 14 : 16 }} />
      <HubButton
        kind="primary"
        full
        icon={isEquipped ? undefined : 'check'}
        onPress={isEquipped || working ? undefined : onEquip}
        data-armory-equip=""
      >
        {isEquipped ? ARMORY_COPY.equipped : working ? ARMORY_COPY.equipping : ARMORY_COPY.equip(lines.name)}
      </HubButton>
      <div style={{ fontSize: 12, color: C.ink3, marginTop: 8, textAlign: 'center', lineHeight: 1.45, textWrap: 'pretty' }}>
        {ARMORY_COPY.footnote} {ARMORY_COPY.stays}
      </div>
    </>
  );
}

/** The wide dialog (board 6). Mounted while open, so every open starts on the equipped set. */
function ArmoryDialog({ onClose, agent }) {
  const reducedMotion = Boolean(useReducedMotion());
  const ring = useHubComposition() === HUB_COMPOSITIONS.DESKTOP ? DESKTOP_RING : COMPACT_RING;
  const wide = ring === DESKTOP_RING;
  const equipped = agent.archetype;
  const [previewed, setPreviewed] = useState(() => firstPreview(equipped));
  const [hot, setHot] = useState(null);
  const result = useArmoryEquip({ agent, onEquipped: (codeId, { stay }) => { if (!stay) onClose(); } });
  const close = () => { result.cancel(); onClose(); };
  const { onKeyDown, optionRef } = useRingKeys(previewed, setPreviewed);
  const cx = ring.width / 2, cy = ring.width / 2;
  const points = ringPoints(ring.radius, cx, cy);
  return (
    <HubSheet title={ARMORY_COPY.title} label={ARMORY_COPY.title} width={ring.dialog} onClose={close} reducedMotion={reducedMotion}>
      <div ref={result.detach} data-armory="dialog" data-armory-ring-size={wide ? 'desktop' : 'compact'}>
        <p style={{ margin: '-8px 0 0', fontSize: 13.5, color: C.ink2, lineHeight: 1.5, textWrap: 'pretty' }}>{ARMORY_COPY.intro}</p>
        <div style={{ display: 'grid', gridTemplateColumns: wide ? `${ring.width}px minmax(0, 1fr)` : 'minmax(0, 1fr)', gap: 16, marginTop: 14 }}>
          <div style={{ position: 'relative', width: ring.width, height: ring.height, justifySelf: 'center' }}>
            <div aria-hidden="true" style={{ position: 'absolute', left: cx - ring.centre / 2 - 10, top: cy - ring.centre / 2 - 10, width: ring.centre + 20, height: ring.centre + 20, borderRadius: '50%', background: `radial-gradient(circle, ${tint('teal', 0.1)}, transparent 70%)` }} />
            <RingLine cx={cx} cy={cy} radius={ring.radius} />
            <div style={{ position: 'absolute', left: cx - ring.centre / 2, top: cy - ring.centre / 2, width: ring.centre, textAlign: 'center' }}>
              <span aria-hidden="true" style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.teal, display: 'block', marginBottom: -14, position: 'relative', zIndex: 1 }}>{ARMORY_COPY.centre}</span>
              <CentreFigure archetype={previewed} size={ring.centre} reducedMotion={reducedMotion} />
            </div>
            <div role="listbox" aria-label={ARMORY_COPY.sets} aria-orientation="horizontal" onKeyDown={onKeyDown} data-armory-listbox="" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {ARMORY_SETS.map((codeId, i) => (
                <div key={codeId} style={{ pointerEvents: 'auto' }}>
                  <SetCard codeId={codeId} ring={ring} x={points[i].x} y={points[i].y} previewed={previewed} equipped={equipped} hot={hot} setHot={setHot} choose={setPreviewed} optionRef={optionRef} reducedMotion={reducedMotion} />
                </div>
              ))}
            </div>
          </div>
          <aside aria-label={armoryLines(previewed).name} style={{ background: C.surface, border: `1px solid ${HAIR}`, borderRadius: 16, padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <ArmoryDetails previewed={previewed} equipped={equipped} working={result.working} error={result.error} notice={result.notice} onEquip={() => result.equip(previewed)} />
          </aside>
        </div>
      </div>
    </HubSheet>
  );
}

/**
 * The hub's Change archetype sheet with the armory on (LoadoutSheets.jsx). On the wide compositions, the dialog while
 * open; on the phone nothing here: the phone armory is in the hero's box (PhoneArmoryScope, ShadowStage.jsx).
 *
 * @param {'bottom'|'center'} props.dock LoadoutSheets.jsx SHEET_DOCK: 'bottom' is the phone
 */
export default function Armory({ open, onClose, agent, dock }) {
  if (!open || !agent || dock === 'bottom') return null;
  return <ArmoryDialog onClose={onClose} agent={agent} />;
}

// ── The phone (FD-8) ───────────────────────────────────────────────────────────────────────────────────────────────

/** What PhoneArmoryScope hands the phone stage (ShadowStage.jsx PhoneArmoryStage); null outside a scope. */
export const ArmoryStageContext = /* @__PURE__ */ createContext(null);

/**
 * The hero's read while the phone armory runs (HubAgentForm.jsx reads HubAgentFormContext): the hub's own read with the
 * archetype the hero shows, and `instant` when the last change of it was a preview taken off (the armory closing
 * without an equip), which the hero draws at once instead of suiting up. A read that is not ready passes unchanged.
 */
export function armoryHeroRead(read, shown, instant) {
  if (!read || read.status !== 'ready' || !read.agent || typeof read.agent !== 'object') return read;
  return { ...read, agent: { ...read.agent, archetype: shown }, instant: instant === true };
}

/**
 * The phone armory's state, around PhoneStage (CommandCenterHub.jsx). It stays mounted with the hub, so:
 *   - each open starts on the equipped set, with no set hot;
 *   - `shown` is what the hero wears: the previewed set while open; after an equip, the equipped set until the agent's
 *     read catches up with it (so the hero never steps back to the old set and suits up again); else the read's;
 *   - `instant` marks a change of `shown` made by closing (a preview taken off), so the hero draws it at once.
 * Closing returns focus to the control that opened it (useHubSheets keeps it at the click).
 */
export function PhoneArmoryScope({ open, agent, onClose, opener = null, reducedMotion = false, children }) {
  const isOpen = Boolean(open && agent);
  const real = agent ? agent.archetype : undefined;
  const [previewed, setPreviewed] = useState(() => firstPreview(real));
  const [hot, setHot] = useState(null);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) { setPreviewed(firstPreview(real)); setHot(null); }
  }
  const [committed, setCommitted] = useState(null);
  if (committed && real !== committed.base) setCommitted(null);
  const result = useArmoryEquip({
    agent,
    onEquipped: (codeId, { stay }) => {
      setCommitted({ archetype: codeId, base: real });
      if (!stay) close();
    },
  });
  function close() {
    result.cancel();
    onClose?.();
    if (opener && typeof opener.focus === 'function') opener.focus();
  }
  const shown = isOpen ? previewed : committed && real === committed.base ? committed.archetype : real;
  const [trail, setTrail] = useState({ shown, previewing: isOpen, instant: false });
  if (trail.shown !== shown || trail.previewing !== isOpen) {
    setTrail({ shown, previewing: isOpen, instant: trail.shown !== shown && trail.previewing && !isOpen });
  }
  const value = {
    open: isOpen,
    equipped: real,
    previewed,
    preview: setPreviewed,
    hot,
    setHot,
    shown,
    instant: trail.instant,
    working: result.working,
    error: result.error,
    notice: result.notice,
    equip: () => result.equip(previewed),
    close,
    reducedMotion,
  };
  return <ArmoryStageContext.Provider value={value}>{children}</ArmoryStageContext.Provider>;
}

/** Focus the previewed set when the phone ring attaches, and bring the stage into view (stable, so it runs at attach only). */
function focusOnOpen(el) {
  if (!el) return;
  el.querySelector('[role="option"][aria-selected="true"]')?.focus({ preventScroll: true });
  el.closest('[data-hub-stage]')?.scrollIntoView?.({ block: 'start' });
}

/**
 * The phone ring, over the hero's box (PhoneArmoryStage renders it beside the hero, in the extent square): the dashed
 * circle, the "Armory" mark and Close in the two top corners (which the ring leaves empty), and the six sets as a
 * listbox. Each set's whole slot square is its tap area.
 */
export function PhoneArmoryRing({ scope }) {
  const { slot, radius, extent } = PHONE_ARMORY;
  const half = extent / 2;
  const points = ringPoints(radius, half, half);
  const { onKeyDown, optionRef } = useRingKeys(scope.previewed, scope.preview);
  return (
    <>
      <RingLine cx={half} cy={half} radius={radius} />
      <Eyebrow color={C.teal} style={{ position: 'absolute', left: 4, top: 6 }}>{ARMORY_COPY.title}</Eyebrow>
      <div ref={focusOnOpen} role="listbox" aria-label={ARMORY_COPY.sets} aria-orientation="horizontal" onKeyDown={onKeyDown} data-armory-listbox="" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {ARMORY_SETS.map((codeId, i) => {
          const selected = codeId === scope.previewed;
          const isEquipped = codeId === scope.equipped;
          return (
            <button
              key={codeId}
              ref={optionRef(codeId)}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={armoryLines(codeId).name}
              tabIndex={selected ? 0 : -1}
              data-armory-set={codeId}
              data-armory-equipped={isEquipped ? '' : undefined}
              onClick={() => scope.preview(codeId)}
              {...hotHandlers(codeId, scope.setHot)}
              style={{
                appearance: 'none', font: 'inherit', padding: 0, cursor: 'pointer', pointerEvents: 'auto', touchAction: 'manipulation',
                position: 'absolute', left: points[i].x - slot / 2, top: points[i].y - slot / 2, width: slot, height: slot, borderRadius: '50%',
                background: selected ? tint('teal', 0.1) : 'transparent',
                border: `1px solid ${selected ? tint('teal', 0.55) : isEquipped ? tint('teal', 0.3) : HAIR}`,
              }}
            >
              <SetFigure codeId={codeId} size={slot - 2} equipped={isEquipped} hot={scope.hot === codeId} reducedMotion={scope.reducedMotion} />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={scope.close}
        aria-label={COPY.sheet.close}
        data-armory-close=""
        style={{ appearance: 'none', font: 'inherit', cursor: 'pointer', position: 'absolute', right: 0, top: 0, width: PHONE_TARGET, height: PHONE_TARGET, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink2, background: C.surface, border: `1px solid ${HAIR}` }}
      >
        <Icon name="x" size={16} />
      </button>
    </>
  );
}

/** Under the phone ring: the set's words, the status line, Equip and the footnote (board 6's aside, one column). */
export function PhoneArmoryDetails({ scope }) {
  return (
    <div data-armory="phone" style={{ display: 'flex', flexDirection: 'column', padding: '8px 9px 0' }}>
      <ArmoryDetails previewed={scope.previewed} equipped={scope.equipped} working={scope.working} error={scope.error} notice={scope.notice} onEquip={scope.equip} compact />
    </div>
  );
}
