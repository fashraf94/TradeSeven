# Phase 3.5 — Holistic Signal Drop UI Audit Findings

**Branch:** `claude/phase-3-5-audit-9Y72s`
**Date:** 2026-05-09
**Scope:** Read-only audit of Sprint 6 Phase 3 UI surface (3A + 3B + 3C) and supporting backend (Phase 0–2.6 + P0 hotfix), plus carry-forward items deferred from earlier phases.
**Method:** Static read of every Sprint-6-touched file, cross-referenced against the spec (`SIGNAL_DROP_V2_SPEC.md`) and the carry-forward list in the prompt. No diagnostic logging added; no code changed.

---

## Section 1 — Executive Summary

Phase 3 of Signal Drop V2 lands as a coherent end-to-end surface — entry modal, phased dialogue, anatomy sidebar with discovery-edge framing — and the backend hardening from Phase 2.5 (transactions, field caps, dropId binding) gives the seams real defensibility. Last night's smoke test confirmed the happy path works in production after the contentHash P0 was fixed, and the visual product position (Discovery Plays as asymmetric edge, agent-equip framing) reads correctly.

The audit's three dominant themes:

1. **State lifecycle is incomplete.** No `watchlistSessions` doc ever transitions to `completed` or `abandoned`. Closing or "finalizing" a dialogue silently leaks orphans. The "Watchlist saved as a draft" toast is a copy-only fiction — Phase 4 is not wired and nothing persists. This is a P0 because the UX claims a save that does not happen.
2. **Test coverage and prompt-vs-server contract have hidden seams.** The duplicate-activation-condition smoke-test bug is reproducible from the code: `applyAnatomyUpdates` has no dedup on `add`, and the prompt has no anti-duplicate rule. `parse-signal` has no standalone tests; `expand-signal` has none at all; `workshop-chat` has only three. The 409 `concurrent_modification` paths are mock-shaped to never fire under test. These are P1 architecture risks that compound.
3. **Accessibility, motion, and tap-target hygiene were deferred and it shows.** No focus management on modal open/close, no `useReducedMotion` anywhere in `framer-motion` configs (the global CSS rule is bypassed), tab order isn't validated, and tap targets in `PhaseIndicator` and `DropZone` fall below 44px. None of this blocks beta but most of it should land before public launch.

**Findings count:** 28 total — **3 P0**, **11 P1**, **10 P2**, **4 P3**, plus 5 process observations.

---

## Section 2 — P0 Findings (production-blocking)

### Finding 1: "Watchlist saved as a draft" toast lies to the user
**Priority:** P0
**Affects:** `src/components/SignalDrop/WatchlistChat.jsx`

#### Description
`handleFinalizeClose` shows the toast `"Watchlist saved as a draft. (Editor lands in Phase 4.)"` and then calls `onClose`. Nothing is persisted as a watchlist. The `watchlistSessions` doc is left at `status: 'active'`. The user reasonably believes they saved a draft — they did not. There is no save endpoint, no `watchlists/{id}` doc, no draft list anywhere in the app.

#### Evidence
- `src/components/SignalDrop/WatchlistChat.jsx:467-474` — `handleFinalizeClose` toast wording vs. lack of persistence
- `firestore.rules:534-538` — `watchlistSessions` allows reads only; no `dropLists` / `watchlists` collection rule exists
- `SIGNAL_DROP_V2_SPEC.md:136-186` — spec describes `watchlists` collection that doesn't exist yet
- Phase 4 is named in the spec (line 318-322) but unimplemented

#### Severity reasoning
A UX claim of "saved" with no persistence is a trust failure. If the user closes the tab and returns expecting their draft, they will find nothing. P0 because the misleading copy is in production today.

#### Proposed fix scope
Replace the toast with an honest message ("Editor coming soon — your dialogue isn't saved yet") OR mark this CTA as disabled until Phase 4 ships, AND mark the `watchlistSessions` doc with a `status: 'finalize_intent_no_editor'` (or similar) so we can find these orphans later. One-line copy change + one-line status update + a follow-up to confirm with Flash whether this CTA should even be visible pre-Phase-4.

#### Notes
Linked to Finding 2 (orphan sessions). Decision needed: is the right move to hide this CTA entirely until Phase 4, or to keep the entrypoint and make the copy accurate?

---

### Finding 2: `watchlistSessions` docs are never marked completed or abandoned
**Priority:** P0
**Affects:** `api/forge/watchlist-dialogue.js`, `src/components/SignalDrop/WatchlistChat.jsx`

#### Description
There is no code path that ever transitions a `watchlistSessions` doc out of `status: 'active'`. The handler creates docs at `'active'` (`watchlist-dialogue.js:691`), the close-confirm dialog calls `onClose` only, and the budget-exceeded path doesn't update status. Every drop creates a permanent `active` row in Firestore — most of which the user will never return to. Combined with the dialogue's intentional state-reset on reopen (`WatchlistChat.jsx:128-147`), this means abandoned shells accumulate indefinitely.

#### Evidence
- `api/forge/watchlist-dialogue.js:691` — sets `status: 'active'` on creation
- `api/forge/watchlist-dialogue.js:636-642` — only reads `session.status !== 'active'` to reject; no path writes any other value
- `src/components/SignalDrop/WatchlistChat.jsx:486-489` — `handleConfirmClose` calls `onClose` only; no abandon API call
- `src/components/SignalDrop/WatchlistChat.jsx:467-474` — `handleFinalizeClose` calls `onClose` only
- `firestore.rules:534-538` — `watchlistSessions` blocks all client writes, so even the FE can't best-effort patch

#### Severity reasoning
P0 for two reasons: (a) the docs grow without bound, eventually showing up in shadow-log queries and pricing as full-fee Firestore storage; (b) we lose the ability to ever query "which dialogues did users abandon vs complete?" — the only signal of dialogue health is conflated. Not blocking parse/dialogue functionality today, but blocks the data we need to evaluate whether Sprint 6 is working.

#### Proposed fix scope
Either (a) add a `POST /api/forge/watchlist-dialogue/abandon` companion (small endpoint accepting `{ sessionId, reason }`) that flips status, OR (b) extend the existing endpoint with a `phaseRequest: 'abandon'` branch. Pair with Phase 4's save endpoint that flips status to `'completed'` when the user does finalize-and-save. WatchlistChat's close confirm calls the abandon path; the budget-exceeded finalize-CTA calls the (Phase 4) save path.

