// src/components/Forge/BundlePresetModal.jsx
// Modal shown when users create their first bundle — offers preset collections or scratch.

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Zap, Plus } from 'lucide-react';
import { FORGE_COLLECTIONS } from '../../data/forgeCollections';
import { FORGE_RULE_TEMPLATES } from '../../data/forgeKnowledgeBase';

// Pick 3 diverse presets from the 9 available collections
const PRESET_COLLECTIONS = FORGE_COLLECTIONS.filter(c =>
  ['defensive-playbook', 'momentum-hunter', 'battle-tactics'].includes(c.id)
);

export default function BundlePresetModal({ forge, onClose }) {
  const [creating, setCreating] = useState(false);

  const handleSelectPreset = async (collection) => {
    if (creating) return;
    setCreating(true);
    try {
      const bundleId = await forge.createNewBundle(collection.title);
      if (bundleId) {
        // Add each rule from the collection to the bundle
        for (const ruleId of collection.ruleIds) {
          const template = FORGE_RULE_TEMPLATES.find(t => t.id === ruleId);
          if (template) {
            await forge.addRuleToBundle(template);
          }
        }
      }
      onClose();
    } catch (err) {
      console.error('[BundlePresetModal] Failed to create preset bundle:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleStartScratch = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await forge.createNewBundle('My Strategy');
      onClose();
    } catch (err) {
      console.error('[BundlePresetModal] Failed to create bundle:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1C1A27',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          width: '100%',
          maxWidth: 400,
          maxHeight: '80vh',
          overflow: 'auto',
          padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Start Your Build
          </h2>
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
        <p style={{ fontSize: 13, color: '#8b949e', margin: '4px 0 20px', lineHeight: 1.4 }}>
          Pick a preset to jumpstart your strategy, or start from scratch
        </p>

        {/* Preset cards */}
        {PRESET_COLLECTIONS.map(collection => (
          <button
            key={collection.id}
            onClick={() => handleSelectPreset(collection)}
            disabled={creating}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: '#15171E',
              border: `1px solid rgba(255,255,255,0.06)`,
              borderLeft: `4px solid ${collection.accentColor}`,
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 10,
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: creating ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Zap size={14} color={collection.accentColor} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
                {collection.title}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.4, marginBottom: 6 }}>
              {collection.subtitle}
            </div>
            <div style={{ fontSize: 11, color: '#4a5568' }}>
              {collection.ruleIds.length} rules
            </div>
          </button>
        ))}

        {/* Start from scratch */}
        <button
          onClick={handleStartScratch}
          disabled={creating}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            padding: '12px',
            background: 'none',
            border: '1px dashed rgba(255,255,255,0.12)',
            borderRadius: 12,
            color: '#8b949e',
            fontSize: 13,
            fontWeight: 600,
            cursor: creating ? 'not-allowed' : 'pointer',
            marginTop: 4,
          }}
        >
          <Plus size={14} /> Start from Scratch
        </button>
      </motion.div>
    </motion.div>
  );
}
