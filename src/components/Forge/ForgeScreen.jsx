// src/components/Forge/ForgeScreen.jsx
// Mech Bay layout — compact collections + flat 8-accordion browser + management panels.

import React, { useRef, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, Hammer, BarChart3, Settings, BookOpen } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useForge, CATEGORY_ORDER } from '../../hooks/useForge';
import useAgent from '../../hooks/useAgent';
import { useIsMobile } from '../../hooks/useIsMobile';
import { FORGE_RULE_TEMPLATES, FORGE_CONFLICT_PAIRS } from '../../data/forgeKnowledgeBase';
import { DNA_GROUPS } from '../../data/dnaGroups';
import { TRAIT_LIBRARY } from '../../data/traitLibrary';
import { useTraits } from '../../hooks/useTraits';
import { getMechColors } from '../../utils/getMechColors';

import MechSVG from './MechSVG';
import MechParticles from './MechParticles';
import MechVisorStrip from './MechVisorStrip';
// import RadarChart from './RadarChart';  // Moved to Proving Grounds — Phase C
import CategoryAccordion from './CategoryAccordion';
// DEPRECATED: BundleStrip replaced by LoadoutDropdown in AgentIdentityCard (April 2026)
// import BundleStrip from './BundleStrip';
import AgentIdentityCard from './AgentIdentityCard';
import AgentLearnedSection from './AgentLearnedSection';
import StarterKit from './StarterKit';
import StatsTab from './StatsTab';
import BundlePresetModal from './BundlePresetModal';
import CollectionChips from './CollectionChips';
import CollectionDetailSheet from './CollectionDetailSheet';
import IntelCodex from './IntelCodex';
import ManagementPanel from './ManagementPanel';
import MyRulesTab from './MyRulesTab';
import MyBundlesTab from './MyBundlesTab';
import DNAGroupCard from './DNAGroupCard';
import TraitCard from './TraitCard';
import SeasonModeToggle from './SeasonModeToggle';

const TABS = [
  { id: 'forge', label: 'The Forge', Icon: Hammer },
  { id: 'intelCodex', label: 'Intel Codex', Icon: BookOpen },
  { id: 'provingGrounds', label: 'Proving Grounds', Icon: BarChart3 },
];

function getAgentLevel(agent) {
  const gamesPlayed = agent?.stats?.gamesPlayed || 0;
  if (gamesPlayed >= 15) return 'partner';
  if (gamesPlayed >= 5) return 'starter';
  return 'rookie';
}

