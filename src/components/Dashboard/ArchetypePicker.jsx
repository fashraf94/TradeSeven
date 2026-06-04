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
// battle). Phase 2 closes the sheet on success — the dashboard identity updates
// live via the agent-doc subscription. Phase 3 will instead follow a successful
// change with the offer-to-re-seed dialog. Tokens: CMD / alpha (matches the
// Equip station siblings); red is reserved for downside and is never used here.

import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import EquipSheet from './EquipSheet';
import { CMD, alpha, Mono } from './commandUI';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../data/archetypeIdentity';
import { changeArchetype } from '../../services/agentService';

// Locked Identity Contract presentation order (ARCHETYPE_IDENTITY_CONTRACT_V1.md
// §1): Trend Follower → Contrarian → Diversifier → Speculator → Fundamental
// Investor → Capital Preserver. Pinned here so the picker is never arranged by
// an incidental Object.keys() iteration.
const ARCHETYPE_ORDER = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];

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

export default function ArchetypePicker({ open, onClose, agent, accent, dock = 'bottom' }) {
  const current = agent?.archetype;
  const [working, setWorking] = useState(null); // codeId mid-write, or null
  const [error, setError] = useState(null);

  // Clear transient state whenever the sheet closes, so a stale error or an
  // in-flight flag never leaks into the next open.
  useEffect(() => {
    if (!open) { setWorking(null); setError(null); }
  }, [open]);

  // Write the new archetype (battle-locked server-side). On success, close the
  // sheet — the dashboard identity re-renders via the agent-doc subscription.
  // (Phase 3 will instead surface the offer-to-re-seed dialog here.) Tapping the
  // current archetype, or any card while a write is in flight, is a no-op.
  const handleSelect = async (codeId) => {
    if (!agent?.id || codeId === current || working) return;
    setWorking(codeId);
    setError(null);
    try {
      await changeArchetype(agent.id, codeId);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Could not change archetype. Please try again.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <EquipSheet
      open={open}
      onClose={onClose}
      dock={dock}
      title="Choose archetype"
      subtitle="Your archetype sets how your agent reads the market and picks trades. A change applies on your next deploy."
      accent={accent}
    >
      {error && (
        <div
          role="alert"
          style={{
            margin: '2px 0 11px', padding: '10px 12px', borderRadius: 11, fontSize: 12.5, lineHeight: 1.45,
            color: CMD.copper, background: alpha(CMD.copper, 0.1), border: `1px solid ${alpha(CMD.copper, 0.32)}`,
          }}
        >
          {error}
        </div>
      )}
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
    </EquipSheet>
  );
}
