// src/components/Forge/CollectionDetailSheet.jsx
// Bottom sheet (mobile) / side panel (desktop) showing a collection's rules.
// Phase E: Enhanced for Trading Style Collections with philosophy, param diffs, rationale.
// Phase F: Progressive unlock — priority tier grouping, locked cards, progression indicator.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Check, ChevronDown, Sparkles, Lock } from 'lucide-react';
import { getNextLevelInfo, AGENT_LEVELS } from '../../constants/agentProgression';

const DIFFICULTY_COLORS = {
  beginner: '#5eead4',
  intermediate: '#a78bfa',
  advanced: '#f97066',
};

// Priority tier metadata for progressive collections
const TIER_HEADERS = {
  1: { emoji: '\u{1F3AF}', label: 'Core Strategy', sublabel: 'active at all levels' },
  2: { emoji: '\u{1F527}', label: 'Foundation', sublabel: 'active at Rookie+' },
  3: { emoji: '\u26A1',    label: 'Competitive Edge', sublabel: 'unlocks at Starter' },
  4: { emoji: '\u{1F3C6}', label: 'Mastery', sublabel: 'unlocks at Partner' },
};

// Which level is required for each priority tier
const TIER_REQUIRED_LEVEL = { 1: 'rookie', 2: 'rookie', 3: 'starter', 4: 'partner' };
const LEVEL_ORDER = { rookie: 0, starter: 1, partner: 2 };

function isTierLocked(priority, agentLevel) {
  const requiredLevel = TIER_REQUIRED_LEVEL[priority] || 'rookie';
  return (LEVEL_ORDER[agentLevel] || 0) < (LEVEL_ORDER[requiredLevel] || 0);
}

function getUnlockLabel(priority) {
  if (priority === 3) return 'Unlocks at Starter level';
  if (priority === 4) return 'Unlocks at Partner level';
  return null;
}

function ParamDiffRow({ paramKey, paramDef, overrideValue, accentColor }) {
  if (!paramDef) return null;
  const defaultVal = paramDef.default;

  // Format display values
  let defaultDisplay = String(defaultVal);
  let overrideDisplay = String(overrideValue);

  if (paramDef.type === 'select' && paramDef.options) {
    const defOpt = paramDef.options.find(o => o.value === defaultVal);
    const ovrOpt = paramDef.options.find(o => o.value === overrideValue);
    if (defOpt) defaultDisplay = defOpt.label;
    if (ovrOpt) overrideDisplay = ovrOpt.label;
  }
  if (paramDef.type === 'toggle') {
    defaultDisplay = defaultVal ? 'on' : 'off';
    overrideDisplay = overrideValue ? 'on' : 'off';
  }
  if (paramDef.unit) {
    defaultDisplay += ` ${paramDef.unit}`;
    overrideDisplay += ` ${paramDef.unit}`;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      lineHeight: 1.4,
      marginTop: 3,
    }}>
      <span style={{ color: '#6E7681', fontWeight: 500 }}>
        {paramDef.label || paramKey}:
      </span>
      <span style={{ color: '#6E7681', textDecoration: 'line-through' }}>
        {defaultDisplay}
      </span>
      <span style={{ color: '#6E7681' }}>&rarr;</span>
      <span style={{ color: accentColor, fontWeight: 600 }}>
        {overrideDisplay}
      </span>
    </div>
  );
}

function RationaleToggle({ rationale }) {
  const [open, setOpen] = useState(false);
  if (!rationale) return null;

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: '#6E7681',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Why this tuning?
        <ChevronDown
          size={12}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
          }}
        />
      </button>
      {open && (
        <div style={{
          fontSize: 12,
          color: '#6E7681',
          fontStyle: 'italic',
          lineHeight: 1.5,
          marginTop: 4,
          paddingLeft: 2,
        }}>
          {rationale}
        </div>
      )}
    </div>
  );
}

