# FantasyTrades Agent Framework — Fable Adversarial Review

**Version:** 1.1 — supersedes V1.0 (22 Sep 2026), which must NOT be committed
**Date:** 22 September 2026
**Author:** Fable
**Status:** Final for the docs-only PR, pending founder blessing. Findings approve-by-default unless marked founder decisions.
**Reviewed documents:** `FantasyTrades_Framework_Fable_Review_Handover.docx` (Astra, 22 Sep); `FantasyTrades_S2_Architecture_Audit_2026-09-21.md` (S2, baseline `1740996d`); `FantasyTrades_Reconciliation_Addendum_V1_2026-09-22.md`; `FantasyTrades_Pi_Harness_Identity_V1_2026-09-22.md`; Astra's reconciliation response (22 Sep).

**Amendment log (V1.0 → V1.1):**
- FR-2 partially retracted and corrected: capture flip merged as PR #884 with ceremony intact; "flip pending" and "zero corpus" withdrawn; G04/G09 OPEN with capture as partial mitigation.
- FR-4 resolved to residuals via the Pi/harness identity record; firewall stands; Hermes execution-adapter target recorded UNDECIDED.
- FR-5 corrected: intraday collection live since 21 Sep (`INTRADAY_COLLECT_ENABLED` true; PRs #886/#887); stage gates intact.
- FR-6 resolved: flat-six is S2 §I's qualification setting; BaggerBomb-embedded journey ADOPTED.
- FR-7 widened to the full prompt-influence enumeration; FR-9 resolved via the adoption stamp; FR-10 incorporated into the brief.
- New §4b: G01–G12 headline adjudication proposals for the unified register, with ledger cross-references.
- §7 superseded: the addendum's Section 10 is the audit's governing brief; two Fable additions ride the docs PR.

---

## 0. Verdict

**Ready for the expanded audit once the docs-only PR lands the prerequisite set on `main`.**

Every specified revision from V1.0 has been delivered: the reconciliation addendum anchors learning to the Charter, names the existing components, corrects both provenance errors (one of Astra's, one of Fable's), records the harness identity with honest limits, and ships a replacement Section 10 brief that folds all ten redlines. The only remaining gate is procedural — BUILD_RULES §3 plus the founder's explicit on-`main` prerequisite instruction. No design blocker remains.

## 1. Scope and evidence discipline

This review had no repository access. Evidence tiers: **[committed]** versioned documents in the project corpus; **[record]** session/ledger facts or supplied artifacts whose execution was not rerun; **[founder]** founder statements; **[verified source/history]** results of Astra's narrow read-only GitHub check pinned to `main` @ `463a375f` (22 Sep 03:36 UTC), reported in the addendum §3 and treated here as RECORD of that check; **[unverified]** deployment, runtime, data, and test execution. Plan-said ≠ code-did applies throughout: nothing here qualifies the running application; source-level adjudication belongs to the expanded audit.

## 2. In plain terms (founder layer)

The disagreement round worked. Astra was right that S2 saw the capture build — and right that the flip had already happened, which corrects both my review and our own arc ledger's "flip pending" line. I was right that the Charter, SignalDrop, and a dozen existing components must anchor the audit, and the addendum now does that. Pi is real, bounded, and honestly documented; the Hermes firewall stands untouched, with the one open piece — which Hermes instance a future adapter would ever target — recorded as undecided rather than assumed. The pilot direction is settled: the product journey lives inside BaggerBomb; the flat-six Trend Follower setting is how proposed behavior gets qualified offline before it earns any authority. What's left is mechanical: merge the document set, open the audit, and let it adjudicate the twelve G findings against code — several of which our own ledger already corroborates.

## 3. Valuable existing work to preserve

The V1.0 preservation table stands, with two updates and two additions:

- **Tick capture** — flag **true** on `main` via flip PR #884 (21 Sep, 20:58 UTC; single change commit `ed16c3f3` moving flag, true-pin, and dark-registry entry together) [verified source/history]. Deployment, active collection, corpus size, and TTL enforcement remain [unverified]. Spec V1.4 + Scope Amendment A V1.1 + the build report are the contract of record.
- **Intraday Data build 1** — merged 19 Sep; `INTRADAY_COLLECT_ENABLED` true since 21 Sep, with diagnostics, agent use, and risk activation false and price source `legacy` [verified source/history + record]. Stage gates preserved.
- **Add:** `FantasyTrades_Reconciliation_Addendum_V1_2026-09-22.md` — its Section 10 is the audit's governing brief.
- **Add:** `FantasyTrades_Pi_Harness_Identity_V1_2026-09-22.md` — the committed harness identity, including its own evidence limits (positive control passed; unauthorized-read negative control pending; controller subsequent; boundary tool-enforced, not an OS sandbox).

From the handover, the taxonomy and evidence-discipline language carry into the brief verbatim, as before. S2 itself deserves the same treatment: Sections I (pilot contracts 1–8, acceptance cases A–F) and J (founder decisions) are keep-verbatim material.

## 4. Findings — final dispositions

| ID | Sev | Disposition |
|---|---|---|
| FR-1 | High | **Delivered.** Addendum §2.1 adopts the Charter as governing; audit checks conformance (exact M1–M4, denominators, gates). G10 stays open for code adjudication — a ratified Charter doesn't prove current writers conform. |
| FR-2 | High | **Amended; partially retracted.** See below. |
| FR-3 | High | **In progress.** Addendum delivered; final commit list in §7. Register remains the sole live ledger; the audit *proposes* G fold-in dispositions in its report; a register V2 lands them afterward. |
| FR-4 | Med-High | **Resolved to residuals.** Identity record delivered at committed quality. Firewall unsuperseded; VPS ops agent, machine, credentials, peer route out of scope. Residuals: Hermes execution-adapter target UNDECIDED (a future explicit founder decision); negative control pending, so Stage 2C is not closed and Case F adapter evidence is still owed. |
| FR-5 | Medium | **Corrected.** Collection is live; V1.0's "spec'd, not built" was stale the day it was written. The honesty constraint is unchanged: monitoring vocabulary stays at verified cadence; no intraday-agent promise before the applicable stage gates pass. FD-4 refined accordingly. |
| FR-6 | Medium | **Resolved.** Flat-six originates in S2 §I as a qualification simplification, not a product. ADOPTED: BaggerBomb-embedded journey, qualified offline/advisory first. |
| FR-7 | Medium | **Widened.** Freeze = the full prompt-influence map (leans, preferences, reflections, consolidated insight, lessons, auto-debrief cron output, acceptance paths, watchlist/equip state, retrieval, model/prompt versions). Directives remain the one sanctioned in-match channel through existing gates. Rated/backed boundaries specified against Backing V1.3 + Amendments A/B. FD-2 ruled after the audit's map. |
| FR-8 | Low-Med | **Stands, sharpened.** Lifecycle is a state machine — transitions, expiry, ownership, and post-equip semantics before sizing. G06 adds the decisive fact: the battle snapshot keeps only tickers/name/ID, so the thesis does not survive into the running loop — reconstruction via the equip hash is not live influence. Id carriage to capture: direct vs reconstructed is an audit question. |
| FR-9 | Low | **Resolved.** Adoption stamp lands in the docs PR; D-24 and the J1→J2→J3 ordering preserved in the brief; corpus readiness requires evidence, not a flag. |
| FR-10 | Low | **Incorporated.** The 14 Sep Speculator incident is a named trace case in §10.6. |

### FR-2, amended in full

**Retraction:** V1.0 claimed G04/G09 were "closed on paper" and that S2's baseline might predate the capture merge. Wrong on both. S2 explicitly inspected capture (serializer, request/response storage, identifiers, retention), and the flip merge is an ancestor of S2's baseline. **Also retracted:** "merged dark, flip pending" and "zero corpus." [verified history] PR #882 built it (18:53 UTC), PR #884 flipped it (20:58 UTC) with the same-commit pin ceremony intact — no process finding. Corpus status is **unknown, not zero**; deployment, collection, TTL enforcement, and coverage are [unverified] and belong on the audit's runtime-evidence list. The project arc ledger's "flip pending" line requires the same reconciliation to #884.

**What stands:** the correction that mattered — the brief names the merged contract and the auditor extends and joins it rather than proposing a duplicate. That is now addendum §10.8, matching S2's own G09 disposition ("extend/join current schemas"). **G04 and G09 enter the register OPEN with capture as partial mitigation**, each with its distinct scope preserved: G04 is decision-visible evidence vs later observation (S2's specifics: hot-bench candidates lack the initial technical/regime fetch; capture labels the repair `capture_refetch`; synthetic intraday volume cannot confirm RVOL); G09 is the joined lifecycle through final disposition. Ledger corroboration carried as RECORD trace cases: the forced-exit pre-exit-snapshot score, the legacy approval path sharing that defect, and the Film Room −176 vs deciding +125 with no directive record.

