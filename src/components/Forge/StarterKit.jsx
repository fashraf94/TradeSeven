// src/components/Forge/StarterKit.jsx
// 3-question onboarding flow that builds a user's first bundle.
// Zero AI cost — all question-to-rule mapping is hardcoded.

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FORGE_RULE_TEMPLATES, FORGE_CATEGORIES } from '../../data/forgeKnowledgeBase';
import { createRule, createBundle, addRuleToBundle, forgeBundle, softDeleteRule } from '../../services/forgeService';
import { updateAgent } from '../../services/agentService';

// ── Question-to-rule mapping ─────────────────────────────────

const STYLE_RULES = {
  momentum: [
    { id: 'tech-moving-average-trend', params: {} },
    { id: 'tech-bollinger-squeeze', params: {} },
  ],
  value: [
    { id: 'fund-value-pe', params: {} },
    { id: 'fund-earnings-surprise', params: {} },
  ],
  contrarian: [
    { id: 'tech-rsi-oversold', params: {} },
    { id: 'tech-rsi-overbought', params: {} },
  ],
};

const RISK_RULES = {
  safe: [
    { id: 'risk-sector-diversification', params: {} },
    { id: 'risk-single-stock-limit', params: {} },
  ],
  balanced: [
    { id: 'risk-sector-diversification', params: {} },
  ],
  yolo: [],
};

const ALLOC_RULES = {
  even: [
    { id: 'alloc-even-spread', params: {} },
  ],
  conviction: [
    { id: 'alloc-tier-preference', params: {} },
    { id: 'alloc-sector-cap', params: {} },
  ],
  mixed: [
    { id: 'alloc-sector-minimum', params: {} },
  ],
};

const BUNDLE_NAMES = {
  momentum: 'Momentum Strategy',
  value: 'Value Strategy',
  contrarian: 'Contrarian Strategy',
};

// ── Questions config ─────────────────────────────────────────

