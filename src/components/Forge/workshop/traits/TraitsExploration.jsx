// src/components/Forge/workshop/traits/TraitsExploration.jsx
//
// Traits → Archetype Exploration surface (the `03 Traits` redesign), behind
// TRAITS_EXPLORATION_ENABLED. Two surfaces — "Your Character" + "Explore" — on
// both viewports (desktop two-column / mobile compact), composed from the shared
// kit and wired entirely to LIVE data:
//   • identity/factors/colors  → getArchetypeCharacter (archetypeCharacter.js)
//   • equipped loadout + strength (battle-locked) → useTraits (the `traits` prop)
//   • born-with                 → ARCHETYPE_DEFAULT_TRAITS (via arch.signature)
//   • hardness                  → getTraitEnforcement (inside the kit)
//
// View ≠ commit: nothing here changes the agent except the existing strength
// toggle on its OWN equipped traits. No archetype switch, no equip/unequip, no
// authoring (the "coming soon" foreshadow is display-only).

import React, { useMemo, useState } from 'react';
import { useFK, alpha, Icon, Mono } from '../forgeKit';
import { TRAIT_LIBRARY } from '../../../../data/traitLibrary';
import { getTraitEnforcement } from '../../../../utils/traitEnforcement';
import {
  getArchetypeCharacter,
  getArchetypeRoster,
  PILLAR_ORDER,
} from '../../../../data/archetypeCharacter';
import {
  ArchBand,
  RevealVoice,
  DecisionFactors,
  DnaPillarHeader,
  LoadoutTrait,
  TraitLibCard,
  SignatureCluster,
  ViewNotCommit,
  RosterStrip,
  RosterRailItem,
  ComingSoonAuthor,
  TraitSubTabs,
  Pane,
} from './TraitsExplorationKit';

// Honest, computed library hardness count — never the mock's hardcoded literal.
const HARD_COUNT = TRAIT_LIBRARY.filter((t) => getTraitEnforcement(t.id).isEnforced).length;
const libByPillar = (p) => TRAIT_LIBRARY.filter((t) => t.dnaGroup === p);

// "Your agent" pill used on the band when viewing one's own archetype in Explore.
function OwnAgentBadge({ compact }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 5 : 6, flexShrink: 0, padding: compact ? '5px 9px' : '6px 11px', borderRadius: 999,
      background: alpha('#05060A', compact ? 0.38 : 0.4), border: `1px solid ${alpha('#fff', 0.22)}` }}>
      <Icon name="check" size={compact ? 11 : 12} color="#fff" stroke={2.4} />
      <span style={{ fontFamily: 'var(--fw-mono)', fontSize: compact ? 8.5 : 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, color: '#fff' }}>Your agent</span>
    </div>
  );
}

