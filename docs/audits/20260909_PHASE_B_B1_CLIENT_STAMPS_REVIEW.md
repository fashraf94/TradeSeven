# Phase B — B1 client half: §2 adversarial review record

**Date:** September 9, 2026
**Branch:** `claude/phase-b-b1-client-kpkbts` · reviewed at `1a9d2764` → re-verified at `4e237db6`
**Trigger:** BUILD_RULES §2 — mandatory at ≥10 files OR ≥1500 lines on the cumulative branch diff. This diff is **28 files / 2832 insertions**, so both thresholds are crossed.
**Basis:** `docs/design/PHASE_B_TICK_STAMPS_SPEC_V1.md` (+ its V1.1 errata) · `PHASE_B_B1_CLIENT_SEED_V1.md` §1–§6 · `docs/audits/20260909_SOL_REVIEW_PHASE_B_TICK_STAMPS_PASS.md`

---

## 1. Executive verdict

| | |
|---|---|
| **Lenses run** | 4 — claim honesty (A), wiring & the presence gate (B), test integrity (C), cross-phase consistency (D) |
| **Findings raised** | 39 |
| **CONFIRMED** | 21 |
| **REFUTED** | 18 |
| **Fixed in this branch** | 15 |
| **Recorded, not fixed** | 6 (each a founder decision or separate tasking) |
| **Mutants run** | 60 (lens C) + 31 (build-time) + 13 (fix verification) = **104** |
| **Mutants surviving at close** | **0** |
| **Full suite** | `635 passed \| 3 skipped (638)` · `12034 passed \| 64 skipped (12098)` · **exit 0** |
| **`vite build`** | ✓ built · **exit 0** |
| **Verdict** | The build is sound. Two findings would have shipped a defect the founder could not have seen until the flag flip. |

**The two that mattered.** Lens B found that the screen's join — the two lines connecting the record to the surfaces — had **no test at all**: replacing either with `null` left the whole suite green while the feature rendered nothing. Lens A and lens D independently found that the negative receipt `Not heard at this check` is *deictic* and rendered on scrollback cards for threads that were no longer current, asserting something about a check the stamp says nothing about.

---

## 2. Findings, verdicts and dispositions

Severity is the reviewer's. **Fix** names the commit that carries it.