#### Notes
Phase 4 will need to define the save endpoint anyway — the abandon endpoint is small enough to ship with the hotfix, decoupled from save.

---

### Finding 3: Duplicate activation/invalidation conditions are not prevented at any layer
**Priority:** P0
**Affects:** `api/forge/watchlist-dialogue.js`, `api/_utils/voiceLayerPrompt.js`

#### Description
The smoke-test reproduction is mechanical: `applyAnatomyUpdates` has no duplicate check on `action: 'add'` (just appends if list.length < 3), and the prompt's per-phase rules (`WATCHLIST_PHASE_RULES_REFINE` etc.) don't tell Gemma "don't re-add a condition that's already in the rendered anatomy block." The anatomy block does render the existing conditions with 0-based indices, so Gemma can in principle see them, but nothing about the rules disambiguates "this is already there, use replace not add."

#### Evidence
- `api/forge/watchlist-dialogue.js:435-440` — `add` branch: trims, length-caps, appends. No `list.includes(trimmed)` check.
- `api/_utils/voiceLayerPrompt.js:738-744` — anatomy block renders existing conditions but the per-phase rules don't reference them as "don't re-add"
- `api/_utils/voiceLayerPrompt.js:508` — top-level rules describe anatomy actions semantically but say nothing about dedup
- `api/forge/watchlist-dialogue.test.js:1641-1666` — has a "caps each condition list at 3 entries" test; has no "rejects duplicate add" test
- Smoke-test screenshot from prompt: condition #3 identical to condition #1

#### Severity reasoning
P0 because it's already in production-reproducible behavior, hurts the user-facing artifact (the anatomy is the saved deliverable from this dialogue), and is a small fix at one of two layers. Borderline P1, but the smoke-test artifact is what users see in the sidebar, so I'm leaning P0.

#### Proposed fix scope
Add a single dedup check at the top of the `add` branch (`if (list.some((c) => c.toLowerCase().trim() === trimmed.toLowerCase())) continue;`) and add one test in the existing `applyAnatomyUpdates` describe block. Optionally also tighten the prompt with one bullet under each phase's RULES section: "If a condition similar in meaning is already present, use action='replace' on that index instead of action='add'." The server-side dedup is the load-bearing fix; the prompt change is belt-and-suspenders.

#### Notes
Recommend server-side dedup as the load-bearing fix. The prompt change alone leaves the door open for prompt drift.

---

## Section 3 — P1 Findings (high-value pre-launch)

### Finding 4: WatchlistChat resets sessionId on every reopen — no in-progress recovery
**Priority:** P1
**Affects:** `src/components/SignalDrop/WatchlistChat.jsx`

#### Description
`useEffect(() => { if (!isOpen) return; setSessionId(null); ... }, [isOpen])` (lines 128-147) resets all session state every time the modal opens. There's no flow to resume an in-progress dialogue: a user who hits Escape, closes the tab, or navigates away cannot return to the dialogue they started. Combined with the orphan-session issue (Finding 2), this is the user-facing version of the same architectural gap.

#### Evidence
- `src/components/SignalDrop/WatchlistChat.jsx:128-147` — full reset on each `isOpen` flip
- `firestore.rules:534-538` — read access exists, so a resume flow is technically supported
- `src/components/discover/DiscoverPanel.jsx:136-141` — `signalDropState` is local component state, gone if DiscoverPanel unmounts

#### Severity reasoning
P1 because users will lose work they thought they were keeping. Not P0 because today's flow doesn't tell users to expect resume. Gets P0-adjacent once Phase 4 lands and users start treating dialogues as durable.

#### Proposed fix scope
Either (a) decide the product position is "dialogues are ephemeral until saved" and document it in the close-confirm copy, OR (b) add a "resume" affordance that loads the most recent active session by `userId`. Phase 4 scope, not 3.6 — but the close-confirm copy can be tightened in 3.6.

---

### Finding 5: 409 `concurrent_modification` path is effectively untested at the handler level
**Priority:** P1
**Affects:** `api/forge/watchlist-dialogue.test.js`, `api/forge/signal-drop-integration.test.js`, `api/forge/workshop-chat.test.js`

#### Description
Both test fixtures mock `runTransaction` as `async (fn) => fn(tx)` where `tx.get` just calls `ref.get()`. There is no simulation of concurrent writes, so the freshness re-read inside the transaction never observes a different state. The `__concurrency:*` sentinel-error paths in `watchlist-dialogue.js:1029-1097` and `workshop-chat.js:539-587` are entirely untested. If the Firebase contract for `runTransaction` ever changes, or if a future refactor removes the freshness re-read, no test will catch it.

#### Evidence
- `api/forge/watchlist-dialogue.test.js:118` (around) — `runTransaction` mock that just invokes the callback
- `api/forge/signal-drop-integration.test.js:187-195` — same simplified mock
- `api/forge/workshop-chat.js:533-587` — concurrency sentinel logic with no test
- `api/forge/watchlist-dialogue.js:1029-1097` — same pattern, more checks (status, budget, phase), still untested

#### Severity reasoning
P1 because the transaction wrap is the load-bearing Phase 2.5 hardening fix. We trust it works because we read the code, but no automated test will catch a regression. Not P0 because under normal load Firestore's serializability gives us the property anyway — the test gap is about defending the wrap, not about a current bug.

#### Proposed fix scope
Add 2-3 handler-level tests where the mock's `tx.get` returns a session whose `messagesUsed` / `phase` / `status` differs from the snapshot we read at the top of the handler. Assert 409 + the right `errorReason`. Same shape for both watchlist-dialogue and workshop-chat.

---

### Finding 6: `parse-signal` has no standalone test file; `expand-signal` has none at all
**Priority:** P1
**Affects:** `api/forge/parse-signal.js`, `api/forge/expand-signal.js`

#### Description
`api/forge/parse-signal.js` (351 LOC) has no `parse-signal.test.js`. The only coverage is the integration test added for the P0 fix (`signal-drop-integration.test.js`), which is a single happy-path assertion. There is no test for the bailout/hard-checkpoint classification, the URL-fetch failure path, the cache-hit path, the injection-detection flag wiring, or the per-user drop-record persistence shape. `api/forge/expand-signal.js` (396 LOC) has no test file at all.