export default function ForgeScreen({ isMobile: isMobileProp, onClose, user }) {
  const { tokens } = useTheme();
  const { isDesktop } = useIsMobile();
  const { agent, hasAgent } = useAgent(user?.uid);
  const agentId = agent?.id || null;
  const forge = useForge(agentId);
  const traits = useTraits(agentId, forge);

  const scrollRef = useRef(null);
  const heroRef = useRef(null);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [learnedExpanded, setLearnedExpanded] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [showMyRules, setShowMyRules] = useState(false);
  const [showMyBundles, setShowMyBundles] = useState(false);
  const [mechReactPulse, setMechReactPulse] = useState(null);
  const [configRuleId, setConfigRuleId] = useState(null);
  const [expandedDnaGroup, setExpandedDnaGroup] = useState(null);
  const [showAdvancedFirmware, setShowAdvancedFirmware] = useState(false);

  // Forge mode: 'clash' | 'season' | 'all' — persisted in localStorage
  const [forgeMode, setForgeMode] = useState(() => {
    try {
      const stored = localStorage.getItem('forgeMode');
      if (stored === 'clash' || stored === 'season' || stored === 'all') return stored;
    } catch {}
    return 'clash';
  });

  const handleModeChange = useCallback((newMode) => {
    setForgeMode(newMode);
    try { localStorage.setItem('forgeMode', newMode); } catch {}
  }, []);

  // Scroll-driven mech → visor strip transition (mobile only)
  const { scrollY } = useScroll({ container: isDesktop ? undefined : scrollRef });
  const mechOpacity = useTransform(scrollY, [0, 200], [1, 0]);
  const visorOpacity = useTransform(scrollY, [150, 250], [0, 1]);

  // Level
  const level = getAgentLevel(agent);

  // Active bundle (first draft, or first equipped, or first bundle)
  const activeBundle = forge.draftBundles[0] || forge.equippedBundles[0] || forge.bundles[0];
  const activeBundleId = activeBundle?.id || null;
  const bundleRuleIds = activeBundle?.ruleIds || [];
  const equippedRuleIds = useMemo(() => new Set(bundleRuleIds), [bundleRuleIds]);

  // Bundle data for AgentIdentityCard / LoadoutDropdown
  const maxBundles = 5;
  const bundleCount = forge.bundles?.filter(b => b.status !== 'archived').length || 0;
  const slotUsage = useMemo(() => ({
    instincts: traits.getGroupSlotUsage('instincts'),
    strategy: traits.getGroupSlotUsage('strategy'),
    discipline: traits.getGroupSlotUsage('discipline'),
  }), [traits.getGroupSlotUsage]);

  // Mech color personality from DNA distribution
  const mechColors = useMemo(() => getMechColors(slotUsage), [slotUsage]);

  // Agent-learned rules (non-Forge sources)
  const learnedRules = useMemo(
    () => forge.rules.filter(r =>
      ['batch_review', 'agent_batch_review', 'debate', 'agent_debate',
       'open_chat', 'agent_open_chat', 'reflection', 'agent_reflection'].includes(r.source)
    ),
    [forge.rules]
  );

  // Category sections for flat accordion display, filtered by active forge mode.
  // In 'all' mode: show every category and every rule.
  // In 'clash' / 'season' mode: hide categories scoped to the other mode, and
  // within each visible category, only show rules whose modes match or are 'both'.
  const allCategorySections = useMemo(() => {
    return CATEGORY_ORDER
      .map(catId => {
        const catMeta = forge.categories.find(c => c.id === catId);
        if (!catMeta) return null;

        // Filter category by mode (skip categories exclusive to the other mode)
        if (forgeMode !== 'all'
            && catMeta.mode !== forgeMode
            && catMeta.mode !== 'both') {
          return null;
        }

        const allCatRules = forge.templatesByCategory[catId] || [];
        const catRules = forgeMode === 'all'
          ? allCatRules
          : allCatRules.filter(r => !r.modes || r.modes === forgeMode || r.modes === 'both');

        return { category: catMeta, rules: catRules };
      })
      .filter(Boolean);
  }, [forge.categories, forge.templatesByCategory, forgeMode]);

  // Total visible rules across sections (for the "Browse all N rules" label)
  const visibleRuleCount = useMemo(
    () => allCategorySections.reduce((sum, s) => sum + s.rules.length, 0),
    [allCategorySections],
  );

  // Traits grouped by DNA group
  const traitsByGroup = useMemo(() => ({
    instincts: TRAIT_LIBRARY.filter(t => t.dnaGroup === 'instincts'),
    strategy: TRAIT_LIBRARY.filter(t => t.dnaGroup === 'strategy'),
    discipline: TRAIT_LIBRARY.filter(t => t.dnaGroup === 'discipline'),
  }), []);

  // Track which templates the user has already collected (by sourceRef)
  const collectedSourceRefs = useMemo(() => {
    const refs = new Set();
    forge.rules.forEach(r => { if (r.sourceRef) refs.add(r.sourceRef); });
    return refs;
  }, [forge.rules]);

  // Add all uncollected rules from a collection to the bundle
  const handleAddAllCollection = useCallback(async (collection) => {
    for (const rule of collection.rules) {
      if (!collectedSourceRefs.has(rule.id)) {
        await forge.addRuleToBundle(rule);
      }
    }
  }, [collectedSourceRefs, forge]);

  // Use This Playbook — creates a new bundle with all rules + paramOverrides
  // For collections with progressionHints, respects slot caps: active up to limit, rest queued
  const handleUsePlaybook = useCallback(async (collection) => {
    if (!collection.rules) return;

    const hasProgression = !!collection.progressionHints;
    const hints = hasProgression ? collection.progressionHints[level] : null;

    // Sort rules by priority (1 first) for progressive collections
    const sortedRules = hasProgression
      ? [...collection.rules].sort((a, b) => (a.priority || 1) - (b.priority || 1))
      : collection.rules;

    let activeCount = 0;
    let queuedCount = 0;
    let addedIndex = 0;

    for (const rule of sortedRules) {
      if (collectedSourceRefs.has(rule.id)) continue;
      const overrides = rule.paramOverrides || null;

      try {
        if (hasProgression && hints) {
          const status = addedIndex < hints.activeCount ? 'active' : 'queued';
          await forge.addRuleToBundle(rule, overrides, { status, priority: rule.priority });
          if (status === 'active') activeCount++;
          else queuedCount++;
        } else {
          await forge.addRuleToBundle(rule, overrides);
          activeCount++;
        }
      } catch {
        // Bundle capacity reached — stop adding, toast will reflect actual counts
        break;
      }
      addedIndex++;
    }

    if (hasProgression && queuedCount > 0) {
      forge.showToast(`${collection.title} Playbook created! ${activeCount} active, ${queuedCount} queued`);
    } else {
      forge.showToast(`${collection.title} Playbook created!`);
    }
    setSelectedCollection(null);
  }, [collectedSourceRefs, forge, level]);

  // Merge collection rules into existing active bundle
  const handleMergeIntoBundle = useCallback(async (collection) => {
    if (!collection.rules) return;
    for (const rule of collection.rules) {
      if (!collectedSourceRefs.has(rule.id)) {
        const overrides = rule.paramOverrides || null;
        await forge.addRuleToBundle(rule, overrides);
      }
    }
    forge.showToast(`Merged ${collection.title} rules into bundle!`);
    setSelectedCollection(null);
  }, [collectedSourceRefs, forge]);

  // Conflict detection on add
  const handleToggleRuleConfig = useCallback((ruleId) => {
    setConfigRuleId(prev => prev === ruleId ? null : ruleId);
  }, []);

  const handleAddRule = useCallback(async (templateId, paramValues) => {
    // Check for conflicts
    if (FORGE_CONFLICT_PAIRS) {
      const conflictPair = FORGE_CONFLICT_PAIRS.find(pair => {
        const isA = pair.ruleA === templateId && bundleRuleIds.some(rid => {
          const rule = forge.rules.find(r => r.id === rid);
          return rule?.sourceRef === pair.ruleB;
        });
        const isB = pair.ruleB === templateId && bundleRuleIds.some(rid => {
          const rule = forge.rules.find(r => r.id === rid);
          return rule?.sourceRef === pair.ruleA;
        });
        return isA || isB;
      });

      if (conflictPair) {
        const otherRuleId = conflictPair.ruleA === templateId ? conflictPair.ruleB : conflictPair.ruleA;
        const otherTemplate = FORGE_RULE_TEMPLATES.find(t => t.id === otherRuleId);
        forge.showToast(`\u26A0\uFE0F May conflict with "${otherTemplate?.headline || otherRuleId}". Both will be active.`);
      }
    }

    // Find template and add
    const template = FORGE_RULE_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      await forge.addRuleToBundle(template, paramValues);
      const cat = forge.categories.find(c => c.id === (template.forgeTemplates?.[0]?.category || template.category));
      setMechReactPulse({ type: 'ruleAdd', color: cat?.color || '#5EEAD4', timestamp: Date.now() });
      setConfigRuleId(null);
    }
  }, [bundleRuleIds, forge]);

  const handleRemoveRule = useCallback(async (ruleId) => {
    if (activeBundleId) {
      await forge.removeRuleFromBundle(activeBundleId, ruleId);
      setMechReactPulse({ type: 'ruleRemove', color: '#5EEAD4', timestamp: Date.now() });
    }
  }, [activeBundleId, forge]);

  // Open Advanced Firmware from a trait card
  const handleAdvancedOpen = useCallback(() => {
    setShowAdvancedFirmware(true);
  }, []);

  // Bundle creation with preset support
  const handleCreateBundle = useCallback(() => {
    if (forge.bundles.length === 0) {
      setShowPresetModal(true);
    } else {
      forge.createNewBundle();
    }
  }, [forge]);

  // Jump to Forge tab from Intel Codex "Found In" chip
  const handleJumpToForge = useCallback(() => {
    forge.setActiveTab('forge');
  }, [forge]);

  // Scroll to top for visor tap
  const handleScrollToTop = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Starter kit check
  const showStarterKit = agentId
    && agent
    && !agent.starterKitCompleted
    && !forge.loading
    && forge.rules.length === 0
    && forge.bundles.length === 0;

  // ── Desktop layout ──────────────────────────
  if (isDesktop) {
    return (
      <div style={{
        minHeight: '100vh',
        background: tokens.bgApp,
        display: 'flex',
      }}>
        {/* Left pane — sticky mech */}
        <div style={{
          width: '40%',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0D0E12',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          padding: '24px',
          gap: 20,
        }}>
          {/* Back button + title */}
          <div style={{
            position: 'absolute',
            top: 20,
            left: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', color: tokens.textMuted,
                cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 8,
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: tokens.textWhite, margin: 0 }}>
              The Forge
            </h1>
          </div>

          {/* Agent Identity Card — Mech + Class Title + Loadout + DNA Sockets */}
          <AgentIdentityCard
            comboLabel={traits.activeComboLabel}
            archetype={agent?.archetype}
            bundles={forge.bundles}
            activeBundleId={activeBundleId}
            onEquipBundle={forge.equipBundleFn}
            onCreateBundle={handleCreateBundle}
            maxBundles={maxBundles}
            bundleCount={bundleCount}
            slotUsage={slotUsage}
            equippedTraits={traits.equippedTraits}
            mechColors={mechColors}
          >
            <div style={{ position: 'relative', width: '100%', maxWidth: 280, margin: '0 auto' }}>
              <MechParticles slotUsage={slotUsage} mechMode={mechColors.mode} />
              <MechSVG
                state={hasAgent ? 'idle' : 'dormant'}
                size="hero"
                reactPulse={mechReactPulse}
                primaryGlow={mechColors.primaryGlow}
                visorColor={mechColors.visorColor}
                mode={mechColors.mode}
                glowIntensity={mechColors.glowIntensity}
              />
            </div>

            {/* No-agent overlay */}
            {!hasAgent && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, color: tokens.textMuted, marginBottom: 12 }}>
                  Create Your Agent to Activate the Forge
                </div>
              </div>
            )}
          </AgentIdentityCard>
        </div>

        {/* Right pane — scrollable content */}
        <div style={{
          width: '60%',
          minHeight: '100vh',
          overflowY: 'auto',
          padding: '20px 24px 40px',
        }}>
          {showStarterKit ? (
            <StarterKit
              agentId={agentId} agent={agent} forge={forge} tokens={tokens}
              isMobile={false} onComplete={() => forge.reloadData()} onSkip={() => forge.reloadData()}
            />
          ) : (
            <>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {TABS.map(tab => {
                  const isActive = forge.activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => forge.setActiveTab(tab.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 20, fontSize: 13,
                        fontWeight: isActive ? 600 : 500, whiteSpace: 'nowrap', cursor: 'pointer',
                        border: isActive ? `1px solid ${tokens.teal}4D` : '1px solid rgba(255,255,255,0.08)',
                        background: isActive ? `${tokens.teal}26` : 'rgba(255,255,255,0.04)',
                        color: isActive ? tokens.teal : tokens.textMuted,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <tab.Icon size={14} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {forge.activeTab === 'forge' && (
                  <motion.div
                    key="forge"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Quick Start chips */}
                    <CollectionChips
                      collections={forge.collectionData}
                      collectedSourceRefs={collectedSourceRefs}
                      onSelectCollection={setSelectedCollection}
                      agentExists={!!hasAgent}
                    />
                    {/* Agent DNA section header */}
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: '#718096',
                      textTransform: 'uppercase', letterSpacing: '0.15em',
                      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                      marginBottom: 10,
                    }}>
                      AGENT DNA
                    </div>
                    {/* DNA Group cards with trait cards */}
                    {Object.entries(DNA_GROUPS).map(([groupId, group]) => {
                      const groupTraits = traitsByGroup[groupId] || [];
                      const equippedInGroup = traits.equippedTraits.filter(t => t.dnaGroup === groupId);
                      const totalRules = groupTraits.reduce((sum, t) => sum + t.ruleIds.length, 0);
                      const equippedRules = equippedInGroup.reduce((sum, t) => sum + t.ruleIds.length, 0);
                      return (
                        <DNAGroupCard
                          key={groupId}
                          group={group}
                          equippedTraits={equippedInGroup}
                          slotUsage={traits.getGroupSlotUsage(groupId)}
                          totalRulesInGroup={totalRules}
                          equippedRuleCount={equippedRules}
                          isExpanded={expandedDnaGroup === groupId}
                          onToggle={() => setExpandedDnaGroup(prev => prev === groupId ? null : groupId)}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                            {groupTraits.map(trait => {
                              const equipped = traits.equippedTraits.find(e => e.traitId === trait.id);
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
                                  onAdvancedOpen={handleAdvancedOpen}
                                  canEquip={traits.canEquip(trait.id)}
                                  groupColor={group.color}
                                />
                              );
                            })}
                          </div>
                        </DNAGroupCard>
                      );
                    })}
                    {/* Advanced Firmware link */}
                    <div style={{ textAlign: 'center', marginTop: 28, marginBottom: 28, padding: '0 16px' }}>
                      <button
                        onClick={() => setShowAdvancedFirmware(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 10,
                          padding: '14px 28px',
                          backgroundColor: '#15171E',
                          border: '1px solid #2A2D35',
                          borderRadius: 10,
                          color: '#A0AEC0',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          width: '100%',
                          maxWidth: 400,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = '#5EEAD4';
                          e.currentTarget.style.color = '#E2E8F0';
                          e.currentTarget.style.backgroundColor = '#1C1A27';
                          e.currentTarget.style.boxShadow = '0 0 12px rgba(94, 234, 212, 0.15)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = '#2A2D35';
                          e.currentTarget.style.color = '#A0AEC0';
                          e.currentTarget.style.backgroundColor = '#15171E';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <Settings size={16} />
                        Advanced Firmware — Browse {visibleRuleCount} rules
                      </button>
                    </div>
                    <AgentLearnedSection
                      rules={learnedRules}
                      isExpanded={learnedExpanded}
                      onToggle={() => setLearnedExpanded(p => !p)}
                    />
                  </motion.div>
                )}
                {forge.activeTab === 'intelCodex' && (
                  <motion.div
                    key="intelCodex"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    style={{ minHeight: 'calc(100vh - 80px)' }}
                  >
                    <IntelCodex
                      userRules={forge.rules}
                      onJumpToForge={handleJumpToForge}
                      onDeleteRule={forge.deleteRule}
                    />
                  </motion.div>
                )}
                {forge.activeTab === 'provingGrounds' && (
                  <motion.div
                    key="provingGrounds"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <StatsTab forge={forge} tokens={tokens} isMobile={false} agent={agent} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Toast */}
        <AnimatePresence>
          {forge.toast && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.25 }}
              style={{
                position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                background: tokens.bgCard, border: `1px solid ${tokens.teal}33`,
                borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 500,
                color: tokens.teal, boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${tokens.teal}15`,
                zIndex: 100, whiteSpace: 'nowrap',
              }}
            >
              {forge.toast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bundle preset modal */}
        {showPresetModal && (
          <BundlePresetModal
            forge={forge}
            onClose={() => setShowPresetModal(false)}
          />
        )}

        {/* Collection detail sheet */}
        <AnimatePresence>
          {selectedCollection && (
            <CollectionDetailSheet
              collection={selectedCollection}
              collectedSourceRefs={collectedSourceRefs}
              onAddAll={handleAddAllCollection}
              onAddRule={async (rule) => {
                await forge.addRuleToBundle(rule);
                const cat = forge.categories.find(c => c.id === rule.category);
                setMechReactPulse({ type: 'ruleAdd', color: cat?.color || '#5EEAD4', timestamp: Date.now() });
              }}
              onClose={() => setSelectedCollection(null)}
              agentExists={!!hasAgent}
              isAdding={!!forge.addingRuleId}
              onUsePlaybook={handleUsePlaybook}
              activeBundleName={forge.bundles.find(b => b.status === 'draft')?.name}
              onMergeIntoBundle={handleMergeIntoBundle}
              agentLevel={level}
              gamesPlayed={agent?.stats?.gamesPlayed || 0}
            />
          )}
        </AnimatePresence>

        {/* Management panels */}
        <AnimatePresence>
          {showMyRules && (
            <ManagementPanel title="My Rules" onClose={() => setShowMyRules(false)}>
              <MyRulesTab forge={forge} tokens={tokens} isMobile={false} />
            </ManagementPanel>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showMyBundles && (
            <ManagementPanel title="My Bundles" onClose={() => setShowMyBundles(false)}>
              <MyBundlesTab forge={forge} tokens={tokens} isMobile={false} agent={agent} forgeMode={forgeMode} />
            </ManagementPanel>
          )}
          {showAdvancedFirmware && (
            <ManagementPanel title="Advanced Firmware" onClose={() => setShowAdvancedFirmware(false)}>
              <div style={{ padding: '12px 8px 8px' }}>
                <SeasonModeToggle mode={forgeMode} onModeChange={handleModeChange} />
              </div>
              <div style={{ padding: '0 8px' }}>
                {allCategorySections.map(({ category, rules }) => (
                  <CategoryAccordion
                    key={category.id}
                    category={category}
                    rules={rules}
                    equippedRuleIds={equippedRuleIds}
                    isExpanded={forge.expandedAccordions.has(category.id)}
                    onToggle={() => forge.toggleAccordion(category.id)}
                    onAddRule={handleAddRule}
                    onRemoveRule={handleRemoveRule}
                    agentExists={!!hasAgent}
                    expandedRuleId={configRuleId}
                    onToggleRuleConfig={handleToggleRuleConfig}
                    forgeMode={forgeMode}
                  />
                ))}
              </div>
            </ManagementPanel>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Mobile layout ──────────────────────────
  return (
    <div
      ref={scrollRef}
      style={{
        minHeight: '100vh',
        background: tokens.bgApp,
        paddingBottom: 80,
        position: 'relative',
      }}
    >
      {/* Visor strip — sticky, fades in on scroll */}
      <motion.div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          opacity: visorOpacity,
          pointerEvents: 'auto',
        }}
      >
        <MechVisorStrip
          comboLabel={traits.activeComboLabel}
          archetype={agent?.archetype}
          activeBundleName={activeBundle?.name}
          onTapToExpand={handleScrollToTop}
        />
      </motion.div>

      {/* Mech hero zone */}
      <motion.div
        ref={heroRef}
        style={{ opacity: mechOpacity }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 16px 12px',
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: tokens.textMuted,
              cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 8,
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: tokens.textWhite, margin: 0 }}>
            The Forge
          </h1>
        </div>

        {/* Agent Identity Card — Mech + Class Title + Loadout + DNA Sockets */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 16px 16px',
          position: 'relative',
        }}>
          <AgentIdentityCard
            comboLabel={traits.activeComboLabel}
            archetype={agent?.archetype}
            bundles={forge.bundles}
            activeBundleId={activeBundleId}
            onEquipBundle={forge.equipBundleFn}
            onCreateBundle={handleCreateBundle}
            maxBundles={maxBundles}
            bundleCount={bundleCount}
            slotUsage={slotUsage}
            equippedTraits={traits.equippedTraits}
            mechColors={mechColors}
          >
            <MechSVG
              state={hasAgent ? 'idle' : 'dormant'}
              size="hero"
              reactPulse={mechReactPulse}
              primaryGlow={mechColors.primaryGlow}
              visorColor={mechColors.visorColor}
              mode={mechColors.mode}
              glowIntensity={mechColors.glowIntensity}
            />

            {/* No-agent overlay */}
            {!hasAgent && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(13,14,18,0.7)',
                borderRadius: 12,
              }}>
                <div style={{
                  fontSize: 15, color: tokens.textMuted, textAlign: 'center',
                  padding: '0 24px', marginBottom: 12,
                }}>
                  Create Your Agent to Activate the Forge
                </div>
              </div>
            )}
          </AgentIdentityCard>
        </div>
      </motion.div>

      {/* Create bundle CTA when no bundles */}
      {hasAgent && forge.bundles.length === 0 && !forge.loading && (
        <div style={{ padding: '12px 16px' }}>
          <button
            onClick={handleCreateBundle}
            style={{
              width: '100%', padding: '12px', borderRadius: 10,
              background: 'rgba(94,234,212,0.08)', border: '1px solid rgba(94,234,212,0.2)',
              color: '#5EEAD4', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Hammer size={14} /> Create Your First Bundle
          </button>
        </div>
      )}

      {showStarterKit ? (
        <StarterKit
          agentId={agentId} agent={agent} forge={forge} tokens={tokens}
          isMobile={true} onComplete={() => forge.reloadData()} onSkip={() => forge.reloadData()}
        />
      ) : (
        <>
          {/* Tab bar — scrolls with content */}
          <div style={{
            display: 'flex', gap: 8, padding: '12px 16px',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}>
            {TABS.map(tab => {
              const isActive = forge.activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => forge.setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 20, fontSize: 13,
                    fontWeight: isActive ? 600 : 500, whiteSpace: 'nowrap', cursor: 'pointer',
                    border: isActive ? `1px solid ${tokens.teal}4D` : '1px solid rgba(255,255,255,0.08)',
                    background: isActive ? `${tokens.teal}26` : 'rgba(255,255,255,0.04)',
                    color: isActive ? tokens.teal : tokens.textMuted,
                    transition: 'all 0.2s ease', flexShrink: 0,
                  }}
                >
                  <tab.Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div style={{ padding: '0 16px' }}>
            <AnimatePresence mode="wait">
              {forge.activeTab === 'forge' && (
                <motion.div
                  key="forge"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Quick Start chips */}
                  <CollectionChips
                    collections={forge.collectionData}
                    collectedSourceRefs={collectedSourceRefs}
                    onSelectCollection={setSelectedCollection}
                    agentExists={!!hasAgent}
                  />
                  {/* Agent DNA section header */}
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#718096',
                    textTransform: 'uppercase', letterSpacing: '0.15em',
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                    marginBottom: 10,
                  }}>
                    AGENT DNA
                  </div>
                  {/* DNA Group cards with trait cards */}
                  {Object.entries(DNA_GROUPS).map(([groupId, group]) => {
                    const groupTraits = traitsByGroup[groupId] || [];
                    const equippedInGroup = traits.equippedTraits.filter(t => t.dnaGroup === groupId);
                    const totalRules = groupTraits.reduce((sum, t) => sum + t.ruleIds.length, 0);
                    const equippedRules = equippedInGroup.reduce((sum, t) => sum + t.ruleIds.length, 0);
                    return (
                      <DNAGroupCard
                        key={groupId}
                        group={group}
                        equippedTraits={equippedInGroup}
                        slotUsage={traits.getGroupSlotUsage(groupId)}
                        totalRulesInGroup={totalRules}
                        equippedRuleCount={equippedRules}
                        isExpanded={expandedDnaGroup === groupId}
                        onToggle={() => setExpandedDnaGroup(prev => prev === groupId ? null : groupId)}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {groupTraits.map(trait => {
                            const equipped = traits.equippedTraits.find(e => e.traitId === trait.id);
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
                                onAdvancedOpen={handleAdvancedOpen}
                                canEquip={traits.canEquip(trait.id)}
                                groupColor={group.color}
                              />
                            );
                          })}
                        </div>
                      </DNAGroupCard>
                    );
                  })}
                  {/* Advanced Firmware link */}
                  <div style={{ textAlign: 'center', marginTop: 16, marginBottom: 24 }}>
                    <button
                      onClick={() => setShowAdvancedFirmware(true)}
                      style={{
                        background: 'none', border: 'none', color: '#718096',
                        fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <Settings size={12} /> Advanced Firmware — Browse all rules
                    </button>
                  </div>
                  <AgentLearnedSection
                    rules={learnedRules}
                    isExpanded={learnedExpanded}
                    onToggle={() => setLearnedExpanded(p => !p)}
                  />
                </motion.div>
              )}
              {forge.activeTab === 'intelCodex' && (
                <motion.div
                  key="intelCodex"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <IntelCodex
                    userRules={forge.rules}
                    onJumpToForge={handleJumpToForge}
                    onRefineRule={forge.refineRule}
                    onDeleteRule={forge.deleteRule}
                  />
                </motion.div>
              )}
              {forge.activeTab === 'provingGrounds' && (
                <motion.div
                  key="provingGrounds"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <StatsTab forge={forge} tokens={tokens} isMobile={true} agent={agent} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Toast */}
      <AnimatePresence>
        {forge.toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
              background: tokens.bgCard, border: `1px solid ${tokens.teal}33`,
              borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 500,
              color: tokens.teal, boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${tokens.teal}15`,
              zIndex: 100, whiteSpace: 'nowrap',
            }}
          >
            {forge.toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bundle preset modal */}
      {showPresetModal && (
        <BundlePresetModal
          forge={forge}
          onClose={() => setShowPresetModal(false)}
        />
      )}

      {/* Collection detail sheet */}
      <AnimatePresence>
        {selectedCollection && (
          <CollectionDetailSheet
            collection={selectedCollection}
            collectedSourceRefs={collectedSourceRefs}
            onAddAll={handleAddAllCollection}
            onAddRule={async (rule) => {
                await forge.addRuleToBundle(rule);
                const cat = forge.categories.find(c => c.id === rule.category);
                setMechReactPulse({ type: 'ruleAdd', color: cat?.color || '#5EEAD4', timestamp: Date.now() });
              }}
            onClose={() => setSelectedCollection(null)}
            agentExists={!!hasAgent}
            isAdding={!!forge.addingRuleId}
            onUsePlaybook={handleUsePlaybook}
            activeBundleName={forge.bundles.find(b => b.status === 'draft')?.name}
            onMergeIntoBundle={handleMergeIntoBundle}
            agentLevel={level}
            gamesPlayed={agent?.stats?.gamesPlayed || 0}
          />
        )}
      </AnimatePresence>

      {/* Management panels */}
      <AnimatePresence>
        {showMyRules && (
          <ManagementPanel title="My Rules" onClose={() => setShowMyRules(false)}>
            <MyRulesTab forge={forge} tokens={tokens} isMobile={true} />
          </ManagementPanel>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showMyBundles && (
          <ManagementPanel title="My Bundles" onClose={() => setShowMyBundles(false)}>
            <MyBundlesTab forge={forge} tokens={tokens} isMobile={true} agent={agent} forgeMode={forgeMode} />
          </ManagementPanel>
        )}
        {showAdvancedFirmware && (
          <ManagementPanel title="Advanced Firmware" onClose={() => setShowAdvancedFirmware(false)}>
            <div style={{ padding: '12px 8px 8px' }}>
              <SeasonModeToggle mode={forgeMode} onModeChange={handleModeChange} />
            </div>
            <div style={{ padding: '0 8px' }}>
              {allCategorySections.map(({ category, rules }) => (
                <CategoryAccordion
                  key={category.id}
                  category={category}
                  rules={rules}
                  equippedRuleIds={equippedRuleIds}
                  isExpanded={forge.expandedAccordions.has(category.id)}
                  onToggle={() => forge.toggleAccordion(category.id)}
                  onAddRule={handleAddRule}
                  onRemoveRule={handleRemoveRule}
                  agentExists={!!hasAgent}
                  forgeMode={forgeMode}
                />
              ))}
            </div>
          </ManagementPanel>
        )}
      </AnimatePresence>
    </div>
  );
}
