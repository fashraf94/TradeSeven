# ECON CAPTURE — FINDINGS + MATCHER-TABLE RULINGS (FOUNDER, JUL 30 2026)

**Relayed verbatim to the Recap Restoration session. Governs the R2 fixture swap and `ECON_CATEGORY_MATCHERS` in `fetchEconomicEventsEODHD.js`. Attach alongside the two capture artifacts.**

## 0. Capture provenance

| Artifact | Window | Rows | Distinct types | Purpose |
|---|---|---|---|---|
| `econ-capture-20260730.json` | 2026-07-23 → 07-30 | 106 | 90 | R2 fixture source; FOMC row shape (M5) |
| `econ-capture-july-full.json` | 2026-07-01 → 07-31 | 425 | 200 | Matcher-table validation across all Tier-1 categories |

**R-B1 HARD STOP does NOT fire** — `/economic-events` is live on the plan. Feed quality validated: operands numeric, estimates present where expected, unreleased rows correctly `actual: null`.

**Operand presence:** actual 331/425, estimate 180/425. **The `NOT_VERIFIABLE(missing_operand)` degrade path is routine, not an edge case** — ~57% of rows lack an estimate. Record this in the fixture provenance.

**Field types:** every observed `actual` is a **number**, never a string. The Sonar-era string/K-M-B-suffix world does not exist on this path. Keep the parser's suffix handling (defensive), but the provenance comment must state that captured operands are numeric so a future reader doesn't reintroduce string assumptions.

**Timestamps** are timezone-naive UTC strings (`2026-07-29 18:00:00` = 2:00 PM ET FOMC) — assert parse-as-UTC in the fetch; never local.

## 1. FOUNDER RULINGS — Tier-1 category → feed `type` mapping

| DRB category | Maps to feed type | Avoid-list (must NOT match) |
|---|---|---|
| **CPI** | **`Inflation Rate`** (YoY headline %) | `CPI`, `CPI s.a` (index levels ~320), `Core CPI`, `Core Inflation Rate` |
| **PPI** | **`Producer Price Index`** | `Core PPI`, `PPI Ex Food, Energy and Trade` |
| **PCE** | `PCE Price Index` | `Core PCE Price Index`, `PCE Prices`, `Core PCE Prices` |
| **GDP** | `GDP Growth Rate` | `Gross Domestic Product`, `GDP Price Index`, `GDP Sales` |
| **NFP** | `Non Farm Payrolls` (no hyphen) | `Nonfarm Payrolls Private`, `Government Payrolls`, `Manufacturing Payrolls`, `ADP Employment Change` |
| **Retail Sales** | `Retail Sales` | `Retail Sales Ex Autos`, `Retail Sales Ex Gas/Autos`, `Retail Inventories Ex Autos` |
| **FOMC** | `Fed Interest Rate Decision` | `Fed Press Conference`, `Press Conference`, `FOMC Economic Projections`, `FOMC Minutes`, all `Fed * Speech` rows |
| **ISM Mfg** | `ISM Manufacturing PMI` | `ISM Manufacturing Employment / New Orders / Prices`, `S&P Global Manufacturing PMI` (different survey) |
| **ISM Svc** | `ISM Services PMI` **OR** `ISM Non-Manufacturing PMI` — accept either, **never double-count as two events on the same day** | `ISM Services Business Activity / Employment / New Orders / Prices`, `ISM Non-Manufacturing *` sub-indices, `S&P Global Services PMI` |
| **Consumer Confidence** | `CB Consumer Confidence` | `Michigan Consumer Sentiment`, `Michigan Consumer Expectations`, `Economic Optimism Index`, `NFIB Business Optimism Index` |
| **Jobless Claims** | `Initial Jobless Claims` | `Continuing Jobless Claims`, `Jobless Claims 4-Week Average` |
| **JOLTS** | **DROPPED — founder ruling** (see §2) | — |
| **Productivity** | Verify in an August window before mapping (see §2) | — |

**Rationale of record (CPI/PPI):** `Inflation Rate` is the YoY headline percentage — the figure a reader means by "CPI came in at X%" — and its % unit matches the R-B1a band (`2.0 % MoM`); the `CPI` row is an index level (~320) and would both misreport and misfire the band. Same reasoning for `Producer Price Index` over the index-level/core variants. (Naming follows the Trading Economics convention EODHD carries upstream.)

## 2. FOUNDER RULINGS — absent categories

- **JOLTS: DROP from the Tier-1 arrays.** Not present anywhere in 425 rows across a full month, though it releases ~the 8th–9th. It is `medium` impact, and a category that structurally can never produce is the silent-zero pattern rebuilt inside its own fix. **Before dropping, search the capture for it under any alternate name** (job openings / labor turnover); if found, map it and reverse this ruling. If dropped, note it in `macroCalendar.js` with the reason so nobody re-adds it blind.
- **Productivity: verify, don't assume.** Absent from July, but Q2 preliminary releases in early August — consistent with window timing rather than feed absence. Confirm with an August-window capture before mapping or dropping. Until confirmed, leave the array entry and expect no firings.

## 3. Disambiguation hazards (test the matchers against these literal strings)

1. **Duplicate `type` rows disambiguated ONLY by `comparison`.** `Building Permits` appears twice at one timestamp: `comparison: "mom"` (−2.6, a %) and `comparison: null` (1.374, a level in millions). **Where a category's conventional unit requires it, matchers must key on `type` + `comparison`** — otherwise a YoY/level row silently substitutes for the MoM print and the band evaluates the wrong unit. Check this specifically for CPI/Inflation Rate, PPI, PCE, GDP, and Retail Sales.
2. **Sibling substitution** — every avoid-list in §1 has observed strings in the captures. Test each one explicitly.
3. **ISM dual naming** — `ISM Non-Manufacturing PMI` and `ISM Services PMI` are the same survey under two labels. Accept either; guard against counting both.

## 4. Incidental validation (no action)

The feed carries ten `Fed [Name] Speech` rows. The retired keyword matcher included `fed`, so pre-R-A1 every governor's speech would have qualified as a Tier-1 "event" with null operands. **R-A1 eliminated this noise class before it could fire** — recorded as evidence the array-driven ruling was correct.

## 5. Build actions

1. Swap the `PROVENANCE: SYNTHETIC` block in `econPrintVerifier.test.js` for captured rows (provenance comment naming the artifact, window, and capture date). Include the FOMC row — **M5 closes: `Fed Interest Rate Decision` is a plain numeric rate (3.75), not a range string.**
2. Implement §1's mapping table with positive + negative rules; test every avoid-list against the literal observed strings.
3. Add `type`+`comparison` keying per §3.1 where unit convention requires.
4. Assert parse-as-UTC on `date`.
5. Resolve JOLTS per §2 (search first, then drop with an in-code reason).
6. Fold the Tier-1 array value-lock if trivial (standing flag-3 ruling), else register.
7. Full suite + the R2 battery against captured rows → report → PR ready for founder merge.

*ECON_CAPTURE_FINDINGS_AND_MATCHER_RULINGS_JUL30_2026.md*
