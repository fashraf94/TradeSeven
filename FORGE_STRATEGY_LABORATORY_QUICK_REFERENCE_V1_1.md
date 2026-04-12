# Forge Strategy Laboratory — Quick Reference v1.1

**For:** Claude Code implementation sessions  
**Date:** April 12, 2026  
**Full Spec:** `FORGE_STRATEGY_LABORATORY_SPEC_V1_1.docx`  
**Supersedes:** V1.0 Quick Reference, Season Mode UI Spec V1.1, Conversation-to-Rule Pipeline Spec V1

---

## The Reframe (One Paragraph)

The Forge is a **Strategy Laboratory** — build your trading strategy (through conversation with Gemma or manual configuration), test it against 4 weeks of live market data in the Proving Ground, get AI-powered feedback, refine, and deploy your proven strategy to live BaggerBomb battles with hybrid execution guardrails. The existing Season Mode backend is preserved in full — only user-facing context and entry points change.

---

## Core Loop

```
DEVELOP → TEST → ANALYZE → REFINE → DEPLOY
  │         │        │         │        │
  │         │        │         │        └─ Deploy to Agent (BaggerBomb)
  │         │        │         │           Hard thresholds → deterministic JS
  │         │        │         │           Soft preferences → LLM prompt
  │         │        │         └─ Adjust params + tag hypothesis
  │         │        └─ Weekly Reviews + Daily Briefings + Experiment Reports
  │         └─ 4-week Proving Ground (existing Season engine)
  └─ Workshop Mode (Gemma → compile → pre-filled Dimensions)
     OR Manual Config (Collection → adjust Dimensions)
```

---

## The 143-Rule Restructure

| Tier | Name | Count | Visibility | v1.1 Note |
|------|------|-------|------------|-----------|
| 1 | Strategic Levers | ~25–30 | Primary UI (Strategy Dimensions) | |
| 2 | Agent Baseline | ~40–60 | Invisible (agent prompt) | Parity audit in Phase 7 |
| 3 | Proving Ground Engine | ~20–25 | Advanced tab only | |
| 4 | Dead Weight | ~30–40 | Cut after data audit | |

### Strategy Dimensions (Tier 1 — User-Facing)

| Dimension | Question | Key Parameters |
|-----------|----------|----------------|
| Risk Posture | How much drawdown? | Stop-loss %, trailing stop, circuit breaker |
| Entry Aggression | How picky are filters? | RSI range, volume, fundamental floor |
| Exit Discipline | When take profits/cut? | Profit target %, time exit, tech triggers |
| Sector Strategy | Concentrate or diversify? | Max sector weight, drift tolerance |
| Momentum Sensitivity | Chase or buy dips? | Momentum threshold, add-to-winners |
| Macro Awareness | Events change behavior? | FOMC rotation, earnings avoidance |
| Position Sizing | Equal or conviction? | Max position %, cash deployment |
| Rebalancing Freq. | How often reshape? | Rebalance triggers, trim/add thresholds |

---

## Terminology Changes

| Old (Season) | New (Proving Ground) |
|---|---|
| Season | Experiment / Test Run |
| Join Season | Launch Experiment |
| Season Dashboard | Experiment Dashboard |
| Pit Stop | Weekly Review |
| Leaderboard | Strategy Rankings |
| Season Review | Experiment Report |
| Alpha vs SPY (primary) | **Forge Score** (primary), Alpha (secondary) |
| Deploy Algorithm | Deploy to Agent |

---

## Forge Score [NEW v1.1]

Proprietary composite metric replacing raw alpha as primary ranking. Components:
- Alpha vs SPY
- Consistency (% of days beating benchmark)
- Risk efficiency (Sharpe-like)
- Rule efficiency
- **BaggerBomb Fitness Score**

Alpha remains visible as secondary educational context. Forge Score is primary for rankings and badges.

---

## BaggerBomb Fitness Score [NEW v1.1]

Addresses the coherence gap: 4-week EOD simulation ≠ 1-day intraday BaggerBomb. Evaluates how well a strategy's stock picks align with BaggerBomb success patterns:
- ATR Profile (volatile enough for thresholds?)
- Threshold Crossing Rate (historical intraday data)
- Bust Avoidance Rate
- Sector Volatility Mix
- Turnover Compatibility

Computed daily from existing stockTechnicalScores data. Written to daily log.

---

## Hybrid Execution Guardrails [NEW v1.1]

When strategy deploys to BaggerBomb:

| Rule Type | Execution | Examples |
|-----------|-----------|---------|
| Hard Quantitative | Deterministic JS override | Stop-loss %, position cap, max sector weight |
| Soft Qualitative | LLM prompt directive | Momentum preference, macro awareness |
| Baseline Competence | LLM system prompt | Diversification, volume awareness |

Flow: Haiku proposes decision → Guardrail checks hard constraints → Override if violation → Log override → Execute approved decision.

---

## Workshop Mode [NEW v1.1]

Replaces Conversation-to-Rule Pipeline Spec V1 as authoritative reference.

### Model Roles
| Task | Model |
|------|-------|
| Thesis conversation | Gemma (Voice Layer) |
| Thesis tracking | Gemma (scratchpad) |
| Compile → dimensions | Haiku (new endpoint) |
| Post-experiment analysis | Sonnet (debrief) |

### Thesis Schema (Scratchpad)
```javascript
{
  summary: "Aggressive momentum with tight protection",
  catalyst: "Strong earnings + low VIX",
  instruments: ["Tech leaders", "Semiconductor breakouts"],
  entryLogic: "RSI 45-65, strong volume, above 50-day SMA",
  exitLogic: "Stop-loss 6%, profit target 15%, exit before earnings",
  riskPosture: "Conservative drawdown, aggressive entries",
  invalidation: "VIX > 25 → defensive switch",
  confidence: "medium",
  readyToCompile: true
}
```

