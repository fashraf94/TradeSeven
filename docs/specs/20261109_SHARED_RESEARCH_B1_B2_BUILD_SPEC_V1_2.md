# Shared Research — "Work an idea" · B1/B2 Build Spec V1.2

**Date:** Nov 9, 2026; V1.1 and V1.2 Nov 12, 2026 · **Owner:** the Shared Research build-spec chat (Claude), for the Command Center arc · **Status:** the founder's Nov 12 rulings are applied (§2); the Practice Field chat's three items (Nov 12) are folded in (§0, §5.5, §6.6). D-1 and D-4 stand on their defaults. Plumbing is approve-by-default (§3).
**Supersedes:** V1 (Nov 9) and V1.1 (Nov 12). Neither is committed.
**Destination:** `docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md`, committed as the first commit of the B1 branch (no docs-only PR), with a `docs/README.md` row. Project copy: `claude/SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2_NOV12_2026.md`.
**Writes the spec; does not build.** B1 (server, dark) and B2 (client, dark) are two Claude Code sessions, each one branch and one draft PR (§11).

**Inspected (read-only):**
- `main` @ `ba22a52f` (PR #1036, the research-modal sheet). The kickoff named `f095dc29` (PR #1035); the one PR between them touches none of this spec's paths.
- `claude/huddle-s1` @ `fd9967c` (draft PR #1032, not merged): `docs/design/SHADOW_VOICE_RULES_V1.md`, `api/_utils/evidence/fantasyTimesStories.js`, `api/_utils/huddle/scriptPrompt.js`.
- The V2 bundle, unpacked: `sr2-extra.jsx` (139 lines), `sr2-sheet.jsx` (350), `sr2-app.jsx` (322), `sr2-data.jsx` (313), `sr2-hub.jsx` (354).
- `docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md` (the framework contract, merged, PR #1030).

**Inputs, in order of precedence:** the founder's Nov 12 rulings → the Practice Field shared contract V2 and concept V6.1 (founder-approved Nov 12; the Practice Field chat's note to this chat, Nov 12) → the kickoff's rulings R1–R8 → the handover (Nov 9) → `SHARED_RESEARCH_WORK_AN_IDEA_CONCEPT_V1` (revised Nov 7) → `COMMAND_CENTER_PURPOSE_V1_1` → the research record extension contract V1 → `ONBOARDING_V4_BUILD_SPEC_V1_1` → the feasibility readout (Nov 4) → the FantasyTimes research-desk note V1.1 §3 and §8 → the V2 design. Where the repo contradicts a document, the repo wins and the conflict is named (§1, §2).

## Changes from V1 and V1.1

| # | Change | Sections |
|---|---|---|
| 1 | **D-SR-3 ruled:** adoption saves the list `committed`. | §2, §5.4, §6.6 |
| 2 | **D-SR-2 corrected and ruled:** the SignalDrop entry **ships in V1**. V1 read the record contract too strictly: a drop is the player's own material, so it enters as the player's words plus its parsed names and never needs a `signalDrops` finding source. The existing `SignalDropEntry` modal and `/api/forge/parse-signal` are reused; the door lives in the sheet's Start view. | §0, §1 F4, §2, §4.1–4.2, §5, §6.3, §7, §10, §12, §14 |
| 3 | **D-SR-1 ruled:** Sonnet for the step turn, pinned to the current model id `claude-sonnet-5-5`; the framing turn on `claude-haiku-5-5`; no legacy model id anywhere in this build (the existing `parse-signal` route keeps its Haiku 4.5 id until the app-wide model-id migration, a separate task). A cost-control section is added: per-turn token caps, the player ceilings, a global daily ceiling with an honest pause, and per-call cost accounting. | §2, §6.1, §6.3, §6.12, §11.4 |
| 4 | **V1.2 · Where it sits (Practice Field note, item 0):** the Practice Field is the "Track this idea" V1 put out of scope — the player's agent will run a paper book of ideas and a saved research idea is one source it drafts from. Nothing in the flow changes; §0 says where the two sinks meet. | §0, §13 |
| 5 | **V1.2 · Provenance stamps (Practice Field item 1):** at `open` the session records which agent and archetype the partner wore (`attribution`: the ranked agent id by the platform's resolver, the archetype code id, the identity version); adoption copies the same block to the list and passes it for the version. Recorded, never inferred; the idea stays the player's. | §5.1, §5.4, §5.5, §6.3, §6.6, §14 |
| 6 | **V1.2 · Adoption mechanics kept separable (Practice Field item 2):** `adoptIdea` is written as shared mechanics (committed list, v1, record close, confirm exchange, idempotency) plus one origin adapter (marker, state reason, evidence refs), so a second origin, `practice_field`, adds an adapter, not a rewrite. The framework chat is asked to keep the builder the same way. | §6.6, §14 |
| 7 | **V1.2 · Horizons aligned (Practice Field item 3):** the picker offers three — swing, positional, longterm — the same three the Practice Field uses; intraday is not offered on either side. | §1 F9, §3 routine 9, §7.3 |

---

## 0. In plain terms

**What gets built.** A sheet in the Command Center where a player and their named partner work one question. The player starts from a FantasyTimes story (the default), or from something they typed. The partner frames a question, shows what the app already holds, and then — one step at a time, each step one web retrieval and one model turn — gathers evidence for and against, says which companies are connected and how well that connection is supported, and proposes one next step. The player can stop ("This answered my question"), leave it open, discard it, or turn it into an idea. Turning it into an idea shows exactly what will be saved: a claim the player edits, the companies they pick, a time frame, and the evidence that travels with it. Save creates a list and its first idea version in one server write. "Use it in my next game" is a second, optional action through the existing ready and equip routes.

**What it never does.** It never trades, never tells the agent anything, never claims the agent learned or considered anything, never shows a confidence percentage, never invents a ticker, and never shows "running" unless a request is in flight.

**Where things stand (dependencies, §10).** The record contract and the adoption builder are on `main`. The voice rulebook is on the Huddle S1 branch, not yet merged. The hub's part (the door, the story selector, the summary line, the activity rows) is the Command Center chat's amendment, pending. Declared interests (`playerContext`) are pending from the framework chat. The SignalDrop entry ships in V1 through the drop modal and parser the Forge already has (§4.1).

**Three things the repo changed about the design (§1 F3, F9, and D-SR-1):** the equip route only equips a *committed* list, so adoption saves the list committed (ruled Nov 12); the time-frame picker must use the idea record's four horizons, not the prototype's four labels; and the step turn runs on Sonnet 5.5 with hard cost controls (§6.12) because the research turn needs schema-checked, cited output and must not run up the bill.

**Where it sits in the loop (V1.2).** Work an idea is the Decide step: it creates the idea record. From there the record has two sinks, both of which already exist or are being built elsewhere and both of which read the same record: **the BaggerBomb book** ("Use it in my next game" — ready, then equip — the sink that exists today) and **the Practice Field's paper book** (the Agent Training Game arc, concept V6.1 and shared contract V2, approved Nov 12), where the player's agent drafts from saved ideas and tests them without a battle. The Practice Field is therefore the "Track this idea" this spec kept out of scope; it needs nothing from B1/B2 but a provenance stamp (§5.5). The Film Room grades the idea's names either way. One record per idea holds.

**Rulings so far (§2):** D-SR-1 Sonnet 5.5 with cost controls, D-SR-2 SignalDrop ships, D-SR-3 committed list — all ruled Nov 12. D-1 budgets and D-4 admission stand on their defaults unless Flash says otherwise.

---

## 1. What the inspection found

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| F1 | **The record extension is present**: `question`, `findings[]`, `summary`/`summaryRevisions[]`, `symbolKeys[]`, the `shared_research` origin, host `sharedResearchSessions`, id `sr_<sessionId>`, `concluded`, pure patches and two store writes. Nothing writes them yet. | `api/_utils/researchRecords/model.js:95-100,117,470,544,586,634,807,857,875,889`; `store.js:72,102,150,170`; `findingRecordKinds.js:17-21` | B1 composes each step's write from the pure patches (`findingAppendPatch`, `summaryRevisionPatch`, `turnPatch`) in one transaction (§6.4). |
| F2 | **The adoption builder is present** and refuses a record that is not `open`, a list without the session marker, kept findings that are not current, and more than 30 refs (28 kept findings). The version is born `researched`, `stateSource: 'research'`, `stateReason: 'shared_research_completed'`, `opId: adopt_<sessionId>`. | `api/_utils/hypothesisRecords/model.js:69,71,164,397-437`; `src/constants/hypothesisRecords.js:81`; pinned by `sharedResearchVersion.test.js` | Adoption is one transaction that creates the list, calls the builder, writes v1 and closes the record `saved_to_list` with the subject (§6.6). Kept findings are capped at 28. |
| F3 | **Equip requires a committed list.** `equip-watchlist` refuses `status !== 'committed'` (`not_committed`); every list-creating path writes `status: 'draft'`; a committed list refuses direct edits. | `api/agent/equip-watchlist.js:52,77`; `api/forge/watchlists.js:199,326,546`; `api/forge/watchlists/[id].js:228-232` | The concept's "ready → equip" works only if adoption saves the list **committed** (`status: 'committed'`, `committedAt`). V1 never revises an idea, so a committed list loses nothing. **D-SR-3** (§2). |
| F4 | **The SignalDrop entry is already built; only its citation form was in question.** `SignalDropEntry({ open, onClose, onStartDialogue })` is a self-contained modal (paste / URL / image → `POST /api/forge/parse-signal` → `onStartDialogue({ parseResult, dropId })`), kept "agent-agnostic so it can be repurposed for non-dialogue flows"; the parse returns `topic`, `tickers`, `claims`, direction, confidence, and `validation.validated` (the tickers inside the universe); the drop record lands at `users/{uid}/signalDrops/{dropId}`, owner-readable, cached 6 h by content hash. The parser runs on Haiku 4.5 (`claude-haiku-4-5-20251001`). `FINDING_RECORD_KINDS` has no `signalDrops`, so a finding cannot *cite the drop record* — but a drop is the player's own pasted material, which the vocabulary already names: `observation`, source `exchange`. There is no "public SignalDrop" in the repo. | `src/components/SignalDrop/SignalDropEntry.jsx:25-29,140`; `api/forge/parse-signal.js:1-20,44,144,377-385`; `api/_utils/tickerValidation.js:16-39`; `firestore.rules:141`; `findingRecordKinds.js:17-21` | **D-SR-2 ruled: ships in V1** (§4.1). The drop is the player's words ("Your drop"), its validated tickers are the names in scope, its parsed claims are unverified findings, and its URL is the first step's retrieval target. Nothing is Source-backed until a step verifies it. The CTA label becomes a prop of `SignalDropEntry` (default unchanged). Citing the drop *record* as a finding source stays a schema-v2 option the design does not need (§14). The concept's allowlist case 1 ("a public SignalDrop") runs on the founder's own drop. |
| F5 | **The voice rulebook is not on `main`.** `docs/design/SHADOW_VOICE_RULES_V1.md` exists on `claude/huddle-s1` @ `fd9967c` (§1–3; its header says "Shared Research extends it for written openings"). `voiceLayerPrompt.js` has no `shared_research` mode; `set_analysis` is the agent-less analyst precedent. | S1 branch `docs/design/SHADOW_VOICE_RULES_V1.md`; `api/_utils/voiceLayerPrompt.js:2846,3185` | B1 adds §4 "Written openings (Shared Research)" and §5 "Baseline method v0" to the rulebook. Coordination rule in §6.8: if S1 has merged, edit the file; if not, B1 commits §1–3 byte-identical from `fd9967c` plus §4–5, and the S1 rebase keeps them. |
| F6 | **The model wrapper keeps usage, with a hole.** `callGemmaVoiceWithRetry({ includeUsage: true })` returns `usage` only for a first-attempt success; a retried call returns `usage: null`, and `applyTurn` then marks the record's tokens `'unknown'` for good. | `api/_utils/gemmaClient.js:27-33,337-340`; `researchRecords/model.js:430-452` | Cost is measured from the shadow-log stream (`logConversation`), which carries every call's own usage and attempt count, not from the record's telemetry alone (§6.9, §11.4). |
| F7 | **The Exa adapter exists**: `queryExa(body, { timeoutMs })`, returns `results`, `costDollars`, `requestId`; 8 s default timeout. `exaCatalystFetch.js` is the mover query layer (not reused). `EXA_RETRIEVAL_ENABLED` is FantasyTimes's flag (not reused). | `api/helpers/exaClient.js:22-59`; `api/_utils/exaCatalystFetch.js:1-30`; `src/config/featureFlags.js:1635` | Shared Research gets its own retrieval adapter over `queryExa` (§6.5): a question in, items out, each with url, title, publisher host, publishedDate, highlights. |
| F8 | **Stories carry `reporterBeat`, `reporter`, `publishedAt`, `expiresAt`, `status`, `tickers`, `primaryTicker`, `type`; no question, no url.** Beats: `REPORTER_PROFILES` (kai Market Pulse, alex Stock Spotlight, neta Economics Desk, doug Earnings Analyst, kim Sector Strategist, vera Thematic & Industry Research). Public read. Index `(status, expiresAt, publishedAt desc)` exists. S1's evidence fetcher treats the document id as `newsId` and skips `type === 'deepdive'`. | `api/fantasytimes/poll-batch.js:131-155`; `api/_utils/fantasyTimesPrompts.js:10-64`; `firestore.rules:923`; `firestore.indexes.json`; S1 `api/_utils/evidence/fantasyTimesStories.js` | R3 holds: Level 0 mapping in §8, one question per beat in `src/constants/sharedResearch.js`. |
| F9 | **The prototype's time frames do not match the idea record.** V2 offers `['2 weeks','1 month','3 months','6 months']`; the record has `HORIZON_ENUMS` `intraday · swing · positional · longterm · unspecified` with windows 2 / 10 / 30 / 60 sessions. | `sr2-data.jsx:42`; `src/constants/hypothesisRecords.js:40,44` | The picker offers three enum horizons with their session windows — swing 10, positional 30, longterm 60 — the same three the Practice Field uses (its note, item 3); intraday is not offered on either side, `unspecified` never. The stored value is the enum. |
| F10 | **The gate patterns are settled.** Tri-state flags live in their own module, read at call time, noted in `flagPinGuard`'s `DARK_BY_DESIGN` block; the server gate order is middleware → mode → auth → owner admission → method. Idea-record admission is the cockpit allowlist (`HYPOTHESIS_RECORDS_ENABLED` + `COCKPIT_ALLOWLIST_UIDS`). | `src/config/researchModalFlags.js`; `src/config/flagPinGuard.test.js:262-296`; `api/_utils/hypothesisRecords/http.js:30-54`; `gate.js:14-58`; `api/_utils/filmRoom/cardsGate.js:36-55`; `api/_utils/callRecords/allowlist.js` | `SHARED_RESEARCH_MODE` in `src/config/sharedResearchFlags.js`; the route gate in §6.2. |
| F11 | **The hub mounts sheets through one overlay stack and pins its reachable modules.** `HubOverlayProvider`/`useHubOverlays`, `useHubSheets` (`HUB_SHEETS`), `HubSheet`; the mount guard lists every module the hub chunk may reach (`PERMITTED_TERMINALS`). | `src/components/CommandCenter/hub/HubOverlays.jsx:28,58`; `hub/useHubSheets.js:35-44`; `HubSheet.jsx:47`; `commandCenterHub.mount.guard.test.js:561-601` | The one lazy edge the hub adds is named in §7.6 and §14; the guard row is the hub amendment's. |
| F12 | **Game eligibility is a code fact.** `STOCK_UNIVERSE` / `ALL_TICKERS` and `isRetiredStock`. | `api/_utils/rankingConfig.js:18,103,381` | A company card says "In the game's universe" / "Outside the game's universe · research still valid" from that fact; no inference (§6.7). |
| F13 | **Identity exists only at the ticker, inside the universe.** `peerRankings/{ticker}.name` holds EODHD's company name for universe names; there is no name → symbol store outside it (desk note Tier-1 a is Level 1). | `api/cron/compute-rankings.js:135,1327,1355`; desk note V1.1 §2, §5 | V1 resolves a company's symbol against the universe map only (§6.7). A public company outside it keeps its name on the card with "Symbol · not in the app's records" and is not an adoption choice (a list holds symbols). |
| F14 | **Finding kinds carry no slot for a rankings or peer-metrics row.** `FINDING_KINDS` = `earnings_fact, release, coverage, check_receipt, setup, idea, observation, product, relationship, inference, next_action`; `stockRankings`/`peerRankings` are *source* kinds the contract added for the opening. | `researchRecords/model.js:634-637`; contract §9 item 2 | V1's deterministic opening writes the estimates row and the stored-claims count as `earnings_fact` findings and shows the rankings and peer rows as a live, unwritten projection ("What the records already hold"); a `metric` kind is a schema-v2 question for the framework (§14). |

---

## 2. Founder decisions

D-SR-1, D-SR-2 and D-SR-3 were ruled on Nov 12 and are applied below. D-1 and D-4 keep their defaults (in bold) unless Flash says otherwise.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **D-1** | **Budgets and what counts.** | Ceilings: 10 steps per investigation, 3 new investigations per player per day (allowlist). Counting: (a) an investigation counts at **`open`** (the first write), never at browsing or framing; (b) a **step counts when its model turn is persisted** (`completion`); a failed turn (`failure`) and a lost-concurrency turn (`cancellation`) are telemetry only and leave `stepsUsed` unchanged; (c) **refresh is a step**; (d) **direction is a step** (it runs the model; §4.3); (e) **framing** has its own ceiling, **10 framings per player per day**, counted when the model call is made (the cost happened), because a framing creates no investigation; (f) a retry re-sends the same `stepId` and is never counted twice. | **Adopt as written**; revisit with §11.4's measured costs before the flip. |
| **D-4** | **Admission and activation.** | The route is on for a caller only when `SHARED_RESEARCH_MODE` admits them **and** idea-record admission does (`hypothesisRecordsOnFor(uid)`), since adoption writes idea records. Today both resolve to the cockpit allowlist. Activation = three one-line founder PRs: `off → allowlist → on`, each moving the pin. The idea-record gate's own admission (feasibility D-2, Purpose §8.3) is the framework chat's change and rides with the step to `on`. | **Adopt**; the `on` step waits for the framework's admission change. |
| **D-SR-1** · **ruled Nov 12** | **The model behind the step turn.** The concept names the Forge siblings' path (Gemma via OpenRouter, a `shared_research` voice mode, JSON by instruction, the 4-tier extractor). The step must return cited findings, statuses, supersedes, companies and a summary — a schema the server validates. | (a) Sonnet with structured outputs, the Huddle S1 script's path (`output_config.format`, usage logged on every answer; S1 `api/_utils/huddle/scriptPrompt.js:29-31`): schema-guaranteed JSON, far fewer failed steps. (b) Gemma through `callGemmaVoiceWithRetry`: cheapest, but a malformed turn is a failed step. | **Ruled: (a), with cost held down.** The step turn runs on **`claude-sonnet-5-5`** (the current Sonnet; the app's `claude-sonnet-4-6` and `claude-sonnet-4-20250514` ids are legacy and are not used here); the framing turn on **`claude-haiku-5-5`**; `effort: 'low'`, no extended thinking. Behind one adapter (§6.3), so the binding is a constant, not a rebuild. **Cost controls are a build requirement (§6.12):** per-turn token caps with a prompt budget, the D-1 player ceilings, a **global daily ceiling** that pauses research honestly when reached, and per-call cost accounting on the shadow log. The prompt module is registered in the prompt-honesty registry. This departs from concept §6's "Forge siblings' path" in the model binding only. |
| **D-SR-2** · **ruled Nov 12** | **SignalDrop entry in V1.** F4. | (a) Ship it through the existing `SignalDropEntry` modal and `parse-signal` route, as the player's own material. (b) Hold it for a `signalDrops` finding source (schema v2) and a hub picker. | **Ruled: (a), it ships.** The door is the Start view's "Use a SignalDrop" row (B2, inside the sheet — no hub change needed). A hub-level or search-bar shortcut to the same entry is a later one-line hub amendment (§14), not a V1 dependency. |
| **D-SR-3** · **ruled Nov 12** | **The adopted list's status.** F3. | (a) Save the list `committed` in the adoption transaction. (b) Save `draft` and commit from the sheet (three calls). | **Ruled: (a).** `status: 'committed'`, `committedAt = nowIso`; the preview is the commit ceremony; V1 never revises an idea; "Use it in my next game" stays two existing calls (ready, equip). |

**Also surfaced, not decided here:** the method asset is the R4 interim; `KB-PRODUCT-BUSINESS-001 v0.2` stays a candidate and is not imported. The beat questions' wording (§8) is copy for the founder's eye. **Separate task, not this build:** the app still carries legacy model ids (`claude-haiku-4-5-20251001` ×67, `claude-sonnet-4-6` ×51, `claude-sonnet-4-20250514` ×3, `claude-haiku-4-5` ×3 across `api/` and `src/`, tests excluded); their migration to the current ids is its own small Opus session with its own goldens check, and this build adds no new legacy id.

---

## 3. Rulings applied and routine choices (approve-by-default)

**Applied as given (founder, Nov 12):** the adopted list is saved `committed` (D-SR-3); the SignalDrop entry ships in V1 through the existing modal and parser (D-SR-2); the step turn runs on Sonnet 5.5 with cost controls, and no legacy model id is used (D-SR-1).

**Applied as given (kickoff R1–R8):** hub code is the Command Center chat's (R1; §14 lists what it must carry); `itemRef = { recordKind: 'fantasyTimesStories', recordId }` and never a URL (R2); FantasyTimes Level 0 with one question per `reporterBeat` and the story as the item (R3; §8); the method as a versioned prompt asset, `baseline@v0`, written to the rulebook (R4; §6.8); no Sonar, no Vera, at most one Exa retrieval and one model turn per step (R5); the agent's given name in copy, fallback "your agent", no "Shadow" (R6); `REVIEW_HONEST_LINE` on every idea surface, no learning/pairing/considered claims, no percentages, no running state without a request (R7); the three V2 corrections as acceptance requirements with focused regressions (R8; §9).

**Routine choices the build proceeds on:**
1. **One route file** `api/forge/shared-research.js` (`config.maxDuration: 30`): `GET` reads (`?sessionId=` one investigation; `?list=open` the open ones), `POST` actions `frame | open | step | close | adopt`. Reads go through the route, not the client SDK, so the gate is one place.
2. **Record-creation timing** (handover §6): `frame` creates the session as `status: 'framing'` with its two exchanges and **no research record**; `open` mints the record with the confirmed question and moves the session to `open`. A framing that is never confirmed leaves a host document and no record; it is invisible to "Continue your research" (§4.1, §6.4).
3. **Direction is a step** (D-1 d): the box's Send appends the player's exchange and runs the model with the direction steering it. The concept's "direction is free" is kept in the sense that direction never changes the question.
4. **Per-company thesis fragments are `idea` findings** written by the step that established the company's support (§6.4), so the adoption preview composes its draft deterministically with no model call (handover §5: "identify the bounded turn supplying the draft" — it is that step's turn).
5. **The quota lives on one owner document** `sharedResearchQuota/{uid}` (ET date, counts), updated in the `open` and `frame` transactions; no index.
6. **The "Continue" read** uses the existing `researchWork (userId, createdAt desc)` index with an in-memory filter (`origin === 'shared_research'`, `state === 'open'`), newest 50; a composite index is deferred until that bound is reached.
7. **Game eligibility and identity** from code and the universe map (F12, F13).
8. **Age for refresh:** a summary older than 2 ET calendar days shows "{age} old · Refresh".
9. **Horizon labels** (F9): `swing · about 10 sessions`, `positional · about 30 sessions`, `longterm · about 60 sessions`; `intraday` and `unspecified` are not offered (the player picks one of the three; a two-session business thesis is not a research idea, and the Practice Field excludes intraday too). The helper line: "How long you expect the business effect to take. Separate from any game's length."
10. **Model and retrieval timeouts inside the route deadline:** retrieval 8 s (the adapter's default), the model 16 s after a retrieval or 25 s without one, so retrieval + model + validation + persistence stays under 30 s (§6.4).

---

## 4. The product, as built (V2 screens → actions)

### 4.1 Entry (`SrStart`, `SrItemDraft`, `SrFraming`)
- **One opening surface.** Continue your research (open investigations, newest three, from `GET ?list=open`); Recent stories (the hub's selector supplies up to five items as props; three shown, "Show more"); Bring your own starting point (one box, three prompts that change only the example text); and, as V2 draws it, the secondary row **Use a SignalDrop** (D-SR-2).
- **SignalDrop → parse → preview → Investigate this.** "Use a SignalDrop" opens the existing `SignalDropEntry` modal (registered `within` the hub's overlay stack like the legacy sheets, since it portals into `<body>`), with its CTA reading "Investigate this" through a new `ctaLabel` prop (default "Start dialogue", so the Discover flow is unchanged). The modal runs the existing `POST /api/forge/parse-signal` (Haiku; cached 6 h by content hash) and returns `{ parseResult, dropId }`. The sheet then shows the item preview: "Your drop · {type} · {time}", the parse's topic and validated tickers, a proposed question composed deterministically from the parse's `topic` ("What is behind {topic}, and which company earns from it?"), editable; optional direction. **Investigate this** → `POST { action: 'open', entry: { kind: 'signaldrop', itemRef: { recordKind: 'signalDrops', recordId: dropId }, question, direction? }, requestId }`. The server reads the drop record (owner; `users/{uid}/signalDrops/{dropId}`) and opens from it (§4.2). A bailout parse (`shouldBailout`) is shown as the modal already shows it; the player can still investigate — the drop is their words either way. The parse's Haiku call counts against the framing ceiling (D-1 e); nothing else is charged until Investigate.
- **Story → preview → Investigate this.** The preview shows the headline, "From FantasyTimes · {reporterName} · {time}", the beat's question (editable), optional direction (prefilled from onboarding's typed explore text when the hub passes it). Nothing is written until **Investigate this** → `POST { action: 'open', entry: { kind: 'item', itemRef, question, direction? }, requestId }`. If an open or completed investigation already exists for this item and this player, the preview offers Continue / Open it instead (the server answers `existing` with the session; the client also checks the `list=open` answer first).
- **Own words → Frame my question.** `POST { action: 'frame', observation, requestId }` → one model call → `{ sessionId, frame: { question, check, notEstablished }, quota }`. The session is created `framing` with the player's exchange (the observation, literal) and the partner's exchange (the framing). Failed framing: the session is `framing` with `lastError`; Retry re-sends the same `requestId`; "Edit my words" closes it `abandoned` and returns to the box with the text. **Investigate this** → `POST { action: 'open', sessionId, question, direction? }` mints the record with the player's confirmed question (edited or not).
- **Admission.** A caller the gate resolves off for gets `404 { error: 'disabled' }` on every action and read. The sheet's start view still shows the stories (reporter content is the hub's, readable by all) and the approved gated line on Investigate; the box is disabled with the same line (hub copy `hubCopy.js:145` is the hub's; the sheet has its own copy of the line, pinned equal by test).

### 4.2 The opening (`SrAnswer` with no summary, `SrContext`)
Deterministic, no model, no retrieval. The record is minted with: the question; for an item entry the item finding (`coverage`, the headline, source `fantasyTimesStories/{storyId}`, `status: 'unverified'`, `statusReason: 'reporter_content'`, rendered "From FantasyTimes", never Source-backed — R3); for an observation entry the `observation` finding (source `exchange` = the player's framing exchange, `unverified`, `statusReason: 'player_words'`, rendered "Your observation"); for a SignalDrop entry the drop's text (or its URL and note) as an `observation` finding (source `exchange` = a player exchange the server writes at `open` holding the drop's sanitized input, `statusReason: 'player_drop'`, rendered "Your drop"), each parsed `claims[]` item as an `inference` finding (same exchange, `statusReason: 'from_drop'`, rendered "From your drop"), and the parse's `topic` as the session's `entry.topic`; for each name in scope (the story's `tickers` ∩ universe, the drop's `validation.validated` symbols, none for an observation) the estimates row and the stored-claims count as `earnings_fact` findings carrying their records' dates; and one `next_action` finding (the beat's first step for an item, the framing's "what I'll check" for an observation; source `kb` `baseline@v0`). The rankings and peer rows are returned as an unwritten projection (F14). No summary exists yet: the screen shows the opening and the first step, never a placeholder conclusion.

### 4.3 Steps (`SrStep`, `SrDirection`, `SrCompanyCard` → Examine)
`POST { action: 'step', sessionId, stepId, intent: 'next' | 'examine' | 'refresh' | 'direction', direction?, target? }`:
- `next` runs the record's current `next_action`;
- `examine` carries `target: { symbol, relationshipFindingId, openFindingId }` — the selected company, its supported relationship and its open significance question (Correction B, §9);
- `refresh` re-checks the current evidence with the same question;
- `direction` appends the player's words as an exchange, then runs the model steered by them.

One retrieval (at most), one model turn, validation, one transaction. Running shows only while the request is in flight. A failed step appends nothing, keeps the investigation open, and offers Try again with the same `stepId`. Budget spent: reading, adoption and close stay available.

### 4.4 Companies connected (`SrCompanies`, `SrLead`)
Derived on the server from the record (§6.7), returned on every read: supported connections (identity resolved and a current verified `relationship` finding with that symbol) and leads (named companies whose identity or relationship is unresolved). Each supported card: name · symbol · role · the relationship fact · its evidence (the current findings with that symbol) · the open significance question (that symbol's current `unavailable` finding, if any) · game eligibility from code · Examine this connection · Turn this into an idea (pre-selects the name). Leads list their Inferred / Unresolved label and are never adoption choices.

### 4.5 Endings (`SrWork` actions, `SrDiscard`)
`POST { action: 'close', sessionId, reason: 'concluded' | 'abandoned' }`. `concluded` → record `completed / concluded` (needs the question, refuses a subject); `abandoned` → `abandoned / user_close`. Leaving writes nothing. The ended view keeps the answer and offers "Start a new investigation" (an observation entry prefilled with the observation, or the item preview again; findings never carry over).

### 4.6 Adoption (`SrAdopt`, `SrSavedIdea`)
`GET ?sessionId=` carries `adoptPreview` (the composed draft per supported company, the carried finding ids, the preview revision). `POST { action: 'adopt', sessionId, statement, horizonEnum, symbols[], activation[], invalidation[], keptFindingIds[], previewRev: { summaryRev, findingsCount } }` → one transaction (§6.6) → `{ watchlistId, version: 1, researchWorkId, idempotent }`. Save never equips. "Use it in my next game" = the existing ready transition then the existing equip route, with the replacement line from the hub's equipped-list reader (props). Failed equip keeps the saved idea. Interrupted Save: the client re-reads (`GET ?sessionId=`) before any retry; a `saved_to_list` record means saved; a retry of `adopt` on a saved record answers the existing version (`idempotent: true`).

---

## 5. Records and field mapping

### 5.1 `sharedResearchSessions/{sessionId}` (new collection; server-written, owner-readable)
```
{ schemaVersion: 1, sessionId, userId, createdAt, updatedAt,
  status: 'framing' | 'open' | 'completed' | 'abandoned' | 'failed',
  entry: { kind: 'item' | 'observation' | 'signaldrop', itemRef: { recordKind, recordId } | null, observation: string | null, direction: string | null, topic: string | null },
  //   itemRef.recordKind: 'fantasyTimesStories' for an item, 'signalDrops' for a drop — a session field, never a finding source
  frame: { question, check, notEstablished, at, attempts } | null,
  exchanges: [ { exchangeId, who: 'player' | 'partner', kind: 'observation' | 'frame' | 'direction' | 'step' | 'turn' | 'confirm' | 'close', text, at, stepId?, target? } ],
  stepsUsed, stepBudget, lastStep: { stepId, intent, status: 'running' | 'completed' | 'failed', startedAt, endedAt, error } | null,
  researchWorkId: 'sr_<sessionId>' | null,         // null while framing
  retrieval: { calls, costDollars, elapsedMs },      // the route's own tally; the record's telemetry holds model tokens
  method: { id: 'baseline', version: 'v0' },
  attribution: { agentId, archetypeCodeId, baggerbombArchetypeCodeId, identityVersion, at },   // §5.5 — stamped at open
  adoption: { watchlistId, version, at } | null }
```
`sessionId` = `crypto.randomUUID()` (a host id, `HOST_ID_RE`). Every exchange carries `exchangeId: randomUUID()` minted before the write (contract §4). `stepBudget` = 10 (D-1). Rules (§6.10): owner read, no client write.

### 5.2 `researchWork/sr_{sessionId}` (the extension)
Minted at `open` by `buildRecord({ researchWorkId: researchWorkIdFor({ collection: 'sharedResearchSessions', id: sessionId }), userId, origin: 'shared_research', host: { collection: 'sharedResearchSessions', id: sessionId }, createdAt, question, funnel: { stages: {}, symbols: [] }, budget: null, telemetry: emptyTelemetry() })` — question set at mint, no subject. Findings, summary, symbolKeys as the contract. `budget` stays `null`: the step budget is the session's (the contract's `budgetOf` currency is persisted messages, not steps).

**Finding writers (every one server-side):**

| Finding | kind | symbol | source | status / statusReason |
|---|---|---|---|---|
| the story item | `coverage` | `primaryTicker` in universe, else `null` | `fantasyTimesStories` / storyId / "FantasyTimes · {reporterName} · {beat}" | `unverified` / `reporter_content` |
| the player's words | `observation` | `null` | `exchange` / the player's exchangeId / "Your words" | `unverified` / `player_words` |
| the player's drop (text, or url + note) | `observation` | `null` | `exchange` / the drop exchangeId written at `open` / "Your drop · {type}" | `unverified` / `player_drop` |
| a claim the parser read in the drop | `inference` | a validated symbol the claim names, else `null` | `exchange` / the drop exchangeId / "From your drop" | `unverified` / `from_drop` |
| estimates row | `earnings_fact` | the name | `estimatesCache` / `latest` | `verified` |
| stored earnings claims count | `earnings_fact` | the name | `ingestedClaims` / `count:{SYMBOL}` | `verified` |
| a retrieved fact | the model's kind among `coverage · release · earnings_fact · product · relationship` | the resolved symbol or `null` | `retrieval` / the result's url (≤1,024) / "{host} · {title}" with `url` | `verified` only when the result index is real; the model's `at` (publishedDate) and `asOf` (publishedDate), never the write time |
| an inference | `inference` | resolved symbol or `null` | `exchange` / the partner's exchangeId for this step / "Inferred in this step" | `unverified` / `inference` |
| an unresolved link | `relationship` or `product` | resolved symbol or `null` | `exchange` / the partner's exchangeId / "Not yet checked" | `unavailable` / a typed word (`not_checked`, `not_disclosed`, `identity_unresolved`, `single_source`) |
| the one next action | `next_action` | `null` | `kb` / `baseline@v0` / "Baseline method v0" | `unverified` / `proposed` |
| a company's proposed claim | `idea` | the company's symbol | `exchange` / the partner's exchangeId / "Proposed claim" | `unverified` / `proposed_claim` |
| a correction | any | — | — | `supersedes: <earlier findingId>` (one chain, never a fork) |

A step that cites a finding it did not write is refused (`invalid_source`). A `retrieval` source must carry a url (`retrieval_needs_url`). A fact over 500 characters is cut by the validator before `buildFinding`, never after.

### 5.3 `sharedResearchQuota/{uid}` (new; server-only)
`{ etDate, investigationsOpened, framingsRun, updatedAt }`, reset when `etDateOf(nowIso)` (`api/_utils/mandateClosePass.js:80`) changes. Read and written inside the `open` and `frame` transactions. Surfaced to the client in every answer as `quota: { investigationsToday, perDay, framingsToday, framingsPerDay }` so the daily-limit line is true.

### 5.4 The idea (adoption, §6.6)
- **List** `watchlists/{id}`: the `watchlists.js` shape (`watchlistId` = its own id — the builder checks it; `userId`; `agentId: null`; `sourceSessionId: null`; `sourceDropId: null`; `sourceSharedResearchSessionId: sessionId` (the marker, `SHARED_RESEARCH_LIST_MARKER`); `thesis: ''`; conditions `[]`; `tickers: [{ symbol, reasoning: <the company's relationship fact, ≤500>, category: 'research', addedBy: 'user', addedAt }]` through `capTickersArray`; `name: ''`; `notes: ''`; `status: 'committed'`, `committedAt: nowIso` (D-SR-3); `researchWorkId: 'sr_<sessionId>'`; `currentHypothesisVersion: 1`; `hypothesisVersionCount: 1`; `attribution`: the session's block, copied (§5.5)). `splitRetiredTickers` drops a retired name; all retired → refused `no_valid_tickers`.
- **Version** `hypothesisVersions/v1`: exactly `buildSharedResearchVersion(...)`'s output. B1 passes the `attribution` block to the builder; the builder carries it only once the framework adds an additive, non-hashed field for it (§5.5, §14) — until then the list holds it and the version reaches it through `watchlistId`.
- **Record close**: `closePatch(record, { state: 'completed', terminalReason: 'saved_to_list', atIso, funnel: { stages: {}, symbols: [] }, subject: { watchlistId, hypothesisVersion: 1 } })`.
- **Session**: `status: 'completed'`, `adoption: { watchlistId, version: 1, at }`, plus the confirming exchange (`kind: 'confirm'`, the player's "Saved as an idea · {names} · {horizon}") whose `exchangeId` is the builder's `confirmExchangeId`.

### 5.5 Provenance stamps (Practice Field shared contract V2 §5.1; its note, item 1)
The Practice Field's drafting call may read only sources whose attribution is **recorded**, never inferred. So the session records, at `open`, which agent and archetype the partner wore at that moment — as provenance only; the idea stays the player's (framework D1), and no V1 step turns on the archetype:
```
attribution: { agentId,                    // the RANKED record, never a casual clone — resolved by the platform's resolver
                                            //   (resolveAttributionAgentId, the Film Room's attributionAgentOf precedent, api/_utils/filmRoom/cardStore.js:111);
                                            //   a clone that cannot be resolved → `open` is refused 503 attribution_unavailable, before any write
               archetypeCodeId,            // the ranked agent's `archetype` (the League approach)
               baggerbombArchetypeCodeId,  // `baggerbombLoadoutOf(agent).archetype` — the approach the idea's book will deploy with (may equal the first)
               identityVersion,            // ARCHETYPE_IDENTITY_VERSION at the moment (api/_utils/archetypeVersionConstants.js:58; 2 today)
               at }                        // the open instant
```
Adoption copies the block unchanged onto the list document and passes it to `buildSharedResearchVersion`. The version's copy is the framework chat's to add — an additive field **outside the content hash**, the `deployedBattleIds` precedent — so no existing hash moves; until it exists the list carries the stamp and a reader reaches it through the version's `watchlistId` (§14). The stamp is written by the server from the agent document read inside the `open` transaction; the client never supplies it. A player with no ranked agent cannot open an investigation (`attribution_unavailable`) — every player has one from setup (onboarding spec §3.1), so this is a guard, not a path.

---

## 6. B1 — the server (dark)

### 6.1 Files
```
api/forge/shared-research.js                     the route: GET reads, POST actions; config.maxDuration 30
api/_utils/sharedResearch/gate.js                sharedResearchMode(), sharedResearchOnFor(uid), gateSharedResearchRoute(req, res, { methods, rateLimit })
api/_utils/sharedResearch/session.js             pure: session shape, exchange builders (exchangeId minted), state checks, SESSION_SCHEMA_VERSION
api/_utils/sharedResearch/store.js               transactions: openInvestigation, startFraming, recordStep, failStep, closeInvestigation, adoptIdea; readInvestigation, listOpen
api/_utils/sharedResearch/opening.js             pure: the deterministic opening (item/observation findings, stored facts, first next_action) from stored reads
api/_utils/sharedResearch/companies.js           pure: companiesOf(record, universe) — identity · relationship · significance (Correction A)
api/_utils/sharedResearch/adoptPreview.js        pure: draft claim + carried finding ids from the exact selected names (Correction C); assertion check
api/_utils/sharedResearch/stepPrompt.js          the step and frame prompts (registered in PROMPT_CONTRIBUTING_MODULES)
api/_utils/sharedResearch/stepSchema.js          the JSON schemas the model turn must satisfy; the validator that turns a turn into finding inputs
api/_utils/sharedResearch/modelTurn.js           the model adapter: runTurn({ kind: 'frame'|'step', system, user, schema, signal }) → { ok, output, usage, model, attempts, elapsedMs, costUsd } (D-SR-1); MODELS = { step: 'claude-sonnet-5-5', frame: 'claude-haiku-5-5' }, MAX_OUTPUT_TOKENS, MODEL_PRICES (§6.12)
api/_utils/sharedResearch/promptBudget.js        pure: the input budget — trims retrieval items, then older findings, to the cap; refuses over the hard cap (§6.12)
api/_utils/sharedResearch/retrieval.js           the retrieval adapter over api/helpers/exaClient.js queryExa: retrieve({ question, direction, symbols, signal }) → { items[], costDollars, elapsedMs } | { error }
api/_utils/sharedResearch/method.js              METHOD = { id: 'baseline', version: 'v0', text } — the R4 asset, the same text as the rulebook §5
api/_utils/sharedResearch/copy.js                the server's player-facing lines (failure, refusal) — guarded like hub copy
src/constants/sharedResearch.js                  Node-clean, shared with B2: ENTRY_ITEM_RECORD_KINDS ['fantasyTimesStories', 'signalDrops'], BEAT_QUESTIONS, STATUS_LABELS, STATUS_REASON_LABELS, HORIZON_LABELS, STEP_BUDGET 10, PER_DAY 3, FRAMINGS_PER_DAY 10, GLOBAL_STEPS_PER_DAY_DEFAULT 150, AGE_DAYS 2
src/components/SignalDrop/SignalDropEntry.jsx    ONE additive prop, `ctaLabel` (default 'Start dialogue'); nothing else changes (the Discover flow is byte-identical with the prop absent)
src/config/sharedResearchFlags.js                SHARED_RESEARCH_MODES ['off','allowlist','on'], SHARED_RESEARCH_MODE = 'off' (Pinned by: sharedResearchFlags.test.js)
docs/design/SHADOW_VOICE_RULES_V1.md             §4 Written openings (Shared Research), §5 Baseline method v0 (see §6.8 for the S1 coordination)
firestore.rules                                  sharedResearchSessions (owner read, no client write), sharedResearchQuota (no client access)
```
No fenced file is touched. `api/` imports `src/constants/sharedResearch.js` and `src/config/sharedResearchFlags.js` under the §4 import rule (both import nothing).

### 6.2 The gate
`gateSharedResearchRoute` in `http.js`'s order: `applySecurityMiddleware` (rate limit `{ limit: 10, windowMs: 60_000 }` for POST, `{ limit: 30, windowMs: 60_000 }` for GET) → `Cache-Control: no-store` → `sharedResearchMode() === 'off'` → 404 `{ error: 'disabled' }` before auth → `requireAuth` → `sharedResearchOnFor(uid)` false → the same 404 → the method. `sharedResearchOnFor(uid)` = (`mode === 'on'` ? any uid : `mode === 'allowlist'` ? `isCockpitOwnerAllowlisted(uid)` : false) **and** `hypothesisRecordsOnFor(uid)` (D-4). Unknown mode values resolve off. Pure apart from the environment reads; never throws.

### 6.3 Actions and their contracts

| Action | Body | Does | Answers |
|---|---|---|---|
| `frame` | `{ observation (1–500 chars after trim; `<>{}` stripped), requestId (forge id) }` | Quota check (framings); creates the session `framing` with the player exchange; **one model call** (frame schema: `question` ≤500, `check` ≤300, `notEstablished` ≤300); writes the partner exchange and `frame`; quota +1 at call time. A failure writes `lastError`, status stays `framing`. A repeated `requestId` on a `framing` session returns it (no second call); on a failed one, re-runs. | `{ sessionId, status, frame, quota }` or `{ sessionId, status: 'framing', error: 'frame_failed' }` (200) |
| `open` | item: `{ entry: { kind: 'item', itemRef, question, direction? }, requestId }` · drop: `{ entry: { kind: 'signaldrop', itemRef: { recordKind: 'signalDrops', recordId: dropId }, question, direction? }, requestId }` · observation: `{ sessionId, question, direction? }` | Validates `itemRef.recordKind ∈ ENTRY_ITEM_RECORD_KINDS` (`['fantasyTimesStories', 'signalDrops']`) and the referent exists — the story (`fantasyTimesStories/{recordId}`, `type !== 'deepdive'`) or the caller's own drop (`users/{uid}/signalDrops/{dropId}`; another owner's → `item_not_found`); dedupe: an open or completed investigation of this owner on this `itemRef` answers `existing`; quota check (investigations); the owner's ranked agent read and the attribution block built (§5.5; unresolvable → 503 `attribution_unavailable`, nothing written); **one transaction**: quota +1, host (`open`, item/drop: created now; observation: the `framing` session moved to `open`; `attribution` stamped), record minted with the question and the opening's findings (§4.2), `researchWorkId` on the host. Idempotent on `requestId`/`sessionId` (a retry finds the record and writes nothing — `mintWithHost`'s rule). | `{ session, record: projection, companies, opening: { storedRows }, quota, existing?: true }` |
| `step` | `{ sessionId, stepId (uuid), intent, direction?, target? }` | Owner, `open`, `stepsUsed < stepBudget`, the global daily ceiling not reached (§6.12 — else `503 budget_paused` before any call), `lastStep` not `running` for a different `stepId` (a `running` older than 35 s is treated as failed); writes `lastStep: running` and, for `direction`, the player's exchange; **retrieval** (≤1, 8 s) unless `intent === 'refresh'` with no new query terms; **one model turn** (step schema; the prompt sized by `promptBudget.js` first, §6.12) with the system prompt (§6.8), the record's current findings, the retrieval items (numbered), the target block (examine) and the direction; **validate** (§6.4); **one transaction**: fresh read, owner, open, `stepsUsed` re-check, append findings in order (each `findingAppendPatch` applied to the in-memory record), `summaryRevisionPatch` when the turn revised the answer (`expectedRev` = the rev the turn saw → `summary_conflict` is a `cancellation`), `turnPatch({ kind: 'completion', elapsedMs, usage })`, host: partner exchange, `stepsUsed + 1`, `lastStep: completed`, `retrieval` tally. Failure at any point before persistence → `failStep` (host `lastStep: failed`, `recordTurnOutcome('failure')` when the model was called); nothing appended. | `{ session, record: projection, companies, changed: { summary: bool, findings: n }, quota }` or `{ error: 'step_failed', reason, session }` (200; 504 on model abort) |
| `close` | `{ sessionId, reason }` | `concluded`: `closePatch(record, { state: 'completed', terminalReason: 'concluded' })` (the model refuses a subject or a missing question); `abandoned`: `closePatch(..., { state: 'abandoned', terminalReason: 'user_close' })`; a `framing` session (no record) closes host-only. Host `status` follows. Idempotent: a closed investigation answers its state. | `{ session, record: projection }` |
| `adopt` | §4.6 | §6.6 | `{ watchlistId, version: 1, researchWorkId, idempotent }` |
| `GET ?sessionId=` | — | Owner read of host + record; the projection (§6.7), `companies`, `adoptPreview` while open with ≥1 supported company, `storedRows`, `quota`. | `{ session, record, companies, adoptPreview, storedRows, quota }` |
| `GET ?list=open` | — | `researchWork where userId == uid orderBy createdAt desc limit 50`, filtered `origin === 'shared_research' && state === 'open'`; the matching hosts read by id (≤3 returned, newest `updatedAt`). | `{ open: [{ sessionId, question, state, lastTurnAt, findingsCount }], quota }` |

Typed refusals (`SharedResearchError.code`, 4xx; `budget_paused` 503): `invalid_entry`, `item_not_found`, `item_kind_unsupported`, `invalid_question`, `invalid_observation`, `session_not_found` (also a foreign one), `session_not_open`, `step_in_flight`, `budget_spent`, `daily_limit`, `framing_limit`, `budget_paused`, `prompt_too_large`, `invalid_target`, `invalid_adoption` (with the builder's own code in `reason`), `unsupported_assertion` (with the token), `names_not_supported`, `preview_stale`, plus the record model's codes passed through. The model's `ResearchRecordError` and `HypothesisInputError` are mapped by `sendSharedResearchError` (the `sendHypothesisError` shape).

### 6.4 The step turn, validated
**Schema (`stepSchema.js`), the model's output:**
```
{ reply: string ≤1200,
  findings: [ { tempId, kind, fact ≤500, symbolCandidate: string|null, companyName: string|null,
                support: { kind: 'retrieval', index } | { kind: 'inference', from: [tempId|findingId] } | { kind: 'unresolved', reason },
                at: ISO|null, supersedes: findingId|null } ] ≤12,
  summary: { text ≤1000, basedOn: [tempId|findingId] 1–25 } | null,       // null = the answer did not change
  lines: { support: ref|null, complication: ref|null, missing: ref|null },
  nextAction: { label ≤120, purpose ≤240 } | null,
  companies: [ { companyName, symbolCandidate|null, role ≤40, relationshipRef, openRef|null,
                 claim: { effect, relationship, evidence, uncertainty } | null } ] ≤6 }
```
**The validator, in order (a failure of a rule marked ✗ fails the step; others downgrade):**
1. `retrieval` support must name a real item index → `source: { recordKind: 'retrieval', recordId: url, label, url }`, `status: 'verified'`, `at`/`asOf` from the item's `publishedDate` (null when absent — never the write time); a bad index downgrades to `inference` with `statusReason: 'uncited'` (the A7 rule: an uncited fact is an inference or dropped). An `inference` support → `exchange` source (the partner's exchangeId minted for this step), `unverified`/`inference`. An `unresolved` support → `unavailable` with the reason as a typed word.
2. `symbolCandidate` resolves only inside the universe (F13): upper-cased, hyphen form; not in `ALL_TICKERS` or retired → `symbol: null`, and the company is a lead with `identity_unresolved`. **No ticker is ever written that the universe does not hold.** ✗ if the model writes a ticker-shaped token in `fact` that is not in the universe, the index names, or the acronym allowance (the Huddle script's scan; `ACRONYMS` lives in S1's `api/_utils/huddle/scriptPrompt.js:38-41`, not on `main`, so `stepSchema.js` carries its own copy with a note to share one list once S1 merges).
3. `kind` in `FINDING_KINDS`; the writer never accepts `check_receipt`, `setup`, `observation` from the model (observations are the player's).
4. A company enters `companies` as **supported** only when its symbol resolved **and** `relationshipRef` names a finding of this turn or the record whose kind is `relationship`, `status: 'verified'` and `symbol` is that symbol (Correction A). Otherwise it is a lead. Its `claim` is written as an `idea` finding (symbol set) only when supported.
5. `supersedes` must name a current finding; a forked chain ✗ (the model refuses it anyway).
6. The summary's `basedOn` resolves temp ids to minted ids and must be 1–25 current findings; a sentence of `summary.text` containing a number not present in any `basedOn` fact ✗ (`unsupported_number`) — the server-checked evidence discipline of concept §6.
7. Forbidden patterns (rulebook §2 and §4): learning words about the agent/partner, "guarantee", "will do", "considered", a percentage followed by "confidence", a price target, "buy"/"sell" as advice ✗ on `reply`, `summary.text`, every `fact`.
8. At most 12 findings per step; `FINDINGS_MAX` 100 on the record is the store's own refusal → a step that would exceed it fails `findings_full`.

A ✗ fails the step (nothing appended, `recordTurnOutcome('failure')`); the model is not re-asked inside the same request (one turn per step, R5).

**Timing (routine 10):** `t0` request start; retrieval `AbortController` 8 s; model `AbortController` `min(25_000, 28_000 − elapsed)`; persistence after; if elapsed > 28 s before persistence, the turn is recorded as `failure` with `reason: 'deadline'`.

### 6.5 Retrieval
`retrieval.js` `retrieve({ question, direction, symbols, numResults = 5, signal })`: builds the Exa body `{ query, type: 'auto', numResults, contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 }, text: false }, excludeDomains: EXCLUDED_DOMAINS }` (reusing `exaCatalystFetch.js`'s `EXCLUDED_DOMAINS` list and `hostOf`, imported — not its mover query), calls `queryExa(body, { timeoutMs: 8000 })`, returns items `{ index, url (≤1,024, http(s) only — else dropped), title, host, publishedDate|null, highlights[] }`, `costDollars`, `elapsedMs`. Never throws: `{ error }` → the step proceeds **without retrieval** and the prompt says so (the turn may still infer from stored findings; it cannot write `verified` facts). The tally lands on the session's `retrieval` and the shadow log. Providers stay replaceable behind this one function.

### 6.6 Adoption, one transaction (`adoptIdea`)
Before the transaction: normalize (statement trimmed, symbols upper-cased, conditions through `normalizeConditions`, horizon in `HORIZON_ENUMS` minus `unspecified`), compute `adoptPreview` from the **fresh** record and compare with `previewRev`: a different `summary.rev` or `findings.length` → `409 preview_stale` with the new preview (the player sees the reconciled draft before confirming; handover §4 Correction C). Then `assertAssertionsSupported(statement, carriedFacts)`: every number/percentage token in the statement must appear in a carried finding's fact (`unsupported_assertion`); every selected symbol's company name must appear and no deselected supported company's name may (`names_not_supported`).

Transaction: read record (owner, `open`, question), read host, read quota (unchanged by adoption), read the pre-allocated list ref (a retry re-reads the record first: `completed/saved_to_list` with a subject → answer the existing `{ watchlistId, version: 1, idempotent: true }` and write nothing); build the list doc (§5.4) with `watchlistRef.id`; `keptFindingIds` = the server's carried set for the selected names (never the client's list; ≤28); mint the confirming exchange; `buildSharedResearchVersion({ list: listDoc, watchlistId, record, userId, sessionId, statement, horizonEnum, activation, invalidation, keptFindingIds, confirmExchangeId, nowIso })`; `tx.set(listRef, listDoc)`; `tx.create(versionRef(v1), version)`; `tx.update(recordRef, closePatch(... saved_to_list, subject))`; `tx.update(hostRef, { status: 'completed', adoption, exchanges: arrayUnion(confirm), updatedAt })`. `safely()` is **not** used here: a builder refusal is the player's answer (`400 invalid_adoption`), not a skipped record.

**Shape of the helper (Practice Field note, item 2).** `adoptIdea` in `store.js` is written as **shared mechanics** — the pre-allocated committed list with its `attribution` block, the v1 write, the record close with its subject, the confirming exchange, the retry-safe idempotency — plus **one origin adapter** supplied by the caller: `{ origin: 'shared_research', listMarker: SHARED_RESEARCH_LIST_MARKER, buildVersion: buildSharedResearchVersion, evidence: (record, kept) => …, confirmText }`. V1 ships the one adapter and no second route; a second origin (`practice_field`, the Practice Field's T3, with its own marker, state reason and evidence refs) adds an adapter and its builder, not a rewrite. The hard-coded origin parts of the framework's builder itself (`SHARED_RESEARCH_LIST_MARKER`, `STATE_REASONS.sharedResearchCompleted`, the evidence-ref list) are the framework chat's to separate (§14).

**Equip** is not this route: the client calls `POST /api/forge/watchlists/{id}/hypothesis-transition { version: 1, action: 'ready', expectedStatus: 'researched' }` then `POST /api/agent/equip-watchlist { agentId, watchlistId, loadout: 'baggerbomb' }` (the per-game loadout flag is live, `PER_GAME_LOADOUT_ENABLED`). A ready that already happened answers `status_conflict` 409 → the client proceeds to equip. Failed equip → "Saved, not equipped."

### 6.7 The read projection and `companiesOf`
The route never returns the raw record. `projection(record)`: `researchWorkId, question, state, terminalReason, endedAt, createdAt, telemetry.lastTurnAt, summary { rev, text, at, basedOn }, summaryRevisions (rev, text, at only), findings (current, each with `findingId, kind, symbol, fact, source { recordKind, recordId, label, url? }, at, asOf, status, statusReason, supersedes`) and `superseded` (the rest), `lines` (the latest step's refs, stored on the host's last partner exchange as `lines`), `nextAction` (the current `next_action` finding), `age` (days since `summary.at`), `symbolKeys`.

`companiesOf(record, universe)`: group current findings by `symbol`; for each symbol with a current verified `relationship` finding → **supported** `{ symbol, name: universe.name(symbol), role, evidence: current verified findings with that symbol, openQuestion: that symbol's current `unavailable` finding, claim: the current `idea` finding, eligibility: inUniverse && !retired ? 'eligible' : 'outside' }`. The **role** is record-derived: the validator writes every `relationship` fact as `"{Role} · {fact}"` with `Role` from the closed list `Product owner · Supplier · Customer · Partner · Competitor · Other` (the step's `companies[].role`, mapped), and `companiesOf` reads the prefix — no field outside the record, no parsing of prose. A company the model named without a resolved symbol or without a verified relationship → **lead**: its name is kept in the finding's `fact` ("{name}: …" for `product`/`relationship` facts about an unresolved company, the validator's rule) with the status of its best finding. **Nothing in this function reads `stepsUsed`, exchanges or step counts** — the Correction A regression pins it (§9).

Game eligibility copy: `eligible` → "In the game's universe"; `outside` → "Outside the game's universe · research still valid" (V1 cannot produce it: an unresolved symbol is `identity_unresolved`, not `outside`; the branch exists for Tier-1 a). A lead shows "Symbol · not in the app's records".

### 6.8 The prompt, the voice rules and the method
- **`stepPrompt.js`** builds the system prompt from: the partner identity (the agent's given name; "You are {name}, {player}'s research partner on FantasyTrades. You investigate one fixed question; you never trade or instruct the agent."); the rulebook §4 rules rendered as a block; `METHOD.text` (§5 of the rulebook, `baseline@v0`); the output contract in words (cite by item index; never write a ticker you were not given; state what is inferred; one next action). The user turn carries the question, the direction, the current findings (id, kind, symbol, fact, status), the retrieval items (index, host, date, title, highlights), and for `examine` the target block ("Investigate {symbol}'s {relationship fact}. Resolve: {open fact}. Stay inside the question: {question}."). The module is added to `PROMPT_CONTRIBUTING_MODULES` in the same commit.
- **Rulebook §4 — Written openings (Shared Research), the lines B1 adds:** (1) the player's words are "your observation", never a fact; (2) every Source-backed sentence cites a retrieved item or a stored record; a sentence without one is written as an inference and says so; (3) identity, relationship and significance are three separate claims — a product being useful, a company owning it and that ownership mattering financially; (4) a supported relationship with unknown revenue exposure is said as exactly that; (5) no ticker the app's records do not hold; (6) no confidence number, no price target, no buy/sell, no "the agent will/considered/learned"; (7) one next action, aimed at the weakest link; (8) dates: the fact's date, the source's date, and "read" (the retrieval time) are three different things; a refresh does not make old evidence new; (9) an answer is at most 1,000 characters and is revised only when a step changes it. **§5 — Baseline method v0:** the chain *observation → problem → product → who pays → which company earns → why it might matter*; what each link needs as evidence; the questions to ask of a relationship (ownership, supplier, customer, partner, competitor), of significance (segment share, concentration, disclosed terms), and of counter-evidence (sector move, single source, vendor's own report); labeled "baseline, not a KB package; replaced by an accepted package by id and version". The same text is `METHOD.text` and a byte test pins the two equal.
- **Coordination with S1 (F5):** B1's kickoff checks `git log origin/main -- docs/design/SHADOW_VOICE_RULES_V1.md`. Merged → B1 appends §4–5. Not merged → B1 commits the file with §1–3 byte-identical to `claude/huddle-s1` @ `fd9967c` plus §4–5, and the PR description tells the Huddle chat so the S1 rebase keeps §4–5 (one file, never two).

### 6.9 Telemetry and the shadow log
Every model call (frame and step) → `logConversation({ userId, gameMode: 'shared_research', sessionId, researchWorkId, stepId, intent, model, attempts, usage, elapsedMs, retrieval: { calls, costDollars, elapsedMs }, methodId, methodVersion, outcome: 'completion'|'failure'|'cancellation', failureReason })` — awaited with `waitUntil`, never fire-and-forget past the response (BUILD_RULES §5). The record's `telemetry` gets the turn through `turnPatch`/`recordTurnOutcome` (tokens become `'unknown'` after any retried call, F6 — the shadow log is the cost source). Failed work is logged like completed work.

### 6.10 Rules and indexes
- `firestore.rules`: `match /sharedResearchSessions/{sessionId} { allow read: if request.auth != null && resource.data.userId == request.auth.uid; allow create, update, delete: if false; }` (the `analysisSessions` block's shape, `firestore.rules:1312`); `match /sharedResearchQuota/{uid} { allow read, write: if false; }`. Rules tests in `test/rules/sharedResearchSessions.rules.mjs` (owner read, foreign read denied, every client write denied, quota unreadable), on the `researchRecordExtension.rules.mjs` pattern.
- Indexes: **none new.** The `list=open` read uses `researchWork (userId ASC, createdAt DESC)` (deployed). The `symbolKeys` index is in `firestore.indexes.json`; its deployment is the founder's, needed before the allowlist run (the hub's per-symbol read uses it; B1 does not).
- Deployment note for the PR: the founder deploys the rules (`firebase deploy --only firestore:rules`) before the allowlist step.

### 6.11 Tests (B1)
- `gate.test.js`: mode × admission matrix; off before auth; unknown value → off; never throws.
- `session.test.js`: exchange ids minted once; state checks.
- `store.test.js` (emulator or the hypothesisRecords harness): `openInvestigation` idempotent on retry (one host, one record, quota +1 once); `daily_limit` at 3; `framing_limit` at 10; `recordStep` appends findings in order and refreshes `symbolKeys`; a `summary_conflict` is a cancellation; `failStep` appends nothing; `closeInvestigation` concluded/abandoned/framing; `adoptIdea` idempotent, list committed, version equals the builder's pinned output for the fixture, record closed with subject, `too_many` at 29 kept findings.
- `stepSchema.test.js`: every validator rule above, each with the defect it names (mutation-checked: a fixture that cites a non-existent index, a foreign ticker, a forked supersedes, an unsupported number).
- `companies.test.js`: **Correction A** — the data-center fixture translated to records: after step 1 (d1–d3, dm1 unresolved) `supported = []`, `leads = [Northfield]`; a refresh step appending no relationship finding leaves both unchanged however `stepsUsed` moves; after d4 (verified relationship, symbol resolved) `supported = [VGS]`; d4 superseded by an `unavailable` correction → supported empty again.
- `adoptPreview.test.js`: **Correction C** — the Shop Pay fixture: the draft's "62%" sentence carries p3; p2r/p5r replace p2/p5 in the carried set; a stale preview rev is refused; an edited statement with "71%" is refused `unsupported_assertion`; a deselected name still in the statement is refused.
- `route.test.js` (mocked db, the Forge route harness): the gate order; every action's refusal codes; **Correction B** — two `examine` steps on two companies produce two distinct target blocks in the prompt and two distinct `target`s on the exchanges; a `stepId` replay returns the stored result and makes no model call; the model abort → 504 and `failure` recorded; retrieval error → the turn runs without `verified` facts.
- `prompt.honesty.test.js`: the forbidden patterns on the system prompt's own text; `stepPrompt.js` in the registry; the method text equals the rulebook §5 byte for byte.
- `promptBudget.test.js` and `modelTurn.test.js` (§6.12): a prompt over the soft cap trims retrieval first, then the oldest findings, never the question or the target; over the hard cap → `prompt_too_large`, no model call; every model id in `MODELS` has a `MODEL_PRICES` row and matches `/^claude-(sonnet|haiku)-5-5$/` (no legacy id); `costUsd` arithmetic on a fixed usage; the global ceiling: the 151st step of an ET day answers `budget_paused` and makes no model call; the env override is read at call time.
- `open` with a drop: the owner's drop opens with "Your drop" and the validated names; another owner's drop → `item_not_found`; a bailout parse still opens.
- Provenance (§5.5): `open` stamps `attribution` from the ranked agent (a casual clone id resolves to its parent; an unresolvable clone → 503 `attribution_unavailable`, no write); adoption copies the identical block to the list and passes it to the builder; the client cannot set or change it.
- Full suite with the exit code asserted, the `Test Files` line read, never piped through `tail`; the emulator rules suite.

### 6.12 Cost controls (D-SR-1, ruled Nov 12)
The bill is bounded by construction, measured per call, and paused honestly before it runs away. Six controls:

1. **Models pinned to the current ids, in one place.** `modelTurn.js` `MODELS = { step: 'claude-sonnet-5-5', frame: 'claude-haiku-5-5' }`; `effort: 'low'`; no extended thinking; `max_tokens` 2,500 for a step, 600 for a frame. No other module names a model id. The parse behind the SignalDrop entry is `parse-signal`'s own Haiku 4.5 call today (F4) — a legacy id this build does not touch and the model-id migration task retires.
2. **An input budget, enforced before the call.** `promptBudget.js` sizes the assembled prompt (chars ÷ 4): the system prompt (rulebook §4 + method v0 + output contract) is fixed and small; the user turn renders at most 40 current findings (each `fact` cut to 200 characters in the prompt, never in the record), 5 retrieval items × 2 highlights × 3 sentences, the question, the direction and the target. **Soft cap 12,000 input tokens:** over it, retrieval items are dropped from the last, then the oldest findings not in the target or the summary's `basedOn`, until under. **Hard cap 16,000:** still over → the step fails `prompt_too_large` with no model call. A step therefore costs at most ~16,000 in + 2,500 out tokens, and ordinarily far less.
3. **Player ceilings (D-1).** 10 steps per investigation and 3 new investigations per day cap a player at 30 Sonnet steps a day; 10 framings a day on Haiku; the parse's cache (6 h by content hash) means a re-dropped signal costs nothing.
4. **A global daily ceiling with an honest pause.** `sharedResearchQuota/_global` `{ etDate, steps, framings }`, incremented in the same transactions that count a player's step or framing. Over `GLOBAL_STEPS_PER_DAY` (default 150; the environment variable `SHARED_RESEARCH_GLOBAL_STEPS_PER_DAY` overrides it, read at call time on the `allowlist.js` pattern, never at module scope) the route answers `503 { error: 'budget_paused' }` **before any model call**, and the sheet says "Research steps are paused for today — the daily research budget is used. Your investigation is kept; reading, saving an idea and closing still work." Framing has its own global count (default 300). The flag to `off` remains the kill switch.
5. **Cost accounting per call.** `modelTurn.js` computes `costUsd` from the provider's `usage` and a `MODEL_PRICES` table (USD per million input and output tokens for each id in `MODELS`, with a `pricesAsOf` date, filled from Anthropic's current price list at build time; a test pins that every id has a row). Every call logs `{ model, usage, costUsd, attempts }` to the shadow log (§6.9); the session's `retrieval.costDollars` carries Exa's own figure. The measurement sheet (§11.4) sums both.
6. **Rate.** The existing per-user limiter (10 POST per minute) stands; a `running` step blocks a second step on the same session (`step_in_flight`).

**What this comes to on the allowlist:** two accounts × 30 steps a day × at most 18,500 tokens a step is under 1.2 million Sonnet tokens a day at the absolute ceiling, and the global ceiling of 150 steps holds the whole app under about 2.8 million; typical steps run at a fraction of the cap. The measured p50/p95 per step and the daily total are what D-1 and the `on` step are decided on.

---

## 7. B2 — the client (dark)

### 7.1 Files (outside the hub directory)
```
src/components/SharedResearch/SharedResearchSheet.jsx       default export; the lazy module the hub imports; renders inside HubSheet (width 720, phone full)
src/components/SharedResearch/screens/Start.jsx             Continue · Recent stories (props) · Bring your own · Use a SignalDrop (mounts the existing SignalDropEntry with ctaLabel 'Investigate this', registered within the overlay stack) · gated states
src/components/SharedResearch/screens/DropPreview.jsx       the drop's preview: "Your drop · {type} · {time}", topic, validated tickers, the composed question (editable), direction → open
src/components/SharedResearch/screens/ItemPreview.jsx
src/components/SharedResearch/screens/Framing.jsx
src/components/SharedResearch/screens/Work.jsx               Context · Answer · Companies · Lines · Step · Direction · Deeper · actions
src/components/SharedResearch/screens/Adopt.jsx              the preview; SavedIdea; equip
src/components/SharedResearch/screens/Discard.jsx
src/components/SharedResearch/parts/*.jsx                    Finding, Source, StatusTag, Unresolved, Notice, Disclosure, CompanyCard, Lead
src/components/SharedResearch/sharedResearchCopy.js         ONE copy table (SR_COPY); every player-visible string
src/components/SharedResearch/sharedResearchView.js         pure: status label from (kind, status, statusReason); companies grouping for display; age; remaining steps; the four lines
src/components/SharedResearch/useSharedResearch.js          state + actions over the service; one in-flight request per session; 'running' only while a request is pending
src/services/sharedResearchService.js                       fetchWithAuth; `code === 'disabled'` → gated; GET/POST helpers; equip helpers call hypothesisVersionService (transition) and the existing equip service
src/components/SharedResearch/sharedResearchCopy.guard.test.js   the hub BANNED list (hubCopy.guard.test.js:375-379) plus "Shadow", "confidence", "%"; the honest line equals REVIEW_HONEST_LINE's text with [AGENT] substituted
```
The sheet takes props from the hub: `{ open: boolean, mode: 'start' | 'item' | 'signaldrop' | 'session', item?, direction?, sessionId?, stories: [{ itemRef, headline, reporterName, beat, publishedAt, context, question, reason|null }], agentName, equippedListLabel|null, onClose }` (`mode: 'signaldrop'` opens the drop modal at once — the hook for a later hub-level or search-bar shortcut, §14). It imports nothing under `src/components/CommandCenter/` except `HubSheet` and `useHubOverlays` (the H-2 class), and `SignalDropEntry` from `src/components/SignalDrop/`.

### 7.2 Screen states (each a `data-screen-label`, each tested)
Start: no open work · open work · stories (3 of 5, Show more) · no stories · stale stories (a `publishedAt` older than 48 h shows "Stories last updated {date}") · gated · daily limit · framing limit · budget paused. Framing: running · failed · framed. Item preview: fresh · existing (Continue / Open it). Drop: modal (the existing component's own states) · drop preview (parsed · bailout · existing investigation on this drop). Work: opening (no summary) · answer · running step · failed step · budget spent · no next step · concluded · saved · age + Refresh. Companies: supported · leads · none yet · none (concluded). Adopt: idle · stray name · over 1,000 · saving · failed · uncertain (Check the record) · not saved · saved · equip none/declined/running/done/failed.

### 7.3 Rules the client keeps
- **Status labels** from `(kind, status, statusReason)`: `verified` → Source-backed; `observation` → Your observation (`player_drop` → Your drop); `coverage` + `reporter_content` → From FantasyTimes; `inference` + `from_drop` → From your drop; other `unverified` → Inferred; `unavailable` → Unresolved · {reason label}. The reason labels table lives in `src/constants/sharedResearch.js` with a generic fallback.
- **Companies** are rendered from the server's `companies` only. The client computes no support.
- **Examine this connection** sends `{ intent: 'examine', target: { symbol, relationshipFindingId, openFindingId } }` for *that* card (Correction B).
- **Adoption** opens from the server's `adoptPreview`; deselecting a name recomputes the draft from the preview's per-company fragments (no request); an edited draft is the player's; the client's stray-name and number checks mirror the server's (the server is authoritative); `preview_stale` → show the new preview, keep the player's edits where the named companies still exist, ask to confirm again.
- **Time frame**: the three horizons with their windows (routine 9); none pre-selected.
- **Conditions**: per selected name, "Live above $" / "Wrong below $", daily close, empty by default; sent as `activation`/`invalidation` `{ symbol, side, level, basis: 'daily_close' }` through the existing `normalizeConditions` shape (`api/_utils/hypothesisRecords/model.js:118-136`).
- **Save states**: saving · saved · failed (nothing created) · **uncertain** on a timeout or network loss → "Check the record" → `GET ?sessionId=` → saved_to_list ⇒ recovered ("Found it: your idea was saved on the first attempt."); still open ⇒ "Checked: nothing was created. You can try again." Never a retry before the check.
- **Honest line** on the saved view: `REVIEW_HONEST_LINE` with `[AGENT]` → the agent's name, plus "A link between research and a game is shown only once the game records it." (V2's `honesty`), until Huddle S2's receipt (R7).
- **Running** is true only while `useSharedResearch` has a pending request for this session; a reopened sheet never shows running (the host's `lastStep.running` renders as "A step was in progress · Try again" if older than 35 s).
- **The agent's name** from props; fallback "your agent" (R6). No "Shadow" anywhere in `SR_COPY` (guard).
- **Accessibility**: `role="status"` on running lines, `role="alert"` on failures, `aria-expanded` on disclosures, focus returned to the opener (HubSheet does it), reduced motion respected (no pulse), 390 px phone layout single column.

### 7.4 Tests (B2)
jsdom: every state in §7.2 renders from a fixture session (no network); the drop modal mounts with `ctaLabel` "Investigate this" and its `onStartDialogue` result reaches the drop preview, which sends `entry.kind: 'signaldrop'`; the Discover panel's existing `SignalDropEntry` suite still passes with the prop absent; `examine` on two cards sends two different targets; deselect regenerates the draft; stray name blocks Save; uncertain → check → recovered / not saved; running only with a pending request; gated start shows stories and the gated line, no Investigate; copy guard; `agentName` fallback. Browser (the founder's smoke on the preview): phone 390 and desktop, keyboard through the whole flow, reduced motion.

### 7.5 What B2 does not build
The story selector, the For-you card, the Research panel door, the summary line, the activity rows, the next-action rule, the hub's gated/unavailable copy, the agent-name substitution in hub copy — all R1 (§14).

### 7.6 The one lazy edge (named here, built by the hub amendment)
`src/components/CommandCenter/hub/useHubSheets.js`: `HUB_SHEETS.RESEARCH = 'research'`; `const SharedResearchSheet = lazy(() => import('../../SharedResearch/SharedResearchSheet'))` mounted inside `HubOverlayProvider` so it counts for `modalOpen`; the mount guard gains the row `'src/components/SharedResearch/SharedResearchSheet.jsx': 'the Shared Research sheet, a lazy module outside the hub directory (H-2 class); loaded only when opened'`. The hub passes the props in §7.1 and reads `SHARED_RESEARCH_MODE` through `hub/hubFlags.js`; at `allowlist` the client gate is the cached cockpit-status verdict (`src/utils/filmRoomGate.js readFilmRoomVerdict`, the research-modal precedent `src/components/Research/Sheet/sheetGate.js:14-17`), one request per owner per page life.

---

## 8. FantasyTimes mapping (Level 0) and the forward read

**Level 0 (this build).**
- `itemRef = { recordKind: 'fantasyTimesStories', recordId: <document id> }` — the same id Huddle S1 uses as `newsId`.
- The selector is the hub's (onboarding H2): `status == 'published'`, `expiresAt > now`, `type != 'deepdive'`, newest `publishedAt` first, headline present, bounded to five; chips match `sector`/`themes`; a match gives the reason line ("Chosen because you want to explore {chip}"), otherwise "General selection". Declared interests shape order only. The same selector serves For-you and Recent stories.
- **The question** = `BEAT_QUESTIONS[story.reporterBeat]` (`src/constants/sharedResearch.js`), one per beat, editable by the player; the stored question is whatever the player confirmed:

| `reporterBeat` | Question |
|---|---|
| Market Pulse | What changed in the market this story describes, and which businesses does it reach? |
| Stock Spotlight | What business development, if any, is behind this move, and who else does it touch? |
| Economics Desk | Which businesses does this economic development reach, and through what? |
| Earnings Analyst | What changed in this company's business, and does it reach its suppliers, customers or competitors? |
| Sector Strategist | Which companies earn from the development this story describes, and how directly? |
| (any other beat) | What changed here, who does it reach, and which company earns from it? |

- **The story is the item**, shown "From FantasyTimes · {reporterName} · {time}", written as a `coverage` finding with `statusReason: 'reporter_content'` — reporter content, never Source-backed (R3). The first step verifies: the step prompt's first task for an item entry is "find the primary source of what this story reports".
- Names in scope: `story.tickers ∩ ALL_TICKERS`, minus retired.
- Browsing stories costs nothing: the selector is a hub read; the sheet's Start view makes no request beyond `GET ?list=open`.
- The reporter/hub owner holds the source-to-itemRef mapping, the selection rule, provenance and the correction policy (handover §7). No second news system, no recommendation engine.

**Level 2 (forward read, not a dependency).** When a story carries `research.status === 'ready'` (desk note V1.1 §3), the selector prefers it, the preview shows `research.question`, `research.context`, and the opening writes `research.finding` (pack-item shape, with its url and dates) as a `verified` finding and `research.missingLink` as an `unavailable` one. B1 reads the block **only if present**; its absence is Level 0 exactly. No reporter change is designed here.

---

## 9. The three corrections → acceptance (R8)

| | Prototype defect | Build | Regression |
|---|---|---|---|
| **A** | `sr2Companies` promotes a company when `stepsUsed >= fromStep` (`sr2-extra.jsx:104`): a refresh exposes Varrow before d4 exists. | `companiesOf(record)` reads current findings and resolved identity only (§6.7). The client renders the server's list. | `companies.test.js`: refresh without the relationship finding → unchanged; superseding d4 with an `unavailable` finding removes support. Route test: the `step` answer's `companies` after a `refresh` intent equals the answer before it. |
| **B** | `SrCompanyCard` calls `a.srStep(s.sessionId)` for every card (`sr2-sheet.jsx:181`); all cards run the same general step. | `intent: 'examine'` with `target { symbol, relationshipFindingId, openFindingId }`, validated on the server (owner, current findings, symbol on this record); the question is unchanged; the target is on the exchange and in the prompt. No new route. | `route.test.js`: two cards → two distinct prompts and exchanges; a target naming a foreign or superseded finding → `invalid_target`. jsdom: two cards send two targets. |
| **C** | `sr2Carried` uses static `via` lists (`sr2-extra.jsx:107`): the 62% GMV source (p3) is dropped; p2r/p5r supersede p2/p5 but the carried set keeps the old ids. | `adoptPreview.js` builds the carried set from the exact selected names' current findings (the `idea` fragment, every current verified finding with that symbol, its open `unavailable` finding, the complication and missing-link findings), resolving `supersedes` through `currentFindingsOf`; the statement's numbers must appear in carried facts; the preview revision is checked at Save; a saved version is never rewritten (the existing version route governs later changes). | `adoptPreview.test.js` as §6.11; route test: `preview_stale` after a step between preview and Save; the saved v1's `evidenceRefs` equal the carried set in order. |

---

## 10. Dependencies (verified at `main` @ `ba22a52f`)

| Dependency | State | Blocks |
|---|---|---|
| Research record extension (question, findings, symbolKeys, summary revisions, `sharedResearchSessions` host, `sr_` ids, closing rules) | **Present** (PR #1030; `api/_utils/researchRecords/model.js`, `store.js`) | — |
| `buildSharedResearchVersion`, `STATE_REASONS.sharedResearchCompleted`, `SHARED_RESEARCH_LIST_MARKER` | **Present** (`hypothesisRecords/model.js:71,397`) | — |
| `researchWork (userId, symbolKeys CONTAINS, createdAt desc)` index | In `firestore.indexes.json`; **deployment pending** (founder) | the allowlist run (the hub's per-symbol read), not B1 |
| Voice rulebook `docs/design/SHADOW_VOICE_RULES_V1.md` | **Pending** on `claude/huddle-s1` @ `fd9967c` (PR #1032) | nothing: §6.8's coordination rule |
| Declared interests `playerContext/{uid}` (onboarding W1) | **Pending** (framework); absent on `main` | nothing: the selector's reason line reads "General selection" until it exists (hub) |
| Hub amendment (door, selector, summary line, activity rows, next action, agent name, lazy edge, guard row) | **Pending** (Command Center chat) | B2's mount and smoke; not B1 |
| Idea-record admission of its own (feasibility D-2, Purpose §8.3) | **Pending** (framework) | the step to `on` (D-4), not B1/B2 |
| SignalDrop entry: `SignalDropEntry.jsx`, `POST /api/forge/parse-signal`, `users/{uid}/signalDrops` (owner-readable) | **Present** (`src/components/SignalDrop/SignalDropEntry.jsx:140`; `api/forge/parse-signal.js`; `firestore.rules:141`); B2 adds the `ctaLabel` prop | — |
| A `signalDrops` finding source kind (to cite the drop *record*) | **Outside V1**; not needed — the drop is the player's words (§4.2) | — |
| `fantasyTimesStories` read, `reporterBeat`, the `(status, expiresAt, publishedAt)` index | **Present** | — |
| Exa adapter `api/helpers/exaClient.js`, `EXA_API_KEY` | **Present**; the key is in Vercel today (FantasyTimes uses it) | — |
| Anthropic SDK (D-SR-1 a) | **Present** (`package.json` `@anthropic-ai/sdk ^0.71.2`; direct importers on `main` include `api/_utils/mandateModelCall.js`; the Wire's `wireModelCall.js` is scoped to FantasyTimes by its imports test and is not reused). `modelTurn.js` imports the SDK directly, as S1's `scriptPrompt.js` does. | — |
| Rules for `sharedResearchSessions`, `sharedResearchQuota` | **Missing** (B1 writes them; founder deploys) | the allowlist run |
| The version's additive `attribution` field (outside the content hash) | **Pending** (framework); the list carries the stamp meanwhile (§5.5) | nothing in V1; the Practice Field's drafting read |
| Practice Field shared contract V2, concept V6.1 (the second sink) | **Approved Nov 12**; reads the saved idea record and its stamp; needs nothing else from B1/B2 | — |
| Track this idea; existing-idea rework; deep background research; Huddle reading research; Film Room → research; new providers | **Outside V1** (concept §3) | — |
| Story `research` block (Level 2) | **Outside V1**; forward read only (§8) | — |

---

## 11. Build order, slices, PR shape, rollout

### 11.1 Order
1. **Before B1 cuts:** the founder confirms the `researchWork` index deployment plan (needed before the allowlist run). D-SR-1–3 are ruled (Nov 12); D-1 and D-4 stand on their defaults unless he says otherwise. The research record extension is merged — confirmed.
2. **B1 · server, dark** — branch `claude/shared-research-b1`, fresh Opus Claude Code session (Fable reviews), one draft PR. First commit: this spec at `docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md` + the `docs/README.md` row. Builds §6 entire. `SHARED_RESEARCH_MODE = 'off'`. Report `docs/audits/<date>_BUILD_SHARED_RESEARCH_B1.md`. Review at the BUILD_RULES §2 threshold (it will cross it).
3. **B2 · client, dark** — branch `claude/shared-research-b2`, after B1 merges (it imports `src/constants/sharedResearch.js` and the service's contract). Builds §7 against the V2 design and this spec. The hub amendment's lazy edge is the Command Center chat's PR (it may land before or after B2; B2's sheet is testable standalone with `HubOverlayProvider`'s standalone stack).
4. **Rules and index deployment** (founder): `firestore:rules`, `firestore:indexes`.
5. **Allowlist validation** (§12) with `SHARED_RESEARCH_MODE = 'allowlist'` (one-line founder PR, pin moved), on the founder's and FT_QA's accounts.
6. **Measures** (§11.4) recorded in the report; D-1 revisited.
7. **`on`** — one-line founder PR, after the framework's admission change (D-4), after one clean allowlist week.

B1 does not wait for Huddle S1 (concept §11) apart from the rulebook coordination (§6.8). Onboarding's O3 ships "Explore this" gated or unavailable until the flip (onboarding spec §4.3); nothing here changes that.

### 11.2 PR shape (each)
Flag at `'off'` with its pin test and the `DARK_BY_DESIGN` note; no module-scope flag reads; no fenced file edited; the PR description cites changes by `file:line`, names fenced functions *called* (none), the registry addition (`stepPrompt.js`), the rules diff, and the smoke branch's preview URL. Pushed, reported, stopped (BUILD_RULES §2).

### 11.3 Rollout gates
- `off → allowlist`: rules and indexes deployed; B1 and B2 merged; the hub amendment's door merged; the allowlist cases (§12) pass on the preview; the cost/latency sheet exists.
- `allowlist → on`: idea-record admission widened by the framework (D-4); p95 step duration under 25 s on the allowlist week; model + retrieval cost per step within the founder's accepted number; zero invented tickers and zero `verified` findings without a real source in the allowlist log; the honesty guards unloosened.
- Rollback: one step back at a time by moving the literal and its pin (the research-modal flags' rule); mode-off arms stay until a cleanup PR.

### 11.4 Measures before activation (from the shadow log and the records)
Per step: model tokens in/out, attempts, `costUsd` (§6.12), prompt-budget trims and `prompt_too_large` count, retrieval calls and `costDollars`, elapsed model ms, elapsed retrieval ms, total route ms (p50/p95), validation failures by rule, failed-step rate, `summary_conflict` count. Per investigation: steps used, retrieval total, model total in USD, adoption rate, concluded-without-idea rate. Per day: investigations opened, framings run, daily-limit hits, global-ceiling hits (`budget_paused`), total USD. These set D-1's defaults and the global ceiling for `on`.

---

## 12. Acceptance evidence (handover §10)

**The allowlist cases (real records, the founder's account):**
1. **A SignalDrop** (concept case 1, the founder's own drop): Use a SignalDrop → paste → parse → the drop preview → Investigate → opening with "Your drop", the parsed claims as "From your drop", the validated names' stored facts → one step verifies against the drop's URL or the web → a supported or unresolved connection.
1b. **A reporter story** (the primary start): Recent stories → preview → Investigate → opening with the story item "From FantasyTimes", the beat's question, stored facts for its tickers → one step verifies the primary source → a supported or unresolved connection → conclude or adopt.
2. **The observation** "Security reviews and integration requirements often delay approvals.": attributed to the player as "Your observation"; each product and ownership link sourced or Unresolved; the contradiction visible as the complication; the next action targets the weakest link.
3. **A case ending without a supported public company**: concludes `concluded`; "Turn this into an idea" absent; no ticker invented; the record stands.
4. **A second reporter story** that yields a supported connection and is adopted: list committed, v1 researched, record `saved_to_list` with subject; "Use it in my next game" → ready → equip; the Loadout card reads "Deploying with: {statement} · N names" (the hub's existing line).

**Focused cases (tests and smoke):** refresh with no new company support (A); two distinct company actions (B); a numerical claim with complete citations and superseded findings reconciled before adoption (C); resume and retry without duplicate records (`open` replay, `step` replay, `adopt` replay); a new question from the same story (a second investigation on the same `itemRef` after the first concluded — allowed; while the first is open — `existing`); empty and stale story selections; admission unavailable (stories readable, Investigate withheld); failed retrieval (the step runs without `verified` facts and says so); interrupted Save (check the record before retry); failed equip after a successful save.

**Checks:** source attribution on every Source-backed finding; literal private observations never generalized; inference labels; canonical symbols only; unresolved financial exposure shown as such; relevant counter-evidence in the complication line; honest game eligibility; the saved version carries the reviewed statement and the complete carried set; phone and desktop; keyboard, focus, reduced motion, the single overlay; the original Loadout unchanged (its pins in the onboarding spec §4.4); the hub copy guards green; model/retrieval cost and p50/p95 recorded. Fixture behavior is not acceptance evidence for live routes.

---

## 13. Out of scope (V1)
Track this idea and any monitoring without a battle (owned by the Practice Field — concept V6.1, shared contract V2 — which reads the saved idea record; §0); reworking an existing idea (including a `review_due` reaffirm); the stock modal's "Work this idea" door; the live-call walkthrough; deep background research over minutes; the Huddle reading research items; sharing; providers beyond Exa; a hub-level or search-bar SignalDrop shortcut (a later hub amendment; the sheet's row is V1); theme browsing; research from a game or a Film Room review; the story `research` block and any reporter change; a second news system; onboarding changes; Loadout changes; the Research panel's all-ideas list (its own hub build). No inactive controls for any of these.

---

## 14. Needs for other chats (paste-ready)

**To the Command Center chat (hub amendment):**
> From the Shared Research build-spec chat (spec `20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2`, `main` @ ba22a52f). The sheet is `src/components/SharedResearch/SharedResearchSheet.jsx` (default export), opened through your overlay stack with the props in spec §7.1. Needs for the amendment:
> - The one lazy edge: `HUB_SHEETS.RESEARCH`, `lazy(() => import('../../SharedResearch/SharedResearchSheet'))` inside `HubOverlayProvider`, and its row in `commandCenterHub.mount.guard.test.js` `PERMITTED_TERMINALS`.
> - The Research panel's "Work an idea" door (mode `start`) and the For-you card's "Explore this" (mode `item`, with `itemRef`, the beat's question from `src/constants/sharedResearch.js` `BEAT_QUESTIONS`, and `direction` from onboarding's typed explore text). Nothing is written until the sheet's Investigate.
> - The story selector (onboarding H2) over `fantasyTimesStories` — `status == 'published'`, `expiresAt > now`, `type != 'deepdive'`, newest first, five at most — passed to the sheet as `stories[]` with `reason` from a real chip match or null. One selector for For-you and Recent stories.
> - The gate: `SHARED_RESEARCH_MODE` (`src/config/sharedResearchFlags.js`) read through `hub/hubFlags.js`; at `allowlist`, the cached cockpit-status verdict (`readFilmRoomVerdict`). The gated and unavailable lines in `hubCopy.js` (`:145` is the gated line; add the unavailable line), passed to the sheet as `gated`.
> - The summary line "Research in progress · last update {time} · {n} findings" from `researchWork` (`state`, `telemetry.lastTurnAt`, `findings.length`), read once per load, never polled, never announced; the three Activity rows ("Research opened" = `createdAt`, "Research concluded" = `endedAt` with `terminalReason: 'concluded'`, "Idea saved from research" = `endedAt` with `saved_to_list`); the next-action candidate "research awaiting direction" enters later with its own amendment.
> - The agent's given name in hub copy (OD-2) is yours; the sheet takes `agentName` as a prop.
> - `equippedListLabel` for the "Replaces {list}" line, from your loadout reader.
> - Later, not V1: a hub-level or search-bar "Drop a signal" shortcut can open the sheet with `mode: 'signaldrop'`; the sheet's own Start row carries the entry in V1.

**To the framework chat:**
> From the Shared Research build-spec chat. Three items, none blocking B1:
> - **Schema v2 candidate** for a later version: a `metric` finding kind for a rankings or peer-metrics row (V1 writes the estimates row and claim count as `earnings_fact` and shows the rankings/peer rows unwritten; spec §1 F14). A `signalDrops` finding source is **not** needed: a drop enters as the player's words (`observation`, source `exchange`) and its parsed names.
> - **Idea-record admission of its own** (feasibility D-2, Purpose §8.3): Shared Research's step to `on` waits for it (D-4).
> - **Optional:** `mintWithHost(db, { hostRef, hostDoc, record, inTx })` with an in-transaction callback would let B1 reuse it for the quota write; B1 otherwise mirrors its eight lines in `api/_utils/sharedResearch/store.js` (the record is created once; a retry writes nothing).
> - For your information: adoption saves the list `committed` (D-SR-3; `equip-watchlist` refuses `draft`), and `buildSharedResearchVersion` is called inside the adoption transaction with the stored list document, as contract §10 item 8 asks.
> - **From the Practice Field shared contract V2 (§5.1), two items for the idea version:** (a) an additive **`attribution`** field on the version — `{ agentId, archetypeCodeId, baggerbombArchetypeCodeId, identityVersion, at }`, written by the builder from a caller-supplied block, **outside the content hash** (the `deployedBattleIds` precedent) so no existing hash moves; B1 passes the block from `open` and stores the same block on the list meanwhile. (b) A second origin, **`practice_field`**, is coming (the Practice Field's T3) with its own `stateReason`, list marker and evidence refs pointing at the idea's result and evidence packet. Please keep `buildSharedResearchVersion`'s origin-specific parts (marker, state reason, evidence-ref list) separable from the shared mechanics, or tell us where they are hard-coded; B1's `adoptIdea` is already split that way (spec §6.6).

**To the Huddle chat:**
> From the Shared Research build-spec chat. B1 adds §4 "Written openings (Shared Research)" and §5 "Baseline method v0" to `docs/design/SHADOW_VOICE_RULES_V1.md`. If S1 (#1032) merges first, B1 edits the merged file; if B1 merges first, it commits the file with your §1–3 byte-identical from `claude/huddle-s1` @ fd9967c plus §4–5 — please keep §4–5 on your rebase. One file, never two. The research route writes no `symbolDayEvidence`; S2's reading of research reaches it only through idea records.

**To the onboarding chat:**
> From the Shared Research build-spec chat. The `itemRef` shape and the entry contract `{ itemRef, question, direction? }` are kept as your H2 names them. The beat questions live in `src/constants/sharedResearch.js` `BEAT_QUESTIONS` (B1 commits them); your O3 selector reads them from there rather than its own table. "Explore this" stays gated/unavailable at your release; nothing here changes onboarding.

**To the SignalDrop / Discover owner (the Forge arc):**
> From the Shared Research build-spec chat. B2 adds one additive prop to `src/components/SignalDrop/SignalDropEntry.jsx`: `ctaLabel` (default `'Start dialogue'`), so the Shared Research sheet can mount the same modal with "Investigate this". With the prop absent the component is byte-identical and your Discover flow and tests are unchanged. The parse route is reused as is; its Haiku 4.5 id is on the legacy-model migration list, not in this build.

**To the Practice Field chat:** nothing goes back — none of the note's facts is wrong. Its three items are applied (§5.5, §6.6, routine 9); the honest line "Your agent is testing this idea in the Practice Field" is noted as a future line shown only once the book records it (R7 holds until then).

**To the FantasyTimes / reporter owner (Command Center chat, Level 1 Phase 0):**
> Level 0 reads existing stories with the beat's question. The forward read is the `research` block (desk note V1.1 §3): when present and `ready`, Shared Research opens from `research.question`, `research.context`, `research.finding` and `research.missingLink`; nothing in B1/B2 depends on it.

---

## Source manifest
`FantasyTrades_Shared_Research_Claude_Build_Handover_2026-11-09.txt` · `Shared Research - Work an idea V2 (standalone).html` (unpacked `sr2-extra.jsx`, `sr2-sheet.jsx`, `sr2-app.jsx`, `sr2-data.jsx`, `sr2-hub.jsx`) · `SHARED_RESEARCH_WORK_AN_IDEA_CONCEPT_V1.md` (revised Nov 7) · `COMMAND_CENTER_PURPOSE_V1_1.md` · `20261108_ONBOARDING_V4_BUILD_SPEC_V1_1.md` · `SharedResearch_Feasibility_Readout_20261104.md` · `FANTASYTIMES_RESEARCH_DESK_NOTE_V1_1_NOV09_2026.md` §3, §8 · `KICKOFF_SHARED_RESEARCH_BUILD_SPEC_NOV09_2026.md` · the Practice Field chat's note to this chat (Nov 12, 2026; concept V6.1 and shared contract V2) · repo `fashraf94/tradeseven` `main` @ `ba22a52f`, `claude/huddle-s1` @ `fd9967c`, `docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md`.

---

## 15. B1 preamble rulings (Nov 12)

The B1 session re-verified §1 at `main` `c37baa0d` and stopped on six points where the repo's shapes differ from this spec (stop report `20261112_SHARED_RESEARCH_B1_PREAMBLE_STOP.md`). The founder ruled them on Nov 12, 2026; B1 builds on these rulings and B2 builds against them. Where a ruling and an earlier section disagree, the ruling wins.

| # | The repo | Ruling |
|---|---|---|
| **S-1** | The stored drop (`users/{uid}/signalDrops/{dropId}`) has no `claims[]`. The parse's claim-like field is `parse.dataPoints[]`; `topic` is `parse.topic`; `validation.validated` holds `{ symbol, sectorId }`; the input is `input.{ type, note, text \| url \| imagePresent }`, so an image drop stores no text. | **Approved as proposed.** `parse.dataPoints[]` are the drop's claims: each an `inference` finding with `statusReason: 'from_drop'`. "Your drop" is the player's text, or the url followed by the note, or for an image the note or "An image you dropped". `parse.extractedText` never enters the record as the player's words, and `parse.impliedTickers` are never names in scope. |
| **S-2** | `buildFinding` refuses a non-instant `at` (`invalid_at`); only `asOf` may be null. | **Approved, with two additions.** A retrieval-backed fact's `at` is the model's `at` (the fact's own date) when it is a real instant, else the item's `publishedDate`, else the instant the retrieval answered (the read time — never the write time); `asOf` is the item's `publishedDate` when strictly before the write, else null. Inferences, unresolved links, proposed claims and the next action take the partner exchange's time as `at`, `asOf` null. **(a)** A model `at` later than the read time is ignored and the next rule applies. **(b)** When `at` falls back to the read time (no fact date, no `publishedDate`), the source label ends " · undated" (the title trimmed so the label stays ≤ 120), so any reader — the sheet, the Practice Field — shows "read {date}", never a fact date. A test row for each. |
| **S-3** | `isRecordRef` caps every `source.recordId` at 256 characters; only `source.url` runs to 1,024. | **Approved as proposed.** A retrieval source's `recordId` is the url when it is ≤ 256 characters, otherwise `url-sha256:` + the url's SHA-256 hex; `source.url` always carries the full url (≤ 1,024). |
| **S-4** | `open` carries no agent id; `resolveAttributionAgentId` only maps a clone to its parent. The uid → ranked agent read is `resolveRankedAgent` (`api/_utils/trainingClone.js:127`). | **Approved with one change: no casual-clone fallback.** The stamp's agent is the owner's ranked agent by `resolveRankedAgent`'s rule (the first agent the owner holds that is neither a training nor a casual clone), as a three-line copy in the store with a parity test against `resolveRankedAgent`; none → `503 attribution_unavailable`, nothing written. A clone id is never stamped. The partner's name in the frame and step prompts comes from that same agent document. |
| **S-5** | `api/_utils/researchRecords/extension.test.js:492-503` pins that no non-test file but the record model names `symbolKeys`. | **Amended: drop `symbolKeys` from the read projection (§6.7)** instead of editing the census pin. B2 does not need it — `companies` and `findings[].symbol` carry the names. `extension.test.js` stays untouched. |
| **S-6** | K-3 named `ANTHROPIC_API_KEY`; the app's variable is `CLAUDE_API_KEY`. | **`modelTurn.js` reads `CLAUDE_API_KEY`.** The one probe runs with `CLAUDE_API_KEY` from the parent checkout's `.env.local`, loaded into the probe process only (`node --env-file=<parent>/.env.local scripts/sharedResearch/probe.mjs`). The key is never printed, `.env.local` is never copied into the worktree and never committed; the fixture holds the response, `usage` and `costUsd` only. One call. If it is refused for the model id or the output format, B1 stops and reports — the id is not changed. |

**The non-blocking items are approved as the stop report listed them:** the voice rulebook's §4–5 are appended to the merged `docs/design/SHADOW_VOICE_RULES_V1.md` (Huddle S1 #1032 and S1.1 #1040 are merged); `stepSchema.js` keeps its own `ACRONYMS` copy, pinned equal to the Huddle list; no SDK bump (0.71.2 — the Huddle script's `output_config` call on `main` is the evidence); `isCockpitOwnerAllowlisted` from `api/_utils/callRecords/mode.js`; company names from `peerRankings/{ticker}.name`; the flag's note in `flagPinGuard.test.js` is the "intentionally ABSENT" form; the list marker is written only through the imported `SHARED_RESEARCH_LIST_MARKER`; story Timestamps are converted to instants on read; the shadow log follows `api/agent/chat.js`'s awaited pattern; the store tests run on an atomic in-memory double and the rules on the emulator.

---

## 16. B1 report rulings (Nov 12)

The B1 build report (`docs/audits/20261112_BUILD_SHARED_RESEARCH_B1.md` §11) asked eight founder questions; the founder ruled them, and one more point (NS-1), on Nov 12, 2026, to be applied on the B1 branch before merge. The rulings below are the founder's words. Where a ruling and an earlier section (§15 included) disagree, the ruling wins; B2 builds against them.

| # | Ruling |
|---|---|
| **FQ-1** | A new investigation of the same story or drop is allowed once the earlier one has ended (concluded, saved or abandoned); only an open one answers `existing`. When an ended one exists, the open answer and the GET carry `previous: { sessionId, endedAt, terminalReason }` for the newest, so the sheet can offer "Open the earlier one". |
| **FQ-2** | A publishedDate later than the read time is treated as absent (the read time, " · undated"). |
| **FQ-3** | "considered" is forbidden only with the agent, the partner's name, "I" or "we" as its subject. |
| **FQ-4** | A verified finding may be superseded only by another verified finding or an unavailable one; an inference never supersedes it. |
| **FQ-5** | A number in the summary or in the idea's statement must appear in a verified finding; inferences, the player's words and drop claims cannot back a number. Proposed claims follow the same rule (routine 13 becomes the letter). A summary that breaks it is withheld — the answer keeps its last revision and the step's findings still land — rather than failing the paid step. |
| **FQ-6** | Drop claims (dataPoints) run through the forbidden patterns; a claim that breaks one is not written (the drop's own text still stands as "Your drop"). |
| **FQ-7** | The preview revision covers the carried set: previewRev becomes an opaque token over summary.rev, findings.length and the carried ids in order; the client echoes it; any change → preview_stale. |
| **FQ-8** | Add a per-uid, per-method limiter after auth (10 POST, 30 GET a minute); keep the IP limiter in front as the pre-auth guard. |
| **NS-1** | The no-next-step finding reads exactly "No next step proposed." The server never claims the question is answered. |

**What B2 reads, as B1 built these** (the build report's §16 has the detail):

- **`previous`** is on every `open` answer for a story or drop and on `GET ?sessionId=`. It is `{ sessionId, endedAt, terminalReason }` or `null`.
  - It is the newest ended investigation of the same owner and item that was created before the one answered, and never that one itself.
  - `terminalReason` is the record's: `concluded`, `saved_to_list` or `user_close` (abandoned).
  - An observation entry has no item, so its `previous` is always `null`.
- **`previewRev`** is a string, `pr1.` followed by 32 hex characters. B2 echoes it as received. It covers each supported company's carried ids, not only their union.
- **A withheld summary.** The step answers 200 with `changed.summaryWithheld: true`; the answer and its revisions are unchanged.
- **`429 rate_limited`** comes from the per-uid limiter, with a `Retry-After` header and the server's line. It is per function instance, like the IP limiter.
