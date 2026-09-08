# Voice-layer grounding handover — the Phase 0 build, G1 → G6 (V1)

**Date:** September 8, 2026
**Branch:** `claude/voice-grounding-phase-0-rulings-hub8kv` — pushed. **No PR opened — the founder opens it.** No flag walked.
**Base:** `0c40d14e` (the spec V1.2 + the Phase 0 report, already on the branch the task named), then the two cherry-picks the rulings prescribed.
**Status:** built, reviewed by five lenses on snapshot trees, refuted by a sixth, fixed, pushed.
**Read first:** `docs/audits/20260908_VOICE_GROUNDING_BUILD_REVIEW.md`. This handover says what is here; the record says what was wrong with it.

---

## 1. Executive verdict

| # | Item | Verdict |
|---|---|---|
| 1 | The two cherry-picks (§1) | **Done.** `70ba90a1` (the ATR fix), `0ea61f2d` (the discovery document); the off goldens were captured after the ATR pick and proved by reconstruction. |
| 2 | G1 — the flag | **Built.** String tri-state, pinned directly, out of `DARK_BY_DESIGN`, no boolean companion (ruling 3); the canary list is an env var read at call time, empty = nobody, never in the repo (ruling 2). |
| 3 | G2 — the grounded prompt | **Built.** Identity frame, YOUR RECORD, CURRENT CONTEXT with the weekly fundamentals, the one history-window rule (ruling 4), the 30-site guard, the grounded opener; the narration retired under `'on'`. |
| 4 | G3 — the check's note | **Built.** Code-composed, event-only, the lint in code, dedupe by ET day, no model call. |
| 5 | G4 — the route | **Built.** One transaction, eight checks, the budget server-derived from the game mode and charged in the same transaction (ruling 6, D-105), the audit exchange with `directiveThreadId` in both places (ruling 5). |
| 6 | G5 — chips, both clients | **Built.** Minted by id, canonical text from the server; `Files: …` files exactly what it says; one "Filed", one path. |
| 7 | G6 — shadow | **Built.** Both prompts assembled, both on the record with the mode and both windows; the old one sent under `'shadow'`. |
| 8 | Review | **Five lenses, 43 findings, 33 CONFIRMED · 9 AMENDED · 1 REFUTED; no P1; two `'on'`-only P2s fixed.** Twelve test rows or seams that could not fail were replaced. |
| 9 | Flag-off | **Byte-identical** — prompts (goldens by reconstruction), persisted shapes, responses, the record, the page. |
| 10 | Fence and ratchet | **Zero §1 contact.** Two new direct importers of the legacy table recorded in the §2.3 baseline. |
| 11 | Tests | **616 files · 10,948 pass · 64 skipped · 0 failing.** A FULL-repo figure, after the fixes. |
| 12 | `vite build` | Exit 0, before and after the fixes. |

**The headline:** the arc exists so the narrator never says what the record does not back. The review found the two places the build itself broke that rule under `'on'` — the narrator's own record crediting the agent with an argument the cron overwrote, and the prompt's own example teaching the model to mint a filing claim its tap would not honour — and every instrument I had built passed the whole time. Both are fixed with rows that red without the fix.

---

## 2. Preamble — git verification (BUILD_RULES §3)

| Item | Value |
|---|---|
| `git fetch origin` | Run first. |
| Branch | `claude/voice-grounding-phase-0-rulings-hub8kv` — the harness's designated branch. The task document names `claude/voice-layer-grounding-phase-0-i0hmxq`; the harness branch was fast-forwarded onto it (identical SHAs, the two docs commits) and is the only branch this session may push. The founder opens the PR from it. |
| HEAD at handover | `3c8da20a` (the review fixes), then the docs commit. Clean tree at every commit. |
| Test invocation | `./node_modules/.bin/vitest run` — a bare `npx vitest` fetches from the registry. |
| **Scope discipline** | **Every test figure in this document is the whole repo.** The full suite ran after G2, after G6 and after the fixes; the targeted runs between G3 and G6 missed a red scan (§7). |

---

## 3. The commits

