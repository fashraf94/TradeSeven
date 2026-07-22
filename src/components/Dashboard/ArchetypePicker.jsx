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

// Locked Identity Contract presentation order (ARCHETYPE_IDENTITY_CONTRACT_V1.md
// §1): Trend Follower → Contrarian → Diversifier → Speculator → Fundamental
// Investor → Capital Preserver. Pinned here so the picker is never arranged by
// an incidental Object.keys() iteration.
// Exported as a reusable atom (Slice 5b-ii League loadout chooser composes it as
// a CONTROLLED selector; the live dashboard picker below keeps its commit flow).
export const ARCHETYPE_ORDER = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];

export function ArchetypeCard({ codeId, selected, busy, disabled, accent, onClick }) {
  const name = getArchetypeDisplayName(codeId);
  const { disposition, reveal } = getArchetypeIdentity(codeId);
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

export default function ArchetypePicker({ open, onClose, agent, accent, dock = 'bottom' }) {
  const current = agent?.archetype;
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
              onClick={() => handleSelect(codeId)}
            />
          ))}
        </>
      )}
    </EquipSheet>
  );
}
