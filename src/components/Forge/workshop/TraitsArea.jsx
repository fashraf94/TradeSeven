// src/components/Forge/workshop/TraitsArea.jsx
//
// Traits area (03) — the new frame leads with a READ-ONLY archetype banner
// (fixed identity context, "Set at creation"), a connector line, then the
// editable trait layer. The trait layer reuses the existing wired leaves
// (DNAGroupCard + TraitCard) and the useTraits hook verbatim — browse + equip
// the 16 library traits. Traits are an identity attribute managed here (they
// have no Home loadout slot), so trait equip stays in the Forge.
//
// Trait authoring + a trait "ready" lifecycle are Phase 4.

import React, { useMemo, useState } from 'react';
import { useFK, alpha, AreaHeader, Orb, Mono, Icon, ShelfHeader } from './forgeKit';
import { DNA_GROUPS } from '../../../data/dnaGroups';
import { TRAIT_LIBRARY } from '../../../data/traitLibrary';
import { getArchetypeDisplayName } from '../../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../../data/archetypeIdentity';
import DNAGroupCard from '../DNAGroupCard';
import TraitCard from '../TraitCard';

export default function TraitsArea({ agent, agentName, primary, traits, hasActiveBattle, showToast }) {
  const T = useFK();
  const accent = T.allocation;
  const [expandedDnaGroup, setExpandedDnaGroup] = useState(null);

  const archName = getArchetypeDisplayName(agent?.archetype);
  const archLine = getArchetypeIdentity(agent?.archetype)?.disposition || '';

  const traitsByGroup = useMemo(() => ({
    instincts: TRAIT_LIBRARY.filter((t) => t.dnaGroup === 'instincts'),
    strategy: TRAIT_LIBRARY.filter((t) => t.dnaGroup === 'strategy'),
    discipline: TRAIT_LIBRARY.filter((t) => t.dnaGroup === 'discipline'),
  }), []);

  return (
    <div className="fw-scroll" style={{ height: '100%', overflowY: 'auto', padding: '22px 18px calc(84px + env(safe-area-inset-bottom))' }}>
      <AreaHeader n="03" name="Traits" slotLine={`Tune the disposition layered on ${agentName || 'your agent'}'s identity`} accent={accent} />

      {/* FIXED archetype — read-only identity context, clearly locked */}
      <div style={{ position: 'relative', overflow: 'hidden', padding: '14px 15px', borderRadius: 16, marginBottom: 7, background: `linear-gradient(135deg, ${alpha(primary || T.teal, 0.08)}, ${T.surface})`, border: `1px solid ${alpha(primary || T.teal, 0.22)}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Orb state="ready" size={42} color={primary || T.teal} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Mono style={{ fontSize: 8.5, letterSpacing: '0.14em', color: T.ink3, textTransform: 'uppercase' }}>Your agent is a</Mono>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em', marginTop: 1 }}>{archName}</div>
            <div style={{ fontSize: 11, color: T.ink2, marginTop: 3, lineHeight: 1.4 }}>{archLine}</div>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--fw-mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, color: T.ink3, background: alpha(T.ink2, 0.08), border: `1px solid ${T.hair}`, padding: '4px 8px', borderRadius: 999, alignSelf: 'flex-start' }}>
            <Icon name="lock" size={9} color={T.ink3} stroke={2.2} />Set at creation
          </span>
        </div>
      </div>

      {/* the relationship — traits sit ON TOP of the locked archetype */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', marginBottom: 16 }}>
        <div style={{ width: 1, height: 14, background: T.hair2, marginLeft: 18 }} />
        <Mono style={{ fontSize: 9, letterSpacing: '0.1em', color: T.ink3, textTransform: 'uppercase' }}>Traits tune emphasis on top — always advisory, never hard</Mono>
      </div>

      <ShelfHeader label="Agent DNA · explore & equip" count={`${TRAIT_LIBRARY.length} traits`} />

      {/* editable trait layer — reused wired leaves (DNAGroupCard + TraitCard) */}
      {Object.entries(DNA_GROUPS).map(([groupId, group]) => {
        const groupTraits = traitsByGroup[groupId] || [];
        const equippedInGroup = traits.equippedTraits.filter((t) => t.dnaGroup === groupId);
        const totalRules = groupTraits.reduce((sum, t) => sum + (t.ruleIds?.length || 0), 0);
        const equippedRules = equippedInGroup.reduce((sum, t) => sum + (t.ruleIds?.length || 0), 0);
        return (
          <DNAGroupCard
            key={groupId}
            group={group}
            equippedTraits={equippedInGroup}
            slotUsage={traits.getGroupSlotUsage(groupId)}
            totalRulesInGroup={totalRules}
            equippedRuleCount={equippedRules}
            isExpanded={expandedDnaGroup === groupId}
            onToggle={() => setExpandedDnaGroup((prev) => (prev === groupId ? null : groupId))}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groupTraits.map((trait) => {
                const equipped = traits.equippedTraits.find((e) => e.traitId === trait.id);
                return (
                  <TraitCard
                    key={trait.id}
                    trait={trait}
                    isEquipped={!!equipped}
                    currentStrength={equipped?.strength || null}
                    isCustom={equipped?.isCustom || false}
                    onEquip={traits.equipTrait}
                    onUnequip={traits.unequipTrait}
                    onStrengthChange={traits.setTraitStrength}
                    onAdvancedOpen={() => showToast?.('Advanced rule editing lives in the bundle builder', accent)}
                    canEquip={traits.canEquip(trait.id)}
                    groupColor={group.color}
                    locked={hasActiveBattle}
                  />
                );
              })}
            </div>
          </DNAGroupCard>
        );
      })}

      <div style={{ marginTop: 14, padding: '11px 13px', borderRadius: 11, background: alpha(accent, 0.05), border: `1px solid ${alpha(accent, 0.18)}`, display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon name="sparkles" size={13} color={accent} />
        <Mono style={{ fontSize: 9.5, letterSpacing: '0.04em', color: T.ink2 }}>Authoring custom traits is coming soon.</Mono>
      </div>
    </div>
  );
}
