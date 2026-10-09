# Build report — Enforce Readiness (Honest Unconfirmed Labels, Meeting Rationale, Governing Preset)

**Prompt:** "Build Prompt: Enforce Readiness (Honest Unconfirmed Labels, Meeting Rationale, Governing Preset)", Fable, 8 October 2026. **Session:** Claude Code, 8 October 2026, in its own worktree. **Branch:** `claude/enforce-readiness`, cut from `origin/main` at **`7631c9e6`** ("Merge pull request #943") after `git fetch origin main`. `docs/audits/20261008_BUILD_INTEGRITY_FOLLOWUP_2.md` is on `origin/main`, so there was no STOP. The desktop app named the local branch `claude/enforce-readiness-9c7ed2`; it is pushed under the prompt's name. **Fence:** none — no fenced file is edited (§0). **Founder decisions in force (8 Oct):** Q3 option (a), the new wording · Q4 both changes · Q1, Q2, Q5, Q6 untouched.

---

## Executive verdict

| Question | Answer |
|---|---|
| Does an unconfirmed outcome still get a false label? | **Not on any client surface** (§1, §2). A record carrying `executionOutcome: 'unknown'` now reads **"Argued for a swap · its outcome could not be confirmed"**, or **"A guardrail called for a swap · its outcome could not be confirmed"** when a guardrail forced the swap — on the Why? panels, the tape's check card, the character bubble, the peek line and Bench. "Held by a guardrail", "it did not go through", "Held" and "Swapped" never render for it. **One server text still does:** the narrator's YOUR RECORD block (a prompt module, in shadow mode, not sent to players) — a **STOP item** (§9). |
| Every other surface? | **Censused and fixed** (§2): 24 feed readers, 14 `evaluations` readers, 3 proposal-history readers, 0 meeting-history readers. Every surface, fed each marker, renders something true or nothing. Feed beats whose outcome could not be confirmed — the risk loop's and the R11 pass's (no line), and the model route's own two (words written before the swap ran) — now render **nothing** anywhere: the activity log (was an empty "Update" card), the League live feed (was the raw word `risk_swap_failed`, to spectators too), bookmarks, the arena voice lane, the Desk, the pulse. The census is executable: a new reader fails CI until it is ruled. |
| Table G | **Added** (V1.4, dated), with exactly the two lines above — no other new wording. Tables A–F are unchanged. The spec-versus-constants byte test and the §E sweep cover it (§1.3). |
| The meeting leg's rationale | **The server's copy** (§3). Each leg's rationale is stored in `cronState.gameplanMeeting` at creation (capped as before), and a matched leg's trade row takes the copy's. A player's edit never reaches the row — or, through it, the trade-narration prompt. A copy written before this deploy has no stored rationale and keeps today's capped meeting rationale. **A server meeting approved unedited is byte-identical** (proved against the frozen base fixture). |
| The preset on trade rows | **The preset that governed** (§4): `entryPreset` is `presetKeyOf(battle.strategyPreset)`, **resolved once per check** beside the preset table the check runs under, at all six executor calls. Well-formed presets are unchanged; a malformed or unknown one stamps `'balanced'`. No production code reads the value. |
| What changes at `off`? | §7: the copy's legs gain `rationale`; `entryPreset` for an unknown preset; two beats gain the marker on an unknown outcome; the public feed carries the marker; the client renderings above. Every existing golden is byte-identical apart from these, each with its own row. |
| Is P6 enforce safe to flip? | **Closer; not yet** (§8). The client no longer mislabels an unknown outcome. Still open: the narrator's YOUR RECORD (STOP), the outage line's "held by default" beside a marked check (STOP), the reflection prompt's `null` (pre-existing, prompt module), two workers on one battle, the rules overhaul, the size freeze. |
| Tests | **The Linux suite of record** (CI-shaped: `--maxWorkers=2`, `TZ=UTC`) at the code head: **19,419 passed, 0 failed** (19,506 rows incl. 87 skipped). **Both flips dry-run green** (`'enforce'`, `'off'`, each with its pin row); the control fails exactly the pin row. `lint:gate` and `vite build`: **green** on an LF archive of the pushed head (§10.1). |
| Review (BUILD_RULES §2) | Mandatory (41 files, ~2,060 lines changed). **5 lenses** (attacker, off/boundaries, domain/census, the required **mode-truth lens**, mutation) and **3 refuting verifiers**. **20 distinct findings: 17 CONFIRMED, 3 PARTIAL, 0 REFUTED** — the verifiers cut two severities from medium to low and refuted one lens's "common case" claim. All in-bounds defects fixed; 2 STOPs; founder questions in §9. The Linux suite itself caught one defect before the review (§10.1). Mutation: **109 mutants, 97 killed, 5 equivalent; 7 survivors in 5 test gaps, all killed by 6 proven rows** (§10.3). |
| Things for you | §9: two STOP items and five questions. |

---

## 0. Preamble

