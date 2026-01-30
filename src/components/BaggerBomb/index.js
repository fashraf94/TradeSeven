// BaggerBomb Components
// UI components for the MarketClash BaggerBomb Scoring system

// Battle UI Components
export { default as ChamberFuse } from './ChamberFuse';
export { default as TacticalRow, AssetSide, AllocationBadge } from './TacticalRow';
export { default as BadgeRow, BADGE_CONFIG } from './BadgeRow';
export { default as ProximityLabel, THRESHOLDS } from './ProximityLabel';
export { default as SessionHUD, SESSIONS } from './SessionHUD';
export { default as BattleHeader } from './BattleHeader';
export { default as EventFeed, EVENT_CONFIG } from './EventFeed';
export { default as BenchSection } from './BenchSection';
export { default as SessionScoreCard } from './SessionScoreCard';
export { default as BreakoutFeed } from './BreakoutFeed';
export { default as BaggerBombScoreboard } from './BaggerBombScoreboard';
export { default as AssetPerformanceRow } from './AssetPerformanceRow';
export { default as SubstitutionPanel } from './SubstitutionPanel';
export { default as BaggerBombBattleView } from './BaggerBombBattleView';
export { default as BaggerBombBattleViewRedesign } from './BaggerBombBattleViewRedesign';

// Portfolio Builder Components
export { default as BenchSelector } from './BenchSelector';
export { default as ThresholdPreview } from './ThresholdPreview';
export { default as PortfolioBuilderBaggerBomb } from './PortfolioBuilderBaggerBomb';
export { default as StockDetailModal } from './StockDetailModal';

// New Slot-Based Builder (Phase 3)
export { default as PortfolioSlot, ThresholdPreview as SlotThresholdPreview } from './PortfolioSlot';
export { default as AssetPickerModal } from './AssetPickerModal';
export { default as SlotBasedBuilder, BUILDER_TIERS, createEmptyPortfolio } from './SlotBasedBuilder';

// Portfolio Builder Sub-Components (Accordion Style)
export { default as AccordionSection } from './AccordionSection';
export { default as RosterAssetCard } from './RosterAssetCard';
export { default as AllocationBar } from './AllocationBar';
export { BenchCard, AddBenchCard } from './BenchCard';
export { default as ScoringPreviewNew } from './ScoringPreviewNew';
export { default as BottomActionBar } from './BottomActionBar';
export { default as StockSearch } from './StockSearch';

// Legacy exports for backwards compatibility during migration
export { default as TDBattleScoreboard } from './BaggerBombScoreboard';
export { default as TDBattleView } from './BaggerBombBattleView';
export { default as PortfolioBuilderTD } from './PortfolioBuilderBaggerBomb';
