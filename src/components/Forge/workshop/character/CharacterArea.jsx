// src/components/Forge/workshop/character/CharacterArea.jsx
//
// Release 3 — the Forge's `03 Character` surface (behind RELEASE3_CHARACTER_TAB_
// ENABLED). Replaces the interactive trait mechanism with the real loadout:
// BORN WITH (read-only) · STANDING LEANS (equip/unequip, 2 slots) · TEMPO (the
// dial), plus a derived behavior fingerprint and the five states. Keeps the
// archetype identity reading (ArchBand + RevealVoice + DecisionFactors), the
// roster rail, and the read-only Explore banner. All state derives from the real
// backend via resolveCharacterState; every write goes through the live Release 2
// endpoints and the subscription re-delivers the winning state.

import React from 'react';
import { useFK, Mono } from '../forgeKit.jsx';
import {
  ArchBand, RevealVoice, DecisionFactors, RosterRailItem, RosterStrip, ViewNotCommit, Pane, TraitSubTabs,
} from '../traits/TraitsExplorationKit.jsx';
import {
  Fingerprint, TempoControl, BornWithKit, LeanSlots, LeanEntry, StateNotice, BattleSnapshot, LoadoutSubHead,
} from './CharacterKit.jsx';
import { getArchetypeCharacter, getArchetypeRoster } from '../../../../data/archetypeCharacter.js';
import { ARCHETYPE_ADJUSTMENTS, getAdjustment, getCanonicalText, getCanonicalTextVersion, findEquipConflicts } from '../../../../data/archetypeAdjustments.js';
import { resolveCharacterState, CHARACTER_STATES } from '../../../../data/characterState.js';
import { STANDING_LEANS_CAP, LEAN_INVALIDATION_REASONS } from '../../../../../api/_utils/leanRevalidation.js';
import { STANDING_LEANS_ENABLED, TEMPO_DIAL_ENABLED } from '../../../../config/featureFlags.js';
import { equipLean, unequipLean, setTempoDial } from '../../../../services/agentService.js';
import { TRAIT_BY_ID } from '../../../../data/traitLibrary.js';

const menuFor = (codeId) => (ARCHETYPE_ADJUSTMENTS[codeId]?.adjustments || []);

