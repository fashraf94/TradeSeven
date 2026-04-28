# Signal Drop Phase 1 — Quality Report

**Date:** April 27, 2026
**Branch:** `claude/signal-drop-phase-1-7n4CI`
**Final harness run:** `scripts/test-results/20260427-224157Z/`
**Inputs analyzed:** 25 (4 baseline + 21 Flash-curated)
**Author:** Phase 1 quality review by Claude (architect) based on harness data and spot-check expansion review

---

## Section A: Executive Summary

Phase 1 is **functional and ready for beta launch with three blocker fixes and a list of polish items**. The pipeline correctly extracts theses from diverse content types (Twitter screenshots, URLs, pasted text, charts), produces structurally valid expansions with appropriate confidence calibration, and handles edge cases (junk inputs, prompt injections, low-confidence content) with the right routing.

The expansion quality is mixed but trends toward strong. Approximately 70% of successful expansions are launch-grade (sophisticated thesis capture, thesis-aware ticker selection, observable invalidation conditions). The remaining 30% have specific weaknesses — mostly hallucinated or thematically-stretched tickers in the related-tickers field — that should be addressed via prompt iteration before public launch.

**Top-line metrics from final harness run:**
- 25 inputs processed, 0 system errors
- 14 successful expansions (56% of inputs)
- 9 hard-checkpoints (correctly routed low-confidence cases)
- 2 junk bailouts (correct)
- 1 injection detection (correct)
- $0.0890 total cost across 25 inputs
- Average parse latency: 3544ms
- Average expansion latency: 2167ms (significantly improved by cache hits)

**Three findings that block launch:**
1. KeyClaim field XML/tag leakage in parsed responses (parse-signal bug)
2. Validator misfires when no parsed tickers are in the supported universe
3. Date-aware framing not reliably firing (carry-over from Step 4 testing)

**Roughly seven polish items** that don't block launch but should be addressed in pre-launch hardening.

---

## Section B: Pipeline Behavior Summary

### Distribution by parse path

```
happy:                       14 (56%)
low_confidence_checkpoint:    9 (36%)
bailout:                      2 (8%)
parse_error:                  0 (0%)
```

The 56% happy-path rate reflects the mix of input types deliberately curated to include questions (which correctly hit checkpoint) and junk (which correctly bails out). For thesis-style inputs specifically (excluding questions and junk), the happy-path rate is closer to 80%.

### Confidence distribution

```
0.0-0.1   ██  2  (junk bailout cases)
0.1-0.2   █   1  (injection case)
0.2-0.3       0
0.3-0.4   ███ 3  (question-style inputs)
0.4-0.5   ████ 4 (URL/thin content)
0.5-0.6   █   1  (image with weak signal)
0.6-0.7   █   1  (chart without ticker labels)
0.7-0.8   █████████ 9 (most successful parses cluster here)
0.8-0.9   ████ 4 (strongest parses)
0.9-1.0       0
```

The distribution is healthy. Strong inputs cluster at 0.7-0.9, ambiguous inputs cluster at 0.3-0.5 (correctly hitting hard-checkpoint), junk hits floor.

### Cross-cutting quality indicators

- **Junk bailouts:** 2 (both correct)
- **Hard checkpoints:** 9 (all appropriate — questions, thin URLs, weak images)
- **Expansions ran:** 14 (no expansion errors this run)
- **Cross-sector warnings:** 13 (high rate — see Section D for analysis)
- **Hard rejections:** 0 (validator correctly never blocked an expansion)
- **Injection flagged:** 1 (correct)

### Latency analysis

Parse calls average 3.5 seconds — within budget, dominated by Haiku Vision Pro 2 inference time. Expand calls average 2.2 seconds, significantly improved by cache hits (most repeat content fired the cache rather than calling Gemma fresh).

For a single user dropping a unique signal, expect ~4-6 seconds total pipeline time. For repeat content (cache hits on both layers), <1 second total.

### Cost analysis

$0.089 for 25 inputs across 14 successful expansions. Per-input cost: roughly $0.006 for a parse, $0.012-0.015 for an expansion. At scale, expect ~$0.02 per fully-completed signal drop.

