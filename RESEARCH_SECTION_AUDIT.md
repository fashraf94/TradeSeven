# RESEARCH SECTION AUDIT — Complete Dependency Map

## Context
We are planning to replace the Research section with an Academy (educational video) feed. This audit maps every file, route, state variable, API endpoint, and Firestore collection touched by the Research section, and classifies each as safe-to-remove vs must-preserve.

---

## 1. NAVIGATION & ROUTING

### Entry Points
- **BottomNav** (`src/components/Navigation/BottomNav.jsx`): `{ id: 'research', label: 'Research', icon: BarChart3 }` — toggles `showResearchMode` via `setShowResearchMode` prop
- **DesktopSidebar** (`src/components/Navigation/DesktopSidebar.jsx`): `{ id: 'research', label: 'Research' }` — same toggle logic, checks `showResearchMode` for active state

### Screen Values / Routing
- There is **no `screen === 'research'` value**. Research uses an overlay pattern: `showResearchMode === true` renders the Research section on top of the current screen in App.jsx.
- The Research section in App.jsx is rendered at approximately **line 9710-9860** (mobile) and **line 17527-17617** (desktop), both gated by `if (showResearchMode)`.

### Landing Page
- **File**: `src/components/Research/ResearchLandingPage.jsx` (~3200 lines)
- **Rendered when**: `flowPhase === 1` (the default) and `showResearchMode === true`
- **Imports**: `useAssetResearch`, `useResearchIntelligence`, `useCooldown`, `IntelligenceProvider/useIntelligence`, `AssetResearchModal`, `WhyMovingPopup`, `SECTORS`, `COMPANY_SECTORS`, `MarketPulseCard`, `UpcomingEventsPanel`, `ReadAcrossAlert`, `getTopMoversWithNews`, `getMarketNews`, `fetchWithAuth`
- **Renders**: Market pulse cards, trending tickers, top movers, upcoming events, read-across alerts, AI intel briefer/scout, stock search, navigation to sub-screens

---

## 2. SUB-SCREENS (reachable from Research)

### A. Money Map / Sector Map
- **File**: `src/components/Research/MoneyMap/MoneyMapScreen.jsx` (~615 lines)
- **Purpose**: Sector rotation heatmap with quadrant analysis, breadth bars, leadership display
- **Access**: `onOpenMoneyMap={() => setShowMoneyMap(true)}` from ResearchLandingPage
- **State**: `showMoneyMap` in App.jsx (line 9069)
- **API**: `/api/sector-insight`
- **Services**: `fetchAllSectorsData` from `sectorDataService`, `computeMoneyMapData` / `BELLWETHER_MAP` from `moneyMapEngine`
- **Sub-components**: `BreadthBar`, `SectorCard`, `RegimeBanner`, `SectorList`, `MetricTooltip`, `LeadershipDisplay`, `QuadrantBadge`, `HeatmapView`, `ConfidenceGauge` (all in `MoneyMap/`)

### B. Technical Analysis Screen (full-screen)
- **File**: `src/components/TechnicalAnalysis/TechnicalAnalysisScreen.jsx` (~850 lines)
- **Purpose**: Full candlestick chart with levels, patterns, explore tabs
- **Access**: `setShowTechnicalScreen('analysis')` + sets `technicalSymbol`
- **State**: `showTechnicalScreen` in App.jsx (line 9075)
- **Sub-components**: `CandlestickChart`, `LevelsTab`, `PatternsTab`, `ExploreTab`, `TimeframeSelector`, `TrackPatternModal`, shared states
- **Services**: `technicalAnalysisAI`, `levelDetection`

### C. Pattern Tracker Dashboard
- **File**: `src/components/TechnicalAnalysis/PatternTrackerDashboard.jsx` (~166 lines)
- **Purpose**: View/manage tracked chart patterns
- **Access**: `onMyPatterns={() => setShowTechnicalScreen('patterns')}` from ResearchLandingPage
- **Firestore**: reads/writes `trackedPatterns` collection

### D. Pattern Insights
- **File**: `src/components/TechnicalAnalysis/PatternInsights.jsx`
- **Purpose**: AI insights about tracked patterns
- **Access**: `onInsights={() => setShowTechnicalScreen('insights')}`

