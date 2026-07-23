// src/components/Dashboard/ArchetypePicker.jsx
//
// Six-card archetype picker for the dashboard Equip station's Archetype slot.
// Opens as an EquipSheet (bottom sheet on mobile, center modal on desktop) with
// one hero card per archetype — display name (heading) + disposition (subhead)
// + reveal (body) — drawn from the EXISTING identity sources, never duplicated:
//   - display name        → archetypeDisplay.getArchetypeDisplayName
//   - disposition / reveal → archetypeIdentity.getArchetypeIdentity
// Cards render in the locked Identity Contract presentation order. The agent's
// current archetype is marked selected; tapping another card calls handleSelect.
//
// Tapping a card stages a one-way CONFIRM — no write happens yet, so backing out
// ("Cancel") commits nothing. "Change archetype" calls agentService.changeArchetype
// (battle-locked; 409 mid-battle), which atomically changes the archetype AND loads
// that archetype's born-with trait set server-side, in one transaction — an agent's
// traits always match its archetype, so there is no "keep my traits" path. On
// success the sheet closes; the dashboard identity re-renders via the agent-doc
// subscription. Tokens: CMD / alpha (matches the Equip station siblings); red is
// reserved for downside, so errors use copper.

import React, { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import EquipSheet from './EquipSheet';
import { CMD, alpha, Mono, readableOn, ErrorBanner } from './commandUI';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';
// Notice copy only (review F8): the reset notice always shows (never a
// silent reset), but mastery VOCABULARY appears only once the surface is
// lit — before that the copy is neutral.
import { MASTERY_SURFACE_ENABLED } from '../../../api/_utils/masteryConfig.js';
import { getArchetypeIdentity } from '../../data/archetypeIdentity';
import { changeArchetype } from '../../services/agentService';
// Hero cards (Agent Presence): the per-archetype gradient (reuse the Forge roster's
// source — getArchetypeCharacter().colors — never a duplicated palette) + the shared head
// at the archetype's resting disposition. All gated behind isAgentPresenceOn() so flag-off
// stays byte-identical to the plain text cards.
import { getArchetypeCharacter } from '../../data/archetypeCharacter';
import AgentPresence, { archetypeToDisposition } from '../AgentPresence';
import { isAgentPresenceOn } from '../../config/featureFlags';

// Locked Identity Contract presentation order (ARCHETYPE_IDENTITY_CONTRACT_V1.md
// §1): Trend Follower → Contrarian → Diversifier → Speculator → Fundamental
// Investor → Capital Preserver. Pinned here so the picker is never arranged by
// an incidental Object.keys() iteration.
// Exported as a reusable atom (Slice 5b-ii League loadout chooser composes it as
// a CONTROLLED selector; the live dashboard picker below keeps its commit flow).
export const ARCHETYPE_ORDER = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];

