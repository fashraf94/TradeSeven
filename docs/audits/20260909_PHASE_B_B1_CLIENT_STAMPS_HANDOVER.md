# Phase B — B1 client half: build report and handover

**Date:** September 9, 2026
**Branch:** `claude/phase-b-b1-client-kpkbts` (harness-assigned, cut from `origin/main` @ `c8bd17dd` — the server half, PR #827, merged)
**HEAD:** `4e237db6` · clean tree · pushed, no PR opened
**Seed:** `PHASE_B_B1_CLIENT_SEED_V1.md` §1–§6 (supersedes spec §1.5 where they differ)
**Sol's pass:** `docs/audits/20260909_SOL_REVIEW_PHASE_B_TICK_STAMPS_PASS.md` — all four contracts adopted
**Review:** `docs/audits/20260909_PHASE_B_B1_CLIENT_STAMPS_REVIEW.md`

---

## 0. Preamble — git verification (BUILD_RULES §2 / §3)

`git fetch origin` was the first command of the session. `origin/main` @ `c8bd17dd` (the server-half merge); the branch was assigned by the harness and was 0 ahead / 0 behind with a clean tree at start. Recorded, per the stale-ref ruling.

**One STOP was taken.** The seed did not upload with the opening message (it was referenced by a local Windows path). I searched the uploads directory, the whole filesystem, `docs/design/` and untracked files, confirmed it was genuinely absent, committed Sol's pass — the one instruction that did not depend on it — and stopped rather than reconstructing §1–§6 from the spec. The founder re-sent it and the build ran from the real document.

---

## 1. Executive verdict

| | |
|---|---|
| **What shipped** | The client half of the tick stamps: the receipts say **Heard**, Why? says **what the check saw**, Bench says **Flagged**, and the narrator's record says both — under the two verbs and nothing more. |
| **Sections** | §1–§6, in order, **one commit each**, as the seed asks |
| **Commits** | 10 on the branch (6 sections + Sol's pass + 3 fix commits) |
| **Diff** | 28 files · +2832 / −62 |
| **Every string** | in `decisionRecord.js` or `battleViewCopy.js`. **None inline.** |
| **`TICK_STAMPS_ENABLED`** | **`false`, untouched.** Not flipped, not read by any client file. |
| **Dark at merge** | Yes. Every surface renders byte-identically to today until the founder's own flip PR. |
| **Full suite** | `635 passed \| 3 skipped (638)` · `12034 passed \| 64 skipped (12098)` · **exit 0** |
| **`vite build`** | **exit 0** |
| **§2 review** | Run — 4 lenses, 39 findings, 21 CONFIRMED / 18 REFUTED, 15 fixed |
| **Mutation checks** | 104 run · **0 surviving** |
| **State** | **Pushed. STOPPED.** No PR opened, not watching CI. |

**In one sentence for the founder:** the screen can now say *the agent heard your directive at the 12:45 check* and *here is what it saw for NVDA at that check* — and it is built so that it can never quietly upgrade either of those into *and it acted on it*.

---

## 2. What each section built

### §1 — the receipts gain Heard (`a5e63813`)

`deriveHeard(evaluations)` reads the server's stamp and the receipt card gains a second line beneath `Filed {time}`. Three outcomes:

- `suppressed === null` → **`Heard at the 12:45 PM check`** — the slot, never the exact minute (D-83). Filed keeps its minute because it names an exchange, not a check.
- a withheld directive → **`Not heard at this check`** — flat, system-owned, no reason. The four resolver words (`malformed`, `mode_not_enforce`, `epoch_killed`, `unknown`) never reach a surface: the character never received the withheld directive, so explaining the withholding in its voice would attribute a pre-prompt resolver event to it (Sol M-1).
- no stamp → **nothing**. That is every pre-flip battle and the mid-tick filing, where the cron stamped the older thread and the new one is stamped on the *next* check.

`battleViewCopy.js`'s rule 3 and the D-51 vocabulary row were amended in the same commit: `Heard` left the banned list because the record now proves it; `Holding`, `Declined`, `Honored`, `Superseded` stay out.

### §2 — Why? gains "What the check saw" (`aa3b1b86`)

`selectEvidence` reads the piece's row from the latest decided entry through the **same `>=` join** the panel applies to the words above it, so evidence and rationale can never come from two different checks. Eight facts, each saying what it is, plus a provenance line. Sol's three carve-outs are the heart of it:

- **risk `HOLD` is silent** under a "saw" heading. On an all-HOLD tick the prompt renders no RISK STATUS block at all, so HOLD is a verdict conveyed by the block's *absence*; claiming "Risk HOLD" would claim a line that was never there. The stored `reason` code is never shown either — the prompt carried a sentence, not the code.
- **`chg` is always `Gain since entry`** — it is the position's gain from entry, not today's move.
- **the provenance line names its fields** (`Latest held technical stamp · 2:29 PM`), never "technical data as of".

Eight means eight: no `rsPct`, no placeholder, no completeness rule. A null metric renders nothing.

### §3 — Bench renders the fact of the flag (`681a71cf`)

`selectFlagged` intersects the entry's `potential_entry` candidates with the bench roster, in roster order. A flagged name moves out of "the rest of the roster" into the `Named at the {slot} check` group with a `Flagged` chip. **The fact of the flag is the whole payload** — `flagged` is a list of strings, so `signalSummary`, `threshold` and `signalSource` have no field to ride on. A row serialises the entire selector output and asserts none of the four leaks.

### §4 — the narrator's record gains both (`d99e4bd3`)

Under `'on'` / canary only. The CURRENT DIRECTIVE line gains `· heard at the {slot} check`; a withheld thread leaves the line **unchanged** — no negative, no reason. Each entry gains a compact evidence line per held position under `What this check saw:`, rendered by the **same** functions the pane uses, so one check cannot get two vocabularies. The evidence has a 300-token budget and falls back to the newest entry only; the cost is measured on the evidence's *contribution*, so a long rationale can never push it off the record. The grounding rules gain the sentence that names the limit of both verbs.

### §5 — the copy guard learns the two verbs (`18a51ce9`)

`PHASE_B_FORBIDDEN` adds fifteen terms across the client copy and the narrator's rendered record. Two families are **scoped** rather than banned outright, and the scoping is the point:

- `changed` / `moved` / `today` are banned **beside `chg` only** — all three are legitimate elsewhere ("This piece today", "No check yet today"), so the guard reads the *rendered* evidence and pins the label instead of outlawing three ordinary words.
- `considered` / `caused` are checked on the narrator's **rendered record**, not its source, because the grounding rules must *name* both words in order to forbid them to the model. The exemption is sentence-scoped and a row proves it is still earned.

### §6 — the ledger and the errata (`1a9d2764`)

D-110 → D-115 appended after D-109, each carrying the amendments the build and Sol's pass made. The spec gains a **V1.1 errata** section rather than an edit in place: the V1 text was committed byte-exact before the build, so the correction of record sits beneath it as a twelve-row table of what V1 says, what is true, and which finding moved it.

---

## 3. Three defects the build introduced, and what caught them

Reported plainly, because the way each was caught is the useful part.

1. **A wrapper div that broke the dark guarantee.** §1 stacked the receipt row and the Heard line in a flex-column wrapper that rendered **unconditionally**, so every pre-flip battle — every battle today — gained a div it never had. My own §1 rows could not see it: they compared two renders of the *same new code*. `AgentBattleScreen.paneOff.golden.test.jsx` caught it, because it is the only check in the repo that compares a whole screen against a recorded photograph. Fixed in `caeb20f7`, with a local guard added so the next person sees the failure where the code is.

2. **The whose-words footer over no words.** §3 widened Bench's named-group gate to admit a flag with no sentence, but the D-80 footer's own gate did not widen with it — so a group holding only a `Flagged` chip carried "The agent's own words" over a bench name the agent wrote nothing about. Two review lenses found it independently.

3. **The screen's join was never tested.** The two lines connecting the record to the surfaces had no coverage at all; replacing either with `null` left the suite green while the feature rendered nothing. Because the flag ships dark and the only stated verification is "the flip is the smoke", a dead join would not have surfaced until the flip, against live battles. `AgentBattleScreen.tickStamps.jsdom.test.jsx` now mounts the screen with the doc shape the cron actually writes.

---

## 4. Build decisions for the founder (each one line to reverse)

1. **The regime renders the RAW TOKEN** — `Regime directional_expansion`, not `Expanding`. The seed's own example writes the token, and the decider's prompt prints exactly that (`agentEvalPromptAssembly.js:1774`, verified read-only), so "what the check saw" is literally true. **Consequence:** one token now reads two ways inside one pane — the Activity Log says `Expanding`. See review §4.3.
2. **The Heard line renders only beneath `Filed {time}`** — i.e. on the current directive's card, not on Replaced/Expired cards in scrollback. This follows the seed's own wording, and it is what removes the deictic negative's false claim. **Consequence:** a replaced thread's Heard fact is not shown at all. Naming the slot in the negative (`Not heard at the 10:15 AM check`) would be the alternative; it deviates from the seed's pinned string.
3. **The narrator renders evidence on an outage entry**, matching the pane, because `promptBuilt` means the prompt was built and sent — the stamps are true there with no decision.
4. **`RISK_WORDS` is a closed list** (`LOCK`, `SWAP_OUT`, `TRAIL_STOP`, `EMERGENCY_SWAP`). A new action added to the fenced risk manager arrives **silent** until it has its own sentence, following D-81's precedent for unruled trigger types.
5. **Two pre-existing `REGIME_LABELS` copies were not re-pointed** (`AgentActivityFeed.jsx:23`, `StatusFeedTimeline.jsx:18`) — a different surface, outside the seed. Recorded for separate tasking rather than swept in.

---

## 5. Fence and rule compliance

- **No fenced file was edited.** `agentEvalPromptAssembly.js` and `agentRiskManager.js` were **read only** — to verify what the prompt actually prints for `STOCK REGIMES` and what the risk manager's action vocabulary is. Both reads are cited above.
- **BUILD_RULES §4** — no scoring math copied; `api/` imports `src/data/decisionRecord.js`, which is zero-import and Node-clean by design, and each test's import of its module *is* the dependency-surface guard.
- **BUILD_RULES §9** — the Heard walk, the evidence renderer and the provenance line each have exactly one source, shared by the pane and the narrator. The review's whole lens D existed to attack that and refuted every drift hypothesis it raised.
- **BUILD_RULES §10 / §11** — `deriveHeard.js` and `selectEvidence.js` were added to the token and motion guards' `GUARDED_FILES` and both baselines regenerated **in the same commit**, each with a real authority note rather than `UNTAGGED`.
- **No cron entry added**, no flag flipped, no protected store touched.

---

## 6. What is NOT built

- **B2** — the typed-directive transaction (D-114). Ruled, not built; it has its own review.
- **The Direct menu** (D-115) — recorded for its phase.
- **The League reader** (`Flat6BattleView`) and the arena lane — unchanged this phase, as the spec's §1.5 records.
- **Bench evidence**, the arena's Heard, the inert abort signal — not this phase.
- **The candidates first-five cap** — a spec-level rule, built in B2 (review B-5).

---

## 7. After the merge — the smoke (seed §8)

The `TICK_STAMPS_ENABLED` flip is **your own PR**, and it is the smoke. Two mechanical steps, both in the same commit as the flip (BUILD_RULES §2's flag-flip rule):

1. move the pin at `src/config/tickStampsFlags.test.js:30`
2. drop the `DARK_BY_DESIGN` entry at `src/config/flagPinGuard.test.js:96`

Crons do not run on preview, so the first **stamped production check** is the verification. Look for:

- `Heard at the {slot} check` beneath `Filed {time}` on a filed directive's card
- `What the {slot} check saw` under a held piece in Why?, with a `Flagged` chip on a bench name the decider flagged
- the battle document's size against the discovery's arithmetic (~+0.9–1.0 KB per entry)

If the narrator is at `'on'` or canary, the record's `What this check saw:` lines and the `· heard at the {slot} check` suffix appear in the same flip.

---

## 8. Verification of record

| Check | Result |
|---|---|
| Full suite (`4e237db6`) | `Test Files 635 passed \| 3 skipped (638)` · `Tests 12034 passed \| 64 skipped (12098)` · **exit 0** |
| `vite build` | ✓ built · **exit 0** |
| ESLint, the 5 new files + every copy module | clean |
| ESLint, touched legacy files | 28 problems, **byte-identical to `origin/main`** — none introduced |
| Mutation checks | 104 run · **0 surviving**; survivor proof (green baseline) first in every batch |
| §2 review | 4 lenses · 39 findings · 21 CONFIRMED / 18 REFUTED · 15 fixed · 6 recorded |
| `TICK_STAMPS_ENABLED` | `false` at `featureFlags.js:2237` — untouched |
| Client imports of the flag | 0 |
| Pane-off and flag-off goldens | green unchanged |
| Commits | `e95c2ee2` · `a5e63813` · `aa3b1b86` · `681a71cf` · `d99e4bd3` · `18a51ce9` · `1a9d2764` · `caeb20f7` · `cdede10c` · `4e237db6` |

---

## 9. STOP

B1 client half complete and pushed. No PR opened; not subscribed to PR activity; not watching CI (BUILD_RULES §2 — the founder reads CI, decides, and merges). The flag is dark and no client file reads it.

*The UI gets to say "heard" and "saw". It still does not get to quietly upgrade those into "understood", "used", "noticed", or "decided because" — and now the guard fails if it tries.*