### E. Stock Intelligence Agent
- **File**: `src/components/StockIntelligence/StockIntelligenceScreen.jsx` (~463 lines)
- **Purpose**: Deep-dive AI stock analysis agent
- **Access**: `onStockIntelligence={() => setShowStockIntelligence(true)}` from ResearchLandingPage
- **State**: `showStockIntelligence` in App.jsx (line 9072)
- **API**: `/api/stock-intelligence`

### F. Build My Thesis (Game Plan Flow)
- **Files**: `src/components/GamePlan/` directory — `RiskStyleScreen.jsx`, `SectorSelectionScreen.jsx`, `SectorDetailModal.jsx`, `MustHavePicksScreen.jsx`, `GamePlanResultScreen.jsx`, `BaggerBombGamePlanFlow.jsx`, etc.
- **Purpose**: Multi-step flow to build a BaggerBomb game plan
- **Access**: `onBuildThesis={() => setFlowPhase(2)}` — navigates through flowPhases 2→3→4→5
- **State**: `flowPhase` in App.jsx (line 9040)
- **Services**: `sectorDataService` (fetchSectorData, getSectorStocks)
- **Note**: `GamePlan` components are ALSO imported by App.jsx directly (`RiskStyleScreen`, `SectorSelectionScreen`) and by `PortfolioBuilderBaggerBomb` (`NotesTab`), so they're **partially shared**

### G. Stock Search Modal
- **File**: `src/components/TechnicalAnalysis/StockSearchModal.jsx`
- **Access**: `onAnalyzeStock={() => setShowStockSearchModal(true)}`
- **State**: `showStockSearchModal` in App.jsx (line 9078)

---

## 3. ASSET RESEARCH MODAL

### Modal Files
- **Primary**: `src/components/draft/AssetResearchModal.jsx` (~1287 lines) — the main reusable modal
- **Wrapper**: `src/components/freeAgency/shared/FreeAgencyResearchModal.jsx` — thin wrapper around AssetResearchModal for Free Agency screens
- **Drawer**: `src/components/Research/AnalysisDrawer.jsx` (~214 lines) — bottom pull-up drawer used INSIDE AssetResearchModal
- **Dashboard**: `src/components/draft/AnalysisVisualDashboard.jsx` — visual analysis tab rendered inside modal

### ALL Consumers (files that render AssetResearchModal or FreeAgencyResearchModal)

#### Research Section Consumers:
- `src/components/Research/ResearchLandingPage.jsx`
- `src/components/Research/MoneyMap/MoneyMapScreen.jsx`

#### Game Screen Consumers:
- `src/screens/BaggerBombBattleView.jsx`
- `src/screens/DraftRoomScreen.jsx`
- `src/components/BaggerBomb/FreeAgentBar.jsx`
- `src/components/BaggerBomb/AssetPickerModal.jsx`

#### Dashboard Consumers:
- `src/components/Dashboard/Watchlist/WatchlistContainer.jsx`

#### Other Consumers:
- `src/components/draft/TopPerformersModal.jsx`
- `src/components/draft/CommandConsole.jsx`
- `src/components/FantasyTimes/FantasyTimesFeed.jsx` (lazy loaded)
- `src/components/FantasyTimes/StoryDetail.jsx` (lazy loaded)
- `src/components/freeAgency/FreeAgencyMobile.jsx` (via FreeAgencyResearchModal)
- `src/components/freeAgency/FreeAgencyDesktop.jsx` (via FreeAgencyResearchModal)
- `src/components/claims/ClaimsFreeAgencyScreen.jsx` (via FreeAgencyResearchModal)

### Tabs Inside Modal
- Analysis (AnalysisVisualDashboard)
- Technical (TechnicalAnalysisTab from ResearchTabs)
- BaggerBomb (BaggerBombTab from ResearchTabs)
- Health (HealthTab)
- Market Context (MarketContextTab)
- Earnings (via AnalysisVisualDashboard → LatestEarningsReport)
- News (via AnalysisVisualDashboard → FundamentalNews)

### Data Services Used by Modal
- `useResearchData` (OHLCV data, levels)
- `getCompanyProfile` from `fundamentalsService`
- `ChartHeader`, `StockChart`, `WhyMovingPopup` from Research components
- `AnalysisDrawer` + `useDrawerSnap`
- `TechnicalTabV2`, `HealthTab`, `MarketContextTab`, `CollapsibleSection`

---

