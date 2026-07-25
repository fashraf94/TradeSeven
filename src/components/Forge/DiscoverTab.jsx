// DEPRECATED: Replaced by CategoryAccordion system in ForgeScreen (Phase 1 Mech Bay).
// Kept for rollback purposes — do not add new features here.
//
// src/components/Forge/DiscoverTab.jsx
// Three-layer Discover experience: Spotlight → Collection Carousels → Browse All.
// The legacy flat list is preserved as FullLibraryView, toggled via "Browse All" button.

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, TrendingUp, Gem, RotateCcw, Target,
  Sparkles, Flame, Grid3X3, ArrowLeft,
  ChevronDown, ChevronUp, Plus, BookOpen,
} from 'lucide-react';
import { FORGE_CATEGORIES, FORGE_RULE_TEMPLATES } from '../../data/forgeKnowledgeBase';
import { OFFERED_COLLECTIONS } from '../../data/forgeCollections';
import { FORGE_LIMITS } from '../../constants/agentProgression';
import { getAgentLevel } from '../../constants/agentProgression';
import ForgeRuleCard from './ForgeRuleCard';
import RuleDetailSheet from './RuleDetailSheet';
import CenteredModal from '../shared/CenteredModal';
import StarterKit from './StarterKit';

// ── Icon lookup for collection definitions ──────────────────────────
const COLLECTION_ICONS = {
  Shield, TrendingUp, Gem, RotateCcw, Target,
};

// ── Template lookup by ID ───────────────────────────────────────────
const TEMPLATE_MAP = Object.fromEntries(
  FORGE_RULE_TEMPLATES.map((t) => [t.id, t])
);

// ── Legacy flat-list view (extracted from original DiscoverTab) ─────
const DIFFICULTY_COLORS = {
  beginner: { bg: 'rgba(94,234,212,0.12)', color: '#5eead4' },
  intermediate: { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa' },
  advanced: { bg: 'rgba(249,112,102,0.12)', color: '#f97066' },
};

function CategoryFilterPills({ selectedCategory, onSelect, tokens }) {
  const allCategories = [
    { id: 'all', label: 'All', color: tokens.teal },
    ...FORGE_CATEGORIES,
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      paddingBottom: '4px',
    }}>
      {allCategories.map((cat) => {
        const isActive = selectedCategory === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: isActive ? 600 : 500,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: isActive ? `1px solid ${cat.color}4D` : '1px solid rgba(255,255,255,0.08)',
              background: isActive ? `${cat.color}26` : 'rgba(255,255,255,0.04)',
              color: isActive ? cat.color : tokens.textMuted,
              transition: 'all 0.2s ease',
            }}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}

function LegacyRuleCard({ template, isExpanded, onToggleExpand, onAddToBundle, isAdding, tokens }) {
  const category = FORGE_CATEGORIES.find(c => c.id === template.category);
  const diffStyle = DIFFICULTY_COLORS[template.difficulty] || DIFFICULTY_COLORS.beginner;

  return (
    <div style={{
      background: tokens.bgCard,
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      padding: '16px',
      transition: 'border-color 0.2s ease',
    }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {category && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
            borderRadius: '12px', fontSize: '11px', fontWeight: 600,
            background: `${category.color}20`, color: category.color,
          }}>
            {category.label}
          </span>
        )}
        <span style={{
          display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
          borderRadius: '12px', fontSize: '11px', fontWeight: 500,
          background: diffStyle.bg, color: diffStyle.color,
        }}>
          {template.difficulty}
        </span>
      </div>
      <h3 style={{ fontSize: '16px', fontWeight: '700', color: tokens.textWhite, margin: '0 0 6px 0', lineHeight: 1.3 }}>
        {template.headline}
      </h3>
      <p style={{ fontSize: '13px', color: tokens.textMuted, margin: '0 0 14px 0', lineHeight: 1.5 }}>
        {template.description}
      </p>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', marginBottom: '14px' }}>
              <p style={{ fontSize: '13px', color: tokens.textSecondary, margin: '0 0 10px 0', lineHeight: 1.6 }}>
                {template.learnMore}
              </p>
              {template.relatedIndicator && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: tokens.textFaint }}>
                  <BookOpen size={12} />
                  <span>Related indicator: <span style={{ color: tokens.textMuted }}>{template.relatedIndicator}</span></span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          onClick={() => onToggleExpand(template.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px', background: 'none',
            border: 'none', padding: '6px 10px', borderRadius: '8px', fontSize: '12px',
            fontWeight: 500, color: tokens.textFaint, cursor: 'pointer', transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = tokens.textMuted; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = tokens.textFaint; }}
        >
          {isExpanded ? (<>Collapse <ChevronUp size={12} /></>) : (<>Learn More <ChevronDown size={12} /></>)}
        </button>
        <button
          disabled={isAdding}
          onClick={() => onAddToBundle(template)}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px',
            borderRadius: '10px', fontSize: '12px', fontWeight: 600,
            background: `${tokens.teal}1A`, border: `1px solid ${tokens.teal}40`,
            color: tokens.teal, cursor: isAdding ? 'default' : 'pointer',
            opacity: isAdding ? 0.5 : 1, pointerEvents: isAdding ? 'none' : 'auto',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isAdding) {
              e.currentTarget.style.background = `${tokens.teal}30`;
              e.currentTarget.style.boxShadow = `0 0 12px ${tokens.teal}20`;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `${tokens.teal}1A`;
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <Plus size={13} />
          {isAdding ? 'Adding...' : 'Add to Bundle'}
        </button>
      </div>
    </div>
  );
}

