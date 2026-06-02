// src/components/Dashboard/RuleBundlePicker.jsx
//
// The Rules bottom sheet for the Equip station. Lists the agent's forged rule
// bundles (equippable) and any currently equipped ones, and equips/unequips via
// the existing forgeService path (passed in from useForge's equipBundleFn /
// unequipBundleFn). "Build a new strategy" routes to Forge. Equipping is always
// optional — framed as sharpening the agent, never a requirement.

import React from 'react';
import { Plus } from 'lucide-react';
import EquipSheet from './EquipSheet';

function hexToRgba(hex, a) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(94,234,212,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function RuleBundlePicker({
  open, onClose, forgedBundles = [], equippedBundles = [],
  onEquip, onUnequip, onBuildNew, working, loading, accent, tokens,
}) {
  const equippedIds = new Set(equippedBundles.map((b) => b.id));

  const rows = [
    ...equippedBundles.map((b) => ({
      id: b.id,
      title: b.name || 'Untitled bundle',
      subtitle: `${(b.ruleIds || []).length} rules · tap to unequip`,
      selected: true,
      badge: 'Equipped',
      disabled: working,
      onClick: () => onUnequip(b.id),
    })),
    ...forgedBundles
      .filter((b) => !equippedIds.has(b.id))
      .map((b) => ({
        id: b.id,
        title: b.name || 'Untitled bundle',
        subtitle: `${(b.ruleIds || []).length} rules`,
        selected: false,
        disabled: working,
        onClick: () => onEquip(b.id),
      })),
  ];

  const footer = (
    <button
      type="button"
      onClick={onBuildNew}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '12px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
        background: 'transparent', border: `1px solid ${hexToRgba(accent, 0.4)}`,
        color: accent, fontSize: 14, fontWeight: 700,
      }}
    >
      <Plus size={16} />
      Build a new strategy in Forge
    </button>
  );

  return (
    <EquipSheet
      open={open}
      onClose={onClose}
      title="Equip rules"
      subtitle="Equip a forged strategy to sharpen your agent. Optional — Deploy works without it."
      loading={loading}
      rows={rows}
      emptyLabel="No forged strategies yet. Build one in Forge, then equip it here."
      footer={footer}
      accent={accent}
      tokens={tokens}
    />
  );
}