## 4. API ENDPOINTS

### Research-ONLY Endpoints (only called from Research section)
| Endpoint | File | Called By |
|---|---|---|
| `/api/research-intel` | `api/research-intel.js` | `useResearchIntelligence.js` (ResearchLandingPage only) |
| `/api/research-thread` | `api/research-thread.js` | `useResearchIntelligence.js` (ResearchLandingPage only) |
| `/api/research-tracker` | `api/research-tracker.js` | `useResearchIntelligence.js` (ResearchLandingPage only) |
| `/api/research-weekly-report` | `api/research-weekly-report.js` | `useResearchIntelligence.js` (ResearchLandingPage only) |
| `/api/research-followup` | `api/research-followup.js` | `ResearchLandingPage.jsx` |
| `/api/sector-insight` | `api/sector-insight.js` | `MoneyMapScreen.jsx` |
| `/api/stock-intelligence` | `api/stock-intelligence.js` | `StockIntelligenceScreen.jsx` |
| `/api/market-pulse` | `api/market-pulse.js` | `useResearchIntelligence.js` (ResearchLandingPage only) |
| `/api/read-across-alerts` | `api/read-across-alerts.js` | `useResearchIntelligence.js` (ResearchLandingPage only) |
| `/api/read-across-check` | `api/read-across-check.js` | Needs verification — likely Research only |
| `/api/scanner-summary` | `api/scanner-summary.js` | Needs verification |
| `/api/why-moving` | `api/why-moving.js` | `WhyMovingPopup.jsx` (used in AssetResearchModal too — **SHARED**) |

### Shared Endpoints (used by Research + other features)
| Endpoint | File | Other Consumers |
|---|---|---|
| `/api/ai-advisor` | `api/ai-advisor.js` | App.jsx, DraftAdvisor, ResearchAdvisor, technicalAnalysisAI, aiStrategyService, FundamentalNews, HealthTab, LatestEarningsReport, AIMarketSummary — **HEAVILY SHARED** |
| `/api/why-moving` | `api/why-moving.js` | Used inside AssetResearchModal which is rendered across games, dashboard, FantasyTimes |

---

## 5. DATA SERVICES

### Research-ONLY Services
| Service | File | Consumers |
|---|---|---|
| `useResearchIntelligence` | `src/hooks/useResearchIntelligence.js` | `ResearchLandingPage.jsx` ONLY |
| `useResearch` | `src/hooks/useResearch.js` | Exported from hooks/index.js but **NO actual importers found** — dead code |
| `IntelligenceContext` | `src/contexts/IntelligenceContext.js` | `ResearchLandingPage.jsx` ONLY |
| `moneyMapEngine` | `src/services/moneyMapEngine.js` | `MoneyMapScreen.jsx`, `SectorList.jsx` — Research-only consumers |
| `useMarketContext` | `src/components/Research/useMarketContext.js` | `MarketContextTab.jsx` only (but MarketContextTab is in AssetResearchModal — **SHARED via modal**) |

### Shared Services (used by Research + other features)
| Service | File | Other Consumers |
|---|---|---|
| `sectorDataService` | `src/services/sectorDataService.js` | `baggerBombRecommendationEngine`, `breadthIndicatorService`, `GamePlan/SectorSelectionScreen`, `GamePlan/SectorDetailModal`, `TechnicalTabV2` |
| `levelDetection` | `src/services/levelDetection.js` | `TechnicalAnalysis/LevelsTab`, `TechnicalAnalysis/hooks/useChartOverlays`, `FantasyTimes/visuals/StoryChart`, `useResearchData` |
| `volatilityService` | `src/services/volatilityService.js` | BaggerBomb battle views (V3, V4, Redesign), `draftService`, `sessionScoringService`, `stockScoringService`, `firebaseService`, `breakoutDetectionService` — **GAME-CRITICAL** |
| `fundamentalsService` | `src/services/fundamentalsService.js` | `AssetResearchModal` (shared across all consumers) |
| `researchAdvisor` | `src/services/researchAdvisor.js` | `App.jsx` (imported for `generateGamePlan`, `enhanceRecommendations`, `getAssetDeepDive`) |
| `technicalAnalysisAI` | `src/services/technicalAnalysisAI.js` | `App.jsx`, `TechnicalAnalysis/ExploreTab`, `TechnicalAnalysis/TechnicalAnalysisScreen` |
| `researchAssetBuilder` | `src/utils/researchAssetBuilder.js` | BaggerBomb screens, TopPerformersModal, CommandConsole, FreeAgencyResearchModal, FreeAgentBar — **GAME-CRITICAL** |
| `useAssetResearch` | `src/hooks/useAssetResearch.js` | `ResearchLandingPage`, `MoneyMapScreen` — but the hook manages AssetResearchModal state which is shared |

