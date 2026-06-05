// src/components/Forge/workshop/BundleBuildFlow.jsx
//
// The rule-bundle build flow — the one stepper FRAME (Browse → Assemble →
// Hard/Soft → Finalize) wrapping the existing wired rule browser
// (CategoryAccordion) and bundle model (useForge). The working artifact is a
// draft bundle; "Forge ready" runs forgeBundleFn (draft → forged).
//
// Hard/Soft is the design's hero — in Phase 1 it is shown DERIVED FROM CATEGORY
// (risk/allocation = hard) as informative display only, read through
// hardSoftHelper so Phase 3's authored override is a data change here.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFK, alpha, Icon, Mono, Eyebrow, Tag, StageRail, ForgeButton, MixMeter } from './forgeKit';
import CategoryAccordion from '../CategoryAccordion';
import { CATEGORY_ORDER } from '../../../hooks/useForge';
import { FORGE_RULE_TEMPLATES } from '../../../data/forgeKnowledgeBase';
import { isHardRule, bundleHardSoftCounts, bundleRuleHardness, classifyRuleHardSoft, ruleCategory } from './hardSoftHelper';
import { FORGE_HARDSOFT_AUTHORING_ENABLED } from '../../../config/featureFlags';

const STAGES = ['Browse', 'Assemble', 'Hard / Soft', 'Finalize'];
const LEADS = [
  { kicker: 'Stage 1 · Browse', title: 'Pick the rules', sub: 'Browse the library and add what fits. Risk & allocation rules become hard limits; the rest are preferences.' },
  { kicker: 'Stage 2 · Assemble', title: 'Name & review', sub: 'Name the bundle and trim the rules you gathered.' },
  { kicker: 'Stage 3 · Hard / Soft', title: 'Preference, or hard limit?', sub: FORGE_HARDSOFT_AUTHORING_ENABLED
    ? "A bundle's one differentiator: which rules are preferences your agent leans on, and which are hard limits it must follow."
    : "A bundle's one differentiator: which rules your agent must follow, and which it just leans on. Derived from category for now." },
  { kicker: 'Stage 4 · Finalize', title: 'Forge it ready', sub: 'Review the mix, then temper it. Ready bundles appear in your slot pickers at home.' },
];

function StageLead({ kicker, title, sub, accent }) {
  const T = useFK();
  return (
    <div style={{ marginBottom: 16 }}>
      <Mono style={{ fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: accent, fontWeight: 600 }}>{kicker}</Mono>
      <div style={{ fontSize: 19, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em', marginTop: 5 }}>{title}</div>
      {sub && <div style={{ fontSize: 12.5, color: T.ink2, marginTop: 5, lineHeight: 1.45 }}>{sub}</div>}
    </div>
  );
}

// The prominent per-rule hard/soft control — the design's hero. Weightier than
// a plain toggle: a two-up SOFT / HARD segmented control, HARD tinted red with a
// lock. Gated behind FORGE_HARDSOFT_AUTHORING_ENABLED until the fenced prompt
// path honors the authored override.
function BigHardSoft({ isHard, onToggle }) {
  const T = useFK();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <button className="fw-tap" onClick={() => onToggle(false)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 10, background: !isHard ? alpha(T.ink2, 0.14) : 'transparent', border: `1px solid ${!isHard ? T.hair2 : T.hair}` }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: alpha(T.ink2, 0.6) }} />
        <Mono style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, color: !isHard ? T.ink : T.ink3 }}>Soft</Mono>
      </button>
      <button className="fw-tap" onClick={() => onToggle(true)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 10, background: isHard ? alpha(T.risk, 0.16) : 'transparent', border: `1px solid ${isHard ? alpha(T.risk, 0.5) : T.hair}` }}>
        <Icon name="lock" size={13} color={isHard ? T.risk : T.ink3} stroke={2.3} />
        <Mono style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, color: isHard ? T.risk : T.ink3 }}>Hard</Mono>
      </button>
    </div>
  );
}

