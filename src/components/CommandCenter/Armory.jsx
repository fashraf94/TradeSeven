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
//     close (no flash, no black square).
//
// Follow-up, founder ruling N1 (Nov 4, 2026): outside a game Shadow is always neutral. With the flag on the hub's hero is
// bare Shadow whatever the agent's archetype is (armoryHeroRead, at the hub's one read in CommandCenterHub.jsx), so an
// equip never changes it and never suits it up; the Loadout panel's Archetype card names what is equipped. Only the
// armory's preview dresses a figure: the wide dialog's own centre, and on the phone the hero itself while the armory is
// open. Closing the phone armory, by any path, takes the armor off once, on the engine's 700 ms unequip as the box
// collapses (at once under reduced motion).
//
// A set on its hook is the set alone (no brain), pewter unless it is the equipped one (agentFormSpec.js SET_ALONE,
// UNLIT). It is a still until hovered or touched, then live, then a still again (FD-9): only the centre figure and at
// most one set draw live. Selecting a set previews it: the centre plays the engine's swap (900 ms on, 700 ms off, the
// size tweened across it, ruling R5); under reduced motion everything is a still and a preview switches at once. Not
// built: the seam flash, the ring burst, the slot's return to its hook. Not built on purpose (D4, FD-6): any count,
// stage, level or growth; the status line is "Equipped" or "Previewing" only.
//
// Equip is today's write, exactly the picker's: agentService.changeArchetype (immediate; 409 while the ranked agent is
// in a battle), so the footnote says so (FD-1, alone: ruling N2(b)). A battle lock shows the armory's own lock line
// (ruling N2(a): nothing changed, try again when the game ends); any other failure the server's words, else the picker's. The server's tempo-dial reset is never silent: its notice shows and
// the armory stays open. On success the armory closes; the hero stays bare (N1).
//
// The words: hub/hubCopy.js ARMORY_COPY; the names, one-liners and paragraphs through hub/archetypeLines.js alone (the
// §2.3 ratchet's one hub line). No effect, timer or listener lives here (commandCenterHub.mount.guard.test.js): focus
// on open is a ref callback, a late result is dropped by a session token bumped on close and at unmount.

