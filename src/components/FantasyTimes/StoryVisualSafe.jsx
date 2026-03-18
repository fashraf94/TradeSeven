// src/components/FantasyTimes/StoryVisualSafe.jsx
// Defensive wrapper for story visuals. ErrorBoundary catches chart crashes
// and returns null so the story card falls back to text-only seamlessly.

import React from 'react';

// Lazy-load visual components to keep initial bundle lean
const StoryChart = React.lazy(() => import('./visuals/StoryChart'));
const MarketBar = React.lazy(() => import('./visuals/MarketBar'));
const ComparisonBar = React.lazy(() => import('./visuals/ComparisonBar'));
const StatCard = React.lazy(() => import('./visuals/StatCard'));
const EpsGauge = React.lazy(() => import('./visuals/EpsGauge'));
const SectorHeatmap = React.lazy(() => import('./visuals/SectorHeatmap'));

export const VISUAL_HEIGHTS = { micro: 80, compact: 120, expanded: 280 };

// ── ErrorBoundary ──────────────────────────────────────────────────
class VisualErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('[StoryVisual] Chart render error:', error.message);
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

// ── Visual Switch ──────────────────────────────────────────────────
function StoryVisual({ visualType, visualConfig, size }) {
  const config = visualConfig || {};

  switch (visualType) {
    case 'price_chart':
      return <StoryChart config={config} size={size} />;
    case 'market_bar':
      return <MarketBar config={config} size={size} />;
    case 'comparison_bar':
      return <ComparisonBar config={config} size={size} />;
    case 'stat_card':
      return <StatCard config={config} size={size} />;
    case 'eps_gauge':
      return <EpsGauge config={config} size={size} />;
    case 'sector_heatmap':
      return <SectorHeatmap config={config} size={size} />;
    default:
      return null;
  }
}

// ── Safe Wrapper (default export) ──────────────────────────────────
export default function StoryVisualSafe({ visualType, visualConfig, size }) {
  if (!visualType || visualType === 'none') return null;

  return (
    <VisualErrorBoundary>
      <React.Suspense fallback={null}>
        <StoryVisual
          visualType={visualType}
          visualConfig={visualConfig}
          size={size || 'compact'}
        />
      </React.Suspense>
    </VisualErrorBoundary>
  );
}