#### Evidence
- `api/forge/` listing: `parse-signal.js` has no `parse-signal.test.js`; `expand-signal.js` has no `expand-signal.test.js`
- The integration test is the only test that touches `parse-signal`
- `parse-signal.js:93-102` — `classifyBailout` is exported-shaped logic with no test
- `parse-signal.js:63-80` — `fetchUrlBody` 3s-abort path is untested

#### Severity reasoning
P1 because the V2 spec keeps `parse-signal` as the load-bearing first step, and any regression in confidence calibration or bailout classification will silently degrade the dialogue surface. The P0 surfaced in production specifically because hand-crafted test fixtures hid the contract. The same gap exists for the bailout/checkpoint/cache logic.

#### Proposed fix scope
Add `parse-signal.test.js` covering: bailout classification (true/false matrix), cache hit path, malformed body, URL fetch failure, image-mode validation, and `sanitizeParsedOutput` invocation. Add `expand-signal.test.js` covering at least the happy path and one error path so V1.1 endpoint isn't a black box. ~150-300 LOC of test code total.

---

### Finding 7: Action-chip → phaseRequest heuristic is brittle string matching
**Priority:** P1
**Affects:** `src/components/SignalDrop/WatchlistChat.jsx`

#### Description
`isPhaseAdvanceLabel` (line 52-56) and `isFinalizeLabel` (line 58-62) decide whether a chip click sends `phaseRequest: 'advance'` by substring-matching against `['advance', 'move to next phase', 'next phase']` and `['finalize', 'looks good', 'lock in']`. Gemma's actual `suggestedActions` chips don't reliably contain these substrings — the few-shot examples in `voiceLayerPrompt.js:654-666` show chips like `"Show me candidates"`, `"Tell me what'd qualify"`, `"Ship it"`, `"Tweak a couple more"`. None of those match the heuristic, so the user's chip click sends a normal message instead of a phase-advance request.

#### Evidence
- `src/components/SignalDrop/WatchlistChat.jsx:50-62` — heuristic string-match
- `api/_utils/voiceLayerPrompt.js:654-666` — actual chip examples produced by the prompt
- `"Ship it"` (the canonical finalize chip) does not match `isFinalizeLabel`'s substrings

#### Severity reasoning
P1 because the user-experience promise is "tap a chip to advance the phase" but in practice the wiring fires only on chips that happen to contain magic substrings. The dialogue can still progress because the server validates phase transitions on its own (Gemma may include `proposedPhase` in the response), but the explicit user-override pathway is mostly broken.

