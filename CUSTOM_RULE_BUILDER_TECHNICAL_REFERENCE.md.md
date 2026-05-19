\# Custom Rule Builder — Technical Reference  
\#\# Quick Reference for Ongoing Development

\*\*Last Updated:\*\* April 2, 2026

\---

\#\# Param Schema Shape

\`\`\`javascript  
// In forgeKnowledgeBase.js → rule.forgeTemplates\[0\].params  
paramKey: {  
  type: 'number' | 'select' | 'toggle',  
  default: \<value\>,  
  label: 'Human-readable label',  
  hint: 'One sentence explaining why this matters.',  
  // Number only:  
  min: \<number\>, max: \<number\>, step: \<number\>,  
  unit: 'RSI' | '%' | 'ATR' | 'min' | 'pts' | 'σ' | '/22' | '%ile' | '',  
  // Select only:  
  options: \[{ value: 'val', label: 'Display Label' }\],  
  // Toggle: boolean default, no additional fields  
}  
\`\`\`

\*\*Constraints:\*\* Max 5 params per rule (enforced by \`forgeService.js\`). Max 4 recommended for mobile UX.

\---

\#\# Firestore Rule Document Shape

\`\`\`  
agents/{agentId}/rules/{ruleId}  
├── text              // Interpolated rule text (human-readable, used as fallback)  
├── textTemplate      // Original template with {placeholders} (for re-interpolation)  
├── params            // Param definitions with defaults (from forgeKnowledgeBase)  
├── paramValues       // User's custom values (null \= all defaults)  
├── source            // 'forge\_discover' | 'forge\_quick' | etc.  
├── sourceRef         // forgeKnowledgeBase template ID  
├── category          // 'technical' | 'fundamental' | etc.  
├── visibility        // 'active' | 'testing' | etc.  
├── isRefined         // boolean  
├── isDeleted         // boolean  
├── bundleIds         // array  
└── timestamps        // created/updated  
\`\`\`

\*\*Validation (server-side):\*\*  
\- \`paramValues\`: plain object, max 5 keys, values string/number/boolean, strings max 50 chars  
\- \`textTemplate\`: string, max 500 chars  
\- \`text\`: string, max 200 chars (existing)

\---

\#\# Interpolation Flow

\#\#\# Client-Side (Phase B — UI Preview)  
\`\`\`  
RuleConfigDrawer → RuleTextPreview  
  Reads: rule.forgeTemplates\[0\].text \+ local paramValues state  
  Does: Simple {key} → value replacement for live preview  
\`\`\`

\#\#\# Client-Side (Phase B — Adding Rule)  
\`\`\`  
useForge.addRuleToBundle(template, paramValues)  
  → Interpolates text with paramValues  
  → Calls forgeService.createRule with text \+ textTemplate \+ paramValues \+ params  
\`\`\`

\#\#\# Server-Side (Phase C — Agent Evaluation)  
\`\`\`  
agentEvalPromptAssembly.js → resolveRuleText(r)  
  If r.textTemplate && r.params exist:  
    → interpolateRuleText(r.textTemplate, r.params, r.paramValues)  
    → sanitizeRuleText(result)  
  Else:  
    → sanitizeRuleText(r.text)  // backward compat  
\`\`\`

Both \`agentEvalPromptAssembly.js\` and \`agentPromptAssembly.js\` have identical functions. \*\*Must stay in sync.\*\*

\---

\#\# Component Tree

\`\`\`  
ForgeScreen  
├── CollectionChips  
│   └── (taps open CollectionDetailSheet)  
├── CollectionDetailSheet  
│   ├── Philosophy header (style collections only)  
│   ├── Rule cards with ParamDiffRow  
│   ├── RationaleToggle (collapsible)  
│   ├── "Use This Playbook" CTA  
│   └── "Merge Into Bundle" CTA  
└── CategoryAccordion (×8, one per category)  
    └── AccordionRuleCard (×N rules)  
        ├── Split button: \[ \+ Add | ⚙️ \]  
        └── RuleConfigDrawer (when expanded)  
            ├── RuleTextPreview  
            ├── ParamSlider (for number params)  
            ├── ParamPicker (for select params)  
            ├── ParamToggle (for toggle params)  
            ├── "Reset to defaults" link  
            └── "+ Add with these settings" button  
\`\`\`

\---

\#\# Trading Style Collections Shape

\`\`\`javascript  
// In forgeCollections.js  
{  
  id: 'swing-trader',  
  name: 'Swing Trader',  
  icon: 'TrendingUp',           // Lucide icon name  
  accentColor: '\#5EEAD4',       // for UI accents  
  difficulty: 'intermediate',  
  tags: \['trend', 'patience'\],  
  description: 'Short tagline',  
  philosophy: 'Editorial paragraph for detail sheet',  // style collections only  
  conflicts: \['day-trader'\],                            // soft warning  
  isStyleCollection: true,                              // flag for UI differentiation  
  rules: \[  
    {  
      ruleId: 'tech-rsi-oversold',           // must match forgeKnowledgeBase ID  
      paramOverrides: { threshold: 35 },     // keys must match actual param keys  
      rationale: 'Educational text...'       // displayed in CollectionDetailSheet  
    }  
  \],  
  get ruleIds() { return this.rules.map(r \=\> r.ruleId); }  // backward compat  
}  
\`\`\`

\---

\#\# Rule ID Mapping (Prompt Spec → Actual)

| Spec ID | Actual ID | Category |  
|---------|-----------|----------|  
| t-01 | tech-rsi-oversold | technical |  
| t-02 | tech-rsi-overbought | technical |  
| t-03 | tech-bollinger-squeeze | technical |  
| t-04 | tech-moving-average-trend | technical |  
| t-05 | tech-macd-bullish | technical |  
| t-09 through t-16 | t-09 through t-16 | technical |  
| a-sector-diversification | risk-sector-diversification | risk |  
| All other IDs | Match exactly | various |

\---

\#\# Param Key Mapping (Spec → Actual)

| Spec Key | Actual Key | Rule |  
|----------|-----------|------|  
| rsiThreshold | threshold | tech-rsi-oversold |  
| rsiCeiling | threshold | tech-rsi-overbought |  
| bandwidthThreshold | threshold | tech-bollinger-squeeze |  
| maType | period | tech-moving-average-trend |  
| requireAlignment | alignment | tech-moving-average-trend |  
| macdDirection | signal | tech-macd-bullish |  
| rsiFloor | rsiFloor | tech-macd-bullish |  
| squeezePercentile | pct | t-12 |  
| demoteThreshold | atr | ts-07 |  
| autoRestore | recovery (0.8 \= functionally "no restore") | ts-07 |  
| reviewInterval | interval (number, minutes) | ts-04 |  
| promotionThreshold | cycles (count) | ts-04 |  
| breakoutDirection | DROPPED (no KB equivalent) | t-12 |

\---

\#\# Data Fields Available at Agent Eval Time

These are the ONLY data fields the agent sees. Parameters must reference these:

| Field | Source | Refresh |  
|-------|--------|---------|  
| RSI (14-day) | Index Intelligence stockRankings | Daily |  
| 5-minute RSI | Intraday Layer 3 | Every eval (portfolio only) |  
| MACD (12/26/9) | Index Intelligence | Daily |  
| 5-minute MACD \+ histogram | Intraday Layer 3 | Every eval (portfolio only) |  
| SMA alignment (20/50/200) | Index Intelligence | Daily |  
| Volume ratio | Index Intelligence | Daily |  
| VWAP \+ deviation % | Intraday Layer 3 | Every eval |  
| Bollinger Bandwidth \+ %B | Index Intelligence | Daily |  
| ATR (dollar \+ percent) | Computed at eval | Per-stock |  
| RS vs SPY (0-22) | stockRankings | Daily |  
| Technical composite (0-100) | stockTechnicalScores | Daily |  
| P/E, P/B, EPS, Market Cap | EODHD REST | Daily |  
| Threshold proximity | Battle state | Every eval |  
| Time remaining \+ phase | Battle state | Every eval |  
| Trade count \+ timestamps | Battle state | Every eval |  
| FantasyTimes sentiment | Stories collection | Throughout day |  
| Sector per stock | Portfolio/bench CSV | Every eval |

\*\*NOT available:\*\* Custom RSI lookbacks, bench intraday data, options/IV, short interest, dark pool, correlations, beta.

\---

\#\# Adding a New Param to an Existing Rule

1\. Edit \`src/data/forgeKnowledgeBase.js\` → find the rule → add to \`forgeTemplates\[0\].params\`  
2\. Update \`forgeTemplates\[0\].text\` to include \`{newParamKey}\` placeholder  
3\. Verify the param references available data (see table above)  
4\. Max 5 params per rule (enforced by \`forgeService.js\`)  
5\. No changes needed to UI components — ParamSlider/Picker/Toggle render automatically based on param \`type\`

\#\# Adding a New Trading Style Collection

1\. Edit \`src/data/forgeCollections.js\` → add new collection object  
2\. Must include: id, name, icon, accentColor, difficulty, tags, description, philosophy, conflicts, isStyleCollection, rules array  
3\. Each rule: \`{ ruleId, paramOverrides, rationale }\`  
4\. \`ruleId\` must exist in \`forgeKnowledgeBase.js\`  
5\. \`paramOverrides\` keys must match actual param keys (use mapping table above)  
6\. Add \`get ruleIds()\` getter for backward compat  
7\. No other file changes needed — CollectionDetailSheet handles style collections automatically via \`isStyleCollection\` flag

\---

\*Technical Reference v1.0 — April 2, 2026\* 