// ── Surface A — Your Character ────────────────────────────────────────────────
function YourCharacter({ compact, ownArch, equipped, accent, onStrength, locked, onExplore }) {
  const T = useFK();
  const c = ownArch.colors[0];
  const signature = new Set(ownArch.signature);
  const groups = PILLAR_ORDER
    .map((pillar) => ({ pillar, items: equipped.filter((t) => t.dnaGroup === pillar) }))
    .filter((g) => g.items.length > 0);

  const emptyState = (
    <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: 12.5, color: T.ink3, background: T.surface, border: `1px solid ${T.hair}`, borderRadius: 14 }}>
      No traits equipped yet — equip in the current bench.
    </div>
  );

  const loadoutGroups = (
    <>
      {groups.length === 0
        ? emptyState
        : groups.map((g, i) => (
            <div key={g.pillar} style={{ marginTop: i ? (compact ? 16 : 20) : 0 }}>
              <DnaPillarHeader pillar={g.pillar} compact={compact} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 9 : 10 }}>
                {g.items.map((t) => (
                  <LoadoutTrait
                    key={t.traitId || t.id}
                    trait={t}
                    strength={t.strength}
                    bornWith={signature.has(t.traitId || t.id)}
                    onStrength={(s) => onStrength(t.traitId || t.id, s)}
                    compact={compact}
                    locked={locked}
                  />
                ))}
              </div>
            </div>
          ))}
    </>
  );

  if (!compact) {
    return (
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}><ArchBand arch={ownArch} isOwn compact={false} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 18, alignItems: 'start' }}>
          <Pane title="How it decides" kicker="IDENTITY" accent={c} pad={20}>
            <RevealVoice arch={ownArch} accent={c} />
            <div style={{ marginTop: 22 }}><DecisionFactors arch={ownArch} accent={c} /></div>
          </Pane>
          <Pane title="Your loadout" kicker={`${equipped.length}`} accent={accent} pad={18}>
            {loadoutGroups}
          </Pane>
        </div>
      </div>
    );
  }

  return (
    <div className="fw-stagger">
      <div style={{ marginBottom: 16 }}><ArchBand arch={ownArch} isOwn compact /></div>
      <div style={{ marginBottom: 22 }}><RevealVoice arch={ownArch} compact accent={c} /></div>
      <div style={{ marginBottom: 22, padding: '2px 0' }}><DecisionFactors arch={ownArch} compact accent={c} /></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
        <Mono style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.ink2, fontWeight: 600 }}>Your loadout</Mono>
        <div style={{ flex: 1, height: 1, background: T.hair }} />
        <Mono style={{ fontSize: 9.5, color: T.ink3 }}>{equipped.length} equipped</Mono>
      </div>
      {loadoutGroups}

      <button className="fw-tap" onClick={onExplore} style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: '100%',
        display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', borderRadius: 15, marginTop: 18,
        background: `linear-gradient(135deg, ${alpha(accent, 0.1)}, ${T.surface} 70%)`, border: `1px solid ${alpha(accent, 0.3)}` }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(accent, 0.13), color: accent }}>
          <Icon name="grid" size={19} color={accent} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>Explore the roster</div>
          <div style={{ fontSize: 11.5, color: T.ink2, marginTop: 2 }}>Compare all six characters + the trait library</div>
        </div>
        <Icon name="chevR" size={16} color={accent} />
      </button>
    </div>
  );
}

// ── Surface B — Explore the roster ────────────────────────────────────────────
function ExploreRoster({ compact, roster, ownId, accent, name }) {
  const T = useFK();
  const [activeId, setActiveId] = useState(ownId);
  const arch = getArchetypeCharacter(activeId);
  const c = arch.colors[0];
  const isOwn = arch.id === ownId;
  const signature = new Set(arch.signature);

  const traitLibrary = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <Mono style={{ fontSize: compact ? 10.5 : 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.ink2, fontWeight: 600 }}>Trait library</Mono>
        <div style={{ flex: 1, height: 1, background: T.hair }} />
        <Mono style={{ fontSize: compact ? 9.5 : 10, color: T.ink3 }}>{TRAIT_LIBRARY.length} traits · {HARD_COUNT} hard {HARD_COUNT === 1 ? 'guardrail' : 'guardrails'}</Mono>
      </div>
      <div style={{ fontSize: compact ? 11.5 : 12.5, color: T.ink3, marginBottom: 16, lineHeight: 1.4 }}>
        ★ marks {arch.name}'s natural lean. Read-only here — equipping happens on the bench.
      </div>
      {PILLAR_ORDER.map((p) => (
        <div key={p} style={{ marginBottom: 18 }}>
          <DnaPillarHeader pillar={p} compact={compact} />
          <div style={compact
            ? { display: 'flex', flexDirection: 'column', gap: 9 }
            : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            {libByPillar(p).map((tr) => <TraitLibCard key={tr.id} trait={tr} compact={compact} bornWith={signature.has(tr.id)} />)}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 4 }}><ComingSoonAuthor compact={compact} /></div>
    </>
  );

  if (!compact) {
    return (
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}><ViewNotCommit compact={false} agentName={name} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '236px 1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ position: 'sticky', top: 0 }}>
            <Pane title="The roster" kicker="SIX" accent={accent} pad={10}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {roster.map((a) => <RosterRailItem key={a.id} arch={a} active={a.id === activeId} isOwn={a.id === ownId} onPick={setActiveId} />)}
              </div>
            </Pane>
          </div>
          <div key={activeId} style={{ animation: 'fwFade .25s ease both' }}>
            <div style={{ marginBottom: 16 }}>
              <ArchBand arch={arch} compact={false} right={isOwn ? <OwnAgentBadge /> : null} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start', marginBottom: 16 }}>
              <Pane title="In its words" kicker="VOICE" accent={c} pad={18}><RevealVoice arch={arch} accent={c} /></Pane>
              <Pane title="How it decides" kicker="FACTORS" accent={c} pad={18}><DecisionFactors arch={arch} accent={c} /></Pane>
            </div>
            <div style={{ marginBottom: 20 }}><SignatureCluster arch={arch} compact={false} /></div>
            {traitLibrary}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 13 }}><ViewNotCommit compact agentName={name} /></div>
      <div style={{ marginBottom: 18 }}><RosterStrip roster={roster} activeId={activeId} onPick={setActiveId} compact ownId={ownId} /></div>
      <div key={activeId} style={{ animation: 'fwFade .25s ease both' }}>
        <div style={{ marginBottom: 16 }}>
          <ArchBand arch={arch} compact right={isOwn ? <OwnAgentBadge compact /> : null} />
        </div>
        <div style={{ marginBottom: 22 }}><RevealVoice arch={arch} compact accent={c} /></div>
        <div style={{ marginBottom: 20 }}><DecisionFactors arch={arch} compact accent={c} /></div>
        <div style={{ marginBottom: 24 }}><SignatureCluster arch={arch} compact /></div>
        {traitLibrary}
      </div>
    </div>
  );
}