- **Session open (BUILD_RULES §2/§3).** `git fetch origin main` first: `origin/main` = `7631c9e6`. The worktree branch `claude/enforce-readiness-9c7ed2` was at `7631c9e6`, clean. Every commit staged explicit paths after re-checking the branch in the same command.
- **Commits** (`7631c9e6..`):
  - `a9e2184c` — Parts 1–3 with their tests, and table G.
  - `4362d035` — the marker moves to its own data module (the Linux suite's one failure, §10.1).
  - `f8af644d` — the §2 review fixes (ER1–ER4, verified).
  - `a8bcac33` — rows that kill the mutation lens's survivors (ER5).
  - this report.
- **Boundaries.** Edited none of: a fenced file (BUILD_RULES §1); `firestore.rules` or `test/rules/`; the capture schema or serializer (`api/_utils/tickCapture/captureConfig.js`, `captureSerializer.js`); the cockpit matcher (`api/_utils/callRecords/flip.js`, `heard.js`); any prompt module or tool schema (every module in `PROMPT_CONTRIBUTING_MODULES`, `voiceLayerPrompt.js`, `agentReflectionUtils.js`, `agentEvalToolSchema.js`). `SWAP_IDENTITY_MODE` is still `'shadow'` (`src/config/featureFlags.js:3151`). No player-facing wording beyond table G. The meeting deadline and the approval window are untouched.
  - **A data-path effect on prompts, without editing them (review ER2-2):** `voiceLayerPrompt.js` renders `trades[].rationale` (RECENT TRADES, the review one-liner) and `closedTrade.rationale` (trade narration). For a leg of a meeting the player edited, that text is now the server's sentence instead of the player's capped text; for an unedited meeting it is byte-identical. No prompt module renders `entryPreset` or the new beat keys.
  - **Fenced code called, not edited:** `executeSwapServer` (`api/_utils/agentSwapExecution.js`) at its six sites; `buildSwapReceiptSource` (`agentRiskManager.js`); `getCurrentTradingDayServer` (`agentEvalPromptAssembly.js`). Read only: `agentGuardrails.js` (the `reinforced_haiku` shape).
- **Linux runs** used a private WSL clone (`~/pd-er`); the shared `~/pd-amendd` was not touched. No production data was read and no credentials were loaded.
- **Reading order.** BUILD_RULES first; the inputs the prompt named (the follow-up 2 report's §5, §8 row 4, §11; the language tables). `docs/README.md`'s League Tournament reading order applies to League Tournament builds; this build touches its pane only for the live feed (§2).
- **Citations** are `path:line` at the code head `a8bcac33` unless marked *base* (`7631c9e6`); its product code is `f8af644d`'s (the last commit adds test rows only). VERIFIED means read in this session.

---

## 1. Part 1 — no false label for an unconfirmed outcome

### 1.1 The model route (the STOP item of follow-up 2, §8 row 4)

The cron's model route writes a check whose executor threw and whose read-back failed as `{decision: 'HOLD', downgraded: true, validationErrors: [], executionOutcome: 'unknown'}` (`api/cron/agent-evaluate.js:3928`, `:4351`). Before this build the client read it as a guardrail hold — "Argued for a swap · held by a guardrail" — or, guardrail-forced, "A guardrail called for a swap · it did not go through" (VERIFIED, base `selectWhyState.js:165-200`).

**Now** (`src/screens/battleView/selectWhyState.js:160-211`):

| The record | Label | Footer |
|---|---|---|
| Marked, a guardrail forced the swap (the D-70 gate: a `guardrail_` source note and a `forced_exit` override) | "A guardrail called for a swap · its outcome could not be confirmed" | "The system's reason" |
| Marked, every other swap (the model's own, a `reinforced_haiku` one) | "Argued for a swap · its outcome could not be confirmed" | "The agent's own words" |

- **Order.** Only the absence of an entry for the check comes first. The guardrail-forced marked shape is read **before the engine-outage line too**: when the model call fails, `applyGuardrails` still runs and a stop breach can force a swap, so an outage tick can carry this record (reviews ER3-3 / ER4-4). The founder's rule — a marked record renders table G — governs it; the outage line used to hide the guardrail's swap behind "No decision recorded". A marked outage entry without the guardrail gate is not a shape the cron writes; it keeps the outage line rather than credit the agent with an argument. Then the agent variant, then the decision states.
- **Footer.** The footer names only whose words follow (the one motive-author rule on the raw rationale). The other footers' outcome clauses — "the system held it", "the position stayed as it was" — are unproven here. It shows only where words do (review ER4-6).
- **Labels for every other record are unchanged** — SWAP, a real HOLD, a guardrail hold, a real refusal or failure, and a swap that landed after an executor error (`executionLanded`), which stays "Swapped · OUT → IN". Rows in `selectWhyState.test.js` ("table G (V1.4)").
- **Where it lives.** The two labels are in `src/data/decisionRecord.js:155-157`, re-exposed by `battleViewCopy.js:272-273`. The marker's value and the record-shape predicates are in the new zero-import `src/data/executionOutcome.js`: the marker's wire value is the word `unknown`, which `deskHonesty.test.js` bans from the vocabulary module (the Linux suite caught it, §10.1).

### 1.2 Every other surface

The census (§2) found every client surface that can receive a marker. The rule applied: a surface that renders a marked record renders table G's label or nothing. In particular, **a feed beat whose outcome could not be confirmed renders nothing anywhere**:
- The risk loop's and the R11 pass's beats carry `message: null` (follow-up 2, Part D).
- The model route writes two beats on such a check — its own status line (`action: 'hold'`) and the guardrail's ("… Forcing exit → AMD."). Both are words written **before** the swap ran, which the record cannot vouch for. This build stamps the entry's marker on both (`agent-evaluate.js:4089`, `:4110`; reviews ER4-3 / ERV4-1).
- The public projection now carries the marker (`api/_utils/tournamentBattleView.js:64`), so a spectator's pane drops these beats exactly as the owner's does. The marker is a fact about the trade, not the agent's reasoning.

The check's own words stay where the record is labelled: the Why? panel and the tape's check card, under table G's label.

### 1.3 Table G, as added

Added to `docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md` after table F, with the V1.4 note in the header, on the table and in the footer. Tables A–F are unchanged (byte-compared). The two rows, verbatim:

| Record | Client label |
|---|---|
| `executionOutcome: 'unknown'` (the agent's swap) | "Argued for a swap · its outcome could not be confirmed" |
| `executionOutcome: 'unknown'` (a guardrail-forced swap) | "A guardrail called for a swap · its outcome could not be confirmed" |

**Added lines: these two, and no others.** The rules paragraph quotes only existing labels ("Held", "Swapped", the two base labels, the author lines). The census needed no further phrasing: every other surface renders nothing for a marked record.

**Tests:** `api/_utils/swapIdentity.test.js` "table G, verbatim (V1.4 …)" — the spec's table G holds exactly the two rows, each equals its constant byte for byte, table F's parser is now bounded by its own section (it would otherwise have absorbed G), and the dated notes are present. The §E sweep now covers table G's constants and its rows as the spec states them.

---

## 2. The surface census

**How.** Three read-only census agents swept `src/` (and the server texts the client shows), then the domain lens and its verifier re-checked every disposition (§10.2). The result is pinned in `src/data/unconfirmedOutcome.census.test.js`: it scans `src/` with comments stripped and fails CI when a new file reads the feed, `evaluations`, `proposalHistory`, the meeting history, a marker field or a decision field without a ruling.

### 2.1 Decision records (`evaluations[]`)

| Surface | Live? | Before | Now |
|---|---|---|---|
| Why? row and book panels (`WhyPanel.jsx`) | live | "Argued for a swap · held by a guardrail" + "The agent's own words · the system held it" (or the guardrail failure pair) | Table G label + author footer (only under words) |
| Tape check card (`buildTape.js` → `TapeCards.jsx`) | live | same false label | Table G label; never folded into a "no change" run |
| Character bubble (`deriveBubble.js`) | live | false label in the eyebrow | Table G label, ruled colour |
| Peek line (`derivePeekLine.js`) | pane-off branches | false label | Table G label |
| Bench (`selectBench.js`) | live | "the system held it" footer | Author footer |
| League pane "The agent's read" (`Flat6BattleView.jsx:226`) | live | motive only, no label | unchanged — no label |
| Turn line, cockpit, heard, evidence, intraday | live | no decision label | unchanged |
| Forge stats (`forgeStatsService.js`) | live | the model's own citations | unchanged |

### 2.2 Feed beats (`statusFeed`)

The marked beats: the risk loop's and R11 pass's line-less `risk_swap_failed` (C1, C5), and the model route's status and guardrail beats (C2). Beats with `executionLanded` are ordinary success beats (true: the trade landed) and render as before.

| Surface | Live? | Before (for a marked beat) | Now |
|---|---|---|---|
| Activity log (`AgentActivityFeed.jsx:667`) — PaneTape's log, GameTapeView's full log | live | an "Update" card with no body (C1/C5); the model's pre-execution line in the grouped low-tier rows; the guardrail's "Forcing exit" line on an "Update" card | **not rendered** |
| League live feed (`Flat6BattleView.jsx:200`) | live (classic column; spectators) | the raw word `risk_swap_failed`; the pre-execution words | **not rendered**, dropped before the 8-line window |
| Pane bookmarks (`PaneTape.jsx:91`) | live | "No details available" | **no row** |
| Game Tape bookmarks (`GameTapeView.jsx:496`) | dormant under the pane | `RISK_SWAP_FAILED KO → AMD` + "No details available" | **no row** |
| Arena voice lane (`statusFeedToVoice.js:59`) | live | dropped (no text) but cost a window slot; worded beats quoted as the agent | **not rendered**, dropped before the 6-line window |
| Desk latest line (`baggerbombAdapter.js:277` → `AgentDesk.jsx`) | live | nothing (no message) or the pre-execution words | **no line** (never an older line standing in as current) |
| Desk breakthrough alerts (`LiveActivityPanel.jsx`) | live | admits `gameplan_meeting` only | unchanged |
| Pulse (`LiveActivityPanel.jsx:104`) | dormant | the pre-execution words | "Agent is active." (its existing neutral line) |
| Presence face (`presenceBinding.js`) | live (pane off) | swap actions only — no event | unchanged |
| AgentChat flag-off trade line | dormant | swap actions only | unchanged |
| Chat tape (`buildTape.js`) | live | renders no beat message or action | unchanged |
| Forge citation card | dormant | counts the beat's cited rule (the rule did call for the exit) | unchanged |
| Unread dot (flag-off) | dormant | counts feed length | unchanged |
| `AgentFilmRoom.ARCHIVED`, `AgentStrategyTab.ARCHIVED`, `StatusFeedTimeline`, `HypothesisTicker` | **dead** | — | unchanged (no importer / never rendered) |
| Pass-throughs (`useAgentBattle`, `AgentBattleScreen`, `useAgentPresence`; `ArenaHeader` / `CharacterAvatar` / `CharacterPane` / `shadowCpuQuoteIntegrity` pass `statusFeed: null`) | — | — | unchanged |

### 2.3 Histories and the other markers

| Marker | Where it lives | Client reader | Shows |
|---|---|---|---|
| `auto_execution_unknown`, and `executionOutcome` / `executionLanded` on a proposal row | `proposalHistory` (dormant paths) | `AgentChat.filterUnansweredProposals` | nothing — it admits `lapsed` only |
| `heldLegs`, `heldLegCount`, a leg's `not_run` / `unknown` / `executionFailed` / `refusalReason` | `gameplanMeetingHistory` | **none** | nothing |
| `executionLanded` | success beats, the SWAP entry, history rows | every beat/entry surface | the swap that happened (true) |

**Server texts the client shows:** the trade-narration and review prompts read no marker (`detectTradeProvenance` ignores `auto_execution_unknown`, a dormant path). The narrator's YOUR RECORD and the reflection prompt are §9 items.

---

## 3. Part 2 — the meeting leg's rationale from the server's copy

- **Creation.** `serverMeetingCopy` stores each leg's `rationale: clientText(leg.rationale)` — capped exactly as the trade row always capped it (`api/_utils/meetingCopy.js:77-85`). The copy is written in the same update as the meeting (`agent-evaluate.js:2526`).
- **Approval.** A matched leg's metadata is `rationale: clientText(legRationaleSource(run, swap))` (`agent-evaluate.js:6159`): the stored leg's rationale when the copy carries the key, else the meeting's (`meetingCopy.js:95`). A planted rationale — longer, an object, a number — never reaches the trade row, the executor's metadata or the narration queue (`closedTrade.rationale`).
- **A copy written before this deploy** has no `rationale` key: its legs keep today's behaviour, the meeting's rationale capped at 1000. Only a meeting in flight at deploy time can have one; a copy written after the deploy always has the key (a non-string stores `null`). The shared test fixture deliberately builds the pre-build shape (its docstring now says so — review ER1-3).
- **Byte identity.** `agent-evaluate.meetingCopy.baseline.test.js` runs each approved scenario again with a copy that carries the rationale (as the server now writes it) and holds it to the **frozen base fixture** — every battle write, executor argument, prompt hash and summary equal once the copy key is lifted. No recapture was needed: the base cron ignores the copy.
- **Not changed:** the meeting's history row still copies the meeting's own legs (`meetingHistoryBase`), as today — owner-writable anyway, and read by nothing (review ER3-5).
- **Rows:** `agent-evaluate.meetingCopy.test.js` "enforce readiness — the matched leg's rationale is the server's copy" (at off/shadow/enforce, planted strings and non-strings, a `null` stored rationale, the pre-deploy copy, unedited parity, the pure helpers) and the creation-copy rows at every mode; the baseline's six new-copy scenarios.

---

## 4. Part 3 — the governing preset on trade rows

- **The stamp.** `const governingPreset = presetKeyOf(battle.strategyPreset)` is resolved once, beside the preset table the check runs under (`agent-evaluate.js:1049-1050`), and every executor call stamps it: C1 `:2012`, C2 `:3622`, C3 `:5077`, C4 `:5348`, C5 `:5744`, C6 `:6161`. The three handlers receive it as a parameter.
  - **Why once** (review ER1-1, CONFIRMED by its verifier): a refresh after a committed swap merges the whole document back into `battle`, so re-reading `battle.strategyPreset` at each call let an owner's mid-tick change (the live preset badge) label a later row with a preset the decision never ran under.
- **The stored proposal's preset** is no longer read (`api/_utils/executorMetadata.js:143-146`); before, it was spread after the floor and won at the dormant C3/C4 paths. So a dormant proposal's row now carries the preset at resolution, not the one stored at creation (review ER2-1; both paths are unreachable at launch).
- **Well-formed presets are unchanged** ('aggressive', 'balanced', 'defensive' map to themselves); a malformed or unknown value — a number, an object, `'constructor'`, a case variant, an overlong string — stamps `'balanced'`, the table it actually ran on.
- **The static guard** now treats `entryPreset` as a server-only key: a capped owner string (`clientToken(battle.strategyPreset)`) fails CI at any call.
- **Rows:** the guard's behavioural half (planted string → 'balanced' at all six callers × three modes; 'aggressive' / 'defensive' unchanged at all six), the mid-tick change row, the static resolve-once row, `playerFieldShapes`, `proposalForgery`, `executorMetadata.test.js`.

### 4.1 Every reader of `entryPreset`

| Kind | Reader |
|---|---|
| **Reads the value** (production) | **None.** The only one, `proposalDescriptiveMetadata` (`executorMetadata.js`, base `:145`), is removed by this build. |
| Key name only | `EXECUTOR_METADATA_KEYS` (`executorMetadata.js:36`), the allowlist; `scripts/census-planted-proposals.mjs:79` (`TRADE_ROW_KEYS`, built from the allowlist). |
| Whole-row pass-through (never reads the field) | the executor writes the row (`agentSwapExecution.js:403`, fenced, read only); `landedTrade.readLandedTrade`; the owner's battle subscription and `api/tournament/battle-view.js` for the owner or a completed battle (the live public projection's `PUBLIC_TRADE` excludes it); `agentReflectionUtils.js` (spreads rows, renders named fields); trade narration (named fields); `callRecords` (named fields); the film tape (named fields); `scripts/calibration/export-agent-battles.js` (dumps documents). |
| Written, never read | the dormant proposal-creation path stores raw `battle.strategyPreset || 'balanced'` on `pendingProposal.evaluationMetadata` (`agent-evaluate.js:4000`); nothing reads it now (review ER2-3). |

---

## 5. Acceptance results

| # | Row (the prompt) | Result | Proof |
|---|---|---|---|
| 1 | A model-route record with `executionOutcome: 'unknown'` renders the new label (agent and guardrail variants); "Held by a guardrail" and "it did not go through" never render for it; SWAP, real HOLD and real refusal labels unchanged | **Met** | `selectWhyState.test.js` "table G (V1.4)" (12 rows incl. four mutation rows and a source tripwire); `WhyPanel.render.test.jsx` (12); `unconfirmedOutcome.surfaces.test.js` (8) |
| 2 | Every surface from the census, fed each marker, renders something true or nothing — no blank, "null" or "undefined" | **Met** | `unconfirmedOutcome.census.test.js` (the census pins + the voice lane and presence rows), `unconfirmedOutcome.feed.jsdom.test.jsx` (activity log, pane and Game Tape bookmarks, pulse), the Flat6 pane rows (owner and the real public projection), `AgentDesk.render.test.jsx`, `AgentChat.test.js`, `decisionRecord.test.js`, `tournamentBattleView.test.js`, `agent-evaluate.retrySafe.test.js` (the two marked beats at every mode) |
| 3 | A matched leg's trade row carries the copy's rationale; a planted rationale never reaches the row; a pre-deploy copy falls back as stated; a server meeting approved unedited is byte-identical | **Met** | §3 |
| 4 | `entryPreset` is the governing preset at all six calls; well-formed rows unchanged | **Met** | §4 |
| 5 | Table G: spec-versus-constants byte test and the §E sweep | **Met** | §1.3 |
| 6 | Every existing golden byte-identical except the intended changes, each with its own row; flips green at `'enforce'` and `'off'`, the control failing only the pin row | **Met** | §7; §10.1 |
| 7 | Full suite, `lint:gate`, `vite build` | **Met** | §10.1 |

---

## 6. Where the build departs from, or reads, the prompt

| # | The prompt said | The build does | Why |
|---|---|---|---|
| 1 | "census every client surface that renders a record or beat carrying one of the markers" | Also stamps the marker on two beats that did not carry it — the model route's own status beat and the guardrail's beat on the same check — and drops them | They sat beside a marked entry saying "Hold" / "Rotating KO → AMD…" / "Forcing exit → AMD.": words written before the swap ran, which disagreed with the Why? panel about one check (BUILD_RULES §9; reviews ER4-3, ERV4-1). The founder may prefer to keep the words (§9 Q3). |
| 2 | (unstated) the public projection | `executionOutcome` joins the public feed allowlist | Without it a spectator's pane rendered what the owner's no longer does |
| 3 | "when a decision record carries `executionOutcome: 'unknown'`, the client renders [table G]" | Read ahead of the engine-outage line for the guardrail-forced shape; an agent-variant marked outage entry (not a shape the cron writes) keeps the outage line | §1.1 |
| 4 | "`entryPreset` … is `presetKeyOf(battle.strategyPreset)`" | The same expression, resolved once per check | Review ER1-1: re-reading it per call could name a preset the decision never ran under |
| 5 | "Where a line is needed for an unconfirmed outcome, use the same phrasing" | No surface needed a line: every other surface renders nothing | Keeps table G to the two lines |
| 6 | (unstated) where the marker value lives | `src/data/executionOutcome.js`, not `decisionRecord.js` | The vocabulary module may not carry the resolver word `unknown` (`deskHonesty.test.js`) |

---

## 7. What changes at `off` (and at every mode)

| # | Change | Before | After | Rows |
|---|---|---|---|---|
| 1 | The meeting copy's legs | `{symbolOut, symbolIn, swappedInAt?}` | `+ rationale` (capped) | off-golden "the intended change: the creation write…", `meetingCopy` creation rows |
| 2 | A matched leg's trade-row rationale | the meeting's (capped) | the copy's — identical for an unedited server meeting | §3 |
| 3 | `entryPreset` | the owner's capped string at call time; the stored proposal's at C3/C4 | the governing key, resolved once; `'balanced'` for an unknown one | §4 |
| 4 | The model route's status beat and guardrail beat on an unknown outcome | no marker | `executionOutcome: 'unknown'` (absent otherwise) | `retrySafe` (12 rows) |
| 5 | The public feed | no marker | carries `executionOutcome` when present | `tournamentBattleView.test.js` |
| 6 | Client | the false labels and renderings of §2 | table G; marked beats render nothing | §5 rows 1–2 |

Everything else is byte-identical: the executor off golden, `tickStamps` (six files), `tickCoherence`, the call-records off golden (only its intended copy row moved) and the meeting baseline differential (frozen base fixture, unchanged SHA).

---

## 8. Is P6 enforce safe to flip? (updated)

**Now safe (this build):**
- No client surface labels an unknown outcome as held, failed or swapped; marked beats render nothing, owner and spectator alike.
- A meeting leg's trade row (and the narration it feeds) carries the server's words.
- Every trade row names the preset that governed.

**Still open:**
1. **The narrator's YOUR RECORD** (`api/_utils/voiceLayerGrounding.js:180-191`, a prompt module) labels a marked entry "held by a guardrail" / "it did not go through". It is in shadow (`VOICE_GROUNDING_MODE = 'shadow'`), so no player reads it yet — **STOP**, §9.
2. **The outage line** "Evaluation engine degraded this tick (…) — no usable decision; held by default." (`agent-evaluate.js:4407`) sits beside a marked guardrail-forced check whose swap may have landed. Pre-existing; a true clause needs new wording — **STOP**, §9.
3. **The reflection prompt** (`api/_utils/agentReflectionUtils.js:330,339`, a prompt module) renders a line-less beat as `risk_swap_failed: null` and a marked check as `HOLD`; its lesson goes into the agent's memory. Pre-existing (byte-identical at base). Separate task.
4. **The decider's own recent-evaluations line** shows a marked check as `HOLD` (`agentEvalPromptAssembly.js`, fenced). Out of bounds.
5. **Two workers on one battle** (follow-up 2 §5.3) — the worker-lease item (founder Q5).
6. **`battle_not_active` does not stop the tick**, **the rules overhaul**, **the size freeze** — unchanged.

---

## 9. STOP items and founder questions

**STOP 1 — the narrator's YOUR RECORD.** `voiceLayerGrounding.js` chooses between "held by a guardrail", "it did not go through" and the guardrail failure label for every downgraded entry; for a marked one all three are false. A fix is a one-branch change in a prompt module (use table G's labels), out of bounds here. It matters the day `VOICE_GROUNDING_MODE` leaves shadow.

**STOP 2 — "held by default" on a marked outage tick** (review ER4-2, PARTIAL by its verifier). On a check where the model call failed and a guardrail forced a swap whose outcome is unknown, the outage beat says "no usable decision; held by default" — "by default" is false (the HOLD is a downgrade of an attempted exit) and "held" is unproven. Pre-existing. Options: (i) a table G-family clause for that beat (new wording); (ii) shorten it to "— no usable decision."; (iii) omit the beat on a marked tick (the Why? panel now shows the guardrail's table G label there).

**Questions:**
1. **The label beside a landed trade** (review ER4-1, PARTIAL — its verifier judged it true but awkward). When the read-back failed but the trade did land, the check card reads "its outcome could not be confirmed" while the trade card shows the swap. Both are true; the label is history. Keep it (recommended), or let the client show "Swapped" when a trade row matches the call's full identity?
2. **A protective exit with an unknown outcome leaves no player-visible trace** (review ER4-5). Within "or nothing". If you want a line, it needs new wording (e.g. "Protection tried to sell [SYM] · its outcome could not be confirmed").
3. **The model's own status line on an unknown check** (review ER4-3). The build drops it (the conservative reading of "never a line that claims an outcome"). Alternative: show its words under a neutral label.
4. **Which preset governs a dormant proposal** (review ER2-1): the one at creation (what the decision ran under) or at resolution (what this build stamps, per the prompt)? Only matters if the proposal paths are revived.
5. **The Film Room tape** records a marked check as `decision.final: 'HOLD'` (verifier ERV3-1). No screen renders it yet; the A2 screen build should carry the marker into the tape row.

---

## 10. Test runs and the BUILD_RULES §2 review

### 10.1 Test runs

| Run | Where | Result |
|---|---|---|
| Base (`7631c9e6`), CI-shaped | WSL Ubuntu, private clone | 19,309 passed, 0 failed (87 skipped) |
| First code head `a9e2184c`, CI-shaped, as committed + both flips | same | **19,388 passed, 1 failed** at shadow, enforce and off: `deskHonesty.test.js` "data/decisionRecord.js contains no 'unknown'" — the marker's wire value in the vocabulary module. **Fixed** in `4362d035` (§1.1) |
| Fix head `f8af644d` (before the ER5 rows), CI-shaped: as committed, → `'enforce'` + pin, → `'off'` + pin; control | same | 19,412 passed, 0 failed (19,499 rows incl. 87 skipped) at each of the three; the control fails exactly the pin row |
| **Code head `a8bcac33`, CI-shaped, as committed (`'shadow'`) — the suite of record** | same | **19,419 passed, 0 failed** (19,506 rows incl. 87 skipped) |
| Flip dry run → `'enforce'` (flag + pin row) | same | **19,419 passed, 0 failed** |
| Flip dry run → `'off'` (flag + pin row) | same | **19,419 passed, 0 failed** |
| Control: flag → `'enforce'` without its pin | same | the module exports `'enforce'`; **exactly the pin row fails** (1 of 17) |
| `npm run lint:gate` | LF archive of the pushed head | **green (exit 0)** |
| `vite build` | LF archive of the pushed head | **green (exit 0); the pushed commit is the commit that was built** |
| Emulator rules suite | — | not run: `firestore.rules` and `test/rules/` untouched |
| Windows note | CRLF worktree, targeted suites | only the platform rows known on `main` here (plain-Node ESM loads, path-separator scans, CRLF source pins, `tickCoherence` T1) |

### 10.2 The review

Mandatory (41 files, ~2,060 lines changed with this report). Run with subagents, each on **its own** LF `git archive` tree under the session scratchpad (`node_modules` by junction), read-only on git and on every other tree; a read-only base tree for comparisons. Ids are this build's own (ER·, ERV·).

- **Lenses at `a9e2184c`:** ER1 the attacker (an owner writing any allowlisted field); ER2 the off guarantee, goldens and boundaries (with its own flip runs and six mutants); ER3 domain correctness and census completeness; **ER4 the mode-truth lens** the prompt requires (every new or changed player-facing string against what the record proves).
- **Three refuting verifiers** (ERV1 for ER1/ER2, ERV3 for ER3, ERV4 for ER4), each on a fresh tree, told to refute with probes.
- **A mutation lens (ER5)**, last, on its own tree of the fix head (§10.3).

**20 distinct findings: 17 CONFIRMED, 3 PARTIAL, 0 REFUTED** (ER3-4 duplicates ER1-1; ER3-6 duplicates ER4-1). The verifiers pushed back where the lenses overreached: ER4-1 and ER4-2 from medium to low, ER4-1's "the landed case is common" refuted (both cases need a Firestore fault across the commit and the next read), ER3-7's framing corrected (the `null` predates follow-up 2).

| Id | Sev. (verified) | Finding | Verdict | Disposition |
|---|---|---|---|---|
| ER1-1 (= ER3-4) | low | `entryPreset` re-read per call — a mid-tick owner change relabels later rows | CONFIRMED | **Fixed** — resolved once (`f8af644d`) |
| ER1-2 | low | the marked status beat shows pre-execution words | CONFIRMED (judgment) | **Fixed** with ER4-3; Q3 |
| ER1-3 | nit | the meeting fixture's docstring names the wrong copy shape | CONFIRMED | **Fixed** (docstring) |
| ER2-1 | nit | C3/C4 "well-formed unchanged" not literal | CONFIRMED | Disclosed (§4); Q4 |
| ER2-2 | nit | Part 2 changes prompt text via data | CONFIRMED | Disclosed (§0) |
| ER2-3 | nit | dead write of the stored preset | CONFIRMED | Listed (§4.1) |
| ER2-4 | nit | creation-copy rows lacked enforce | CONFIRMED | **Fixed** |
| ER3-1 | low | the census did not pin `evaluations` readers | CONFIRMED | **Fixed** (+ a decision-field row, ERV3's) |
| ER3-2 | low | a `reinforced_haiku` row used an unreal shape; a mutant survived | CONFIRMED | **Fixed** (mutation row) |
| ER3-3 | low | the outage line hid table G for a reachable shape | CONFIRMED | **Fixed** — guardrail-forced shape first |
| ER3-5 | nit | the meeting history keeps the owner's leg text | CONFIRMED | No action (no reader) |
| ER3-7 | low | the reflection prompt renders `null` / `HOLD` | PARTIAL | Out of bounds; §8 item 3 |
| ER3-8 | nit | voice lane cost window slots; footer under no words | CONFIRMED | **Fixed** (both, for table G) |
| ER4-1 (= ER3-6) | low | the label beside a landed trade | PARTIAL | Spec sentence fixed; Q1 |
| ER4-2 | low | "held by default" on a marked outage tick | PARTIAL | **STOP 2** |
| ER4-3 | low–medium (policy) | marked beats render pre-execution words | CONFIRMED | **Fixed** — dropped everywhere, spectators included; Q3 |
| ER4-4 | low | "no other label" over-claimed the order | CONFIRMED | **Fixed** (order + wording) |
| ER4-5 | low | an unknown protective exit leaves no trace | CONFIRMED (observation) | Q2 |
| ER4-6 | nit | author footer under no words | CONFIRMED | **Fixed** |
| ER4-7 | nit | this report was missing | CONFIRMED | This report |

**Found by the verifiers:** ERV4-1 (low) — the guardrail's own beat on a marked check carried no marker — **fixed**; ERV1-1 (nit, dormant) — the intraday diagnostic's `presetId` is the owner's string, not the governing key (`INTRADAY_DIAGNOSTIC_ENABLED = false`) — noted for when it turns on; ERV3-1 — the Film Room tape (Q5).

### 10.3 Mutation lens (ER5)

**How it ran.** Last, on its own LF tree of the fix head `f8af644d`, read-only on git. **109 single-literal mutants** across every product change — the marker module, the labels and their wiring, the selector's branch order and footers, the panel's footer gate and colours, every feed surface's filter (and its place relative to the window), the Desk, the projection, the meeting copy and `legRationaleSource`, the cron's rationale and all six preset stamps, the handlers' arguments, the two beat markers, the descriptive-metadata read, and table G's spec rows. Each mutant is one literal replacement asserted to match once; each runs against the build's 25 test files; the file is restored and SHA-checked after every run (no mismatch in 131 runs; a final manifest check matched all 2,584 files).

**Results:** **97 killed. 5 equivalent**, each with a reason:
- M5x-23: authorship read from the rendered rationale instead of the raw one — `renderMotive` only rewrites text that keeps its `Guardrail override` head (768-input probe, 0 disagreements);
- M5x-82: `Object.hasOwn` → `in` — the copy leg is a plain deserialized object;
- M5x-99 / 100 / 101: the three handlers' default arguments — every production caller passes the key.

**7 survivors in 5 real gaps — test gaps, no product defect.** Each is killed by a row the lens proved (passes unmutated, fails under its mutants), folded in at `a8bcac33`:

| Gap | Sev. | Mutant(s) | What survived | Killing row |
|---|---|---|---|---|
| ER5-1 | low | M5x-96 | the meeting handler not passed the governing preset (its default would re-read a refreshed preset — ER1-1 back for meeting legs) | `agent-evaluate.test.js` static row; guard "ER5 — the approved meeting leg stamps the governing preset…" (also kills M5x-92 behaviourally) |
| ER5-2 | low | M5x-46 | the footer gate covering the agent variant only | `WhyPanel.render.test.jsx` "ER5 — the guardrail variant too…" |
| ER5-3 | low | M5x-54 / 55 / 56 | the panel's table G colours (teal or default) | `WhyPanel.render.test.jsx` "ER5 — table G labels wear amber…" |
| ER5-4 | nit | M5x-36 | the guardrail variant read only when downgraded (not a shape the cron writes) | `selectWhyState.test.js` "ER5 — the guardrail variant is read before every decision state too…" |
| ER5-5 | nit | M5x-52 | an empty footer element for a footer-less state | `WhyPanel.render.test.jsx` "ER5 — no footer, no footer element" |

Of the per-call preset mutants, C1 and C6 are now caught behaviourally; C2–C5 by the static count row (all fail today).

---

## 11. Out of scope — noted, not fixed (BUILD_RULES §3)

- The narrator's YOUR RECORD and the reflection prompt (§9, §8): prompt modules.
- The cockpit's pick call on an unknown outcome is filed `pick_unchosen` ("the check at its slot recorded no choice"), as it already is for a failed or refused swap (`callRecords/flip.js`, `copy.js` — out of bounds; reported by ER3, not traced end to end).
- The dormant proposal path's raw `strategyPreset` write (§4.1) and the intraday `presetId` (ERV1-1).
- A stray empty file `C:/Users/fashr/AppData/Local/Temp/erv1_edit.txt` (0 bytes) left by a verifier's mistaken heredoc, outside the repo; harmless.

---

## 12. Branch and PR

The local branch is `claude/enforce-readiness-9c7ed2` (the app's suffix), pushed as `claude/enforce-readiness`. The commits are listed in §0; this report is the last. **Pushed, PR opened, and stopped:** the founder reads CI, answers §9 and merges. Nothing here runs on a schedule; no cron entry is added. A byte-exact copy of this report is in the session scratchpad (BUILD_RULES §3).

*Build report — Enforce Readiness, Claude Code, 8 October 2026, base `7631c9e6`.*
