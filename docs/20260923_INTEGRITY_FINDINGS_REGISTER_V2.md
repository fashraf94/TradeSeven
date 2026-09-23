# Integrity Findings Register and Adjudication — V2

**Date:** 2026-09-20
**Adjudicator:** Fable
**Covers four Astra audits:**

| Prefix used here | Audit | Baseline | Astra's own ids |
|---|---|---|---|
| **SI-** | Runtime state integrity (Sep 19) | `6cd3699a` | F01–F15, O01–O04 |
| **SEC-** | Security and abuse (Sep 20) | `0871937c` | F01–F10 |
| **DCR-** | Data consistency, concurrency, retries (Sep 20) | `0871937c` | DCR-001–017 |
| **PLC-** | Performance, latency, cost (Sep 20) | `0871937c` | PLC-001–009 |

**Status:** Rulings IR-1 through IR-16 are presented **approve-by-default**. Founder questions FQ-1 through FQ-4 need a real decision from Flash.
**Relationship to earlier work:** this register replaces the build order (§5) of `20260920_ASTRA_STATE_INTEGRITY_AUDIT_ADJUDICATION_V1.md`. That note's rulings D-a through D-o stand, except D-d and D-j, which are amended below.
**Companion file:** `BUILD_PROMPT_INTEGRITY_PRECHECK_SEP20_2026.md`.
**Changelog:** V2 (23 Sep 2026): G-series section appended from the adjudicated Expanded Capability and Reuse Audit; no prior row edited.

---

## 1. Plain-terms layer

**Four audits in two days, roughly forty distinct issues once the overlaps are merged.** Ten of the seventeen DCR findings are the Sep 19 findings again, this time reproduced by running your real code. Four of the ten security findings are also Sep 19 findings seen from the attacker's side. Two independent passes landing on the same spots is good evidence that Astra's reads are accurate.

**None of the four found a Critical, and none found evidence a beta player was harmed.** Every audit read the repo, not production.

**The forty issues are six habits, almost all in older code.**

1. **Old doors left open.** Endpoints and rules from before the server became the authority still trust what the caller sends. *(SI-F01–F03, SI-O01, SEC-F01–F04, SEC-F06, SEC-F08)*
2. **"Last seen" treated as final, "missing" treated as zero.** A battle seals whatever the last check saw. A stock whose price fails to load scores zero and the day is sealed. *(SI-F04–F06, F10, F12 · DCR-001, 004, 005, 012, 017)*
3. **Jobs that say "done" before the work landed.** A lesson fails to save and the queue is told it succeeded. *(SI-F13, F15 · DCR-010, 011, 014)*
4. **Check first, write later.** Two requests both pass the same check before either one writes, so both go through. A slow worker wakes up and acts on an old picture of the portfolio. *(SI-F07–F09 · SEC-F07 · DCR-002, 003, 006, 007, 009, 013, 015, 016)*
5. **The system can't tell a retry from a new request.** A flip whose response got lost and was sent again flips twice. *(DCR-003, 008, 016)*
6. **Fetching what it just had, and measuring almost nothing.** *(PLC-001–009)*

**Where newer work held up.** Backing, Mandate, claim resolution, the completion guard and the shared directive transaction were all tested and passed. They are the pattern the older paths need to be brought up to.

**Which ones happen in ordinary play, with no bad luck needed:**

| Issue | What the player sees | How often |
|---|---|---|
| SI-F04 / DCR-001 | The result ignores whatever happened after the last check of the day. | Every battle. |
| SI-F05 / DCR-005 | A League pick flipped overnight starts from Monday's opening price, not the next morning's. | Every after-hours flip after day one, if Astra's read holds. |
| SI-F06, F10 / DCR-004 | A missing quote scores zero and the day can't be corrected. | Any day one quote fails to load. |
| DCR-008 | A flip sent twice returns to where it started and uses two flips. | Any retried flip. |

Everything else in habits 3–5 needs two things to collide or a save to fail mid-flight. At invite-only scale most have probably never fired. The precheck (§5, step 3) replaces "probably" with a count.