function FullLibraryView({ forge, tokens, isMobile, onBack }) {
  const { filteredTemplates, selectedCategory, setSelectedCategory, expandedCardId, setExpandedCardId, addRuleToBundle, addingRuleId } = forge;
  const handleToggleExpand = (id) => setExpandedCardId(expandedCardId === id ? null : id);

  return (
    <div style={{ padding: isMobile ? '0 16px 24px' : '0 24px 24px' }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', color: '#5eead4',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          padding: '8px 0', marginBottom: 12,
        }}
      >
        <ArrowLeft size={16} />
        Back to Discover
      </button>

      <div style={{ marginBottom: '16px' }}>
        <CategoryFilterPills selectedCategory={selectedCategory} onSelect={setSelectedCategory} tokens={tokens} />
      </div>
      <div style={{ fontSize: '12px', color: tokens.textFaint, marginBottom: '12px' }}>
        {filteredTemplates.length} rule template{filteredTemplates.length !== 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredTemplates.map((template) => (
          <LegacyRuleCard
            key={template.id}
            template={template}
            isExpanded={expandedCardId === template.id}
            onToggleExpand={handleToggleExpand}
            onAddToBundle={addRuleToBundle}
            isAdding={addingRuleId === template.id}
            tokens={tokens}
          />
        ))}
      </div>
      {filteredTemplates.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: tokens.textMuted, fontSize: '14px' }}>
          No templates in this category yet.
        </div>
      )}
    </div>
  );
}

// ── Main Discover Tab ───────────────────────────────────────────────

