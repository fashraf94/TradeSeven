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
import {
  TrendingUp, Search, Zap, BarChart3, ArrowUpRight, Compass,
  Target, CheckCheck, Gauge, RefreshCw, ShieldAlert,
  Lock, Clock, Repeat, PieChart, Rocket,
} from 'lucide-react';
import { useFK, alpha, AreaHeader, Orb, Mono, Icon, ShelfHeader, WorkbenchBanner } from './forgeKit';
import { DNA_GROUPS, TOTAL_TRAIT_SLOTS } from '../../../data/dnaGroups';
import { TRAIT_LIBRARY } from '../../../data/traitLibrary';
import { getArchetypeDisplayName } from '../../../data/archetypeDisplay';
import { getArchetypeIdentity } from '../../../data/archetypeIdentity';
import TraitStrengthToggle from '../TraitStrengthToggle';
import DNAGroupCard from '../DNAGroupCard';
import TraitCard from '../TraitCard';

// Same lucide icon set the mobile TraitCard uses, keyed by trait.icon.
const TRAIT_ICONS = {
  TrendingUp, Search, Zap, BarChart3, ArrowUpRight, Compass,
  Target, CheckCheck, Gauge, RefreshCw, ShieldAlert,
  Lock, Clock, Repeat, PieChart, Rocket,
};
function getTraitIcon(name, props) {
  const Cmp = TRAIT_ICONS[name];
  return Cmp ? <Cmp {...props} /> : null;
}
const STRENGTH_RANK = { subtle: 1, moderate: 2, dominant: 3 };

// Desktop equipped-trait preview card: the trait's icon/name/identity, a
// strength-dots indicator + "advisory · always soft", and the standalone
// strength editor wired to the existing useTraits.setTraitStrength flow
// (battle-locked). EQUIPPED / IN-USE only — no ready/draft, no fabricated traits.
function EquippedTraitCard({ trait, accent, locked, onStrength }) {
  const T = useFK();
  const rank = STRENGTH_RANK[trait.strength] || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '14px 15px', borderRadius: 14, background: T.surface, border: `1px solid ${T.hair}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(accent, 0.12), color: accent }}>
          {getTraitIcon(trait.icon, { size: 19, color: accent }) || <Icon name="dna" size={19} color={accent} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: '-0.01em' }}>{trait.name}</div>
          {trait.identityStatement && <div style={{ fontSize: 11, color: T.ink2, marginTop: 2, lineHeight: 1.4 }}>{trait.identityStatement}</div>}
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, fontFamily: 'var(--fw-mono)', fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, color: accent, background: alpha(accent, 0.1), border: `1px solid ${alpha(accent, 0.3)}`, padding: '3px 7px', borderRadius: 999 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: accent }} />In use
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {[1, 2, 3].map((n) => (
            <span key={n} style={{ width: 6, height: 6, borderRadius: '50%', background: n <= rank ? accent : 'transparent', border: n <= rank ? 'none' : `1px solid ${T.ink3}` }} />
          ))}
          <Mono style={{ fontSize: 9.5, letterSpacing: '0.06em', color: T.ink2, textTransform: 'uppercase', marginLeft: 4 }}>{trait.strength}</Mono>
        </div>
        <Mono style={{ fontSize: 8.5, letterSpacing: '0.08em', color: T.ink3, textTransform: 'uppercase' }}>Advisory · always soft</Mono>
      </div>

      <div style={{ marginTop: 12 }}>
        <TraitStrengthToggle value={trait.strength} onChange={onStrength} color={accent} disabled={locked} />
      </div>
      {locked && <Mono style={{ fontSize: 8.5, color: T.ink3, marginTop: 6 }}>Strength locks while a battle is live.</Mono>}
    </div>
  );
}

export default function TraitsArea({ agent, agentName, primary, traits, hasActiveBattle, showToast, twoCol = false }) {
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

  // ── Desktop: archetype centerpiece (read-only identity) + the agent's REAL
  // equipped traits with in-place strength edit. No fabricated forged/draft
  // traits, no "Make ready" — authoring is a future task. ─────────────────────
  if (twoCol) {
    const equipped = traits.equippedTraits;
    return (
      <div className="fw-scroll" style={{ height: '100%', overflowY: 'auto', padding: '22px 24px calc(84px + env(safe-area-inset-bottom))' }}>
        <AreaHeader n="03" name="Traits" slotLine={`Tune the disposition layered on ${agentName || 'your agent'}'s identity`} accent={accent} />
        <WorkbenchBanner text="The polished desktop traits workbench lands next. For now, equipping and editing open the current bench." />

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', gap: 22, alignItems: 'start' }}>
          {/* LEFT — the locked archetype identity */}
          <div style={{ position: 'relative', overflow: 'hidden', padding: '20px 18px', borderRadius: 18, background: `linear-gradient(160deg, ${alpha(primary || T.teal, 0.1)}, ${T.surface})`, border: `1px solid ${alpha(primary || T.teal, 0.22)}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <Orb state="ready" size={48} color={primary || T.teal} />
              <div style={{ minWidth: 0 }}>
                <Mono style={{ fontSize: 8.5, letterSpacing: '0.14em', color: T.ink3, textTransform: 'uppercase' }}>Your agent is a</Mono>
                <div style={{ fontSize: 21, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em', marginTop: 1 }}>{archName}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: T.ink2, marginTop: 13, lineHeight: 1.5 }}>{archLine}</div>
            <div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 14, fontFamily: 'var(--fw-mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, color: T.ink3, background: alpha(T.ink2, 0.08), border: `1px solid ${T.hair}`, padding: '4px 9px', borderRadius: 999 }}>
                <Icon name="lock" size={9} color={T.ink3} stroke={2.2} />Set at creation
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.hair}` }}>
              <Icon name="sparkles" size={13} color={accent} />
              <Mono style={{ fontSize: 9.5, letterSpacing: '0.03em', color: T.ink2, lineHeight: 1.5 }}>Traits tune emphasis on top of this identity — always advisory, never hard.</Mono>
            </div>
          </div>

          {/* RIGHT — real equipped traits */}
          <div style={{ minWidth: 0 }}>
            <ShelfHeader label="Equipped traits" count={`${equipped.length} of ${TOTAL_TRAIT_SLOTS}`} />
            {equipped.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 12.5, color: T.ink3, background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 14 }}>
                No traits equipped yet — equip in the current bench.
              </div>
            ) : (
              <div className="fw-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                {equipped.map((t) => (
                  <EquippedTraitCard
                    key={t.traitId || t.id}
                    trait={t}
                    accent={accent}
                    locked={hasActiveBattle}
                    onStrength={(s) => traits.setTraitStrength(t.traitId || t.id, s)}
                  />
                ))}
              </div>
            )}
            <Mono style={{ display: 'block', marginTop: 14, fontSize: 9.5, letterSpacing: '0.04em', color: T.ink3 }}>Authoring custom traits is coming soon.</Mono>
          </div>
        </div>
      </div>
    );
  }

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