---

## 6. APP.JSX STATE

### Research-Only State (lines ~9040-9081 and 11836-11862)
| State Variable | Line | Purpose | Safe to Remove? |
|---|---|---|---|
| `showResearchMode` / `setShowResearchMode` | 11836 | Toggle Research overlay | YES (replace with Academy) |
| `researchAssetType` | 11837 | Filter stocks/crypto in research | YES |
| `researchSearchTerm` | 11838 | Search term in research | YES |
| `researchSortBy` | 11839 | Sort order in research | YES |
| `showResearchComplete` | 11862 | Research complete state | YES |
| `flowPhase` / `setFlowPhase` | 9040 | Build My Thesis multi-step flow | YES (if removing thesis) |
| `showMoneyMap` | 9069 | Money Map screen toggle | YES |
| `showStockIntelligence` | 9072 | Stock Intelligence screen toggle | YES |
| `showTechnicalScreen` | 9075 | Technical analysis/patterns/insights | YES |
| `showStockSearchModal` | 9078 | Stock search modal toggle | YES |
| `patternStats` | 9081 | Pattern tracker stats | YES |
| `trackedPatterns` | 9080 | Tracked patterns array | YES |

### Shared State (passed to non-Research components too)
| State Variable | Shared With |
|---|---|
| `showResearchMode` | Passed to BottomNav, DesktopSidebar (for nav highlighting) — easy to replace |

---

## 7. COMPONENT DEPENDENCY MAP

### `src/components/Research/` Files

| File | Imported By | Classification |
|---|---|---|
| `ResearchLandingPage.jsx` | App.jsx | RESEARCH-ONLY |
| `MarketPulseCard.jsx` | ResearchLandingPage | RESEARCH-ONLY |
| `UpcomingEventsPanel.jsx` | ResearchLandingPage | RESEARCH-ONLY |
| `ReadAcrossAlert.jsx` | ResearchLandingPage | RESEARCH-ONLY |
| `WhyMovingPopup.jsx` | ResearchLandingPage, AssetResearchModal | SHARED (modal) |
| `StockChart.jsx` | AssetResearchModal | SHARED (modal used everywhere) |
| `ChartHeader.jsx` | AssetResearchModal | SHARED (modal used everywhere) |
| `useResearchData.js` | AssetResearchModal | SHARED (modal used everywhere) |
| `AnalysisDrawer.jsx` | AssetResearchModal | SHARED (modal used everywhere) |
| `useDrawerSnap.js` | AnalysisDrawer | SHARED (via AnalysisDrawer) |
| `TechnicalTabV2.jsx` | AssetResearchModal | SHARED (modal used everywhere) |
| `CollapsibleSection.jsx` | TechnicalTabV2, HealthTab | SHARED (via modal) |
| `HealthTab.jsx` | AssetResearchModal | SHARED (modal used everywhere) |
| `MarketContextTab.jsx` | AssetResearchModal | SHARED (modal used everywhere) |
| `useMarketContext.js` | MarketContextTab | SHARED (via modal) |
| `useTechnicalScore.js` | CompeteTab (draft) | SHARED (game screen) |
| `FundamentalNews.jsx` | AnalysisVisualDashboard (modal) | SHARED (modal used everywhere) |
| `LatestEarningsReport.jsx` | AnalysisVisualDashboard (modal) | SHARED (modal used everywhere) |
| `chartUtils.js` | StockChart, useResearchData, CandlestickChart (TechAnalysis), StoryChart (FantasyTimes) | SHARED / GAME-CRITICAL |
| `trendlineDetection.js` | StockChart only | SHARED (via StockChart in modal) |
| `ResearchSkeletons.jsx` | index.js export only | LOW-RISK (only used internally) |
| `MoneyMap/` (all files) | MoneyMapScreen → App.jsx (Research overlay only) | RESEARCH-ONLY |
| `index.js` | Re-export barrel file | Needs updating if files removed |