// Hero variant (Agent Presence, gated by the caller behind isAgentPresenceOn()). The card
// takes the archetype's OWN gradient — reused from getArchetypeCharacter().colors, the same
// [a,b] pair the Forge roster paints (no duplicated palette) — and mounts the shared head at
// that archetype's resting disposition (archetypeToDisposition), lightly-idle: no events, no
// standing, no binding. It is a pure preview of "archetype X at rest". Selecting still does
// exactly what it did before — this is display only.
function HeroArchetypeCard({ codeId, name, disposition, reveal, selected, busy, disabled, carousel = false, onClick }) {
  const { colors } = getArchetypeCharacter(codeId);
  const [a, b] = colors;
  const inert = selected || busy || disabled;
  return (
    <button
      type="button"
      onClick={inert ? undefined : onClick}
      disabled={inert}
      aria-pressed={selected}
      style={{
        all: 'unset', boxSizing: 'border-box', width: '100%', display: 'block', position: 'relative',
        // In the carousel the container owns spacing and equal heights (fill the slide);
        // in the vertical list keep the original stacked margin.
        marginBottom: carousel ? 0 : 9, height: carousel ? '100%' : undefined, borderRadius: 16, overflow: 'hidden',
        cursor: selected || busy ? 'default' : disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'opacity .15s ease',
        background: `linear-gradient(125deg, ${alpha(a, 0.92)} 0%, ${alpha(b, 0.8)} 100%)`,
        border: `1px solid ${selected ? alpha('#fff', 0.55) : alpha('#fff', 0.14)}`,
        boxShadow: selected
          ? `inset 0 0 0 1px ${alpha('#fff', 0.35)}, 0 8px 22px ${alpha(b, 0.38)}`
          : `0 6px 16px ${alpha('#05060A', 0.3)}`,
      }}
    >
      {/* legibility overlays (mirror the Forge ArchBand): darken toward the bottom, glint top-right */}
      <span aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `linear-gradient(180deg, ${alpha('#05060A', 0.06)} 0%, ${alpha('#05060A', 0.46)} 100%)` }} />
      <span aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(circle at 86% 14%, ${alpha('#fff', 0.2)}, transparent 46%)` }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: carousel ? '16px 16px' : '13px 14px' }}>
        {carousel ? (
          // Carousel hero: drop the icon-tile chrome and size the head up. Still BOXED to a
          // fixed footprint (72px) so the head's width:100% EnvStage root stays bounded to the
          // head, never the card — the Placement-2 mobile-mount lesson.
          <div style={{ width: 72, height: 72, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AgentPresence disposition={archetypeToDisposition(codeId)} accent={a} size={72} enableEnvironment={false} />
          </div>
        ) : (
          <div style={{ width: 54, height: 54, flexShrink: 0, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha('#05060A', 0.22), border: `1px solid ${alpha('#fff', 0.12)}` }}>
            <AgentPresence disposition={archetypeToDisposition(codeId)} accent={a} size={46} enableEnvironment={false} />
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: '#fff', textShadow: `0 1px 10px ${alpha('#05060A', 0.5)}` }}>{name}</div>
            {selected && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <Mono style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#fff', textTransform: 'uppercase' }}>Current</Mono>
                <Check size={16} color="#fff" />
              </span>
            )}
            {busy && (
              <Mono style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#fff', textTransform: 'uppercase', flexShrink: 0 }}>Switching…</Mono>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: alpha('#fff', 0.9), marginTop: 3, fontWeight: 500, textShadow: `0 1px 8px ${alpha('#05060A', 0.45)}` }}>{disposition}</div>
          <div style={{ fontSize: 12, color: alpha('#fff', 0.82), lineHeight: 1.5, marginTop: 7, textShadow: `0 1px 8px ${alpha('#05060A', 0.4)}` }}>{reveal}</div>
        </div>
      </div>
    </button>
  );
}

export function ArchetypeCard({ codeId, selected, busy, disabled, accent, hero = false, carousel = false, onClick }) {
  const name = getArchetypeDisplayName(codeId);
  const { disposition, reveal } = getArchetypeIdentity(codeId);
  // Hero cards are opt-in and gated by the caller behind isAgentPresenceOn(). Flag-off,
  // `hero` is false and the plain text card below renders BYTE-IDENTICAL to before (the
  // League LoadoutChooserSheet never passes `hero`, so it is unaffected). `carousel` is a
  // presentation variant of the SAME hero card (bigger bare head, fills the slide) used only
  // by the mobile carousel container — never a forked card.
  if (hero) {
    return (
      <HeroArchetypeCard
        codeId={codeId} name={name} disposition={disposition} reveal={reveal}
        selected={selected} busy={busy} disabled={disabled} carousel={carousel} onClick={onClick}
      />
    );
  }
  const inert = selected || busy || disabled;
  return (
    <button
      type="button"
      onClick={inert ? undefined : onClick}
      disabled={inert}
      aria-pressed={selected}
      style={{
        all: 'unset', boxSizing: 'border-box', width: '100%', display: 'block',
        padding: '14px', marginBottom: 9, borderRadius: 14,
        cursor: selected || busy ? 'default' : disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'opacity .15s ease',
        background: selected ? alpha(accent, 0.1) : CMD.surface,
        border: `1px solid ${selected ? alpha(accent, 0.45) : CMD.hair}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: CMD.ink }}>{name}</div>
        {selected && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <Mono style={{ fontSize: 9.5, letterSpacing: '0.12em', color: accent, textTransform: 'uppercase' }}>Current</Mono>
            <Check size={16} color={accent} />
          </span>
        )}
        {busy && (
          <Mono style={{ fontSize: 9.5, letterSpacing: '0.12em', color: accent, textTransform: 'uppercase', flexShrink: 0 }}>Switching…</Mono>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: CMD.ink2, marginTop: 4, fontWeight: 500 }}>{disposition}</div>
      <div style={{ fontSize: 12, color: CMD.ink3, lineHeight: 1.5, marginTop: 8 }}>{reveal}</div>
    </button>
  );
}

