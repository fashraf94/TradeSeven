# Growth Loop Map V1.1 — who owns what, and the contracts between them

**Date:** 23 October 2026 (V1: 22 Oct) · **Author:** Fable (framework chat) · **For:** every chat that touches the agent's growth: archetype (ChatGPT), Practice Field, Film Room, cockpit, hub redesign, framework/pilot. · **Status:** map, not a spec; it names owners and existing contracts and changes none of them. **V1.1 folds in the 22 Oct replies from the Practice Field, Film Room and archetype chats; the changes are marked ▲.** · **Destination:** `docs/design/20261023_GROWTH_LOOP_MAP_V1_1.md`, carried by the Film Room's B2.1 docs commit in place of V1 (no docs-only PR); project copy `claude/GROWTH_LOOP_MAP_V1_1_OCT23_2026.md`.
**Checked against:** `main` at `82a7d4d5` (the #990 merge), the pilot spec V1.4 §5–§10, the Practice Field ↔ Film Room shared contract V1 (10 Oct), Practice Field concept V3 + Amendment A (21 Oct), Fable's archetype review (21 Oct), and the chats' replies of 22 Oct.

---

## 1. The loop

One loop, six stages, one owning chat per stage. The founder's three objects (§2) travel around it.

| # | Stage | What happens | Owner (chat) | State on `main`, 23 Oct |
|---|---|---|---|---|
| 1 | **Identity** | What an archetype *is*: its charter text plus a versioned rule set that acts as a gate (`tf-setup-v1` for the Trend Follower). Rules change only through a proven rule-version play. | Archetype | Definition blessed 24 Sep. Evaluator ("Measured Trend Evidence, slice 1") = the pilot spec's **P3**; the preparation prompt runs next, with this map attached. Refresh menu fix dark (`ARCHETYPE_REFRESH_MENU_ENABLED = false`, #982); Stage A dry-run tool #983. |
| 2 | **Deploy** | The player's idea rides into the battle, frozen; names get a dated setup verdict; each holding activation is recorded with its evidence. | Framework (ideas, activation evidence) + Archetype (menu labels, slice 2) | ▲ Ideas, the due-idea screen and the review card live for the allowlist (#947, #948, **#990 merged**). Menu labels unbuilt. Activation evidence: **ID-1 below, unbuilt.** |
| 3 | **Play** | The battle. The player directs through the cockpit; the agent decides; every call is tagged `hypothesisRef`. | Cockpit | Live for the allowlist since #931; Build 2b in build (Amendment D rev 4). |
| 4 | **Review** | The tape, the cards, the situation tags, the take-home card. | Film Room | V2 screen on for all (#954); `stalled` tagged every day since B1.1 (#977); ▲ B2 cards merged (#988) **but dark** (`FILM_ROOM_CARDS_MODE = 'off'`); order: B2.1 → review → allowlist (founder, FT_QA) → tester pass → `'on'`. |
| 5 | **Drill** | A tagged moment replayed with dated evidence; player and agent both call it; a play is drafted. | Practice Field | ▲ Concept V3 + Amendment A adopted; first exercise "Chase or hold" designed; **its prerequisite (B2) is in**. Not started is the founder's schedule, not a dependency; it waits on slice 1 only for the dated-evidence column, and never on P4. |
| 6 | **Install** | A proven play reaches the agent: a control play through an equip endpoint; a rule-version play mints `tf-setup-v2` and returns to stage 1. | Shared contract (Film Room + Practice Field) under the Learning Charter | Plays ledger `agents/{agentId}/plays` designed; stages `card → nominated` written by B2 (dark). Rule-version install route: **ID-4 below, now owned by the archetype arc.** |

## 2. Three objects, three owners

| Object | What it is | Where it lives | Who may change it |
|---|---|---|---|
| **Rules** | What the archetype is: the baseline `tf-setup-vN` numbers and patterns, the charter; ▲ plus, once ID-4 exists, a **per-agent active version** where a partner's refinement qualified | Code (`api/_utils/setupEvaluator/*` once slice 1 lands; `evalIdentityBlocks.js`); the agent's active version on its record | The archetype arc, by a new version only, never edited in place; the baseline by founder PR |
| **The record** | What was believed, called, verified and done: ideas and their versions, research records, call records, verifications, activation evidence, the tape | `watchlists/{id}/hypothesisVersions/v{n}` (+ `researchWork`), `agentBattles/{id}/calls`, `trades[i].verification`, the film tape | Server writers only; the framework arc owns the idea and evidence records, the cockpit arc the call contract, the Film Room the tape |
| **Plays** | What the agent has learned: control plays and rule-version plays, staged | `agents/{agentId}/plays/{entryId}`, `agents/{agentId}/drills/{drillId}` | The Practice Field, through the shared contract; nothing reaches a prompt before stage `installed` |

Standing rules that keep the objects apart: a Film Room card never becomes an idea (shared contract §7 rule 5 — ideas are the player's own); a player agreeing is never evidence for a play (Amendment A, A4). Shadow carries partnership memory across archetypes; the archetype carries the rules; the player carries the ideas. ▲ **On an archetype switch,** plays and the legacy paragraph (§3a) stay with the archetype they were earned on: shelved on the switch, restored on return (ruling 5, 10 Oct; the shelve/restore build is unbuilt).

## 3. The contracts between stages

| Arrow | Contract | Status |
|---|---|---|
| 1 → 2 | Slice 2 labels the Trend Follower's menu rows with the pre-market verdict (`setupVerdicts/{sessionDate}`), dark with #982's flag; each holding activation is recorded with its evidence on the framework arc's records (ID-1) | Slice 2 approved 21 Oct, unbuilt; ID-1 unbuilt |
| 2 → 3 | `agentContext.equippedHypothesis` sibling on the battle (P1b); calls tagged `hypothesisRef {watchlistId, hypothesisVersion}` | Built (#947), verified 14 Oct |
| 3 → 4 | Call-record contract V1.4; the tape copies `hypothesisRef` as an identity pointer (`tapeAssemble.js`, `copyHypothesisRef`) and never resolves it; situation registry v2 | Built |
| 4 → 5 | Practice Field ↔ Film Room shared contract V1: the registry, tape additions, the ledger, the drill record, one door. ▲ **Precedence:** for Practice Field builds, concept V3 §8–§9 and Amendment A supersede the shared contract's §6–§7; the Film Room's §1–§5 stand. | Adopted 10 Oct; ledger stages `card → nominated` built in B2, dark |
| 5 → 6 | Control plays install through existing equip endpoints (contract §7 rule 3); rule-version plays mint `tf-setup-vN` proven by the evaluator's replay on unseen history (Amendment A, A4–A5) | Designed; install route: ID-4 |
| 6 → 1 | The Learning Charter's maturity gates; a new rule version with the prior retained for rollback; ▲ a version names who receives it (ID-4) | Designed |
| cross-cutting | **P4**, the one fenced prompt edit: the agent reads the idea and the verdict lines and states intent (`enter \| wait(reason) \| reject(reason)`) | ID-2 |
| cross-cutting | **P5**, the believed / called / done projection the Film Room's Study section renders | ID-3 |
| ▲ 2 → 4 | The idea's review card links each carrying battle to its Film Room (`OPEN_BATTLE_REVIEW_EVENT`, #990; B2.1 reuses the event with an optional day-and-moment field, P1c's callers unchanged). Until ID-3 lands, a player arriving that way sees nothing about the idea, because the v2 screen renders no calls. An honest gap; P5 closes it. | Built (#990); the gap stands until ID-3 |

### 3a. ▲ The route that predates the loop (legacy learning)

Today a post-game reflection goes into the agent's memory window; every fifth CPU game rewrites the wisdom paragraph from it; the paragraph reaches the draft and trading prompts, and the memory window reaches the draft prompt. That route reaches a prompt with nothing at stage `installed`, so "nothing reaches a prompt before `installed`" is the **target**, not yet a claim. Its state: lessons fixed (#953); the rewrite filtered and floored at three real lessons (#960); the failure-built paragraphs' reset pending (P-RESET, script unbuilt); whether the paragraph keeps reaching the brain is open (V3 §12: decide when the first real paragraph is about to be written). The Film Room enforces the target on its own code: a census over every model path, a byte-identical trading-prompt test with and without ledger entries, and a blocking exit criterion in every Film Room build. Owner of the route's retirement or qualification: the Practice Field chat.

## 4. Named integration dependencies

Each has one owner, named suppliers and consumers, and a shape note that the consumers see before any build. Neither side assumes the other has built it.

| Id | Dependency | Owner | Supplies | Consumes | Status / next step |
|---|---|---|---|---|---|
| **ID-1** ▲ | **Activation evidence**, two parts. **(a) The dated snapshot**, per session and name: `setupVersion`, verdict, reason, pattern, regime, the anchor swing low, `basis`, `source`, `asOf` — the same object slice 2 reads for its menu labels (`setupVerdicts/{sessionDate}`). **(b) The activation pointer**, one per **actual holding activation** — the initial positions at battle creation and every executed swap-in at the executor's commit, idea or no idea — recording `activatedAt` (wall clock, kept separate from `asOf`), the `setupVersion` applicable to that agent, a frozen copy of the verdict and anchor it applied under (so a rewritten snapshot can never change it), and `hypothesisRef` when an idea rides, else null. A name with no snapshot reads `unknown`, recorded, never reconstructed or replaced by a newer low. Fence contact: the battle creation shape and the executor's commit (the seam P6 used for `trades[i].verification`). *V1's shape (one record per carrying battle on the idea version, ideas only) is withdrawn: it assumed one-day battles and left ordinary holdings outside the loop.* | Framework | Archetype slice 1 (the pure evaluator and adapter) and the verdict writer behind slice 2 | Practice Field (chart leg; `thesis_broken`); Film Room (tags `thesis_broken` from the stored record — the tape's first read past its pointer, declared by that situation's own task) | After slice 1 lands and the verdict writer's shape is known: shape note from the framework chat → archetype, Practice Field **and Film Room** chats → founder blessing → build, after cockpit 2b merges (executor contact) |
| **ID-2** ▲ | **P4, the brain splice.** One fenced build: the prompt reads the equipped idea and the verdict lines; the tool carries `structuredClaim` and intent. Three arcs wait on it: the pilot (idea → brain), the archetype arc (verdict lines), the Practice Field (agent abstention; prompt-text plays per shared contract §7 rule 4). P4 consumes the corrected volume evidence (ID-6); it does not carry that fix. | Framework | Slice 1's output shape; spec §6; Amendment A, A3; Fable's archetype review §6.1 | Archetype, Practice Field, cockpit (a Why? line) | Gates: cockpit 2b merged; slice 1 landed; M1/M2 read; FD-1 decided. Built dark under `PILOT_JOURNEY_MODE`; P7 qualifies before any flip. Phase 0 reads all three inputs. |
| **ID-3** ▲ | **P5 projection.** Owner-authorized believed / called / done over retained fields, with `legacy \| missing \| expired \| unavailable` states; the Film Room adds one Study section on `FilmRoomScreenV2` that renders the states as given, behind its own flag. **"Believed" means the player's idea version reached through `hypothesisRef`** — never the agent's own per-check `rationale[].hypothesis` text, which the Film Room quotes as the agent's recorded rationale. | Framework | Call records, `hypothesisRef`, `verificationId`, tick availability (spec §8.3) | Film Room | Shape note at P5's Phase 0, before the build; the Film Room specs its section against it |
| **ID-4** ▲ | **Rule-version install route.** How a proven `tf-setup-v2` replaces or overlays v1. The record distinguishes **qualified, deployed and active** versions and names **who receives** one: a refinement qualified for one partner never silently replaces the baseline for every user. V1 mechanism: a founder PR for a baseline change (the thresholds object is code); a per-agent active version for a partner's refinement. | **Archetype arc** | Practice Field (qualification evidence, A4–A5); Learning Charter | Framework (version selection and carriage where required: the activation pointer records the agent's applicable `setupVersion`, ID-1); Claude Code implements the approved change | Design before the first rule-version play is drafted; not before |
| **ID-5** | The hub's translator still maps the retired 409 `hypothesis_review_due` (ruling R-S2A-2); retire it with `DEPLOY_REFUSAL_CODE` and `DUE_DEPLOY_LINE` | Hub redesign | — | — | Hub slice S2b (P1c report §12) |
| **ID-6** ▲ | **The neutralized-volume line.** In session the brain is told every name's volume is `NORMAL | RVOL=1.0x` from a synthetic bar (archetype review §0.3). Producer-side `basis: 'neutralized'` marker (non-fenced) and the renderer's omission of the line (`agentEvalPromptAssembly.js`, fenced) as **its own small task** with its own §2 review — not P4's. | Archetype arc (the prompt), founder sign-off on the fenced edit | — | P4 (consumes the corrected evidence) | Sequenced by the cockpit chat against 2b (same fenced file); before P4's Phase 0 |

## 5. ▲ Open founder decisions

| Id | Decision | Why it matters here | Needed by |
|---|---|---|---|
| **FD-1** | **Battle length.** Battles longer than one day (fenced: `agentBattleService.js`, `AGENT_BATTLE_DURATION_MODE`). | Reaches Play, the tape (its multi-day re-merge is dormant today), ID-1's per-activation record (a day-3 swap-in needs day 3's `asOf`), the Practice Field's moments, the review clock's battle-ended rule (P1c), and the archetype review's "morning tool" seat for the evaluator (W2 assumed one-day battles). | Before ID-1's shape note and P4's Phase 0 |
| **FD-2** | **ID-1 part (b)** — record every actual holding activation, idea or not (adopted in this map at the archetype chat's requirement; the Practice Field had accepted the smaller V1 shape). | Decides ID-1's fence contact (creation shape + executor commit) and whether ordinary holdings enter the learning loop. | Before ID-1's shape note |

## 6. Sequencing: what can run side by side

The fenced files are the collision points: `api/agent/decide.js`, `api/_utils/agentEvalPromptAssembly.js`, the decision tool schema, `createAgentBattle`'s shape, the executor. Pieces of this map that touch them: cockpit 2b (now), ID-6 (small, prompt assembly), ID-1 (creation shape + executor commit), ID-2 / P4 (the big one, later). Everything else — slice 1 (new files), slice 2 (the dark menu helper and the verdict writer), Film Room B2.1, the Practice Field's first camp, hub S3–S8, P5 (observational) — is new files or UI and runs in parallel safely.

Order of the next steps, as agreed across the chats:
1. ~~Merge #990~~ (done, `82a7d4d5`); flip `DIALOGUE_SERVER_PARSE_ENABLED` when chosen; P6 enforce after the census.
2. The archetype arc's preparation prompt (menu findings + the evaluator build assignment), then slice 1 — unblocked now.
3. FD-1 and FD-2 decided.
4. Cockpit 2b merges; ID-6; M1 (the six real menus) and M2 (the evaluator against history) are read.
5. ID-1 shape note → ID-1 build.
6. P4 Phase 0 with the three inputs → P4 build (dark) → P7 → flip.
7. The Practice Field resumes on its own schedule; it does not wait for P4.

## 7. Vocabulary

| Say | Meaning | Not |
|---|---|---|
| Idea | The player's thesis on a list, versioned | hypothesis (internal), thesis |
| Universe | The names an idea applies to | watchlist (except the plain, idea-less case) |
| Verdict | `valid \| invalid(reason) \| unknown`, dated `asOf` a completed session | signal, score |
| Record | What was believed, called, verified, done | log, history |
| ▲ The agent's recorded rationale | The agent's own per-check text (`rationale[].hypothesis` on the tape), quoted as its words | the player's idea; "believed" |
| Play | A learned behavior at a stage of the ledger; a card at stage `card` | lesson, rule (unless rule-version play) |
| Rule version | `tf-setup-vN` | setting, tweak |
