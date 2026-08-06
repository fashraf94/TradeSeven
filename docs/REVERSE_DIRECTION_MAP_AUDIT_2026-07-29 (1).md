# Reverse-Direction Map Audit — the stored compatibility map vs. the six kernel constitutions

**Date:** July 29, 2026 · **Type:** read-only adversarial audit · **Deliverable:** this report only
**Repo:** `fashraf94/TradeSeven` · **Branch:** `claude/reverse-direction-map-audit-apww1j`
**HEAD:** `178a8a090d77b686842c3b4bcf26d589bbc84f9d` · **Tree:** clean (no working-tree changes; verified before and after)
**Origin comparison:** `git fetch origin` run as the first step of the session per BUILD_RULES §3; `HEAD` is
**identical to `origin/main`** (0 commits ahead, 0 behind).
**Git history deepened:** `git fetch --unshallow origin` was run for investigation (permitted and recorded per
BUILD_RULES §3, founder ruling June 10 2026). The clone was shallow; full history is 3,227 commits. No project
state was modified — no branch created, no commit, no code change.

**Standing:** flags in this report are **not adjudications**. Each is a cited disagreement between a stored
verdict and what a locked kernel predicts. They join the founder docket by the V1.1 process. Nothing here
decides which side wins.

---

## 0. Executive verdict

**The premise was right, and the scale is larger than expected.** The stored compatibility map was audited in
both directions against all six kernels. The direction the review suspected was under-collected — stored
`native`/`neutral` cells that a kernel would demote — is not merely under-collected; it is where nearly all the
disagreement lives, by roughly twelve to one.

| # | Finding | Verdict |
|---|---|---|
| V1 | **The under-collected direction is the dominant one.** **141** surviving reverse-direction flags vs 12 forward, across the 570 offerable cells (167 raised, 14 refuted on the merits). The twelve-flag docket held **two** reverse cases; this sweep finds **141**, of which **7** demote a stored `native`. Scan items 7 and 10 add **19** further flags (§8, §9). | **CONFIRMED — larger than assumed** |
| V2 | **The map cannot express what the kernels mostly say.** The kernels have four verdicts; the map has three and no `tension`. **135 of the 153 surviving flags predict `tension`** — a state with nowhere to land. Guide §4 requires every tension cell to carry a treatment; stored as `neutral`, that treatment is silently dropped. | **STRUCTURAL — upstream of every flag** |
| V3 | **Half the offerable map is not an authored verdict.** 288 of 570 offerable cells (50.5%) resolve to `neutral` by fallthrough — no override, no family default, no decision. 75 surviving flags sit on such cells. Guide §1:23: "absence is not a verdict." | **STRUCTURAL** |
| V4 | **Reliance is already live, and it only ever produces evidence in one direction.** `RULE_COMPAT_MODE = 'enforce'`. A wrong `core_conflict` blocks a user and emits telemetry; a wrong `native`/`neutral` returns `events: []` — no block, no warning, no receipt. This is the mechanical reason the docket ran 11:1. | **CONFIRMED — reliance predates this audit** |
| V5 | **Any fix is an identity-hash event.** Proven by execution: flipping one cell changed `identityHash`, which fails the CI lock without a version bump, which per Guide §1:21 invalidates authored cells stamped at the old hash. Cell-by-cell disposition would re-invalidate the matrix on every pass. | **DECISION NEEDED BEFORE THE FIRST FIX** |
| V6 | **A CI invariant actively resists the reverse direction.** The strict seeded-rule invariant locks **39 offerable cells** against reclassification to `core_conflict`, and the map records that the seed map was once changed specifically to make it pass. | **CONFIRMED** |
| V7 | **Root cause is datable, and it predicts systematic rather than scattered divergence.** The map's adjudication closed **July 3** against the frozen June-24 `ARCHETYPE_DEF` docs; the kernels were founder-approved **July 23**. Two of the map's three governing policies (P2 "exits are Zone 2", P3 classify-by-default) are in direct textual conflict with a July-23 clause. | **CONFIRMED** |
| V8 | **The brief's own premise needs one correction.** It names `th-05`/guardian as "the one such case." Docket flag **#1 (`sx-04`/guardian) is also stored `native`** → CP predicts tension. Both are decided by the *same line*, `guardian.familyDefaults.profit_locking` (`archetypeRuleCompatibility.js:340`), whose third member `sr-01` nobody has examined. | **CORRECTION** |
| V9 | **One named input does not exist.** `docs/ADJUDICATION_RULINGS` V1.1 is absent from HEAD and from all 3,227 commits of history. It was not reconstructed; the four mechanism-level distinctions were located in their real homes and the substitution disclosed. | **MISSING INPUT** |
| V10 | **Family curation is the highest-leverage error surface, and four members are mis-filed.** 234 offerable cells are decided by family default, so one mis-filed id moves up to six cells at once. `tv-15` and `i-09` sit in `high_volatility` and `i-10` in `momentum_breakout` — none matching its family's own stated definition. (A fourth candidate, `a-07`, was raised and then refuted on the merits — see §5.3.) | **CONFIRMED** |

| V11 | **A third of the existing docket stands on rules the product will never offer.** Flags **#1, #5, #9 and #12** are `mode_scrapped` or `hidden_absent_substrate`. Worse for the audit's premise: of the only two reverse-direction docket entries, one (#1 `sx-04`) is unofferable — so half the reverse-direction evidence base cannot reach a user. The map carries **134 explicit cells on non-offerable rules**, 20 of them `core_conflict`, and 6 of 9 consumers can reach them by id. | **CONFIRMED — see §8** |
| V12 | **The map's own escape hatch does not exist.** It defers param-loosening on native cap rules to a "rung-2 precedence concern" (`archetypeRuleCompatibility.js:36-38`). `paramBounds` and `narrowedParams` have **zero occurrences** in `src/` or `api/`; shipped `precedencePosition 2` is the GameModePolicy, which sets no param bounds. That leaves **43 stored `native` cap cells** resting on a mechanism that was never built. | **CONFIRMED — see §9** |

**What to do first.** Three decisions are upstream of the flag table and should be taken before any individual
cell is touched: (1) whether the map gains a `tension` state (V2) — it determines the shape of 135 flags;
(2) whether the docket is dispositioned in one batched identity-version bump or cell-by-cell (V5); and (3) the
four family re-filings (V10), which move up to six cells each and would otherwise redo per-cell work. §10.5 sets
these out in order.

**What this is not.** No flag adjudicates anything. Each is a cited disagreement between a stored verdict and
what a locked kernel predicts, for the founder docket under the V1.1 process.

---

## 1. Inputs — and one input that does not exist

### 1.1 What was used

| Input | Path | Status |
|---|---|---|
| Stored compat map | `src/data/archetypeRuleCompatibility.js` (587 lines) | VERIFIED — read in full |
| Rule corpus | `src/data/forgeKnowledgeBase.js` (3,798 lines, `FORGE_RULE_TEMPLATES`) | VERIFIED — machine-extracted, 143 templates |
| Support status / offer gate | `src/data/ruleSupportStatus.js` (238 lines) | VERIFIED — read in full |
| Kernel — Trend Follower | `CONSTITUTION_TREND_FOLLOWER_V1.md` | VERIFIED — read in full |
| Kernel — Contrarian | `CONSTITUTION_CONTRARIAN_V1.md` | VERIFIED — read in full |
| Kernel — Speculator | `CONSTITUTION_SPECULATOR_V1.md` | VERIFIED — read in full |
| Kernel — Capital Preserver | `CONSTITUTION_CAPITAL_PRESERVER_V1.md` | VERIFIED — read in full |
| Kernel — Fundamental Investor | `CONSTITUTION_FUNDAMENTAL_INVESTOR_V1.md` | VERIFIED — read in full |
| Kernel — Diversifier | `docs/CONSTITUTION_DIVERSIFIER_V1.md` | VERIFIED — read in full |
| Authoring Guide **V1.1** | `docs/ARCHETYPE_AUTHORING_GUIDE_V1.md` | VERIFIED — read in full |
| Guide Amendment V1.2 (+ V1.2.1/.2/.3) | `docs/ARCHETYPE_AUTHORING_GUIDE_AMENDMENT_V1_2.md` | VERIFIED — read in full |
| The twelve-flag docket | `docs/PHASE3_METADATA_BATCH{1..5}_*_V1.md` | VERIFIED — all twelve located and cited |

### 1.2 MISSING INPUT — `docs/ADJUDICATION_RULINGS` V1.1

**The brief names `docs/ADJUDICATION_RULINGS` V1.1 as an input. That file does not exist and has never
existed.** Verified two ways: no such path at HEAD, and no such path anywhere in the repository's full
3,227-commit history after `--unshallow`
(`git log --all --pretty=format: --name-only | grep -i adjudic` → empty).

Per BUILD_RULES §3 and the `docs/README.md` provenance note ("if a record is missing, report it, don't
reconstruct it"), **no substitute was regenerated from model memory.** Instead the audit ran against the
in-repo documents that actually carry the substance the brief attributes to that file. All four
mechanism-level distinctions are present and citable:

| Brief's distinction | Where it actually lives at HEAD | Citation |
|---|---|---|
| **preference vs override** | Guide §2, `deprioritized` row: "a fundamental *gate* on TF = tension; a fundamental *override of trend evidence* = conflict" | `docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:31` |
| **sector vs name** | Contrarian kernel: "The inversion operates at the name level, not the sector level"; rubric: "*A rule preferring strong sectors is NOT core_conflict*" | `CONSTITUTION_CONTRARIAN_V1.md:24`, `:36`, `:58` |
| **bounded vs unbounded** | Guide §8 R1-8 atomic-authoring rule: "judge the full template domain first; if the mechanism is acceptable only within a subset, assign **tension + narrowedParams**" | `docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:91` |
| **gate vs preference** | Guide §3 (founder-ruled, Diversifier session) as CORRECTED by R1-1: `intendedMode` is immutable per `ruleId`; "never a silent reinterpretation as ranking" | `docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:40-48` |

**Consequence for the founder, stated plainly:** the audit's *predicted* verdicts rest on the guide + kernels,
not on a rulings document nobody can read. If `ADJUDICATION_RULINGS V1.1` exists outside the repo, any ruling
in it that narrows or widens one of these four distinctions can move a flag's predicted verdict by one rubric
step — which is exactly the kind of change that turns a `core_conflict` prediction into a `tension` prediction.
Two dispositions are available and both are the founder's call: upload the document (the
`docs/README.md` founder-to-add pattern), or ratify the four distinctions in their existing homes above so the
case law has a single citable address. Note the coincidence that may be the origin of the naming: the
**Authoring Guide is itself titled "V1.1"** (`docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:1`), same version number the
brief attaches to the rulings document.

### 1.3 Derived working artifacts (read-only extracts, not authorities)

The sweep ran against machine extracts of the live modules, generated in-session by importing them (no disk
writes to the repo): a full corpus export, a line-anchor index at HEAD `178a8a09`, six per-archetype
worksheets, a param-domain sheet, a cross-archetype symmetry sheet, and an inactive-rule dicta sheet. Every
citation in this report points at `src/`, `api/`, or a constitution — never at an extract.

---

## 2. Method

**Three layers, and the report is explicit about which layer stands behind each finding.**

**(1) Per-column sweeps — six independent agents, one per archetype.** Each read its constitution in full
(kernel + rubric + phase notes), the Authoring Guide V1.1 and Amendment V1.2, the stored map's header and its
own archetype block, and a generated work-list of all 95 offerable templates carrying stored verdict, resolution
path, line anchors, template text and full parameter domain. Each walked every stored `native` and `neutral`
cell in its column against the rubric first-hit-wins, and also recorded the forward direction for completeness.
Each was told the same thing about authority and about not adjudicating.

**(2) A deterministic citation auditor — the primary verification layer, and the strongest one.** Rather than
ask a model to check citations, every flag was verified mechanically by importing the live modules and
re-resolving each cell (`scratchpad/verify-citations.mjs`). For each flag it asserts:

1. `storedVerdict` equals what `getRuleCompatInfo(ruleId, archetype)` actually returns at HEAD;
2. `storedCellCitation` names the line that *actually decides* that cell — the override line if an override
   exists, else the `familyDefaults` line, else the fallthrough return at `:517` — which catches the classic
   error of citing a family default that an override supersedes, and citing another archetype's block;
3. `corpusCitation` falls inside that rule's own definition block in `forgeKnowledgeBase.js`;
4. `kernelClauseQuote` is verbatim-present at the cited constitution line (whitespace- and markdown-normalised,
   `...` elisions honoured in order);
5. the rule id is real and offerable;
6. any flag citing scan item 2 carries a non-empty parameter domain.

**All 167 flags pass all six checks.** The checker was itself validated with a negative control: four flags were
deliberately corrupted — a wrong stored verdict, a wrong anchor line, a corpus line outside the rule's block,
and a fabricated kernel quote — and it caught all four and returned clean again on restore. A checker that never
fails proves nothing; this one was shown to fail correctly.

**(3) An adversarial merits pass**, over the 46 highest-severity flags (every one predicting `core_conflict`, or
demoting a stored `native`), instructed to refute by default and forbidden from refuting on the stored map's own
authority. Scope and outcome are reported in §5 and §10; flags outside that subset carry citation verification
but not an independent merits challenge, and §10 says so plainly.

Scan items 8 and 9 were **not** delegated. They are set-comparison problems over the whole map — opposite-verdict
detection, all-neutral detection, pairwise text similarity, declared-conflict-pair convergence, and
family-membership checking — and were computed deterministically from the live modules, which is both more
reliable and reproducible.

Both reviewer roles, and every finder, were explicitly forbidden from refuting a flag using the stored map's own
header policies (P1/P2/P3), its `ZONE1_REFS` prose, or the frozen June-24 `ARCHETYPE_DEF` markdown docs — those
are the artifact under audit, not authority.

**Authority direction, stated once.** The stored map carries its own adjudication policies
(`src/data/archetypeRuleCompatibility.js:21-29` — P1 contrarian avoid-the-unloved, P2 "exits are Zone 2",
P3 classify-by-default-direction) and its own Zone-1 distillations (`:84-133`). Those are the *artifact under
audit*. The authority is the July-23 founder-approved kernels, their rubrics, and the Guide. Guide §10(c)
already records the direction of travel: the markdown `ARCHETYPE_DEF` docs the stored map cites as its
"CLASSIFICATION AUTHORITY" (`:15-17`) are **frozen June-24 extracts** whose overclaims are flagged for resync,
and the code zone-encoding plus registry snapshot are the corrected canonical pair
(`docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:109`).

---

## 3. Scope census — what "the full stored map" actually is

| Population | Count |
|---|---|
| Templates in the corpus (`FORGE_RULE_TEMPLATES`) | 143 |
| Archetype columns | 6 |
| Total stored cells | **858** |
| Templates OFFERABLE (`getSupportStatus` → `supported`) | **95** |
| Templates not offerable | 48 (20 `hidden_absent_substrate`, 1 `hidden_unwired`, 1 `deprecated`, 26 `mode_scrapped`) |
| **Offerable cells — the priority scope** | **570** |
| ├ stored `native` or `neutral` — **the reverse-direction population** | **524** |
| └ stored `core_conflict` | 46 |

Per-column, offerable only:

| Column | native | neutral | core_conflict | reverse-direction population | via override | via family | via **fallthrough** |
|---|---|---|---|---|---|---|---|
| `momentum_chaser` (Trend Follower) | 17 | 75 | 3 | 92 | 1 | 41 | 53 |
| `contrarian` | 8 | 68 | 19 | 76 | 10 | 39 | 46 |
| `degen` (Speculator) | 12 | 74 | 9 | 86 | 2 | 41 | 52 |
| `guardian` (Capital Preserver) | 17 | 66 | 12 | 83 | 23 | 35 | 37 |
| `analyst` (Fundamental Investor) | 6 | 87 | 2 | 93 | 4 | 38 | 53 |
| `diversifier` | 7 | 87 | 1 | 94 | 8 | 40 | 47 |
| **total** | **67** | **457** | **46** | **524** | **48** | **234** | **288** |

*(Counts machine-derived by importing `getRuleCompatInfo` and `getSupportStatus` at HEAD `178a8a09`. All 143
family-member ids, all 68 override ids, and all 48 support-status ids resolve to real corpus templates —
zero orphans.)*

---

## 4. Structural findings

These are not per-cell flags. They are properties of the map that determine how the founder should read the
flag table — and four of them are the mechanical explanation for why the reverse direction was
under-collected. **S1–S5 and S7 were verified by me directly, first-hand, at HEAD `178a8a09`.**

### S1 — The stored map cannot express `tension`. Half the case law has nowhere to land. (VERIFIED)

The kernel rubrics have **four** verdicts, applied first-hit-wins: `core_conflict` > `tension` > `native` >
`compatible` (`docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:12-18`, and the identical four-step rubric in each
constitution — e.g. `CONSTITUTION_CAPITAL_PRESERVER_V1.md:60-64`).

The stored map has **three** states and no `tension`:
`COMPAT_STATES = ['native', 'neutral', 'core_conflict']` (`src/data/archetypeRuleCompatibility.js:55`).

So every cell the kernel reads as `tension` must be stored as either `neutral` or `core_conflict`, and the
choice is unmarked. This is not cosmetic:

- Guide §1 (`:15`) and §4 (`:50-56`) make a `tension` verdict **require an authored treatment** —
  `narrowedParams` or `advisoryDowngrade`. A kernel-`tension` cell stored as `neutral` silently drops that
  requirement: the rule is admitted at full template bounds with no narrowing and no advisory demotion.
- The same cell stored as `core_conflict` over-blocks instead: `core_conflict` is the live block/warning
  predicate (`src/data/archetypeRuleCompatibility.js:522-527`, consumed at
  `src/components/Forge/workshop/BundleBuildFlow.jsx:196`).
- `neutral` is therefore doing two incompatible jobs — it stands for the kernel's `compatible` (genuinely
  orthogonal: liquidity hygiene, process rules) *and* for the kernel's `tension` (pushes against the identity,
  treatment owed). Nothing in the stored data distinguishes them.

**This is the single largest reason the reverse direction was under-collected.** The forward direction
(stored `core_conflict` → kernel `tension`) is visible: someone reads a block and asks why. The reverse
direction (stored `neutral` → kernel `tension`) is invisible by construction, because `neutral` is also the
correct answer for a third of the corpus. Eleven of the twelve docket flags run in the visible direction. That
ratio is a property of the schema, not of the corpus.

### S2 — Half the offerable map is not an authored verdict at all. (VERIFIED)

**288 of the 570 offerable cells (50.5%) resolve to `neutral` by fallthrough** — no override, no family
default, no authored decision anywhere (`src/data/archetypeRuleCompatibility.js:517`; across all 858 cells it
is 442, 51.5%). The entire map is decided by **132 explicit declarations**: 64 `familyDefaults` entries and 68
`ruleOverrides` entries.

The module names this design honestly — "fail-open: blocks/warnings key on explicit `core_conflict` only"
(`:489-491`) — and the fail-open default is the right call for a *blocking* surface. But Guide §1 is equally
explicit in the other direction: **"Absence discipline (Spec A-4): absence is not a verdict. Intentionally
universal rules receive an explicit `compatible` per archetype. The activation gate counts explicit cells
only."** (`docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:23`).

Reading those two together: on the guide's terms, 288 offerable cells have **no verdict**, and they are
currently indistinguishable from 288 authored `neutral` decisions. Any consumer that reads the resolved state
rather than the `via` field treats them as decided. Every flag in §5 marked `via=fallthrough` is a case where
the kernel demonstrably *does* have an opinion and the map has recorded none.