| # | SHA | What |
|---|---|---|
| 1 | `70ba90a1` | cherry-pick — the ATR unit fix (percent vs percentile) |
| 2 | `0ea61f2d` | cherry-pick — the Phase 0 discovery document (V1.1) |
| 3 | `e53d55cb` | **G1** — `VOICE_GROUNDING_MODE`, the per-caller accessor, the direct pin, the off goldens |
| 4 | `dbbdc297` | **G2** — the grounded prompt: inputs, not authority |
| 5 | `97745aa8` | **G3** — the check's note, code-composed: the event, never the plan |
| 6 | `62105f54` | **G4** — `POST /api/agent/file-directive`: the deterministic route, one transaction (amended before push with its protected-store allowlist entry — §7) |
| 7 | `0d727251` | **G5** — chips minted by id and the receipt on both clients |
| 8 | `2b557265` | **G6** — shadow mode: both prompts assembled, both on the record, the old one sent |
| 9 | `3c8da20a` | **review fixes** — the findings that survived refutation |
| 10 | (docs) | the review record, this handover, the ledger rows D-99 → D-105 and the amendments |

---

## 4. What is here

### 4.1 New modules

| File | What it owns |
|---|---|
| `api/_utils/voiceLayerGrounding.js` | Everything the grounded prompt adds: YOUR RECORD (`buildYourRecordBlock`), the §3.2a duplicate normalizer, the fundamentals line, the history window (`selectHistoryWindow`, `buildGroundedConversationHistory`, `buildEarlierMessagesBlock`), the plan at deploy, the grounded identity / phase rules / examples / third path / elicitation lines, the 30-site vocabulary guard, the reply lint and the code-composed note, the grounded output format and `normalizeSuggestedActions`. Registered in `PROMPT_CONTRIBUTING_MODULES`. |
| `api/_utils/directiveFiling.js` | The ONE shape of a directive record and slot (`buildDirectiveRecord`, `buildDirectiveSlot`) and the battle chat budget — shared by the chat turn and the route. Zero-import. |
| `api/agent/file-directive.js` | The deterministic route: flag first, eight checks, one transaction, the audit exchange (`buildFiledExchange`), `FILING_STATUS`. |
| `src/data/decisionRecord.js` | The decision record's shared vocabulary — the trigger sentences, the absence lines, the state labels including D-70's fifth state and its gate, the motive-author rule, the deploy gates, the filing strings, the marker version and the filing type. **Zero-import**, because `battleViewCopy.js` is not Node-clean (an extension-less relative import; re-proved on every run). The pane, the tape, both chats and the narrator read it. |
| `api/_utils/__fixtures__/voiceGroundingFixtures.js` · `voiceGroundingOffGoldens.json` | The frozen battle, snapshot and exchanges every grounding test renders; the sixteen off surfaces, byte for byte. |

### 4.2 The flag and its walk (the founder's, never a build PR)

```
src/config/featureFlags.js            VOICE_GROUNDING_MODE = 'off'   → 'shadow' → 'canary' → 'on'
src/config/voiceGroundingFlags.test.js  the pin moves with it (one line, same commit)
Vercel env                              VOICE_GROUNDING_CANARY_UIDS = "<uid>,<uid>"  (for 'canary'; unset = nobody)
```

`getVoiceGroundingMode(uid)` is read at CALL time by every writer — the battle OWNER's uid for the crons and the lazy opener, the TOKEN's uid for the chat turn and the route. `'canary'` resolves to `'on'` for an allowlisted uid and `'shadow'` for everyone else; a typo resolves to `'off'`. Rollback is the same literal walked back. The gates, in order, are spec §9: ≥20 real shadow turns into the paired harness, the founder's read of the pairs, one canary trading day, `'on'`. **The p50/p95 reader for `shadow/conversations` is a separate task (spec §12); the shadow record now carries `voiceGroundingMode`, `systemPromptOld`, `systemPromptNew`, `conversationHistoryOld`, `conversationHistoryNew` (and `shadowAssemblyError` when the counterpart failed).**

### 4.3 What a player sees under `'on'` that they did not before

- The narrator speaks from YOUR RECORD and CURRENT CONTEXT; its earlier messages are conversation, not evidence.
- The check's note is one sentence about the event, at most one per (symbol, direction, day); the trade narration is gone (the trade card is the notice).
- Chips read `Files: {canonical text}` and file through the route; the receipt is `Filed {time}` on the card (Battle View) or in the lane (arena); a grounded null-write turn says `No change made to your strategy this turn.`; a `potential_exit` note wears `Holding note`.
- The lazy opener names the book and the plan at deploy; **the deploy-time opener generated inside fenced `decide.js` does not** (§6).

### 4.4 New strings

In `src/data/decisionRecord.js` (one source, both surfaces): `Files: ` · `Filed {time}` / `Filed` · `No change made to your strategy this turn.` · `The current directive changed before this could be filed — nothing was filed.` · `No messages left to file with — nothing was filed.` · `That option is no longer on the menu — nothing was filed.` · `The directive could not be filed just now.` · `A guardrail called for a swap · it did not go through` (moved, byte-identical). In the arena dock: `Filing…`. In the tape copy: `Holding note` (grounded exit notes only). Everything the prompt says is in `voiceLayerGrounding.js`, swept by the honesty registry and the 30-site guard.