## 4b. G01–G12 headline adjudication (proposals for the register)

Dispositions below are Fable's proposals from the design record; code adjudication is the audit's. Every G identifier is preserved; cross-references use existing register prefixes. **Namespace note:** this review's FR- ids are scoped to this document; the 19 Sep JEV adjudication's FR-1–FR-3 are distinct items — the register's source-prefixed ids disambiguate.

| G | Proposal | Ledger cross-reference |
|---|---|---|
| G01 | OPEN, high. Alternate approval paths (owner-writable proposal objects → `executeSwapServer` without the full chain). | Corroborated: the legacy proposal-approval path's stale-snapshot defect is already carried forward; Part-B's committed-swap/failed-re-read fix narrowed one instance. Cross-link SI/DCR concurrency entries (stale worker, repeated flip). |
| G02 | OPEN, but **already owned**: transferred to the exit-dials arc as the dials' precondition (deterministic evaluation on the eligible-tick path, independent of model wake-up). | Exit-dials census: zero deployed guardrails ever — exposure so far is theoretical; the fix precedes the dials. Precedence (stop vs lock) is JEV-adjudication FR-3 / S2 §J's decision — one ruling, not two. |
| G03 | OPEN, high. Sector-cap counts (2/3/4) compared against a portfolio fraction — 0.90 ≤ 2 always passes. | New; no ledger conflict. Exposure bounded to the Mandate dark acceptance run (founder books) pending stored-vintage reads. Units are a founder decision (S2 §J); intersects the sector-concentration-cap spec work. No silent divide-by-six. |
| G04 | OPEN, capture partial mitigation (per FR-2 above). | Related family: held positions receive no RSI/MACD/RVOL (parity change already fenced-drafted, three arcs waiting). |
| G05 | OPEN, medium. Shared candidate caps can suppress archetype-specific investigation. | Adjacent to the archetype-blind fundamentals render (~96% byte-identical prompts) already routed to the spine thread. Fix direction matches S2: origin/admission/exclusion reasons on the bounded candidate contract. |
| G06 | OPEN, medium — **the connective-tissue finding.** Thesis reaches deployment strategy; the battle snapshot keeps tickers/name/ID only. | The pilot's Hypothesis record (S2 §I contract 3: extend saved watchlist/thesis — statement, source, horizon, evidence ids, activation/invalidation, expiry, status; deploy-frozen in the smallest pilot) is the adopted fix path. Matches Forge Record direction; no competing memory store. |
| G07 | OPEN, medium. Declared vs enforced differentiation (unused conviction/regime fields; universal distressed veto). | The Contrarian-vs-shared-distressed-veto question is JEV-adjudication FR-2 — same item, one ruling. Counterweights real: identity contract, composition matrix, integrity mode, weights/rotation/hurdles. |
| G08 | OPEN, medium. Mode-truthful exit/WAIT/horizon semantics. | Matches the Zone-4 hedge-language contradiction (founder ruling pending; Fable recommends the charter moves) and the horizon-translation decision in S2 §J. |
| G09 | OPEN, capture partial mitigation (per FR-2). | Extend-and-join; add opportunity/setup/hypothesis/evidence-cutoff/state-revision ids to existing records. |
| G10 | OPEN, medium. Automated learning changes persistent policy without qualification. | Corroborated by DCR learning-durability findings (loss/duplication) — durability is a prerequisite for qualification. Charter governs; Forge Record's LD-4 stance and the passive-user standing-consent ruling (announced auto-trial, one-tap rollback, default off) already answer part of S2 §J's auto-promote question. Freeze during the comparative pilot. |
| G11 | OPEN, medium; defer as second pilot surface per S2's own disposition. Verify the narrow ADD-slate conflict separately. | No ledger conflict. |
| G12 | ACCEPT as standing guidance rather than a defect to "fix": extract only pilot-required seams; do not consolidate legitimate separations. | Restates the duplicate-then-diverge law and its limit in both directions. |