export default function DiscoverTab({ isMobile, forge, tokens, agent }) {
  const [showFullLibrary, setShowFullLibrary] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [showStarterKitModal, setShowStarterKitModal] = useState(false);

  // Determine which rule IDs are already collected
  const collectedRuleSourceRefs = useMemo(() => {
    const refs = new Set();
    (forge.rules || []).forEach((r) => {
      if (r.sourceRef) refs.add(r.sourceRef);
    });
    return refs;
  }, [forge.rules]);

  const isRuleCollected = (templateId) => collectedRuleSourceRefs.has(templateId);

  // Agent level & rule capacity
  const agentLevel = agent ? getAgentLevel(agent?.stats?.gamesPlayed || 0) : 'rookie';
  const forgeLimits = FORGE_LIMITS[agentLevel] || FORGE_LIMITS.rookie;
  const equippedCount = (forge.rules || []).length;
  const ruleCapacity = forgeLimits.maxRulesPerBundle * forgeLimits.maxBundles;

  // Spotlight variant
  const showStarterKit = !agent || agent.starterKitCompleted === false;

  // Desktop check
  const isDesktop = !isMobile;

  // Handlers
  const handleAddRule = (rule) => {
    forge.addRuleToBundle(rule);
    // Close detail sheet after adding
    setSelectedRule(null);
  };

  const handleLearnMore = (rule) => {
    setSelectedRule(rule);
  };

  // ── Full Library View ──
  if (showFullLibrary) {
    return (
      <FullLibraryView
        forge={forge}
        tokens={tokens}
        isMobile={isMobile}
        onBack={() => setShowFullLibrary(false)}
      />
    );
  }

  // ── Curated Discover View ──
  return (
    <div>
      {/* 2.1 Bundle Capacity Pill */}
      {agent && (
        <div style={{ padding: '12px 16px 0 16px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(94, 234, 212, 0.08)',
            borderRadius: 9999,
            padding: '6px 14px',
          }}>
            <Shield size={14} color="#5eead4" />
            <span style={{ fontSize: 12, color: '#e6edf3', fontWeight: 500 }}>
              {equippedCount} / {ruleCapacity} Rules Equipped
            </span>
            <div style={{
              width: 40,
              height: 3,
              background: '#21262d',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${Math.min(100, (equippedCount / ruleCapacity) * 100)}%`,
                background: equippedCount >= ruleCapacity ? '#22c55e' : '#5eead4',
                borderRadius: 2,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* 2.2 Spotlight Zone */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          margin: isMobile ? '20px 16px 32px' : '20px 24px 32px',
        }}
      >
        <div style={{
          background: '#1C1A27',
          border: '1px solid #21262d',
          borderRadius: 16,
          padding: 20,
          position: 'relative',
          overflow: 'hidden',
          minHeight: 120,
          boxShadow: '0 0 40px rgba(94, 234, 212, 0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}>
          {/* Eyebrow */}
          <div style={{
            fontSize: 10,
            textTransform: 'uppercase',
            fontWeight: 700,
            letterSpacing: 0.5,
            color: '#5eead4',
            marginBottom: 8,
          }}>
            {showStarterKit ? 'STARTER KIT' : 'FEATURED'}
          </div>

          {/* Headline */}
          <div style={{
            fontSize: 18,
            color: '#ffffff',
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: 6,
          }}>
            {showStarterKit
              ? 'Build your first strategy in 3 questions.'
              : 'Popular this week: Momentum Hunter'}
          </div>

          {/* Description */}
          <div style={{
            fontSize: 13,
            color: '#8b949e',
            lineHeight: 1.4,
            maxWidth: 260,
            marginBottom: 16,
          }}>
            {showStarterKit
              ? 'Personalized rules for your trading style.'
              : 'Chase breakouts and ride trends with technical signals.'}
          </div>

          {/* CTA Button */}
          <button
            onClick={() => {
              if (showStarterKit) {
                setShowStarterKitModal(true);
              } else {
                const el = document.getElementById('collection-momentum-hunter');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            style={{
              background: 'linear-gradient(135deg, #5eead4 0%, #00d9ff 100%)',
              color: '#0D0E12',
              fontWeight: 600,
              fontSize: 13,
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              boxShadow: '0 4px 12px rgba(94, 234, 212, 0.3)',
              cursor: 'pointer',
            }}
          >
            {showStarterKit ? 'Get Started' : 'Explore'}
          </button>

          {/* Watermark icon */}
          <div style={{
            position: 'absolute',
            right: -10,
            bottom: -10,
            opacity: 0.05,
            pointerEvents: 'none',
          }}>
            {showStarterKit ? (
              <Sparkles size={100} color="#5eead4" />
            ) : (
              <Flame size={100} color="#5eead4" />
            )}
          </div>
        </div>
      </motion.section>

      {/* 2.3 Collection Sections */}
      {OFFERED_COLLECTIONS.map((collection, index) => {
        const CollectionIcon = COLLECTION_ICONS[collection.icon];
        const rules = collection.ruleIds
          .map((id) => TEMPLATE_MAP[id])
          .filter(Boolean);

        // Sort: uncollected first, collected last
        const sortedRules = [...rules].sort((a, b) => {
          const aCollected = isRuleCollected(a.id) ? 1 : 0;
          const bCollected = isRuleCollected(b.id) ? 1 : 0;
          return aCollected - bCollected;
        });

        return (
          <motion.section
            key={collection.id}
            id={`collection-${collection.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 * index }}
            style={{ marginBottom: 28 }}
          >
            {/* Section Header */}
            <div style={{ padding: '0 16px', marginBottom: 12 }}>
              <div style={{
                fontSize: 16,
                fontWeight: 800,
                color: '#ffffff',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {collection.title}
              </div>
              <div style={{
                fontSize: 12,
                color: '#8b949e',
                fontWeight: 400,
                marginTop: 4,
              }}>
                {collection.subtitle}
              </div>
            </div>

            {/* Cards: carousel (mobile) or grid (desktop) */}
            <div style={isDesktop ? {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
              padding: '0 16px',
            } : {
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              padding: '0 16px',
              WebkitOverflowScrolling: 'touch',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            }}>
              {sortedRules.map((rule) => (
                <ForgeRuleCard
                  key={rule.id}
                  rule={rule}
                  isCollected={isRuleCollected(rule.id)}
                  isAdding={forge.addingRuleId === rule.id}
                  onAdd={handleAddRule}
                  onLearnMore={handleLearnMore}
                  style={isDesktop ? { width: '100%' } : undefined}
                />
              ))}
            </div>
          </motion.section>
        );
      })}

      {/* 2.4 Browse All Library Link */}
      <div style={{ padding: '16px 16px 32px 16px' }}>
        <button
          onClick={() => setShowFullLibrary(true)}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 12,
            background: 'transparent',
            border: '1px solid #21262d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            e.currentTarget.style.borderColor = '#5eead4';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = '#21262d';
          }}
        >
          <Grid3X3 size={16} color="#8b949e" />
          <span style={{ fontSize: 14, color: '#e6edf3', fontWeight: 500 }}>
            Browse All {FORGE_RULE_TEMPLATES.length} Rules
          </span>
        </button>
      </div>

      {/* Bottom Sheet */}
      <AnimatePresence>
        {selectedRule && (
          <RuleDetailSheet
            rule={selectedRule}
            isCollected={isRuleCollected(selectedRule.id)}
            isAdding={forge.addingRuleId === selectedRule.id}
            onAdd={handleAddRule}
            onClose={() => setSelectedRule(null)}
          />
        )}
      </AnimatePresence>

      {/* Starter Kit Modal */}
      <CenteredModal
        isOpen={showStarterKitModal}
        onClose={() => setShowStarterKitModal(false)}
        title="Build Your Strategy"
      >
        <div style={{ padding: '0 20px 20px', maxHeight: '65vh', overflowY: 'auto' }}>
          <StarterKit
            agentId={agent?.id}
            agent={agent}
            forge={forge}
            tokens={tokens}
            isMobile={isMobile}
            onComplete={() => {
              setShowStarterKitModal(false);
              forge.reloadData();
            }}
            onSkip={() => {
              setShowStarterKitModal(false);
              forge.reloadData();
            }}
          />
        </div>
      </CenteredModal>
    </div>
  );
}