export default function CharacterArea({ agent, agentName, traits, twoCol = false, showToast }) {
  const T = useFK();
  const compact = !twoCol;
  const [sub, setSub] = React.useState('character');
  const ownArch = getArchetypeCharacter(agent?.archetype);
  const roster = getArchetypeRoster();
  const name = agentName || agent?.name || 'your agent';

  return (
    <div>
      <div style={{ maxWidth: sub === 'character' ? 1160 : 1180, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <Mono style={{ fontSize: compact ? 12 : 13, fontWeight: 700, letterSpacing: '0.14em', color: T.allocation }}>03</Mono>
            <div style={{ fontSize: compact ? 23 : 26, fontWeight: 700, letterSpacing: '-0.02em', color: T.ink }}>Character</div>
          </div>
          <div style={{ fontSize: compact ? 12 : 13, color: T.ink2, marginTop: 5, maxWidth: 620, lineHeight: 1.5 }}>The disposition layered on {name}'s identity — a character you can read, tune, and explore.</div>
        </div>
        <div style={{ width: compact ? '100%' : 320, flexShrink: 0 }}>
          <TraitSubTabs value={sub === 'character' ? 'character' : 'explore'} onChange={(v) => setSub(v)} accent={T.allocation} compact={compact} />
        </div>
      </div>

      {sub === 'character'
        ? <YourCharacter agent={agent} agentName={name} ownArch={ownArch} traits={traits} compact={compact} showToast={showToast} />
        : <ExploreRoster roster={roster} ownId={ownArch.id} agentName={name} compact={compact} />}
    </div>
  );
}

// ── Surface A — Your Character (identity + real loadout + fingerprint) ─────────
function YourCharacter({ agent, agentName, ownArch, traits, compact, showToast }) {
  const T = useFK();
  const c = ownArch.colors[0];
  const archId = ownArch.id;
  const menu = menuFor(archId);
  // In-flight action ids (a Set, so concurrent actions don't clear each other).
  const [busyIds, setBusyIds] = React.useState(() => new Set());
  const addBusy = (id) => setBusyIds((s) => { const n = new Set(s); n.add(id); return n; });
  const removeBusy = (id) => setBusyIds((s) => { const n = new Set(s); n.delete(id); return n; });

  const standingLeans = agent?.standingLeans || [];
  const desiredTempo = agent?.dials?.tempo || 'standard';

  // Optimistic tempo — the dial + fingerprint reshape instantly; the subscription
  // reconciles it once the write lands, and a failed write visibly reverts (never
  // a silent snap-back — the revert is paired with an error toast).
  const [optimisticTempo, setOptimisticTempo] = React.useState(null);
  React.useEffect(() => {
    if (optimisticTempo && desiredTempo === optimisticTempo) setOptimisticTempo(null);
  }, [desiredTempo, optimisticTempo]);
  const shownTempo = optimisticTempo || desiredTempo;

  // The pure resolver — the single source for state + lean validity + effective tempo.
  const cs = resolveCharacterState({
    leansEnabled: STANDING_LEANS_ENABLED,
    dialEnabled: TEMPO_DIAL_ENABLED,
    activeBattleId: agent?.activeBattleId || null,
    archetype: archId,
    standingLeans,
    tempo: desiredTempo,
  });
  const locked = cs.isBattleLocked;
  const validById = new Map(cs.leans.valid.map((l) => [l.adjustmentId, l]));
  const invalidById = new Map(cs.leans.invalidated.map((l) => [l.adjustmentId, l]));
  const validIds = cs.leans.valid.map((l) => l.adjustmentId);
  const staleIds = new Set(cs.leans.invalidated.filter((l) => l.reason === LEAN_INVALIDATION_REASONS.DEPRECATED_VERSION).map((l) => l.adjustmentId));

  // Slot occupancy tracks the RAW standing-leans count — the server's cap authority
  // counts every pin (valid, stale, or didn't-carry), so the client must too, or it
  // would offer an Equip the server rejects with lean_limit. Each raw pin renders in
  // a slot with a Clear action, so a stranded pin can always be freed.
  const slotsFull = standingLeans.length >= STANDING_LEANS_CAP;
  const slotPins = standingLeans.map((raw) => {
    const v = validById.get(raw.adjustmentId);
    if (v) return { ...v, slotState: 'valid' };
    const reason = invalidById.get(raw.adjustmentId)?.reason;
    if (reason === LEAN_INVALIDATION_REASONS.DEPRECATED_VERSION) {
      return { adjustmentId: raw.adjustmentId, version: raw.version, slotState: 'stale', text: getCanonicalText(archId, raw.adjustmentId) };
    }
    return { adjustmentId: raw.adjustmentId, version: raw.version, slotState: 'dropped' };
  });

  // equipped leans enriched with policy (for the fingerprint annotation)
  const equippedLeans = cs.leans.valid.map((l) => ({ ...l, policy: getAdjustment(archId, l.adjustmentId)?.policy }));
  const droppedCount = cs.leans.invalidated.filter((l) => l.reason === LEAN_INVALIDATION_REASONS.NOT_IN_MENU).length;

  const entryState = (adj) => {
    if (staleIds.has(adj.id)) return 'stale';
    if (validIds.includes(adj.id)) return 'equipped';
    const conflicts = findEquipConflicts(archId, adj.id, validIds);
    if (conflicts.length) return 'blocked';
    return 'available';
  };
  const blockedBy = (adj) => findEquipConflicts(archId, adj.id, validIds)[0] || null;

  const toast = (msg) => (showToast ? showToast(msg) : undefined);
  const toastErr = (err) => {
    if (err?.code === 'not_found') toast('This control isn\'t live yet.');
    else if (err?.code === 'battle_active') toast('Locked while a battle is live.');
    else if (err?.code === 'conflicting_lean') toast('That lean conflicts with one you already have.');
    else if (err?.code === 'lean_limit') toast('Both slots are full — clear one first.');
    else if (err?.code === 'deprecated_version') toast('That lean was revised — re-confirm the current wording.');
    else toast(err?.message || 'Could not update the loadout.');
  };
  const run = async (id, fn) => {
    if (locked) return toast('Locked while a battle is live.');
    addBusy(id);
    try {
      await fn();
      // agent doc re-delivers via the live subscription; nothing to set locally.
    } catch (err) {
      toastErr(err);
    } finally {
      removeBusy(id);
    }
  };
  const equip = (id) => run(id, () => equipLean(agent.id, id, getCanonicalTextVersion(archId, id)));
  const remove = (id) => run(id, () => unequipLean(agent.id, id));
  const reconfirm = (id) => run(id, () => equipLean(agent.id, id, getCanonicalTextVersion(archId, id)));

  // Tempo is optimistic: reflect the new position immediately; on failure, revert
  // the optimistic value (dial + fingerprint snap back) AND surface the error.
  const changeTempo = (id) => {
    if (locked) return toast('Locked while a battle is live.');
    if (id === desiredTempo) return;
    setOptimisticTempo(id);
    addBusy(`tempo:${id}`);
    setTempoDial(agent.id, id)
      .catch((err) => { setOptimisticTempo(null); toastErr(err); })
      .finally(() => removeBusy(`tempo:${id}`));
  };

  const menuRef = React.useRef(null);
  const focusMenu = () => { if (menuRef.current) menuRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

  const fingerprint = (
    <Fingerprint archId={archId} archName={ownArch.name} accent={c}
      tempo={shownTempo} liveTempo={cs.tempo.effective} equippedLeans={equippedLeans}
      compact={compact} barFallback={compact} />
  );

  const loadout = (
    <>
      {locked && <div style={{ marginBottom: 18 }}><BattleSnapshot leans={cs.leans.valid} tempo={cs.tempo.effective} compact={compact} /></div>}

      <LoadoutSubHead icon="star" title="Born with" meta="Read-only" accent={T.gold} compact={compact} />
      <BornWithKit archName={ownArch.name} equippedTraits={traits?.equippedTraits || []} signatureIds={ownArch.signature || []} compact={compact} />

      <div style={{ marginTop: 26 }} ref={menuRef}>
        <LoadoutSubHead icon="sliders" title="Standing leans" meta={`${standingLeans.length} / ${STANDING_LEANS_CAP} slots`} compact={compact} />
        <LeanSlots pins={slotPins} archName={ownArch.name} locked={locked} onRemove={remove} onFocusMenu={focusMenu} compact={compact} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '18px 0 12px' }}>
          <Mono style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.ink2, fontWeight: 600 }}>{ownArch.name} menu</Mono>
          <div style={{ flex: 1, height: 1, background: T.hair }} />
          <Mono style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>{menu.length} leans · directive shown verbatim</Mono>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {menu.map((adj) => (
            <LeanEntry key={adj.id} archId={archId} lean={adj} state={entryState(adj)} blockedBy={blockedBy(adj)}
              slotsFull={slotsFull} locked={locked} busy={busyIds.has(adj.id)}
              onEquip={equip} onRemove={remove} onReconfirm={reconfirm} compact={compact} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 26 }}>
        <LoadoutSubHead icon="compass" title="Tempo" meta="Drives the fingerprint" compact={compact} />
        <TempoControl archId={archId} archName={ownArch.name} value={shownTempo} onChange={changeTempo} locked={locked} compact={compact} />
      </div>
    </>
  );

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}><ArchBand arch={ownArch} isOwn compact={compact} /></div>
      {cs.state !== CHARACTER_STATES.LIVE && (
        <div style={{ marginBottom: 16 }}>
          <StateNotice state={cs.state} archName={ownArch.name} agentName={agentName} droppedCount={droppedCount} pending={cs.pending} compact={compact} />
        </div>
      )}

      {compact ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Pane title="How it decides" kicker="IDENTITY" accent={c} pad={16}>
            <RevealVoice arch={ownArch} accent={c} compact />
            <div style={{ marginTop: 18 }}><DecisionFactors arch={ownArch} accent={c} compact /></div>
          </Pane>
          <Pane title="Your loadout" kicker="TUNE" accent={T.allocation} pad={16}>{loadout}</Pane>
          <Pane title="Behavior fingerprint" kicker="WHAT THIS CHANGES" accent={c} pad={16}>{fingerprint}</Pane>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.02fr 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Pane title="How it decides" kicker="IDENTITY" accent={c} pad={20}>
              <RevealVoice arch={ownArch} accent={c} />
              <div style={{ marginTop: 22 }}><DecisionFactors arch={ownArch} accent={c} /></div>
            </Pane>
            <div style={{ position: 'sticky', top: 0 }}>
              <Pane title="Behavior fingerprint" kicker="WHAT THIS CHANGES" accent={c} pad={18}>{fingerprint}</Pane>
            </div>
          </div>
          <Pane title="Your loadout" kicker="TUNE" accent={T.allocation} pad={18}>{loadout}</Pane>
        </div>
      )}
    </div>
  );
}