## 5. Category roll-up and founder decisions

**Founder decisions, current queue:** FD-1 pilot surface — **ADOPTED** (BaggerBomb-embedded; offline/advisory qualification). FD-2 rated/backed freeze semantics — open; ruled after the audit's prompt-influence map. FD-3 Hermes disposition — firewall stands; the execution-adapter target is a future explicit decision, correctly recorded UNDECIDED. FD-4 — refined: which intraday stage gates the pilot's monitoring vocabulary, and whether qualified intraday monitoring is a pilot prerequisite or deferred scope; the audit documents, the founder rules. **Adopt S2 §J's product-decision table into the queue** — its sector-cap-units, stop-vs-lock precedence, live-intake-vs-deploy-frozen, completed-bar setup definition, horizon translation, and auto-promote items are well-formed; three of them are the same item as existing open rulings (noted in §4b) and must be ruled once, not twice.

## 6. Questions for Astra — ANSWERED

A1–A4: `FantasyTrades_Pi_Harness_Identity_V1_2026-09-22.md`, with evidence limits stated. A5: addendum §2.3 + S2 §I (flat-six parameters). A6: S2 delivered byte-identical (82,547 bytes, SHA-256 `3cda3071…c435c`); baseline resolved — PR #885 merge, flip ancestor confirmed; JEV discrepancy resolved by the adoption stamp. No open questions to Astra remain for this phase.

