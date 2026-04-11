// src/components/Forge/CategoryAccordion.jsx
// Collapsible section for a single rule category with inline rule cards.
// Phase B: Split button (Add + Gear) and RuleConfigDrawer integration.

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Check, Settings2 } from 'lucide-react';
import RuleConfigDrawer from './RuleConfigDrawer';
import RuleModeBadge from './RuleModeBadge';

// Reuse color + icon maps from ForgeRuleCard for consistency
const CATEGORY_COLORS = {
  technical: '#5eead4',
  fundamental: '#a78bfa',
  risk: '#f97066',
  allocation: '#f59e0b',
  mid_battle: '#6366F1',
  game_state: '#94A3B8',
  threshold: '#e879f9',
  tier_strategy: '#fbbf24',
  institutional: '#06b6d4',
};

const DIFFICULTY_COLORS = {
  beginner: '#5eead4',
  intermediate: '#a78bfa',
  advanced: '#f97066',
};

function AccordionRuleCard({ rule, isEquipped, onAdd, onRemove, agentExists, isConfigOpen, onToggleConfig, forgeMode }) {
  const catColor = CATEGORY_COLORS[rule.category] || '#5eead4';
  const hasParams = rule.forgeTemplates?.[0]?.params && Object.keys(rule.forgeTemplates[0].params).length > 0;

  return (
    <div style={{
      background: isEquipped ? '#292A2E' : '#15171E',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.06)',
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Category color dot */}
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: catColor,
          flexShrink: 0,
          marginTop: 5,
        }} />

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#ffffff',
            lineHeight: 1.3,
          }}>
            {rule.headline}
          </div>
          <div style={{
            fontSize: 12,
            color: '#8b949e',
            marginTop: 3,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {rule.description}
          </div>

          {/* Hook field */}
          {rule.hook && (
            <div style={{
              fontSize: 12,
              color: '#A0AEC0',
              fontStyle: 'italic',
              marginTop: 4,
              lineHeight: 1.4,
            }}>
              {rule.hook}
            </div>
          )}

          {/* Difficulty + (in All mode) mode badge */}
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: DIFFICULTY_COLORS[rule.difficulty] || '#8b949e',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              {rule.difficulty}
            </span>
            {forgeMode === 'all' && rule.modes && <RuleModeBadge mode={rule.modes} />}
          </div>
        </div>

        {/* CTA */}
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          {!agentExists ? (
            <button
              disabled
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#4a5568',
                background: 'none',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                padding: '6px 10px',
                cursor: 'not-allowed',
                whiteSpace: 'nowrap',
              }}
            >
              Create Agent to Add
            </button>
          ) : isEquipped ? (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(rule.id); }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#5EEAD4',
                background: 'rgba(94,234,212,0.12)',
                border: 'none',
                borderRadius: 8,
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Check size={12} /> Equipped
            </button>
          ) : (
            /* Split button: [+ Add | Gear] */
            <div style={{
              display: 'flex',
              alignItems: 'stretch',
              border: '1px solid rgba(94,234,212,0.3)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              {/* Add button */}
              <button
                onClick={(e) => { e.stopPropagation(); onAdd(rule.id); }}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: isConfigOpen ? '#6E7681' : '#5EEAD4',
                  background: 'none',
                  border: 'none',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                <Plus size={12} />
                {isConfigOpen ? 'Defaults' : 'Add'}
              </button>

              {/* Divider + Gear button (only if rule has params) */}
              {hasParams && (
                <>
                  <div style={{
                    width: 1,
                    background: '#2A2D35',
                    alignSelf: 'stretch',
                  }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleConfig(rule.id); }}
                    style={{
                      width: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <Settings2
                      size={14}
                      color={isConfigOpen ? catColor : '#5EEAD4'}
                      fill={isConfigOpen ? catColor : 'none'}
                    />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Config Drawer */}
      {hasParams && (
        <RuleConfigDrawer
          rule={rule}
          isOpen={isConfigOpen}
          onAdd={(paramValues) => onAdd(rule.id, paramValues)}
          categoryColor={catColor}
        />
      )}
    </div>
  );
}

const CategoryAccordion = React.memo(function CategoryAccordion({
  category,
  rules,
  equippedRuleIds,
  isExpanded,
  onToggle,
  onAddRule,
  onRemoveRule,
  agentExists,
  expandedRuleId,
  onToggleRuleConfig,
  forgeMode,
}) {
  const catColor = category.color || CATEGORY_COLORS[category.id] || '#5eead4';
  const equippedCount = rules.filter(r => equippedRuleIds.has(r.id)).length;

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '12px 14px',
          background: '#15171E',
          border: 'none',
          borderLeft: `4px solid ${catColor}`,
          borderRadius: '8px',
          cursor: 'pointer',
          gap: 10,
        }}
      >
        {/* Category name */}
        <span style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#ffffff',
          flex: 1,
          textAlign: 'left',
        }}>
          {category.label || category.name}
        </span>

        {/* Equipped count badge */}
        {equippedCount > 0 && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: catColor,
            background: `${catColor}1A`,
            borderRadius: 6,
            padding: '2px 8px',
          }}>
            {equippedCount} equipped
          </span>
        )}

        {/* Total count */}
        <span style={{
          fontSize: 11,
          color: '#4a5568',
        }}>
          / {rules.length}
        </span>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <ChevronDown size={16} color="#4a5568" />
        </motion.div>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '8px 0 0 0' }}>
              {rules.map(rule => (
                <AccordionRuleCard
                  key={rule.id}
                  rule={rule}
                  isEquipped={equippedRuleIds.has(rule.id)}
                  onAdd={onAddRule}
                  onRemove={onRemoveRule}
                  agentExists={agentExists}
                  isConfigOpen={expandedRuleId === rule.id}
                  onToggleConfig={onToggleRuleConfig}
                  forgeMode={forgeMode}
                />
              ))}
              {rules.length === 0 && (
                <div style={{
                  padding: '20px 14px',
                  fontSize: 13,
                  color: '#4a5568',
                  textAlign: 'center',
                }}>
                  No rules in this category yet
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default CategoryAccordion;
