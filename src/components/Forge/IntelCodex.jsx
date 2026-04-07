import React, { useState, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { FORGE_CATEGORIES } from '../../data/forgeKnowledgeBase';
import RuleDirectory from './RuleDirectory';
import RuleDossier from './RuleDossier';

// Build default category color map from FORGE_CATEGORIES
const DEFAULT_CATEGORY_COLORS = {};
FORGE_CATEGORIES.forEach(c => {
  DEFAULT_CATEGORY_COLORS[c.id] = { name: c.label, color: c.color };
});

export default function IntelCodex({ userRules, categoryColors, onJumpToForge }) {
  const [selectedRule, setSelectedRule] = useState(null);
  const [selectedIsPrivate, setSelectedIsPrivate] = useState(false);
  const { isMobile } = useIsMobile();

  const catColors = categoryColors || DEFAULT_CATEGORY_COLORS;

  const handleSelectRule = (rule, isPrivate) => {
    setSelectedRule(rule);
    setSelectedIsPrivate(isPrivate);
  };

  const handleRefine = (ruleId) => {
    // Wired in C2 integration
    console.warn('[IntelCodex] Refine not yet wired:', ruleId);
  };

  const handleDelete = (ruleId) => {
    // Wired in C2 integration
    console.warn('[IntelCodex] Delete not yet wired:', ruleId);
  };

  // Desktop: split-pane layout
  if (!isMobile) {
    return (
      <div style={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
      }}>
        {/* Left Column — Directory */}
        <div style={{
          width: '35%',
          minWidth: 280,
          maxWidth: 360,
          borderRight: '1px solid #2A2D35',
          overflowY: 'auto',
          paddingTop: 16,
        }}>
          <RuleDirectory
            selectedRuleId={selectedRule?.id}
            onSelectRule={handleSelectRule}
            userRules={userRules}
            categoryColors={catColors}
          />
        </div>

        {/* Right Column — Dossier */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          minWidth: 0,
        }}>
          <RuleDossier
            rule={selectedRule}
            isPrivate={selectedIsPrivate}
            onRefine={handleRefine}
            onDelete={handleDelete}
            onJumpToForge={onJumpToForge}
            categoryColors={catColors}
          />
        </div>
      </div>
    );
  }

  // Mobile: full-width directory + full-screen overlay for dossier
  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div style={{ height: '100%', overflowY: 'auto', paddingTop: 16 }}>
        <RuleDirectory
          selectedRuleId={selectedRule?.id}
          onSelectRule={handleSelectRule}
          userRules={userRules}
          categoryColors={catColors}
        />
      </div>

      {selectedRule && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#0D0E12',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #2A2D35',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setSelectedRule(null)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                color: '#5EEAD4',
                fontSize: 14,
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'inherit',
              }}
            >
              <ArrowLeft size={16} />
              Back to Directory
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <RuleDossier
              rule={selectedRule}
              isPrivate={selectedIsPrivate}
              onRefine={handleRefine}
              onDelete={handleDelete}
              onJumpToForge={onJumpToForge}
              categoryColors={catColors}
            />
          </div>
        </div>
      )}
    </div>
  );
}
