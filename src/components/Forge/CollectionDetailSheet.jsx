// src/components/Forge/CollectionDetailSheet.jsx
// Bottom sheet (mobile) / side panel (desktop) showing a collection's rules.

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Check } from 'lucide-react';

const DIFFICULTY_COLORS = {
  beginner: '#5eead4',
  intermediate: '#a78bfa',
  advanced: '#f97066',
};

export default function CollectionDetailSheet({
  collection,
  collectedSourceRefs,
  onAddAll,
  onAddRule,
  onClose,
  agentExists,
  isAdding,
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

  const { title, subtitle, accentColor, rules, categoryColors, ruleIds } = collection;
  const collectedCount = ruleIds.filter(id => collectedSourceRefs.has(id)).length;
  const allCollected = collectedCount === ruleIds.length;
  const remainingCount = ruleIds.length - collectedCount;

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
          {categoryColors.length > 0 && (
            <div style={{ display: 'flex', gap: 5, marginTop: 8, paddingLeft: 13 }}>
              {categoryColors.map((color, i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: color,
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Rule list */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0 20px',
        }}>
          {rules.map((rule, idx) => {
            const isCollected = collectedSourceRefs.has(rule.id);
            return (
              <div
                key={rule.id}
                style={{
                  padding: '12px 0',
                  borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', lineHeight: 1.3 }}>
                    {rule.headline}
                  </div>
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
                </div>
                {/* Individual add/added */}
                {!agentExists ? null : isCollected ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 600, color: '#5EEAD4',
                    flexShrink: 0, marginTop: 2,
                  }}>
                    <Check size={12} /> Added
                  </div>
                ) : (
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
                )}
              </div>
            );
          })}
        </div>

        {/* Bulk CTA */}
        {agentExists && (
          <div style={{ padding: '12px 20px 20px', flexShrink: 0 }}>
            {allCollected ? (
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
            )}
          </div>
        )}
      </motion.div>
    </>
  );
}
