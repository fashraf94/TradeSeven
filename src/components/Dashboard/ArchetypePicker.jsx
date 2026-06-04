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
// Phase 1: handleSelect is a stub (closes the sheet). Phase 2 wires it to
// agentService.changeArchetype (battle-locked); Phase 3 adds the offer-to-
// re-seed dialog. Tokens: CMD / alpha (matches the Equip station siblings);
// red is reserved for downside and is never used here.

import React from 'react';
import { Check } from 'lucide-react';
import EquipSheet from './EquipSheet';
import { CMD, alpha, Mono } from './commandUI';
import { getArchetypeDisplayName } from '../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../data/archetypeIdentity';

// Locked Identity Contract presentation order (ARCHETYPE_IDENTITY_CONTRACT_V1.md
// §1): Trend Follower → Contrarian → Diversifier → Speculator → Fundamental
// Investor → Capital Preserver. Pinned here so the picker is never arranged by
// an incidental Object.keys() iteration.
const ARCHETYPE_ORDER = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];

function ArchetypeCard({ codeId, selected, accent, onClick }) {
  const name = getArchetypeDisplayName(codeId);
  const { disposition, reveal } = getArchetypeIdentity(codeId);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        all: 'unset', boxSizing: 'border-box', width: '100%', display: 'block',
        padding: '14px', marginBottom: 9, borderRadius: 14, cursor: selected ? 'default' : 'pointer',
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
      </div>
      <div style={{ fontSize: 12.5, color: CMD.ink2, marginTop: 4, fontWeight: 500 }}>{disposition}</div>
      <div style={{ fontSize: 12, color: CMD.ink3, lineHeight: 1.5, marginTop: 8 }}>{reveal}</div>
    </button>
  );
}

export default function ArchetypePicker({ open, onClose, agent, accent, dock = 'bottom' }) {
  const current = agent?.archetype;

  // Phase 1 stub. Phase 2 wires changeArchetype(agent.id, codeId) (battle-locked)
  // and Phase 3 follows a successful change with the offer-to-re-seed dialog.
  // Tapping the current archetype is a no-op.
  const handleSelect = (codeId) => {
    if (codeId === current) return;
    // TODO(Phase 2): await changeArchetype(agent.id, codeId) → then offer re-seed.
    onClose?.();
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
      {ARCHETYPE_ORDER.map((codeId) => (
        <ArchetypeCard
          key={codeId}
          codeId={codeId}
          selected={codeId === current}
          accent={accent}
          onClick={() => handleSelect(codeId)}
        />
      ))}
    </EquipSheet>
  );
}