// Shown after a card is tapped: a one-way confirm that changing archetype
// REPLACES the current trait set with the new archetype's born-with defaults.
// No "keep my traits" — the archetype and its starter traits are one unit. Cancel
// commits nothing (no write has happened yet); "Change archetype" fires the single
// atomic server call that changes the archetype AND seeds its defaults together.
function ConfirmPanel({ codeId, accent, working, error, onConfirm, onCancel }) {
  const name = getArchetypeDisplayName(codeId);
  const btnBase = {
    all: 'unset', boxSizing: 'border-box', flex: 1, textAlign: 'center',
    padding: '12px 14px', borderRadius: 12, fontSize: 14, fontWeight: 700,
  };
  return (
    <div style={{ padding: '2px 2px 4px' }}>
      <div style={{ fontSize: 12.5, color: CMD.ink3, lineHeight: 1.55, marginBottom: 16 }}>
        Changing to <span style={{ color: CMD.ink, fontWeight: 600 }}>{name}</span> replaces your current traits with
        its starter set — an agent's traits always match its archetype. This applies on your next deploy.
      </div>
      {error && <ErrorBanner style={{ marginBottom: 14 }}>{error}</ErrorBanner>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={working ? undefined : onCancel}
          disabled={working}
          style={{ ...btnBase, color: CMD.ink2, border: `1px solid ${CMD.hair2}`, background: 'transparent', cursor: working ? 'default' : 'pointer', opacity: working ? 0.5 : 1 }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={working ? undefined : onConfirm}
          disabled={working}
          style={{ ...btnBase, color: readableOn(accent), background: accent, cursor: working ? 'default' : 'pointer', opacity: working ? 0.7 : 1 }}
        >
          {working ? 'Changing…' : 'Change archetype'}
        </button>
      </div>
    </div>
  );
}

// Mobile-only hero carousel (behind the presence flag): the SAME ArchetypeCard, a DIFFERENT
// container — a native horizontal scroll-snap track (no library, no dependency). Swiping only
// browses; selection stays an explicit tap that raises the existing one-way confirm, so a
// browse gesture can never change the archetype. Opens centered on the CURRENT archetype; a
// dot indicator restores the "there are six" cue lost when one card fills the view.
//
// GESTURE: the EquipSheet has no drag-to-dismiss (dismiss = backdrop tap / X; the pill is
// decorative) — the only competing gesture is the sheet's vertical content scroll. So the
// track is a plain scroller with `touch-action: pan-x` + `overscroll-behavior-x: contain`:
// a horizontal swipe drives the carousel, a vertical swipe bubbles to the sheet's scroll, and
// there is no JS drag handler to fight. No auto-advance. Reduced motion: native snap still
// works; the open-centering is instant and the dot transition is disabled.
function MobileArchetypeCarousel({ current, accent, heroesOn, onSelect }) {
  const trackRef = useRef(null);
  const reduced = useReducedMotion();
  const currentIdx = Math.max(0, ARCHETYPE_ORDER.indexOf(current));
  const [active, setActive] = useState(currentIdx);

  // Open centered on the current archetype (not the first) — instant, so it's correct under
  // reduced motion and never animates a scroll on mount.
  useEffect(() => {
    const track = trackRef.current;
    const slide = track && track.children[currentIdx];
    if (track && slide) {
      track.scrollLeft = slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2;
      setActive(currentIdx);
    }
    // Runs once per open (the sheet remounts this on each open); `current` is stable while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track which card is centered → the active dot.
  const syncActive = () => {
    const track = trackRef.current;
    if (!track) return;
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < track.children.length; i += 1) {
      const c = track.children[i];
      const dist = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    setActive((prev) => (prev === best ? prev : best));
  };

  const goTo = (i) => {
    const slide = trackRef.current && trackRef.current.children[i];
    if (slide) slide.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
  };

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={syncActive}
        style={{
          position: 'relative', display: 'flex', alignItems: 'stretch', gap: 12,
          overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x', overscrollBehaviorX: 'contain',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
          // Symmetric % side-padding = (100 − slide%) / 2 so EVERY card centers, including the
          // first/last (the current archetype can be an edge) — the snap centers into this room.
          padding: '2px 8%',
        }}
      >
        {ARCHETYPE_ORDER.map((codeId) => (
          <div key={codeId} style={{ flex: '0 0 84%', scrollSnapAlign: 'center', display: 'flex' }}>
            <ArchetypeCard
              codeId={codeId}
              selected={codeId === current}
              busy={false}
              disabled={false}
              accent={accent}
              hero={heroesOn}
              carousel
              onClick={() => onSelect(codeId)}
            />
          </div>
        ))}
      </div>
      {/* position indicator — n-of-six via dots (one card fills the view, so this is the only
          cue that five more exist). Tapping a dot jumps to that card. */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 }}>
        {ARCHETYPE_ORDER.map((codeId, i) => (
          <button
            key={codeId}
            type="button"
            aria-label={`Show ${getArchetypeDisplayName(codeId)}`}
            aria-current={i === active}
            onClick={() => goTo(i)}
            style={{
              all: 'unset', height: 7, width: i === active ? 20 : 7, borderRadius: 99, cursor: 'pointer',
              background: i === active ? accent : alpha(accent, 0.28),
              transition: reduced ? 'none' : 'width .2s ease, background .2s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ArchetypePicker({ open, onClose, agent, accent, dock = 'bottom' }) {
  const current = agent?.archetype;
  // Hero cards behind the Agent Presence gate; flag-off this is false → plain text cards
  // (byte-identical). The `?agentPresence=1` dev-preview param also lights them up.
  const heroesOn = isAgentPresenceOn();
  // Mobile = the bottom-sheet dock (desktop passes dock="center"). The hero CAROUSEL is
  // mobile-only; desktop keeps the vertical list. Flag-off, neither branch is hero, so the
  // vertical text list renders on both — byte-identical to today.
  const mobile = dock !== 'center';
  const [pending, setPending] = useState(null);   // codeId awaiting confirm — NO write yet, or null
  const [working, setWorking] = useState(false);   // the change+seed request is in flight
  const [error, setError] = useState(null);
  // The dial-invalidation notice (Mastery P3 rider): holds the NEW
  // archetype's display name while the notice shows, then the sheet closes.
  const [dialNotice, setDialNotice] = useState(null);
  // Monotonic session token, bumped on close, so an async write that resolves
  // after the sheet was closed (and maybe reopened) can't setState on it.
  const sessionRef = useRef(0);

  // Clear transient state whenever the sheet closes, so a stale error, pending
  // confirm, or in-flight flag never leaks into the next open; bumping the
  // session cancels any in-flight handler's pending setState.
  useEffect(() => {
    if (!open) {
      sessionRef.current += 1;
      setPending(null); setWorking(false); setError(null); setDialNotice(null);
    }
  }, [open]);

  // Tapping a card STAGES a confirm — no write happens yet, so backing out
  // ("Cancel") leaves the agent untouched. Tapping the current archetype, or any
  // card while a change is in flight, is a no-op.
  const handleSelect = (codeId) => {
    if (!agent?.id || codeId === current || working) return;
    setError(null);
    setPending(codeId);
  };

  // "Change archetype" → the single atomic server call that changes the archetype
  // AND loads its born-with traits in one transaction (change-archetype.js). On
  // success the sheet closes; on failure the confirm stays open with the error so
  // nothing partial is left behind (the server transaction is all-or-nothing).
  const handleConfirm = async () => {
    if (!agent?.id || !pending || working) return;
    const session = sessionRef.current;
    setWorking(true);
    setError(null);
    try {
      const result = await changeArchetype(agent.id, pending);
      if (sessionRef.current !== session) return; // sheet closed mid-flight — drop the result
      // Mastery P3 notice rider (ratified, V2.2 §3.2 + cutover-window
      // extension): the server resets an equipped 'aggressive' tempo when
      // the NEW archetype's mastery level is below the gate — never a
      // silent reset. The response field exists ONLY when the reset fired
      // (enforcement or flip-ceremony states), so this branch is
      // unreachable dark and the ordinary close is byte-identical.
      if (result?.dialInvalidated) {
        setDialNotice(getArchetypeDisplayName(pending));
        setTimeout(() => { if (sessionRef.current === session) onClose?.(); }, 2600);
        return;
      }
      onClose?.();
    } catch (err) {
      if (sessionRef.current !== session) return;
      setError(err?.message || 'Could not change archetype. Please try again.');
    } finally {
      if (sessionRef.current === session) setWorking(false);
    }
  };

  const confirming = Boolean(pending);

  return (
    <EquipSheet
      open={open}
      onClose={onClose}
      dock={dock}
      title={confirming ? `Change to ${getArchetypeDisplayName(pending)}?` : 'Choose archetype'}
      subtitle={confirming
        ? "This replaces your current trait set with the new archetype’s defaults."
        : 'Your archetype sets how your agent reads the market and picks trades. A change applies on your next deploy.'}
      accent={accent}
    >
      {dialNotice && (
        <div style={{
          margin: '2px 0 12px', padding: '10px 12px', borderRadius: 10,
          background: alpha(accent, 0.1), border: `1px solid ${alpha(accent, 0.35)}`,
          fontSize: 12.5, color: CMD.ink, lineHeight: 1.5,
        }}>
          {MASTERY_SURFACE_ENABLED
            ? `Tempo dial reset to Standard — the Aggressive position unlocks at mastery level 2 for ${dialNotice}.`
            : `Tempo dial reset to Standard — the Aggressive position isn't available for ${dialNotice} yet.`}
        </div>
      )}
      {confirming ? (
        <ConfirmPanel
          codeId={pending}
          accent={accent}
          working={working}
          error={error}
          onConfirm={handleConfirm}
          onCancel={() => { setPending(null); setError(null); }}
        />
      ) : heroesOn && mobile ? (
        <>
          {error && <ErrorBanner style={{ margin: '2px 0 11px' }}>{error}</ErrorBanner>}
          <MobileArchetypeCarousel current={current} accent={accent} heroesOn={heroesOn} onSelect={handleSelect} />
        </>
      ) : (
        <>
          {error && <ErrorBanner style={{ margin: '2px 0 11px' }}>{error}</ErrorBanner>}
          {ARCHETYPE_ORDER.map((codeId) => (
            <ArchetypeCard
              key={codeId}
              codeId={codeId}
              selected={codeId === current}
              busy={false}
              disabled={false}
              accent={accent}
              hero={heroesOn}
              onClick={() => handleSelect(codeId)}
            />
          ))}
        </>
      )}
    </EquipSheet>
  );
}