const QUESTIONS = [
  {
    key: 'style',
    title: "What's your style?",
    subtitle: 'Step 1 of 3',
    options: [
      { value: 'momentum', emoji: '\u{1F4C8}', label: 'I chase momentum', desc: 'Ride trends and breakouts when stocks are moving fast', reason: 'chase momentum', summaryFragment: 'chase momentum and ride trends' },
      { value: 'value', emoji: '\u{1F48E}', label: 'I hunt for value', desc: 'Find undervalued companies with strong earnings potential', reason: 'hunt for value', summaryFragment: 'find undervalued companies' },
      { value: 'contrarian', emoji: '\u{1F504}', label: 'I go against the crowd', desc: 'Buy when others panic, sell when others get greedy', reason: 'go against the crowd', summaryFragment: 'go against the crowd' },
    ],
  },
  {
    key: 'risk',
    title: 'How much risk is okay?',
    subtitle: 'Step 2 of 3',
    options: [
      { value: 'safe', emoji: '\u{1F6E1}\uFE0F', label: 'Keep it safe', desc: 'Diversify across sectors and limit exposure to any single stock', reason: 'want to keep it safe', summaryFragment: 'keep risk in check' },
      { value: 'balanced', emoji: '\u2696\uFE0F', label: 'Balanced', desc: "Spread picks across sectors but don't overthink it", reason: 'like a balanced approach', summaryFragment: 'stay balanced on risk' },
      { value: 'yolo', emoji: '\u{1F525}', label: 'Let it ride', desc: 'No guardrails \u2014 your agent trades with full conviction', reason: 'trade with full conviction', summaryFragment: 'trade without guardrails' },
    ],
  },
  {
    key: 'alloc',
    title: 'How should your agent allocate?',
    subtitle: 'Step 3 of 3',
    options: [
      { value: 'even', emoji: '\u{1F4CA}', label: 'Spread it evenly', desc: 'Equal weight across all picks \u2014 no favorites', reason: 'spread it evenly', summaryFragment: 'spread picks evenly' },
      { value: 'conviction', emoji: '\u{1F3AF}', label: 'Bet big on the best', desc: 'Overweight your strongest conviction picks', reason: 'bet big on your best', summaryFragment: 'bet big on your best picks' },
      { value: 'mixed', emoji: '\u{1F500}', label: 'Mix safe and risky', desc: 'Balance some safe picks with some volatile ones', reason: 'mix safe and risky', summaryFragment: 'balance safe and volatile picks' },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────

function getTemplate(templateId) {
  return FORGE_RULE_TEMPLATES.find(t => t.id === templateId);
}

function getCategoryColor(categoryId) {
  const cat = FORGE_CATEGORIES.find(c => c.id === categoryId);
  return cat?.color || '#5eead4';
}

function getCategoryLabel(categoryId) {
  const cat = FORGE_CATEGORIES.find(c => c.id === categoryId);
  return cat?.label || categoryId;
}

function resolveRuleText(templateId, paramOverrides) {
  const template = getTemplate(templateId);
  if (!template) return '';
  const ft = template.forgeTemplates[0];
  let text = ft.text;
  if (ft.params) {
    for (const [key, config] of Object.entries(ft.params)) {
      const value = paramOverrides[key] !== undefined ? paramOverrides[key] : config.default;
      text = text.replace(`{${key}}`, value);
    }
  }
  return text;
}

function buildSelectedRules(answers) {
  const { style, risk, alloc } = answers;
  if (!style || !risk || !alloc) return [];

  const styleOption = QUESTIONS[0].options.find(o => o.value === style);
  const riskOption = QUESTIONS[1].options.find(o => o.value === risk);
  const allocOption = QUESTIONS[2].options.find(o => o.value === alloc);

  const taggedRules = [];
  (STYLE_RULES[style] || []).forEach(rule => {
    taggedRules.push({ ...rule, reason: styleOption?.reason || '' });
  });
  (RISK_RULES[risk] || []).forEach(rule => {
    taggedRules.push({ ...rule, reason: riskOption?.reason || '' });
  });
  (ALLOC_RULES[alloc] || []).forEach(rule => {
    taggedRules.push({ ...rule, reason: allocOption?.reason || '' });
  });
  return taggedRules;
}

function buildBundleSummary(answers) {
  const fragments = QUESTIONS.map(q => {
    const selected = q.options.find(o => o.value === answers[q.key]);
    return selected?.summaryFragment || '';
  }).filter(Boolean);

  if (fragments.length === 0) return '';
  if (fragments.length === 1) return `You ${fragments[0]}.`;
  if (fragments.length === 2) return `You ${fragments[0]} and ${fragments[1]}.`;
  return `You ${fragments[0]}, ${fragments[1]}, and ${fragments[2]}.`;
}

function getAlternatives(rule, allSelected) {
  const template = getTemplate(rule.id);
  if (!template) return [];
  const selectedIds = new Set(allSelected.map(r => r.id));
  return FORGE_RULE_TEMPLATES
    .filter(t => t.category === template.category && !selectedIds.has(t.id))
    .map(t => ({ id: t.id, params: {} }));
}

// ── Subcomponents ────────────────────────────────────────────

function ProgressDots({ step, tokens }) {
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: i <= step ? tokens.teal : 'rgba(255,255,255,0.12)',
            transition: 'background 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

function OptionCard({ option, isSelected, onSelect, tokens }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        width: '100%',
        padding: '16px 18px',
        borderRadius: '14px',
        border: isSelected ? `2px solid ${tokens.teal}` : '2px solid rgba(255,255,255,0.06)',
        background: isSelected ? `${tokens.teal}15` : '#15171E',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.2s, background 0.2s',
        minHeight: '48px',
      }}
    >
      <span style={{ fontSize: '22px', lineHeight: '1.2', flexShrink: 0 }}>{option.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: tokens.textWhite, marginBottom: '4px' }}>
          {option.label}
        </div>
        <div style={{ fontSize: '13px', color: tokens.textMuted, lineHeight: '1.4' }}>
          {option.desc}
        </div>
      </div>
    </motion.button>
  );
}