### 4.5 Tests

Twenty new or extended files; the ones worth knowing about:

- **`voiceLayerPrompt.grounding.goldens.test.js`** — sixteen off surfaces byte for byte, regenerable ONLY from a pre-grounding tree (the header says how; lens 3 rebuilt that tree and matched the file).
- **`voiceLayerPrompt.grounding.test.js`** — the 30 sites present in the off surface each names and absent from every grounded one; the seven `FORBIDDEN_SIGNALS` absent from the rendered prompts.
- **`file-directive.test.js`** — the five outcomes, the eight checks each falsifiable, a concurrent double-tap charging once (a contention-retrying fake whose `tx.get` now throws after any buffered write).
- **`chat.test.js`** (three grounding describes) — the four modes, the chips by the server-derived archetype, the shadow record with its two DISTINGUISHABLE prompts, the counterpart-failure rows.
- **`AgentChat.chips.jsdom.test.jsx` · `AgentDock.chips.jsdom.test.jsx` · `useArenaEngine.grounding.jsdom.test.jsx`** — the taps hit the route with the belief, never the chat; the receipt from the exchange (Battle View) or the response (arena); the failure lines; the belief's 409 adoption; the filing-in-flight guard.
- **`decisionRecord.test.js`** — the zero-import proof, the re-exports, every shared string.

---

## 5. Not found, not built, and why

| Item | Status |
|---|---|
| The seed document (G1 → G6 as the founder wrote them) | **NOT attached to this session.** G1 → G6 were reconstructed from spec V1.2 and the Phase 0 report's discrepancies and hazards, in the spec's order; the rulings document's §3 hazard rulings were applied one by one (the record's `RULINGS.md` restates them). If the seed differs, the difference is the founder's to name. |
| Sol's reviews (to be committed under `docs/audits/` if attached) | **NOT attached.** Nothing committed for them. |
| The paired harness / the p50–p95 reader | Not this build (spec §12 separate task, before gate 1). |
| `chat.js`'s agent-belongs-to-battle check | Separate task (§4 of the rulings); the route carries the check from the start. |
| The deploy-time opener under `'on'` | Fenced `decide.js` — see §6 item 1. |
| Spec §3.2's one-entry record fallback | Not implemented; `RECORD_WINDOW` is 3 until the harness measures. |

---

## 6. Founder items (from the review's §6)

1. **The deploy-time opener stays the OLD prompt under `'on'`** — the common case, because `ensure-opener` returns `already_present` whenever the fenced opener exists. Spec §4 / §7's "no 'watching' in the opener" holds for the lazy opener only. A §7-gated one-key fence change (`grounded` into the `buildFirstMessagePrompt` call in `decide.js`) or an accepted gap.
2. **D-80 vs spec §3.2** — YOUR RECORD quotes rationale bytes, provenance code included; D-80 says such a code never reaches the screen. Bytes or the pane's `renderMotive` — a ruling.
3. **`Holding note` gating** — taken as gated on the grounded exchange (the flag-off page byte-identical; legacy model forecasts never relabelled). One line in `battleViewCopy.js` reverses it if the retroactive relabel is wanted.
4. **No review-mode gate on the route** — a directive filed after the close is in front of the process at the next check; recorded in the route header, not gated.
5. **The hypothesis label's two spellings** (prompt §3.2 / pane §11) — reconcile when A3.7 lands.

---

## 7. Process notes

- **A red scan between G4 and G6.** The route's two transaction writes were unlisted in `compositionProtectedStoresAllowlist.json`; the full suite after G6 caught it and G4 was amended before anything was pushed. The targeted runs after G3 and G4 had not included the scan — the reason every figure here is a full-suite figure.
- **The survivor proof ran before any kill was trusted**, and the review's own new rows were mutation-checked on the fixed tree (22 run, 22 killed).
- **Nothing pushed was ever amended.** The G4 amendment preceded the first push; the fixes and the docs are new commits.

---

## 8. Next

1. The founder opens the PR from `claude/voice-grounding-phase-0-rulings-hub8kv`; CI runs the full suite.
2. Rule the founder items above (the D-80 tension and the fenced opener decide whether `'on'` needs one more change first).
3. The p50/p95 reader (spec §12), then the walk: `'shadow'` → gate 1 → founder read → `'canary'` for one day → `'on'`.