// ── Surface B — Explore (read-only roster reader; trait library removed) ───────
function ExploreRoster({ roster, ownId, agentName, compact }) {
  const T = useFK();
  const [activeId, setActiveId] = React.useState(ownId);
  const arch = getArchetypeCharacter(activeId);
  const c = arch.colors[0];
  const isOwn = activeId === ownId;
  // The archetype's declared born-with kit (signature → trait defs), read-only.
  const kit = (arch.signature || []).map((id) => TRAIT_BY_ID[id]).filter(Boolean).map((tr) => ({ id: tr.id, name: tr.name, identityStatement: tr.identityStatement }));

  const reader = (
    <>
      <div style={{ marginBottom: 16 }}>
        <ArchBand arch={arch} isOwn={isOwn} compact={compact} />
      </div>
      <div style={{ display: compact ? 'flex' : 'grid', flexDirection: 'column', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start', marginBottom: 16 }}>
        <Pane title="In its words" kicker="VOICE" accent={c} pad={compact ? 16 : 18}><RevealVoice arch={arch} accent={c} compact={compact} /></Pane>
        <Pane title="How it decides" kicker="FACTORS" accent={c} pad={compact ? 16 : 18}><DecisionFactors arch={arch} accent={c} compact={compact} /></Pane>
      </div>
      <div style={{ display: compact ? 'flex' : 'grid', flexDirection: 'column', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <Pane title="Born with" kicker="ITS KIT" accent={T.gold} pad={compact ? 16 : 18}>
          <BornWithKit archName={arch.name} equippedTraits={kit} signatureIds={arch.signature || []} compact={compact} />
        </Pane>
        <Pane title="Behavior fingerprint" kicker="DISPOSITION" accent={c} pad={compact ? 16 : 18}>
          <Fingerprint archId={arch.id} archName={arch.name} accent={c} tempo="standard" liveTempo="standard" readonly compact barFallback={compact} />
        </Pane>
      </div>
    </>
  );

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}><ViewNotCommit compact={compact} agentName={agentName} /></div>
      {compact ? (
        <div>
          <div style={{ marginBottom: 14 }}><RosterStrip roster={roster} activeId={activeId} onPick={setActiveId} compact ownId={ownId} /></div>
          <div key={activeId} style={{ animation: 'fwFade .25s ease both' }}>{reader}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '236px 1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ position: 'sticky', top: 0 }}>
            <Pane title="The roster" kicker="SIX" accent={T.allocation} pad={10}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {roster.map((a) => <RosterRailItem key={a.id} arch={a} active={a.id === activeId} isOwn={a.id === ownId} onPick={setActiveId} />)}
              </div>
            </Pane>
          </div>
          <div key={activeId} style={{ animation: 'fwFade .25s ease both' }}>{reader}</div>
        </div>
      )}
    </div>
  );
}
