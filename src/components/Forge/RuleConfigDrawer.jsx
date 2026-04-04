// src/components/Forge/RuleConfigDrawer.jsx
// Expandable drawer with parameter controls, live text preview, and add button.

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Plus } from 'lucide-react';
import ParamSlider from './ParamControls/ParamSlider';
import ParamPicker from './ParamControls/ParamPicker';
import ParamToggle from './ParamControls/ParamToggle';
import RuleTextPreview from './RuleTextPreview';

const SPRING = { stiffness: 300, damping: 25 };

function getDefaults(params) {
  const defaults = {};
  if (params) {
    for (const [key, config] of Object.entries(params)) {
      defaults[key] = config.default;
    }
  }
  return defaults;
}

export default function RuleConfigDrawer({ rule, isOpen, onAdd, categoryColor }) {
  const params = rule?.forgeTemplates?.[0]?.params;
  const textTemplate = rule?.forgeTemplates?.[0]?.text;
  const defaults = useMemo(() => getDefaults(params), [params]);
  const [paramValues, setParamValues] = useState(defaults);

  const handleChange = useCallback((key, val) => {
    setParamValues(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleReset = useCallback(() => {
    setParamValues(defaults);
  }, [defaults]);

  const handleAdd = useCallback((e) => {
    e.stopPropagation();
    onAdd(paramValues);
  }, [onAdd, paramValues]);

  if (!params || Object.keys(params).length === 0) return null;

  const paramEntries = Object.entries(params);

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', ...SPRING }}
          style={{ overflow: 'hidden' }}
        >
          <div style={{
            padding: '12px 0 4px 0',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            marginTop: 10,
          }}>
            {/* Live text preview */}
            <RuleTextPreview
              textTemplate={textTemplate}
              paramValues={paramValues}
              paramDefs={params}
            />

            {/* Param controls */}
            {paramEntries.map(([key, config]) => {
              const val = paramValues[key] !== undefined ? paramValues[key] : config.default;
              if (config.type === 'number') {
                return (
                  <ParamSlider
                    key={key}
                    param={config}
                    value={val}
                    onChange={(v) => handleChange(key, v)}
                    categoryColor={categoryColor}
                  />
                );
              }
              if (config.type === 'select') {
                return (
                  <ParamPicker
                    key={key}
                    param={config}
                    value={val}
                    onChange={(v) => handleChange(key, v)}
                    categoryColor={categoryColor}
                  />
                );
              }
              if (config.type === 'toggle') {
                return (
                  <ParamToggle
                    key={key}
                    param={config}
                    value={val}
                    onChange={(v) => handleChange(key, v)}
                    categoryColor={categoryColor}
                  />
                );
              }
              return null;
            })}

            {/* Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 8,
            }}>
              {/* Reset link */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
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
                <RotateCcw size={11} />
                Reset to defaults
              </button>

              {/* Add with settings button */}
              <button
                onClick={handleAdd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: categoryColor,
                  background: `${categoryColor}1A`,
                  border: `1px solid ${categoryColor}`,
                  borderRadius: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
              >
                <Plus size={12} />
                Add with these settings
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
