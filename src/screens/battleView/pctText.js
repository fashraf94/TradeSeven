// src/screens/battleView/pctText.js
//
// The day % as the 2b cockpit prints it — one rule, in its own import-free module so Battle Research's
// pure modules (src/components/Research/BattleResearch/, Node-clean for Slice 2's server) can take it
// without cockpit2bModel.js's graph (which reaches the Desk's copy). MOVED, never copied: the body is
// cockpit2bModel.js's own, and that module re-exports it unchanged (the agentName.js precedent).

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** "+1.2%" / "−0.8%" / "0.0%"; null without a number. */
export function pctText(v) {
  if (!finite(v)) return null;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}