### `src/components/TechnicalAnalysis/` Files
| File | Classification |
|---|---|
| `TechnicalAnalysisScreen.jsx` | RESEARCH-ONLY (only accessed via showTechnicalScreen) |
| `PatternTrackerDashboard.jsx` | RESEARCH-ONLY |
| `PatternInsights.jsx` | RESEARCH-ONLY |
| `CandlestickChart.jsx` | RESEARCH-ONLY (only used by TechnicalAnalysisScreen) |
| `LevelsTab.jsx` | RESEARCH-ONLY |
| `PatternsTab.jsx` | RESEARCH-ONLY |
| `ExploreTab.jsx` | RESEARCH-ONLY |
| `TimeframeSelector.jsx` | RESEARCH-ONLY |
| `TrackPatternModal.jsx` | RESEARCH-ONLY |
| `PatternHistory.jsx` | RESEARCH-ONLY |
| `StockSearchModal.jsx` | RESEARCH-ONLY |
| `TechnicalResearchCard.jsx` | Exported from index.js but no importers found — likely dead code |
| `hooks/useChartOverlays.js` | RESEARCH-ONLY |
| `hooks/usePatternTracking.js` | RESEARCH-ONLY |
| `shared/EmptyState.jsx` | RESEARCH-ONLY |
| `shared/ErrorState.jsx` | RESEARCH-ONLY |
| `shared/LoadingState.jsx` | RESEARCH-ONLY |
| `utils/colors.js` | RESEARCH-ONLY |

### `src/components/StockIntelligence/`
| File | Classification |
|---|---|
| `StockIntelligenceScreen.jsx` | RESEARCH-ONLY |

---

## 8. FIRESTORE COLLECTIONS

### Research-Only Collections
| Collection | Used By | Safe to Remove? |
|---|---|---|
| `trackedPatterns` | `firebaseService.js` (lines 4169, 4246, 4280, 4297), `App.jsx`, `PatternsTab`, `usePatternTracking` | YES — only used by Technical Analysis pattern tracking |

### Shared Collections
- No other Firestore collections were found to be exclusively Research-related. The `stockAnalysis` references in `DraftAdvisor.jsx` are local state variables, not Firestore collections.

---

## 9. SAFE TO REMOVE (Research-only, no external dependencies)

### Components
- `src/components/Research/ResearchLandingPage.jsx`
- `src/components/Research/MarketPulseCard.jsx`
- `src/components/Research/UpcomingEventsPanel.jsx`
- `src/components/Research/ReadAcrossAlert.jsx`
- `src/components/Research/MoneyMap/` (entire directory — 9 files)
- `src/components/TechnicalAnalysis/` (entire directory — 20 files)
- `src/components/StockIntelligence/` (entire directory — 2 files)

### Hooks & Contexts
- `src/hooks/useResearchIntelligence.js`
- `src/hooks/useResearch.js` (appears to be dead code — no importers)
- `src/contexts/IntelligenceContext.js` (only used by ResearchLandingPage)

### Services
- `src/services/moneyMapEngine.js` (only used by MoneyMap components)

### API Endpoints
- `api/research-intel.js`
- `api/research-thread.js`
- `api/research-tracker.js`
- `api/research-weekly-report.js`
- `api/research-followup.js`
- `api/sector-insight.js`
- `api/stock-intelligence.js`
- `api/market-pulse.js`
- `api/read-across-alerts.js`
- `api/read-across-check.js`
- `api/scanner-summary.js`

### API Utilities (verify before removing)
- `api/_utils/stockIntelligenceData.js`
- `api/_utils/technicalAnalysisPrompts.js`
- `api/_utils/technicalCalculations.js`
- `api/_utils/intelligencePrompt.js`

### Data Files
- `src/data/stockIntelligenceData.js`

### App.jsx State to Remove
- `showResearchMode`, `researchAssetType`, `researchSearchTerm`, `researchSortBy`, `showResearchComplete`
- `flowPhase`, `showMoneyMap`, `showStockIntelligence`, `showTechnicalScreen`, `showStockSearchModal`
- `patternStats`, `trackedPatterns`

---

## 10. MUST PRESERVE (imported by games, dashboard, FantasyTimes, or agent)