**What this means for the vision.** Nothing here blocks the BaggerBomb experience. Two items touch it directly: the settled score (the Film Room headline must be the deciding score) and learning delivery (the Forge Record assumes the agent's memory is right). The League items gate the backing beta, not the core game.

**What I have not verified.** I read the reports, not the code. Ruling D-n applies to all four audits: CC confirms every citation at the start of each session, and a citation that doesn't resolve is reported as a miss.

---

## 2. The register

One row per distinct issue. "Luck" means the issue needs a collision, a failure or a bad actor to fire.

### A. Old doors — launch gate

| Issue | Ids | Luck | Home |
|---|---|---|---|
| Cron and job endpoints accept a spoofable header; some check the secret on GET only | SI-O01 · SEC-F04 | Bad actor | Step 2 |
| Anonymous callers can trigger paid earnings verification; caller sets the advisor's token limit | SEC-F06 | Bad actor | Step 4 |
| A stored `id` on an agent redirects stats and lessons to someone else's agent | SI-F01 · SEC-F03 | Bad actor | Step 4; fenced half in the `decide.js` gated pass |
| Owner-editable battle controls drive legacy proposal and meeting execution | SI-F02 | Bad actor | Step 4 (delete if dead) |
| Legacy `set-opponent` endpoint overwrites League starting prices | SI-F03 · SEC-F08 | Bad actor | Step 4 (delete) |
| Clients can write other players' game records | SEC-F01 | Bad actor | Step 7, rules arc |
| Signed-in users can read emails and other agents' memory and strategy | SEC-F02 | Bad actor | Step 7, rules arc |
| Signal Drop fetches any URL · parse cache ignores the private note · no token-revocation check | SEC-F05 · F10 · F09 | Bad actor | Waits (F10 when convenient) |

### B. Final numbers — capture build and tournament ledger

| Issue | Ids | Luck | Home |
|---|---|---|---|
| Completion seals the last-checked score | SI-F04 · DCR-001 | **None** | Capture build, FQ-1 |
| 50-trade display cap also drops realized points | SI-F12 · DCR-012 | Not live | Capture build (D-l) |
| Missing quote banks as zero; dropped positions left out of quote collection | SI-F06, F10 · DCR-004 | **None** | N1 durable fix, revised (IR-7), FQ-3 |
| Opening price stored per symbol, not per session | SI-F05 · DCR-005 | **None** | Tournament ledger, FQ-2 |
| Options resolution can finalize before the tournament ends | DCR-017 | Operator or bad actor | Open door closes at step 2; the rest waits on FQ-4 |
| Sector lost on swap | SI-F11 | Low today | Held-position parity (D-k) |
| League day with no opponent stored as win/loss; draw rendered as loss | SI-F14 | None | Step 5 |

### C. Overlap and retries

| Issue | Ids | Luck | Home |
|---|---|---|---|
| A stale decision sells the wrong stock, or trades a finished battle | SI-F08 · DCR-002 (part 1) | Collision | Step 6, small gated change (IR-6) |
| An expired worker keeps writing and clears its successor's lock | SI-F08 · DCR-002 (part 2) | Collision | Sharding spec requirement |
| Daily reset banks twice or restores an old portfolio | SI-F09 · SEC-F07 · DCR-007 | Collision | Sharding spec requirement |
| Two deploys create two active battles | SI-F07 · DCR-003 | Collision | `decide.js` gated pass (IR-6) |
| A repeated flip flips twice | DCR-008 | **Retry only** | Tournament ledger, with DCR-005 |
| One player claims two competitive seats in a week | DCR-009 | Two tabs | Tournament ledger |
| Ledger repair erases a newer confirmed holding | DCR-006 | Collision | Tournament ledger |

### D. Learning delivery

| Issue | Ids | Luck | Home |
|---|---|---|---|
| A failed memory save is reported as success; a failed acknowledgment duplicates the lesson | SI-F13 · DCR-010 | Failure | Step 5 |
| A consolidation milestone is claimed, then lost if the work fails | SI-F15 · DCR-011 | Failure | Step 5 |
| Reflection and consolidation deadlines stop waiting without cancelling the request, and can outlast the worker's budget | PLC-005 (part) | None | Step 5 |

### E. Older modes — waits on FQ-4

| Issue | Ids | Luck |
|---|---|---|
| Legacy draft join can seat five players | DCR-013 | Collision |
| A crash after Snake day five strands the battle | DCR-014 | Failure |
| Two option locks from two devices overwrite each other | DCR-015 | Two devices |
| Two entries overwrite each other and the count drifts | DCR-016 | Two tabs |

### F. Speed and headroom — after the launch gates

| Issue | Ids | Home |
|---|---|---|
| Almost no measurement; the Gemma wrapper discards token usage | PLC-007 | Rides the scaling arc's instrumentation PR |
| Forge and watchlists reload on every return | PLC-001 | First performance build |
| 4.5 MB first download | PLC-002 | Second performance build |
| Every battle re-fetches the same market facts; evaluation runs one battle at a time | PLC-003 · PLC-004 | Sharding spec requirement |
| Hidden views keep polling · full-document subscriptions · opener dedupe after generation | PLC-006 · 008 · 009 | Hygiene batch, after measurement |
| Other model deadlines (debate, daily review, compile) don't cancel | PLC-005 (rest) | Hygiene batch |

---

## 3. Rulings — approve-by-default

Object to any of these and I'll re-cut. Silence is approval.

**IR-1 — One register, prefixed ids.** Findings are cited as SI-, SEC-, DCR- or PLC-. A bare "F04" is never used again. It means final valuation in one audit and cron guards in another.

**IR-2 — This register owns the build order.** It replaces §5 of the state-integrity adjudication. D-a through D-o stand except where IR-4 and IR-6 amend them.

**IR-3 — Everything is committed before any session opens.** One docs-only PR adds the three Sep 20 reports, both adjudications, the DCR probe file and the security rules fixtures to `docs/audits/`. The probes and fixtures become the acceptance tests for the fixes. Each fix must turn its probe from "defect reproduced" to "defect gone".
Prescribed names, which the precheck prompt's step-0 gate expects exactly:
- `20260920_ASTRA_DATA_CONSISTENCY_CONCURRENCY_RETRY_AUDIT.md`
- `20260920_ASTRA_SECURITY_ABUSE_AUDIT.md`
- `20260920_ASTRA_PERFORMANCE_LATENCY_COST_AUDIT.md`
- `20260920_ASTRA_STATE_INTEGRITY_AUDIT_ADJUDICATION_V1.md`
- `20260920_INTEGRITY_FINDINGS_REGISTER_V1.md`

**A trap to fix in the same PR:** the DCR report shows the Sep 19 audit is already on `main` as `2026-09-19_ASTRA_RUNTIME_STATE_INTEGRITY_AUDIT.md`. The cron-auth build prompt and the authority Phase 0 prompt both gate on `20260919_ASTRA_STATE_INTEGRITY_AUDIT.md`. With the names mismatched, both sessions would hard-stop at step 0. Update the two gate paths to the committed name.

**IR-4 — One precheck, run before League or learning fixes are prioritized.** A single read-only script counts what has already happened. D-d is amended: its census (agents with a stored `id`, battles whose agent has a different owner) rides this script, so the authority build no longer builds a separate one. D-o stands, so nothing is repaired.

**IR-5 — The cron-auth prompt gains one line.** Its inventory records which HTTP methods each guard covers, and the shared helper runs before any method branch. SEC-F04 found handlers that check the secret on GET and skip it on POST. The options resolver is the named instance.

**IR-6 — D-j is amended in two places.**
- **The swap executor's two missing checks come forward** as a small §7 gated change: the battle is still active, and the stock being sold is the one the decision was about. D-j held this for the sharding spec. The DCR audit has since reproduced both failures against the real executor, and the Jev explanation-auditor corpus depends on it (IR-11). It opens after the eval-fixes PR merges. The worker ownership token and the portfolio version check stay in the sharding spec.
- **The double-deploy fix leaves the sharding spec.** The race is in the deploy path, not the evaluator. It pairs with the fenced one-line SI-F01 fix as one gated session on `decide.js`, with two commits. It stays Moderate, because the existing cooldown catches almost every double-tap.

**IR-7 — The missing-quote fix is folded into the N1 durable fix.** Both are in the same file and both treat a missing value as zero. Revise that prompt before it runs. The bank builds a list of every quote it needs, including dropped positions that haven't settled. An incomplete list holds the day rather than sealing it, and an incomplete final day cannot advance a bracket. Requires FQ-3.

**IR-8 — D-m is extended.** DCR-005, 006, 008 and 009 join SI-F05, F06 and F10 on the tournament ledger as backing pre-flip gate 7. DCR-005 and DCR-008 ship as one build, "flip integrity": a request id the client keeps across retries, and opening prices keyed to the session the leg belongs to. Requires FQ-2.

**IR-9 — D-g is extended.** The learning delivery task also checks the consolidation utility's explicit failure return, keys accepted lessons per battle, and cancels model requests at their deadline. A fallback reflection is stored as provisional and never enters memory as a learned lesson. That follows the honesty principle: a template sentence is not something the agent learned.

**IR-10 — One quote packet, designed once.** The performance audit wants market facts fetched once per evaluation run. The consistency audit wants them complete and stamped with their session. These are the same object. It is a requirement of the sharding spec, coordinated with the intraday arc's price-source stage, so the platform does not grow a third quote path.

**IR-11 — One identity scheme, designed once, in the capture build.** Capture Amendment A already adds unique ids and a durable per-tick record. It also carries the portfolio version, the worker generation and the player action id these audits call for. The Jev explanation auditor's collection window does not open until the executor checks (IR-6) have landed, or until capture records the intended and executed symbol so polluted ticks can be excluded. Otherwise a plumbing bug gets measured as a meaning failure.

**IR-12 — DCR-012 stays "not live".** The Sep 17 census showed 402 trades across 468 battles. The precheck confirms the per-battle maximum, which also answers the capture build's open question on it.

**IR-13 — Performance work sits behind the launch gates.** Measurement comes first, inside the scaling arc's instrumentation PR. Forge and watchlist reuse follows, then the bundle split. A screen recording of one slow journey decides between those two.

**IR-14 — The three security Mediums wait.** SEC-F10 is half a day, so it rides whichever session is nearby.

**IR-15 — Jev gains no new seam from these audits.** Every issue here has a checkable right answer, so it belongs to a transaction, a receipt or a version check. Jev never adjudicates counts, prices, ownership or once-only effects. The bookmark gains one parked row: "is this lesson supported by the battle record?", eligible only after step 5 lands.

**IR-16 — Corrections are recorded, never silent.** This extends D-o and follows the VWAP-exits precedent (a ledger fact, not a score correction). Fixes change behaviour going forward. If the precheck finds affected history, it gets a visible correction record and a separate founder-authorized task with the original inputs preserved.

---

## 4. Founder questions

These need your decision. My recommendation is given but not assumed.

**FQ-1 — What settles a battle?** *(carried from the state-integrity note, unchanged)*
*Recommendation:* the official close settles a stock battle, and crypto gets its own explicit valuation time. The result shows **settling** until the prices are in.
*Alternative:* declare the last check the settlement and say so in the UI.
*New since the first note:* the DCR audit confirmed that completion runs even when the market is closed, so a closed-market completion never refreshes prices. The precheck measures how stale the sealed score typically is, so you can see the size of the gap before ruling.

**FQ-2 — When a League pick is flipped overnight, what price does the new leg start from?** *(carried)*
*Recommendation:* the open of the session in which the exposure begins. The rule changes going forward and history is not rewritten.

**FQ-3 — What happens to a League day when a price fails to load?** *(carried)*
*Recommendation:* same shape as your N1 ruling. An incomplete day is held, not sealed, and the admin endpoint releases it once the quotes are in.

**FQ-4 — Which older modes stay reachable in the beta?** *(new)*
*The problem:* legacy draft join, the standalone Snake battle, the options arena and the earnings game account for five DCR findings and most of SEC-F01's exposure. Each needs a medium build to repair.
*Recommendation:* for the beta, gate off every mode that is not BaggerBomb or League, and retire rather than repair. The rules arc then locks those collections to server-only. That closes DCR-013 through 016 and shrinks SEC-F01 with one decision and no repair work.
*Caution:* the Snake daily cron also hosts League banking, so the cron stays and only the player-facing entry points close. I can't tell from here whether player-managed V4 battles are still reachable, so that mode isn't covered by this recommendation until the precheck reports on it.
*Data before you rule:* the precheck reports the most recent activity in each of these modes, so you can see whether anyone is using them.

---

## 5. One build order

| # | Task | Who | Fence | Gate | Closes |
|---|---|---|---|---|---|
| 0 | Docs-only PR (IR-3), including the two gate-path fixes | CC | none | — | — |
| 1 | No-code checks: Console rules match the repo · `CRON_SECRET` set in Vercel Production · hard spend caps on every AI provider · production deploys from `main` with no flag overrides | Flash | — | — | — |
| 2 | Cron auth fail-closed (prompt exists, amended by IR-5) | Opus | none | Step 1 confirms `CRON_SECRET` | SI-O01 · SEC-F04 · DCR-017's open door |
| 3 | Integrity precheck (prompt alongside) | Opus builds, Flash runs | none | Step 0 | Sizes the DCR findings · SI D-d census · informs FQ-1 and FQ-4 |
| 4 | Authority Phase 0 (prompt exists), then the authority build plus the two SEC-F06 cost fixes | CC read-only, then Opus | avoid §1 | Flash rules on Phase 0 | SI-F01–F03 · SEC-F03, F06, F08 |
| 5 | Learning delivery (D-g, D-h, IR-9) | Opus | none | After 4 | SI-F13–F15 · DCR-010, 011 · PLC-005 (part) |
| 6 | Swap executor checks (IR-6) | Fable spec, then Opus | **§7 gated** | Eval-fixes PR merged | DCR-002 part 1 |
| 7 | Rules overhaul arc: Phase 0 first | CC read-only | none | FQ-4 | SEC-F01, F02 · DCR-013, 015, 016 if gated off |

**Riding work already queued:**

| Queue | Gains | Gate |
|---|---|---|
| Capture build | Settled score · realized total separate from the display list · the identity scheme (IR-11) | FQ-1 |
| Eval-cron sharding spec, instrumentation PR first | Worker ownership token · portfolio version at every final write · transactional daily reset · one quote packet per run (IR-10) · PLC-003, 004, 007 | Existing queue |
| Tournament ledger, backing pre-flip gate 7 | N1 durable fix (revised, IR-7) → flip integrity (DCR-005 + 008) → weekly seat record (DCR-009) → ledger repair version check (DCR-006) | FQ-2, FQ-3 |
| Held-position parity | SI-F11 | Existing queue |
| `decide.js` gated pass | SI-F01 hydration line · transactional deploy claim (DCR-003) | After step 4 |
| Performance | Forge and watchlist reuse → bundle split → polling and deadline hygiene | After the launch gates and measurement |

**What gates what:**
- **Before the ~20-user launch:** steps 1, 2, 4, 6, the privacy half of step 7, and the settled score.
- **Before the backing flip:** gate 7 in full, plus the `set-opponent` removal in step 4.
- **Before the Jev explanation-auditor window opens:** step 6 and the capture identity scheme.

---

## 6. What this register does not do

- It does not touch a §1 fenced file outside a §7 gated change. Two such changes are named: the swap executor checks, and the `decide.js` pass.
- It does not repair, rewrite or recompute any historical score, stat or rank.
- It does not change scoring a player can observe until a founder question is answered.
- It does not flip any flag.
- It does not claim the audits are complete. Astra named its own gaps, and they stay open: deployed Firestore rules, live flag values, full bracket advance overlap, earnings provider adjudication, Seasons, account deletion, and any runtime performance evidence.

---

# Integrity Findings Register — G-Series Section (for V2)

**Added:** 23 September 2026 · **Source:** Expanded Capability and Reuse Audit (HEAD `f6728ffc2297fd22047ec5573b35478d3772fc93`, graded trusted 23 Sep), original citations `docs/FantasyTrades_S2_Architecture_Audit_2026-09-21.md`; founder rulings R1–R9 adopted 23 Sep (`20260923_FOUNDER_RULING_SHEET_AGENT_FRAMEWORK_V1_1.md`).
**Rules of this section:** every G identifier preserved; none renumbered, merged, or marked resolved; "narrowed" means the surviving concern remains open. New sub-findings file under existing ids, never as new prefixes: the hash-only parse binding and text-drops-URL details file under G06; the private-note cache semantics remain SEC-F10; the `partnerProfile` no-located-writer lead goes to the drift ledger, not this register. Code re-adjudication beyond HEAD `f6728ffc` belongs to future authorized sessions.

| ID | Status · Severity | Finding (short) | Ruling applied | Cross-links | Owner · Smallest next action |
|---|---|---|---|---|---|
| G01 | OPEN · High | Owner-writable control objects (executionMode, pendingProposal, gameplanMeeting) can feed alternate execution paths that do not inherit the full proposal chain; the swap executor validates the current slot occupant, not a required expected-outgoing identity, at commit. | — | SI-F02, SI-F08/DCR-002; DCR-008 related retry family, not same bug | Control/Harness · Enumerate all callers; design the expected-identity guard (fenced review). Priority 1 of the audit's ranked work. Memory cannot repair this. |
| G02 | NARROWED, OPEN · Med | Equipped guardrails are not uniformly checked on every eligible no-model tick. "All exits require a model wake" is falsified: deterministic risk-engine and meeting-suppression passes run earlier. Historical exposure bounded by the dated zero-deployed-guardrails census. | **R3**: always-run guardrail phase is the exit-dials precondition; stop beats LOCK; lands before the first dial ships. | Exit-dials arc (G-1 transfer); JEV-adjudication FR-3 (ruled); arc capture requests C-1/C-3 | Exit-dials arc · Always-run eligible deterministic phase before dial activation. |
| G03 | OPEN · High (new vintages) | Sector-cap counts (2/3/4) compared against a portfolio fraction — 0.90 ≤ 2 always passes; the cap never binds. Exposure bounded to the Mandate dark acceptance run pending stored-vintage reads. | **R4**: caps are position counts; comparator counts positions; invalid domains rejected at vintage build; new vintages only; historical vintages preserved and examined separately with authorized book evidence. | Sector-concentration-cap spec work | Mode policy + Harness · Comparator fix per R4; separate authorized read of stored vintages. |
| G04 | OPEN · High for qualification | Later-retrieved evidence can be credited to the earlier decision: hot-bench candidates lack the initial technical/regime fetch; repairs labeled `capture_refetch`; synthetic intraday volume cannot confirm RVOL (D2 correctly leaves it unknown). Capture is partial mitigation — exact request identifies what was shown, where present. | — | Held-position parity change (fenced; multiple arcs waiting); arc capture requests C-1/C-3; corpus/deployment [UR] | Harness evidence + Brain · Seal required shown evidence before decision; keep after-action context separate; abstain where setup evidence is missing. |
| G05 | OPEN · Med | Shared candidate caps can suppress an otherwise-relevant user idea's investigation. Counterevidence: multi-source attention and real bounded-research accounting exist. | — | Archetype-blind fundamentals render (spine thread); PLC-003/004 | Brain/Research · Origin/admission/exclusion accounting on the bounded candidate contract; pilot acceptance case A. |
| G06 | EXPANDED, OPEN · Med — the connective-tissue finding | Thesis reaches deployment strategy but the battle snapshot keeps ID/name/tickers only; horizon captured at parse/session and dropped at save; publication time absent; the parse→discussion handoff checks only contentHash and does not bind the submitted parse body to the stored server parse; text entry drops an entered source URL; no hypothesis/setup/cutoff ids in capture, learning, or manifest schemas. | **R6** (horizon carried; review-due expiry) and **R7** (version frozen at deploy; reject-with-new-version) govern the fix shape. | SEC-F05, SEC-F10 remain separate existing findings | Partnership contract + Harness · The versioned hypothesis contract in the pilot spec: server-authoritative parse or bound envelope; horizon and version carried through save/equip/capture. |
| G07 | OPEN · Med | Declared vs enforced differentiation: Contrarian `canEnterDistressed=true` against a global distressed-SWAP veto; some declared fields lack located consumers. Real counterweights: weights, rotation, hurdles, integrity mode. | **R2**: distressed entry per-archetype — Contrarian permitted within its risk gates, veto default elsewhere. **R1**: every declaration gets enforcement evidence or comes off the sheet. Same item as JEV-adjudication FR-2 — ruled once. | JEV-adjudication FR-2 (ruled); identity-contract conformance pass | Core policy + Brain · Implement R2; conformance pass maps each declaration to prompt/gate/test. |
| G08 | NARROWED, OPEN · Med (mode/product semantics) | LOCK can defer equipped guardrails; a fixed-slot exit may need a replacement that can fail; hedge/wait language can promise physics the mode lacks. Intended physics is not itself a defect. | **R3**: typed outcomes only (fired-replaced / fired-slot-empty / mode-blocked); Fable drafts mode-truth language tables, founder blesses. | Zone-4 language item; JEV-adjudication FR-3 (ruled) | Fable (tables) + arc builds · Language tables ride with the pilot spec. |
| G09 | OPEN · Med, capture partial mitigation | Exact packet replay does not reconstruct the whole action lifecycle; hypothesis/opportunity/setup/cutoff/state-revision joins unestablished; executor can prefer a later live beacon over the supplied price. Extend and join existing schemas — no second episode schema. | — | SI-F04/DCR-001 and SI-F12/DCR-012 remain separate incident concerns, each needing its own exact-evidence package | Harness/Capture · Extend joins on existing records; maintain permanent/text separation. |
| G10 | EXPANDED, OPEN · Med | Automatic narrative learning reaches future prompts without demonstrated Charter qualification: reflection cadence is gamesPlayed % 5 (not eligible episodes); consolidation prompt increments discipline confidence on echo and decays contraries — model-directed updating, not measured calibration; delivery durability defects are a prerequisite. Current battle's evaluation context is frozen (narrows immediate-mutation claims). | **R8** intersects: backed weeks pin the brain snapshot; memory frozen in the comparative pilot per the Charter. | SI-F13/DCR-010, SI-F15/DCR-011, PLC-005; Charter M1–M4; Forge Record Design V1.1 | Learning + Harness · Durable-delivery repair as its own package; scoped miner/estimator and evidence-linked promotion per Charter Phase B. |
| G11 | OPEN · Med — deferred to second pilot; narrow conflict verified | Mandate prompt permits ADD only from a candidate universe that excludes the held names the gate permits adding to; candidate packet underuses the book foundation. | — | Mandate mode work; kept out of first pilot per R4's scoping | Brain/Mandate · Separate held-management from new-entry universe in the contract; full enrichment with the second pilot. |
| G12 | STANDING GUIDANCE (accepted; not a defect to close) | Duplication vs over-orchestration: extract only pilot-required seams; do not consolidate legitimate separations (mode enforcers, client/server validation, permanent/retained records, historical vintages). | — | Duplicate-then-diverge law (both directions) | Architecture · Thin adapter/render seams only when a build needs them. |

**Register-wide notes from this adjudication:** capture is flipped (PR #884, ceremony intact) — no register row may describe it as dark or flip-pending; corpus, deployment, TTL enforcement remain [UR] evidence items on G04/G09. No delta on the core evaluator/swap/capture/Mandate paths between S2 baseline `1740996d`, DCR baseline `0871937c` (targeted files), and `f6728ffc` — prior SI/SEC/DCR/PLC rows carry to HEAD unchanged by this adjudication.
