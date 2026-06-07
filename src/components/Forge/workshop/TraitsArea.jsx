// src/components/Forge/workshop/TraitsArea.jsx
//
// Traits area (03) — the new frame leads with a READ-ONLY archetype banner
// (fixed identity context, "Set at creation"), a connector line, then the
// editable trait layer.
//
// V2.2 Clarity MVP: cards browse by PUBLIC FAMILY (Temperament / Play / Preview)
// via the presentation overlay in src/data/traitFamilies.js. Families are display
// ONLY — the real slot machine stays the 3 DNA groups (≤2 each), surfaced in the
// "Slots" strip below so the family view never hides the accounting. A card's
// family can differ from the slot it fills (e.g. Sector Rotator → Play family,
// Strategy slot); each family header lists the slot groups its cards draw on.
//
// Trait authoring + a trait "ready" lifecycle are Phase 4.

import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useFK, alpha, AreaHeader, Orb, Mono, Icon, ShelfHeader } from './forgeKit';
import { DNA_GROUPS } from '../../../data/dnaGroups';
import { TRAIT_LIBRARY } from '../../../data/traitLibrary';
import { groupTraitsByFamily, getSoftConflictCopy } from '../../../data/traitFamilies';
import { buildSlotFullMessage } from '../../../utils/traitSlotSummary';
import { getArchetypeDisplayName } from '../../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../../data/archetypeIdentity';
import TraitCard from '../TraitCard';

const GROUP_ORDER = ['instincts', 'strategy', 'discipline'];

export default function TraitsArea({ agent, agentName, primary, traits, hasActiveBattle, showToast }) {
  const T = useFK();
  const accent = T.allocation;
  const [expandedFamily, setExpandedFamily] = useState(null);

  const archName = getArchetypeDisplayName(agent?.archetype);
  const archLine = getArchetypeIdentity(agent?.archetype)?.disposition || '';

  // Cards grouped by PUBLIC family (presentation only — never feeds slots/seeding).
  // Each family also carries the real slot groups its cards draw on (static; honest
  // about the Sector-Rotator-in-Play wrinkle), derived once here rather than per render.
  const families = useMemo(
    () => groupTraitsByFamily(TRAIT_LIBRARY).map((f) => ({
      ...f,
      slotGroups: [...new Set(f.traits.map((t) => DNA_GROUPS[t.dnaGroup]?.name).filter(Boolean))],
    })),
    []
  );

  // traitId → equipped entry, for per-card state + per-family counts.
  const equippedById = useMemo(() => {
    const m = new Map();
    for (const e of traits.equippedTraits) m.set(e.traitId, e);
    return m;
  }, [traits.equippedTraits]);

  // Equip, then surface a NON-BLOCKING soft-archetype-conflict heads-up (Phase 1B).
  // The equip is never blocked — this is a toast only.
  const handleEquip = async (traitId, strength) => {
    const res = await traits.equipTrait(traitId, strength);
    if (res?.success) {
      const copy = getSoftConflictCopy(traitId, agent?.archetype);
      if (copy) showToast?.(copy, accent);
    }
    return res;
  };

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', marginBottom: 14 }}>
        <div style={{ width: 1, height: 14, background: T.hair2, marginLeft: 18 }} />
        <Mono style={{ fontSize: 9, letterSpacing: '0.1em', color: T.ink3, textTransform: 'uppercase' }}>Traits tune emphasis on top — always advisory, never hard</Mono>
      </div>

      {/* Slots strip — the REAL accounting (3 groups × 2). Families are display only,
          so this stays visible: it's why a card may be un-equippable even inside a family. */}
      <div style={{ padding: '11px 13px', borderRadius: 12, marginBottom: 16, background: T.surface, border: `1px solid ${T.hair}` }}>
        <Mono style={{ fontSize: 8.5, letterSpacing: '0.12em', color: T.ink3, textTransform: 'uppercase' }}>Slots · up to 2 per group</Mono>
        <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
          {GROUP_ORDER.map((gid) => {
            const { used, max } = traits.getGroupSlotUsage(gid);
            const g = DNA_GROUPS[gid];
            const full = used >= max;
            return (
              <div key={gid} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 999, background: alpha(g.color, 0.08), border: `1px solid ${alpha(g.color, full ? 0.5 : 0.22)}` }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: g.color, opacity: used > 0 ? 1 : 0.3 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: T.ink2 }}>{g.name}</span>
                <Mono style={{ fontSize: 10, color: full ? T.ink2 : T.ink3 }}>{used}/{max}</Mono>
              </div>
            );
          })}
        </div>
      </div>

      <ShelfHeader label="Cards · explore & equip" count={`${TRAIT_LIBRARY.length} cards`} />

      {/* Editable trait layer — grouped by public family (TraitCard reused verbatim) */}
      {families.map(({ family, meta, traits: famTraits, slotGroups }) => {
        const isOpen = expandedFamily === family;
        const equippedInFamily = famTraits.filter((t) => equippedById.has(t.id)).length;
        return (
          <div key={family} style={{ marginBottom: 8 }}>
            <button
              onClick={() => setExpandedFamily((prev) => (prev === family ? null : family))}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                background: T.surface, border: 'none', borderLeft: `4px solid ${meta.accent}`,
                borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{meta.name}</div>
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 1 }}>{meta.tagline}</div>
                {slotGroups.length > 0 && (
                  <Mono style={{ fontSize: 8.5, letterSpacing: '0.08em', color: T.ink3, textTransform: 'uppercase', display: 'block', marginTop: 6 }}>
                    Fills {slotGroups.join(' + ')} slot{slotGroups.length > 1 ? 's' : ''}
                  </Mono>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <Mono style={{ fontSize: 11, color: T.ink3 }}>{equippedInFamily}/{famTraits.length}</Mono>
                <ChevronDown size={16} color={T.ink3} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
              </div>
            </button>

            {isOpen && (
              <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {famTraits.map((trait) => {
                  const equipped = equippedById.get(trait.id);
                  const canEquipVal = traits.canEquip(trait.id);
                  const blockedMessage = (!equipped && !canEquipVal)
                    ? buildSlotFullMessage(trait, traits.equippedTraits)
                    : null;
                  return (
                    <TraitCard
                      key={trait.id}
                      trait={trait}
                      isEquipped={!!equipped}
                      currentStrength={equipped?.strength || null}
                      isCustom={equipped?.isCustom || false}
                      onEquip={handleEquip}
                      onUnequip={traits.unequipTrait}
                      onStrengthChange={traits.setTraitStrength}
                      onAdvancedOpen={() => showToast?.('Advanced rule editing lives in the bundle builder', accent)}
                      canEquip={canEquipVal}
                      groupColor={meta.accent}
                      locked={hasActiveBattle}
                      blockedMessage={blockedMessage}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: 14, padding: '11px 13px', borderRadius: 11, background: alpha(accent, 0.05), border: `1px solid ${alpha(accent, 0.18)}`, display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon name="sparkles" size={13} color={accent} />
        <Mono style={{ fontSize: 9.5, letterSpacing: '0.04em', color: T.ink2 }}>Authoring custom traits is coming soon.</Mono>
      </div>
    </div>
  );
}
