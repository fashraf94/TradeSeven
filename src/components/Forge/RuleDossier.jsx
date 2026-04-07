import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import FoundInChips from './FoundInChips';

const sectionLabelStyle = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 1,
  color: '#718096',
  marginBottom: 8,
  marginTop: 24,
};

const bodyTextStyle = {
  fontSize: 14,
  color: '#A0AEC0',
  lineHeight: 1.6,
};

const difficultyColors = {
  beginner: '#5EEAD4',
  intermediate: '#F59E0B',
  advanced: '#EF4444',
};

function ParamDisplay({ paramKey, param }) {
  if (param.type === 'number') {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500 }}>
            {param.label}:
          </span>
          <span style={{ fontSize: 13, color: '#5EEAD4' }}>
            {param.default}{param.unit ? ` ${param.unit}` : ''}
          </span>
          <span style={{ fontSize: 11, color: '#718096' }}>
            (range: {param.min}–{param.max})
          </span>
        </div>
        {param.hint && (
          <div style={{ fontSize: 11, color: '#718096', fontStyle: 'italic', marginTop: 2, paddingLeft: 12 }}>
            {param.hint}
          </div>
        )}
      </div>
    );
  }

  if (param.type === 'toggle') {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500 }}>
            {param.label}:
          </span>
          <span style={{ fontSize: 13, color: '#5EEAD4' }}>
            {param.default ? 'On' : 'Off'}
          </span>
        </div>
        {param.hint && (
          <div style={{ fontSize: 11, color: '#718096', fontStyle: 'italic', marginTop: 2, paddingLeft: 12 }}>
            {param.hint}
          </div>
        )}
      </div>
    );
  }

  if (param.type === 'select') {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500 }}>
            {param.label}:
          </span>
          <span style={{ fontSize: 13, color: '#5EEAD4' }}>
            {param.default}
          </span>
        </div>
        {param.options && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, paddingLeft: 12 }}>
            {param.options.map(opt => (
              <span
                key={opt.value}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 4,
                  backgroundColor: opt.value === param.default ? '#5EEAD420' : '#2A2D35',
                  color: opt.value === param.default ? '#5EEAD4' : '#718096',
                }}
              >
                {opt.label}
              </span>
            ))}
          </div>
        )}
        {param.hint && (
          <div style={{ fontSize: 11, color: '#718096', fontStyle: 'italic', marginTop: 2, paddingLeft: 12 }}>
            {param.hint}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default function RuleDossier({
  rule,
  isPrivate,
  onRefine,
  onDelete,
  onJumpToForge,
  categoryColors,
}) {
  if (!rule) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 300,
        padding: 24,
      }}>
        <div style={{ fontSize: 14, color: '#718096', fontStyle: 'italic', textAlign: 'center' }}>
          Select a rule from the directory to view its details
        </div>
      </div>
    );
  }

  const catInfo = categoryColors?.[rule.category];
  const params = rule.forgeTemplates?.[0]?.params;
  const diffColor = difficultyColors[rule.difficulty] || '#718096';

  return (
    <div style={{
      padding: 24,
      height: '100%',
      overflowY: 'auto',
      backgroundColor: isPrivate ? '#1C1A27' : '#15171E',
      borderLeft: isPrivate ? '3px solid #8B5CF6' : 'none',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 8,
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#E2E8F0',
            margin: 0,
            marginBottom: 8,
          }}>
            {rule.headline}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {catInfo && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                color: catInfo.color,
              }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: catInfo.color,
                }} />
                {catInfo.name}
              </span>
            )}
            {rule.difficulty && (
              <span style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                border: `1px solid ${diffColor}40`,
                color: diffColor,
                textTransform: 'capitalize',
              }}>
                {rule.difficulty}
              </span>
            )}
          </div>
        </div>

        {isPrivate && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {onRefine && (
              <button
                onClick={() => onRefine(rule.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: '1px solid #2A2D35',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: '#A0AEC0',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Pencil size={12} />
                Refine Logic
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(rule.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: '1px solid #EF444440',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: '#EF4444',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <Trash2 size={12} />
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Indicator */}
      {rule.relatedIndicator && (
        <div style={{ fontSize: 12, color: '#718096', marginBottom: 16 }}>
          Indicator: {rule.relatedIndicator}
        </div>
      )}

      {/* Description */}
      <div style={sectionLabelStyle}>DESCRIPTION</div>
      <div style={bodyTextStyle}>{rule.description}</div>

      {/* Learn More */}
      {rule.learnMore && (
        <>
          <div style={sectionLabelStyle}>HOW IT WORKS</div>
          <div style={bodyTextStyle}>{rule.learnMore}</div>
        </>
      )}

      {/* Agent Use */}
      {rule.agentUseDescription && (
        <>
          <div style={sectionLabelStyle}>HOW THE AGENT USES THIS</div>
          <div style={bodyTextStyle}>{rule.agentUseDescription}</div>
        </>
      )}

      {/* Parameters */}
      {params && Object.keys(params).length > 0 && (
        <>
          <div style={sectionLabelStyle}>PARAMETERS</div>
          <div>
            {Object.entries(params).map(([key, param]) => (
              <ParamDisplay key={key} paramKey={key} param={param} />
            ))}
          </div>
        </>
      )}

      {/* Found In */}
      <FoundInChips ruleId={rule.id} onJumpToForge={onJumpToForge} />

      {/* Tags */}
      {rule.tags && rule.tags.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={sectionLabelStyle}>TAGS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {rule.tags.map(tag => (
              <span
                key={tag}
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 4,
                  backgroundColor: '#2A2D35',
                  color: '#718096',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