| id | lens | sev | claim | verdict | disposition |
|---|---|---|---|---|---|
| **B-1** | B | **BLOCKER** | The screen's `deriveHeard` → receipts join has zero coverage; `heard: null` survives the suite | CONFIRMED | **Fixed** `4e237db6` — `AgentBattleScreen.tickStamps.jsdom.test.jsx` |
| **B-2** | B | **BLOCKER** | The `evidence={selectEvidence(…)}` wiring has zero coverage; `evidence={null}` survives | CONFIRMED | **Fixed** `4e237db6` — same file |
| **A-1 / D-5** | A, D | MAJOR | The D-80 whose-words footer renders over a flagged-only Bench group that quotes zero sentences | CONFIRMED | **Fixed** `cdede10c` — gated on `cards.length > 0` |
| **A-2 / D-2** | A, D | MAJOR | `Not heard at this check` is slotless and renders on Replaced/Expired receipts | CONFIRMED | **Fixed** `cdede10c` — the line renders only beneath `Filed {time}` |
| **A-3** | A | MAJOR | `techAt` / `rankingsAt` render time-only, so a stale vintage reads as today | CONFIRMED | **Fixed** `cdede10c` — an instant off the check's ET day carries its date |
| **B-3** | B | MAJOR | Two "byte-identical to Phase A" rows compare the new component to itself | CONFIRMED | **Fixed** `4e237db6` — wrapper signature + absolute div count |
| **B-4** | B | MAJOR | The pane renders evidence on a post-build outage entry; the narrator renders none | CONFIRMED | **Fixed** `4e237db6` — the narrator joins the pane |
| **C-1** | C | HIGH | The narrator's "no negative line" rows are case-sensitive; a lowercase negative survives | CONFIRMED | **Fixed** `cdede10c` — exact line pin + case-insensitive ban |
| **C-2** | C | MED-HIGH | `AgentChat.jsx` renders the Heard line and sits outside every copy guard | CONFIRMED | **Fixed** `cdede10c` — joins `PHASE_B_FORBIDDEN` |
| **C-3** | C | MED | `ThisTurnStrip` pins its Heard line with `toContain`; an appended clause passes | CONFIRMED | **Fixed** `cdede10c` — exact-string pins |
| **C-4** | C | MED | The `considered`/`caused` exemption is file-wide, not sentence-scoped | CONFIRMED | **Fixed** `cdede10c` — sentence-scoped, with a cut-proof row |
| **C-5** | C | MED | The inline-copy JSX regex misses text after an expression or inside braces | CONFIRMED | **Partially fixed** — C-3's exact pins close the reachable case; the regex limit is Phase A's and is recorded |
| **C-6** | C | MED | `heardLabel(null)` unguarded though `heardStamps` produces that state | CONFIRMED | **Fixed** `cdede10c` |
| **D-1 / C-7** | D, C | MINOR | The pane absorbs the persisted-instant union, the narrator does not | CONFIRMED (latent) | **Fixed** `cdede10c` — `heardStamps` normalizes once via `toIsoInstant` |
| **B-6 / D-4** | B, D | MINOR | The panel header and the evidence heading can name two different checks | CONFIRMED (narrow) | **Fixed** `4e237db6` — bound to the panel's own instant (§9) |
| **A-4** | A | MINOR | The risk action has no ruled vocabulary; `SWAP_OUT` renders raw | CONFIRMED | **Fixed** `cdede10c` — `RISK_WORDS`, a closed list (D-81 precedent) |
| **C-8** | C | LOW | `heardLine`'s "unrecognised stamp → no line" branch unguarded | CONFIRMED | **Fixed** `cdede10c` |
| **C-9** | C | LOW | `heardStamps`' return shape unpinned | CONFIRMED | **Fixed** `cdede10c` |
| **C-10** | C | LOW | A `for…of` over `GROUNDED_PHASE_RULES` passes on an empty object | CONFIRMED | **Fixed** `cdede10c` |
| **V-1 / V-2** | C | — | Two byte-identity rows compare a call with its own default | CONFIRMED | **Fixed** `cdede10c` |
| **V-7** | C | — | Three regex captures fall back to `''`, passing silently on a miss | CONFIRMED | **Fixed** `cdede10c` |
| **A-5** | A | MINOR | The provenance triplet renders when no shown value came from that source | CONFIRMED | **Recorded** — the seed prescribes it as block provenance (§4 below) |
| **A-6** | A | MINOR | A flagged name sits under "Named at the {t} check" though no sentence named it | CONFIRMED | **Recorded** — the seed prescribes the grouping |
| **D-3** | D | MINOR | One regime token reads two ways inside one pane | CONFIRMED | **Recorded** — a design call (§4) |
| **D-7** | D | MINOR | `-0.00%` in the decider's CSV renders as `+0.00%` | CONFIRMED | **Recorded** — originates in the merged server half |
| **B-7** | B | MINOR | The one-entry fallback is never re-checked; 7 held names ≈ 334 est. tokens vs a 300 budget | CONFIRMED | **Recorded in code** — the floor is now measured in the comment; a second stage is a spec decision |
| **B-8** | B | MAJOR (process) | The four reviewers shared one snapshot; lens C's mutations perturbed lens B's reads | CONFIRMED | **Recorded** (§5) |
| **B-13** | B | INFO | A lowercase candidate symbol would drop the Bench flag | CONFIRMED | **Recorded** — fails closed |

### The 18 refutations

A review that refutes nothing has not been run adversarially. These were attacked with a concrete repro and survived:

| id | lens | hypothesis | why it failed |
|---|---|---|---|
| R-1 / R-2 | A | risk `HOLD` or the reason CODE renderable under a "saw" heading | Both carved out at the one renderer; 8 mutants reddened 3–4 files each |
| R-3 | A | a suppression word reaches a surface (incl. `data-*`) | The reason is dropped at the walk; nothing downstream has it |
| R-4 | A | "Not heard" asserted for a shape that doesn't prove it | Only `null` or a non-empty string is admitted |
| R-5 | A | the mid-tick filing renders a negative | No stamp → no key → no line |
| R-6 | A | `fundAsOf` day-shifted by a timezone | Formatted in UTC; pinned by a row |
| R-7 | A | an `rsPct` path / ninth slot / "RS unavailable" | None exists anywhere in the client |
| R-8 | A | a null metric renders `0` or a placeholder | 15 rows across 4 files redden |
| R-9 | A | YOUR RECORD invites causal reasoning from the evidence | The grounding rules forbid it explicitly |
| R-10 | A | the narrator pairs a withheld directive with "in front of it at each check" | `resolveEffectiveDirective` returns null for a suppressed directive, so the heading never appears beside one |
| R-11 | A | the `Flagged` chip leaks signal text or reads as a forecast | `flagged` is a list of strings; no field to ride on |
| R-12 | A | an outage entry's evidence leaks into YOUR RECORD | *(superseded — B-4 later showed the opposite defect)* |
| R-13 | A | the evidence heading renders with zero facts | Gated on `evidenceFacts.length` |
| R-14 | A | `Risk LOCK` vs the prompt's literal `LOCKED` | Sol's audit PASSes "Risk LOCK" |
| B-5 | B | stale closure / missed recompute in the receipts `useMemo` | `useAgentBattle` sets a fresh object per snapshot, so identity always changes |
| B-9 | B | an absent stamp changes the markup on any of the four surfaces | All four proven equal against their pre-Phase-B twins |
| B-10 | B | zero-import broken, or `toLocaleDateString` unsafe under plain Node | 0 imports; loads under Node 22; `timeZone: 'UTC'` is universally supported |
| D-8 | D | the pane and the narrator show different symbols, order or subset | Byte-identical fact lists from one renderer |
| D-9 | D | Bench's chip and its heading can name different checks | Both from `decided.entry` |
| D-10 | D | `Filed {t}` has two sources | `file-directive.js` derives one `createdAt` for both writes |
| D-6 | D | `bbPct`'s client-side rounding disagrees with the stamp | `Math.round` is a no-op — the cron already writes an integer |

---

## 3. Mutation checks — 104 run, 0 surviving

**Survivor proof first:** every batch begins with the unmutated tree green, so a "caught" result cannot be a broken harness.

- **31 build-time mutants** (§1–§5, run per section as it was built) — 31 caught.
- **60 review mutants** (lens C) — 50 caught, **10 survived**. All ten were real gaps in the guards, not in the code: the lowercase negative (C-1), `AgentChat.jsx` unguarded (C-2), `ThisTurnStrip`'s prefix pin (C-3), the file-wide exemption (C-4), `heardLabel(null)` (C-6), the copy layer's unrecognised-stamp branch (C-8), the walk's output shape (C-9), the empty-object loop (C-10), and the two `toIso` identity mutants (C-7). Every one is caught after the fixes, re-verified individually.
- **13 fix-verification mutants** — including three that survived a *first* attempt at their own fix and had to be fixed twice:
  - `B-3b` (fragment → div): a **relative** div-count comparison counts the mutation on both sides and passes. Fixed with an absolute pin (3 unstamped, 4 stamped).
  - `B-6` (two check names): the first fix was correct but the fixture did not straddle a quarter-hour boundary, so nothing could fail. Fixed with a straddle fixture.
  - `B-1b` (cross-thread mix-up): the first screen-level fixture carried one thread, so `Object.values(receipts)[0]` equalled `receipts['t-1']`. Fixed with a two-thread row.

  These three are the review's own lesson restated: a guard written against a defect you have not actually run is a guard you have not tested.

---

## 4. Recorded, not fixed — for the founder

Each is one line to reverse, and none blocks the merge.