## 7. Docs-only PR — final commit list

The addendum's Section 10 **replaces** V1.0's ten redlines as the audit's governing brief (disposition map: addendum §6). What lands on `main`, per `BUILD_PROMPT_DOCS_PR_FRAMEWORK_REVIEW_SET_SEP22_2026.md`:

**→ `docs/`:** the framework handover (md rendering); Astra's reconciliation response; the reconciliation addendum V1; the Pi/harness identity V1; this review V1.1; the Integrity Findings Register V1; the register precheck prompt.
**→ `docs/audits/`:** the S2 audit (SHA-256 verified on commit against the addendum's preservation check); the Forge Record Phase 0 report (pulled from branch `docs/forge-record-phase0`).
**Edits:** the JEV adjudication receives the "adopted by founder, 19 Sep 2026" stamp; the canonical documentation index gains entries for every file above.
**Excluded:** Review V1.0 (superseded); the original handover `.docx` (optional — the md rendering governs for review purposes, the `.docx` remains the source of the extraction); the S3 vision handover (not required — flat-six provenance resolved to S2 §I); this PR's own build prompt.

## 8. Smallest defensible pilot after the audit

Unchanged in shape, now anchored: the BaggerBomb-embedded journey (SignalDrop → bounded screen with honest coverage reporting → shortlist discussion → watchlist carrying the hypothesis fields → equip → capture-recorded decisions → Film Room review citing the origin id), qualified first in the flat-six offline/advisory Trend Follower setting per S2 §I's eight contracts and acceptance cases A–F. Learning frozen for comparison, per the Charter and G10. Acceptance is journey integrity, coverage honesty, correct abstention, veto coverage, provenance, and safe failure — never trading performance; profit is an outcome measure, not proof of architecture quality.

## 9. Missing evidence register

| Missing | Affects |
|---|---|
| Deployed config, active capture collection, corpus size/coverage, TTL/index enforcement | G04/G09 adjudication depth; J1 corpus gate |
| Intraday implementation/deployment beyond the flag read | FR-5 / §10.5 monitoring honesty |
| Stored Mandate vintages and client access | G01–G03 real exposure |
| External adapter schemas, verifier API, Pi negative-control result | Case F; Stage 2C closure; FR-4 residuals |
| Observed model behavior across six archetypes | G07 beyond source mechanisms |
| Runtime behavior of everything named here | The expanded audit's job |

---

*Fable · 22 September 2026 · V1.1 — supersedes V1.0. Amendments require a version bump.*