Per column, the fallthrough share of offerable cells is not uniform: `analyst` 53/95 and `momentum_chaser`
53/95 are the least-authored columns, `guardian` 37/95 the most-authored (23 of the map's 68 overrides are
guardian's). **`analyst` and `diversifier` also carry the thinnest conflict columns — 2 and 1 stored
`core_conflict` respectively across 95 offerable rules** — while their kernels carry two of the sharpest
explicit refusals in the set (FI's non-negotiable gate→trigger order, `CONSTITUTION_FUNDAMENTAL_INVESTOR_V1.md:23`
and `:59`; DV's "shape outranks selection", `docs/CONSTITUTION_DIVERSIFIER_V1.md:21` and `:54`). Thin conflict
column + majority-fallthrough column is the signature of under-collection, not of a permissive identity.

### S3 — Every stored verdict is inside the §2.3 `identityHash`. A one-cell fix is an identity change. (VERIFIED BY EXECUTION)

This is the finding most likely to change how the founder disposes of the docket, so it was proven rather than
argued.

`getArchetypeDefinition()` embeds the whole per-archetype compat block —
`compat: ARCHETYPE_RULE_COMPATIBILITY[codeId]` (`api/_utils/archetypeRegistry.js:120`) — and
`computeIdentityHash()` canonically hashes those definitions, stripping only `identityVersion` and
`physics.calibrationBundleVersion` (`api/_utils/archetypeRegistry.js:149-157`). `RULE_FAMILIES` and
`COMPAT_STATES` are hashed too, via `getRegistryCorpus()` (`:128-138`).

Executed proof, in-memory only, nothing written to disk:

```
committed snapshot hash : db5d95e863946c507469fbac4d88aab3d051327f2ce352075107031de3405654
computed hash at HEAD   : db5d95e863946c507469fbac4d88aab3d051327f2ce352075107031de3405654   → match
flip guardian.familyDefaults.profit_locking  native → neutral  (docket flag #8, ONE cell)
hash after flip         : 4ad687621c493eeb71da523a7db76b1cea9e1b68841b601acd71a6c6da36a840   → CHANGED
restored, hash re-verified identical
```

The consequences are all documented, and they chain:

1. `api/_utils/archetypeRegistry.test.js:102-109` — "FAILS when composed registry content changes without an
   `ARCHETYPE_IDENTITY_VERSION` bump", comparing `computeIdentityHash()` against the committed snapshot
   `docs/registry-snapshots/archetype-registry-identity-v1.json:3`. So a flagged-cell fix **fails CI** unless
   `ARCHETYPE_IDENTITY_VERSION` (`api/_utils/archetypeVersionConstants.js:54`, currently `1`) bumps and a new
   snapshot lands in the same commit.
2. Guide §1 (`docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:21`) — "**A kernel `identityVersion` bump invalidates its
   entire column and forces re-verdict**", and the activation gate counts only `status:'locked'` cells whose
   `kernelIdentityHash` matches the current registry hash.
3. `src/data/ruleSupportStatus.js:9-29` records this exact hazard as the reason *it* was built as a sibling map
   rather than a corpus field: adding a field to the hashed corpus would "invalidate every authored compat cell
   whose `kernelIdentityHash` was stamped against the old hash. That is a full matrix re-verdict … exactly the
   failure mode Amendment Sheet C item C-3 exists to prevent."

**Read together: disposing of this docket cell-by-cell, in separate commits, would re-invalidate the authored
702-cell matrix on each pass.** The 350 already-authored cells are the exposure. This argues for a single
batched disposition at one identityVersion bump, and it is a decision the founder needs before the first fix,
not after. Flagged for founder direction; not adjudicated here.

### S4 — A CI invariant actively resists the reverse direction. (VERIFIED)

`src/data/archetypeRuleCompatibility.test.js:213-230` — the STRICT seeded-rule invariant — asserts that **every
rule seeded by `ARCHETYPE_DEFAULT_TRAITS` classifies `native` or `neutral` for its archetype**, and its own
comment says a seeded `core_conflict` "fails the suite and **STOPs the build** — a human adjudicates seed map
vs classification."

Machine-computed at HEAD: that invariant covers **46 (archetype, rule) cells, 39 of them offerable** — 21
stored `native`, 18 stored `neutral`. Every one of those 39 cells is **CI-locked against reclassification to
`core_conflict`**, which is precisely the reverse direction this audit was commissioned to sweep.

The invariant has already steered a classification once, and the map says so in its own words: the July 3
close-out resolved the guardian `a-05`/`a-09` cells via the §E split **plus** "the mandatory seed-map fix:
`ARCHETYPE_DEFAULT_TRAITS.guardian` now seeds `trait-steady-anchor` instead of `trait-diversifier`, **so the
strict invariant passes by construction**" (`src/data/archetypeRuleCompatibility.js:459-465`).

That is a legitimate engineering move and it is *also* a documented instance of the tail wagging the dog. The
founder should know that for the 39 seeded cells, a reverse-direction flag has two possible dispositions — fix
the verdict (and change the seed) or fix the seed (and keep the verdict) — and the CI invariant will not let
the question go unanswered. Per-column seeded-cell counts: `momentum_chaser` 8, `degen` 8, `contrarian` 8,
`analyst` 8, `guardian` 8, `diversifier` 6.

Two side observations from the same computation, **reported for separate tasking, not fixed** (BUILD_RULES §3):
`ARCHETYPE_DEFAULT_TRAITS.diversifier` seeds four rules that are **not offerable** at HEAD (`tv-04`, `mb-05`,
`gs-05`, `gs-06` — all `hidden_absent_substrate`, `src/data/ruleSupportStatus.js:87,83,96,97`), and
`ARCHETYPE_DEFAULT_TRAITS.guardian` seeds `risk-single-stock-limit`, which is `deprecated`
(`src/data/ruleSupportStatus.js:168`) yet still carries an explicit stored `native`
(`src/data/archetypeRuleCompatibility.js:369`).

### S5 — Family curation is the highest-leverage error surface. (VERIFIED)

`RULE_FAMILIES` (`src/data/archetypeRuleCompatibility.js:168-230`) is eleven hand-curated id-lists, and a rule
belongs to **at most one** family (asserted by test). 234 of the 570 offerable cells — and 348 of all 858 — are
decided by family default rather than per-rule. So a single mis-filed rule id inherits that family's default in
**all six columns at once**, and the resolution order means it takes an explicit override in every column to
undo.

The map documents why the vocabulary forces this: "the tag vocabulary cannot express direction (Phase 0 §2.1),
so families are curated id-lists" (`:32-34`), which is also why `high_volatility` and `volatility_avoidance`
exist as separate families for what tags see as one topic (`:187-189`). The design is sound; the exposure is
that family membership is the load-bearing judgment and it is asserted nowhere except by hand. Scan item 9
(§5) tests membership against each member's real template text.

### S6 — Reliance is already live in `enforce` mode, and the enforcement surface only ever produces evidence in ONE direction. (VERIFIED)

The brief frames this audit as landing "before cells create reliance on the map." **The reliance already
exists.** `RULE_COMPAT_MODE = 'enforce'` at `src/config/featureFlags.js:595` — not `'off'`, not `'observe'`.

Consumers at HEAD:

| Consumer | What it does with the verdict | Citation |
|---|---|---|
| Equip/hardness write guard (5 paths: `create_rule`, `set_rule_hardness`, `update_rule_category`, `reforge_carry`, `equip_bundle`) | in `enforce`: **blocks** a write that would make a `core_conflict` rule must-obey; **warns** on soft conflict writes | `src/services/ruleCompatEvaluate.js:94-124`; paths enumerated `src/services/ruleCompatGuard.js:17-25`; server callers `api/agent/set-rule-hardness.js:156`, `api/agent/reforge-bundle.js:142`; client callers `src/components/Forge/workshop/BundleBuildFlow.jsx:151`, `src/components/Forge/StarterKit.jsx:436`, `src/hooks/useTraits.js:227` |
| Render-time "off-style" badge | shows only for `core_conflict` | `src/components/Forge/workshop/BundleBuildFlow.jsx:194-196` |
| Native-rule surface copy | reads `state === 'native'` | `src/utils/compatSurfaceCopy.js:68` |
| Compiler settings-change writer | **persists the resolved cell verbatim into the user build delta** (`compatCells[snap.id]`), stamped alongside `identityVersion` + `identityHash` | `api/_utils/compileOnSettingsChange.js:171-174`, `:160-161` |
| Cleanup sweep | classifies stored rule docs | `api/_utils/ruleCompatCleanup.js:90`, `:270` |
| Activation gate (A-4 completeness) | consumes only the `via:'fallthrough'` **absence** signal, not the verdict | `api/_utils/activationGate.js:12-16`, `:44` |
| Registry / identity hash | embeds the whole compat block in the hashed definition | `api/_utils/archetypeRegistry.js:120`, `:149-157` |

The module's `INVARIANT R` (`src/data/archetypeRuleCompatibility.js:9-13`) says the map "informs equip-path
warnings/blocks and render-time badges ONLY — never projection or prompts." **The negative half of that
invariant holds** — no fenced file, no `projectActiveRules.js`, neither prompt assembler imports it. **The
positive half is now understated:** the map is also read on four server paths and its verdicts are written into
persisted build documents. Not a violation; a stale header. Reported for separate tasking, not fixed.

**And here is the finding that explains the whole docket.** The enforcement kernel short-circuits on anything
that is not `core_conflict`, *before any event is built*:

```js
const info = getRuleCompatInfo(templateId, archetype);
if (info.state !== 'core_conflict') {
  return { decision: 'allow', state: info.state, zone1Ref: null, blockMessage: null, events: [] };
}
```
— `src/services/ruleCompatEvaluate.js:94-97`

So the two error directions have radically different observability:

- **A wrong `core_conflict` (over-block) is loud.** It emits `compat_conflict_equip` or
  `compat_promote_blocked` with the `zone1Ref` attached (`:104-117`), and in `enforce` + hard it produces a
  user-visible block with a message (`:120-124`, `RuleCompatBlockError`). Someone files a complaint.
- **A wrong `native` or `neutral` (silent permission) is unobservable by construction.** `decision: 'allow'`,
  `events: []`, no zone1Ref, no telemetry, no receipt. Nothing anywhere records that a rule which the kernel
  puts in tension was equipped at full template bounds with no treatment.

**Feedback exists in exactly one direction, so evidence accumulates in exactly one direction.** That is the
mechanical explanation for the docket's 11:1 skew, and it means the reverse direction cannot be found by
observation, complaint, or telemetry — only by the kind of deliberate both-directions sweep this audit is. It
also means the 39 seed-locked cells of S4 and the 288 fallthrough cells of S2 have never been tested by
anything.

### S7 — Root cause: the stored map was authored 20 days before the kernels existed, against an authority the guide has since superseded. (VERIFIED)

Not an excuse for the map and not a defect claim against it — it is the causal explanation for the whole
docket, and it predicts that the divergence is *systematic* rather than a scatter of authoring slips.

| Artifact | Date | What it says about its own authority |
|---|---|---|
| Stored compat map, adjudication close-out | **July 3, 2026** | "CLASSIFICATION AUTHORITY: each archetype's **Zone 1 statements in the six `ARCHETYPE_DEF_*_2026-06-24.md` docs**" (`src/data/archetypeRuleCompatibility.js:15-17`); the 30 draft cells "resolved by the Flash + Claude adjudication of July 3, 2026" (`:18-19`) |
| The six kernel constitutions | **July 23, 2026** | founder-approved kernels; six elements; per-archetype four-step rubric |
| Authoring Guide V1.1 | **July 23, 2026** | records that the June-24 DEF docs are **frozen extracts** whose overclaims ("real exclusion", "winners held") are flagged for resync, and that the code zone-encoding + registry snapshot are the corrected canonical pair (`docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:109`) |

The map's three governing policies (`:21-29`) were therefore written **before** the kernels that now judge
them, and at least two are in direct textual conflict with a July-23 kernel clause:

- **P2 — "exits are Zone 2: profit targets, trims, and stop management on an owned position are execution
  discipline (neutral) absent a separate Zone 1 hit"** (`:23-26`) versus Capital Preserver rubric step 2, which
  states the opposite **explicitly and by review id**: "**and, explicitly (R1-6): profit-target and
  eager-profit-taking rules land here as tension**, not core_conflict" (`CONSTITUTION_CAPITAL_PRESERVER_V1.md:62`).
  P2 says neutral; the kernel says tension-with-treatment. This is the mechanism behind docket flag #8
  (`th-05`/guardian) — and #8 was found only because a reviewer challenged it, which is why the brief treats
  this class as under-collected.
- **P3 — "param-swing rules classify by DEFAULT direction"** (`:27-29`) versus Guide §8 R1-8, which forbids
  exactly that: a rule whose domain spans identity-safe and identity-breaking values "has **no determinate
  first-hit verdict until its bounds exist**", and the verdict is tension + `narrowedParams` recording the
  admitted domain (`docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:91`). P3's own text concedes the point —
  "param-aware classification is the designated post-observe refinement" — and `PARAM_SWING_NOTES` (`:143-156`)
  documents the swing for exactly **two** rules of the 95 offerable.

Both conflicts are structural, so they generate flags in bulk rather than one at a time. §5 counts them.

---

---

## 5. FLAG TABLE

**153 surviving flags** across the 570 offerable cells. Columns: stored verdict → kernel-predicted verdict ·
scan item(s) · one-line mechanism reason. Every row carries three verified citations; the full parameter
domain is reproduced beneath any row whose scan items include **2**.

### 5.1 REVERSE DIRECTION — stored `native`/`neutral` that the kernel demotes

*The under-collected class the audit was commissioned to find: **141 cells**. The existing docket held two.*

#### Trend Follower `momentum_chaser` — 20 flags (0 from stored `native`)

| ruleId | stored → predicted | item(s) | mechanism reason | stored cell | kernel clause | corpus |
|---|---|---|---|---|---|---|
| `a-05` | neutral → tension | 1,4,5 | BOUNDED vs UNBOUNDED (Guide §8 line 91): anchors min=1 is un-zeroable, so no in-domain setting removes the mandated low-ATR (below 0.5-2.5% of price) holdings — the exact mirror of the stored map's own guardian a-05 reasoning ('the rocket mandate is un-zeroable (rockets min 1) → conflict', :360-365), which was never run in this column. | `archetypeRuleCompatibility.js:517 (fallthrough — no explicit momentum_chaser cell)` | `CONST_TREND_FOLLOWER:21` | `forgeKnowledgeBase.js:2212` |
| `a-07` | neutral → tension | 1,4,5 | GATE vs PREFERENCE (Guide §3 lines 44-48): 'Maintain at least {defensive} high-fundamental-score stocks' (min 1, fund_min up to 90) is a fundamental eligibility mandate over book slots — a fundamental gate, which Guide §2 line 31 rates tension for TF — and the same clause caps high-ATR growth names at {growth}. | `archetypeRuleCompatibility.js:245 (familyDefault fundamental_quality → neutral)` | `CONST_TREND_FOLLOWER:23` | `forgeKnowledgeBase.js:2266` |
| `alloc-even-spread` | neutral → tension | 1,5 | SECTOR vs NAME mirror: 'Spread allocation evenly across available sectors' with conviction='strong' makes equal sector weight override sector strength (evidencePriority item 2) at the book level — the portfolio-state axis of Guide §2 line 36, and the cell does not exist (fallthrough) even though guardian and diversifier both carry explicit natives for this rule. | `archetypeRuleCompatibility.js:517 (fallthrough — no explicit momentum_chaser cell)` | `CONST_TREND_FOLLOWER:19` | `forgeKnowledgeBase.js:547` |
| `alloc-sector-minimum` | neutral → tension | 1,5 | SECTOR vs NAME mirror: the stored 'concentration → neutral' default graded this on the concentration axis (which TF tolerates), but the kernel's clause is concentration IN STRENGTH — a standing 10-50% floor pinned to a named sector is strength-blind and can mandate weight in a sector outside the top-3 aperture, reversing evidencePriority item 2. | `archetypeRuleCompatibility.js:253 (familyDefault concentration → neutral)` | `CONST_TREND_FOLLOWER:5` | `forgeKnowledgeBase.js:502` |
| `alloc-tier-preference` | neutral → tension | 1,3 | BOUNDED vs UNBOUNDED (Guide §8 line 91): the attribute domain contains 'undervalued' and 'positive earnings surprise', which put a valuation/fundamental pick in the 2x Star slot, so the verdict must be tension + narrowedParams (momentum / relative strength / volume admitted) rather than a fallthrough neutral — the reverse-direction mirror of docket #2 on the same template. | `archetypeRuleCompatibility.js:517 (fallthrough — no explicit momentum_chaser cell)` | `CONST_TREND_FOLLOWER:27` | `forgeKnowledgeBase.js:525` |
| `gs-07` | neutral → tension | 1,3 | GATE vs PREFERENCE (Guide §3 lines 44-48): 'disable all offensive swaps' at a ceiling settable to 80 points is a hard freeze on the candidate flow to protect a lead — book-level defensive positioning, which rubric step 2 names explicitly — stored by fallthrough while guardian carries it as an explicit protective native (:377). | `archetypeRuleCompatibility.js:517 (fallthrough — no explicit momentum_chaser cell)` | `CONST_TREND_FOLLOWER:34` | `forgeKnowledgeBase.js:1092` |
| `gs-10` | neutral → tension ✓ | 1,3 | GATE vs PREFERENCE (Guide §3 lines 44-48): 'prohibit swapping into any bench stock with intraday P&L exceeding {atr} ATR' (atr 1.0-2.0) is a hard eligibility gate barring the day's strongest movers — refusing to pay up for confirmed strength, graded as a neutral anti-chase preference. | `archetypeRuleCompatibility.js:248 (familyDefault chase_avoidance → neutral)` | `CONST_TREND_FOLLOWER:31` | `forgeKnowledgeBase.js:1170` |
| `mb-01` | neutral → tension | 1 | BOUNDED vs UNBOUNDED (Guide §8 line 91): a minimum-hold floor settable to 180 minutes blocks brisk stall rotation for roughly half a battle — rubric step 2's own example 'extends holding beyond tape-tempo' — so the cell needs narrowedParams, not a fallthrough neutral. | `archetypeRuleCompatibility.js:517 (fallthrough — no explicit momentum_chaser cell)` | `CONST_TREND_FOLLOWER:67` | `forgeKnowledgeBase.js:576` |
| `mb-07` | neutral → tension | 1 | BOUNDED vs UNBOUNDED (Guide §8 line 91): swaps min=1 with freeze up to 90 minutes fires the anti-churn circuit breaker after a SINGLE swap, contradicting the fired-wire brisk forced rotation (8/60min) the timeDoctrine names as itself made deterministic. | `archetypeRuleCompatibility.js:517 (fallthrough — no explicit momentum_chaser cell)` | `CONST_TREND_FOLLOWER:37` | `forgeKnowledgeBase.js:703` |
| `mb-11` | neutral → tension | 1 | BOUNDED vs UNBOUNDED (Guide §8 line 91): cutting the swap hurdle by up to 75% is rubric step 2's own example 'loosens confirmation', and the same clause instructs entry on 5-minute MACD DIVERGENCE — a turn signal, not confirmed strength — so the cell needs narrowedParams or advisoryDowngrade rather than silence. | `archetypeRuleCompatibility.js:517 (fallthrough — no explicit momentum_chaser cell)` | `CONST_TREND_FOLLOWER:31` | `forgeKnowledgeBase.js:806` |
| `r-06` | neutral → tension | 1,5 | SECTOR vs NAME mirror: 'Limit portfolio to maximum of {max} stocks from any single sector' with max=1 in-domain forces a six-sector book, dissolving the top-3 strength aperture the kernel calls a feature — a book-scoped hard cap reaching TF by fallthrough with no cell and no bounds. | `archetypeRuleCompatibility.js:517 (fallthrough — no explicit momentum_chaser cell)` | `CONST_TREND_FOLLOWER:34` | `forgeKnowledgeBase.js:2032` |
| `r-09` | neutral → tension ⟳ | 1,3,4 | GATE vs PREFERENCE (Guide §3 lines 44-48): 'shift to defensive mode with low-ATR stocks only' is a hard exclusion gate that inverts the atrPercentile-0.25 priority (quiet over moving) and installs exactly the defensive positioning the riskDoctrine hands off to the user's levers; trigger pct floor is 5%, so it binds routinely. | `archetypeRuleCompatibility.js:517 (fallthrough — no explicit momentum_chaser cell)` | `CONST_TREND_FOLLOWER:34` | `forgeKnowledgeBase.js:2108` |
| `risk-sector-diversification` | neutral → tension | 1,5 | SECTOR vs NAME mirror (a book-scoped rule judged against a sector-scoped kernel clause): 'Diversify across at least {n} sectors' with n up to 6 mandates holdings outside the deliberately narrow top-3 aperture, and there is no explicit cell at all — absence is not a verdict (Guide §1 line 23). | `archetypeRuleCompatibility.js:517 (fallthrough — no explicit momentum_chaser cell)` | `CONST_TREND_FOLLOWER:34` | `forgeKnowledgeBase.js:365` |
| `tech-rsi-overbought` | neutral → tension ⟳ | 1,3 | GATE vs PREFERENCE (Guide §3 lines 44-48): the strictMode toggle ('Hard exclusion mode', default false, corpus line 70) converts the deprioritization into an eligibility gate that hard-excludes extended names at a threshold as low as RSI 60 — the sharpest gate-shaped rule in this column, stored as a neutral chase-avoidance tilt with no treatment. | `archetypeRuleCompatibility.js:248 (familyDefault chase_avoidance → neutral)` | `CONST_TREND_FOLLOWER:20` | `forgeKnowledgeBase.js:67` |
| `th-05` | neutral → tension | 1,6 | BOUNDED vs UNBOUNDED (Guide §8 line 91) on an exit mechanism: trail TIGHTENING to atr min 0.1 (hint: 'extremely tight') forces an exit while both legs still hold, so only the 0.4 end of the domain is kernel-safe — the stored P2 'exits are Zone 2' policy (:249-251) suppressed the treatment, the same cell mis-graded in the other direction as docket #8. | `archetypeRuleCompatibility.js:251 (familyDefault profit_locking → neutral)` | `CONST_TREND_FOLLOWER:37` | `forgeKnowledgeBase.js:1277` |
| `th-10` | neutral → tension ✓ | 1,6 | BOUNDED vs UNBOUNDED (Guide §8 line 91): the posture domain contains 'Harvest (many +15s)' — 'swap stocks after BaggerBomb for fresh candidates', a mandated sale of a working chart — so classifying by the 'Balanced' default (stored policy P3, :27-29) is precisely the full-domain judgment R1-8 forbids. | `archetypeRuleCompatibility.js:517 (fallthrough — no explicit momentum_chaser cell)` | `CONST_TREND_FOLLOWER:15` | `forgeKnowledgeBase.js:1379` |
| `ts-01` | neutral → tension | 1,4 | GATE vs PREFERENCE (Guide §3 lines 44-48) applied to the wrong evidence relationship: a hard tier cap ('restrict its maximum tier to Support', trigger settable to 150%) strips the multiplier from precisely the swinging name atrPercentile 0.25 ranks highest, so a vol cap is not orthogonal for TF the way the stored volatility_avoidance default assumes. | `archetypeRuleCompatibility.js:247 (familyDefault volatility_avoidance → neutral)` | `CONST_TREND_FOLLOWER:21` | `forgeKnowledgeBase.js:1408` |
| `ts-05` | neutral → tension | 1,6 | BOUNDED vs UNBOUNDED (Guide §8 line 91) on a profit-protection mechanism wearing tier-hygiene clothes: at rsi=65 in-domain, every winner that hits a bonus while extended loses its 2x multiplier, deprioritizing exactly the extension baggerBombFit ranks at 0.30 — and the cell was never authored at all. | `archetypeRuleCompatibility.js:517 (fallthrough — no explicit momentum_chaser cell)` | `CONST_TREND_FOLLOWER:20` | `forgeKnowledgeBase.js:1511` |
| `tv-10` | neutral → tension | 1,3,4 | GATE vs PREFERENCE (Guide §3 lines 44-48) plus the deprioritized-evidence test (Guide §2 line 31: 'a fundamental gate on TF = tension'): a name with a strong chart but fund_score below the floor (settable to 85) is 'restricted to Core or below', so priority-6 fundamentals veto tier placement earned by priority-1 evidence. | `archetypeRuleCompatibility.js:245 (familyDefault fundamental_quality → neutral, with the 'Deliberately neutral' comment at :243-245)` | `CONST_TREND_FOLLOWER:23` | `forgeKnowledgeBase.js:2617` |
| `tv-15` | neutral → tension | 1,6 | PREFERENCE vs OVERRIDE (Guide §2 line 31) on the exit side: 'swap it out within {evals} evaluations' makes a scoring event override the two-leg holding test — a mandated unilateral exit with no broken leg — and the stored high_volatility family default graded the rule off its high-ATR replacement clause, not its liquidation clause. | `archetypeRuleCompatibility.js:246 (familyDefault high_volatility → neutral)` | `CONST_TREND_FOLLOWER:28` | `forgeKnowledgeBase.js:2756` |

#### Contrarian `contrarian` — 18 flags (1 from stored `native`)

| ruleId | stored → predicted | item(s) | mechanism reason | stored cell | kernel clause | corpus |
|---|---|---|---|---|---|---|
| `risk-exit-atr-stop` | **native → tension** ⚖ | 1,6 | Distinction 3 in mirror (a stored 'native' is wrong if an extreme in-domain value breaks the kernel): the cell is native across a select domain running to '-3x ATR (very wide)', while Guide §4 line 53 fixes this exact template's Contrarian bounds as 'tight default, scalpel bounds' against Speculator's wide ones — the native owes paramBounds over a subset, not the whole domain. | `archetypeRuleCompatibility.js:309` | `CONST_CONTRARIAN:30` | `forgeKnowledgeBase.js:431` |
| `gs-09` | neutral → core_conflict ✓ | 1,5,6 | Distinction 1 (preference vs override) crossed with ITEM 5 scope: a PORTFOLIO-level P&L streak is made an override of the NAME-level stop, force-ejecting the worst performer — which for an archetype that 'accepts being early — buying into continued decline down to a defined stop' (line 27) is systematically its freshest, deepest dislocation — before that name's pre-declared line is reached. | `archetypeRuleCompatibility.js:279` | `CONST_CONTRARIAN:38` | `forgeKnowledgeBase.js:1145` |
| `mb-03` | neutral → core_conflict ✓ | 1,6 | Distinction 1 (preference vs override): mb-03 is the Guide §1 line 19 canonical rotate-out-of-stalls rule and this kernel denies the mechanism by name — a forced exit on a 45-150 minute movement clock reverses a timeDoctrine whose evidence horizon is 'weeks, not days', so the forced_trading familyDefault's blanket neutral is a silent permission against the archetype's own doctrine. | `archetypeRuleCompatibility.js:279` | `CONST_CONTRARIAN:33` | `forgeKnowledgeBase.js:601` |
| `mb-15` | neutral → core_conflict ✓ | 1,6 | Distinction 1 (preference vs override) applied to exits: below-VWAP persistence is made an OVERRIDE of the pre-declared stop ('regardless of tier'), forcing a panic-exit before the line on precisely the washed-out, below-VWAP names the kernel buys — a thesis-invalidation exit graded as if it were the mechanical stop (ITEM 6). | `archetypeRuleCompatibility.js:517` | `CONST_CONTRARIAN:38` | `forgeKnowledgeBase.js:908` |
| `t-16` | neutral → core_conflict ✓ | 1,3,4 | Distinction 4 (gate vs preference, Guide §3 lines 40-48): 'Only select stocks where at least {count} of these are bullish' is an eligibility gate, and the in-domain '3 of 3' setting makes RSI 50-70 AND above-VWAP mandatory entry conditions — name-level momentum as a required positive signal, categorically excluding every oversold candidate the archetype exists to buy. | `archetypeRuleCompatibility.js:517` | `CONST_CONTRARIAN:58` | `forgeKnowledgeBase.js:1820` |
| `tv-03` | neutral → core_conflict ✓ | 1,4 | Distinction 1 (preference vs override): this is not a tilt but a conditioned instruction — it requires a daily technical score above 45-80 (a confirmed uptrend) and then states 'This is a buying opportunity', i.e. buy the pullback in a name that has already run, strictly stronger than tech-moving-average-trend which the same column stores core_conflict at line 271. | `archetypeRuleCompatibility.js:517` | `CONST_CONTRARIAN:36` | `forgeKnowledgeBase.js:2426` |
| `tv-15` | neutral → core_conflict ✓ | 1,3,6 | Distinction 4 (gate vs preference) split across a compound rule: the harvest leg (swap out after a banked threshold) is rubric-step-3 native, but the replacement leg gates re-entry on 'RSI above {rsi} and above VWAP' — a washed-out name is below VWAP by construction — so grading the compound on its harvest leg alone is the ITEM 6 conflation. | `archetypeRuleCompatibility.js:276` | `CONST_CONTRARIAN:58` | `forgeKnowledgeBase.js:2756` |
| `f-12` | neutral → tension ⟳ | 1,3,4 | Distinction 4 (gate vs preference): the second clause 'Avoid deteriorating consensus' is a categorical NAME-level avoidance of the out-of-favour — the exact shape the map itself scores core_conflict one scope-level out at r-12 (sector sentiment, line 291) and i-02 (institutional distribution, line 292) — while the first clause buys only after the analyst crowd has begun forgiving. | `archetypeRuleCompatibility.js:278` | `CONST_CONTRARIAN:27` | `forgeKnowledgeBase.js:1976` |
| `gs-02` | neutral → tension | 1,6 | Distinction 3 (bounded vs unbounded) on the stop family: the EARLY multiplier runs to 3.0x, so the constitutive line becomes a clock-scaled variable rather than pre-declared — stop WIDENING and stop TIGHTENING graded as one mechanism (ITEM 6) when the rubric makes tightening native (line 60) and widening a patience extension past stop discipline (line 59). | `archetypeRuleCompatibility.js:517` | `CONST_CONTRARIAN:30` | `forgeKnowledgeBase.js:962` |
| `mb-04` | neutral → tension | 1,3,4 | Distinction 4 (gate vs preference) plus distinction 3 (bounded vs unbounded, Guide §8 line 91): 'Only swap if the bench stock's intraday performance exceeds the active stock's' is an entry gate on the incoming name's relative strength — defensible as turn confirmation at the 0.25 ATR floor, but at the 1.0 ATR ceiling it is name-level relative strength as an entry requirement, so the full-domain verdict is tension + narrowedParams, never a bare fallthrough neutral. | `archetypeRuleCompatibility.js:517` | `CONST_CONTRARIAN:59` | `forgeKnowledgeBase.js:627` |
| `mb-08` | neutral → tension ⟳ | 1,6 | Distinction 1 (preference vs override), verified against the real template: 'Do not swap any stock with positive P&L until it reaches the {threshold} scoring threshold' carries NO stop or emergency carve-out (unlike mb-01/mb-07/gs-01 which do), so it holds every in-profit position past its trailing stop and inverts the errorPreference that 'accepts leaving upside on the table by selling strength back too soon' (line 27). | `archetypeRuleCompatibility.js:517` | `CONST_CONTRARIAN:38` | `forgeKnowledgeBase.js:730` |
| `r-09` | neutral → tension | 1,5 | Distinction 4 (gate vs preference) on a book-scoped trigger: 'shift to defensive mode with low-ATR stocks only' is a hard eligibility gate, not a tilt, and it is the verbatim behaviour rubric step 2 names ('pushes toward defensive positioning') while inverting evidencePriority 4 (bounce energy, line 20) exactly when drawdown makes dislocation deepest. | `archetypeRuleCompatibility.js:517` | `CONST_CONTRARIAN:30` | `forgeKnowledgeBase.js:2108` |
| `risk-sector-diversification` | neutral → tension | 1,5 | Distinction 2 in mirror (sector vs name — a BOOK-scoped rule judged against a NAME-scoped kernel): at the in-domain maximum n=6 in a six-pick book every pick must come from a different sector, overriding evidencePriority 1 ('Depth of dislocation in the name') with the imposed cage the riskDoctrine names and rejects; same class as alloc-sector-cap, alloc-even-spread, r-06, r-07 and alloc-sector-minimum, all stored neutral in this column. | `archetypeRuleCompatibility.js:517` | `CONST_CONTRARIAN:30` | `forgeKnowledgeBase.js:365` |
| `tech-macd-bullish` | neutral → tension ✓ | 1,4 | Distinction 3 (bounded vs unbounded, Guide §8 line 91): the stored override's own reasoning ('MACD bullish crossover is TURN detection') holds only for the 'bullish crossover' option at the rsiFloor minimum, but the domain also offers 'above zero line' with rsiFloor up to 65 — established name-level momentum in a bullish regime, not a turn — and the param hint ('55+ filters out weak bounces') filters out exactly the bounces this archetype buys. | `archetypeRuleCompatibility.js:286` | `CONST_CONTRARIAN:59` | `forgeKnowledgeBase.js:136` |
| `th-04` | neutral → tension | 1,6 | ITEM 6 exit-mechanism conflation under distinction 1 (preference vs override): stop WIDENING (0.3-1.0 ATR added 'to chase the next threshold tier') is a different mechanism from the trail TIGHTENING the same column stores native at th-05 (line 270), and the neutral is reached only via the map's own P2 'exits are Zone 2' policy (lines 24-26), which the kernel's coreRefusal at line 38 ('no holding past it') overrides. | `archetypeRuleCompatibility.js:517` | `CONST_CONTRARIAN:59` | `forgeKnowledgeBase.js:1251` |
| `ts-02` | neutral → tension | 1,3 | Distinction 4 (gate vs preference): 'A stock is only eligible for Star tier if its Daily Technical Score is above {score} AND price is above daily VWAP' is an eligibility gate on name strength (Amendment C-5 makes book-state conditions eligibility_constraint material), and a washed-out name is below VWAP by construction — so the archetype can never place its own thesis pick in the 2x slot. | `archetypeRuleCompatibility.js:517` | `CONST_CONTRARIAN:59` | `forgeKnowledgeBase.js:1434` |
| `ts-04` | neutral → tension ⟳ | 1,4 | ITEM 4 wrong-test: for a counter-indicative relationship the Guide §2 line 32 conflict test is 'making it a positive signal at any weight', and ts-04 makes 1-4 cycles of relative P&L velocity the SOLE determinant of the 2x multiplier — the forced_trading familyDefault graded it on churn frequency instead of on the evidence relationship (the narrower rubric-step-1 'entry signal' reading would land tension). | `archetypeRuleCompatibility.js:279` | `CONST_CONTRARIAN:22` | `forgeKnowledgeBase.js:1485` |
| `tv-05` | neutral → tension ⟳ | 1,3 | Distinction 4 (gate vs preference): 'only select it if the MACD histogram is {direction}' converts a squeeze screen into a hard entry gate on positive name-level momentum, and all three domain options (positive / positive-and-growing / turning-positive) require non-negative MACD — the high_volatility familyDefault graded the squeeze half and never read the gate half. | `archetypeRuleCompatibility.js:276` | `CONST_CONTRARIAN:58` | `forgeKnowledgeBase.js:2477` |

#### Speculator `degen` — 17 flags (1 from stored `native`)

| ruleId | stored → predicted | item(s) | mechanism reason | stored cell | kernel clause | corpus |
|---|---|---|---|---|---|---|
| `t-12` | **native → tension** ✓ | 1 | BOUNDED vs UNBOUNDED (Guide §8 line 91) — the pct domain runs 5–25th percentile of Bollinger Band Width, so every in-domain value selects inside the compression band and none selects a name that is actually swinging; rubric step 2 'pushes toward lower volatility bands' fires before step 3. | `archetypeRuleCompatibility.js:315` | `CONST_SPECULATOR:55` | `forgeKnowledgeBase.js:1719` |
| `a-05` | neutral → core_conflict ✓ | 1,5 | BOUNDED vs UNBOUNDED (Guide §8 line 91) — anchors has min=1, so no in-domain setting removes the mandated low-ATR leg; the stored override's defence rests on the frozen June-24 DEF prose ('degen's own doc sanctions as Zone-2 machinery') that the kernel corrects. | `archetypeRuleCompatibility.js:333` | `CONST_SPECULATOR:27` | `forgeKnowledgeBase.js:2212` |
| `r-09` | neutral → core_conflict ✓ | 1,3 | GATE vs PREFERENCE (Guide §3 line 48) — 'low-ATR stocks only' is a categorical eligibility exclusion on the volatility axis fired by a fear trigger, reaching 'neutral' by pure fallthrough (absence is not a verdict, Guide §1 line 23). | `archetypeRuleCompatibility.js:517` | `CONST_SPECULATOR:27` | `forgeKnowledgeBase.js:2108` |
| `alloc-sector-minimum` | neutral → tension ✓ | 1,5 | SECTOR vs NAME in mirror (Contrarian case law applied inversely) plus BOUNDED vs UNBOUNDED — a sector-scoped standing mandate judged against a name-scoped refusal is not conflict, but the in-domain extreme (Utilities / Consumer Staples at 50%) mandates the low-volatility cohort, so tension + narrowedParams, not neutral. | `archetypeRuleCompatibility.js:325` | `CONST_SPECULATOR:33` | `forgeKnowledgeBase.js:502` |
| `alloc-tier-preference` | neutral → tension | 1,4 | BOUNDED vs UNBOUNDED (Guide §8 line 91) — two in-domain attribute options ('undervalued', 'positive earnings surprise') admit excluded-type fundamental evidence as the selection basis for the 2x Star slot, which for an EXCLUDED relationship is the sharp test (Guide §2 line 33), so tension + narrowedParams, not fallthrough neutral. | `archetypeRuleCompatibility.js:517` | `CONST_SPECULATOR:19` | `forgeKnowledgeBase.js:525` |
| `fund-market-cap` | neutral → tension | 1,4 | PREFERENCE vs OVERRIDE (Guide §2 line 31) — a size preference never claims to outrank the ATR sort, so it is tension rather than conflict, but its default ('large') selects the structurally calmest cohort and the rule is corpus-categorised `fundamental`, so a fallthrough 'neutral' is silent permission on the archetype's dominant axis. | `archetypeRuleCompatibility.js:517` | `CONST_SPECULATOR:55` | `forgeKnowledgeBase.js:339` |
| `gs-07` | neutral → tension | 1 | GATE vs PREFERENCE (Guide §3 line 48) — 'disable all offensive swaps' is a categorical shutdown of the volatility hunt on a score trigger, not a hurdle tweak, and it is the defensive-positioning conversion rubric step 2 names. | `archetypeRuleCompatibility.js:517` | `CONST_SPECULATOR:55` | `forgeKnowledgeBase.js:1092` |
| `gs-10` | neutral → tension | 1,3 | GATE vs PREFERENCE (Guide §3 line 48) — 'prohibit swapping into' is a hard eligibility exclusion, not a ranking tilt, and it excludes precisely the most-extended bench names during the highest-opportunity window, inverting evidence priority #2. | `archetypeRuleCompatibility.js:324` | `CONST_SPECULATOR:17` | `forgeKnowledgeBase.js:1170` |
| `mb-01` | neutral → tension | 1 | BOUNDED vs UNBOUNDED (Guide §8 line 91) — a 15-minute hold floor is survivable but the in-domain 180-minute floor nullifies the forced-rotation physics, so the verdict is tension + narrowedParams, never a silent 'neutral' by fallthrough. | `archetypeRuleCompatibility.js:517` | `CONST_SPECULATOR:30` | `forgeKnowledgeBase.js:576` |
| `mb-07` | neutral → tension | 1 | BOUNDED vs UNBOUNDED (Guide §8 line 91) — at the in-domain extreme (1 swap / 120-minute window / 90-minute freeze) the rule disables rather than tunes the churn of the archetype whose live wires run forcedRotation ON at 12 evaluations/60min, so rubric step 2 fires before step 3's churn-tuning native. | `archetypeRuleCompatibility.js:517` | `CONST_SPECULATOR:30` | `forgeKnowledgeBase.js:703` |
| `mb-08` | neutral → tension | 1,6 | GATE vs PREFERENCE (Guide §3 line 48) — 'Do not swap' is a hard exit-block, not a ranking tilt; ITEM 6: a profit-target-shaped hold mandate graded as if it were ordinary exit discipline under stored policy P2. | `archetypeRuleCompatibility.js:517` | `CONST_SPECULATOR:30` | `forgeKnowledgeBase.js:730` |
| `r-08` | neutral → tension ⟳ | 1,5 | BOUNDED vs UNBOUNDED (Guide §8 line 91) — 'Maintain at least {anchors} large-cap' has anchors min=1 and caps small-caps at sails max=3, so the stability mandate is un-zeroable across the whole domain; a book-shape rule reached by fallthrough with no cell at all. | `archetypeRuleCompatibility.js:517` | `CONST_SPECULATOR:33` | `forgeKnowledgeBase.js:2082` |
| `r-11` | neutral → tension | 1,5 | BOUNDED vs UNBOUNDED (Guide §8 line 91) — 'Any tier (unrestricted)' is identity-safe but 'Support' caps the book's single highest-ATR mandatory asset, and the second clause ('During drawdowns, limit to major coins only') is the fear-to-defensive conversion of rubric step 2. | `archetypeRuleCompatibility.js:517` | `CONST_SPECULATOR:55` | `forgeKnowledgeBase.js:2158` |
| `tech-rsi-overbought` | neutral → tension | 1,3,4 | GATE vs PREFERENCE (Guide §3 line 48) — the strictMode toggle ('Hard exclusion mode') converts an avoid-preference into a hard eligibility exclusion, and at threshold min=60 it excludes exactly the stretched, live-move names that are the kernel's evidence priority #2. | `archetypeRuleCompatibility.js:324` | `CONST_SPECULATOR:17` | `forgeKnowledgeBase.js:67` |
| `th-10` | neutral → tension | 1,6 | BOUNDED vs UNBOUNDED (Guide §8 line 91) — the 'Hunt (few +50s)' option instructs 'hold for deeper milestones', an identity-breaking in-domain value that the stored default-direction policy P3 (default 'Balanced') hides; ITEM 6: threshold-banking posture graded as a generic process setting. | `archetypeRuleCompatibility.js:517` | `CONST_SPECULATOR:30` | `forgeKnowledgeBase.js:1379` |
| `ts-07` | neutral → tension | 1,5,6 | PREFERENCE vs OVERRIDE (Guide §2 line 31) — a tier demotion is not an exit, so it does not reverse the exit-floor doctrine (hence tension, not conflict), but it installs a second fear-triggered de-risking layer the kernel forecloses; ITEM 6: multiplier de-risking graded as if it were stop management under stored policy P2. | `archetypeRuleCompatibility.js:517` | `CONST_SPECULATOR:27` | `forgeKnowledgeBase.js:1562` |
| `tv-03` | neutral → tension | 1 | BOUNDED vs UNBOUNDED (Guide §8 line 91) — 'increase hold patience to {minutes}' spans 60–240 minutes and the rule text explicitly reclassifies a stalled move as 'a buying opportunity, not an exit signal', which is the kernel's grace-period refusal inverted. | `archetypeRuleCompatibility.js:517` | `CONST_SPECULATOR:30` | `forgeKnowledgeBase.js:2426` |

#### Capital Preserver `guardian` — 22 flags (2 from stored `native`)

| ruleId | stored → predicted | item(s) | mechanism reason | stored cell | kernel clause | corpus |
|---|---|---|---|---|---|---|
| `mb-09` | **native → tension** ✓ | 1,2,4,6 | BOUNDED vs UNBOUNDED (Guide §8 line 91) — at the -0.5 ATR end of the domain the ejection fires inside CP's noise band, and 'regardless of tier or hold time' overrides every patience layer; Guide §2 line 38 caps it at tension. | `archetypeRuleCompatibility.js:388` | `CONST_CAPITAL_PRESERVER:62` | `forgeKnowledgeBase.js:755` |
| `th-05` | **native → tension** ✓ | 1,2,6 | BOUNDED vs UNBOUNDED — every in-domain trailing value (0.1–0.4 ATR) is tighter than the +1.0×ATR stepped-trail line CP:37 names as the threshold source, so the gain-lock fires on sub-threshold price action. | `archetypeRuleCompatibility.js:340` | `CONST_CAPITAL_PRESERVER:62` | `forgeKnowledgeBase.js:1277` |
| `tv-13` | neutral → core_conflict ✓ | 1,2,3 | PREFERENCE vs OVERRIDE (Guide §2 line 31) — the template states the volume signal 'overrides other technical signals' and installs a minimum tier (Star option), so momentum outranks the quality and volatility layers rather than tilting a ranking. | `archetypeRuleCompatibility.js:344` | `CONST_CAPITAL_PRESERVER:61` | `forgeKnowledgeBase.js:2701` |
| `a-06` | neutral → tension | 1,2,3 | GATE vs PREFERENCE (Guide §3 lines 40-48) — 'Star and Core only for top {pct}% RS' is an eligibility gate on the multiplier tiers keyed to CP's last-ranked evidence, and intendedMode cannot be silently reread as a ranking. | `archetypeRuleCompatibility.js:344` | `CONST_CAPITAL_PRESERVER:20` | `forgeKnowledgeBase.js:2240` |
| `a-09` | neutral → tension | 1,2 | BOUNDED vs UNBOUNDED — high_upside runs to 2, so the full domain provisions two high-ATR breakout candidates; the stored §E note applies param-awareness only at the zero end of the same domain. | `archetypeRuleCompatibility.js:366` | `CONST_CAPITAL_PRESERVER:61` | `forgeKnowledgeBase.js:2318` |
| `alloc-sector-minimum` | neutral → tension | 1,2,5 | BOUNDED vs UNBOUNDED — pct reaches 50, putting half the book in one named sector and dissolving the spread protection layer that alloc-sector-cap and r-06 (both stored native) exist to hold. | `archetypeRuleCompatibility.js:348` | `CONST_CAPITAL_PRESERVER:17` | `forgeKnowledgeBase.js:502` |
| `alloc-tier-preference` | neutral → tension | 1,2 | PREFERENCE vs OVERRIDE (Guide §2 line 31) — the default attribute is 'high momentum' for the 2x slot; because it orders rather than admits it lands at tension not core_conflict, but the stored 'neutral' (fallthrough, no explicit cell) drops the required treatment. | `archetypeRuleCompatibility.js:517` | `CONST_CAPITAL_PRESERVER:20` | `forgeKnowledgeBase.js:525` |
| `fund-market-cap` | neutral → tension | 1,2 | BOUNDED vs UNBOUNDED — the size domain includes 'small' (<$2B), inverting the small-cap ceiling that r-08 (stored native) exists to impose on the same book. | `archetypeRuleCompatibility.js:517` | `CONST_CAPITAL_PRESERVER:15` | `forgeKnowledgeBase.js:339` |
| `gs-02` | neutral → tension | 1,2,4,6 | BOUNDED vs UNBOUNDED — the FINAL_HOUR multiplier bottoms at 0.5x, halving the patient stop on the clock rather than on damage; both named step-2 drifts (clock-aware, noise-tight stop) fire together. | `archetypeRuleCompatibility.js:517` | `CONST_CAPITAL_PRESERVER:62` | `forgeKnowledgeBase.js:962` |
| `gs-03` | neutral → tension | 1,2 | BOUNDED vs UNBOUNDED — 40% per phase transition compounds to ~78% hurdle removal across EARLY→FINAL_HOUR, loosening the entry-bar protection layer purely on the clock. | `archetypeRuleCompatibility.js:517` | `CONST_CAPITAL_PRESERVER:62` | `forgeKnowledgeBase.js:990` |
| `gs-09` | neutral → tension | 1,2,4,6 | BOUNDED vs UNBOUNDED — at cycles=3 a forced ejection fires on a P&L streak breaching none of CP:37's lines; the stored note 'persistent bleed is not noise' is precisely the author judgment call the executable-threshold rule removes. | `archetypeRuleCompatibility.js:355` | `CONST_CAPITAL_PRESERVER:37` | `forgeKnowledgeBase.js:1145` |
| `mb-11` | neutral → tension | 1,2,4 | BOUNDED vs UNBOUNDED — a 75% hurdle cut triggered by the clock, with 5-minute MACD divergence as the evaluation trigger, lowers the highest-entry-bar identity on sub-threshold price action. | `archetypeRuleCompatibility.js:517` | `CONST_CAPITAL_PRESERVER:41` | `forgeKnowledgeBase.js:806` |
| `mb-12` | neutral → tension | 1,2 | BOUNDED vs UNBOUNDED — 30%/hour compounding from 12:00 PM erases the swap hurdle by the close; the mechanism is clock-aware rotation with no damage or fundamental input. | `archetypeRuleCompatibility.js:517` | `CONST_CAPITAL_PRESERVER:62` | `forgeKnowledgeBase.js:832` |
| `r-11` | neutral → tension | 1,2 | BOUNDED vs UNBOUNDED — the tier domain includes 'Any tier (unrestricted)', which converts a containment rule into removal of the volatility ceiling on the mandatory crypto asset. | `archetypeRuleCompatibility.js:517` | `CONST_CAPITAL_PRESERVER:62` | `forgeKnowledgeBase.js:2158` |
| `th-08` | neutral → tension | 1,2 | BOUNDED vs UNBOUNDED — at minutes=15 a fifteen-minute stall strips the hold protection; this is the un-forced form of the kernel's own core_conflict worked example (rotate out of what has not moved). | `archetypeRuleCompatibility.js:517` | `CONST_CAPITAL_PRESERVER:61` | `forgeKnowledgeBase.js:1328` |
| `th-10` | neutral → tension | 1,2,6 | BOUNDED vs UNBOUNDED — the posture domain contains 'Harvest', whose template clause ('swap stocks after BaggerBomb for fresh candidates') is verbatim the eager-profit-taking disposition R1-6 places in tension; the same harvest mechanism in tv-15 is stored core_conflict. | `archetypeRuleCompatibility.js:517` | `CONST_CAPITAL_PRESERVER:62` | `forgeKnowledgeBase.js:1379` |
| `ts-05` | neutral → tension | 1,2,6 | BOUNDED vs UNBOUNDED — rsi bottoms at 65, so the gain-locking demotion (corpus tag 'profit-taking', 'scale-out') fires on a mild 5-minute RSI print after a bonus. | `archetypeRuleCompatibility.js:517` | `CONST_CAPITAL_PRESERVER:62` | `forgeKnowledgeBase.js:1511` |
| `ts-06` | neutral → tension | 1,2 | BOUNDED vs UNBOUNDED — at pct=0.05% over 2 cycles the flatline test fires on ordinary quiet, and the stored 'sells nothing' defence omits that the 2x multiplier is reassigned to the most active name. | `archetypeRuleCompatibility.js:357` | `CONST_CAPITAL_PRESERVER:61` | `forgeKnowledgeBase.js:1536` |
| `ts-08` | neutral → tension | 1,4 | PREFERENCE vs OVERRIDE — a declining 5-minute MACD histogram forces a demotion outright rather than tilting a ranking, letting sub-threshold price action drive action on a position at a new intraday high. | `archetypeRuleCompatibility.js:517` | `CONST_CAPITAL_PRESERVER:37` | `forgeKnowledgeBase.js:1588` |
| `tv-02` | neutral → tension | 1,2,4,6 | BOUNDED vs UNBOUNDED — the action domain includes 'flag for swap', converting a shrinking-but-still-positive 5-minute histogram into an exit trigger on sub-threshold price action. | `archetypeRuleCompatibility.js:344` | `CONST_CAPITAL_PRESERVER:37` | `forgeKnowledgeBase.js:2397` |
| `tv-12` | neutral → tension | 1,3 | GATE vs PREFERENCE (Guide §3 lines 40-48) — Star/Core/Support is assigned by a three-factor momentum/volume/technical gate with no quality or volatility input, allocating the exposure multiplier by CP's last priority. | `archetypeRuleCompatibility.js:517` | `CONST_CAPITAL_PRESERVER:20` | `forgeKnowledgeBase.js:2673` |
| `tv-14` | neutral → tension ✓ | 1,2 | SECTOR vs NAME — the rotation trigger is sector-scoped while CP's forcedRotation-OFF refusal is position-scoped, which blocks core_conflict but not the step-2 clock-aware drift ('adjust within {evals} evaluations', evals as low as 1). | `archetypeRuleCompatibility.js:344` | `CONST_CAPITAL_PRESERVER:62` | `forgeKnowledgeBase.js:2730` |

<details><summary><strong>Full parameter domains</strong> — the 20 item-2 flags in this column (verbatim)</summary>

- `mb-09` — atr: number default=-1 min=-1.5 max=-0.5 step=0.1 unit=ATR
- `th-05` — tier: select default="Star" options=["Star" "Star only", "Star and Core" "Star and Core", "Any tier" "Any tier"] · atr: number default=0.2 min=0.1 max=0.4 step=0.05 unit=ATR
- `tv-13` — mult: number default=2 min=1.5 max=3 step=0.1 unit=x · tier: select default="Core" options=["Star" "Star minimum", "Core" "Core minimum"]
- `a-06` — rs_min: number default=15 min=10 max=22 step=1 unit=/22 · pct: number default=25 min=10 max=50 step=5 unit=%
- `a-09` — complement: number default=2 min=1 max=3 step=1 · high_upside: number default=1 min=0 max=2 step=1
- `alloc-sector-minimum` — sector: select default="Technology" options=["Technology", "Healthcare", "Financials", "Energy", "Consumer Discretionary", "Consumer Staples", "Industrials", "Materials", "Real Estate", "Communication Services", "Utilities"] · pct: number default=20 min=10 max=50 step=5 unit=%
- `alloc-tier-preference` — attribute: select default="high momentum" options=["high momentum" "High momentum", "undervalued" "Undervalued", "high relative strength" "High relative strength", "high volume" "High volume", "positive earnings surprise" "Positive earnings surprise"]
- `fund-market-cap` — size: select default="large" options=["large" "Large cap (>$10B)", "mid" "Mid cap ($2-10B)", "small" "Small cap (<$2B)"]
- `gs-02` — early: number default=2 min=1.5 max=3 step=0.5 unit=x · mid: number default=1.5 min=1 max=2 step=0.5 unit=x · late: number default=1.2 min=1 max=1.5 step=0.1 unit=x · final: number default=1 min=0.5 max=1.5 step=0.1 unit=x
- `gs-03` — pct: number default=20 min=10 max=40 step=5 unit=%
- `gs-09` — cycles: number default=4 min=3 max=6 step=1
- `mb-11` — time: select default="3:00 PM" options=["2:30 PM" "2:30 PM (early)", "3:00 PM" "3:00 PM (standard)", "3:30 PM" "3:30 PM (late)"] · pct: number default=50 min=25 max=75 step=25 unit=%
- `mb-12` — pct: number default=15 min=5 max=30 step=5 unit=% · start: select default="1:00 PM" options=["12:00 PM" "12:00 PM (early)", "1:00 PM" "1:00 PM (standard)", "2:00 PM" "2:00 PM (late)"]
- `r-11` — tier: select default="Support" options=["Support" "Support (safest)", "Core" "Core (moderate)", "Any" "Any tier (unrestricted)"]
- `th-08` — atr: number default=0.15 min=0.05 max=0.3 step=0.05 unit=ATR · minutes: number default=45 min=15 max=90 step=15 unit=min
- `th-10` — posture: select default="Balanced" options=["Harvest (many +15s)" "Harvest (many +15s)", "Hunt (few +50s)" "Hunt (few +50s)", "Balanced" "Balanced (adaptive)"]
- `ts-05` — rsi: number default=75 min=65 max=85 step=5 unit=RSI
- `ts-06` — pct: number default=0.1 min=0.05 max=0.3 step=0.05 unit=% · cycles: number default=3 min=2 max=5 step=1
- `tv-02` — action: select default="reduce tier" options=["reduce tier" "Reduce tier", "flag for swap" "Flag for swap", "hold but monitor" "Hold but monitor"]
- `tv-14` — max_pct: number default=40 min=25 max=60 step=5 unit=% · evals: number default=2 min=1 max=4 step=1 unit=evals

</details>

#### Fundamental Investor `analyst` — 24 flags (1 from stored `native`)

| ruleId | stored → predicted | item(s) | mechanism reason | stored cell | kernel clause | corpus |
|---|---|---|---|---|---|---|
| `tv-10` | **native → tension** ✓ | 1,2 | BOUNDED vs UNBOUNDED, mirror form (Guide §8 line 91): fund_score min=40 places the dual-confirmation bar at the outright-refusal floor, so a name scoring 40-70 reaches Star on technical strength — the 'chart heat' path the kernel names — and the trailing clause still admits technical-only names at Core. | `archetypeRuleCompatibility.js:395` | `CONST_FUNDAMENTAL_INVESTOR:16` | `forgeKnowledgeBase.js:2617` |
| `tv-13` | neutral → core_conflict ✓ | 1,2,3,4 | PREFERENCE vs OVERRIDE (Guide §2 line 31): the template says the volume spike 'overrides other technical signals' and assigns a minimum TIER (Star available in-domain), so tape is not ordering candidates but setting the book's core with zero quality input. | `archetypeRuleCompatibility.js:400` | `CONST_FUNDAMENTAL_INVESTOR:59` | `forgeKnowledgeBase.js:2701` |
| `a-05` | neutral → tension ✓ | 1,2,5 | PORTFOLIO-STATE AXIS (Guide §2 line 36, mirror form): the rule fixes book composition by ATR bucket, so up to three roster slots are reserved for names selected on realized volatility with no quality input reaching the selection at all. | `archetypeRuleCompatibility.js:517` | `CONST_FUNDAMENTAL_INVESTOR:16` | `forgeKnowledgeBase.js:2212` |
| `a-06` | neutral → tension | 1,2,3 | GATE vs PREFERENCE (Guide §3 lines 40-48): clause 1 is a ranking tilt but clause 2, 'Star and Core only for top {pct}% RS', is an eligibility gate that defines the book's core by relative strength with quality never consulted. | `archetypeRuleCompatibility.js:400` | `CONST_FUNDAMENTAL_INVESTOR:23` | `forgeKnowledgeBase.js:2240` |
| `alloc-sector-minimum` | neutral → tension | 1,2,5 | PORTFOLIO-STATE AXIS (Guide §2 line 36, mirror form): a standing sector floor of up to 50% obliges allocation into a named sector regardless of whether any name there clears the admission test, which is the kernel's named failure mode of dropping the standard to find action. | `archetypeRuleCompatibility.js:405` | `CONST_FUNDAMENTAL_INVESTOR:41` | `forgeKnowledgeBase.js:502` |
| `alloc-tier-preference` | neutral → tension | 1,2 | BOUNDED vs UNBOUNDED (Guide §8 line 91): three of five in-domain attributes ('high momentum' — the default — plus 'high relative strength' and 'high volume') set the 2x Star slot on tape alone; only 'undervalued' and 'positive earnings surprise' are quality-led, so the verdict is tension + narrowedParams, not silent neutral. | `archetypeRuleCompatibility.js:517` | `CONST_FUNDAMENTAL_INVESTOR:20` | `forgeKnowledgeBase.js:525` |
| `gs-07` | neutral → tension | 1,2 | BOUNDED vs UNBOUNDED (Guide §8 line 91) on the CP-drift axis: at ceiling=80 pts 'disable all offensive swaps' suspends opportunity-cost rotation for most of the battle, which is the unclocked-patience drift the rubric names, not orthogonal process hygiene. | `archetypeRuleCompatibility.js:517` | `CONST_FUNDAMENTAL_INVESTOR:25` | `forgeKnowledgeBase.js:1092` |
| `i-06` | neutral → tension | 1,4 | EVIDENCE-RELATIONSHIP (Guide §2 line 31, deprioritized type): FI admits momentum only as a timing input, so making crowding-because-it-amplifies-intraday-moves the positive selection reason outranks quality — the identical mechanism the same file stores as core_conflict for i-09 at :413. | `archetypeRuleCompatibility.js:400` | `CONST_FUNDAMENTAL_INVESTOR:20` | `forgeKnowledgeBase.js:2944` |
| `mb-01` | neutral → tension | 1,2 | BOUNDED vs UNBOUNDED (Guide §8 line 91) on the CP-drift axis: at minutes=180 the roster is frozen for roughly half a one-day battle, which pushes patience past the kernel's battle-clock bound; the low end of the domain is fine, so the treatment is narrowedParams. | `archetypeRuleCompatibility.js:517` | `CONST_FUNDAMENTAL_INVESTOR:60` | `forgeKnowledgeBase.js:576` |
| `mb-11` | neutral → tension | 1,2 | BOUNDED vs UNBOUNDED (Guide §8 line 91) on the TF-drift axis: at pct=75 the swap bar is cut by three quarters while the bench candidates it then admits are selected on a 5-minute MACD divergence — technical-led entry with the standard lowered to find action. | `archetypeRuleCompatibility.js:517` | `CONST_FUNDAMENTAL_INVESTOR:60` | `forgeKnowledgeBase.js:806` |
| `mb-15` | neutral → tension | 1,6 | EXIT-MECHANISM CONFLATION: the rule names a VWAP position as 'the thesis is broken' and forces an exit 'regardless of tier', converting chart deterioration into a thesis exit — the exact side of FI's two-sided exit disposition the kernel reserves for business deterioration. | `archetypeRuleCompatibility.js:517` | `CONST_FUNDAMENTAL_INVESTOR:31` | `forgeKnowledgeBase.js:908` |
| `t-11` | neutral → tension | 1,2,3 | GATE vs PREFERENCE (Guide §3 lines 40-48): the second clause 'Avoid stocks below {floor}' is an exclusion gate keyed to relative strength, so weak technicals veto a name whose quality thesis is intact — the kernel's conflict rule says they may not. | `archetypeRuleCompatibility.js:400` | `CONST_FUNDAMENTAL_INVESTOR:24` | `forgeKnowledgeBase.js:1693` |
| `t-12` | neutral → tension | 1 | PREFERENCE vs OVERRIDE (Guide §2 line 31): volatility compression is made the selection reason with no quality precondition — a preference rather than an override, so tension not conflict, but the high_volatility family default at :398 buries it as neutral while two other members of that same family (i-09, tv-15) carry analyst core_conflict overrides. | `archetypeRuleCompatibility.js:398` | `CONST_FUNDAMENTAL_INVESTOR:60` | `forgeKnowledgeBase.js:1719` |
| `t-15` | neutral → tension | 1,2 | PREFERENCE vs OVERRIDE (Guide §2 line 31): NR7 range compression plus a technical score is the entire selection rule; at score=50 the technical bar is weak and quality is absent from the whole domain. | `archetypeRuleCompatibility.js:398` | `CONST_FUNDAMENTAL_INVESTOR:60` | `forgeKnowledgeBase.js:1795` |
| `tech-bollinger-squeeze` | neutral → tension | 1 | PREFERENCE vs OVERRIDE (Guide §2 line 31): band-compression percentile is the whole selection basis, so momentum/volatility evidence outranks quality in the ordering without claiming to override it — rubric step 2 TF drift. | `archetypeRuleCompatibility.js:398` | `CONST_FUNDAMENTAL_INVESTOR:60` | `forgeKnowledgeBase.js:90` |
| `th-05` | neutral → tension | 1,2,6 | BOUNDED vs UNBOUNDED (Guide §8 line 91) on the profit side of the exit split: at atr=0.1 with tier='Any tier' the post-bonus trail ejects a name whose quality and setup both still hold, on ordinary noise — the kernel's explicit 'does not scalp a working thesis'. The stored map reaches neutral via header policy P2 (exits are Zone 2), which the kernel's own exit disposition contradicts. | `archetypeRuleCompatibility.js:403` | `CONST_FUNDAMENTAL_INVESTOR:35` | `forgeKnowledgeBase.js:1277` |
| `th-10` | neutral → tension ✓ | 1,2,6 | BOUNDED vs UNBOUNDED (Guide §8 line 91): the in-domain 'Harvest' posture is the tv-15 mechanism — recycle a name the moment it books a bonus — and tv-15 is stored core_conflict for this same archetype at :411, so a fallthrough neutral over the whole domain drops the required treatment. | `archetypeRuleCompatibility.js:517` | `CONST_FUNDAMENTAL_INVESTOR:35` | `forgeKnowledgeBase.js:1379` |
| `ts-02` | neutral → tension | 1,3 | GATE vs PREFERENCE (Guide §3 lines 40-48): 'only eligible for Star tier if its Daily Technical Score is above {score} AND price is above daily VWAP' is a technical eligibility gate on the book's core, with quality demoted to nothing at all. | `archetypeRuleCompatibility.js:517` | `CONST_FUNDAMENTAL_INVESTOR:23` | `forgeKnowledgeBase.js:1434` |
| `ts-04` | neutral → tension | 1,2 | EVIDENCE-RELATIONSHIP (Guide §2 line 31): P&L velocity alone re-assigns the 2x Star multiplier on a 15-minute cycle, so the conviction expression in the book is set by the move rather than by the work — momentum outranking quality inside the tiering decision. | `archetypeRuleCompatibility.js:404` | `CONST_FUNDAMENTAL_INVESTOR:40` | `forgeKnowledgeBase.js:1485` |
| `tv-01` | neutral → tension | 1 | EVIDENCE-RELATIONSHIP (Guide §2 line 31): the corpus description states the rule 'seeks stocks already moving', making an RSI band the selection reason rather than a timing filter on already-qualified names. | `archetypeRuleCompatibility.js:400` | `CONST_FUNDAMENTAL_INVESTOR:20` | `forgeKnowledgeBase.js:2369` |
| `tv-02` | neutral → tension | 1,2,6 | BOUNDED vs UNBOUNDED (Guide §8 line 91) applied to the exit split: the in-domain action 'flag for swap' turns MACD deceleration into an exit trigger, while 'hold but monitor' does not — the mechanism is acceptable only on a subset, which is tension + narrowedParams. | `archetypeRuleCompatibility.js:400` | `CONST_FUNDAMENTAL_INVESTOR:31` | `forgeKnowledgeBase.js:2397` |
| `tv-11` | neutral → tension | 1 | EVIDENCE-RELATIONSHIP (Guide §2 line 31): proximity to a 52-week high is a pure price-level momentum criterion promoted to the selection reason, with the corpus text justifying it by the momentum buyers it attracts rather than by the business. | `archetypeRuleCompatibility.js:400` | `CONST_FUNDAMENTAL_INVESTOR:40` | `forgeKnowledgeBase.js:2647` |
| `tv-12` | neutral → tension | 1,3 | GATE vs PREFERENCE (Guide §3 lines 40-48): tier is fully determined by a count of three technical factors — quality never enters the tiering decision, so the book's core is assigned by chart rather than by the admission test. | `archetypeRuleCompatibility.js:517` | `CONST_FUNDAMENTAL_INVESTOR:16` | `forgeKnowledgeBase.js:2673` |
| `tv-14` | neutral → tension | 1,5 | SECTOR vs NAME: the sector-overweight and sector-cap clauses are book-scoped and orthogonal, but 'select the stock with the highest RS vs SPY score' is a NAME-level selection rule resolved entirely on momentum rank with no quality precondition. | `archetypeRuleCompatibility.js:400` | `CONST_FUNDAMENTAL_INVESTOR:20` | `forgeKnowledgeBase.js:2730` |

<details><summary><strong>Full parameter domains</strong> — the 15 item-2 flags in this column (verbatim)</summary>

- `tv-10` — fund_score: number default=65 min=40 max=85 step=5 unit=/100 · tech_score: number default=60 min=40 max=80 step=5 unit=/100 · tier: select default="Star" options=["Star" "Star eligible", "Core" "Core max"]
- `tv-13` — mult: number default=2 min=1.5 max=3 step=0.1 unit=x · tier: select default="Core" options=["Star" "Star minimum", "Core" "Core minimum"]
- `a-05` — anchors: number default=2 min=1 max=3 step=1 · rockets: number default=2 min=1 max=3 step=1 · low_pct: number default=1.5 min=0.5 max=2.5 step=0.5 unit=% · high_pct: number default=3.5 min=2.5 max=5 step=0.5 unit=%
- `a-06` — rs_min: number default=15 min=10 max=22 step=1 unit=/22 · pct: number default=25 min=10 max=50 step=5 unit=%
- `alloc-sector-minimum` — sector: select default="Technology" options=["Technology", "Healthcare", "Financials", "Energy", "Consumer Discretionary", "Consumer Staples", "Industrials", "Materials", "Real Estate", "Communication Services", "Utilities"] · pct: number default=20 min=10 max=50 step=5 unit=%
- `alloc-tier-preference` — attribute: select default="high momentum" options=["high momentum" "High momentum", "undervalued" "Undervalued", "high relative strength" "High relative strength", "high volume" "High volume", "positive earnings surprise" "Positive earnings surprise"]
- `gs-07` — ceiling: number default=150 min=80 max=300 step=10 unit=pts · atr: number default=0.2 min=0.1 max=0.5 step=0.1 unit=ATR
- `mb-01` — minutes: number default=60 min=15 max=180 step=15 unit=min
- `mb-11` — time: select default="3:00 PM" options=["2:30 PM" "2:30 PM (early)", "3:00 PM" "3:00 PM (standard)", "3:30 PM" "3:30 PM (late)"] · pct: number default=50 min=25 max=75 step=25 unit=%
- `t-11` — score: number default=15 min=10 max=22 step=1 unit=/22 · floor: number default=8 min=0 max=15 step=1 unit=/22
- `t-15` — score: number default=70 min=50 max=90 step=5 unit=/100
- `th-05` — tier: select default="Star" options=["Star" "Star only", "Star and Core" "Star and Core", "Any tier" "Any tier"] · atr: number default=0.2 min=0.1 max=0.4 step=0.05 unit=ATR
- `th-10` — posture: select default="Balanced" options=["Harvest (many +15s)" "Harvest (many +15s)", "Hunt (few +50s)" "Hunt (few +50s)", "Balanced" "Balanced (adaptive)"]
- `ts-04` — interval: number default=30 min=15 max=60 step=15 unit=min · cycles: number default=2 min=1 max=4 step=1
- `tv-02` — action: select default="reduce tier" options=["reduce tier" "Reduce tier", "flag for swap" "Flag for swap", "hold but monitor" "Hold but monitor"]

</details>

#### Diversifier `diversifier` — 40 flags (2 from stored `native`)

| ruleId | stored → predicted | item(s) | mechanism reason | stored cell | kernel clause | corpus |
|---|---|---|---|---|---|---|
| `alloc-sector-cap` | **native → tension** ✓ | 1,2 | BOUNDED vs UNBOUNDED, R1-8 mirror (Guide §8 line 91): a stored 'native' fails if an extreme in-domain value breaks the kernel — pct runs to 80% and defaults to 40%, both above the ≈35% engine cap, and because the archetype cap is inject-only-if-no-user-rule (DV:6, DV:69) equipping this rule DISPLACES the ≈35% default rather than tightening it. | `archetypeRuleCompatibility.js:446` | `CONST_DIVERSIFIER:35` | `forgeKnowledgeBase.js:479` |
| `r-06` | **native → tension** ✓ | 1,2 | BOUNDED vs UNBOUNDED, R1-8 mirror (Guide §8 line 91): max=3 of a ~6-slot book is 50%, past the ≈35% cap whose stated semantics are `sectorConcentrationCap: 2` = max 2 of ~6 slots (DV:68); only max≤2 is native. | `archetypeRuleCompatibility.js:444` | `CONST_DIVERSIFIER:35` | `forgeKnowledgeBase.js:2032` |
| `a-08` | neutral → core_conflict ✓ | 1,5 | SECTOR vs NAME (Guide §2 line 36 portfolio-state axis): a standing sector overweight is scoped to exactly the portfolio state DV's kernel governs, so the scope that makes it softer for Contrarian (docket #3) makes it a direct kernel reversal here. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:34` | `forgeKnowledgeBase.js:2293` |
| `mb-03` | neutral → core_conflict ✓ | 1,5,6 | EXIT-MECHANISM CONFLATION plus clock-trigger: a timed forced rotation of flat names ejects exactly the unexciting holdings the kernel says it accepts, and triggers rebalancing on a clock rather than on concentration drift. | `archetypeRuleCompatibility.js:433` | `CONST_DIVERSIFIER:30` | `forgeKnowledgeBase.js:601` |
| `mb-15` | neutral → core_conflict ✓ | 1,5,6 | EXIT-MECHANISM CONFLATION: a mandated thesis-break exit ("regardless of tier", and by construction regardless of shape) is the exact disposition the kernel forbids on the loss side, and it lets a name-level signal rewrite the book's composition. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:31` | `forgeKnowledgeBase.js:908` |
| `r-09` | neutral → core_conflict ✓ | 1,3,5 | GATE vs PREFERENCE (Guide §3 lines 40-48): "low-ATR stocks only" is a volatility ceiling imposed as an entry gate, adopted precisely as the answer to uncertainty — the kernel names this as Capital Preserver's identity, not Diversifier's. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:36` | `forgeKnowledgeBase.js:2108` |
| `th-09` | neutral → core_conflict ✓ | 1,5 | PORTFOLIO-STATE axis (Guide §2 line 36): the ejection candidate is chosen purely by name merit with no shape term, so a sector's only holding can be ejected — selection outranking shape at the exact decision the kernel reserves for shape. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:21` | `forgeKnowledgeBase.js:1354` |
| `tv-14` | neutral → core_conflict ✓ | 1,2,5 | BOUNDED vs UNBOUNDED (Guide §8 line 91) plus SECTOR-scope: the rule both mandates a standing sector overweight and writes a single-sector ceiling of up to 60% (default 40%), above the archetype's ≈35% hard cap. | `archetypeRuleCompatibility.js:428` | `CONST_DIVERSIFIER:35` | `forgeKnowledgeBase.js:2730` |
| `tv-15` | neutral → core_conflict ✓ | 1,5,6 | EXIT-MECHANISM CONFLATION plus refill-by-merit: the exit is P&L-triggered and the replacement is chosen as the highest-ATR momentum bench name with no sector term, so both sides of the swap are decided by name merit against shape. | `archetypeRuleCompatibility.js:426` | `CONST_DIVERSIFIER:17` | `forgeKnowledgeBase.js:2756` |
| `a-05` | neutral → tension | 1,2,5 | PORTFOLIO-STATE axis (Guide §2 line 36): a volatility-barbell composition mandate, un-zeroable on both legs (anchors min 1, rockets min 1, up to 3+3 of ~6 slots), makes ATR bucket rather than sector the slot criterion — a second book-shape axis competing with spread. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:19` | `forgeKnowledgeBase.js:2212` |
| `a-06` | neutral → tension ✓ | 1,2,3 | GATE vs PREFERENCE (Guide §3 lines 40-48): an absolute RS-vs-SPY floor (rs_min up to 22/22) plus a tier gate restricted to the top 10% of RS — an absolute rather than within-sector screen, so laggard sectors go unfillable at the top of the domain. | `archetypeRuleCompatibility.js:428` | `CONST_DIVERSIFIER:63` | `forgeKnowledgeBase.js:2240` |
| `a-07` | neutral → tension | 1,2,5 | PORTFOLIO-STATE axis (Guide §2 line 36): a book-level composition mandate on a NON-SHAPE axis — up to 4 of ~6 slots reserved for names clearing a fundamental floor up to 90/100 — competes with sector fill for the same slots and pushes toward defensive positioning. | `archetypeRuleCompatibility.js:429` | `CONST_DIVERSIFIER:36` | `forgeKnowledgeBase.js:2266` |
| `f-12` | neutral → tension | 1,3 | GATE vs PREFERENCE (Guide §3 lines 40-48): the "Avoid deteriorating consensus" clause is a categorical exclusion bolted onto a preference, and analyst downgrade waves cluster by sector. | `archetypeRuleCompatibility.js:429` | `CONST_DIVERSIFIER:55` | `forgeKnowledgeBase.js:1976` |
| `fund-bank-pb` | neutral → tension | 1,2,3,5 | GATE vs PREFERENCE at explicit SECTOR scope: the only single-sector screen in the corpus — at threshold=1.0 P/B nearly every bank is flagged expensive, so Financials specifically becomes unfillable, the rubric's sector-starvation case in its purest form. | `archetypeRuleCompatibility.js:429` | `CONST_DIVERSIFIER:55` | `forgeKnowledgeBase.js:295` |
| `fund-value-pe` | neutral → tension | 1,2,3 | BOUNDED vs UNBOUNDED (Guide §8 line 91): the default "sector median" is the relative-within-sector form the kernel prescribes and is safe, but the absolute options ("P/E below 15") make high-multiple sectors unfillable — tension + narrowedParams, not neutral across the whole domain. | `archetypeRuleCompatibility.js:425` | `CONST_DIVERSIFIER:63` | `forgeKnowledgeBase.js:273` |
| `gs-01` | neutral → tension | 1 | PORTFOLIO-STATE axis: disabling swap evaluation for the whole EARLY phase except on a per-name ATR drop suspends the shape read during the phase where draft-time concentration is most likely to be present (the kernel's own scope-honesty note, DV:70). | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:55` | `forgeKnowledgeBase.js:937` |
| `gs-07` | neutral → tension | 1,6 | EXIT-MECHANISM CONFLATION plus extended patience: disabling all offensive swaps above a score ceiling, with the sole exception a per-name Crash proximity, replaces the shape-driven trim with a P&L-driven lock and pushes toward defensive positioning. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:55` | `forgeKnowledgeBase.js:1092` |
| `gs-08` | neutral → tension | 1,2,6 | EXIT-MECHANISM CONFLATION plus extended patience: a winning streak is typically one sector running, and this rule multiplies the swap hurdle by up to 5x precisely then — suppressing the cap-driven trim at the moment cap discipline is needed. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:27` | `forgeKnowledgeBase.js:1118` |
| `gs-09` | neutral → tension ✓ | 1,5,6 | EXIT-MECHANISM CONFLATION: a cycle-counted P&L trigger forces the ejection of the worst-performing name — both the trigger (a clock/cycle count, not concentration drift) and the ejection criterion (name performance, not shape) are the wrong axis for this kernel. | `archetypeRuleCompatibility.js:433` | `CONST_DIVERSIFIER:30` | `forgeKnowledgeBase.js:1155` |
| `i-02` | neutral → tension | 1,3,5 | GATE vs PREFERENCE (Guide §3 lines 40-48): the corpus calls it a "Hard filter that excludes stocks from the draftable universe … a Level 1 filter", and institutional distribution clusters by sector, so a rotating-out sector becomes unfillable — the indirect spread break. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:55` | `forgeKnowledgeBase.js:2838` |
| `i-06` | neutral → tension | 1,5 | PORTFOLIO-STATE axis (Guide §2 line 36): deliberately targeting crowded hedge-fund trades concentrates hidden correlated exposure by theme — the exact failure the stored DV native i-05 (shared-holder overlap guard) exists to block, so the two cells point opposite ways. | `archetypeRuleCompatibility.js:428` | `CONST_DIVERSIFIER:24` | `forgeKnowledgeBase.js:2944` |
| `i-07` | neutral → tension | 1,4,5 | PREFERENCE vs OVERRIDE (Guide §2 line 31) at SECTOR scope: it substitutes "which sectors are receiving institutional inflow" for the kernel's sector criterion ("does this name fill an under-represented sector"), but as a stated preference rather than an override it stops short of a full reversal. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:17` | `forgeKnowledgeBase.js:2975` |
| `mb-01` | neutral → tension | 1,2 | PORTFOLIO-STATE axis (Guide §2 line 36): a clock-based hold lock of up to 180 minutes suspends the drift read that enforces the cap, with the only escape hatch a per-name Bust proximity — patience extended past cap discipline. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:30` | `forgeKnowledgeBase.js:576` |
| `mb-04` | neutral → tension ⟳ | 1,3,5 | GATE vs PREFERENCE (Guide §3 lines 40-48): a name-merit performance hurdle is made a precondition on ALL swaps, so a shape-correcting swap is blocked unless the incoming name also out-performs — merit gating shape. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:21` | `forgeKnowledgeBase.js:627` |
| `mb-06` | neutral → tension | 1,2,5 | PORTFOLIO-STATE axis (Guide §2 line 36): tier — a pure merit ranking — is made a multiplier (up to 3x) on the swap hurdle, so the higher a name's merit the harder shape can move it; merit resisting shape. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:21` | `forgeKnowledgeBase.js:677` |
| `mb-07` | neutral → tension | 1,2 | PORTFOLIO-STATE axis: a churn circuit-breaker disables non-emergency evaluation for up to 90 minutes, and a cap-drift rebalance is by definition non-emergency — patience extended past cap discipline. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:55` | `forgeKnowledgeBase.js:703` |
| `mb-08` | neutral → tension ⟳ | 1,6 | EXIT-MECHANISM CONFLATION on the profit side: a hard block on trimming any positive-P&L name until a scoring threshold overrides the cap-driven trim, i.e. it permits the running sector to be held through the cap. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:31` | `forgeKnowledgeBase.js:730` |
| `mb-09` | neutral → tension | 1,6 | EXIT-MECHANISM CONFLATION: a hard per-name ATR stop that "overrid[es] all other hold rules" installs positional risk control where the kernel states risk is structural and the cap is the ONE hard risk parameter. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:27` | `forgeKnowledgeBase.js:765` |
| `r-08` | neutral → tension | 1,2,5 | PORTFOLIO-STATE axis (Guide §2 line 36): a market-cap composition mandate (up to 4 of ~6 slots reserved for large caps) is a second book-shape axis competing with sector fill for the same slots. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:21` | `forgeKnowledgeBase.js:2082` |
| `r-12` | neutral → tension ⟳ | 1,2,3,5 | GATE vs PREFERENCE (Guide §3 lines 40-48) at SECTOR scope: a categorical sector-level exclusion removes whole sectors from the book, i.e. it answers risk by narrowing the field — concentration wearing a defensive costume. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:27` | `forgeKnowledgeBase.js:2183` |
| `risk-avoid-declining-trend` | neutral → tension | 1,3,5 | GATE vs PREFERENCE (Guide §3 lines 40-48): a categorical avoid-the-downtrend exclusion at sector-correlated granularity is the rubric's named sector-starvation case; same family and same mechanism as tech-avoid-declining. | `archetypeRuleCompatibility.js:430` | `CONST_DIVERSIFIER:55` | `forgeKnowledgeBase.js:453` |
| `risk-exit-atr-stop` | neutral → tension | 1,6 | EXIT-MECHANISM CONFLATION: same per-name stop mechanism as mb-09 — a positional risk line, and the exit trigger is P&L rather than shape; note the stored map gave this rule an explicit native override for contrarian and guardian but left the DV cell a bare fallthrough. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:27` | `forgeKnowledgeBase.js:441` |
| `t-11` | neutral → tension | 1,2,3 | GATE vs PREFERENCE (Guide §3 lines 40-48) with the domain load-bearing: the "Avoid stocks below {floor}" clause is an ABSOLUTE cross-market strength floor (up to 15/22), the exact opposite of the relative-within-sector form the kernel prescribes so no sector becomes unfillable. | `archetypeRuleCompatibility.js:428` | `CONST_DIVERSIFIER:63` | `forgeKnowledgeBase.js:1693` |
| `t-16` | neutral → tension | 1,2,3 | GATE vs PREFERENCE (Guide §3 lines 40-48): "Only select stocks where at least {count} …" is an explicit conjunctive admission gate, and the "3 of 3 (strict)" option makes whole sectors unfillable at once. | `archetypeRuleCompatibility.js:517` | `CONST_DIVERSIFIER:55` | `forgeKnowledgeBase.js:1820` |
| `tech-avoid-declining` | neutral → tension | 1,3,5 | GATE vs PREFERENCE (Guide §3 lines 40-48): the corpus gloss is "automatically exclude stocks trading below their long-term moving average"; sectors trend together, so a sector in a sustained downtrend becomes entirely unfillable. | `archetypeRuleCompatibility.js:430` | `CONST_DIVERSIFIER:55` | `forgeKnowledgeBase.js:213` |
| `tech-moving-average-trend` | neutral → tension | 1,3,5 | GATE vs PREFERENCE (Guide §3 lines 40-48): template says "Prefer" but the corpus gloss is "filter out stocks trading below their moving average, keeping only those with confirmed uptrend momentum" — intendedMode is fixed by what the rule does, and here it excludes. | `archetypeRuleCompatibility.js:428` | `CONST_DIVERSIFIER:55` | `forgeKnowledgeBase.js:124` |
| `tech-rsi-overbought` | neutral → tension | 1,2,3 | GATE vs PREFERENCE (Guide §3 lines 40-48) with a domain switch: the `strictMode` toggle is literally labelled "Hard exclusion mode", turning a preference into a gate; at threshold=60 a sector in a strong run has no admissible name. | `archetypeRuleCompatibility.js:431` | `CONST_DIVERSIFIER:55` | `forgeKnowledgeBase.js:67` |
| `th-05` | neutral → tension | 1,6 | EXIT-MECHANISM CONFLATION on the profit side: a tight trailing stop makes the winner's own price action the exit trigger, where the kernel states the profit-side trigger is the sector creeping toward the cap. | `archetypeRuleCompatibility.js:432` | `CONST_DIVERSIFIER:31` | `forgeKnowledgeBase.js:1277` |
| `ts-01` | neutral → tension | 1,2 | GATE vs PREFERENCE (Guide §3 lines 40-48), tier-scoped: a volatility ceiling restricting maximum tier is not an entry gate (so not rubric step 1) but is defensive positioning by name volatility; the stored family comment ("vol is not this archetype's axis") reads the kernel as indifferent where DV:19/DV:36 say it refuses to impose the ceiling itself. | `archetypeRuleCompatibility.js:427` | `CONST_DIVERSIFIER:19` | `forgeKnowledgeBase.js:1408` |
| `tv-10` | neutral → tension | 1,2,3 | GATE vs PREFERENCE (Guide §3 lines 40-48): an explicit dual eligibility gate ("eligible for {tier} tier … restricted to Core or below") built on a fundamental floor up to 85/100 — a quality floor doing admission work, which the kernel refuses to substitute for spread. | `archetypeRuleCompatibility.js:429` | `CONST_DIVERSIFIER:19` | `forgeKnowledgeBase.js:2617` |

<details><summary><strong>Full parameter domains</strong> — the 19 item-2 flags in this column (verbatim)</summary>

- `alloc-sector-cap` — sector: select default="any single" options=["any single" "Any single sector", "Technology" "Technology", "Healthcare" "Healthcare", "Financials" "Financials", "Energy" "Energy", "Consumer Discretionary" "Consumer Discretionary", "Consumer Staples" "Consumer Staples", "Industrials" "Industrials", "Materials" "Materials", "Real Estate" "Real Estate", "Communication Services" "Communication Services", "Utilities" "Utilities"] · pct: number default=40 min=20 max=80 step=5 unit=%
- `r-06` — max: number default=2 min=1 max=3 step=1
- `tv-14` — max_pct: number default=40 min=25 max=60 step=5 unit=% · evals: number default=2 min=1 max=4 step=1 unit=evals
- `a-05` — anchors: number default=2 min=1 max=3 step=1 · rockets: number default=2 min=1 max=3 step=1 · low_pct: number default=1.5 min=0.5 max=2.5 step=0.5 unit=% · high_pct: number default=3.5 min=2.5 max=5 step=0.5 unit=%
- `a-06` — rs_min: number default=15 min=10 max=22 step=1 unit=/22 · pct: number default=25 min=10 max=50 step=5 unit=%
- `a-07` — defensive: number default=2 min=1 max=4 step=1 · growth: number default=3 min=2 max=4 step=1 · fund_min: number default=70 min=50 max=90 step=10 unit=/100
- `fund-bank-pb` — threshold: number default=2 min=1 max=3 step=0.5 unit=P/B
- `fund-value-pe` — level: select default="sector median" options=["sector median" "Sector median", "20" "P/E below 20", "15" "P/E below 15 (deep value)"]
- `gs-08` — thresholds: number default=2 min=1 max=4 step=1 · cycles: number default=4 min=2 max=8 step=1 · mult: number default=3 min=2 max=5 step=0.5 unit=x
- `mb-01` — minutes: number default=60 min=15 max=180 step=15 unit=min
- `mb-06` — star: number default=2 min=1.5 max=3 step=0.5 unit=x · core: number default=1.5 min=1 max=2 step=0.5 unit=x
- `mb-07` — swaps: number default=2 min=1 max=4 step=1 · window: number default=60 min=30 max=120 step=15 unit=min · freeze: number default=45 min=15 max=90 step=15 unit=min
- `r-08` — anchors: number default=2 min=1 max=4 step=1 · sails: number default=2 min=1 max=3 step=1
- `r-12` — sentiment: select default="bearish" options=["bearish" "Bearish (avoid negative)", "neutral" "Neutral (avoid non-bullish)"]
- `t-11` — score: number default=15 min=10 max=22 step=1 unit=/22 · floor: number default=8 min=0 max=15 step=1 unit=/22
- `t-16` — count: select default="2 of 3" options=["2 of 3" "2 of 3 (moderate)", "3 of 3" "3 of 3 (strict)"]
- `tech-rsi-overbought` — threshold: number default=70 min=60 max=85 step=5 unit=RSI · strictMode: toggle default=false "Hard exclusion mode"
- `ts-01` — pct: number default=200 min=150 max=300 step=25 unit=% · tier: select default="Support" options=["Support" "Support (safest)", "Core" "Core (moderate)"]
- `tv-10` — fund_score: number default=65 min=40 max=85 step=5 unit=/100 · tech_score: number default=60 min=40 max=80 step=5 unit=/100 · tier: select default="Star" options=["Star" "Star eligible", "Core" "Core max"]

</details>

### 5.2 FORWARD DIRECTION — stored `core_conflict` the kernel reads softer

*The already-collected direction, swept for completeness: **12 cells**.*

| ruleId | archetype | stored → predicted | item(s) | mechanism reason | on docket? | stored cell |
|---|---|---|---|---|---|---|
| `i-09` | Fundamental Investor | core_conflict → tension | 1,4 | PREFERENCE vs OVERRIDE (Guide §2 line 31): i-09 is a parameterless scoring preference over holder TYPE that never claims to outrank the admission test, so the kernel reaches step 2 (TF drift) rather than step 1's 'sufficient entry reason without quality'. | #11 | `archetypeRuleCompatibility.js:413` |
| `r-12` | Contrarian | core_conflict → tension | 3,5 | Distinction 2 (sector vs name): the exclusion is SECTOR-scoped ('Avoid buying stocks in sectors where FantasyTimes sentiment is {sentiment} or worse') and rubric step 1 explicitly exempts sector-scoped rules — same class as docket #3 (a-08), #10 (i-07) and #12 (ss-05) but not yet on the docket, and its stored zone1Ref CN-Z1-BUY-WEAKNESS rests on frozen June-24 DEF prose the July-23 kernel corrected to name-level. | **new** | `archetypeRuleCompatibility.js:291` |
| `t-14` | Contrarian | core_conflict → tension | 3,4 | Distinction 4 (gate vs preference) read in the withholding direction: 'Only act on breakouts where volume exceeds {mult}x' never instructs preferring breakouts — it withholds action and makes chasing strictly harder — and the same volume signal is stored neutral in this column at tech-volume-surge (line 289) on the capitulation/accumulation reading, so the momentum_breakout familyDefault swept in a restrictive filter as if it were a momentum preference. | **new** | `archetypeRuleCompatibility.js:271` |
| `i-10` | Contrarian | core_conflict → tension | 4 | Distinction 1 (preference vs override): quarter-over-quarter growth in the COUNT of unique institutional holders is an ownership-breadth preference, not the name's own price momentum or relative strength, and it never claims to outrank the dislocation or both-legs bar — the corpus text frames it as preceding a re-rating (before the crowd forgives), so the momentum_breakout familyDefault applied the counter-indicative test to evidence that is not momentum. | **new** | `archetypeRuleCompatibility.js:271` |
| `alloc-tier-preference` | Contrarian | core_conflict → tension | 5 | Distinction 3 (bounded vs unbounded, Guide §8 line 91): the attribute select carries 'undervalued' — a kernel-native setting — inside the same domain as 'high momentum', so the full-domain verdict is tension + narrowedParams; the stored core_conflict comes from policy P3 (classify by DEFAULT direction, lines 27-29), itself under audit. Duplicate of docket #2, recorded for both-directions completeness. | #2 | `archetypeRuleCompatibility.js:303` |
| `a-08` | Contrarian | core_conflict → tension | 5 | Distinction 2 (sector vs name): 'Overweight sectors where FantasyTimes sentiment is {sentiment} or better' is sector-scoped overweighting with no name-selection clause, which rubric step 1 exempts by name. Duplicate of docket #3, recorded for both-directions completeness. | #3 | `archetypeRuleCompatibility.js:300` |
| `i-07` | Contrarian | core_conflict → tension | 5 | Distinction 2 (sector vs name): 'Prefer drafting stocks in sectors where the aggregate institutional flow sentiment is {sentiment}' is a sector-scoped preference that can serve as the kernel's own recovery leg (evidencePriority 2/5), and the live wire agrees — sectorDiversity weight is 0.00. Duplicate of docket #10, recorded for both-directions completeness. | #10 | `archetypeRuleCompatibility.js:296` |
| `ts-01` | Speculator | core_conflict → tension | 1,3 | GATE vs PREFERENCE (Guide §3 line 48) — ts-01 excludes nothing from the book, it only caps the multiplier tier, and its trigger is the name's OWN 14-day average ATR (150–300%), so it never 'requires low-volatility names as a selection criterion'; rubric step 1 does not fire and step 2 does. | **new** | `archetypeRuleCompatibility.js:317` |
| `th-05` | Speculator | core_conflict → native | 1,6 | BOUNDED vs UNBOUNDED (Guide §8 line 91) — the atr domain is 0.1–0.4 ATR of trail TIGHTENING, and ITEM 6 separates tightening from widening: rubric step 3 makes stop tightening native for this kernel, so the stored profit_locking family default over-blocks. | #8 | `archetypeRuleCompatibility.js:320` |
| `alloc-sector-minimum` | Diversifier | core_conflict → tension | 1,2 | BOUNDED vs UNBOUNDED (Guide §8 line 91): at pct 10-20 a sector floor GUARANTEES a sector is represented, which is rubric step 3 native behaviour (prioritizes under-represented sectors); only pct 40-50 breaches the ≈35% cap, so the determinate verdict across the domain is tension + narrowedParams, not a flat core_conflict. | **new** | `archetypeRuleCompatibility.js:438` |
| `th-04` | Capital Preserver | core_conflict → tension | 1,2,6 | BOUNDED vs UNBOUNDED — widening a trailing stop by 0.3–1.0 ATR is CP-04's own direction and CP:63 makes stop tuning native in BOTH directions; the stored cell adjudicates the 'chase the next tier' framing rather than the exit mechanism. | #6 | `archetypeRuleCompatibility.js:358` |
| `fund-value-pe` | Trend Follower | core_conflict → tension | 4 | PREFERENCE vs OVERRIDE (Guide §2 line 31): 'Prefer stocks with P/E ratio below {level}' is a scoring preference on deprioritized evidence, not a fundamental override of trend evidence, so the kernel's conflict test is not met — already docket #4, re-confirmed here for both-directions completeness. | #4 | `archetypeRuleCompatibility.js:239 (familyDefault deep_value → core_conflict, zone1Ref TF-Z1-PRICE-NOT-PEDIGREE)` |

### 5.3 Raised and REFUTED on the merits

14 candidate flags did not survive adversarial review and are recorded here so the docket can see what was tested and rejected.

| ruleId | archetype | claim | why refuted |
|---|---|---|---|
| `tv-13` | Trend Follower | native → core_conflict | The template requires 'positive price action' alongside the spike, so nothing outranks strength — it raises the confirmation bar, which TF rubric step 3 (CONSTITUTION_TREND_FOLLOWER_V1.md:68) calls native, and volume confirmation is a listed definition-derived TF clause (:6). 'Overrides other technical signals' reorders signals *inside* priority 1, never lets weakness or pedigree rescue a chart. |
| `tv-01` | Trend Follower | native → tension | The mechanism is 'Prefer stocks with 14-day RSI between {low} and {high}' — a momentum-zone strength preference (TF rubric step 3, :68) whose `weak` leg always deprioritizes the non-moving. `stretched`=65 only narrows the preferred band, changing magnitude not mechanism (Guide §8 line 91), and RSI is not the band-fit signal — SIG-002 binds chart extension to `baggerBombFit` (ARCHETYPE_AUTHORING_GUIDE_V1.md:65). |
| `tech-macd-bullish` | Trend Follower | native → tension | All three in-domain `macdDirection` options are bullish states and `rsiFloor` never drops below 40, so every setting requires a realized bullish momentum event plus a non-weak RSI — 'strengthens the momentum/technical trigger', TF rubric step 3 (:68). A completed MACD crossover is an observed confirmation, not the turn-prediction TF:15 refuses. |
| `th-04` | Speculator | native → core_conflict | The coreRefusal is scoped: 'Never widens or removes the stop **to stay in a loser** — the floor is not negotiable downward' (CONSTITUTION_SPECULATOR_V1.md:35). th-04 fires only after a positive threshold, on a winner, and widens the *trailing* stop, leaving the survival floor untouched — giving a live move room is SP:13's 'being in them while they move'. |
| `t-15` | Speculator | native → tension | NR7 is a per-name relative range flag (narrowest day in that stock's own last seven), so it never tilts the book toward the low-ATR cohort that SP's cross-sectional atrPercentile ranks; paired with a 50-90 technical-score floor it is a breakout trigger — SP rubric step 3, 'strengthens the momentum/technical trigger' (:56). |
| `a-07` | Capital Preserver | native → core_conflict | The flag misreads the template: 'Maintain at least {defensive} high-fundamental-score stocks and **up to** {growth} high-ATR growth stocks' puts a *ceiling* on high-ATR names (min=2 is the tightest cap) and a *floor* on quality — both CP rubric step 3 natives, 'Raises the quality bar, tightens the volatility ceiling' (CONSTITUTION_CAPITAL_PRESERVER_V1.md:63). Unlike a-05's `rockets` (a required minimum), no in-domain setting mandates a single high-ATR holding. |
| `alloc-even-spread` | Capital Preserver | native → tension | Even sector spread IS guardian evidencePriority 2 — 'Spread for safety — the largest single fit-sort weight (.35) plus the ≥6-sector instruction' (CONSTITUTION_CAPITAL_PRESERVER_V1.md:17) — and 'adjusts concentration' is step 3 native (:63). The `conviction` param is a strictness dial ('How strictly the agent follows this directive'), changing magnitude not mechanism, and it never elevates breadth above the quality floor or volatility ceiling. |
| `th-07` | Capital Preserver | native → tension | The rule weights proximity to *negative scoring thresholds* — a large adverse move, not sub-threshold price action — so it never lets noise trigger action under CP:37, and amplified penalty-aversion is the archetype's own direction: 'Refuses… owning anything that could blow up' (:29), 'Risk control **is** the strategy' (:32). It touches no stop, quality floor or volatility ceiling; the 1.2-2.0 domain changes only weighting. |
| `a-07` | Fundamental Investor | native → tension | Same misreading as the guardian cell: the growth leg is 'up to {growth}' — a cap on high-ATR names — and the only mandate is a minimum quality cohort, so no in-domain setting requires an ATR-selected holding. An additional weak floor (`fund_min` 50) does not lower FI's own two-tier admission standard, which the kernel says the identity holds regardless of enforcement (:23). |
| `i-08` | Diversifier | neutral → core_conflict | The equippable template text is 'Strongly **prefer** stocks where institutional conviction is accumulating AND insider activity… shows net buying' — a ranking preference, which the founder ruling declares 'safe by construction' (docs/CONSTITUTION_DIVERSIFIER_V1.md:63, narrow by RANKING never by GATING) and which priority 3 already licenses as 'a genuine live ranking component' (:18). The 'top priority during portfolio construction' phrase is agentUseDescription UI prose (forgeKnowledgeBase.js:3024), not the rule. |
| `risk-sector-diversification` | Diversifier | native → tension | 'Diversify across at least {n} sectors' is a spread FLOOR, not a ceiling — at every in-domain value including n=2 it forbids nothing and permits nothing, so it cannot breach 'Never permits a swap that pushes a sector past the cap' (:35). A weak floor is not a sanction; the mechanism is step 3's 'widens the spread' (:56) throughout. |
| `fund-revenue-growth` | Diversifier | neutral → core_conflict | The equippable template says 'Prefer companies with revenue growth above {pct}%' — a ranking preference, not a gate, and DV:63's founder ruling protects exactly this ('Ranking preferences… are safe by construction') while priority 4 keeps quality 'non-gating' (:19). The 'screen… filtering out stagnant businesses' language the flag cites is agentUseDescription prose (forgeKnowledgeBase.js:261), and Guide §3 line 44 fixes mode from what the rule does, not its tone. |
| `fund-market-cap` | Diversifier | neutral → tension | Same error class. The flag claims a corpus gloss of 'filter stocks by market capitalization'; no such phrase exists in the rule's block (src/data/forgeKnowledgeBase.js:330-348), which is preference language throughout — template 'Prefer {size} cap stocks', description 'Focus on company size', param label 'Market cap preference'. Without gate language DV rubric step 2 is not reached. |
| `i-01` | Diversifier | neutral → tension | Rests on a corpus gloss that does not exist. The flag claims the corpus describes i-01 as 'Filters the draft universe'; the actual description (src/data/forgeKnowledgeBase.js:2789) says it 'Filters out passive index fund noise' — i.e. it filters NOISE FROM THE SIGNAL, not the candidate universe. The template verb is 'Strongly prefer' (:2807). A preference is not a gate, so DV rubric step 2's sector-starvation test is never reached and the kernel lands 'compatible' — the stored neutral is correct. |

---

## 6. Per-scan-item results and NO-FINDING statements

Ten scan items. Each is answered here with either its findings or an explicit NO-FINDING statement saying what
was swept and how the conclusion was reached. A NO-FINDING is a deliverable, not a fallback.

### Item 1 — stored `native`/`neutral` → kernel tension/conflict *(the under-collected direction)*

**FINDINGS — this is the audit's main result.** All 524 offerable stored `native`/`neutral` cells were walked
against their kernel's rubric first-hit-wins, one column at a time (95 cells × 6 columns). See §5.1.

The direction is not merely under-collected — it is where nearly all the divergence lives. Per §7, the reverse
direction outnumbers the forward direction by more than ten to one, and the two thinnest stored-conflict columns
(`analyst`, 2 stored core_conflicts; `diversifier`, 1) produced the largest and second-largest flag counts. A
near-empty conflict column was a symptom, not a sign of a permissive identity.

### Item 2 — parameterized mixed domains

**FINDINGS.** Carried inline: every flag whose scan items include **2** reproduces its full domain verbatim
(min/max/step for numerics, every option for selects, defaults and labels for toggles) in the collapsible block
under its column's table in §5.1.

The structural cause is stated by the map itself and is in direct conflict with the guide:

- The map declares **PARAM-INDEPENDENCE** — "classification is per TEMPLATE id, not per authored `paramValues`"
  (`src/data/archetypeRuleCompatibility.js:36-38`) — and policy **P3** classifies "by DEFAULT direction"
  (`:27-29`).
- Guide §8 R1-8 forbids exactly that: a rule whose domain spans identity-safe and identity-breaking values "has
  **no determinate first-hit verdict until its bounds exist**", and the verdict is tension + `narrowedParams`
  recording the admitted domain (`docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:91`).
- `PARAM_SWING_NOTES` (`:143-156`) documents the swing for exactly **two** rules — `alloc-tier-preference` and
  `i-07` — out of 94 offerable templates that carry a multi-value domain.

The sharpest sub-class is the toggle that changes the *mechanism* rather than the magnitude:
`tech-rsi-overbought` carries `strictMode`, labelled verbatim **"Hard exclusion mode"** with the hint "completely
excludes overbought stocks instead of just deprioritizing them" (`src/data/forgeKnowledgeBase.js:58,67`). One
toggle converts a ranking preference into an eligibility gate, and the stored map has one verdict for both.

### Item 3 — gate-vs-preference mismatches (the R-11 class)

**FINDINGS**, carried in §5.1 (rows whose scan items include 3). Guide §3 as corrected by R1-1 is the authority:
`intendedMode` is immutable per `ruleId`, so a gate-shaped rule threatening an archetype is core_conflict or
tension + `advisoryDowngrade` — "never a silent reinterpretation as ranking"
(`docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:44-48`).

One methodological limit, stated rather than papered over: **the Phase-3 `intendedMode` metadata does not exist
in the corpus at HEAD.** Guide §7 requires it for all 143 templates, and it is unauthored. Every gate-vs-preference
call in this audit was therefore made from the template text plus `agentUseDescription`, not from a stored mode
field. Where the corpus's own prose contradicts its template verb — several rules say "Prefer …" in the template
and "filter out" / "excludes from the draftable universe" in the description — the audit read the rule by what it
does to the candidate flow, per R1-1.

### Item 4 — evidence-relationship mismatches, tested per archetype

**FINDINGS**, carried in §5.1 (rows whose scan items include 4). The four types were tested separately, each
with its own conflict test (Guide §2, `:25-38`): `deprioritized` (conflict only on *outranking*),
`counter-indicative` (conflict as soon as it becomes a positive signal), `excluded` (conflict on admission as
*any* entry condition), `noise_discounted` (conflict only when sub-threshold evidence triggers action).

**The interim binding rule at Guide §2 line 38 did real work and is worth reporting as a restraint:** absent a
cited executable threshold, rules touching short-term price movement cap at `tension`, never `core_conflict`.
That rule held every Capital Preserver noise-reactive candidate at tension rather than conflict. Conversely
`mb-15` (consecutive-interval VWAP failure) was examined and **not** flagged for guardian, because VWAP-failure
is one of the three threshold sources CP names as its own (`CONSTITUTION_CAPITAL_PRESERVER_V1.md:37`) — it is
not sub-threshold evidence.

### Item 5 — portfolio-level vs name-level effects

**FINDINGS**, carried in §5.1 (rows whose scan items include 5). This item is why the Diversifier column is the
largest: its top evidence priority is a *portfolio state*, and DV's rubric states that "a rule can reverse this
kernel's evidencePriority **without ever mentioning concentration**"
(`docs/CONSTITUTION_DIVERSIFIER_V1.md:54`). Ordinary stock-selection rules therefore reach the DV rubric, and
the stored map recorded one core_conflict for the entire column.

The mirror case also produced flags: Capital Preserver's spread is priority 2 and is explicitly *instrumental* —
"diversification as a *protection layer*" (`CONSTITUTION_CAPITAL_PRESERVER_V1.md:17`) — so rules that loosen it
reach CP rubric step 2's "loosens one protection layer while leaving the others" (`:62`).

### Item 6 — exit-mechanism conflation (the R-7/R-8 class)

**FINDINGS**, carried in §5.1 (rows whose scan items include 6), plus one structural finding that is the
cleanest single illustration in the audit:

The `profit_locking` family (`src/data/archetypeRuleCompatibility.js:215-217`) is defined as "Tight
profit-locking / winner-trimming instructions" and contains **three different exit mechanisms**:

| member | actual mechanism | corpus |
|---|---|---|
| `th-05` | trail **tightening** after a threshold | `src/data/forgeKnowledgeBase.js:1267` |
| `sx-04` | fixed **profit target** — "Sell any position that gains {pct}% from entry" | `src/data/forgeKnowledgeBase.js:3377` |
| `sr-01` | position-size **rebalance trim** — "Trim any position above {maxPct}% back to {targetPct}%" | `src/data/forgeKnowledgeBase.js:3489` |

One family default grades all three identically per archetype. **`guardian.familyDefaults.profit_locking =
'native'` (`:340`) is the single line that generated both of the docket's reverse-direction flags** — #8
(`th-05`) and #1 (`sx-04`) — and its third member `sr-01` has never been examined by anyone. That is the
retracement-sensitivity case law applied to a family that cannot express it.

### Item 7 — inactive-rule dicta

*(Reported separately from the offerable priority set, per the brief — see §8.)*

### Item 8 — cross-archetype symmetry

**FINDINGS.** Computed deterministically over all 95 offerable rules.

- **36 offerable rules carry opposite verdicts** — `native` for at least one archetype and `core_conflict` for
  another. Under Guide §1 line 19 that is expected and correct; the archetype-relative verdict is the whole point.
  The finding is that **only 2 of the 36** (`th-04`, `a-08`) carry a per-cell stated reason on every side. The
  other 34 rest on uncommented family defaults, where the mechanism reason is inherited from the family's
  *topical* definition rather than stated for the archetype pair.
- The deeper form of the same finding: **the stored map has no citation fields at all.** Guide §1 line 21
  specifies the per-cell format — `{ruleId, archetypeId, verdict, rubricStep, kernelElement(s) cited, treatment?,
  paramBounds?, note?, kernelIdentityVersion, kernelIdentityHash, status}`. The stored map records `state`,
  `zone1Ref` and an optional `tensionReason` and nothing else (`:492-518`). There is no `rubricStep`, no
  `kernelElement`, no `paramBounds`, no hash stamp. Guide §1 line 6 is the standing rule: "An uncited verdict is
  an opinion, and opinions do not enter the matrix."
- **The flattening case.** 30 offerable rules are stored `neutral` in **all six** columns, and **29 of those 30
  have no explicit cell in any column** — all six resolve by fallthrough. For a corpus whose whole design premise
  is that the same rule earns opposite verdicts across archetypes, thirty rules on which no archetype has
  recorded an opinion is the symmetry finding in its purest form.
- **The prediction the symmetry test made, and it held.** The two thinnest stored-conflict columns were
  `analyst` (2) and `diversifier` (1). Both kernels carry sharp explicit refusals — FI's non-negotiable
  gate→trigger order (`CONSTITUTION_FUNDAMENTAL_INVESTOR_V1.md:23,59`) and DV's shape-outranks-selection
  (`docs/CONSTITUTION_DIVERSIFIER_V1.md:21,54`). Those two columns produced the second-largest and largest flag
  counts in the sweep.

### Item 9 — duplicate rule families

**Part A — semantically equivalent rules under different ids: NO FINDING.** All 95 offerable templates were
compared pairwise on normalised template-text plus headline plus description (Jaccard ≥ 0.34 after stop-word and
placeholder stripping). Three near-duplicate pairs surfaced, and none diverges without a reason:

- `alloc-sector-cap` ("Cap your sector exposure", `forgeKnowledgeBase.js:470`) vs `r-06` ("Cap sector exposure",
  `:2022`) — **zero** verdict divergence across all six columns.
- `tech-avoid-declining` (`:194`) vs `risk-avoid-declining-trend` (`:444`) — same `weakness_avoidance` family,
  **zero** divergence across all six.
- `tech-moving-average-trend` (`:104`) vs `tech-volume-surge` (`:150`) — diverges on `contrarian` only, and the
  divergence carries an explicit stated reason: the volume-surge override at
  `archetypeRuleCompatibility.js:287-289` ("volume confirmation doubles as the capitulation/accumulation signal
  of the contrarian's turning leg").

**Part B — season/clash twins: NO FINDING on divergence, one finding on convergence.** The corpus declares 17
conflict pairs (`FORGE_CONFLICT_PAIRS` + `SEASON_CONFLICT_PAIRS`). For declared *opposites*, divergent verdicts
are correct and **convergence** is the anomaly, so the test was inverted. Two pairs share a non-neutral verdict,
both in the `guardian` column and both `mode_scrapped`:

- `sx-01`/`sx-02` — both stored `native` (overrides `:384`, `:385`). Declared: "Fixed Stop-Loss and Trailing Stop
  can both trigger sells. The tighter one fires first." Defensible — both are protective stops.
- **`sx-04`/`sx-02` — both stored `native`** (`sx-04` via the `profit_locking` family default `:340`; `sx-02` via
  override `:385`). Declared verbatim: *"Profit Target sells at a fixed gain. Trailing Stop would let it run
  further. **Opposite philosophies.**"* The corpus itself says these two rules are opposites; the map calls them
  both native for the same archetype. Under CP R1-6 the profit-target member is tension while the trailing-stop
  member is genuinely native (`CONSTITUTION_CAPITAL_PRESERVER_V1.md:62`, `:36`). The corpus's own declaration is
  corroborating evidence for docket flag #1.

**Part C — family misfiling (the highest-leverage error surface).** Family membership is hand-curated, a rule
belongs to at most one family, and **234 of the 570 offerable cells are decided by family default** — so one
mis-filed id moves up to six cells at once. Each family's members were checked against its own definition
comment. Three mismatches survive review, all citable (a fourth, `a-07`, was raised and refuted — shown struck through):

| family (def line) | member | family's stated definition | the member's actual primary mechanism |
|---|---|---|---|
| `high_volatility` (`:179`) | `tv-15` (`fgKB:2746`) | "Volatility-SEEKING instructions" | a forced **post-bonus exit** — "swap it out within {evals} evaluations"; high-ATR is the *replacement* criterion, not the trigger |
| `high_volatility` (`:179`) | `i-09` (`fgKB:3029`) | "Volatility-SEEKING instructions" | an **ownership** signal — holder-turnover classification; the volatility link is an inference, not the mechanism |
| `momentum_breakout` (`:191`) | `i-10` (`fgKB:3049`) | "Chase-strength / breakout / momentum-preference" | **ownership breadth over quarters** — unique institutional holders rising; no price-momentum term at all |
| ~~`fundamental_quality` (`:199`)~~ | ~~`a-07`~~ | *raised, then* **refuted** *on review* | The claim rested on reading `growth` as a provisioned high-ATR sleeve. It is not: the template says "**up to** {growth} high-ATR growth stocks" — a *ceiling*, with `growth` min 2 being the tightest available cap. The rule is a quality floor plus a volatility ceiling, which is a defensible fit for its family, and it also makes the stored `a-05` core_conflict / `a-07` native split coherent rather than inconsistent. Recorded because the audit initially asserted the opposite. |

The consequences are mechanical, not hypothetical. `tv-15` sitting in `high_volatility` inherits `native` for
`degen` (`:315`); its actual mechanism — sell the winner after banking a threshold — is what `profit_locking`
grades `core_conflict` for `degen` (`:320`). One family placement swings that cell two states. `i-10` in
`momentum_breakout` inherits `contrarian` `core_conflict` under `CN-Z1-DONT-CHASE` (`:271`), though a rising
holder count is not a name that "has already run and become beloved".

Two further families lump distinct mechanisms under one default: `profit_locking` (three exit mechanisms — see
item 6) and `concentration` (`:227-229`), which pairs a **sector floor** (`alloc-sector-minimum`) with
**pyramiding** (`sr-04`).

### Item 10 — guidance-dependent reconciliations

*(See §9.)*

---

## 7. Count summary

| Measure | Count |
|---|---|
| Stored cells in the map (143 templates × 6 archetypes) | 858 |
| Offerable cells — the priority scope | 570 |
| ├ reverse-direction population swept (stored `native`/`neutral`) | 524 |
| └ stored `core_conflict` swept | 46 |
| **Flags raised, all columns** | **167** |
| ├ surviving adversarial review | 153 |
| └ refuted on the merits | 14 |
| **Reverse direction (stored softer than kernel)** | **141** |
| ├ from stored `native` | 7 |
| └ from stored `neutral` | 134 |
| Forward direction (stored harsher than kernel) | 12 |
| ├ already on the twelve-flag docket | 7 |
| └ new | 5 |
| Flags predicting `core_conflict` | 17 |
| Flags predicting `tension` (a state the map cannot store) | 135 |
| Flags sitting on FALLTHROUGH cells (no authored verdict at all) | 75 |

Per column:

| Column | swept | flags | reverse | of which stored `native` | forward |
|---|---|---|---|---|---|
| Trend Follower | 95 | 21 | 20 | 0 | 1 |
| Contrarian | 95 | 24 | 18 | 1 | 6 |
| Speculator | 95 | 19 | 17 | 1 | 2 |
| Capital Preserver | 95 | 23 | 22 | 2 | 1 |
| Fundamental Investor | 95 | 25 | 24 | 1 | 1 |
| Diversifier | 95 | 41 | 40 | 2 | 1 |

---

## 8. Scan item 7 — inactive-rule dicta *(reported separately, per the brief)*

48 of the 143 templates are not offerable. The stored map nonetheless carries **134 explicit
(non-fallthrough) cells** on them — verdicts about rules the product will not offer.

| | count |
|---|---|
| status `hidden_absent_substrate` | 68 |
| status `hidden_unwired` | 0 |
| status `deprecated` | 2 |
| status `mode_scrapped` | 64 |
| stored `neutral` | 79 |
| stored `native` | 35 |
| stored `core_conflict` | 20 |
| resolved via family | 114 |
| resolved via override | 20 |
| non-offerable rules carrying ≥1 explicit cell | 32 |
| non-offerable rules with zero explicit cells | 16 |

**The 20 `core_conflict` cells are the operative subset** — `core_conflict` is the only state the
enforcement kernel acts on (`src/services/ruleCompatEvaluate.js:95`), so those are the dicta that can
actually block a user.

### 8.1 Can a dictum reach live reasoning? Traced per consumer.

| consumer | reachable for a non-offerable id? | why | effect |
|---|---|---|---|
| `src/services/ruleCompatEvaluate.js:94` | **YES** | getRuleCompatInfo(templateId, archetype) where templateId is caller-supplied. The module's only imports are featureFlags, the compat map and compatSurfaceCopy (:29-31) — there is no support-status check. Its callers pass a sourceRef read straight off a STORED rule doc: api/agent/set-rule-hardness.js:148 reads ruleData.sourceRef then calls evaluateRuleCompatWrite at :156; api/agent/reforge-bundle.js:142; src/services/ | RULE_COMPAT_MODE='enforce' (src/config/featureFlags.js:595) makes a core_conflict dictum on a non-offerable rule operative: :95 gates on state==='core_conflict', :101 sets blocked when the write would resolve hard, :119-124 returns decision 'block' with a user-facing message and a compat_promote_blocked event. Twenty core_conflict dicta cells (listed above) can therefore hard-block a user write or emit telemetry abou |
| `src/services/ruleCompatClassify.js:41` | **YES** | classifyBundleSnapshots iterates bundle.ruleSnapshots and reads getRuleCompatInfo(snap.sourceRef, archetype). The only filter is `if (!snap \|\| !snap.sourceRef) continue;` (:40) — no support gate; imports are featureFlags, the compat map and hardSoftHelper (:19-21). ruleSnapshots are FROZEN at forge time (src/services/forgeService.js:481-495 pushes sourceRef at :492), so any bundle forged before the C-20 gate carrie | A non-offerable rule with a core_conflict dictum is counted into compatConflicts, persisted to the rule_compat stream (api/agent/equip-bundle.js:257-262), and rendered to the user via buildBundleEquipCompatWarning (src/utils/compatSurfaceCopy.js:132-142) as 'N rules in this bundle are off-style for your <Archetype>'. |
| `api/_utils/ruleCompatCleanup.js:90` | **YES** | collectProjectedConflicts derives templateId from doc.sourceRef on already-equipped Firestore rule docs (:88) and calls getRuleCompatInfo at :90; the only skip is a null sourceRef (:89). Module imports are projectActiveRules, ruleHardness, the compat map and leagueTournament constants (:41-44) — no support gate. Reached from analyzeAgentCompat:151 (the WS1 Phase-4 pre-launch cleanup) and from api/agent/change-archety | Highest-consequence path: a core_conflict dictum on a non-offerable rule produces a WRITE PLAN — demote_bundle_override ops (:166-167 via demoteOp :100-109), swap_seeded_trait (:237-246), report_only_trait_conflict (:249-259) — plus census entries (:316-326). The cleanup runner executes these against live agent data, and the founder-facing report attributes them to rules that can never be re-offered. |
| `api/_utils/activationGate.js:64` | **YES** | checkActivationGate loops `equippable` × archetypes and calls getCompat(t.id, archetype) at :64, treating via==='fallthrough' as a MISSING cell (:67-69). `equippable` is filtered ONLY by GameModePolicy mode (:47-48 against LIVE_DEPLOY_MODES ruleModeGate, api/_utils/gameModePolicy.js:39,60,79 = ['both','clash']) — never by support status (module imports at :28-31 contain no ruleSupportStatus). I verified the modes fie | Inverted incentive: the A-4 completeness gate actively DEMANDS explicit verdict cells for hidden rules. mb-05, mb-14, t-09, tv-09, gs-04, f-13, a-10 and i-04 currently resolve fallthrough and are therefore counted as missingCompatCells (:68), so the gate pressures authors to write MORE dicta on rules ruleSupportStatus.js forbids offering. It cannot reach the 26 mode_scrapped rules — see noFinding. |
| `api/_utils/compileOnSettingsChange.js:174` | **YES** | The loop at :166-176 walks every bundle.ruleSnapshots entry with no support-status filter and writes compatCells[snap.id] = getRuleCompatInfo(snap.id, archetype). SEPARATE DEFECT FOUND, reported as fact not speculation: it passes snap.id, which is the Firestore rule DOC id (src/services/forgeService.js:482 `id: ruleId`), where the compat map is keyed by TEMPLATE id (src/data/archetypeRuleCompatibility.js:40-41). rule | Reachable in code but, because of the key-space mismatch, it resolves via:'fallthrough' for offerable and non-offerable rules alike — so it does not currently leak a stored VERDICT into the compiled build. Its comment at :171-173 claims 'Live cells pass through verbatim', which the key mismatch makes untrue. Net: no dicta leak here today, and a live compiler defect worth its own docket line. |
| `src/components/Forge/workshop/BundleBuildFlow.jsx:196` | **YES** | isOffStyle (:194-196) reads getRuleCompatInfo(r.sourceRef, archetype).state on rules ALREADY IN the working bundle, rendered at :267 and :305. The rule objects come from stored bundle/rule docs, not from the offer enumeration, and the file imports no support-status helper. Contrast the create path at :151, whose templateId originates in the add-rule picker fed by the filtered enumeration (src/hooks/useForge.js:237) — | Renders 'Off-style for <Archetype>' (src/utils/compatSurfaceCopy.js:123-125) plus '— it may weigh this against its instincts' on an equipped hidden or scrapped rule, under RULE_COMPAT_MODE==='enforce' (:73). |
| `src/utils/compatSurfaceCopy.js:68` | no | THE ONLY SUPPORT-GATED COMPAT-MAP READ IN THE CODEBASE. nativeAlternatives' filter chain (:63-68) evaluates isSupported(t.id) at :67 BEFORE getRuleCompatInfo(t.id, archetype) at :68, and && short-circuits, so the map is never read for a non-offerable candidate. The gate is deliberate — the comment at :57-61 calls this an OFFER surface. Note the deliberate asymmetry: templateHeadline (:40-43) does an UNFILTERED FORGE_ | No leak on this line. The surrounding copy builders still render dicta-driven text supplied by ruleCompatEvaluate.js:110/:123. |
| `api/_utils/archetypeRegistry.js:119` | no | archetypeRegistry does NOT import getRuleCompatInfo (imports at :36-40 are ARCHETYPE_RULE_COMPATIBILITY, COMPAT_STATES, RULE_FAMILIES only) and never resolves a per-rule verdict, so it cannot be 'reached for a non-offerable rule id' in the resolution sense. It embeds the raw per-archetype compat block wholesale — `compat: ARCHETYPE_RULE_COMPATIBILITY[codeId]` (:119) — and RULE_FAMILIES into getRegistryCorpus (:136). | Structurally worse than a leak: getArchetypeDefinition's compat block feeds computeIdentityHash (:149-158, canonicalContentHash over { definitions, corpus }), so all 134 dicta cells are inside the §2.3 identityHash. Deleting or correcting a dictum is a hash-breaking, ARCHETYPE_IDENTITY_VERSION-bumping change that per ruleSupportStatus.js:16-18 invalidates every authored compat cell stamped against the old hash — the  |
| `api/agent/log-rule-compat-event.js:23` | no | Imports ARCHETYPE_KEYS only (:23) — no verdict function, no map read. It is the sink for events other consumers produce, not a classifier. | No independent leak; it persists whatever dicta-derived events ruleCompatEvaluate.js:103-116 produced. |

The single support-gated compat read in the codebase is `src/utils/compatSurfaceCopy.js:67-68`, where
`isSupported()` short-circuits before the map is consulted. Every other consumer is ungated: an exhaustive
grep for `isSupported` / `filterSupported` / `getSupportStatus` finds four non-test consumers, all in `src/`,
all enumeration surfaces. **No `api/` path gates on support status at all** — the C-20 honesty gate and the
compat map are disjoint systems.

### 8.2 Dicta flags — where the stored verdict ALSO disagrees with the kernel

| ruleId × archetype | stored → predicted | mechanism reason | stored cell | kernel clause |
|---|---|---|---|---|
| `sr-01` × guardian | native → tension | THE UNEXAMINED THIRD MEMBER of the docket's single most load-bearing line. I re-verified the brief's stated fact: guardian carries NO ruleOverride for th-05, sx-04 or sr-01 (its ruleOverrides span src/data/archetypeRuleCompatibility.js:353-389 and contain none of the three), so all three profit_locking members (:216) resolve through the one line familyDefaults.profit_locking = { state: 'native' } at :340. sr-01 sells an appreciated position: its own corpus description at src/data/forgeKnowledgeBase.js:3493 says 'The gap between max and target determines how aggressively you sell winners.' That is eager profit-taking, which CP rubric step 2 names EXPLICITLY as tension. The stored native reads it under step 3's 'adjusts concentration', but step 2 fires first under first-hit-wins (CONSTITUTION_CAPITAL_PRESERVER_V1.md:60). BOUNDED-vs-UNBOUNDED (Guide §8 line 91, R1-8): at maxPct 10 / targetPct 8 the trim fires on a 2-point drift, deep inside eager-taking territory, so the correct verdict is tension + narrowedParams toward patient values — a treatment the stored 'native' drops entirely (Guide §4 lines 50-56). | `archetypeRuleCompatibility.js:340` | `CONST_CAPITAL_PRESERVER:62` |
| `gs-05` × guardian | native → tension | The rule's PRIMARY verb is 'widen loss tolerance' — it relaxes the stop while leaving the swap-restriction (patience) layer intact and strengthened. That is verbatim CP rubric step 2's 'loosens one protection layer while leaving the others'. The stored native reads it under step 3's 'tunes the stop within patience bounds (both directions — CP-04/CP-05)' (CONSTITUTION_CAPITAL_PRESERVER_V1.md:63), but step 2 precedes step 3 under first-hit-wins (:60), and the corpus param hint at src/data/forgeKnowledgeBase.js:1043 states the direction unambiguously: 'Relaxed stop-loss for leading positions. More negative = more breathing room.' BOUNDED-vs-UNBOUNDED mirror (Guide §8 line 91): a stored 'native' is wrong if an extreme in-domain value breaks the kernel, and atr = −1.5 ATR is the domain extreme of the loosening. Kernel verdict is tension + narrowedParams on atr, not a flat native. Compounding: gs-05 is hidden_absent_substrate (par concept absent, ruleSupportStatus.js:96) yet holds an explicit guardian OVERRIDE. | `archetypeRuleCompatibility.js:377` | `CONST_CAPITAL_PRESERVER:62` |
| `tv-07` × momentum_chaser | core_conflict → tension | SCOPE ERROR — an entry-family default applied to a hold rule. mean_reversion's other two members (tech-rsi-oversold, tv-06 — src/data/archetypeRuleCompatibility.js:171) are ENTRY instructions; tv-07 is not. Its entire text acts on an ALREADY-OWNED position ('increase hold patience to {minutes} minutes … Do not swap a stock near its daily low'), instructs no purchase, and therefore cannot 'reverse evidencePriority or violate a coreRefusal' as TF rubric step 1 requires for core_conflict (CONSTITUTION_TREND_FOLLOWER_V1.md:66). What it does do is extend holding — step 2's own named example. The stored map's policy P2 (:25-27, 'profit targets, trims, and stop management on an owned position are execution discipline') points the same way but was never applied, because family membership decided the cell before any per-rule reading. THIS IS THE COMPOUNDING CASE the brief asks for: core_conflict is the ONLY state that blocks or warns (ruleCompatEvaluate.js:95, :101), so an over-blocking dictum on a hidden rule is the actively harmful kind — it can hard-block a promote on an already-equipped tv-07 that no user can ever re-acquire. | `archetypeRuleCompatibility.js:238` | `CONST_TREND_FOLLOWER:67` |
| `ss-02` × guardian | native → tension | BOUNDED vs UNBOUNDED, mirror form (Guide §8 line 91, R1-8): judge the FULL template domain; a stored 'native' is wrong if an extreme in-domain value breaks the kernel. The beta-cap leg IS step-3 native ('tightens the volatility ceiling', CONSTITUTION_CAPITAL_PRESERVER_V1.md:63), but the stop leg is not. tightPct runs down to 3% and the corpus hint at src/data/forgeKnowledgeBase.js:3667 says it 'Overrides your normal trailing stop with this tighter value' — i.e. the rule REPLACES the agent's authored stop with a 3%-from-peak trigger. CP's coreRefusal is 'Never gets shaken out by noise — a bad afternoon is not a reason; only confirmed damage is' (:42), and rubric step 1 puts 'treats noise as an exit trigger' at core_conflict. The whole-domain-correct verdict is tension + narrowedParams bounding tightPct away from its floor, not a flat native that admits the entire 3–10 range silently. | `archetypeRuleCompatibility.js:381` | `CONST_CAPITAL_PRESERVER:62` |
| `sr-01` × degen | neutral → tension | The override at src/data/archetypeRuleCompatibility.js:330 lifts sr-01 out of degen's profit_locking core_conflict default (:320) on the stated rationale at :329, 'Partial trim ≠ tight profit lock; the volatility thesis survives'. That is a DEFAULT-param reading — precisely policy P3 (:28-29, 'param-swing rules classify by DEFAULT direction') — and Guide §8 line 91 (R1-8) forbids it: judge the full template domain first. At maxPct 10 / targetPct 8 the trim fires on a 2-point drift and repeatedly cuts the runner, which is the refusal as the stored map itself words it at :103: 'locking profits so tight the volatility thesis cannot play out'. Forced de-risking of the winner is SP rubric step 2's 'converts the fear response toward defensive positioning'. Kernel lands at tension + narrowedParams; the stored 'neutral' silently drops the required treatment (Guide §4 lines 50-56). Note the direction is the audit's primary target — the override moved this cell SOFTER than both its own family default and the kernel. | `archetypeRuleCompatibility.js:330` | `CONST_SPECULATOR:55` |
| `sr-04` × diversifier | neutral → tension | THE AXIS, not a type (Guide §2 line 36, restated inside the DV rubric's own note): DV's top priority is a PORTFOLIO STATE, so a rule can reverse evidencePriority without ever mentioning concentration. sr-04 sizes UP a holding on the NAME's own gain with no portfolio-shape term anywhere in its text — name-merit outranking shape, which the quoted clause places at step 1. The override rationale at src/data/archetypeRuleCompatibility.js:439 ('Marginal cap-bounded adds; breadth disturbed only at the margin') imports a cap that is not in this template: the module's own PARAM-INDEPENDENCE rule (:36-38) says classification is per TEMPLATE id, not per co-equipped set, and the cap it leans on is sr-01, itself mode_scrapped (src/data/ruleSupportStatus.js:181) — so the co-equip that made the stored reading true can no longer be assembled. Across the full domain (addPct up to 5% per trigger, threshold as low as 5%) the adds are repeated and template-internally uncapped. Kernel lands at tension at minimum (DV step 2, docs/CONSTITUTION_DIVERSIFIER_V1.md:55) and arguably step 1 core_conflict; either way the stored 'neutral' is softer than the kernel and carries no treatment. | `archetypeRuleCompatibility.js:440` | `CONST_DIVERSIFIER:54` |

### 8.3 The docket trap

CONFIRMED, and worse than the brief states. Status verified line-by-line from src/data/ruleSupportStatus.js: sx-04 is mode_scrapped (:180, inside MODE_SCRAPPED :178-183); ss-05 is mode_scrapped (:182); sr-01 is mode_scrapped (:181). So docket #1 (sx-04/guardian) and docket #12 (ss-05/contrarian) both stand on season templates the product will never offer, per founder ruling C-19 (:172-177). Scanning the remaining ten against the same map found two MORE the brief did not name: docket #5 (f-10/momentum_chaser) is hidden_absent_substrate (:136) and docket #9 (gs-06/analyst) is hidden_absent_substrate (:97). FOUR of the twelve docket flags — #1, #5, #9, #12, i.e. one third of the entire docket — sit on non-offerable rules. The remaining eight (alloc-tier-preference, a-08, fund-value-pe, th-04, th-05×2, i-07, i-09) carry no entry in RULE_SUPPORT_STATUS and are therefore 'supported' by the getSupportStatus default (:210-212). The reverse-direction subset is hit hardest and it is the subset the brief calls the whole reason this audit exists: of the only TWO reverse-direction docket entries, #1 (sx-04/guardian) is dicta and #8 (th-05/guardian) is not — so HALF the reverse-direction evidence base is unofferable. I re-verified the stated fact and it holds: guardian declares no ruleOverride for th-05, sx-04 or sr-01 anywhere in :353-389, so all three members of profit_locking (:216) resolve through the single line familyDefaults.profit_locking = { state: 'native' } at :340. That one line therefore decides docket #1, docket #8, and — via the new flag above — sr-01/guardian, which is BOTH mode_scrapped AND never examined until now. Line 340 now carries three CP-rubric-step-2 disagreements of which exactly one (th-05) can ever reach a user through an offer path. Because :340 is a single shared familyDefault, any founder ruling on it moves all three cells at once, and two of the three are dicta — the docket cannot decide #1/#8 on the merits of an offerable rule alone.

### 8.4 NO-FINDING statements for item 7

- hidden_unwired has ZERO dicta exposure. Its sole member i-04 (src/data/ruleSupportStatus.js:161) appears in no RULE_FAMILIES id-list (src/data/archetypeRuleCompatibility.js:168-230) and in no archetype's ruleOverrides, so all six of its cells resolve via:'fallthrough' — absence, not a verdict. It is the only one of the four non-offerable status classes with no explicit stored cell.
- 16 of the 48 non-offerable rules carry zero explicit cells across all six archetypes and are therefore outside the dicta-risk set entirely: mb-05, mb-14, t-09, tv-09, gs-04, f-13, a-10, i-04, se-02, se-04, sx-03, sx-05, sx-06, sr-02, sr-05, ss-06. Verified by resolving all 48 × 6 = 288 cells through the live getRuleCompatInfo and keeping only via !== 'fallthrough' (134 kept, 154 fallthrough).
- The 26 mode_scrapped rules are NOT reachable through api/_utils/activationGate.js. Its `equippable` filter (:47-48) admits only templates whose modes are in LIVE_DEPLOY_MODES' ruleModeGate = ['both','clash'] (api/_utils/gameModePolicy.js:39,60,79), and I verified se-01/sx-04/sr-01/ss-05 and the rest carry modes:'season'. The gate's own header acknowledges this at :16-17. All 22 non-mode_scrapped non-offerable rules DO carry 'both' or 'clash' and are therefore in scope — see the activationGate leak path.
- NO api/ file gates on support status at all. Exhaustive grep of src/ and api/ for isSupported / filterSupported / getSupportStatus / ruleSupportStatus returns exactly four non-test consumers, all in src/ and all enumeration/offer surfaces: src/components/Forge/RuleDirectory.jsx:151, src/hooks/useForge.js:237, src/components/Forge/StarterKit.jsx:188, src/utils/compatSurfaceCopy.js:67. Zero compat-verdict consumers on the server gate on it. This establishes as fact — not inference — that the C-20 honesty gate and the compat map are disjoint systems, exactly as ruleSupportStatus.js:214-226 designs but never audits for consequence.
- No flag raised on risk-single-stock-limit × guardian (:369) or × diversifier (:443) despite both being explicit `native` OVERRIDES — the strongest possible endorsement — on a rule the codebase itself calls 'structurally vacuous — the game has no position sizing' (src/data/ruleSupportStatus.js:168-169). A rule with no mechanism has nothing for a kernel clause to contradict, so no citable disagreement exists and asserting one would be adjudication. Recorded here because it is the purest dicta artifact in the set: two hand-authored cells endorsing a rule that does nothing.

---

## 9. Scan item 10 — guidance-dependent reconciliations

Stored verdicts that are only defensible because they assume a mechanism the product does not have.
Every absence below was **independently verified in code at HEAD**, not taken from the brief.

### 9.1 The assumption audit

| assumption (and where the map states it) | exists at HEAD? | evidence | consequence |
|---|---|---|---|
| P1 — 'categorical gates/avoidance of the out-of-favor = core_conflict; soft signals with a legitimate turn-reading = neutral'. Presumes a gate-vs-soft-signal distinction with product standing (an admission/eligibility mechanism that a 'gate' actually operates and a 'soft signal' does not).<br>*stated at* `archetypeRuleCompatibility.js:21-23` | **NO** | src/data/forgeKnowledgeBase.js (zero `intendedMode` and zero `guardrailBinding` fields across all 143 templates — 0 grep hits in 3798 lines); docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:85 ('there is NO deterministic shortlist/admission substrate at HEAD ... all of them author prompt_advisory'); src/config/featureFlags.js:982 (COMPILER_ENABLED=false) | The gate/soft split is the author's read of template prose, not an encoded property. Guide §3 (docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:44-48) still routes gate-shaped rules to core_conflict or tension+advisoryDowngrade on IDENTITY grounds, so P1's core_conflict direction survives; its NEUTRAL direction ('soft signal → neutral') is the guidance-dependent half, because nothing in the product makes a soft rule weaker than a gate — both are prompt text on the same channel. |
| P2 — 'exits are Zone 2: profit targets, trims, and stop management on an owned position are execution discipline (neutral) absent a separate Zone 1 hit.' Presumes an ordering barrier partitioning entry identity (Zone 1) from execution (Zone 2).<br>*stated at* `archetypeRuleCompatibility.js:25-26` | **NO** | src/data/archetypeAdjustments.js:14-17 (zone-key→doc-zone map) and :209 ('zones are prose for the prompt, never a directive body'); docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:81 (kernels MUST carry a 'two-sided exit disposition ... profit side and loss side'); CONSTITUTION_CAPITAL_PRESERVER_V1.md:62 (R1-6 puts profit-target rules in tension explicitly); CONSTITUTION_CAPITAL_PRESERVER_V1.md:36, CONSTITUTION_FUNDAMENTAL_INVESTOR_V1.md:35, docs/CONSTITUTION_DIVERSIFIER_V1.md:31 (exit dispositions inside each kernel) | Every cell resting on P2 is guidance-dependent. Affected: momentum_chaser.profit_locking neutral (:251, 3 rules), analyst.profit_locking neutral (:403, 3 rules), analyst 'th-04' neutral (:418), and — in the opposite direction — guardian.profit_locking native (:340, docket #1/#8). 8 cells. |
| P3 — 'param-swing rules classify by DEFAULT direction; param-aware classification is the designated post-observe refinement.' Presumes a later mechanism (param-aware classification, or an observe stream that feeds it) will handle off-default authorings.<br>*stated at* `archetypeRuleCompatibility.js:27-29` | **NO** | src/data/archetypeRuleCompatibility.js:143-156 (PARAM_SWING_NOTES carries copy hints only — 2 entries, no bounds); zero `paramBounds` and zero `narrowedParams` occurrences anywhere in src/ or api/; docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:91 (R1-8: judge the FULL template domain; a mechanism acceptable only in a subset is tension + narrowedParams, authored atomically with the cell — 'paramBounds is no longer a later step') | P3 defers exactly what the Guide forbids deferring. Only 2 of the map's param-swing cells carry a swing note at all (alloc-tier-preference, i-07 — both already on the docket as #2 and #10); every other single-verdict cell over a direction-reversing domain is undocumented. |
| PARAM-INDEPENDENCE — 'Param-loosening attacks on native cap rules are rung-2 precedence concerns, not classification concerns.' Presumes a rung-2 layer that bounds user-authored param values on native cap rules.<br>*stated at* `archetypeRuleCompatibility.js:36-38` | **NO** | Two incompatible ladders exist and neither does this. (a) docs/CUSTOMIZATION_LAYER_DESIGN_SPEC_V1_1.md:62 defines rung 2 as 'Archetype immutable core (Zone 1) ... The identity floor — bound-setting', with tighten-only at rung 3 (:75-76) — but it is prose with no implementation: zero `paramBounds` occurrences in src/ or api/. (b) In shipped code, precedencePosition 1 is PlatformGuardrails (api/_utils/platformGuardrails.js:21) and precedencePosition 2 is the GameModePolicy (api/_utils/gameModePolicy.js:62,79,100,114; | Every stored `native` cap rule is guidance-dependent — 43 cells by the count below. Method: stored 'native' cells whose template mechanism is a numeric ceiling/floor on exposure, volatility, position size, sector count, drawdown, hurdle or stop distance, i.e. where loosening the param weakens the bound. guardian 26 (volatility_avoidance family 3 at :339; profit_locking family 3 at :340; 20 of the 22 overrides at :368-389, excluding ss-03 which has no numeric bound and alloc-even-spread whose param is a select); div |
| The Diversifier sector cap bounds adds ('Marginal cap-bounded adds; breadth disturbed only at the margin').<br>*stated at* `archetypeRuleCompatibility.js:439` | **NO** | src/config/featureFlags.js:568 (`export const SECTOR_CAP_MODE = 'observe';`); api/_utils/agentGuardrails.js:131 (`if (SECTOR_CAP_MODE !== 'enforce') return base;`); api/_utils/agentGuardrails.js:158 (observe resolver) and :328-359 (would_block_swap recorded, 'The decision is NEVER touched here'); api/_utils/agentGuardrails.js:103 (tournament-only) and :31-33 (mid-battle swaps only); docs/CONSTITUTION_DIVERSIFIER_V1.md:67 ('observe mode *records* would-block events; it does not block'); docs/ARCHETYPE_AUTHORING_GUID | The sr-04/diversifier neutral (:440) has no bound behind it, and the scope mismatch (season-mode rule vs tournament-only cap) means no flag flip would supply one. Flagged above. |
| A rule→parameter modulation path exists for the dynamic hurdle / stop-width family (twelve rules: mb-06/11/12, gs-02/03/05/06/08, th-01/th-04/th-05, ss-02).<br>*stated at* `PHASE3_METADATA_BATCH5_INBATTLE:83 (the claim of ABSENCE); relied on implicitly by src/data/archetypeRuleCompatibility.js:358, :377, :379, :381, :328, :412, :418` | **NO** | VERIFIED ABSENT. hftConfig.hurdleFloor is written only by the tempo dial (api/_utils/tempoDialClamp.js:34-36 and :156-173), whose input is a dial setting, and read at api/_utils/agentRiskManager.js:315. Stop/trail widths reach the engine only via battle.agentContext.deployedGuardrails (api/_utils/agentBattleService.js:173), fed from agent.deployedStrategy.guardrails, written from season-experiment dimensionValues (src/services/deployStrategyService.js:166; src/utils/dimensionMapper.js:1315-1345) — never from the ru | Verdicts for these twelve rest on behaviour the equipped rule cannot produce. Stored cells affected across the map: guardian gs-05/gs-08/ss-02 native (:377,:379,:381) and th-04 core_conflict (:358, docket #6); degen th-04 native (:328) and th-05 core_conflict (:320, docket #7); analyst gs-06 core_conflict (:412, docket #9) and th-04 neutral (:418); guardian th-05 native (:340, docket #8). mb-06/11/12, gs-02/03 and th-01 resolve by the 'neutral' fallthrough (:517) with no authored assumption. |
| The map's own enforcement channel — INVARIANT R: the map 'informs equip-path warnings/blocks and render-time badges ONLY — never projection or prompts.'<br>*stated at* `archetypeRuleCompatibility.js:9-13` | YES | src/config/featureFlags.js:595 (`export const RULE_COMPAT_MODE = 'enforce';`); src/hooks/useForge.js:583; src/hooks/useTraits.js:222; src/services/ruleCompatEvaluate.js:46,87 | This is the one assumed mechanism that DOES exist — and it is the reason the flags above matter operationally. Because only `core_conflict` produces a warning/block (:522-524), a guidance-dependent 'neutral' or 'native' is silent by construction: there is no downstream layer that can recover the missing treatment, since the map never reaches projection or either prompt assembler. |
| Implicit mode gate — that the season-mode templates the map classifies are held out of live play by a mode barrier.<br>*stated at* `not stated in the map (the map has no mode scoping; SCOPE BOUNDARY at src/data/archetypeRuleCompatibility.js:40-43 scopes only by sourceRef)` | **NO** | GameModePolicy.ruleModeGate (api/_utils/gameModePolicy.js:60,79,100,114) is consumed ONLY by the dark compiler (api/_utils/compileBuild.js:239-242, COMPILER_ENABLED=false) and the authoring scoreboard (api/_utils/activationGate.js:45). src/data/ruleSupportStatus.js:174-177 states it plainly: 'GameModePolicy's ruleModeGate governs BACKEND admission ... it does NOT suppress display'. Runtime filtering is client-side display only (src/components/Forge/RulePickerModal.jsx:44; src/components/Forge/ForgeScreen.jsx:143). | 26 templates are marked mode_scrapped (src/data/ruleSupportStatus.js:179-184) and 1 deprecated (:167-170); the map carries stored verdicts on many of them — e.g. sr-04, ss-02, sx-01, sx-02, sx-04, sr-01, sr-03, sx-07, se-07, ss-03, ss-04 — including 5 of the guardian natives, 6 of the diversifier natives and 3 of the contrarian natives. Recorded as a scope dependency, not adjudicated. |

The headline is the fourth row. The map explicitly hands param-loosening on native cap rules to a
"rung-2 precedence concern" (`src/data/archetypeRuleCompatibility.js:36-38`). **That rung does not exist.**
`paramBounds` and `narrowedParams` have zero occurrences anywhere in `src/` or `api/`; the archetype-core
bound-setting rung is prose only; shipped `precedencePosition 2` is the GameModePolicy, which carries no
param bounds. On the agent's count that leaves **43 stored `native` cap cells guidance-dependent**
(59 on a wider definition) — every one of them a cell whose "native" is doing work no mechanism performs.

Note the one assumption that **does** hold: `INVARIANT R`. That is precisely why the rest matter — because
the map never reaches projection or either prompt assembler, there is no downstream layer that can recover a
missing treatment. A guidance-dependent `neutral` or `native` is silent by construction.

### 9.2 Item-10 flags

| ruleId × archetype | stored → predicted | assumed mechanism | stored cell | absence evidence |
|---|---|---|---|---|
| `tech-rsi-oversold` × analyst | neutral → tension (+ narrowedParams or advisoryDowngrade) | ADMISSION GATE — a live 'standing quality floor' that pre-filters the candidate set so a buy-the-oversold technical rule can only fire on already-quality-qualified names. | `archetypeRuleCompatibility.js:396` | `ARCHETYPE_AUTHORING_GUIDE:85` … |
| `fund-financial-health` × diversifier | neutral → core_conflict (rubric step 1, gate-shaped) or tension (rubric step 2, sector starvation) | BREADTH-PRESERVING SLOT MECHANISM — the comment asserts a user-added quality gate 'narrows slots, never breadth', i.e. presumes some mechanism guarantees the book still spans sectors after a name-level screen removes candidates. | `archetypeRuleCompatibility.js:429` | `CONST_DIVERSIFIER:67` … |
| `sr-04` × diversifier | neutral → core_conflict (rubric step 1) — at minimum tension | A CAP THAT BOUNDS — the comment 'Marginal cap-bounded adds' presumes a live sector/position cap that ceilings the pyramiding so breadth is disturbed 'only at the margin'. | `archetypeRuleCompatibility.js:440` | `src/config/featureFlags.js:568` … |
| `alloc-sector-cap` × diversifier *(also in §5)* | native → core_conflict at the loose end of the template domain; tension + narrowedParams across the domain | PARAMETER RESTRICTION AT RUNG 2 — the map's PARAM-INDEPENDENCE note hands param-loosening attacks on native cap rules to a rung-2 precedence layer, i.e. presumes the archetype immutable core clamps the user's chosen cap value. | `archetypeRuleCompatibility.js:446` | `CUSTOMIZATION_LAYER_DESIGN_SPEC_V1_1.md:62` … |
| `alloc-sector-cap` × guardian | native → tension (loosens one protection layer while leaving the others) | PARAMETER RESTRICTION AT RUNG 2 — same PARAM-INDEPENDENCE hand-off; the native presumes something keeps the cap value inside CP's protection envelope. | `archetypeRuleCompatibility.js:374` | `CUSTOMIZATION_LAYER_DESIGN_SPEC_V1_1.md:62` … |
| `risk-single-stock-limit` × guardian | native → compatible at best (rubric step 4) — the mechanism it is native FOR does not exist | PARAMETER RESTRICTION ON POSITION SIZE — the native presumes a live per-name position-weight cap the rule can tighten. | `archetypeRuleCompatibility.js:369` | `ruleSupportStatus.js:167-170` … |
| `risk-single-stock-limit` × diversifier | native → compatible at best (rubric step 4) — the mechanism it is native FOR does not exist | PARAMETER RESTRICTION ON POSITION SIZE — listed under 'Spread-machinery natives', presuming a live per-name weight cap that serves book shape. | `archetypeRuleCompatibility.js:443` | `ruleSupportStatus.js:167-170` … |
| `se-07` × diversifier | native → tension + narrowedParams (native only in the tight half of the domain) | PARAMETER RESTRICTION AT RUNG 2 on a native cap rule. | `archetypeRuleCompatibility.js:448` | `api/_utils/gameModePolicy.js:62` … |
| `sx-01` × contrarian | native → tension at the wide end of the domain (extends patience past stop discipline) | ENFORCEMENT PATH + PARAMETER RESTRICTION — the stored comment says 'the hard mechanical stop licenses the patient default', presuming (a) an equipped Forge stop rule becomes a deterministic guardrail and (b) rung 2 keeps its value inside CN's scalpel bounds. | `archetypeRuleCompatibility.js:308` | `src/config/featureFlags.js:982` … |
| `gs-05` × guardian | native → compatible/tension — no native mechanism to express | RULE→PARAMETER MODULATION PATH plus a par-score signal — the rule 'widens loss tolerance to {atr} ATR and restricts swaps to emergency exits only' when score exceeds par. | `archetypeRuleCompatibility.js:377` | `PHASE3_METADATA_BATCH5_INBATTLE:83` … |
| `gs-08` × guardian | native → compatible — no native mechanism to express | RULE→PARAMETER MODULATION PATH into hftConfig.hurdleFloor — 'increase swap hurdle rates by {mult}x' during a winning streak. | `archetypeRuleCompatibility.js:379` | `PHASE3_METADATA_BATCH5_INBATTLE:83` … |
| `ss-02` × guardian | native → tension (stops tight enough to fire on noise; scoreboard-triggered posture change) | RULE→PARAMETER MODULATION PATH into trailing-stop width and entry beta — 'tighten trailing stops to {tightPct}% and cap beta at {maxBeta}' when leading the S&P. | `archetypeRuleCompatibility.js:381` | `PHASE3_METADATA_BATCH5_INBATTLE:83` … |
| `sx-04` × momentum_chaser | neutral → tension (pushes against timeDoctrine without reversing it) | ORDERING BARRIER — policy P2's 'exits are Zone 2', i.e. a Zone-1/Zone-2 partition that removes exit-side rules from identity adjudication absent a separate Zone-1 hit. | `archetypeRuleCompatibility.js:251` | `archetypeAdjustments.js:14-17` … |
| `risk-volatility-avoidance` × guardian | native → compatible — the volatility-ceiling mechanism it is native FOR has no substrate | ENFORCEMENT PATH for a volatility ceiling — the rule avoids stocks whose volatility exceeds a level 'for their sector'. | `archetypeRuleCompatibility.js:339` | `ruleSupportStatus.js:117-120` … |

### 9.3 NO-FINDING statements for item 10

- degen column: no guidance-dependent reconciliation found. Its natives (high_volatility, forced_trading) and conflicts (volatility_avoidance, fundamental_quality, deep_value, profit_locking) are argued from the Speculator kernel's own excluded/chase-vol semantics, not from an assumed gate, barrier, restriction, mode gate or enforcement path; the one place the Speculator kernel invokes a precedence rung it names rung 1, the live PlatformGuardrails distressed-swap block (CONSTITUTION_SPECULATOR_V1.md:65 — verified live at api/_utils/platformGuardrails.js:21).
- The map's ZONE1_REFS block (src/data/archetypeRuleCompatibility.js:84-133) asserts a LOCKSTEP mechanism with archetypeAdjustments.js `zones.immutableCore` (:78-82). That pairing is a documentation discipline, not a mechanism, but no stored VERDICT rests on it, so it is recorded here rather than flagged.
- diversifier high_volatility neutral (:426, 'Zone 1: no volatility ceiling') and analyst volatility_avoidance neutral (:399, 'a vol CAP is not a vol play') assume no mechanism — they are direct kernel readings (docs/CONSTITUTION_DIVERSIFIER_V1.md:19 'no quality floor, no volatility ceiling'). Not guidance-dependent.
- No stored cell was found that assumes an advisoryDowngrade or narrowedParams TREATMENT is applied downstream — because the three-state map has no tension state to attach one to. The treatments themselves are absent from the product (`narrowedParams`: 0 occurrences in src/ and api/; `advisoryDowngrade`: only inside the dark compiler at api/_utils/compileBuild.js:231-233), which is recorded as a program-level fact rather than a per-cell flag.

---

## 10. Scope, limits, and what this audit did not do

Stated plainly, because a founder docket is only as good as its known edges.

### 10.1 Verification is uneven, and here is exactly how

- **All 167 raised flags** carry the deterministic citation audit described in §2 — stored verdict re-resolved against
  the live module, deciding line confirmed, corpus anchor bounded, kernel quote verbatim.
- **The 46 highest-severity flags** (every one predicting `core_conflict`, plus every one demoting a stored
  `native`) received an independent adversarial merits challenge instructed to refute by default. It returned
  **23 confirmed, 10 amended (all severity downgrades), 13 refuted** — a distribution that indicates a real
  challenge rather than a rubber stamp. A further 12 flags were hand-reviewed by the orchestrating session
  (11 sustained, 1 refuted). One cell, `risk-exit-atr-stop`/`contrarian`, drew **opposite** verdicts from the two
  reviewers and is recorded **CONTESTED** rather than silently resolved.
- **The remaining 121 flags** carry citation verification but **no independent merits challenge** — 109 of them
  reverse-direction `neutral` → `tension`, and 12 forward-direction. Their citations are sound; their rubric
  readings are single-sourced. Treat confidence markers on those rows as the finder's own, not as adjudicated.

For the record, the 153 surviving flags predict: 17 `core_conflict`, 135 `tension`, and 1 `native` (`th-05`/`degen`,
forward direction, docket #7 — the Speculator rubric makes stop *tightening* native at step 3).

The original design called for two adversarial reviewers on every flag. That did not happen, and the reason is
operational rather than analytical: two orchestrated multi-agent runs were killed mid-flight by worker restarts
and container idling, after completing 1 and then 3 of their agents. The columns were re-run as standalone
agents and completed; the verification fan-out was cut to the high-severity subset to land the deliverable.
**A full merits pass over the remaining unchallenged flags is the single highest-value follow-up.**

**A calibration estimate, so the gap is a number rather than a shrug.** Ten of the 109 unchallenged
stored-`neutral` → `tension` flags were drawn deterministically (every 12th, which spread the sample across five
columns) and reviewed by hand against their kernels. **Nine sustained; one was refuted** — `i-01`/`diversifier`,
where the flag rests on the corpus describing the same rule both as "Filters the draft universe" and as "a soft
preference," but the template verb is "Strongly prefer," which is preference language, so DV rubric step 4
(`compatible`) is reached and the stored `neutral` is correct. That one had been self-marked **low confidence**
by its finder.

So the unchallenged set carries a false-positive rate on the order of **one in ten**, and it is concentrated in
the self-declared low-confidence rows. Practical triage: of the 109 unchallenged flags, **13 are low-confidence**
(3 `guardian`, 10 `diversifier`) — challenge those first. Across all 167 flags the split is 56 high / 97 medium
/ 14 low.

**One gap in the deterministic checker, found by using it.** It verifies that a flag's *kernel* quote is
verbatim, but for the *corpus* it only checks that the cited line falls inside the rule's block — it cannot tell
whether a flag's paraphrase of corpus prose is accurate. Both refutations above exploited exactly that gap: each
attributed a "filter"/gate gloss to a corpus description that contains no such language. Any future merits pass
should re-read the corpus block, not just the cited line.

### 10.2 Method limits

- **`intendedMode` does not exist in the corpus at HEAD.** Guide §7 requires it for all 143 templates and it is
  unauthored. Every gate-vs-preference call (scan item 3) was therefore made from template text plus
  `agentUseDescription` rather than from a stored mode field. Where the corpus's own description contradicts its
  template verb, the audit read the rule by its effect on the candidate flow, per Guide §3 R1-1.
- **Predicted verdicts rest on the Guide and the kernels, not on a rulings document.** Per §1.2,
  `docs/ADJUDICATION_RULINGS` V1.1 does not exist. A founder ruling recorded only outside the repo could move
  any flag by one rubric step.
- **Line anchors are valid at HEAD `178a8a09`.** Per BUILD_RULES §3 they drift; re-verify before relying.
- **This audit did not adjudicate anything.** No flag says which side wins. It also did not re-litigate the
  twelve existing docket entries beyond confirming their direction — which is how the #1 direction error in the
  brief's framing surfaced.
- **Scan item 2's domain reproduction is per-flag, not per-corpus.** Full domains are reproduced for flags that
  cite item 2. The 94 offerable templates carrying multi-value domains were all examined, but the report does not
  reproduce all 94 domains — only those attached to a flag.

### 10.3 Dispositions that differ from the rest of the docket

- **Every Diversifier flag is currently un-authorable.** The DV kernel's lock is blocked through the sector-cap
  observe window and "Diversifier cells stay out of authoring" until `SECTOR_CAP_MODE = 'enforce'` is live and
  verified (`docs/CONSTITUTION_DIVERSIFIER_V1.md:67`; `docs/ARCHETYPE_AUTHORING_GUIDE_V1.md:108`). That changes
  *when* these 46 flags can be dispositioned, not *whether* the disagreements exist. They are recorded now so the
  docket is complete when the window closes.
- **Flags predicting `tension` cannot be recorded in the stored schema at all** (S1). For those 135 cells the
  founder's decision is not "which of three states" — it is whether the map gains a fourth state, or whether
  tension is expressed some other way. That is a schema question, and it is upstream of every individual flag.
- **Any disposition is an identity-hash event** (S3). Fixing even one cell changes `identityHash`, fails the CI
  lock without an `ARCHETYPE_IDENTITY_VERSION` bump, and per Guide §1:21 invalidates authored cells stamped at
  the old hash. This argues for one batched disposition rather than a cell-at-a-time pass, and it is a decision
  the founder needs *before* the first fix.
- **39 offerable cells are CI-locked against reclassification to `core_conflict`** by the strict seeded-rule
  invariant (S4). Where a flag on a seeded cell predicts `core_conflict`, the disposition necessarily touches
  either the verdict or the seed map — the invariant will not let the question go unanswered.

### 10.4 Found outside this task's scope — reported, not fixed (BUILD_RULES §3)

Each of these was encountered while auditing and is filed for separate tasking. None was acted on.

1. **`ARCHETYPE_DEFAULT_TRAITS.diversifier` seeds four rules that are not offerable** at HEAD — `tv-04`,
   `mb-05`, `gs-05`, `gs-06`, all `hidden_absent_substrate`
   (`src/data/ruleSupportStatus.js:87,83,96,97`). The Diversifier default build therefore seeds rules the
   product will not offer.
2. **`ARCHETYPE_DEFAULT_TRAITS.guardian` seeds `risk-single-stock-limit`**, which is `deprecated` —
   "structurally vacuous — the game has no position sizing" (`src/data/ruleSupportStatus.js:168`) — and which
   still carries an explicit stored `native` (`src/data/archetypeRuleCompatibility.js:369`).
3. **A live key-space defect in the compiler's settings-change writer.** `api/_utils/compileOnSettingsChange.js:174`
   writes `compatCells[snap.id] = getRuleCompatInfo(snap.id, archetype)` — but `snap.id` is the Firestore rule
   **doc** id (`src/services/forgeService.js:482`), while the compat map is keyed by **template** id
   (`src/data/archetypeRuleCompatibility.js:40-41`). The correct pairing is visible two files away
   (`src/services/ruleCompatClassify.js:45-46`, which uses `snap.sourceRef`). Every lookup therefore resolves
   `via:'fallthrough'`, so the comment at `:171-173` — "Live cells pass through verbatim" — is untrue. Benign
   today in one respect (it means no dicta verdict leaks into compiled builds) and a real defect in another.
4. **`INVARIANT R`'s positive claim is now understated relative to the code.** The header says the map "informs
   equip-path warnings/blocks and render-time badges ONLY" (`src/data/archetypeRuleCompatibility.js:9-13`). The
   negative half of the invariant holds — no fenced file, no `projectActiveRules.js`, neither prompt assembler
   imports it. But the map is additionally read on four server paths and its resolved verdicts are persisted
   into user build documents (`api/_utils/compileOnSettingsChange.js:171-174`). Not a violation; a stale comment
   on a load-bearing invariant.

### 10.5 What would close this out

In the order that removes the most risk per unit of work:

1. **Rule on the schema question first** (S1). Whether the map can express `tension` determines the shape of
   every one of the 135 tension-class flags. Nothing else should be dispositioned before it.
2. **Rule on the batching question** (S3) — one identity-version bump for the whole docket, versus per-cell.
3. **Run the merits pass over the 121 unchallenged tension-class flags** (§10.1).
4. **Re-file the four mis-filed family members** (§6 item 9 Part C) before individual cells are touched — each
   one moves up to six cells at once, so doing it after per-cell work would redo that work.
5. **Sweep the 288 fallthrough offerable cells for absence-discipline** (S2), independently of whether they are
   flagged: on Guide §1:23's terms they have no verdict at all, and the activation gate counts explicit cells only.