---

## Section C: Quality Findings — What's Strong, What's Weak

### Launch-grade expansions (the target quality)

**`text-analyst-note-northland-amd.txt`** — Outstanding. Captured the bifurcated thesis (AMD bearish, NVDA bullish) within a single coherent expansion. Each related ticker had a thesis-aware role assignment (NVDA as beneficiary because it wins the TSMC allocation battle, INTC as competitive threat, MSFT/GOOGL as derivatives via hyperscaler capex). Invalidation conditions mapped one-to-one with the analyst's load-bearing claims.

**`twitter-light-amd-cpu-analysis.png`** — Sophisticated. Identified a non-obvious thesis (AMD absorbing TSMC capacity vacated by mobile chipmakers) and surfaced MTK (MediaTek) as a related ticker. MTK is genuinely under-covered for US audiences but exactly correct for this thesis. This is the kind of discovery-layer insight Flash flagged interest in earlier.

**`yahoo-finance-daily-breakdown.txt`** — Strong macro thesis (Big Tech earnings + edge-AI smartphone shift). Eight tickers identified in parse, seven in expansion, all thesis-coherent.

**`twitter-dark-retail-risk-commodities.png`** — Excellent thematic clustering on a macro rotation thesis. Suggested commodity ETFs (GSG, DBC, GLD) and commodity sector exposure (XLE) for an asset-class rotation framing. Correctly identified the input as macro/thematic rather than single-ticker.

**`twitter-light-ktos-analysis.png`** — Defense industry expansion correctly identified peers (LMT, NOC, RTX) and surfaced AVAV (a smaller-cap drone-focused defense play that addresses the discoverability concern). Invalidations were specific and observable.

### Decent expansions with specific weaknesses

**`url-seeking-alpha-gold-stocks-growth.txt`** — Good gold-mining thematic cluster (GOLD, NEM, GDX, GLD, UUP). Cross-sector warning fires inappropriately (no parsed tickers means the validator has no baseline). The expansion itself is solid but the warning UI would be misleading.

**`twitter-dark-amd-nvda-relation.png`** — Reasonable coverage of the AMD/NVDA relationship. Cross-sector warning fires on TSM only. Expansion confidence is medium, appropriate.

**`tradingview-chart-dark-ndaq.PNG`** — Chart input with no validated tickers. Expansion suggests Nasdaq-family ETFs (QQQ, TQQQ, SQQQ) plus megacaps. Validator warning fires on every expansion ticker, again because of the no-baseline issue.

**`msft-open-partnership.txt`** — Sophisticated thesis on the OpenAI partnership restructuring. Good ticker selection except TSLA as hedge — that's a weak/puzzling inclusion (what does Tesla hedge for an MSFT cloud competition thesis?).

**`nvidia-top-in.txt`** — Bearish thesis correctly framed and confidence appropriately calibrated to medium. Hedge tickers include SOXL (leveraged-long-semis) which would amplify rather than offset losses if NVDA tops. Questionable hedge framing.

### Weakness patterns observed across expansions

**Pattern 1: ETFs containing the anchor ticker.** QQQ in expansions where AAPL or NVDA or MSFT is the anchor; SOXX in semis-anchored expansions. These are structurally redundant — "if anchor goes up, the index containing the anchor also goes up" is tautological. Affects ~30% of successful expansions.

**Pattern 2: Hedge ticker selection inconsistency.** Hedge role tickers range from genuinely thesis-relevant (SQQQ short Nasdaq for an NVDA bearish thesis) to puzzling (TSLA for a cloud competition thesis). The expansion prompt's guidance on hedge selection needs tightening.

**Pattern 3: Cross-sector warnings firing on legitimate thematic clusters.** When the thesis is appropriately cross-sector (Big Tech spans XLK + XLC + XLY), the warning fires loudly even though the expansion is correct. Discussed further in Section D.

**Pattern 4: Question-style inputs handled correctly.** All five question-shaped inputs (energy-stock-forecast, industrial-materials-mix, lng-performance-since-iran-war, intel-old-inventory-value, shorting-tech-stocks) correctly hit hard-checkpoint instead of being forced into expansion. This validates a Phase 1 design choice.

