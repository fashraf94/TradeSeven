// src/components/Forge/ForgeScreen.jsx
// Mech Bay layout — compact collections + flat 8-accordion browser + management panels.

import React, { useRef, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, Hammer, BarChart3, List, Package } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useForge, CATEGORY_ORDER } from '../../hooks/useForge';
import useAgent from '../../hooks/useAgent';
import { useIsMobile } from '../../hooks/useIsMobile';
import { FORGE_RULE_TEMPLATES, FORGE_CONFLICT_PAIRS } from '../../data/forgeKnowledgeBase';
import { FORGE_LIMITS } from '../../constants/agentProgression';

import MechSVG from './MechSVG';
import MechVisorStrip from './MechVisorStrip';
import RadarChart from './RadarChart';
import CategoryAccordion from './CategoryAccordion';
import BundleStrip from './BundleStrip';
import AgentLearnedSection from './AgentLearnedSection';
import StarterKit from './StarterKit';
import StatsTab from './StatsTab';
import BundlePresetModal from './BundlePresetModal';
import CollectionChips from './CollectionChips';
import CollectionDetailSheet from './CollectionDetailSheet';
import ManagementPanel from './ManagementPanel';
import MyRulesTab from './MyRulesTab';
import MyBundlesTab from './MyBundlesTab';

