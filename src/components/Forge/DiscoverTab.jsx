// src/components/Forge/DiscoverTab.jsx
// Discover landing page — renders rule template cards from static KB JSON
// with category filter pills, expandable learn-more, and "Add to Bundle" CTA.

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Plus, BookOpen } from 'lucide-react';
import { FORGE_CATEGORIES } from '../../data/forgeKnowledgeBase';

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

function RuleTemplateCard({ template, isExpanded, onToggleExpand, onAddToBundle, isAdding, tokens }) {
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
      {/* Badges row */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '10px',
        flexWrap: 'wrap',
      }}>
        {category && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600,
            background: `${category.color}20`,
            color: category.color,
          }}>
            {category.label}
          </span>
        )}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '3px 10px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 500,
          background: diffStyle.bg,
          color: diffStyle.color,
        }}>
          {template.difficulty}
        </span>
      </div>

      {/* Headline */}
      <h3 style={{
        fontSize: '16px',
        fontWeight: '700',
        color: tokens.textWhite,
        margin: '0 0 6px 0',
        lineHeight: 1.3,
      }}>
        {template.headline}
      </h3>

      {/* Description */}
      <p style={{
        fontSize: '13px',
        color: tokens.textMuted,
        margin: '0 0 14px 0',
        lineHeight: 1.5,
      }}>
        {template.description}
      </p>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '12px',
              marginBottom: '14px',
            }}>
              <p style={{
                fontSize: '13px',
                color: tokens.textSecondary,
                margin: '0 0 10px 0',
                lineHeight: 1.6,
              }}>
                {template.learnMore}
              </p>
              {template.relatedIndicator && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: tokens.textFaint,
                }}>
                  <BookOpen size={12} />
                  <span>Related indicator: <span style={{ color: tokens.textMuted }}>{template.relatedIndicator}</span></span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTAs row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '12px',
      }}>
        <button
          onClick={() => onToggleExpand(template.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            padding: '6px 10px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 500,
            color: tokens.textFaint,
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = tokens.textMuted; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = tokens.textFaint; }}
        >
          {isExpanded ? (
            <>Collapse <ChevronUp size={12} /></>
          ) : (
            <>Learn More <ChevronDown size={12} /></>
          )}
        </button>

        <button
          disabled={isAdding}
          onClick={() => onAddToBundle(template)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '7px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 600,
            background: `${tokens.teal}1A`,
            border: `1px solid ${tokens.teal}40`,
            color: tokens.teal,
            cursor: isAdding ? 'default' : 'pointer',
            opacity: isAdding ? 0.5 : 1,
            pointerEvents: isAdding ? 'none' : 'auto',
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

export default function DiscoverTab({ isMobile, forge, tokens }) {
  const { filteredTemplates, selectedCategory, setSelectedCategory, expandedCardId, setExpandedCardId, addRuleToBundle, addingRuleId } = forge;

  const handleToggleExpand = (id) => {
    setExpandedCardId(expandedCardId === id ? null : id);
  };

  return (
    <div style={{
      padding: isMobile ? '0 16px 24px' : '0 24px 24px',
    }}>
      {/* Category filter pills */}
      <div style={{ marginBottom: '16px' }}>
        <CategoryFilterPills
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          tokens={tokens}
        />
      </div>

      {/* Template count */}
      <div style={{
        fontSize: '12px',
        color: tokens.textFaint,
        marginBottom: '12px',
      }}>
        {filteredTemplates.length} rule template{filteredTemplates.length !== 1 ? 's' : ''}
      </div>

      {/* Rule template cards */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {filteredTemplates.map((template) => (
          <RuleTemplateCard
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

      {/* Empty state */}
      {filteredTemplates.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '48px 0',
          color: tokens.textMuted,
          fontSize: '14px',
        }}>
          No templates in this category yet.
        </div>
      )}
    </div>
  );
}