export default function CollectionDetailSheet({
  collection,
  collectedSourceRefs,
  onAddAll,
  onAddRule,
  onClose,
  agentExists,
  isAdding,
  onUsePlaybook,
  activeBundleName,
  onMergeIntoBundle,
  agentLevel,
  gamesPlayed,
}) {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const h = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Lock body scroll
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, []);

  if (!collection) return null;

  const { title, subtitle, accentColor, rules, categoryColors, ruleIds: rawRuleIds } = collection;
  const ruleIds = rawRuleIds || [];
  const isStyle = !!collection.isStyleCollection;
  const collectedCount = ruleIds.filter(id => collectedSourceRefs.has(id)).length;
  const allCollected = ruleIds.length > 0 && collectedCount === ruleIds.length;
  const remainingCount = ruleIds.length - collectedCount;

  const hasProgression = !!collection.progressionHints;
  const currentLevel = agentLevel || 'rookie';
  const hints = hasProgression ? collection.progressionHints[currentLevel] : null;
  const totalRules = rules?.length || 0;
  const activeCount = hints?.activeCount || totalRules;

  // Group rules by priority tier for progressive collections
  const tierGroups = useMemo(() => {
    if (!hasProgression || !rules) return null;
    const groups = {};
    for (const rule of rules) {
      const p = rule.priority || 1;
      if (!groups[p]) groups[p] = [];
      groups[p].push(rule);
    }
    return groups;
  }, [hasProgression, rules]);

  // Next level info for progression indicator
  const nextLevelInfo = useMemo(() => {
    if (!hasProgression || gamesPlayed == null) return null;
    return getNextLevelInfo(gamesPlayed);
  }, [hasProgression, gamesPlayed]);

  // CTA label for progressive collections
  const ctaLabel = hasProgression
    ? `Use This Playbook (${activeCount} of ${totalRules} active)`
    : 'Use This Playbook';

  // Render a single rule card
  const renderRuleCard = (rule, idx, { locked = false, isFirstInGroup = false }) => {
    const isCollected = collectedSourceRefs.has(rule.id);
    const paramDefs = rule.forgeTemplates?.[0]?.params;
    const overrides = rule.paramOverrides;
    const unlockLabel = locked ? getUnlockLabel(rule.priority) : null;

    // Compute which params differ from defaults
    const diffs = [];
    if (isStyle && overrides && paramDefs) {
      for (const [key, val] of Object.entries(overrides)) {
        const def = paramDefs[key];
        if (def && val !== def.default) {
          diffs.push({ key, def, value: val });
        }
      }
    }

    return (
      <div
        key={rule.id}
        style={{
          padding: '12px 0',
          borderTop: !isFirstInGroup ? '1px solid rgba(255,255,255,0.06)' : 'none',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          opacity: locked ? 0.5 : 1,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {locked && <Lock size={14} style={{ color: '#6E7681', flexShrink: 0 }} />}
            <span style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', lineHeight: 1.3 }}>
              {rule.headline}
            </span>
            {rule.category && (
              <span style={{
                fontSize: 10, color: '#4a5568', textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {rule.category}
              </span>
            )}
          </div>

          {locked && unlockLabel && (
            <div style={{ fontSize: 11, color: '#6E7681', marginTop: 3 }}>
              {unlockLabel}
            </div>
          )}

          {/* Param diffs (style collections only) */}
          {diffs.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {diffs.map(d => (
                <ParamDiffRow
                  key={d.key}
                  paramKey={d.key}
                  paramDef={d.def}
                  overrideValue={d.value}
                  accentColor={accentColor}
                />
              ))}
            </div>
          )}

          {/* Rationale (style collections only — works even when locked) */}
          {isStyle && rule.rationale && (
            <RationaleToggle rationale={rule.rationale} />
          )}

          {/* Description for non-style collections */}
          {!isStyle && (
            <>
              {rule.hook && (
                <div style={{
                  fontSize: 13, lineHeight: 1.5, marginTop: 3,
                  color: '#A0AEC0', fontStyle: 'italic',
                }}>
                  {rule.hook}
                </div>
              )}
              <div style={{
                fontSize: 13, lineHeight: 1.5, marginTop: rule.hook ? 2 : 3,
                color: '#8b949e',
              }}>
                {rule.description}
              </div>
              <div style={{
                fontSize: 10, color: '#4a5568', textTransform: 'uppercase',
                letterSpacing: 0.5, marginTop: 4,
              }}>
                {rule.category} · <span style={{ color: DIFFICULTY_COLORS[rule.difficulty] || '#4a5568' }}>
                  {rule.difficulty}
                </span>
              </div>
            </>
          )}
        </div>
        {/* Individual add/added — hidden for locked rules */}
        {locked ? null : !agentExists ? null : isCollected ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 600, color: '#5EEAD4',
            flexShrink: 0, marginTop: 2,
          }}>
            <Check size={12} /> Added
          </div>
        ) : !isStyle ? (
          <button
            onClick={() => onAddRule(rule)}
            disabled={isAdding}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              fontSize: 11, fontWeight: 600, color: '#5EEAD4',
              background: 'none', border: '1px solid rgba(94,234,212,0.3)',
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
              flexShrink: 0, marginTop: 2,
              opacity: isAdding ? 0.5 : 1,
            }}
          >
            <Plus size={12} /> Add
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 50,
        }}
      />

      {/* Sheet / Panel */}
      <motion.div
        initial={isDesktop ? { x: '100%' } : { y: '100%' }}
        animate={isDesktop ? { x: 0 } : { y: 0 }}
        exit={isDesktop ? { x: '100%' } : { y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={isDesktop ? {
          position: 'fixed', top: 0, right: 0, width: 420,
          height: '100vh', background: '#0D0E12', zIndex: 51,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        } : {
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: '75vh', background: '#0D0E12', zIndex: 51,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Handle / close */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 8px',
          flexShrink: 0,
        }}>
          {!isDesktop && (
            <div style={{
              position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
              width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)',
            }} />
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#4a5568',
              cursor: 'pointer', padding: 4, display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Header */}
        <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{
              fontSize: 18, fontWeight: 700, color: '#ffffff',
              borderLeft: `3px solid ${accentColor}`, paddingLeft: 10,
            }}>
              {title}
            </div>
            <span style={{ fontSize: 12, color: '#4a5568', flexShrink: 0, marginLeft: 8 }}>
              {ruleIds.length} rules
            </span>
          </div>
          <div style={{
            fontSize: 13, color: '#8b949e', lineHeight: 1.4,
            marginTop: 6, paddingLeft: 13,
          }}>
            {subtitle}
          </div>
          {/* Category dots */}
          {categoryColors && categoryColors.length > 0 && (
            <div style={{ display: 'flex', gap: 5, marginTop: 8, paddingLeft: 13 }}>
              {categoryColors.map((color, i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: color,
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Philosophy (style collections only) */}
        {isStyle && collection.philosophy && (
          <div style={{
            padding: '0 20px 12px',
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: 13,
              color: '#94A3B8',
              fontStyle: 'italic',
              lineHeight: 1.6,
              paddingBottom: 12,
              borderBottom: '1px solid #2A2D35',
            }}>
              {collection.philosophy}
            </div>
          </div>
        )}

        {/* Progression indicator (progressive collections only) */}
        {hasProgression && hints && (
          <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
            {/* Progress bar */}
            <div style={{
              height: 6,
              borderRadius: 3,
              background: '#1C1A27',
              overflow: 'hidden',
              marginBottom: 8,
            }}>
              <div style={{
                height: '100%',
                width: `${Math.round((activeCount / totalRules) * 100)}%`,
                background: '#5EEAD4',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }} />
            </div>
            {/* Status text */}
            <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }}>
              {activeCount} of {totalRules} rules will activate at your level
            </div>
            <div style={{ fontSize: 12, color: '#6E7681', lineHeight: 1.5, marginTop: 2 }}>
              {hints.message}
            </div>
            {/* Games remaining */}
            {nextLevelInfo && (
              <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>
                {nextLevelInfo.gamesNeeded} more game{nextLevelInfo.gamesNeeded !== 1 ? 's' : ''} to reach {nextLevelInfo.label}
              </div>
            )}
          </div>
        )}

        {/* Rule list */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0 20px',
        }}>
          {hasProgression && tierGroups ? (
            // Progressive: render grouped by priority tier
            Object.keys(tierGroups)
              .sort((a, b) => Number(a) - Number(b))
              .map(priority => {
                const p = Number(priority);
                const tier = TIER_HEADERS[p];
                const tierRules = tierGroups[p];
                const locked = isTierLocked(p, currentLevel);

                return (
                  <div key={p}>
                    {/* Tier header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '12px 0 4px',
                      borderTop: p > 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    }}>
                      <span style={{ fontSize: 14 }}>{tier?.emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: locked ? '#4a5568' : '#ffffff' }}>
                        {tier?.label || `Priority ${p}`}
                      </span>
                      <span style={{ fontSize: 11, color: '#4a5568' }}>
                        — {tier?.sublabel}
                      </span>
                      {locked && <Lock size={12} style={{ color: '#4a5568' }} />}
                    </div>
                    {/* Tier rules */}
                    {tierRules.map((rule, idx) =>
                      renderRuleCard(rule, idx, { locked, isFirstInGroup: idx === 0 })
                    )}
                  </div>
                );
              })
          ) : (
            // Non-progressive: flat list (original behavior)
            rules.map((rule, idx) =>
              renderRuleCard(rule, idx, { locked: false, isFirstInGroup: idx === 0 })
            )
          )}
        </div>

        {/* CTA footer */}
        {agentExists && (
          <div style={{ padding: '12px 20px 20px', flexShrink: 0 }}>
            {isStyle ? (
              /* Style collection CTAs */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Primary: Use This Playbook */}
                <button
                  onClick={() => onUsePlaybook && onUsePlaybook(collection)}
                  disabled={isAdding}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10,
                    background: accentColor, border: 'none',
                    color: '#ffffff', fontSize: 14, fontWeight: 700,
                    cursor: isAdding ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: isAdding ? 0.6 : 1,
                  }}
                >
                  <Sparkles size={16} /> {ctaLabel}
                </button>

                {/* Secondary: Merge Into Bundle (only if active bundle exists) */}
                {activeBundleName && onMergeIntoBundle && (
                  <button
                    onClick={() => onMergeIntoBundle(collection)}
                    disabled={isAdding}
                    style={{
                      width: '100%', padding: '8px',
                      background: 'none', border: 'none',
                      color: accentColor, fontSize: 12, fontWeight: 500,
                      cursor: isAdding ? 'not-allowed' : 'pointer',
                      textAlign: 'center',
                      opacity: isAdding ? 0.6 : 1,
                    }}
                  >
                    Merge these rules into {activeBundleName}
                  </button>
                )}
              </div>
            ) : (
              /* Original collection CTAs */
              allCollected ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '12px', borderRadius: 10,
                  background: 'rgba(94,234,212,0.12)', color: '#5EEAD4',
                  fontSize: 13, fontWeight: 600,
                }}>
                  <Check size={14} /> All Added
                </div>
              ) : (
                <button
                  onClick={() => onAddAll(collection)}
                  disabled={isAdding}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10,
                    background: 'none', border: '1px solid rgba(94,234,212,0.3)',
                    color: '#5EEAD4', fontSize: 13, fontWeight: 600,
                    cursor: isAdding ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: isAdding ? 0.6 : 1,
                  }}
                >
                  <Plus size={14} /> Add All Remaining ({remainingCount})
                </button>
              )
            )}
          </div>
        )}
      </motion.div>
    </>
  );
}