### Core Modal & Components (used across the entire app)
- `src/components/draft/AssetResearchModal.jsx` — used by 12+ screens
- `src/components/draft/AnalysisVisualDashboard.jsx` — used inside modal
- `src/components/draft/ResearchTabs/TechnicalAnalysisTab.jsx` — tab in modal
- `src/components/draft/ResearchTabs/BaggerBombTab.jsx` — tab in modal
- `src/components/freeAgency/shared/FreeAgencyResearchModal.jsx` — wrapper for Free Agency

### Research/ Components Used by Modal (which is used everywhere)
- `src/components/Research/ChartHeader.jsx`
- `src/components/Research/StockChart.jsx`
- `src/components/Research/WhyMovingPopup.jsx`
- `src/components/Research/useResearchData.js`
- `src/components/Research/AnalysisDrawer.jsx`
- `src/components/Research/useDrawerSnap.js`
- `src/components/Research/TechnicalTabV2.jsx`
- `src/components/Research/CollapsibleSection.jsx`
- `src/components/Research/HealthTab.jsx`
- `src/components/Research/MarketContextTab.jsx`
- `src/components/Research/useMarketContext.js`
- `src/components/Research/FundamentalNews.jsx`
- `src/components/Research/LatestEarningsReport.jsx`
- `src/components/Research/chartUtils.js`
- `src/components/Research/trendlineDetection.js`
- `src/components/Research/useTechnicalScore.js`
- `src/components/Research/ResearchSkeletons.jsx`
- `src/components/Research/index.js` (barrel file — update exports)

### Services
- `src/services/sectorDataService.js` — used by GamePlan, BaggerBomb recommendation engine, breadthIndicatorService
- `src/services/levelDetection.js` — used by TechnicalAnalysis components, FantasyTimes StoryChart, useResearchData
- `src/services/volatilityService.js` — GAME-CRITICAL (BaggerBomb, scoring, draft)
- `src/services/fundamentalsService.js` — used by AssetResearchModal
- `src/services/researchAdvisor.js` — imported by App.jsx for game plan generation
- `src/services/technicalAnalysisAI.js` — imported by App.jsx
- `src/utils/researchAssetBuilder.js` — GAME-CRITICAL (BaggerBomb, FreeAgency, CommandConsole)

### Hooks
- `src/hooks/useAssetResearch.js` — manages modal state, used by ResearchLandingPage and MoneyMapScreen (but could be used by other screens)

### Other
- `src/components/ResearchAdvisor.jsx` — imported by App.jsx (AI advisor panel)
- `src/components/Dashboard/ResearchModeButton.jsx` — exported from Dashboard/index.js
- `src/components/GamePlan/` — partially shared (RiskStyleScreen, SectorSelectionScreen used by App.jsx; NotesTab used by PortfolioBuilderBaggerBomb)

### API Endpoints (shared)
- `api/ai-advisor.js` — heavily shared across entire app
- `api/why-moving.js` — used inside AssetResearchModal (shared)

---

## 11. NEEDS RELOCATION (currently accessed through Research but needed elsewhere)

### Navigation Changes Required
- **BottomNav.jsx**: Replace `research` nav item with `academy` item
- **DesktopSidebar.jsx**: Replace `research` nav item with `academy` item
- **App.jsx**: Replace `showResearchMode` toggle and rendering block with Academy component

### GamePlan/Build My Thesis Flow
- Currently accessed via Research (`flowPhase` state) — if this feature is still needed, it needs a new entry point (possibly from BaggerBomb/game creation flow directly)

### Components That Stay in `src/components/Research/`
- 16+ files must stay because AssetResearchModal depends on them. Consider whether to:
  - (A) Leave them in `Research/` directory (simplest)
  - (B) Rename directory to something like `AssetAnalysis/` to avoid confusion
  - (C) Move modal-related files to `src/components/draft/` or a new `src/components/Analysis/` directory

---

## Verification
After implementing the Academy replacement:
1. Verify all game screens still open AssetResearchModal correctly (BaggerBomb, Snake Draft, Free Agency)
2. Verify Dashboard watchlist can still open asset research
3. Verify FantasyTimes stories can still open asset research
4. Verify CommandConsole still works
5. Verify GamePlan flow has a valid entry point (if preserved)
6. Verify no broken imports from removed files
7. Run `grep -r "Research" src/` to catch any remaining references