export default function BundleBuildFlow({ forge, hasActiveBattle, onClose, onFinalized, showToast }) {
  const T = useFK();
  const accent = T.gold;
  const [stage, setStage] = useState(0);
  const [workingBundleId, setWorkingBundleId] = useState(null);
  const [name, setName] = useState('');
  const [configRuleId, setConfigRuleId] = useState(null);
  const [capReached, setCapReached] = useState(false);
  const initRef = useRef(false);

  // Ensure a working draft bundle exists (reuse one, else create one).
  useEffect(() => {
    if (initRef.current || forge.loading) return;
    initRef.current = true;
    const existing = forge.draftBundles[0];
    if (existing) {
      setWorkingBundleId(existing.id);
      setName(existing.name || '');
    } else {
      forge.createNewBundle('New Bundle').then((id) => {
        if (id) { setWorkingBundleId(id); setName('New Bundle'); }
        else { setCapReached(true); } // 5-bundle cap: no working draft available
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forge.loading]);

  const workingBundle = useMemo(
    () => forge.bundles.find((b) => b.id === workingBundleId) || null,
    [forge.bundles, workingBundleId],
  );

  // Map of the working bundle's rule docs by their template id (sourceRef), so
  // the template-driven CategoryAccordion shows equipped state + removes right.
  const ruleDocByTemplate = useMemo(() => {
    const map = new Map();
    const ids = new Set(workingBundle?.ruleIds || []);
    forge.rules.forEach((r) => { if (ids.has(r.id) && r.sourceRef) map.set(r.sourceRef, r.id); });
    return map;
  }, [forge.rules, workingBundle]);
  const equippedTemplateIds = useMemo(() => new Set(ruleDocByTemplate.keys()), [ruleDocByTemplate]);

  // Resolved rule docs in the working bundle (for Assemble + Hard/Soft).
  const bundleRules = useMemo(() => {
    const ids = workingBundle?.ruleIds || [];
    return ids.map((id) => forge.rules.find((r) => r.id === id)).filter(Boolean);
  }, [forge.rules, workingBundle]);

  const rulesById = useMemo(() => new Map(forge.rules.map((r) => [r.id, r])), [forge.rules]);
  const counts = bundleHardSoftCounts(workingBundle || { ruleIds: [] }, rulesById);

  // Rule library sections (clash scope — season categories are shelved).
  const sections = useMemo(() => {
    return CATEGORY_ORDER.map((catId) => {
      const catMeta = forge.categories.find((c) => c.id === catId);
      if (!catMeta) return null;
      if (catMeta.mode !== 'clash' && catMeta.mode !== 'both') return null;
      const all = forge.templatesByCategory[catId] || [];
      const rules = all.filter((r) => !r.modes || r.modes === 'clash' || r.modes === 'both');
      return { category: catMeta, rules };
    }).filter(Boolean);
  }, [forge.categories, forge.templatesByCategory]);

  const handleAddRule = async (templateId, paramValues) => {
    if (hasActiveBattle) { showToast?.('Changes apply to your next battle.'); return; }
    // Guard: without a tracked working bundle, addRuleToBundle would fall through
    // to its own draft-creating path (which bypasses the 5-bundle cap) and the
    // result would be invisible/unremovable here.
    if (!workingBundleId) return;
    const template = FORGE_RULE_TEMPLATES.find((t) => t.id === templateId);
    if (template) { await forge.addRuleToBundle(template, paramValues); setConfigRuleId(null); }
  };
  const handleRemoveRule = async (templateId) => {
    if (hasActiveBattle) { showToast?.('Changes apply to your next battle.'); return; }
    const docId = ruleDocByTemplate.get(templateId);
    if (docId && workingBundleId) await forge.removeRuleFromBundle(workingBundleId, docId);
  };

  // Author a per-rule hard/soft override. Store only genuine overrides: when the
  // chosen value equals the rule's category default, clear it (null) so a bundle
  // with no real overrides keeps an empty ruleHardness map → byte-identical to
  // today's category-derived behavior until a user explicitly diverges.
  const handleSetHardness = async (rule, makeHard) => {
    if (hasActiveBattle) { showToast?.('Changes apply to your next battle.'); return; }
    if (!workingBundleId || !rule?.id) return;
    const desired = makeHard ? 'hard' : 'soft';
    const dflt = classifyRuleHardSoft(ruleCategory(rule));
    await forge.setRuleHardness(workingBundleId, rule.id, desired === dflt ? null : desired);
  };

  const commitName = () => {
    const trimmed = name.trim();
    if (workingBundleId && trimmed && trimmed !== workingBundle?.name) {
      forge.renameDraftBundle(workingBundleId, trimmed);
    }
  };

  const ruleCount = workingBundle?.ruleIds?.length || 0;
  const canAdvance = [ruleCount > 0, name.trim().length > 0, true][stage];
  const canFinalize = ruleCount > 0;
  const last = STAGES.length - 1;

  const finalize = async () => {
    if (!canFinalize || !workingBundleId) return;
    commitName();
    await forge.forgeBundleFn(workingBundleId);
    onFinalized?.(name.trim() || 'Rule bundle');
  };

  // ── stage bodies ──
  const renderBrowse = () => (
    <div>
      {sections.map(({ category, rules }) => (
        <CategoryAccordion
          key={category.id}
          category={category}
          rules={rules}
          equippedRuleIds={equippedTemplateIds}
          isExpanded={forge.expandedAccordions.has(category.id)}
          onToggle={() => forge.toggleAccordion(category.id)}
          onAddRule={handleAddRule}
          onRemoveRule={handleRemoveRule}
          agentExists
          expandedRuleId={configRuleId}
          onToggleRuleConfig={(id) => setConfigRuleId((prev) => (prev === id ? null : id))}
          forgeMode="clash"
        />
      ))}
    </div>
  );

  const renderAssemble = () => (
    <div className="fw-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Eyebrow color={T.ink2} style={{ marginBottom: 8 }}>Name this bundle</Eyebrow>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 50))}
          onBlur={commitName}
          placeholder="e.g. Tight Ship"
          style={{ width: '100%', boxSizing: 'border-box', padding: '13px 15px', borderRadius: 11, background: T.bg, border: `1px solid ${name ? accent : T.hair2}`, color: T.ink, fontFamily: 'var(--fw-ui)', fontSize: 15, fontWeight: 700, outline: 'none' }}
        />
      </div>
      <div>
        <Eyebrow color={T.ink2} style={{ marginBottom: 9 }}>{ruleCount} rule{ruleCount !== 1 ? 's' : ''} in the bundle</Eyebrow>
        {bundleRules.length === 0 ? (
          <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: 12.5, color: T.ink3 }}>No rules yet — go back to Browse.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bundleRules.map((r) => {
              const hard = isHardRule(r, bundleRuleHardness(workingBundle, r.id));
              const c = hard ? T.risk : T.ink2;
              return (
                <div key={r.id} style={{ padding: '11px 12px', borderRadius: 12, background: T.surface, border: `1px solid ${T.hair}`, boxShadow: `inset 3px 0 0 ${c}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.text || r.textTemplate || r.sourceRef}</div>
                      <Mono style={{ fontSize: 9, letterSpacing: '0.06em', color: T.ink3, textTransform: 'uppercase' }}>{r.category}</Mono>
                    </div>
                    <button className="fw-tap" onClick={() => handleRemoveRule(r.sourceRef)} style={{ all: 'unset', cursor: 'pointer', width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.ink3 }}>
                      <Icon name="trash" size={13} color={T.ink3} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderHardSoft = () => (
    <div>
      <div style={{ padding: '16px 16px 17px', borderRadius: 16, background: T.raised, border: `1px solid ${T.hair2}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <Mono style={{ fontSize: 9.5, letterSpacing: '0.16em', color: T.ink3, textTransform: 'uppercase' }}>The mix</Mono>
          <div style={{ fontFamily: 'var(--fw-ui)', fontSize: 13, color: T.ink2 }}>
            <b style={{ color: T.ink }}>{counts.soft}</b> preference{counts.soft !== 1 ? 's' : ''} · <b style={{ color: counts.hard ? T.risk : T.ink3 }}>{counts.hard}</b> hard limit{counts.hard !== 1 ? 's' : ''}
          </div>
        </div>
        <MixMeter soft={counts.soft} hard={counts.hard} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {bundleRules.map((r) => {
          const hard = isHardRule(r, bundleRuleHardness(workingBundle, r.id));
          const canToggle = FORGE_HARDSOFT_AUTHORING_ENABLED;
          return (
            <div key={r.id} style={{ padding: '13px 14px', borderRadius: 13, position: 'relative', overflow: 'hidden', background: hard ? `linear-gradient(180deg, ${alpha(T.risk, 0.06)}, transparent)` : T.surface, border: `1px solid ${hard ? alpha(T.risk, 0.4) : T.hair}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.text || r.textTemplate || r.sourceRef}</div>
                  <div style={{ fontSize: 11, color: T.ink2, marginTop: 4, lineHeight: 1.4 }}>
                    {hard ? <span><b style={{ color: T.risk }}>A hard rule your agent must follow.</b></span> : <span>Treated as a preference it leans on.</span>}
                  </div>
                </div>
                {!canToggle && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fw-mono)', fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, color: hard ? T.risk : T.ink3, background: alpha(hard ? T.risk : T.ink2, 0.12), border: `1px solid ${alpha(hard ? T.risk : T.ink2, 0.28)}`, padding: '4px 8px', borderRadius: 8, flexShrink: 0 }}>
                    {hard && <Icon name="lock" size={9} color={T.risk} stroke={2.4} />}{hard ? 'Hard' : 'Soft'}
                  </span>
                )}
              </div>
              {canToggle && (
                <div style={{ marginTop: 11 }}>
                  <BigHardSoft isHard={hard} onToggle={(h) => handleSetHardness(r, h)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {counts.hard > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 14, padding: '11px 13px', borderRadius: 11, background: alpha(T.risk, 0.05), border: `1px solid ${alpha(T.risk, 0.2)}` }}>
          <Icon name="shield" size={14} color={T.risk} stroke={2} />
          <div style={{ fontSize: 11, color: T.ink2, lineHeight: 1.45 }}>
            Hard rules are limits your agent <b style={{ color: T.ink }}>must follow</b> — not preferences it weighs.{' '}
            {FORGE_HARDSOFT_AUTHORING_ENABLED
              ? "They're not mechanically guaranteed, but they're treated as firm."
              : 'Which rules are hard is set by category for now.'}
          </div>
        </div>
      )}
    </div>
  );

  const renderFinalize = () => (
    <div>
      <div style={{ padding: '18px 17px', borderRadius: 18, position: 'relative', overflow: 'hidden', background: `linear-gradient(180deg, ${alpha(accent, 0.07)}, ${T.surface})`, border: `1px solid ${alpha(accent, 0.3)}` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name.trim() || `${ruleCount}-rule bundle`}</div>
          <Tag color={accent}>{ruleCount} rules</Tag>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 14, paddingTop: 13, borderTop: `1px solid ${T.hair}` }}>
          <div>
            <Mono style={{ fontSize: 8.5, letterSpacing: '0.1em', color: T.ink3, textTransform: 'uppercase', display: 'block' }}>Preferences</Mono>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginTop: 3 }}>{counts.soft}</div>
          </div>
          <div>
            <Mono style={{ fontSize: 8.5, letterSpacing: '0.1em', color: T.ink3, textTransform: 'uppercase', display: 'block' }}>Hard limits</Mono>
            <div style={{ fontSize: 14, fontWeight: 700, color: counts.hard ? T.risk : T.ink, marginTop: 3 }}>{counts.hard}</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, padding: '14px 15px', borderRadius: 14, background: T.surface, border: `1px solid ${T.hair}` }}>
        <Mono style={{ fontSize: 9.5, letterSpacing: '0.14em', color: T.ink3, textTransform: 'uppercase', display: 'block', marginBottom: 11 }}>The mix</Mono>
        <MixMeter soft={counts.soft} hard={counts.hard} />
      </div>
    </div>
  );

  // At the 5-bundle cap with no draft to continue, there's no working bundle to
  // build into — show a clear dead-end instead of an empty, broken stepper.
  if (capReached) {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', background: T.bg, animation: 'fwSheet .3s cubic-bezier(.22,.8,.3,1) both' }}>
        <div style={{ flexShrink: 0, padding: '16px 18px 14px', borderBottom: `1px solid ${T.hair}`, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="rules" size={14} color={accent} />
          <div style={{ fontFamily: 'var(--fw-ui)', fontSize: 13.5, fontWeight: 700, color: T.ink }}>Forge a rule bundle</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '24px 28px', textAlign: 'center' }}>
          <Icon name="rules" size={28} color={T.ink3} />
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>You already have 5 bundles</div>
          <div style={{ fontSize: 12.5, color: T.ink2, lineHeight: 1.5, maxWidth: 260 }}>Archive a bundle from your shelf to forge a new one.</div>
          <button className="fw-tap" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', marginTop: 6, padding: '11px 22px', borderRadius: 12, background: T.surface, border: `1px solid ${T.hair2}`, color: T.ink, fontFamily: 'var(--fw-ui)', fontWeight: 700, fontSize: 14 }}>Close</button>
        </div>
      </div>
    );
  }

  const body = [renderBrowse, renderAssemble, renderHardSoft, renderFinalize][stage]();

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', background: T.bg, animation: 'fwSheet .3s cubic-bezier(.22,.8,.3,1) both' }}>
      {/* header */}
      <div style={{ flexShrink: 0, padding: '16px 18px 14px', borderBottom: `1px solid ${T.hair}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="fw-tap" onClick={onClose} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, color: T.ink2 }}>
            <Icon name="x" size={16} color={T.ink2} /><Mono style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cancel</Mono>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="rules" size={14} color={accent} />
            <div style={{ fontFamily: 'var(--fw-ui)', fontSize: 13.5, fontWeight: 700, color: T.ink }}>Forge a rule bundle</div>
          </div>
          <div style={{ width: 56 }} />
        </div>
        <StageRail stages={STAGES} current={stage} accent={accent} onJump={(i) => i <= stage && setStage(i)} />
      </div>

      {/* body */}
      <div className="fw-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 24px' }}>
        <div key={stage} style={{ animation: 'fwRise .3s ease both' }}>
          <StageLead {...LEADS[stage]} accent={accent} />
          {body}
        </div>
      </div>

      {/* footer */}
      <div style={{ flexShrink: 0, padding: '12px 18px 16px', borderTop: `1px solid ${T.hair}`, background: alpha(T.bg, 0.9), backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
        {stage < last ? (
          <div style={{ display: 'flex', gap: 10 }}>
            {stage > 0 && (
              <button className="fw-tap" onClick={() => setStage(stage - 1)} style={{ all: 'unset', cursor: 'pointer', padding: '14px 18px', borderRadius: 13, background: T.surface, border: `1px solid ${T.hair2}`, color: T.ink2, fontFamily: 'var(--fw-ui)', fontWeight: 600, fontSize: 14 }}>Back</button>
            )}
            <button className="fw-tap" onClick={() => { if (canAdvance) { if (stage === 1) commitName(); setStage(stage + 1); } }} disabled={!canAdvance} style={{ all: 'unset', boxSizing: 'border-box', cursor: canAdvance ? 'pointer' : 'default', flex: 1, textAlign: 'center', padding: '14px', borderRadius: 13, background: canAdvance ? accent : T.surface, color: canAdvance ? T.bg : T.ink3, fontFamily: 'var(--fw-ui)', fontWeight: 700, fontSize: 14.5, border: canAdvance ? 'none' : `1px solid ${T.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Continue<Icon name="chevR" size={15} color={canAdvance ? T.bg : T.ink3} stroke={2.4} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <ForgeButton label="Forge bundle ready" onClick={finalize} disabled={!canFinalize} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="fw-tap" onClick={() => setStage(stage - 1)} style={{ all: 'unset', cursor: 'pointer', padding: '11px 16px', borderRadius: 12, color: T.ink3, fontFamily: 'var(--fw-ui)', fontWeight: 600, fontSize: 13 }}>Back</button>
              <button className="fw-tap" onClick={() => { commitName(); onClose(); }} style={{ all: 'unset', cursor: 'pointer', flex: 1, textAlign: 'center', padding: '11px', borderRadius: 12, color: T.ink2, fontFamily: 'var(--fw-ui)', fontWeight: 600, fontSize: 13 }}>Save as draft</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