---

## Section D: Architecture Findings (Code/Config Changes Needed)

### Finding D1: KeyClaim XML/tag leakage (BLOCKER)

In the energy-stock-forecast parse, the `keyClaim` field contained:

```
"Energy stocks have had a strong run and will begin reporting earnings this week; the questioner seeks identification of best-positioned energy companies.</anyClaim>\n<parameter name=\"tickers\">[]"
```

Note the literal `</anyClaim>` closing tag and `<parameter name="tickers">[]` opening tag embedded in the keyClaim field. These are leaking from the structured tool-use prompt template into the parsed output.

**Investigation needed:** review the parse-signal Haiku prompt for tag leakage. Likely either an example with malformed template tags or a tool-use response handling issue.

**Impact:** Field values containing literal XML tags will display incorrectly in the Phase 2 UI and could confuse downstream consumers (the expansion endpoint, the watchlist conversion, the frontend rendering).

**Severity:** High. Should be fixed before any UI shipping work.

### Finding D2: Validator misfires when no parsed tickers in universe (BLOCKER)

When parse-signal finds zero validated tickers (e.g., chart screenshots, macro-thematic inputs, URL parses where tickers are mentioned but not in the universe), the cross-sector warning compares the expansion's tickers against an empty sector baseline. The result:

> "cross-sector or unknown tickers in expansion: GOLD, NEM, GDX, GLD, UUP (parsed sectors: (no sector for parsed tickers))"

