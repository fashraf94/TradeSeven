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
// Selecting a card calls agentService.changeArchetype (battle-locked; 409 mid-
// battle). On success the archetype write has landed (the dashboard identity
// re-renders via the agent-doc subscription) and the sheet switches to the
// offer-to-re-seed: "Load <name>'s default traits?" → reseedDefaultTraits (a
// clean replace) or "Keep my traits" (dismiss; the agent may keep mismatched
// traits — the user is the directional authority). Tokens: CMD / alpha (matches
// the Equip station siblings); red is reserved for downside, so errors use copper.

import React, { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import EquipSheet from './EquipSheet';
import { CMD, alpha, Mono, readableOn } from './commandUI';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../data/archetypeIdentity';
import { changeArchetype } from '../../services/agentService';
import { reseedDefaultTraits } from '../../services/seedDefaultTraits';

// Locked Identity Contract presentation order (ARCHETYPE_IDENTITY_CONTRACT_V1.md
// §1): Trend Follower → Contrarian → Diversifier → Speculator → Fundamental
// Investor → Capital Preserver. Pinned here so the picker is never arranged by
// an incidental Object.keys() iteration.
const ARCHETYPE_ORDER = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];

function ErrorBanner({ children, style }) {
  return (
    <div
      role="alert"
      style={{
        padding: '10px 12px', borderRadius: 11, fontSize: 12.5, lineHeight: 1.45,
        color: CMD.copper, background: alpha(CMD.copper, 0.1), border: `1px solid ${alpha(CMD.copper, 0.32)}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ArchetypeCard({ codeId, selected, busy, disabled, accent, onClick }) {
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

// Shown after a successful archetype change: offer the new archetype's default
// traits as a clean replace, or let the user keep their tuned loadout.
function OfferPanel({ codeId, accent, reseeding, error, onLoad, onKeep }) {
  const name = getArchetypeDisplayName(codeId);
  const btnBase = {
    all: 'unset', boxSizing: 'border-box', flex: 1, textAlign: 'center',
    padding: '12px 14px', borderRadius: 12, fontSize: 14, fontWeight: 700,
  };
  return (
    <div style={{ padding: '2px 2px 4px' }}>
      <div style={{ fontSize: 12.5, color: CMD.ink3, lineHeight: 1.55, marginBottom: 16 }}>
        Your agent is now a <span style={{ color: CMD.ink, fontWeight: 600 }}>{name}</span>. Loading defaults swaps your
        current traits for its starter set. Keep yours if you've tuned them — an agent can run traits that don't match
        its archetype.
      </div>
      {error && <ErrorBanner style={{ marginBottom: 14 }}>{error}</ErrorBanner>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={reseeding ? undefined : onKeep}
          disabled={reseeding}
          style={{ ...btnBase, color: CMD.ink2, border: `1px solid ${CMD.hair2}`, background: 'transparent', cursor: reseeding ? 'default' : 'pointer', opacity: reseeding ? 0.5 : 1 }}
        >
          Keep my traits
        </button>
        <button
          type="button"
          onClick={reseeding ? undefined : onLoad}
          disabled={reseeding}
          style={{ ...btnBase, color: readableOn(accent), background: accent, cursor: reseeding ? 'default' : 'pointer', opacity: reseeding ? 0.7 : 1 }}
        >
          {reseeding ? 'Loading…' : 'Load defaults'}
        </button>
      </div>
    </div>
  );
}

export default function ArchetypePicker({ open, onClose, agent, accent, dock = 'bottom' }) {
  const current = agent?.archetype;
  const [working, setWorking] = useState(null);   // codeId mid change-archetype write, or null
  const [offer, setOffer] = useState(null);       // codeId just changed to, awaiting the re-seed decision
  const [reseeding, setReseeding] = useState(false);
  const [error, setError] = useState(null);
  // Monotonic session token, bumped on close, so an async write that resolves
  // after the sheet was closed (and maybe reopened) can't setState on it.
  const sessionRef = useRef(0);

  // Clear transient state whenever the sheet closes, so a stale error, offer, or
  // in-flight flag never leaks into the next open; bumping the session cancels
  // any in-flight handler's pending setState.
  useEffect(() => {
    if (!open) {
      sessionRef.current += 1;
      setWorking(null); setOffer(null); setReseeding(false); setError(null);
    }
  }, [open]);

  // Change the archetype (battle-locked server-side). On success, surface the
  // offer-to-re-seed instead of closing — the archetype write already landed and
  // the dashboard identity re-renders via the agent-doc subscription. Tapping the
  // current archetype, or any card while a write is in flight, is a no-op.
  const handleSelect = async (codeId) => {
    if (!agent?.id || codeId === current || working) return;
    const session = sessionRef.current;
    setWorking(codeId);
    setError(null);
    try {
      await changeArchetype(agent.id, codeId);
      if (sessionRef.current !== session) return; // sheet closed mid-flight — drop the result
      setOffer(codeId);
    } catch (err) {
      if (sessionRef.current !== session) return;
      setError(err?.message || 'Could not change archetype. Please try again.');
    } finally {
      if (sessionRef.current === session) setWorking(null);
    }
  };

  // "Load defaults" → clean-replace re-seed of the new archetype's defaults, then
  // close. "Keep my traits" just closes (the archetype change already landed).
  // reseedDefaultTraits NEVER throws — it reports failure via { seeded:false } —
  // so we inspect the result rather than relying on a rejection.
  const handleLoadDefaults = async () => {
    if (!agent?.id || !offer || reseeding) return;
    const session = sessionRef.current;
    setReseeding(true);
    setError(null);
    try {
      const result = await reseedDefaultTraits(agent.id, offer);
      if (sessionRef.current !== session) return; // sheet closed mid-flight
      if (!result?.seeded) {
        setError('Could not load default traits. Please try again.');
        return; // keep the offer open so the user can retry or keep their traits
      }
      onClose?.();
    } catch (err) {
      if (sessionRef.current !== session) return;
      setError(err?.message || 'Could not load default traits. Please try again.');
    } finally {
      if (sessionRef.current === session) setReseeding(false);
    }
  };

  const offering = Boolean(offer);

  return (
    <EquipSheet
      open={open}
      onClose={onClose}
      dock={dock}
      title={offering ? `Load ${getArchetypeDisplayName(offer)}'s default traits?` : 'Choose archetype'}
      subtitle={offering
        ? 'This replaces your current traits.'
        : 'Your archetype sets how your agent reads the market and picks trades. A change applies on your next deploy.'}
      accent={accent}
    >
      {offering ? (
        <OfferPanel
          codeId={offer}
          accent={accent}
          reseeding={reseeding}
          error={error}
          onLoad={handleLoadDefaults}
          onKeep={() => onClose?.()}
        />
      ) : (
        <>
          {error && <ErrorBanner style={{ margin: '2px 0 11px' }}>{error}</ErrorBanner>}
          {ARCHETYPE_ORDER.map((codeId) => (
            <ArchetypeCard
              key={codeId}
              codeId={codeId}
              selected={codeId === current}
              busy={working === codeId}
              disabled={Boolean(working) && working !== codeId}
              accent={accent}
              onClick={() => handleSelect(codeId)}
            />
          ))}
        </>
      )}
    </EquipSheet>
  );
}
