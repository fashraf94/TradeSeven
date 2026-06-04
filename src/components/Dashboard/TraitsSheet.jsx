// src/components/Dashboard/TraitsSheet.jsx
//
// Equip-only Traits surface for the Equip station's third slot (replaces the old
// rule-bundle picker). Opens as an EquipSheet (bottom sheet on mobile, center
// modal on desktop) via the same children-slot pattern ArchetypePicker uses, so
// it inherits the dock/motion/backdrop/header. Reads + mutates the agent's traits
// through the shared useTraits hook, fed the parent's single useForge instance.
//
// Equip-only by design — NO strength control. Strength is partial (it bakes into
// paramValues but does not change a rule's hard/soft injection), and the whole
// trait→rule mechanism is slated to retire, so a dial would imply a hardness
// lever that doesn't exist. Traits stay at the seeded 'moderate'.
//
// "Enforced" badge: a trait whose rules include any risk/allocation rule injects
// as a hard CONSTRAINT in decide.js (vs a soft preference). traitEnforcement
// surfaces that honestly — a neutral pill, never red (red is reserved for downside).
//
// Tokens: CMD / alpha from commandUI (the dashboard subtree's source, mirroring
// DARK_TOKENS), matching the equip-row siblings + ArchetypePicker — not useTheme().

import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck } from 'lucide-react';
import EquipSheet from './EquipSheet';
import { CMD, alpha, MONO, Eyebrow, Mono, readableOn, ErrorBanner } from './commandUI';
import { useTraits } from '../../hooks/useTraits';
import { DNA_GROUPS } from '../../data/dnaGroups';
import { getTraitsForGroup } from '../../data/traitLibrary';
import { getTraitEnforcement } from '../../utils/traitEnforcement';

// equipTrait / unequipTrait error code → copy. `battle_active` is armed in Phase 3
// (the useTraits battle-lock); the rest are returned by equipTrait today.
const ERROR_COPY = {
  battle_active: "Can't change traits while a battle is live — changes apply to your next deploy.",
  slots_full: 'That DNA group is full (2 max). Unequip one to make room.',
  already_equipped: 'That trait is already equipped.',
  rule_creation_failed: "Couldn't equip that trait. Please try again.",
};
const errorCopy = (code) => ERROR_COPY[code] || "Couldn't update that trait. Please try again.";

// Neutral "enforced" pill — risk/allocation rules inject as hard constraints.
// Neutral (ink on a hairline), never red: red is reserved for downside.
function EnforcedPill() {
  return (
    <span
      title="This trait arms a hard constraint (risk/allocation) your agent must obey — not just a preference."
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
        padding: '2px 7px', borderRadius: 999,
        background: alpha('#FFFFFF', 0.05), border: `1px solid ${CMD.hair2}`,
        color: CMD.ink2, fontFamily: MONO, fontSize: 9, fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}
    >
      <ShieldCheck size={10.5} color={CMD.ink2} /> Enforced
    </span>
  );
}

// One trait row — name + identity statement + optional enforced pill, with a
// single Equip/Unequip action. Light card (CMD tokens), no strength control.
function TraitRow({ trait, enforced, equipped, busy, disabled, accent, onAction }) {
  const inert = busy || disabled;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', marginBottom: 8, borderRadius: 13,
        background: equipped ? alpha(accent, 0.08) : CMD.surface,
        border: `1px solid ${equipped ? alpha(accent, 0.32) : CMD.hair}`,
        opacity: !equipped && disabled && !busy ? 0.5 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: CMD.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trait.name}</span>
          {enforced && <EnforcedPill />}
        </div>
        <div style={{ fontSize: 11.5, color: CMD.ink2, marginTop: 3, lineHeight: 1.4 }}>{trait.identityStatement}</div>
      </div>
      <button
        type="button"
        onClick={inert ? undefined : onAction}
        disabled={inert}
        style={{
          all: 'unset', boxSizing: 'border-box', flexShrink: 0, textAlign: 'center',
          padding: '7px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
          cursor: inert ? 'default' : 'pointer',
          ...(equipped
            ? { color: CMD.ink2, border: `1px solid ${CMD.hair2}`, background: 'transparent' }
            : { color: readableOn(accent), background: accent }),
        }}
      >
        {busy ? '…' : equipped ? 'Unequip' : 'Equip'}
      </button>
    </div>
  );
}