#### Proposed fix scope
Add a structured chip schema. Either Gemma emits chips as objects (`{ label, intent: 'advance'|'finalize'|'none' }`) and the server passes intent through, OR the chip-region renders chips with an `intent` attribute set by the server based on the phase context (e.g., on `finalize`, all chips that aren't "Tweak" carry intent='finalize'). Decoupling label from intent. Touches both `voiceLayerPrompt.js` (output schema) and `watchlist-dialogue.js` (response shape) and the chip wiring in `WatchlistChat.jsx`. Medium scope.

---

### Finding 8: `framer-motion` animations bypass `prefers-reduced-motion`
**Priority:** P1
**Affects:** All SignalDrop components using `framer-motion`

#### Description
`src/index.css:568-578` has a global `@media (prefers-reduced-motion: reduce)` rule that strips CSS animations and transitions. `framer-motion`'s `motion.*` components don't use CSS transitions — they animate via JS-driven RAF loops, which bypass the CSS rule. None of the SignalDrop components import or call `useReducedMotion()`, so users with reduced-motion preferences still get all the modal scale-ins, phase-dot pulses, condition slide-ins, anatomy section pulses, and chevron rotations. The auto-scroll in `WatchlistChat.jsx:171-178` also uses `behavior: 'smooth'` regardless of the preference.

#### Evidence
- `grep -rn "useReducedMotion" src/components/SignalDrop/` returns zero matches
- `src/components/SignalDrop/AnatomySection.jsx:101-106` — pulse animation runs unconditionally
- `src/components/SignalDrop/PhaseIndicator.jsx:115-150` — dot scale + label fade run unconditionally
- `src/components/SignalDrop/SignalDropEntry.jsx:355-380` — modal scale + opacity animations
- `src/components/SignalDrop/WatchlistChat.jsx:171-178` — `scrollTo({ behavior: 'smooth' })`
- `src/index.css:568-578` — global rule that does NOT cover framer-motion or smooth-scroll

#### Severity reasoning
P1 — accessibility regression that affects a real population (vestibular disorders, motion sensitivity). The pulse animations on every anatomy mutation are the most uncomfortable case. Not P0 because beta users are self-selected and this isn't blocking core flow.

#### Proposed fix scope
Wrap the dialogue + entry surface in a `<MotionConfig reducedMotion="user">` (framer-motion built-in) at one place — likely the `SignalDropEntry` and `WatchlistChat` outer `motion.div`s. Replace the smooth-scroll with conditional `behavior` based on `useReducedMotion()`. Two-file change.

---

### Finding 9: No focus management on modal open/close or phase transitions
**Priority:** P1
**Affects:** `src/components/SignalDrop/SignalDropEntry.jsx`, `src/components/SignalDrop/WatchlistChat.jsx`

#### Description
`SignalDropEntry`'s textarea is not auto-focused on open. `WatchlistChat`'s composer is not auto-focused on open or after a turn completes. Closing either modal does not return focus to the trigger element (the "Drop a Signal" card or the chat header). There is no focus trap inside the modal — Tab can escape into the now-aria-hidden background. None of these are exotic; they're standard `role="dialog"` accessibility expectations.

#### Evidence
- `src/components/SignalDrop/SignalDropEntry.jsx:175-188` — Esc handler exists, no focus management
- `src/components/SignalDrop/WatchlistChat.jsx:151-168` — Esc handler exists, no focus trap
- No `autoFocus` attribute on any textarea in either component
- No ref-based focus restoration on close
- No `inert` or `aria-hidden` on background content while modal open

#### Severity reasoning
P1 because keyboard and screen-reader users hit a real wall — they can tab out of the modal, lose context after close, and can't reach the textarea efficiently. Not P0 because mouse + touch users (the dominant population today) are unaffected.

#### Proposed fix scope
Add `autoFocus` to the textarea on both modals; capture the element with `document.activeElement` on open and restore on close; add a focus-trap helper (small loop inside the dialog that wraps Tab from the last focusable to the first, and Shift+Tab vice versa). ~30-50 LOC across the two components, or extract to a `useModalFocus` hook.

---

### Finding 10: SignalDropEntry's TEXT_MAX (2000) silently caps text below the API's accepted limit (5000)
**Priority:** P1
**Affects:** `src/components/SignalDrop/SignalDropEntry.jsx`, `api/forge/parse-signal.js`

#### Description
The UI hard-caps text input at 2000 chars (`TEXT_MAX = 2000`, line 54), with the textarea's `onChange` slicing input to that bound. The API accepts up to 5000 chars (`TEXT_INPUT_CAP_CHARS = 5000`, `parse-signal.js:41`). Users pasting longer content (earnings transcripts, blog posts, full articles) get silently truncated mid-paste with only the warn counter showing at >1500 chars. There's no message explaining the cap, and the API would have accepted 2.5x more.

#### Evidence
- `src/components/SignalDrop/SignalDropEntry.jsx:54` — `TEXT_MAX = 2000`
- `src/components/SignalDrop/SignalDropEntry.jsx:613` — onChange slice
- `api/forge/parse-signal.js:41` — `TEXT_INPUT_CAP_CHARS = 5000`
- `api/_utils/signalDropPrompt.js:38` — Haiku tool schema documents `extractedText` max as 2000 chars (matches UI but not API)

#### Severity reasoning
P1 because the spec calls for parsing arbitrary "tweet, article, news clip, transcript" content. 2000 chars is fine for tweets and short clips but fails for transcripts. The 3-way mismatch (UI 2000 / API 5000 / tool schema 2000) suggests a drift between what the writer thought the limit was vs. what the consumer accepts.

#### Proposed fix scope
Decide canonical: is the cap 2000 (UI is correct) or 5000 (API is correct)? Then unify across the three layers. If 5000, the textarea cap should match and `extractedText` schema description should be updated. If 2000, `parse-signal.js`'s `TEXT_INPUT_CAP_CHARS` should be tightened so frontend and backend agree. Single-line change once the decision is made.

---

### Finding 11: WatchlistChat is 1188 LOC; Composer + EmptyState + CloseConfirm still inline
**Priority:** P1
**Affects:** `src/components/SignalDrop/WatchlistChat.jsx`

#### Description
The carry-forward noted `WatchlistChat` was 1373 LOC pre-3C; current measurement is 1188 LOC. SidebarHeader and SlotGroup were extracted to `WatchlistAnatomyPanel`/`AnatomySection`. Three subviews remain inline: `EmptyState` (95 LOC), `Composer` (130 LOC), `CloseConfirm` (100 LOC). The orchestrator itself is ~700 LOC — a lot of state machine plus rendering logic in one file.

#### Evidence
- `wc -l src/components/SignalDrop/WatchlistChat.jsx` → 1188
- `src/components/SignalDrop/WatchlistChat.jsx:859-953` — `EmptyState`
- `src/components/SignalDrop/WatchlistChat.jsx:955-1085` — `Composer`
- `src/components/SignalDrop/WatchlistChat.jsx:1087-1188` — `CloseConfirm`

#### Severity reasoning
P1 because the file size makes review and modification slower, but it's not actively breaking anything. Refactor scope is moderate (3 files extracted from one) and adds clear seams for testing each subview.

#### Proposed fix scope
Extract `Composer`, `EmptyState`, `CloseConfirm` to `src/components/SignalDrop/components/`. Each becomes a thin presentational component. Orchestrator drops to ~700 LOC. No behavior change. Pure mechanical refactor, easy to review.

#### Notes
Composer is the highest priority of the three because it owns the `MESSAGE_CHAR_CAP` constant, the budget-exhausted CTA branch, and the keyboard handling — extracting it makes that logic discoverable from the file path.

---

### Finding 12: AnatomySection's pulse keys hash by length, missing same-length mutations
**Priority:** P1
**Affects:** `src/components/SignalDrop/WatchlistAnatomyPanel.jsx`

#### Description
`thesisPulseKey = thesis ? thesis.length : 0` and `activationPulseKey = activationConditions.join('§').length + activationConditions.length` (lines 92-95) hash the rendered content by length. If Gemma uses `action: 'replace'` to swap a condition for one of the same length, or revises the thesis to a same-length string, no pulse fires. The user gets the new content silently, missing the visual signal that the agent updated the anatomy.

#### Evidence
- `src/components/SignalDrop/WatchlistAnatomyPanel.jsx:92` — `thesisPulseKey = thesis.length`
- `src/components/SignalDrop/WatchlistAnatomyPanel.jsx:93-95` — same shape for activation/invalidation
- `src/components/SignalDrop/WatchlistAnatomyPanel.jsx:96-100` — `tickersSignature` uses content hash (correct), so it's just the conditions/thesis that have this bug

#### Severity reasoning
P1 because the pulse animation is the load-bearing live-update signal. A silent same-length replace looks like a bug to the user even when the system is working correctly. Hits more often on `replace` than `add` (replace is more likely to keep similar length).

#### Proposed fix scope
Replace length-based pulse keys with content-hash-based ones (mirror `tickersSignature`'s pattern: `items.join('§')` directly as the key, so any change flips it). 4-line change.

---

### Finding 13: Anatomy section ordering may bury the plays under unfilled conditions
**Priority:** P1
**Affects:** `src/components/SignalDrop/WatchlistAnatomyPanel.jsx`

#### Description
Sidebar order is fixed: Thesis → Activation Conditions → Invalidation Conditions → Core Plays → Discovery Plays → Cross-Currents. During the early `explore` and `propose` phases, conditions are intentionally empty (the prompt rules say conditions get filled during `refine`). The user sees an empty "Activation Conditions (0)" section above "Core Plays (5)" — visual hierarchy implies activation conditions are more prominent than the actual ticker proposals. The user's mental model is "tickers are the goal," not "conditions then tickers."

#### Evidence
- `src/components/SignalDrop/WatchlistAnatomyPanel.jsx:172-247` — fixed render order
- `api/_utils/voiceLayerPrompt.js:543` — explore-phase rule: 1-2 activation conditions max
- `api/_utils/voiceLayerPrompt.js:598-599` — refine phase is where conditions get filled

#### Severity reasoning
P1 (was raised as carry-forward) — UX hierarchy decision that affects how the dialogue feels. Not P0 because it doesn't block functionality.

#### Proposed fix scope
Three options to evaluate (per the carry-forward question):
- (a) Stay (current MVP) — accept current ordering
- (b) Collapse Activation/Invalidation by default until `refine` phase — sections still in same order, but unexpanded
- (c) Reorder so plays come first when phase ∈ {explore, propose}; conditions float to top during refine/finalize
- (d) Hide condition sections entirely until first content arrives

Recommend option (b) for 3.6 — minimal change (just the `defaultExpanded` prop logic), preserves order, fixes the empty-section noise. Option (c) is bigger but probably better long-term. This is a Flash-decision input.

#### Notes
Linked to Finding 14 (information density). Same UX surface, different lens.

---

### Finding 14: Sidebar information density at 320px is uncomfortable on real desktops
**Priority:** P1
**Affects:** `src/components/SignalDrop/WatchlistAnatomyPanel.jsx`, `src/components/SignalDrop/WatchlistChat.jsx`

#### Description
`WatchlistChat.jsx:801` sets sidebar width to 320px on desktop. `WatchlistAnatomyPanel` packs into that column: thesis paragraph (potentially 1000 chars wrapped), 3 activation conditions, 3 invalidation conditions, up to ~12 ticker cards across 3 slot groups, plus the gold "agent-equip" nudge. Per smoke test, last night's run had 13 candidate tickers — within bounds, but dense. On a 1280px viewport (a real laptop), the chat thread gets ~960px which is fine; the sidebar at 320px wraps thesis text into 4-6 narrow lines that read as a wall.

#### Evidence
- `src/components/SignalDrop/WatchlistChat.jsx:801` — `width: isDesktop ? 320 : '100%'`
- `src/components/SignalDrop/WatchlistAnatomyPanel.jsx:289-293` — thesis body has no wrap controls (relies on default prose wrapping)
- `api/forge/watchlist-dialogue.js:77` — `ANATOMY_THESIS_MAX_LEN = 1000`
- Smoke test (per prompt): 13 tickers across 4 sections felt heavy

#### Severity reasoning
P1 because it's a comfort/comprehension issue, not a correctness one. Easy to underestimate; users will tolerate it but the "I can read this at a glance" goal of the sidebar erodes.

#### Proposed fix scope
Three options to evaluate:
- Increase desktop sidebar width (320 → 380 or 400). 1-line change. Loses chat-thread real estate.
- Tighten thesis to ≤500 chars (drop max from 1000 → 500; update prompt). Forces concision. Server-side change.
- Add a "compact" toggle that collapses reasoning text per ticker. New state + UI.

Recommend a measurement first — pull 5-10 real anatomy outputs from shadow logs and look at typical thesis length. If the median thesis is ~150-200 chars, 320px is fine and the issue is the smoke-test outlier. If median is 600+, 320px is wrong.

---

## Section 4 — P2 Findings (post-launch quality)

### Finding 15: ESLint `no-unused-vars` framer-motion noise — config gap, not file-level
**Priority:** P2
**Affects:** `eslint.config.js`

#### Description
The carry-forward called out ~1255 lint errors codebase-wide, with the dominant pattern being `motion` imported but flagged unused because `<motion.div>` is read as a member expression. Inspection of `eslint.config.js` shows the project uses flat-config with `js.configs.recommended` + `react-hooks` + `react-refresh`. There's no `eslint-plugin-react` or `react/jsx-uses-vars`. Switching to or adding `eslint-plugin-react`'s `recommended` config (which enables `react/jsx-uses-vars` by default) would fix the false positives in one place rather than 100+ files. Two SignalDrop files already use `// eslint-disable-next-line` comments to work around it.

#### Evidence
- `eslint.config.js:1-30` — current config; no `eslint-plugin-react`
- `src/components/SignalDrop/WatchlistChat.jsx:167,446` — `eslint-disable` workarounds
- `src/components/Forge/WorkshopChat.jsx:423` — same pattern
- All 9 SignalDrop files (and DiscoverPanel) import `motion` but use it as a member expression

#### Severity reasoning
P2 because it's purely DX/build-noise, not runtime. But it compounds — every new file that imports framer-motion adds another false positive that someone has to disable manually.

#### Proposed fix scope
Add `eslint-plugin-react@^7` to devDependencies; add its `recommended` config to the flat-config extends array; remove the per-file disable comments. Run `npm run lint` to confirm zero net regressions. ~10 LOC change in `eslint.config.js` + a `package.json` dep + cleanup of disable comments.

#### Notes
Caveat: enabling `eslint-plugin-react` may surface its other rules (e.g., `react/prop-types`). Disable rules we don't want explicitly. Plan for a focused 1-session sweep, not a big-bang.

---

### Finding 16: Tap targets in PhaseIndicator and DropZone fall below 44px on mobile
**Priority:** P2
**Affects:** `src/components/SignalDrop/PhaseIndicator.jsx`, `src/components/SignalDrop/SignalDropEntry.jsx`

#### Description
`PhaseIndicator.jsx`'s tap-able dot button has `padding: 4px 2px` around a 10×10 dot — total tap target is ~14×18px. `SignalDropEntry.jsx`'s `DropZone` "Choose file" / "Take photo" buttons have `padding: 7px 12px` and a 14px icon — total ~28-32px tall. Both fall below the WCAG 2.5.5 / iOS HIG / Material Design 44×44px minimum for touch targets. `ActionChip` correctly uses 44px on mobile (line 61), so the pattern is known — it just wasn't applied everywhere.

#### Evidence
- `src/components/SignalDrop/PhaseIndicator.jsx:101-115` — dot button padding
- `src/components/SignalDrop/SignalDropEntry.jsx:843-859` — `pickerButtonStyle`
- `src/components/SignalDrop/components/ActionChip.jsx:61` — correct 44px on mobile

#### Severity reasoning
P2 because tap accuracy isn't catastrophic — just frustrating. The phase dots are decorative-with-tooltip, so a missed tap just means the tooltip doesn't show, which is fine. The drop-zone buttons are higher-stakes (file picker won't open), but desktop is unaffected and mobile-image-uploads are infrequent.

#### Proposed fix scope
Increase `padding` on the phase-dot button to `8px 6px` (total ~26×26 — still below 44 but better). Make `pickerButtonStyle` mobile-aware (inject `minHeight: 44` when `!isDesktop`). 4-line change.

---

### Finding 17: Tablet (430-768px) gets the mobile experience including camera button
**Priority:** P2
**Affects:** `src/components/SignalDrop/SignalDropEntry.jsx`

#### Description
Both modals condition layout on `isDesktop` only (true if width > 768px). Tablets in portrait orientation (768px iPad in portrait = 768, just over the threshold; 810x1080 iPad Pro is over) are usually fine. But landscape phones (e.g., 800x412) and small tablets in portrait (e.g., 600px) get the full-screen mobile takeover including the "Take photo" camera button on the drop zone. iPads in portrait (768px) sit right on the threshold — depends on the BREAKPOINTS constant. The camera button intent is "rear camera on phone" — useful on a phone, awkward on a tablet.

#### Evidence
- `src/components/SignalDrop/SignalDropEntry.jsx:814-836` — `!isDesktop` branch shows "Take photo"
- `src/hooks/useIsMobile.js:71-76` — `isDesktop` is `width > tabletBreakpoint` (768 default)
- `src/constants/breakpoints` — would need verification

#### Severity reasoning
P2 because it doesn't break anything — the camera button still works, just may not be useful. Cosmetic issue.

#### Proposed fix scope
Distinguish tablet from mobile in the camera button check: `if (isMobile) { showCameraButton }`. SignalDropEntry already imports `useIsMobile` — switch from `isDesktop` check to explicit `isMobile`. 2-line change.

---

### Finding 18: handleSubmit input priority (image > text > url) is not communicated to the user
**Priority:** P2
**Affects:** `src/components/SignalDrop/SignalDropEntry.jsx`

#### Description
`handleSubmit` (line 272-332) picks the first non-empty input in order: image, text, url. If the user fills all three, only the image is submitted. URL is dropped. There's no UI affordance telling the user this — the textarea + URL field + image upload all look co-equal. A user pasting an article AND its source URL may reasonably expect both to be submitted.

#### Evidence
- `src/components/SignalDrop/SignalDropEntry.jsx:285-311` — priority logic with no UI annotation
- `src/components/SignalDrop/SignalDropEntry.jsx:286-287` — comment says "URL is dropped in MVP"

#### Severity reasoning
P2 because it's MVP-acceptable, but users will hit it and be confused. Edge-case for the typical user flow (pasting one thing).

#### Proposed fix scope
Either (a) make the inputs visually mutually-exclusive (radio-tab to switch), OR (b) add a small line of helper text at the top of the form explaining the priority, OR (c) widen the API to accept attribution `url` alongside `text`. Option (c) is the right long-term path; (b) is the right hotfix (1-line copy add).

---

### Finding 19: ConditionList key includes the first 16 chars of text — keys collide for similar conditions
**Priority:** P2
**Affects:** `src/components/SignalDrop/WatchlistAnatomyPanel.jsx`

#### Description
`ConditionList` uses `key={`${idx}-${(text || '').slice(0, 16)}`}` (line 315). If two conditions start with the same 16 chars (e.g., `"Apple confirms multi-year ramp"` and `"Apple confirms multi-year supply"`), and one is removed by index, React's key matching may misidentify the surviving entry, briefly animating the wrong content. Plus the `idx` prefix means keys change on any reorder, defeating the purpose of stable keys.

#### Evidence
- `src/components/SignalDrop/WatchlistAnatomyPanel.jsx:315` — key shape

#### Severity reasoning
P2 — actually pretty unlikely to happen in practice (conditions are too short to collide on the first 16 chars + the list is capped at 3 per type), but the key strategy is fragile.

#### Proposed fix scope
Use a stable id from the server (assign each condition a `conditionId` when added, persist in the anatomy struct), or hash the full text. The persistent-id approach is cleaner long-term but requires a schema change.

---

### Finding 20: Composer placeholder copy is identical across all phases and turns
**Priority:** P2
**Affects:** `src/components/SignalDrop/WatchlistChat.jsx`

#### Description
"Tell me what caught your eye…" (line 1040) is the placeholder for every phase and every turn. By the time the user is in `refine` discussing edge cases, "what caught your eye" is no longer the question. It's a small thing but the placeholder is some of the most-read copy in the UI.

#### Evidence
- `src/components/SignalDrop/WatchlistChat.jsx:1037-1041` — single placeholder

#### Severity reasoning
P2 — copy polish, not functional.

#### Proposed fix scope
Phase-aware placeholder: explore → "Tell me what caught your eye…", propose → "React to a name or ask for more…", refine → "Push back on a pick or add your own…", finalize → "Looks good or one more tweak?". 5-line change with a small lookup table.

---

### Finding 21: Auto-resize textarea uses smooth-scroll which fights reduced motion
**Priority:** P2
**Affects:** `src/components/SignalDrop/WatchlistChat.jsx`

#### Description
Line 173-178: `scrollRef.current.scrollTo({ top: ..., behavior: 'smooth' })`. As called out in Finding 8, this bypasses `prefers-reduced-motion`. The auto-scroll is correct behavior (chat threads should follow new messages), but the motion is forced.

#### Evidence
- `src/components/SignalDrop/WatchlistChat.jsx:171-178`

#### Severity reasoning
P2 — pairs with Finding 8 (same root cause, different surface).

#### Proposed fix scope
`behavior: useReducedMotion() ? 'auto' : 'smooth'`. Single-line, but requires the framer-motion hook import.

---

### Finding 22: `validateUrlOnBlur` only validates on blur — submit-without-blur path stale
**Priority:** P2
**Affects:** `src/components/SignalDrop/SignalDropEntry.jsx`

#### Description
URL validation happens in `validateUrlOnBlur` (line 228-243). If the user types a malformed URL and clicks "Read this signal" without first blurring the URL field (e.g., they tab from textarea to button without clicking out of the URL field), `urlError` remains its previous value. `handleSubmit` (line 272-332) only checks `if (!imageFile && !trimmedText && trimmedUrl && urlError)` — it relies on the stale error state.

#### Evidence
- `src/components/SignalDrop/SignalDropEntry.jsx:228-243` — onBlur-only validation
- `src/components/SignalDrop/SignalDropEntry.jsx:277` — handleSubmit relies on `urlError` state

#### Severity reasoning
P2 — actually benign in practice because if `urlError` is stale-stale (e.g., `null`), the URL still goes to the API which validates with `new URL()` (`parse-signal.js:144-147`) and rejects malformed URLs server-side. So the worst case is a roundtrip error instead of a client-side error. But it violates the user's expectation that the form "knows" the URL is bad before submitting.

#### Proposed fix scope
Run validation again at the top of `handleSubmit` before deciding the body. 5-line change.

---

### Finding 23: SignalDrop CSS animations use inline `<style>` tags — duplicated keyframes
**Priority:** P2
**Affects:** `src/components/SignalDrop/SignalDropEntry.jsx`, `src/components/SignalDrop/components/TypingIndicator.jsx`

#### Description
`SignalDropEntry`'s spinner uses `signaldrop-spin` keyframe in an inline `<style>` block (line 1349-1352), and `TypingIndicator` uses `signaldrop-typing` keyframe in another inline `<style>` block (line 68-73). If both render simultaneously, both `<style>` blocks live in the DOM. If a third uses the same pattern, we'll have three. The pattern is consistent with the project but doesn't scale and bypasses the global `prefers-reduced-motion` rule.

#### Evidence
- `src/components/SignalDrop/SignalDropEntry.jsx:1349-1352`
- `src/components/SignalDrop/components/TypingIndicator.jsx:68-73`

#### Severity reasoning
P2 — works today, gets worse with each new animation.

#### Proposed fix scope
Move the keyframes into a shared `src/styles/animations.css` (or `index.css`), drop the inline `<style>` blocks. The global stylesheet's `prefers-reduced-motion: reduce` rule already strips animation-duration to 0.01ms — so consolidating gets reduced-motion compliance for free.

---

### Finding 24: SignalDropEntry's note field is referenced by parse-signal but never sent
**Priority:** P2
**Affects:** `src/components/SignalDrop/SignalDropEntry.jsx`, `api/forge/parse-signal.js`

#### Description
`parse-signal.js` accepts a `note` field (`api/forge/parse-signal.js:118, 126`) capped at 500 chars and incorporates it into the prompt (`signalDropPrompt.js:206-220`). `SignalDropEntry` never sends a `note` — the body in `handleSubmit` only includes `type`, content, and `dropId`. The functionality exists server-side but has no UI.

#### Evidence
- `api/forge/parse-signal.js:42` — `NOTE_CAP_CHARS = 500`
- `api/forge/parse-signal.js:118-128` — note validation
- `api/_utils/signalDropPrompt.js:206-220` — note rendering in prompts
- `src/components/SignalDrop/SignalDropEntry.jsx:288-311` — body never includes `note`

#### Severity reasoning
P2 — dead-code-shaped feature. Either remove the API support or wire up the UI.

#### Proposed fix scope
Either (a) remove `note` from parse-signal (small server cleanup), OR (b) add a "Notes (optional)" textarea below the URL field with a 500-char cap and pipe through `handleSubmit`. The note is genuinely useful — the user can pre-frame their angle for Gemma — so leaning toward (b) but it's a Flash-decision.

---

## Section 5 — P3 Findings (nice-to-have / future)

### Finding 25: Smoke test produced an "ASYMMETRIC EDGE" chip — confirm letterspacing is readable
**Priority:** P3
**Affects:** `src/components/SignalDrop/AnatomySection.jsx`

#### Description
Per the carry-forward smoke-test list, evaluate whether the small "ASYMMETRIC EDGE" chip (9px font, 0.5px letter-spacing, uppercase, line 178-185) is readable on real desktop monitors. 9px is small for body text but typical for chip labels; 0.5px letter-spacing on uppercase narrow text can read as cramped on retina displays. No code issue — just a question for the visual review.

#### Evidence
- `src/components/SignalDrop/AnatomySection.jsx:171-193` — accent chip styling

#### Severity reasoning
P3 — visual polish call.

#### Proposed fix scope
Eyeball test on a real monitor. If readable, no change. If cramped, bump to 10px or increase letter-spacing to 0.7px. Backlog item.

---

### Finding 26: PhaseIndicator dot animation runs even when phase doesn't change
**Priority:** P3
**Affects:** `src/components/SignalDrop/PhaseIndicator.jsx`

#### Description
`PhaseIndicator` re-runs the `motion.span` animation on every parent re-render (every `setExchanges` etc.) because `animate={{ background: dotColor, borderColor: dotBorder, scale: ... }}` is recomputed each render. Framer's diffing should noop when the values match, but the layout/transition props are still evaluated. Microscopic perf cost, not a real problem.

#### Evidence
- `src/components/SignalDrop/PhaseIndicator.jsx:115-131`

#### Severity reasoning
P3 — premature optimization concern. Probably not a real perf issue.

#### Proposed fix scope
None unless React DevTools shows actual frame drops. Leave alone for now.

---

### Finding 27: `signal-drop-integration.test.js` doesn't simulate concurrent transactions
**Priority:** P3
**Affects:** `api/forge/signal-drop-integration.test.js`

#### Description
The integration test mocks `runTransaction` as a passthrough, so the freshness re-read (which is the load-bearing Phase 2.5 hardening) isn't validated end-to-end. Same root cause as Finding 5 but applied to the integration test specifically.

#### Evidence
- `api/forge/signal-drop-integration.test.js:187-195`

#### Severity reasoning
P3 — duplicate-ish of Finding 5. Captured here for completeness.

#### Proposed fix scope
Subsumed by Finding 5's fix.

---

### Finding 28: Gemma's reasoning-quality variability is not captured for prompt iteration
**Priority:** P3
**Affects:** Process / prompt iteration

#### Description
The smoke test mentioned that one of last night's responses had genuinely good structural reasoning. There's no mechanism to capture "this turn was great, save it as a few-shot" — the few-shot in `voiceLayerPrompt.js:650-666` is hand-authored from spec writing, not real outputs. Capturing standout responses would tighten future iterations.

#### Evidence
- `api/_utils/voiceLayerPrompt.js:650-666` — hand-authored few-shot examples

#### Severity reasoning
P3 — process improvement, not code.

#### Proposed fix scope
Add a "Save this response as exemplar" affordance (admin-only) in the chat thread that writes the exchange to a `dialogueExemplars` collection. Backlog. Phase 4+.

---

## Section 6 — Process / Discipline observations

### Observation 1: STOP discipline held 6 of 7 phase boundaries; 3C audit→implementation lapsed
**Pattern:** Phase 2.6, 3A audit, 3A push, 3B audit, 3B implementation, P0 fix all observed clean STOPs. Phase 3C audit→implementation drifted (Claude Code auto-proceeded saying "Proceeding with implementation").
**Recovery:** P0 fix held discipline perfectly even under stop-hook conflict pressure (the surfaced phrasing about "Stop hook fired with X. Your instruction was Y.").
**Recommendation:** Make every STOP point in a phased spec a hard gate — "no deviations from spec" is NOT implicit approval. Spec phrasing should explicitly say "STOP — wait for review and approval before proceeding to next phase." The model that fired the stop-hook conflict cleanly is the right one going forward.

### Observation 2: Voluntary plan-approval-as-checkpoint pattern (Phase 3B) worked
**Pattern:** Phase 3B included an unscripted STOP between plan-drafting and implementation. Worked well — caught misalignments before code was written.
**Recommendation:** Formalize for any phase with >300 LOC of expected change or >2 new abstractions: produce a written plan, STOP, get sign-off, then implement. Cheaper than producing wrong code and having to throw it away.

### Observation 3: Integration test gap is the why behind the P0
**Pattern:** Pure-function tests used hand-coded fixtures with `contentHash` set, so the writer-vs-consumer drift was invisible at unit level. Integration test added during P0 fix immediately reproduced the bug.
**Recommendation:** Adopt a "every cross-endpoint seam gets at least one integration test" rule. The pairs to consider for Sprint 6 surface:
- `parse-signal → watchlist-dialogue` (now covered)
- `watchlist-dialogue → (Phase 4 save endpoint)` — to add when Phase 4 ships
- `parse-signal → expand-signal` (V1.1 path; gap)
- `workshop-chat → compile-dimensions` (production-critical, no integration test today)

### Observation 4: Smoke testing caught what unit tests didn't — make it standard close-out
**Pattern:** Last night's smoke test confirmed the duplicate-condition bug AND the contentHash bug, both of which had passing unit tests.
**Recommendation:** Make a real-traffic smoke test the standing close-out for every UI-touching phase before claiming "done." Pre-defined diverse content (tweet, article, transcript, image) in a checklist; produce screenshots; archive in a `smoke-tests/` directory with phase tag.

### Observation 5: The audit-then-fix pattern (Phase 2.5, P0 fix) is the right rhythm
**Pattern:** Phase 2.5 hardening worked because it followed an explicit audit first. P0 fix followed the same pattern. Both shipped with confidence.
**Recommendation:** Document the audit-then-fix rhythm explicitly. Audit produces findings doc → Flash reviews and approves scope → fix sprint executes scope only. No "audit complete" → "let me also fix this small thing while I'm here" drift.

---

## Section 7 — Recommended next-step scope (Phase 3.6 hotfix)

### Suggested Phase 3.6 scope (P0 + targeted P1)

**Tier A — Must ship before any further user smoke tests:**
- Finding 1 (misleading "saved as draft" toast) — copy fix + status update
- Finding 2 (orphan sessions) — add abandon endpoint + wire close-confirm to it
- Finding 3 (duplicate conditions) — server-side dedup in `applyAnatomyUpdates` + one new test
- Finding 5 (concurrent_modification untested) — 2-3 handler tests for both watchlist-dialogue and workshop-chat
- Finding 8 (reduced-motion bypass) — `MotionConfig reducedMotion="user"` wrap + smooth-scroll guard

**Tier B — Strong P1 candidates (decide together):**
- Finding 6 (parse-signal/expand-signal test gap) — add the missing test files
- Finding 7 (chip→phaseRequest heuristic) — restructure chip schema; medium scope
- Finding 9 (focus management) — modal autoFocus + focus-trap helper
- Finding 10 (UI/API text-cap mismatch) — pick a number, unify
- Finding 13 (anatomy section ordering) — collapse-by-default during explore/propose

**Defer to Phase 4 (and beyond):**
- Finding 4 (resume in-progress dialogue) — depends on Phase 4 save mechanics
- Finding 11 (Composer/EmptyState/CloseConfirm extraction) — safe refactor, low priority
- Finding 12 (pulse key length-only hash) — fix when touching anatomy panel anyway
- Finding 14 (sidebar density) — measure first, adjust later
- Findings 15-23 (P2 polish) — separate dedicated 1-day sweep
- Finding 24 (note field dead path) — UI vs. server-cleanup decision

### Out of scope for Phase 3.6 explicitly:
- Phase 4 design (edit screen + save flow)
- Phase 5 design (watchlist detail view + Discover integration)
- BaggerBomb agent equip mechanism (Sprint 7+)
- Codebase-wide ESLint cleanup (Finding 15) — name the scope, plan a separate session
- WatchlistChat refactor (Finding 11) — defer until orchestration is more stable
- Major prompt rewrite (Finding 7's chip schema) — propose, get Flash's signoff, schedule separately

### Estimated Phase 3.6 hotfix scope:
- Tier A only: ~3-4 hours (5 findings, mostly small + 1 test addition + 1 endpoint)
- Tier A + B: ~6-8 hours (9-10 findings, more invasive)

Single PR per finding is recommended; bundle Tier A items 1-3 together if they touch overlapping files; keep Tier A items 4-5 separate.

---

## End of Phase 3.5 audit findings

Single deliverable. No code changes. Stops here pending Flash review and Phase 3.6 hotfix scope approval.