export default function TraitsExploration({ agent, agentName, traits, hasActiveBattle, twoCol = false }) {
  const T = useFK();
  const accent = T.allocation;
  const compact = !twoCol;
  const [sub, setSub] = useState('character');

  const ownArch = useMemo(() => getArchetypeCharacter(agent?.archetype), [agent?.archetype]);
  const roster = useMemo(() => getArchetypeRoster(), []);
  const equipped = traits?.equippedTraits || [];
  const name = agentName || agent?.name || 'your agent';
  const onStrength = (traitId, s) => traits?.setTraitStrength?.(traitId, s);

  return (
    <div className="fw-scroll" style={{ height: '100%', overflowY: 'auto', padding: compact ? '22px 18px calc(84px + env(safe-area-inset-bottom))' : '22px 24px calc(84px + env(safe-area-inset-bottom))' }}>
      {/* header + sub-tabs */}
      <div style={compact
        ? { marginBottom: 16 }
        : { maxWidth: sub === 'character' ? 1120 : 1180, margin: '0 auto 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <Mono style={{ fontSize: compact ? 12 : 13, letterSpacing: '0.14em', color: accent, fontWeight: 700 }}>03</Mono>
            <div style={{ fontSize: compact ? 23 : 26, fontWeight: 700, letterSpacing: '-0.02em', color: T.ink }}>Traits</div>
          </div>
          <div style={{ fontSize: compact ? 12 : 13, color: T.ink2, marginTop: 5 }}>
            The disposition layered on {name}'s identity{compact ? '' : ' — a character you can read and explore.'}
          </div>
        </div>
        <div style={compact ? { marginTop: 16 } : { width: 320, flexShrink: 0 }}>
          <TraitSubTabs value={sub} onChange={setSub} accent={accent} compact={compact} />
        </div>
      </div>

      {sub === 'character'
        ? <YourCharacter compact={compact} ownArch={ownArch} equipped={equipped} accent={accent} onStrength={onStrength} locked={hasActiveBattle} onExplore={() => setSub('explore')} />
        : <ExploreRoster compact={compact} roster={roster} ownId={ownArch.id} accent={accent} name={name} />}
    </div>
  );
}