function RulePreviewCard({ rule, index, onSwap, swapOpen, alternatives, onSwapSelect, tokens }) {
  const template = getTemplate(rule.id);
  if (!template) return null;
  const categoryColor = getCategoryColor(template.category);
  const ruleText = resolveRuleText(rule.id, rule.params);

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 16px',
          background: '#15171E',
          borderRadius: swapOpen ? '14px 14px 0 0' : '14px',
          border: '1px solid rgba(255,255,255,0.06)',
          borderBottom: swapOpen ? '1px solid rgba(255,255,255,0.03)' : '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: categoryColor,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            flexShrink: 0,
            minWidth: '48px',
          }}
        >
          {getCategoryLabel(template.category)}
        </span>
        <span style={{ fontSize: '13px', color: tokens.textPrimary, flex: 1, lineHeight: '1.4' }}>
          {ruleText}
        </span>
        {alternatives.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onSwap(index)}
            style={{
              background: 'none',
              border: 'none',
              color: tokens.textMuted,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              flexShrink: 0,
              minWidth: '36px',
              minHeight: '36px',
            }}
            title="Swap this rule"
          >
            Swap
          </motion.button>
        )}
      </div>

      {/* Swap picker */}
      <AnimatePresence>
        {swapOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                background: '#1A1D26',
                borderRadius: '0 0 14px 14px',
                border: '1px solid rgba(255,255,255,0.06)',
                borderTop: 'none',
                padding: '8px',
              }}
            >
              <div style={{ fontSize: '11px', color: tokens.textMuted, padding: '4px 8px 8px', fontWeight: 500 }}>
                Swap with:
              </div>
              {alternatives.map(alt => {
                const altTemplate = getTemplate(alt.id);
                if (!altTemplate) return null;
                return (
                  <motion.button
                    key={alt.id}
                    whileHover={{ background: 'rgba(255,255,255,0.06)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSwapSelect(index, alt)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: '48px',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 600, color: tokens.textWhite }}>
                      {altTemplate.headline}
                    </span>
                    <span style={{ fontSize: '12px', color: tokens.textMuted, lineHeight: '1.3' }}>
                      {altTemplate.description}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function StarterKit({ agentId, agent, forge, tokens, isMobile, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ style: null, risk: null, alloc: null });
  const [selectedRules, setSelectedRules] = useState([]);
  const [forging, setForging] = useState(false);
  const [forgingDone, setForgingDone] = useState(false);
  const [swappingIndex, setSwappingIndex] = useState(null);
  const [error, setError] = useState(null);

  const handleSelect = useCallback((questionKey, value) => {
    const newAnswers = { ...answers, [questionKey]: value };
    setAnswers(newAnswers);

    // Short delay for selection animation, then advance
    setTimeout(() => {
      if (step < 2) {
        setStep(step + 1);
      } else {
        // All 3 answered — compute rules and go to result screen
        setSelectedRules(buildSelectedRules(newAnswers));
        setStep(3);
      }
    }, 250);
  }, [answers, step]);

  const handleSkip = useCallback(async () => {
    try {
      await updateAgent(agentId, { starterKitCompleted: true });
      onSkip();
    } catch (err) {
      console.error('[StarterKit] skip failed:', err);
    }
  }, [agentId, onSkip]);

  const handleSwapToggle = useCallback((index) => {
    setSwappingIndex(prev => prev === index ? null : index);
  }, []);

  const handleSwapSelect = useCallback((index, newRule) => {
    setSelectedRules(prev => {
      const next = [...prev];
      next[index] = newRule;
      return next;
    });
    setSwappingIndex(null);
  }, []);

  const handleForgeAndEquip = useCallback(async () => {
    if (forging) return;
    setForging(true);
    setError(null);

    const ruleIds = [];
    try {
      // 1. Create all rules
      for (const rule of selectedRules) {
        const template = getTemplate(rule.id);
        const ft = template.forgeTemplates[0];
        // Merge param overrides with defaults
        const mergedParams = {};
        if (ft.params) {
          for (const [key, config] of Object.entries(ft.params)) {
            mergedParams[key] = rule.params[key] !== undefined ? rule.params[key] : config.default;
          }
        }
        let ruleText = ft.text;
        for (const [key, val] of Object.entries(mergedParams)) {
          ruleText = ruleText.replace(`{${key}}`, val);
        }

        const ruleId = await createRule(agentId, {
          text: ruleText,
          source: 'forge_discover',
          sourceRef: template.id,
          category: ft.category || template.category,
          params: Object.keys(ft.params || {}).length > 0 ? ft.params : null,
        });
        ruleIds.push(ruleId);
      }

      // 2. Create bundle
      const bundleName = BUNDLE_NAMES[answers.style] || 'Starter Strategy';
      const bundleId = await createBundle(agentId, { name: bundleName });

      // 3. Add rules to bundle
      for (const ruleId of ruleIds) {
        await addRuleToBundle(agentId, bundleId, ruleId);
      }

      // 4. Forge
      await forgeBundle(agentId, bundleId);

      // 5. Mark completed — equipping happens on the Home (EquipStation), not in
      // the Forge. The starter bundle is forged "ready"; the user equips it on
      // the command bridge.
      await updateAgent(agentId, { starterKitCompleted: true });

      // 6. Show success briefly, then dismiss
      setForgingDone(true);
      setTimeout(() => {
        onComplete();
      }, 1800);
    } catch (err) {
      console.error('[StarterKit] forge failed:', err);
      // Clean up orphaned rules created before the failure
      for (const ruleId of ruleIds) {
        await softDeleteRule(agentId, ruleId).catch(() => {});
      }
      setError(err.message || 'Something went wrong. Tap to try again.');
    } finally {
      setForging(false);
    }
  }, [agentId, selectedRules, forging, onComplete]);

  // ── Render ─────────────────────────────────────────────────

  const padding = isMobile ? '20px 16px' : '32px 24px';
  const maxWidth = '520px';

  // Success screen
  if (forgingDone) {
    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
      }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          style={{ textAlign: 'center' }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>{'\u2692\uFE0F'}</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: tokens.textWhite, margin: '0 0 8px' }}>
            Your strategy is ready!
          </h2>
          <p style={{ fontSize: '14px', color: tokens.textMuted, margin: 0, lineHeight: '1.5' }}>
            Your agent will use these rules in its next battle.
          </p>
        </motion.div>
      </div>
    );
  }

  // Result screen (step 3)
  if (step === 3) {
    return (
      <div style={{ padding, maxWidth, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Bundle name hero */}
          <h2 style={{
            fontSize: '24px',
            fontWeight: 800,
            color: '#ffffff',
            textAlign: 'center',
            margin: '0 0 4px',
          }}>
            {BUNDLE_NAMES[answers.style] || 'Starter Strategy'}
          </h2>

          {/* Bundle summary */}
          <p style={{
            fontSize: '14px',
            color: '#8b949e',
            textAlign: 'center',
            lineHeight: 1.5,
            margin: '0 auto 24px',
            maxWidth: '300px',
          }}>
            {buildBundleSummary(answers)}
          </p>

          {/* Rule count badge */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(94, 234, 212, 0.1)',
              borderRadius: '9999px',
              padding: '4px 14px',
              fontSize: '12px',
              color: '#5eead4',
              fontWeight: 600,
            }}>
              {selectedRules.length} rules in this bundle
            </span>
          </div>

          {/* Rule cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {selectedRules.map((rule, i) => {
              const template = getTemplate(rule.id);
              if (!template) return null;
              const categoryColor = getCategoryColor(template.category);
              const ruleText = resolveRuleText(rule.id, rule.params);
              return (
                <div
                  key={`${rule.id}-${i}`}
                  style={{
                    background: '#15171E',
                    border: '1px solid #21262d',
                    borderLeft: `4px solid ${categoryColor}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{
                      fontSize: '14px',
                      color: '#e6edf3',
                      fontWeight: 500,
                    }}>
                      {ruleText}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      color: categoryColor,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      flexShrink: 0,
                      marginLeft: '12px',
                    }}>
                      {getCategoryLabel(template.category)}
                    </span>
                  </div>
                  {rule.reason && (
                    <div style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      color: '#8b949e',
                      fontStyle: 'italic',
                    }}>
                      Because you {rule.reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <div style={{
              background: 'rgba(249,112,102,0.1)',
              border: '1px solid rgba(249,112,102,0.3)',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#f97066',
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          {/* Primary CTA */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleForgeAndEquip}
            disabled={forging}
            style={{
              width: '100%',
              padding: '14px 24px',
              borderRadius: '12px',
              border: 'none',
              background: forging
                ? 'rgba(94, 234, 212, 0.5)'
                : 'linear-gradient(135deg, #5eead4 0%, #00d9ff 100%)',
              color: '#0D0E12',
              fontSize: '15px',
              fontWeight: 700,
              cursor: forging ? 'wait' : 'pointer',
              boxShadow: forging ? 'none' : '0 4px 16px rgba(94, 234, 212, 0.3)',
              minHeight: '52px',
            }}
          >
            {forging ? 'Creating...' : 'Forge & Equip Bundle'}
          </motion.button>

          {/* Change answers link */}
          <div
            onClick={() => {
              if (forging) return;
              setStep(0);
              setAnswers({ style: null, risk: null, alloc: null });
              setSelectedRules([]);
              setError(null);
            }}
            style={{
              marginTop: '12px',
              textAlign: 'center',
              fontSize: '13px',
              color: '#8b949e',
              cursor: forging ? 'default' : 'pointer',
              opacity: forging ? 0.5 : 1,
            }}
          >
            {'\u2190'} Change my answers
          </div>
        </motion.div>
      </div>
    );
  }

  // Question steps (0, 1, 2)
  const question = QUESTIONS[step];

  return (
    <div style={{ padding, maxWidth, margin: '0 auto' }}>
      <ProgressDots step={step} tokens={tokens} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.3 }}
        >
          {step === 0 && (
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>{'\u{1F525}'}</div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: tokens.textWhite, margin: '0 0 4px' }}>
                Build Your First Strategy
              </h2>
            </div>
          )}

          <p style={{
            fontSize: '11px',
            fontWeight: 600,
            color: tokens.teal,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '6px',
            textAlign: 'center',
          }}>
            {question.subtitle}
          </p>

          <h3 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: tokens.textWhite,
            textAlign: 'center',
            margin: '0 0 20px',
          }}>
            {question.title}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {question.options.map(option => (
              <OptionCard
                key={option.value}
                option={option}
                isSelected={answers[question.key] === option.value}
                onSelect={() => handleSelect(question.key, option.value)}
                tokens={tokens}
              />
            ))}
          </div>

          <button
            onClick={handleSkip}
            style={{
              display: 'block',
              width: '100%',
              padding: '14px',
              marginTop: '20px',
              background: 'none',
              border: 'none',
              color: tokens.textMuted,
              fontSize: '13px',
              cursor: 'pointer',
              textAlign: 'center',
              minHeight: '48px',
            }}
          >
            Skip &mdash; I'll explore on my own
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