// DNA-group header — surfaces the 2-per-group cap ("1 of 2", "2 of 2 · full").
function GroupHeader({ name, used, max }) {
  const full = used >= max;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 2px 8px' }}>
      <Eyebrow color={CMD.ink2}>{name}</Eyebrow>
      <Mono style={{ fontSize: 10, color: full ? CMD.ink2 : CMD.ink3 }}>{used} of {max}{full ? ' · full' : ''}</Mono>
    </div>
  );
}

export default function TraitsSheet({ open, onClose, agent, accent, dock = 'bottom', forge }) {
  const agentId = agent?.id;
  const { equippedTraits, equipTrait, unequipTrait, getGroupSlotUsage, canEquip } = useTraits(agentId, forge);

  const [error, setError] = useState(null);
  const [working, setWorking] = useState(null); // traitId mid-write, or null
  // Bumped on close so a write that resolves after the sheet closed can't setState
  // a stale error/working flag into the next open (mirrors ArchetypePicker).
  const sessionRef = useRef(0);
  useEffect(() => {
    if (!open) { sessionRef.current += 1; setError(null); setWorking(null); }
  }, [open]);

  // Run an equip/unequip write with single-flight + post-close guards. Handles both
  // the {success,error} shape (equipTrait, and unequipTrait once Phase 3 lands) and
  // a void return (unequipTrait today) — a void result simply surfaces no error.
  const run = async (traitId, fn) => {
    if (working) return;
    const session = sessionRef.current;
    setError(null);
    setWorking(traitId);
    try {
      const result = await fn(traitId);
      if (sessionRef.current !== session) return; // sheet closed mid-flight — drop it
      if (result && result.success === false) setError(errorCopy(result.error));
    } catch (err) {
      if (sessionRef.current !== session) return;
      console.error('[TraitsSheet] trait write failed:', err);
      setError("Couldn't update that trait. Please try again.");
    } finally {
      if (sessionRef.current === session) setWorking(null);
    }
  };

  const equippedIds = new Set(equippedTraits.map((t) => t.traitId));

  return (
    <EquipSheet
      open={open}
      onClose={onClose}
      dock={dock}
      title="Traits"
      subtitle="Equip traits to shape how your agent reads the market. Changes apply on your next deploy."
      accent={accent}
    >
      {error && <ErrorBanner style={{ margin: '2px 0 12px' }}>{error}</ErrorBanner>}

      {equippedTraits.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <Eyebrow color={CMD.ink3} style={{ margin: '0 2px 9px' }}>Equipped · {equippedTraits.length}</Eyebrow>
          {equippedTraits.map((t) => (
            <TraitRow
              key={t.traitId}
              trait={t}
              enforced={getTraitEnforcement(t.traitId).isEnforced}
              equipped
              busy={working === t.traitId}
              disabled={Boolean(working)}
              accent={accent}
              onAction={() => run(t.traitId, unequipTrait)}
            />
          ))}
        </div>
      )}

      <Eyebrow color={CMD.ink3} style={{ margin: '0 2px 9px' }}>Add a trait</Eyebrow>
      {Object.values(DNA_GROUPS).map((group) => {
        const { used, max } = getGroupSlotUsage(group.id);
        const candidates = getTraitsForGroup(group.id).filter((t) => !equippedIds.has(t.id));
        if (candidates.length === 0) return null;
        return (
          <div key={group.id} style={{ marginBottom: 14 }}>
            <GroupHeader name={group.name} used={used} max={max} />
            {candidates.map((t) => (
              <TraitRow
                key={t.id}
                trait={t}
                enforced={getTraitEnforcement(t.id).isEnforced}
                equipped={false}
                busy={working === t.id}
                disabled={Boolean(working) || !canEquip(t.id)}
                accent={accent}
                onAction={() => run(t.id, equipTrait)}
              />
            ))}
          </div>
        );
      })}
    </EquipSheet>
  );
}