### Flow
Conversation → thesis develops → Gemma offers compile → Haiku maps thesis to Strategy Dimension values → **User lands on Strategy Dimensions UI pre-filled** → adjusts → launches experiment.

Workshop NEVER bypasses the Dimensions UI — it populates it.

---

## Daily Engagement [NEW v1.1]

After daily cron, generate template-based briefing from dailyLog data:
"Day 7: Your algorithm held NVDA through a 2.3% dip. Stop-loss at 8% kept you in. 2 new entries triggered. Alpha: +1.2%."

No AI call needed. Read dailyLog → extract trades/holds/alpha → template → write to entry doc.

---

## Component Map

### Repositioned
| Component | New Role | Changes |
|-----------|----------|---------|
| SeasonHub → ForgeLanding | Primary Forge view | Rewrite content, add Workshop CTA, deploy section, daily briefing |
| SeasonEntryModal | Launch Experiment | Strategy Dimensions UI (Step 2), collection picker |
| SeasonDashboard | Experiment Dashboard | Rename + daily briefing card |
| PitStopScreen | Weekly Review | Rename + hypothesis prompt |
| SeasonReview | Experiment Report | Add Deploy CTA, Refine CTA, Forge Score |
| ActiveSeasonBanner | Experiment banner | Copy update |
| ForgeScreen | Advanced tab | Demote + power-user warning banner |

### New Components
| Component | Purpose |
|-----------|---------|
| ForgeLanding.jsx | Primary Forge view |
| StrategyDimensions.jsx | 6–8 expandable strategic knob panels |
| CollectionPicker.jsx | Trading Style Collection selector |
| DeployToAgent.jsx | Deploy bridge UI + fitness/guardrail preview |
| WorkshopChat.jsx | Workshop Mode wrapper with thesis tracking |
| DailyBriefingCard.jsx | Template-based daily summary |
| ForgeScoreDisplay.jsx | Composite score with breakdown |
| BaggerBombFitness.jsx | Fitness score with dimension guidance |

### Removed
- SeasonModeToggle.jsx — gone entirely
- RuleModeBadge.jsx — gone from primary views

---

## Implementation Phases

| # | Phase | Risk | Key Deliverables |
|---|-------|------|-----------------|
| 1 | Rename & Reframe | Low | Season → Proving Ground copy changes. Zero logic. |
| 2 | Forge Landing + Briefings | Med | ForgeLanding.jsx, DailyBriefingCard, demote ForgeScreen |
| 3 | Dimensions + Forge Score | Med | StrategyDimensions, CollectionPicker, ForgeScoreDisplay, BaggerBombFitness |
| 4 | Deploy Bridge + Guardrails | Med | deploy-to-agent.js, DeployToAgent.jsx, guardrail layer in agent-evaluate.js |
| 5 | Workshop Mode | Higher | voiceLayerPrompt mods, thesis tracking, compile-dimensions endpoint, WorkshopChat |
| 6 | Shadow Logger | Low | 6 streams, market regime tags, hypothesis tags |
| 7 | Rule Audit + Parity | Data-dep | Sort 143 rules into tiers, Tier 2/3 parity check |
| Future | Quick Test + Backtest | Deferred | Historical EvaluationContext reconstruction, instant testing |

---

## Shadow Logger — Streams

| Stream | Source | Key Data |
|--------|--------|----------|
| strategy_configs | create-entry.js | Algo snapshot, creation source, thesis, dimensions |
| pipeline_decisions | season-daily-evaluate.js | Daily log + **market regime tags** (VIX, SPY trend) |
| review_interactions | debrief + pit-stop-reply | Sonnet + Gemma + changes + **hypothesis tags** |
| refinement_pairs | create-entry.js (linked) | Exp A → changes → Exp B + hypothesis |
| deploy_events | deploy-to-agent.js | Config + Forge Score → agent deployment |
| workshop_theses | chat.js (workshop) | Thesis across turns, compilation, reactions |

All: fire-and-forget, async, silent failure, JSONL to GCS `fantasytrades-training-data`.

---

## Protected Files — DO NOT MODIFY

```
api/_utils/season*.js                 (Proving Ground engine)
api/cron/season-daily-evaluate.js     (daily simulation)
api/cron/season-pit-stop-manage.js    (weekly review management)
api/season/*.js                       (add shadow logging ONLY)
src/services/forgeService.js          (rule CRUD)
src/data/forgeKnowledgeBase.js        (content additions only)
agentBattleService.js                 (BaggerBomb engine)
agentProgression.js                   (agent progression)
PlaybookPanel.jsx                     (playbook UI)
firestore.rules                       (only ADD, never modify)
```

**Exception:** `agentEvalPromptAssembly.js` modified in Phase 4 ONLY to add guardrail post-processing layer. Existing prompt assembly untouched.

---

## Legal Framing (Always Apply)

- Frame as game strategy, never financial advice
- Forge Score is primary metric, not raw alpha
- "Deploy algorithms to competitions" not "invest using recommendations"
- Disclaimer visible: "FantasyTrades is a skill-based gaming platform. No real money is invested."
- Never suggest replicating game strategies with real money
- Advanced tab banner: "Granular rules power simulations. Deployed strategies use Strategy Dimensions."

---

*Quick Reference v1.1 — April 12, 2026*
*Supersedes: V1.0, Season Mode UI Spec, Conv-to-Rule Pipeline Spec*