import React, { createContext, use, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { changeArchetype } from '../../services/agentService';
// Build A2 (board 4, the armory with a loadout context): with PER_GAME_LOADOUT_ENABLED on, the armory sets the loadout a
// card's armor row opened it for (hub/perGameLoadoutContext.js `armoryKind`): its context line names the game, Equip
// reads "Equip X for BaggerBomb" / "… for League" and calls the writer with that `loadout`, the equipped set is that
// loadout's, and a locked League is previewed freely while Equip is the lock line and does nothing. The footnote is
// context-specific (N3 made per game). Flag off (A1 alone), every line below behaves as A1 built it.
import { PER_GAME_LOADOUT_ENABLED } from '../../config/perGameLoadoutFlags';
import { changeLoadoutArchetype, isLeagueLock } from '../../services/loadoutService';
import { PerGameLoadoutContext, cardsOf } from './hub/perGameLoadoutContext';
import { LOCK_KIND, armoryContextOf, armoryFootnoteOf } from './hub/perGameLoadoutModel';
import { formatLockDayIso } from '../../constants/perGameLoadout';
import { LOADOUT_COPY } from '../../constants/loadoutCopy';
import AgentForm from '../AgentForm/AgentForm';
import { SET_ALONE, UNLIT, hasWebGL } from '../AgentForm/agentFormSpec';
import { getAgentGrowth } from '../AgentForm/agentGrowth';
import { armoryLines } from './hub/archetypeLines';
import { HUB_COMPOSITIONS } from './hub/composition';
import { ARMORY_COPY, HUB_COPY as COPY } from './hub/hubCopy';
import { C, HAIR, HAIR_2, MONO, PHONE_TARGET, tint } from './hub/hubStyle';
import HubSheet from './HubSheet';
import { Eyebrow, HubButton, Icon, useHubComposition } from './HubParts';

/**
 * The six sets, clockwise from the top, in the locked Identity Contract order (ArchetypePicker.jsx ARCHETYPE_ORDER, which
 * Armory.test.js pins this to). A literal of its own: the picker's module is mocked whole by the hub's suites, and the
 * armory reaches nothing of it.
 */
export const ARMORY_SETS = /* @__PURE__ */ Object.freeze(['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian']);

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

/**
 * A1 carry AR-6 (Build A2): the ring cannot shrink, and under about 315 CSS px of hub width (Safari's page zoom on a
 * 375 px phone, a 320 px phone with a scrollbar) its Close and its outer sets leave the stage. Below `below` px the same
 * six stills sit in a 3 × 2 grid under the hero instead, inside the hero's box: the hero `top` px from the box's top,
 * the grid `gap` px under it. The ring's tap areas stay 48 px.
 */
export const PHONE_ARMORY_GRID = Object.freeze({ below: 315, top: 8, gap: 8, columns: 3 });

/** The phone armory's layout at the hub's measured width: the ring, or (AR-6) the grid under 315 px. */
export function phoneArmoryLayout(width) {
  return typeof width === 'number' && width > 0 && width < PHONE_ARMORY_GRID.below ? 'grid' : 'ring';
}

/** The grid layout's box height: the hero, the gap, two rows of sets and the gap between them. */
export function phoneArmoryGridHeight() {
  const { slot, centre } = PHONE_ARMORY;
  const { top, gap } = PHONE_ARMORY_GRID;
  return top + centre + gap + slot * 2 + gap;
}

/**
 * The phone hub's bare hero while the armory is closed (founder ruling D-A, Nov 6, 2026; with the flag on only): bare
 * Shadow a quarter bigger than in the stage's 200 px box (196 under 375 px wide), `wide` px at `at` px of hub width and up,
 * `narrow` below. Bare Shadow's framing is fixed, so the figure grows exactly with its box (measured: its lit extent is
 * 51 % of the box's width at every size), and a quarter bigger is 1.25 × the box. The name and status sit beside the
 * figure only while their column keeps `text` px; otherwise they stack under it, so they never overlap the figure nor
 * truncate. `chrome` is the width beside the two that is not theirs: the hub's 2 × 14 gutter, the stage's 2 × 1 border,
 * its 6 + 14 side padding and the 6 px gap. Stacked, the words rise `tuck` of the box into its empty lower margin (the
 * figure fills its middle half). Measured in headless Edge at 320, 360 and 390 (the A1 report §15). One line each, so a
 * founder tune is a one-line change.
 */
export const PHONE_HERO = Object.freeze({ wide: 250, narrow: 245, at: 375, text: 120, chrome: 56, tuck: .1 });

/** The phone hero's box and layout at the hub's measured width (unmeasured: the wide size, stacked, which overlaps nothing). */
export function phoneHero(width) {
  const measured = typeof width === 'number' && width > 0;
  const size = measured && width < PHONE_HERO.at ? PHONE_HERO.narrow : PHONE_HERO.wide;
  return { size, stacked: !(measured && width - PHONE_HERO.chrome - size >= PHONE_HERO.text) };
}

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

/**
 * The words a failed equip shows: the armory's own lock line for a battle lock (ruling N2(a): nothing changed; the hub's
 * `nextDeployLocked` stays the Loadout card's), else the server's message, else the picker's.
 */
export function equipErrorOf(error) {
  if (isBattleLock(error)) return ARMORY_COPY.locked;
  return typeof error?.message === 'string' && error.message ? error.message : ARMORY_COPY.equipFailed;
}

/**
 * The status line (FD-6): "Equipped" when the previewed set is the equipped one, else "Previewing · Equipped set is X".
 * Never a count or a stage (D4).
 */
export function armoryStatus(previewed, equipped) {
  return previewed === equipped ? ARMORY_COPY.equipped : ARMORY_COPY.previewingOver(armoryLines(equipped).name);
}

/**
 * A1 carry AR-5: the control that opened the wide dialog, and the hub's fallback, so its HubSheet gives focus back to
 * them as the History sheet's does (Safari never focuses a clicked button). CommandCenterHub.jsx provides it around
 * LoadoutSheets; null elsewhere (the dialog then falls back to HubSheet's own rule).
 */
export const ArmorySheetContext = /* @__PURE__ */ createContext(null);

/** Build A2: the loadout card the armory sets (BaggerBomb's or League's), or null outside a per-game scope. */
export function armoryCardOf(scope) {
  if (!scope) return null;
  const cards = cardsOf(scope);
  return cards ? cards[scope.armoryKind] ?? null : null;
}

/**
 * Build A2: the words a failed loadout equip shows. A League week lock (409 `league_locked`) is the lock line with the
 * server's own end; a battle on the ranked record is A1's lock line; anything else the server's words, else the picker's.
 */
export function loadoutEquipErrorOf(error) {
  if (isLeagueLock(error)) {
    const when = formatLockDayIso(error?.payload?.lock?.endsAt ?? null);
    return when ? LOADOUT_COPY.lines.locked(when) : LOADOUT_COPY.lines.lockedUndated;
  }
  return equipErrorOf(error);
}

const IDLE_EQUIP = Object.freeze({ working: false, error: null, notice: null });

/**
 * The equip, exactly the picker's write (ArchetypePicker.jsx handleConfirm): one changeArchetype call for the agent and
 * the chosen set, nothing while one is in flight. A result that lands after `cancel()` (the armory closed) is dropped.
 * `onEquipped(codeId, { stay })` hears a success; `stay` is true when the server reset the tempo dial, so the notice shows.
 * `detach` is a ref callback for the armory's root, the same function on every render, so React calls it at the attach
 * and at the unmount only: the unmount drops a result in flight, with no effect. `reset` clears the words and the
 * in-flight mark (the phone scope outlives its armory, so each open starts clean).
 */
export function useArmoryEquip({ agent, onEquipped, card = null }) {
  const [state, setState] = useState(IDLE_EQUIP);
  const session = useRef(0);
  const [detach] = useState(() => (el) => { if (!el) session.current += 1; });
  // Build A2: with a loadout card the equipped set is that loadout's, a locked League equips nothing, and the write
  // names the loadout; without one (A1) it is the agent's own archetype and today's change.
  const equipped = card ? card.archetype : agent?.archetype;
  const equip = async (codeId) => {
    if (!agent?.id || !codeId || codeId === equipped || state.working || (card && card.locked)) return;
    const mine = session.current;
    setState({ working: true, error: null, notice: null });
    try {
      const result = await (card ? changeLoadoutArchetype(agent.id, codeId, card.kind) : changeArchetype(agent.id, codeId));
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
      setState({ working: false, error: card ? loadoutEquipErrorOf(error) : equipErrorOf(error), notice: null });
    }
  };
  const cancel = () => {
    session.current += 1;
    setState(IDLE_EQUIP);
  };
  const reset = () => setState(IDLE_EQUIP);
  return { ...state, equip, cancel, reset, detach };
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
export function ArmoryDetails({ previewed, equipped, working, error, notice, onEquip, compact = false, card = null }) {
  const lines = armoryLines(previewed);
  const isEquipped = previewed === equipped;
  // Build A2: Equip names the game; a locked League's Equip is the lock line and does nothing (previewing still works).
  const locked = Boolean(card && card.locked);
  const equipLabel = isEquipped ? ARMORY_COPY.equipped
    : locked ? (card.state === 'checking' ? LOADOUT_COPY.lines.checking : card.lockKind === LOCK_KIND.BATTLE ? LOADOUT_COPY.lockedEquipBattle : LOADOUT_COPY.lockedEquip)
      : working ? ARMORY_COPY.equipping
        : card ? LOADOUT_COPY.equipFor(lines.name, card.game) : ARMORY_COPY.equip(lines.name);
  const footnote = !card ? ARMORY_COPY.footnote
    : locked && card.state === 'locked' ? (card.lockKind === LOCK_KIND.BATTLE ? LOADOUT_COPY.lockedEquipNoteBattle
      : card.when ? LOADOUT_COPY.lockedEquipNote(card.when) : LOADOUT_COPY.lockedEquipNoteUndated)
      : armoryFootnoteOf(card);
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
        kind={locked && !isEquipped ? 'secondary' : 'primary'}
        full
        icon={isEquipped ? undefined : locked ? 'lock' : 'check'}
        onPress={isEquipped || working || locked ? undefined : onEquip}
        ariaLabel={locked && !isEquipped ? `${equipLabel}. ${footnote}` : undefined}
        data-armory-equip=""
        data-armory-equip-locked={locked ? '' : undefined}
      >
        {equipLabel}
      </HubButton>
      <div data-armory-footnote="" style={{ fontSize: 12, color: C.ink3, marginTop: 8, textAlign: 'center', lineHeight: 1.45, textWrap: 'pretty' }}>
        {footnote}
      </div>
    </>
  );
}

/**
 * Build A2 (board 4): the armory's context line — "Choosing armor for BaggerBomb · applies to the next deploy"; for a
 * locked League, pewter, the lock glyph and the week's end. It arrives with the armory and stays put while sets are tried.
 */
export function ArmoryContextLine({ card, compact = false }) {
  const context = armoryContextOf(card);
  return (
    <div data-armory-context={card.kind} data-armory-context-locked={context.locked ? '' : undefined} style={{ minWidth: 0 }}>
      <Eyebrow color={context.locked ? C.ink3 : C.teal} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {context.locked ? <Icon name="lock" size={12} /> : null}
        <span>{context.title}</span>
      </Eyebrow>
      <div style={{ fontSize: compact ? 12.5 : 13.5, color: C.ink2, marginTop: 3, lineHeight: 1.35 }}>{context.sub}</div>
    </div>
  );
}

/** The wide dialog (board 6). Mounted while open, so every open starts on the equipped set. */
function ArmoryDialog({ onClose, agent }) {
  const reducedMotion = Boolean(useReducedMotion());
  const ring = useHubComposition() === HUB_COMPOSITIONS.DESKTOP ? DESKTOP_RING : COMPACT_RING;
  const wide = ring === DESKTOP_RING;
  // Build A2: the loadout the card opened it for (null with per-game loadouts off: A1's agent archetype).
  const card = PER_GAME_LOADOUT_ENABLED ? armoryCardOf(use(PerGameLoadoutContext)) : null;
  // AR-5: the opener and the fallback the hub kept at the click, for HubSheet's focus return.
  const sheetFocus = use(ArmorySheetContext);
  const equipped = card ? card.archetype : agent.archetype;
  const [previewed, setPreviewed] = useState(() => firstPreview(equipped));
  const [hot, setHot] = useState(null);
  const result = useArmoryEquip({ agent, card, onEquipped: (codeId, { stay }) => { if (!stay) onClose(); } });
  const close = () => { result.cancel(); onClose(); };
  const { onKeyDown, optionRef } = useRingKeys(previewed, setPreviewed);
  const cx = ring.width / 2, cy = ring.width / 2;
  const points = ringPoints(ring.radius, cx, cy);
  return (
    <HubSheet title={ARMORY_COPY.title} label={ARMORY_COPY.title} width={ring.dialog} onClose={close} reducedMotion={reducedMotion} opener={sheetFocus?.opener ?? null} fallbackFocus={sheetFocus?.fallbackFocus ?? null}>
      <div ref={result.detach} data-armory="dialog" data-armory-ring-size={wide ? 'desktop' : 'compact'}>
        {card ? (
          <div style={{ margin: '-8px 0 0' }}><ArmoryContextLine card={card} /></div>
        ) : (
          <p style={{ margin: '-8px 0 0', fontSize: 13.5, color: C.ink2, lineHeight: 1.5, textWrap: 'pretty' }}>{ARMORY_COPY.intro}</p>
        )}
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
            <ArmoryDetails previewed={previewed} equipped={equipped} working={result.working} error={result.error} notice={result.notice} onEquip={() => result.equip(previewed)} card={card} />
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
 * The hero's read with the flag on (HubAgentForm.jsx reads HubAgentFormContext): the hub's own read, the same agent (its
 * id, so the hero's key and its view stay), wearing `shown`. Founder ruling N1: outside a game Shadow is neutral, so the
 * hub hands its hero this read with nothing shown, bare Shadow whatever the agent's archetype (CommandCenterHub.jsx), and
 * the phone armory hands it the previewed set while it is open (ShadowStage.jsx PhoneArmoryStage). A read that is not
 * ready passes unchanged: the hero shows nothing of it yet.
 */
export function armoryHeroRead(read, shown = undefined) {
  if (!read || read.status !== 'ready' || !read.agent || typeof read.agent !== 'object') return read;
  return { ...read, agent: { ...read.agent, archetype: shown } };
}

/**
 * The phone armory's state, around PhoneStage (CommandCenterHub.jsx). It stays mounted with the hub, so:
 *   - each open starts on the equipped set, with no set hot and no words left from the last one;
 *   - `shown` is what the hero wears: the previewed set while open, nothing (bare Shadow, N1) while closed. So opening
 *     suits the hero up in the equipped set, each preview is a swap, and closing, by Close, Escape, an equip or anything
 *     that closes the hub's sheet, takes the armor off once: the engine's 700 ms unequip as the box collapses;
 *   - a result in flight when the armory closes by any path is dropped: the details' root carries the equip's `detach`,
 *     so its unmount drops it (no effect; an external close never reaches `close` below).
 * Closing returns focus to the control that opened it (useHubSheets keeps it at the click). `width` is the hub's measured
 * width, from which the closed hero's box and layout follow (phoneHero, ruling D-A); the open armory's sizes are fixed.
 */
export function PhoneArmoryScope({ open, agent, onClose, opener = null, reducedMotion = false, width = null, children }) {
  const isOpen = Boolean(open && agent);
  // Build A2: the loadout the card opened it for, whose set is the equipped one (A1, with per-game loadouts off: the agent's).
  const card = PER_GAME_LOADOUT_ENABLED ? armoryCardOf(use(PerGameLoadoutContext)) : null;
  const real = card ? card.archetype : agent ? agent.archetype : undefined;
  const [previewed, setPreviewed] = useState(() => firstPreview(real));
  const [hot, setHot] = useState(null);
  const result = useArmoryEquip({ agent, card, onEquipped: (codeId, { stay }) => { if (!stay) close(); } });
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) { setPreviewed(firstPreview(real)); setHot(null); result.reset(); }
  }
  // The opener takes focus back without scrolling to it (review AR-1): it sits below the stage, and a scroll to it would
  // carry the hero out of view while it collapses and takes the armor off (the hub's section is its own scroll box).
  function close() {
    result.cancel();
    onClose?.();
    if (opener && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
  }
  const value = {
    open: isOpen,
    equipped: real,
    previewed,
    preview: setPreviewed,
    hot,
    setHot,
    shown: isOpen ? previewed : undefined,
    working: result.working,
    error: result.error,
    notice: result.notice,
    equip: () => result.equip(previewed),
    detach: result.detach,
    close,
    reducedMotion,
    hero: phoneHero(width),
    width,
    card,
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
  const { slot, radius, extent, centre } = PHONE_ARMORY;
  const half = extent / 2;
  const points = ringPoints(radius, half, half);
  const { onKeyDown, optionRef } = useRingKeys(scope.previewed, scope.preview);
  // AR-6: under 315 px the six sets sit in a 3 × 2 grid under the hero (the same buttons, in flow), not on the ring.
  const grid = phoneArmoryLayout(scope.width) === 'grid';
  const listStyle = grid
    ? { position: 'absolute', left: 0, right: 0, top: PHONE_ARMORY_GRID.top + centre + PHONE_ARMORY_GRID.gap, display: 'grid', gridTemplateColumns: `repeat(${PHONE_ARMORY_GRID.columns}, ${slot}px)`, gap: PHONE_ARMORY_GRID.gap, justifyContent: 'center', pointerEvents: 'none' }
    : { position: 'absolute', inset: 0, pointerEvents: 'none' };
  return (
    <>
      {grid ? null : <RingLine cx={half} cy={half} radius={radius} />}
      <Eyebrow color={C.teal} style={{ position: 'absolute', left: 4, top: 6 }}>{ARMORY_COPY.title}</Eyebrow>
      <div ref={focusOnOpen} role="listbox" aria-label={ARMORY_COPY.sets} aria-orientation="horizontal" onKeyDown={onKeyDown} data-armory-listbox="" data-armory-layout={grid ? 'grid' : 'ring'} style={listStyle}>
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
                ...(grid ? { position: 'relative' } : { position: 'absolute', left: points[i].x - slot / 2, top: points[i].y - slot / 2 }),
                width: slot, height: slot, borderRadius: '50%',
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

/**
 * Under the phone ring: the set's words, the status line, Equip and the footnote (board 6's aside, one column). Its root
 * carries the equip's `detach`: it unmounts whenever the armory closes, so a result still in flight is dropped.
 */
export function PhoneArmoryDetails({ scope }) {
  return (
    <div ref={scope.detach} data-armory="phone" style={{ display: 'flex', flexDirection: 'column', padding: '8px 9px 0' }}>
      {scope.card ? <div style={{ marginBottom: 12 }}><ArmoryContextLine card={scope.card} compact /></div> : null}
      <ArmoryDetails previewed={scope.previewed} equipped={scope.equipped} working={scope.working} error={scope.error} notice={scope.notice} onEquip={scope.equip} compact card={scope.card} />
    </div>
  );
}
