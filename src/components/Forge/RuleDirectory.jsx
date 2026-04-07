import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, X } from 'lucide-react';
import { FORGE_RULE_TEMPLATES, FORGE_CATEGORIES } from '../../data/forgeKnowledgeBase';
import { CATEGORY_ORDER } from '../../hooks/useForge';

// Build a lookup from category id to { name, color }
const CATEGORY_MAP = {};
FORGE_CATEGORIES.forEach(c => {
  CATEGORY_MAP[c.id] = { name: c.label, color: c.color };
});

function matchesSearch(rule, query) {
  const q = query.toLowerCase();
  if (rule.headline?.toLowerCase().includes(q)) return true;
  if (rule.description?.toLowerCase().includes(q)) return true;
  if (rule.tags?.some(t => t.toLowerCase().includes(q))) return true;
  // For user rules that may have text instead of headline
  if (rule.text?.toLowerCase().includes(q)) return true;
  return false;
}

function RuleRow({ rule, isSelected, onClick }) {
  const cat = CATEGORY_MAP[rule.category] || CATEGORY_MAP[rule.forgeTemplates?.[0]?.category];

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 16px',
        background: isSelected ? '#1C1A2780' : 'transparent',
        border: 'none',
        borderLeft: isSelected ? '3px solid #5EEAD4' : '3px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => {
        if (!isSelected) e.currentTarget.style.background = '#1C1A2740';
      }}
      onMouseLeave={e => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      }}
    >
      {cat && (
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: cat.color,
          flexShrink: 0,
        }} />
      )}
      <span style={{
        fontSize: 13,
        color: isSelected ? '#E2E8F0' : '#A0AEC0',
        fontWeight: isSelected ? 600 : 400,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {rule.headline || rule.text || 'Untitled Rule'}
      </span>
    </button>
  );
}

function CategorySection({ categoryId, rules, selectedRuleId, onSelectRule, isExpanded, onToggle }) {
  const cat = CATEGORY_MAP[categoryId];
  if (!cat || rules.length === 0) return null;

  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={14} color="#4a5568" />
        </motion.div>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: cat.color,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', flex: 1, textAlign: 'left' }}>
          {cat.name}
        </span>
        <span style={{ fontSize: 11, color: '#718096' }}>
          {rules.length}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {rules.map(rule => (
              <RuleRow
                key={rule.id}
                rule={rule}
                isSelected={selectedRuleId === rule.id}
                onClick={() => onSelectRule(rule, false)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RuleDirectory({ selectedRuleId, onSelectRule, userRules, categoryColors }) {
  const [activeToggle, setActiveToggle] = useState('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  // Group library rules by category
  const rulesByCategory = useMemo(() => {
    const grouped = {};
    FORGE_RULE_TEMPLATES.forEach(rule => {
      const cat = rule.forgeTemplates?.[0]?.category || rule.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(rule);
    });
    return grouped;
  }, []);

  // Filter library rules by search
  const filteredByCategory = useMemo(() => {
    if (!searchQuery) return rulesByCategory;
    const filtered = {};
    Object.entries(rulesByCategory).forEach(([cat, rules]) => {
      const matching = rules.filter(r => matchesSearch(r, searchQuery));
      if (matching.length > 0) filtered[cat] = matching;
    });
    return filtered;
  }, [rulesByCategory, searchQuery]);

  // Total library count
  const libraryCount = FORGE_RULE_TEMPLATES.length;

  // Split user rules into public-sourced and private/custom
  const discoverRules = useMemo(() =>
    (userRules || []).filter(r => r.source === 'forge_discover'),
    [userRules],
  );
  const privateRules = useMemo(() =>
    (userRules || []).filter(r => r.source === 'manual' || r.source === 'forge_custom' || (r.visibility === 'private' && r.source !== 'forge_discover')),
    [userRules],
  );
  const userRulesCount = (userRules || []).length;

  // Filter user rules by search
  const filteredDiscoverRules = useMemo(() =>
    searchQuery ? discoverRules.filter(r => matchesSearch(r, searchQuery)) : discoverRules,
    [discoverRules, searchQuery],
  );
  const filteredPrivateRules = useMemo(() =>
    searchQuery ? privateRules.filter(r => matchesSearch(r, searchQuery)) : privateRules,
    [privateRules, searchQuery],
  );

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toggle */}
      <div style={{
        display: 'flex',
        margin: '0 16px 12px',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid #2A2D35',
      }}>
        {['library', 'myRules'].map(tab => {
          const isActive = activeToggle === tab;
          const label = tab === 'library' ? `Library (${libraryCount})` : `My Rules (${userRulesCount})`;
          return (
            <button
              key={tab}
              onClick={() => setActiveToggle(tab)}
              style={{
                flex: 1,
                padding: '8px 0',
                background: isActive ? '#5EEAD420' : 'transparent',
                border: 'none',
                color: isActive ? '#5EEAD4' : '#718096',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{
        position: 'relative',
        margin: '0 16px 12px',
      }}>
        <Search
          size={14}
          color="#718096"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search rules by name or tag..."
          style={{
            width: '100%',
            padding: '8px 32px 8px 30px',
            backgroundColor: '#15171E',
            border: '1px solid #2A2D35',
            borderRadius: 6,
            color: '#E2E8F0',
            fontSize: 12,
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
            }}
          >
            <X size={12} color="#718096" />
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeToggle === 'library' && (
          <>
            {CATEGORY_ORDER.map(catId => {
              const rules = filteredByCategory[catId];
              if (!rules || rules.length === 0) return null;
              return (
                <CategorySection
                  key={catId}
                  categoryId={catId}
                  rules={rules}
                  selectedRuleId={selectedRuleId}
                  onSelectRule={onSelectRule}
                  isExpanded={expandedCategories.has(catId)}
                  onToggle={() => toggleCategory(catId)}
                />
              );
            })}
          </>
        )}

        {activeToggle === 'myRules' && (
          <>
            {/* Discover-sourced rules */}
            {filteredDiscoverRules.length > 0 && (
              <div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: '#718096',
                  padding: '8px 16px',
                }}>
                  Public Rules (From Discover)
                </div>
                {filteredDiscoverRules.map(rule => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    isSelected={selectedRuleId === rule.id}
                    onClick={() => onSelectRule(rule, false)}
                  />
                ))}
              </div>
            )}

            {/* Private / custom rules */}
            {filteredPrivateRules.length > 0 && (
              <div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: '#718096',
                  padding: '8px 16px',
                }}>
                  Private Rules (Custom / Agent)
                </div>
                {filteredPrivateRules.map(rule => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    isSelected={selectedRuleId === rule.id}
                    onClick={() => onSelectRule(rule, true)}
                  />
                ))}
              </div>
            )}

            {filteredDiscoverRules.length === 0 && filteredPrivateRules.length === 0 && (
              <div style={{
                padding: '24px 16px',
                textAlign: 'center',
                fontSize: 13,
                color: '#718096',
                fontStyle: 'italic',
              }}>
                {searchQuery
                  ? 'No rules match your search.'
                  : 'No custom rules yet. Add rules from the Library or create your own.'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