1. **A-5 — the provenance triplet dates nothing shown.** `fundAsOf` dates the FUNDAMENTALS block, which contributes none of the eight evidence fields; `techAt` dates the technical docs behind `regime` only. The seed asks for the triplet as **block provenance**, so it renders whenever a vintage exists. If you want it per-field, that is a spec change.
2. **A-6 — "Named at the {t} check" over a flagged name.** A name the check *flagged* sits under the heading the pane's own vocabulary defines as "a sentence named it", beside a section that says `Not named at the {t} check`. The seed prescribes the grouping (§3). A separate heading for flags is a design call.
3. **D-3 — one regime token, two words, in one pane.** `AgentActivityFeed` (mounted inside the Battle View pane at `PaneTape.jsx:223`) renders `Expanding`; Why? renders `Regime directional_expansion`. The build chose the raw token because it is what the decider's prompt actually printed (`agentEvalPromptAssembly.js:1774`, verified read-only), so "what the check saw" is literally true. Two pre-existing `REGIME_LABELS` copies live in `AgentActivityFeed.jsx:23` and `StatusFeedTimeline.jsx:18`; `decisionRecord.js` is zero-import and could serve all three. **Not a §4 breach** (an allowlist is not a translation table), but a user-visible disagreement.
4. **B-7 — the fallback's floor.** One record entry costs ≈74 estimated tokens at one held name and ≈334 at seven, so a full book on the newest entry alone is ~11% over the 300-token target even after the fallback fires. The seed's rule stops at one entry deliberately.
5. **D-7 — the negative zero.** `round2`'s documented `|| 0` fold plus the new explicit `+` makes a `-0.004` gain render `+0.00%` where the decider's CSV printed `-0.00%`. Originates in the merged server half.
6. **B-13 — a lowercase candidate symbol** would drop the Bench flag (`String(c.symbol)` server-side, no case fold). Fails closed.

**Found outside the task** (BUILD_RULES §3 — reported, not fixed): `src/components/Search/screenerAdapter.js:44` treats `bBandwidthPercentile` as a 0–1 unit interval and `voiceLayerPrompt.js:2305` documents it as `(0-1)`, while `compute-index-intelligence.js:1125` writes an integer 0–100.

---

## 5. Reviewer isolation — a process finding against myself (B-8)

BUILD_RULES §2's reviewer-isolation ruling (Sep 2) requires reviewers to work on a snapshot tree, read-only on git and the shared working tree. I gave all four lenses **one** snapshot path. Lens C's mutation harness wrote into that shared tree while lens B was reading it; lens B consumed two mutated files, produced two false failures, and refuted them itself by loading the modules under plain Node.

The letter was met — a snapshot outside the repo, `node_modules` symlinked, no writes to `/home/user/TradeSeven`, no git state changed anywhere. The spirit was not: **reviewers must not share one snapshot when any of them mutates.** Give each lens its own tree, or serialize the mutating lens.

What this does and does not cost: every finding acted on in §2 was independently re-verified in the real working tree before its fix and re-mutated after it, so no fix rests on a contaminated read. The residual risk is a *missed* finding in lenses A and D, whose reads may have been perturbed without their noticing. That risk is not zero and is recorded here rather than argued away.

---

## 6. Verification of record (post-fix, `4e237db6`)

| Check | Result |
|---|---|
| Full suite | `Test Files 635 passed \| 3 skipped (638)` · `Tests 12034 passed \| 64 skipped (12098)` · **exit 0** |
| `vite build` | ✓ built · **exit 0** (chunk-size warnings pre-existing) |
| ESLint, new files | clean (0 problems across all 5 new files and every copy module touched) |
| ESLint, touched legacy files | 28 problems — **byte-identical to `origin/main`** for the same files; none introduced |
| Mutation checks | 104 run · **0 surviving** |
| `TICK_STAMPS_ENABLED` | `false` at `featureFlags.js:2237`, untouched |
| Client imports of the flag | **0** (the only occurrence under `src/screens|components|data` is a comment in the new screen test) |
| Pane-off / flag-off goldens | green unchanged, including `AgentBattleScreen.paneOff.golden.test.jsx` |
| Grounded goldens | 18 rows green unchanged |

---

*A review that refutes nothing has not been run adversarially. This one refuted 18, confirmed 21, and found two blockers in the seam nobody had rendered.*