const TABS = [
  { id: 'forge', label: 'The Forge', Icon: Hammer },
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

  const scrollRef = useRef(null);
  const heroRef = useRef(null);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [learnedExpanded, setLearnedExpanded] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [showMyRules, setShowMyRules] = useState(false);
  const [showMyBundles, setShowMyBundles] = useState(false);

  // Scroll-driven mech → visor strip transition (mobile only)
  const { scrollY } = useScroll({ container: isDesktop ? undefined : scrollRef });
  const mechOpacity = useTransform(scrollY, [0, 200], [1, 0]);
  const visorOpacity = useTransform(scrollY, [150, 250], [0, 1]);

  // Level and limits
  const level = getAgentLevel(agent);
  const limits = FORGE_LIMITS[level] || FORGE_LIMITS.rookie;

  // Active bundle (first draft, or first equipped, or first bundle)
  const activeBundle = forge.draftBundles[0] || forge.equippedBundles[0] || forge.bundles[0];
  const activeBundleId = activeBundle?.id || null;
  const bundleRuleIds = activeBundle?.ruleIds || [];
  const equippedRuleIds = useMemo(() => new Set(bundleRuleIds), [bundleRuleIds]);

  // Capacity
  const capacity = {
    current: bundleRuleIds.length,
    max: limits.maxRulesPerBundle,
  };

  // Agent-learned rules (non-Forge sources)
  const learnedRules = useMemo(
    () => forge.rules.filter(r =>
      ['batch_review', 'agent_batch_review', 'debate', 'agent_debate',
       'open_chat', 'agent_open_chat', 'reflection', 'agent_reflection'].includes(r.source)
    ),
    [forge.rules]
  );

  // All 8 category sections for flat accordion display
  const allCategorySections = useMemo(() => {
    return CATEGORY_ORDER.map(catId => {
      const catMeta = forge.categories.find(c => c.id === catId);
      const catRules = forge.templatesByCategory[catId] || [];
      return { category: catMeta, rules: catRules };
    });
  }, [forge.categories, forge.templatesByCategory]);

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

  // Conflict detection on add
  const handleAddRule = useCallback(async (templateId) => {
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
      await forge.addRuleToBundle(template);
    }
  }, [bundleRuleIds, forge]);

  const handleRemoveRule = useCallback(async (ruleId) => {
    if (activeBundleId) {
      await forge.removeRuleFromBundle(activeBundleId, ruleId);
    }
  }, [activeBundleId, forge]);

  // Bundle creation with preset support
  const handleCreateBundle = useCallback(() => {
    if (forge.bundles.length === 0) {
      setShowPresetModal(true);
    } else {
      forge.createNewBundle();
    }
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

          {/* Mech */}
          <MechSVG state={hasAgent ? 'idle' : 'dormant'} size="hero" />

          {/* No-agent overlay */}
          {!hasAgent && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, color: tokens.textMuted, marginBottom: 12 }}>
                Create Your Agent to Activate the Forge
              </div>
            </div>
          )}

          {/* Radar chart */}
          <RadarChart weights={forge.overlayWeights} size={140} />

          {/* Bundle strip */}
          {hasAgent && forge.bundles.length > 0 && (
            <div style={{ width: '100%', maxWidth: 320 }}>
              <BundleStrip
                activeBundleId={activeBundleId}
                bundles={forge.bundles}
                capacity={capacity}
                isEquipped={activeBundle?.status === 'equipped'}
                onForgeBundle={() => activeBundleId && forge.forgeBundleFn(activeBundleId)}
                onSwitchBundle={() => {}}
                onRenameBundle={forge.renameDraftBundle}
              />
            </div>
          )}

          {/* Management links */}
          {hasAgent && (
            <div style={{ display: 'flex', gap: 16, marginTop: 12, width: '100%', maxWidth: 320 }}>
              <button onClick={() => setShowMyRules(true)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: 'none', color: '#5EEAD4',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
              }}>
                <List size={14} /> My Rules ({forge.rules.length})
              </button>
              <button onClick={() => setShowMyBundles(true)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: 'none', color: '#5EEAD4',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
              }}>
                <Package size={14} /> My Bundles ({forge.bundles.length})
              </button>
            </div>
          )}
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
                    {/* Browse Rules header */}
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: '#718096',
                      textTransform: 'uppercase', letterSpacing: '0.15em',
                      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                      marginBottom: 10,
                    }}>
                      BROWSE RULES
                    </div>
                    {/* All 8 category accordions */}
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
                      />
                    ))}
                    <AgentLearnedSection
                      rules={learnedRules}
                      isExpanded={learnedExpanded}
                      onToggle={() => setLearnedExpanded(p => !p)}
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
              onAddRule={(rule) => forge.addRuleToBundle(rule)}
              onClose={() => setSelectedCollection(null)}
              agentExists={!!hasAgent}
              isAdding={!!forge.addingRuleId}
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
              <MyBundlesTab forge={forge} tokens={tokens} isMobile={false} agent={agent} />
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
          bundleName={activeBundle?.name}
          capacity={capacity}
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

        {/* Mech + Radar */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 16px 16px',
          position: 'relative',
        }}>
          <MechSVG state={hasAgent ? 'idle' : 'dormant'} size="hero" />

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

          <div style={{ marginTop: 8 }}>
            <RadarChart weights={forge.overlayWeights} size={80} />
          </div>
        </div>
      </motion.div>

      {/* Bundle strip */}
      {hasAgent && forge.bundles.length > 0 && (
        <BundleStrip
          activeBundleId={activeBundleId}
          bundles={forge.bundles}
          capacity={capacity}
          isEquipped={activeBundle?.status === 'equipped'}
          onForgeBundle={() => activeBundleId && forge.forgeBundleFn(activeBundleId)}
          onSwitchBundle={() => {}}
          onRenameBundle={forge.renameDraftBundle}
        />
      )}

      {/* Management links */}
      {hasAgent && (
        <div style={{
          display: 'flex', gap: 16, padding: '8px 16px',
          background: '#0D0E12',
        }}>
          <button onClick={() => setShowMyRules(true)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', color: '#5EEAD4',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
          }}>
            <List size={14} /> My Rules ({forge.rules.length})
          </button>
          <button onClick={() => setShowMyBundles(true)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', color: '#5EEAD4',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
          }}>
            <Package size={14} /> My Bundles ({forge.bundles.length})
          </button>
        </div>
      )}

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
                  {/* Browse Rules header */}
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#718096',
                    textTransform: 'uppercase', letterSpacing: '0.15em',
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                    marginBottom: 10,
                  }}>
                    BROWSE RULES
                  </div>
                  {/* All 8 category accordions */}
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
                    />
                  ))}
                  <AgentLearnedSection
                    rules={learnedRules}
                    isExpanded={learnedExpanded}
                    onToggle={() => setLearnedExpanded(p => !p)}
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
            onAddRule={(rule) => forge.addRuleToBundle(rule)}
            onClose={() => setSelectedCollection(null)}
            agentExists={!!hasAgent}
            isAdding={!!forge.addingRuleId}
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
            <MyBundlesTab forge={forge} tokens={tokens} isMobile={true} agent={agent} />
          </ManagementPanel>
        )}
      </AnimatePresence>
    </div>
  );
}