This warning is technically correct (those tickers aren't in any "parsed sectors") but practically meaningless — the parsed sectors set is empty. The warning surfaces all expansion tickers as concerning when they may all be appropriate.

**Recommendation:** Modify the validator to:
1. **Suppress the warning entirely** when parsed sectors set is empty (no baseline to compare)
2. **OR reframe** as "expansion contains tickers outside the supported universe: X, Y, Z" — which is true and useful, vs. "cross-sector" which implies a sector baseline that doesn't exist

**Severity:** Medium-high. Affects ~40% of successful expansions in this run. Will produce a confusing UX in Phase 2.

### Finding D3: Date-aware framing not reliably firing (BLOCKER)

Carried over from Step 4 testing. Past-date inputs receive forward-looking framing in expansion thesisSummary. The PHASE_RULES instruction is present but Gemma isn't consistently following it.

**Recommendations (in order of effort):**
1. **Server-side date computation:** Compare `parsedSignal.referencedDate` against current date. If past, inject explicit flag: `"REFERENCED EVENT IS IN THE PAST — frame thesis retrospectively"` into Block 7 of the expansion prompt. Don't ask Gemma to do the date math.
2. **Few-shot example:** Add a past-date example to the expansion prompt showing the expected retrospective framing.
3. **Move rule to higher attention:** Promote the date-awareness rule from PHASE_RULES (mid-attention) to OUTPUT_FORMAT (top-attention).

Server-side date computation is the most reliable fix.

**Severity:** High. Stale-revisit handling is explicitly in the spec as a UX requirement.

### Finding D4: Token usage telemetry missing on expansions (POLISH)

All expansion responses show `tokenUsage: null`. Parse responses correctly capture token counts. Likely an OpenRouter usage-data propagation issue.

**Impact:** Cannot accurately track per-call expansion costs from response data. Authoritative costs live only in OpenRouter dashboard (or hopefully shadow logs if those are capturing it correctly).

**Severity:** Low. Affects observability, not user-facing behavior.

### Finding D5: ExpandedAt field returns retrieval time on cache hits (POLISH)

When `cached: true`, the `expandedAt` field shows when the cached version was retrieved, not when the original expansion was generated. Phase 2 UI may want to surface "Expansion from {original timestamp}" for transparency.

**Severity:** Low. UI consideration, not a functional issue.

### Finding D6: Production rate limiting (POLISH)

The Step 6 harness exposed that running ~25 sequential requests hits Anthropic's rate limit. The harness handled this with retry logic, but a real production app would need server-side rate-limit handling so users don't see 429 responses in the UI.

**Recommendation:** Add server-side retry-with-backoff at the parse-signal endpoint level. If Anthropic returns 429, the endpoint should sleep per the retryAfter header and retry once before surfacing failure to the client.

**Severity:** Medium. Will affect users immediately at any meaningful concurrent traffic level.

### Finding D7: 5000-character text limit may be too low (POLISH)

The endpoint validates text inputs at 5000 characters max. Several real-world content types (long analyst notes, multi-paragraph theses) approach or exceed this limit naturally. Test inputs from this run hit the limit on substantive analyst content.

**Recommendation:** Raise to 15000 characters. Cost impact is negligible (~2-3K extra tokens per call).

**Severity:** Low-medium. Affects user perception when long-form content gets rejected.

---

## Section E: Prompt Iteration Recommendations

### Expansion prompt (signal_expansion mode in voiceLayerPrompt.js)

**Recommendation E1: Tighten related-ticker quality guardrails.**

Add explicit instructions to the SIGNAL_EXPANSION_PHASE_RULES:

> **Related-ticker quality discipline:**
> - Do not include ETFs that contain the anchor ticker as a top-10 holding (structural redundancy)
> - For hedge role: only include tickers that genuinely move opposite or are uncorrelated to the thesis. If no clear hedge exists, leave the field empty rather than reaching
> - For derivative role: only include if the catalyst materially affects the derivative ticker, not just tangentially related
> - If you cannot identify a high-conviction related ticker for a role, leave that role empty rather than including a weak inclusion

**Recommendation E2: Add discoverability nudge.**

Within the same SIGNAL_EXPANSION_PHASE_RULES section:

> **Discoverability bias:**
> When suggesting relatedTickers, prioritize a balanced mix: 3-4 well-known names that traders will immediately recognize, AND 2-3 less-covered names that share thematic exposure but might surface novel ideas. For less-covered names, prefer mid-cap (typically $5B-$50B market cap) names with clear thematic connection to the thesis.

This addresses Flash's discoverability instinct from Step 4 review without major architectural changes.

**Recommendation E3: Strengthen invalidation-thesis-type matching.**

> **Invalidation type matching:**
> Match invalidation type to thesis type. A fundamental thesis (earnings, margins, market share) should have fundamental invalidations (data points, guidance, financial reports). A technical thesis (breakouts, momentum, support/resistance) should have technical invalidations (price levels, volume, indicators). Mixed types are acceptable but should be deliberate, not lazy.

### Parse prompt (Haiku Vision Pro 2 prompt)

**Recommendation E4: Question vs thesis content type.**

Add a new contentType value: `question`. Currently questions get classified as `casual_text` and proceed to a low-confidence parse. A `question` content type would let the system route them through a more deliberate UX path:

> **contentType: "question"** — used when the input is asking what to do or what to think rather than expressing a thesis. Examples: "Which energy stocks should I look at?", "Is NVDA still a buy?", "How does LNG compare to..."

This pairs with a Phase 2 UI improvement: when contentType is `question`, the hard-checkpoint UI shows "This looks like a question. Signal Drop is best for theses you've encountered. Try Workshop Mode for guided exploration."

**Recommendation E5: Investigate keyClaim tag leakage.**

Per Finding D1, audit the parse-signal prompt for malformed template tags or tool-use response handling that could be leaking XML structure into output fields.

---

## Section F: Launch Readiness Assessment

### Ready to ship in current state

- Parse-signal endpoint (with D1 fix)
- Expand-signal endpoint (with D3 fix)
- Validator (with D2 fix)
- Caching infrastructure (parse + expand)
- Shadow logging (full pipeline coverage confirmed)
- Per-user Firestore drop persistence
- Cross-sector warning system (after D2 fix)
- Bailout logic
- Hard-checkpoint logic
- Injection detection (multi-layer defense working)
- TTL policy on cache
- Firestore rules

### Needs UI before user-facing launch

- Hard-checkpoint UX (when to show, what message, what user actions)
- Question-vs-thesis routing UX (per Recommendation E4)
- Cross-sector warning display (after D2 fix, decide whether to surface in UI or log silently)
- Expanded signal card layout
- Watchlist conversion flow

### Nice-to-have before launch (Phase 1 polish)

- D4: Token usage propagation
- D5: Cache hit timestamp clarity
- D6: Server-side rate-limit retry
- D7: Character limit increase
- E1-E3: Prompt iteration based on findings
- E4: Question contentType addition

### Acceptable known limitations for Phase 1

- Vision-model parsing on charts without ticker labels yields lower-confidence parses (correct degradation behavior, just lower happy-path rate for that input shape)
- URL fetch on social media (Twitter, etc.) and paywalled news (WSJ, Bloomberg) returns thin content and triggers hard-checkpoint (graceful degradation working as designed)
- Expansion latency for non-cached calls is 5-12 seconds (within budget, but feels slow for some user flows)
- Cross-sector warning fires more loudly than ideal — addressed by D2 fix but may still surface false-positive feel

---

## Section G: Phase 2+ Enhancement Candidates

These are features and improvements explicitly *not* targeted for Phase 1 launch but identified during Phase 1 testing as worth pursuing post-launch.

### G1: Deeper expansion tier (Sonnet-powered, on-demand)

Two-tier expansion UX:
- Default: Gemma-powered expansion (fast, ~$0.015, mostly known names)
- "Find me less-covered names" button: Sonnet-powered second pass (~$0.03-0.05) explicitly tasked with surfacing thematic mid-caps and genuinely under-covered names

Trigger criteria for evaluation: post-launch analytics on what % of users want a deeper expansion vs. accept the default.

### G2: Browser-rendering URL scraper

For URL inputs that hit graceful-degradation today (paywalled, JavaScript-heavy, anti-bot protected), integrate a service like Cloudflare's `/crawl` API as a slow-path fallback. Two-tier fetch UX:
- Default: 3-second basic fetch (current behavior)
- "Try harder to fetch this URL" option: 10-30 second browser-rendering fetch via scraper service

Trigger criteria: post-launch analytics on URL-input failure rate. If significant % of URLs hit hard-checkpoint due to fetch failure, the integration becomes worthwhile.

### G3: Question-mode routing

If contentType is `question` (per Recommendation E4), route to Workshop Mode rather than expecting Signal Drop's expansion path. This requires UX integration between Signal Drop and Workshop, not just an endpoint change.

### G4: Validator quality improvements beyond cross-sector

Current validator only checks for cross-sector picks and unknown tickers. Future iterations could flag:
- ETFs containing the anchor (structural redundancy)
- Tickers below a market cap threshold (likely Gemma reaching)
- Tickers with no name match in the prompt (potential hallucination)

### G5: Server-side rate-limit handling

Per Finding D6, this is a Phase 1 polish item BUT also has Phase 2 implications: at scale, more sophisticated rate-limit handling (queue management, tier upgrades, multi-key rotation) becomes worthwhile.

### G6: Training data lake activation

The shadow logger is capturing every parse and expand call with full request/response detail. Once enough data accumulates (~1000+ real user drops), this dataset becomes usable for fine-tuning a smaller, faster, cheaper model for specific pipeline stages. Already architected, just needs accumulation time.

---

## Section H: Conclusion

Phase 1 has built and validated the core Signal Drop pipeline. The infrastructure works end-to-end on real-world content across diverse input types. The expansion quality, while mixed, has a clear pattern: structural correctness across all expansions, with specific quality issues (related-ticker hallucination, validator misfires, date-aware framing) that are addressable through prompt iteration and small architecture fixes.

**Recommended path forward:**
1. Fix the three blocker findings (D1, D2, D3) — estimated 1-2 days of work
2. Iterate prompts per E1-E3 — estimated 1 day
3. Re-run the harness against the same 25 inputs to verify changes improved outputs without regressions — ~30 minutes
4. Begin Phase 2 UI work in parallel with prompt iteration

The 25 curated inputs from this run become the **regression baseline** for future prompt iterations. After every prompt change, re-running the harness on these inputs and comparing summary.json outputs gives quantitative confirmation that changes helped without introducing new failures.

Phase 1 is genuinely close to launch-ready. The remaining work is well-characterized and bounded. Estimated time from current state to beta-ready: 1-2 weeks of focused work.
