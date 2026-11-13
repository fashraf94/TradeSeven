# Astra review — Practice Field rulings 17 and 19

Date: 13 November 2026. Review type: design against fetched `origin/main`, not implementation acceptance.

| Question | Answer |
|---|---|
| Ruling 17 — speaking book notes and reports | **BUILD WITH CONDITIONS.** Append a separately validated book beat after the Huddle script and plan have been determined. Keep book content out of that model's entire input and out of conversation, directive, memory and consolidation stores. Code playback needs no widening of the deployed-agent prohibition. |
| Ruling 19 — player input at a window | **BUILD WITH CONDITIONS.** Bind each source explicitly to the book's owner and attribution identity; admit only a bounded evidence projection; deduplicate and freeze selection; give the model discretion and code sole execution authority. |
| Q3 — reasons and reports | Permit named, same-book note/report assemblers explicitly; replace the no-reader pin with per-consumer permissions; validate typed claims against keyed ledger facts rather than matching loose numbers. |
| Q4 — five windows | Use a versioned idea-book schedule and separate note jobs; keep direct intraday decisions; qualify four books first and redesign paging before promising 50 or 500. |
| Q5 — receipts | Code can truthfully report committed standing, including uncertainty; it cannot promise an opening date, consideration, admission or fill that is not yet secured. |

## Review basis

`git fetch origin` completed before comparison with `origin/main`. The reviewed detached worktree is clean at **`d9b4e3c1c8183cf1917ef8d0bd5ad6f4110e7ab6`**, located at `C:\Users\fashr\.codex\visualizations\2026\11\13\01a1d602-795c-7f50-83f1-76a96c7d0bc6\review-main`. The original checkout was on `main` at the same commit with unrelated modified/untracked files; those were left untouched. A dependency junction was added only to the detached worktree to run offline tests; no tracked project file was changed.

Read: `docs/BUILD_RULES.md`; concept V6.1; shared contract V2; the V6 audit in `docs/audits/20261112_ASTRA_REVIEW_PRACTICE_FIELD_CONCEPT_V6.md`; both attachments; the source paths cited below. References to repository `file:line` locations all mean the reviewed HEAD, including references to older audits. **VERIFIED** means read in this session, not verified in production. **Recommendation**, **deduction** and **not found** are distinguished from implemented behavior. No memory rollout was used as evidence.

The two attachments were read from `C:\Users\fashr\Downloads` and their SHA-256 hashes match the brief:

| Abbreviation | File | SHA-256 |
|---|---|---|
| Direction | `20261113_DIRECTION_NOTE_GAME_AND_ACCOUNT.md` | `1cb831affce313fde41e8904603e5f7530079b32dfa75fca8f1d91b0d76c495a` |
| C | `20261113_PRACTICE_FIELD_AMENDMENT_C_GAME_AND_ACCOUNT.md` | `b953ed7bb1c4aa62b4154a1a090e7b6e0b464d6ac8811377569289c8f627d85d` |

`C:110`, for example, means line 110 of the hash-verified attachment, not a file already committed at this HEAD.

Severity follows the brief: a **boundary blocker** identifies a route into a forbidden agent/owner/archetype channel or player management. The stated fix closes it; this supports BUILD WITH CONDITIONS rather than DO NOT BUILD. Other findings are **required design conditions**, not blockers under that definition. A condition concerning absent future code is not a claim that an exploit exists today. The idea-book integration is still a seam: its default book resolver returns null (`api/_utils/filmRoom/practiceFieldSeam.js:129–143`, VERIFIED).

## W-01 — The script model is part of the battle-plan path

**Question:** Q1.1 and Q1.3. **Severity:** boundary blocker if book content is supplied to the script model; closed by the separate playback path.

**Evidence — VERIFIED.** The present route is:

1. `gatherForPlayer` reads the owner's agents, equipped watchlist and active battles and creates evidence items (`api/_utils/huddle/gather.js:100–149`). It also reads yesterday's Huddle **plan**, not its transcript (`api/_utils/huddle/gather.js:238–246`).
2. `buildUserPrompt` serializes the universe, names, closes, tape, events, prior plan and **every** `gathered.evidence[].fact` (`api/_utils/huddle/scriptPrompt.js:155–185`). The system asks the same model to propose a game plan supported by that evidence (`api/_utils/huddle/scriptPrompt.js:138–149`). The response schema includes `planProposal` (`api/_utils/huddle/scriptPrompt.js:105–125`).
3. The job calls that model, may regenerate, then extracts its proposal, validates it and narrates the result in code (`api/_utils/huddle/job.js:97–131`; `api/_utils/huddle/scriptPrompt.js:234–241`). Closed templates constrain kinds, tickers, levels and counts; they do not prove that book evidence did not influence a valid choice (`api/_utils/huddle/planTemplates.js:145–240`).
4. Player confirmation validates the replacement against frozen context, renders it and stores per-archetype confirmations (`api/_utils/huddle/confirmPlan.js:181–246`). The endpoint applies the confirmed plan (`api/huddle/confirm.js:39–45`).
5. Application builds a directive from the confirmed rendered text and writes it with a filing exchange (`api/_utils/huddle/applyRules.js:244–270`; `api/_utils/huddle/applyPlan.js:94–107`). The battle evaluation assembler renders the active directive into its prompt (`api/_utils/agentEvalPromptAssembly.js:1236–1246`).

**Deduction:** adding a book pack item can alter a valid TRIM, HOLD or price-line proposal, which confirmation can carry into a battle prompt. Confirmation here is not the book's typed Forge adoption. Code narration of the **plan** does not remove the model's influence over the plan's contents. An offline prompt probe confirmed that adding a book canary to `gathered.evidence` puts it verbatim in the model's user prompt; no model was called.

**Concrete condition:** implement C:110 as a separate `book` presentation payload appended only after script validation and plan construction. Do not add book text, its symbols, claims, counts, eligibility results or summaries to `gathered`, script regeneration feedback, plan validation context, shared tape or shared symbol evidence. Keep the game universe unchanged; use a separate book-symbol allowlist for playback. Do not let a failed book beat regenerate the game script or plan.

**Acceptance:** with identical game inputs, clock and mocked model responses, vary notes, reports, their absence, validation failures and another book's data. Assert byte-identical script requests including retries, plan proposal/current/revision, confirmation rendering and applied battle directive. Assert byte-identical deployed draft/evaluation prompts and no new memory/consolidation writes. Compare deterministic inputs and outputs; two independently sampled live model responses cannot establish byte identity. Mutation-check by deliberately inserting the canary into evidence and requiring the test to fail.

**Answer:** if stored text is only rendered and sent to speech synthesis, there is **no new language-model prompt access and no need to widen V6.1 ruling 17's deployed-agent ban**. TTS still receives text to synthesize; “no model receives it” should be written precisely as “no script, conversation or trading language-model prompt receives it.” Book-side generation of the notes is the separate permission in W-10.

## W-02 — Preserve presentation storage and prevent book self-citation

**Question:** Q1.2. **Severity:** required design condition; no present book-transcript ingestion route found.

**Evidence — VERIFIED.** A Huddle day stores `script.beats`, `transcript`, audio metadata, evidence, cards and plan (`api/_utils/huddle/job.js:163–190`) under `huddles/{uid}/days/{etDate}` (`api/_utils/huddle/records.js:90–93`). Speech is built from joined beats and passed to synthesis/storage (`api/_utils/huddle/job.js:133–155`). The next day's gather projects only prior plan status/stances (`api/_utils/huddle/gather.js:242–246`). Owner access is explicit in the Huddle rules (`firestore.rules:1269–1278`).

One Huddle artifact **does** enter a conversation store: the confirmed plan filing. It carries `userMessage: null`, an empty agent response and the directive text (`api/_utils/huddle/applyRules.js:255–270`); the writer appends it to `chatExchanges` (`api/_utils/directiveWriter.js:86–91`). Thus “no Huddle record enters conversations” would be false. Today's code does not put spoken beats or the transcript in that exchange.

The current conversation selectors admit user/agent pairs and selected proactive text, excluding particular message types rather than all future book-derived content (`api/_utils/voiceLayerGrounding.js:462–529`; `api/_utils/chatHistoryWindow.js:66–74`). Reflection consumes battle trade rationales, evaluations and status-feed text (`api/_utils/agentReflectionUtils.js:257–279`); reflection is written to memory (`api/agent/reflect.js:520–540`); consolidation reads memory (`api/_utils/agentConsolidationPrompt.js:191–216`). Deployed drafting reads memory and consolidated insight (`api/_utils/agentPromptAssembly.js:84–96`).

**Search result:** no reader of the Huddle script/transcript/audio text into those trading, memory or consolidation inputs was found in the inspected `api/` and `src/` runtime paths. This is source evidence, not a proof against future readers. The drafting source rule explicitly includes battle chats and workshop sessions (`docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md:114–116`); a future export of a book beat into either would allow book → conversation → drafting → book.

**Concrete condition:** keep book presentation in the owner-scoped Huddle day and book notes/reports. Give new note/report subcollections explicit server-write/owner-read rules, and separately enforce owner/archetype checks in server readers; client rules do not authorize a server-side prompt read. Never mirror presentation text into battle chat/status feed, workshop exchanges, shared research evidence, agent memory/lessons or shared symbol records. Mark the new presentation beat with book/epoch/source references and a distinct provenance kind. The drafting source adapter must explicitly reject Huddle book beats and book-derived conversation/research artifacts, including transitive ancestors. Completed ideas may still enter through their expressly permitted `agent_prior_ideas` channel, once, with original evidence lineage; a narrated report is not independent evidence.

**Acceptance:** canaries in a book beat survive playback/cards only. They remain absent from next-day script requests, battle filings, chat-history inputs, workshop/research inputs, reflection, consolidation and the drafting conversation selection. Include an artifact falsely relabeled `conversation`, a research finding citing an earlier research record, and repeated narration of the same completed idea. Retain original source ids internally to prevent provenance laundering; opaque prompt labels must resolve only through the validated manifest. A user independently retyping something heard cannot be perfectly detected; such text remains a user assertion, never newly verified evidence.

## W-03 — Code playback does not validate model-written speech

**Question:** Q1.4. **Severity:** required design condition.

**Evidence — VERIFIED.** The voice rulebook binds code-written beats as well as model beats (`docs/design/SHADOW_VOICE_RULES_V1.md:3–4`). It requires dated/attributed facts, spoken “unverified,” universe restrictions and correct speaker identity (`docs/design/SHADOW_VOICE_RULES_V1.md:11–20`), and prohibits clock promises, guarantees, confirmation claims, learning claims, decision/advice confusion, volume claims and false source outages (`docs/design/SHADOW_VOICE_RULES_V1.md:24–34`). `validateScript` checks known model beats, forbidden patterns, learning claims, evidence references, tickers and length (`api/_utils/huddle/scriptPrompt.js:65–99`, `261–335`). The code plan is appended after that validator (`api/_utils/huddle/job.js:121–131`); arbitrary new book prose would not gain validation automatically.

**Concrete condition:** create a pure book-speech validator sharing the forbidden-pattern and learning-claim checks. Apply it to the **final spoken payload**, including the code wrapper. Check source/book/epoch ownership, note/report version, ledger-fact links, observation dates, freshness, all mentioned tickers against the book's own frozen manifest, B11 code-point bounds and the total audio duration budget. Require evidence for factual sentences and the spoken unverified label for quoted model interpretation. Name the book manager and time in a code wrapper so a first-person reason is visibly/audibly a quotation, not Shadow claiming the action as its own.

Reuse the semantic voice rules as well as regexes: the present ticker scan is uppercase-oriented, evidence-id existence does not prove a sentence, and regexes do not establish that a price was the previous session's close (`api/_utils/huddle/scriptPrompt.js:244–252`, `285–310`). The names-beat exposure-order and tape-index checks apply only when that material is actually being rendered as names/tape; do not manufacture game evidence to satisfy them for a separate book beat. An explicit book-playback rule must permit its own symbols without widening the script model's universe. For a morning beat, do not speak stale closes or fabricate morning prices. For a close report, explicitly define the session's post-close figures and their labels; do not silently call them prior-session or official-close prices.

**Failure behavior:** preserve the original stored note, mark its speech disposition/reasons, and speak a validated code fallback or omit the book beat. Do not pass the failed text to the Huddle model for repair. Display the original only through the appropriately labeled owner record; do not expose invalid financial claims as the approved report. A separately budgeted retry in the permitted book-note assembler may produce a new version; it cannot rewrite what was already heard. A 2,000-code-point weekly report plus the existing Huddle must still fit the voice rulebook's 120-second cap (`docs/design/SHADOW_VOICE_RULES_V1.md:12`); otherwise show the full card and use a shorter, separately stored eligible note.

**Acceptance:** cover every forbidden pattern, lower/mixed-case ticker escapes, Unicode code points, missing/wrong evidence, stale dates, invented numbers, first-person attribution, malformed content and overlong combined audio. The original text is unchanged, the fallback is labeled, and no rejection changes the game plan.

## W-04 — Report discussion remains a separate permission

**Question:** Q1.5. **Severity:** later-ruling boundary condition; not a blocker for the reviewed code-only playback path.

**Evidence — VERIFIED.** The present battle chat can file a directive and append an exchange in the same write (`api/agent/chat.js:1157–1175`), and its history can return to subsequent model requests (`api/_utils/voiceLayerGrounding.js:511–529`). This is not a display-only speech path.

**Concrete condition:** keep Direction ruling 12 deferred. Before any later discussion build, its chosen endpoint, tools, retrieval, history persistence, downstream readers and attribution must be demonstrated to lack a route to battle/draft instructions, memory, consolidation or another owner/archetype. It needs an explicit prompt permission and byte-identity/no-write tests across the same sinks as W-01/W-02. Today's generic conversation route does not establish that property. This review does not design the later conversation feature or authorize the partnership-memory direction in rulings 21–22.

## W-05 — Attribution must be established, not inferred at the next window

**Question:** Q2.1 and Q2.3. **Severity:** boundary blocker if unstamped or differently attributed material is assigned using the current loadout.

**Evidence — VERIFIED.** SignalDrop's cache-hit and fresh records store owner, input, parse, validation and time, but no attribution agent/archetype stamp (`api/forge/parse-signal.js:210–224`, `342–356`). Shared Research's `attributionOf` stores ranked `agentId`, primary `archetypeCodeId`, separate `baggerbombArchetypeCodeId`, `identityVersion` and `at` (`api/_utils/sharedResearch/store.js:103–112`), read inside the opening transaction (`api/_utils/sharedResearch/store.js:293–337`). The stamp lives on the **session** (`api/_utils/sharedResearch/session.js:107–124`), not on every `researchWork` record: the generic record shape has user, host and optional list/version but no such stamp (`api/_utils/researchRecords/model.js:470–505`).

C:27 and C:121 overgeneralize “the attribution those records already carry.” If “deep-dive” means the watchlist-analysis route, its new session and research record do not stamp an archetype (`api/forge/watchlist-analysis.js:385–432`). If it means Shared Research/Work an Idea, the session join above is available. Do not silently substitute a public FantasyTimes deep dive: the Shared Research story reader explicitly excludes that type (`api/_utils/sharedResearch/store.js:151–157`).

Film Room cards carry owner, attribution agent, archetype and source (`api/_utils/filmRoom/cardStore.js:253–269`), and its book check rereads owner/kind/active status/attribution-agent identity transactionally (`api/_utils/filmRoom/cardStore.js:152–171`). An agent id alone is insufficient: the card machinery expressly supports different active per-game archetypes (`api/_utils/filmRoom/cardStore.js:56–59`).

**Concrete condition:** at deliberate offer creation, authenticate the owner and resolve the explicit book assignment; freeze `{uid, bookId, attributionAgentId, archetypeCodeId, identityVersion, epochId, sourceKind, sourceId, sourceVersionOrHash, offeredAt}` server-side. A pick can carry the Shared Research-style stamp, but additionally needs an unambiguous book target; do not blindly choose its primary or BaggerBomb archetype field. Recheck the same identity and permitted source status at selection and before commit; manager switches cannot repin queued sources.

For Shared Research, join record ↔ host ↔ attribution and verify both ownership and bidirectional association. For old unstamped drops or analysis records, require a verifiable historical binding or exclude them. An explicit new nomination can record a **new player offer now**, with its own binding; it must not backdate the original record's attribution or authorize another archetype's private model-written experience. Exclude ambiguous records, including framing sessions with no stamp, and return `attribution_unavailable` or `source_not_eligible` without exposing foreign data.

**Acceptance:** foreign owner, identical agent id/different archetype, different per-game loadouts, casual clone resolution, missing session, mismatched record/host, missing/null stamp, source edit, manager switch during enqueue/selection/commit, and idempotent replay. None may read foreign content into a prompt. Verify both SignalDrop parse branches receive the same future stamping policy; never put a per-user stamp in the shared parse cache.

## W-06 — Admit a bounded quote as evidence, not an instruction channel

**Question:** Q2.1. **Severity:** required design condition; W-07 covers management authority.

**Evidence — VERIFIED.** SignalDrop preserves user `note` and text/URL (`api/forge/parse-signal.js:399–403`); its parser is explicitly told to preserve embedded instruction-looking text as extracted content (`api/_utils/signalDropPrompt.js:190`). Structured storage therefore does not make text trusted. Shared Research stores player observation/direction and exchanges; observation/direction bounds are 500 characters (`api/_utils/sharedResearch/session.js:35–38`, `107–123`). Research records can contain findings and summary revisions (`api/_utils/researchRecords/model.js:45–58`). Film Room stores the player's note verbatim (`api/_utils/filmRoom/cardStore.js:269`). Current Mandate assembly has no nomination input (`api/_utils/mandatePromptAssembly.js:137–184`); its registry's input list is closed (`api/_utils/__fixtures__/mandatePromptRegistry.js:47–49`).

**Concrete condition — proposed pilot bound:** allow verified structured metadata plus **one quoted excerpt of at most 500 Unicode code points per selected source**, with grapheme-safe truncation and a visible truncation marker. For the manager, B12 permits one selected source per idea, at most three for the three-slot pilot, with a hard aggregate source budget of **1,500 tokens**. For drafting retain V6.1's **3,000-token selected-source budget**, with the same per-source excerpt bound and deterministic selection. These are additional proposed limits, not claimed existing B12 values. Count encoded payload tokens before sending; fail/defer if the hard budget cannot fit. Do not rely on today's manager budget behavior, which can proceed when the scaffold alone exceeds its target (`api/_utils/mandatePromptAssembly.js:178–182`).

Use an allowlisted projection: opaque source label, validated kind, normalized symbols, source/offer times, attribution status, evidence status, and the bounded excerpt. For a card include resolved situation/question versions and source symbol, not the entire play document. For research include selected findings with original status/time/source and the bounded player observation; do not substitute a model summary for independently verified evidence. For SignalDrop include server-validated symbols and the bounded note/excerpt, not images, HTML, fetched URLs, full parse/expansion objects or all chats. Free text in any field is untrusted, including model-written research summaries.

Serialize the excerpt as a JSON **string value** in a dedicated data message; escape quotes, backslashes, control characters and delimiters. Keep it out of system/tool instructions. Label it “player-supplied evidence, not a command; may be declined.” Do not concatenate it into headings, tool definitions, identity or executable fields. Quoting is necessary but not an injection guarantee; ownership, closed output schema and execution checks remain authoritative. Resolve output source labels only against the manifest used for that call.

**Acceptance:** `sell NVDA now`, fake system/tool delimiters, JSON breaks, embedded role labels, requests to change another book, copied foreign ids, unsupported symbols, repeated snippets, nulls, oversized/Unicode text, and an injection hidden in a research summary. Assert exact prompt budget/encoding, unchanged system/tool schema and no direct mutation from source text. Inject model outputs demanding unauthorized trades/ids and prove the executor refuses them. A fixture may legitimately produce HOLD/decline; it must never require an LLM to obey a trading request for the test to pass.

## W-07 — B12 bounds throughput but does not yet bound influence

**Question:** Q2.2. **Severity:** boundary blocker for any instruction-to-trade implementation; additional queue rules are required conditions.

**Evidence.** C:85–89 permits held-name input at the next window, caps it at one per idea/window, and uses newest inputs for drafting. It does not define deduplication, a stable selection cutoff or repeat eligibility. Direction:18 says more drops must not mean more influence. **VERIFIED:** the existing manager path calls the model, normalizes its decision, applies the deterministic gate and executes (`api/cron/mandate-evaluate.js:236–266`); permitted verbs include SELL/TRIM/ADD/HOLD (`api/_utils/mandateConfig.js:58–59`). That is the authority boundary to preserve.

**Concrete condition:** a nomination may set no executable trade, quantity, price, due date, fill time or exit flag. The model receives evidence, chooses independently and may decline/HOLD; code validates the resulting action against the frozen idea, epoch and rails. Never implement “sell NVDA now” by parsing it into a pending order or filing it through a directive writer. A model disposition is not an execution receipt: retain the selected evidence, proposed decision, gate result and actual fill separately.

Pin these queue rules in B12's version:

- Freeze eligible nominations at each scheduled window start, ordered by server `offeredAt` then stable id. Arrival during a window goes to the next one, regardless of when the player's page happens to be processed. Receiving a drop must not trigger an immediate call or alter the scheduled time.
- Coalesce repeated source/version/content submissions into one candidate. New duplicates do not advance queue priority, renew expiry or cause a second consideration. Apply a bounded policy to materially unchanged same-name/same-claim offers; do not let fresh ids create extra votes.
- Select the oldest eligible distinct offer per idea/window, rather than allowing a last-second drop to displace it. Pin a deterministic capped selection for drafting instead of “newest wins.” Read an accepted candidate once; a deferred candidate gets an explicit next-eligibility reason, not three automatic votes each day.
- Keep one management action **per book per intraday window**, not one per selected idea. Code entries, exits and risk reductions remain separate. Three selected held-idea inputs do not authorize three model trades.

Resolve C:89/C:138 literally enough to preserve ruling 19: **no nomination directly exits a running idea or retires it to create space**. An independently justified ordinary manager sell is still possible; it must not alter the frozen due session or release/refill that idea's slot early just to accommodate the offered replacement. Spell out the zero-holdings lifecycle rather than using SELL as an implicit slot-release operation.

**Receipt beyond a bound:** “Received; this window's input allowance is already allocated. Deferred to the next eligible window [time, if known]; expires [session].” For duplicates: “Already queued/considered; this copy adds no priority.” For a spent refill: “Today's refill attempt for this slot has been used; earliest drafting opportunity is [next session's first window].” Do not mark these inputs “read” or “declined by the agent.”

**Acceptance:** one offer versus 100 equivalent drops produces the same selected evidence, call count and priority. Test arrivals immediately before/at/after cutoff, retry/concurrent workers, a delayed page, explicit trade commands, three held ideas, and a replacement request while all slots are full. With a mocked declining manager, no trade occurs. With an allowed manager action, no input-controlled size/time or premature slot release occurs.

## W-08 — Keep next-session entry in the first build

**Question:** Q2.4. **Severity:** required design condition.

**Evidence.** C:67 preserves T1a-1's next-session first-window entry and asks about an exception. The concept requires post-information fills and matched start/end marks (`docs/design/20261112_PRACTICE_FIELD_CONCEPT_V6_1.md:147–148`); contract V2 freezes start/due session and comparison and defines first-fill time (`docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md:75–97`). **VERIFIED:** the current direct engine uses the same tick's snapshot for decision and execution (`api/cron/mandate-evaluate.js:197–215`, `260–266`), and snapshot assembly can substitute fetch time when the provider supplies no observation time (`api/_utils/mandateUniverseSnapshot.js:150–155`). Neither is proof of the idea book's future eligible-mark rule.

**Recommendation:** keep the uniform next-session first-window policy for T1a-1 and this pilot. Reading an input at 11:00 and admitting its draft then does not entitle it to the snapshot gathered before the draft was decided. Membership in the shared list establishes potential coverage, not a post-decision observation, completeness or a reserved comparator.

A later same-session mode is feasible only as an explicitly versioned entry policy: freeze start/due at admission; require every traded and comparison symbol's coverage; use an authentic eligible observation strictly after the decision and all its information cutoffs; apply the same entry marks, costs and cash treatment to the passive comparison; never extend the due session because entry was delayed. A 13:00 admission cannot fill from the 13:00 pre-decision snapshot. A previously admitted draft may fill at 13:00 if that observation qualifies. The final window naturally pushes later decisions to the next session unless a separately specified later observation exists.

If the admission session becomes day 1, a 15:30 entry has a shorter exposure period than an 11:00 or next-morning entry. Its own passive comparator can remain matched, but pooling those results as identical horizon observations is misleading. Label entry policy/time and compare like cohorts; do not rebase due dates after seeing outcomes. For a trial, assign the timing policy before outcomes and record all attempted admissions, including no-fills.

**Acceptance:** pre-decision/equal-time/carried/receipt-time marks fail; a valid later observation succeeds; missing comparison coverage defers; delayed/partial entry never moves the fixed due session; an unchanged single-stock sleeve ties its passive comparison after identical costs. These are conditions on the proposed exception, not a re-review of T1a-1's accounting build.

## W-09 — Spend the one refill at the first eligible opportunity

**Question:** Q2.5. **Severity:** required design condition.

**Evidence.** Contract V2 fixes one refill attempt per slot/session and up to three drafts (`docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md:130–141`, `217`); C:85 promises the next intraday window. Neither promises that every subsequent input can get a fresh drafting call.

**Concrete condition:** use the first window at which that slot is open, capital is actually settled, an eligible source exists, the cutoff includes it, and spend/admission prerequisites pass. Usually this is 11:00 for morning inputs; it is 13:00 or 15:30 if the first eligible offer or settled opening comes later. Do not wait deliberately until 15:30 to collect the morning's newest drops: that breaks the next-window promise. A slot with no eligible source does not spend its model attempt.

Reserve `(book, epoch, slot, session)` atomically immediately before dispatch. Treat ambiguous dispatch and retries as part of the same attempt with one budget reservation/idempotent result; do not spend another nominal attempt after provider uncertainty. Deterministic preflight deferral without a dispatch need not consume it. Once spent, later offers get the next-session receipt in W-07. The first three draft candidates may all fail; that is still the day's attempt. Slot opening after the last window carries to the next session. Add concurrency, no-source, preflight-failure, provider-timeout and late-input acceptance cases.

## W-10 — Allow reasons by named consumer, not by folder

**Question:** Q3.1–2. **Severity:** required design condition; blanket exemptions would reopen the forbidden channels.

**Evidence — VERIFIED.** The current no-reader test scans prompt roots and their transitive imports, pins decisions-store mentions, and restricts T0b-specific fields to writers (`api/_utils/mandateRationale.imports.test.js:82–118`, `143–212`, `230–265`). Its comments accurately disclose heuristic/import-walker blind spots, including inline requests and Windows traversal (`api/_utils/mandateRationale.imports.test.js:29–49`). The Mandate registry names only manager assembly/context/tool and six input categories (`api/_utils/__fixtures__/mandatePromptRegistry.js:18–30`, `47–49`); the honesty sweep has an explicit two-assembler root list (`api/_utils/mandatePromptAssembly.honesty.test.js:23–45`). Merely adding a name to the registry does not automatically widen that root list.

**Answer:** reading the same book's reasons into its own close-note/weekend prompt is compatible with the continuing **ban on deployed-agent access**, but it is not already authorized by V2's closed list of manager and drafting inputs (`docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md:186–190`). C:108/C:123 should explicitly authorize these additional book-side consumers. The fact that the manager has an exception does not confer a general “anything under mandates may read anything” permission.

**Concrete re-pin, in the same build as each reader:**

1. Add one narrowly scoped server reader for decision evidence, keyed to authenticated/worker-bound book, attribution identity, epoch and requested date interval. Return a projection with decision id, action, execution disposition, bounded rationale/status and attribution/time. No global collection-group lookup and no arbitrary path from a model.
2. Classify consumers separately: daily report **display**, pre-note/close-note/weekly **prompt**, speech **presentation**. Permit the exact reader-to-assembler edges and imported symbols. Keep manager and drafting raw-decision-rationale reads prohibited unless separately specified; permitted completed-idea evidence is not permission to dump all decisions.
3. Extend `STORE_BASELINE` and the sanctioned field-reader set with explicit counts/reasons. Split prompt closures by root: only the approved note/report roots may reach the reason reader; battle/draft/chat/reflection/consolidation roots must not. Do not add that reader to a global closure allowlist shared by all prompts. Preserve pure shape-module restrictions and the ban on reaching decision writers.
4. Register every new prose contributor and source category; extend the honesty sweep's actual `ASSEMBLERS` roots and traversal to cover them. Add explicit roots for inline model request builders. Keep the closure self-check non-vacuous across supported platforms; run the ratchet on Linux or correct/test path normalization before relying on Windows results.
5. Keep runtime canaries alongside source scans. A reason must appear in exactly its allowed same-book note/weekend request and owner display, never in other book/epoch/archetype requests, Huddle script, deployed prompts, memory or consolidation. Exercise direct and batch outputs, late notes and record deletion/malformed attribution. Mutation-check an extra import, broad store read, an in-memory reason passed by a handler and a wrong-owner projection.

The pre-market note may read a bounded previous-close/day projection; the close note the completed day's actions; the weekly report the specified week's rows/reasons. Store exact input manifests and cutoffs. If a manager handover crosses a reporting interval, do not let the new archetype summarize the old archetype's private reasons merely because the owner is unchanged. Separate those records and keep historical owner display available.

## W-11 — Matching numbers does not validate a report

**Question:** Q3.3. **Severity:** required design condition; C's proposed B-FIGURES test is insufficient.

**Evidence:** C:104/C:139 permits any returned number found somewhere in a figures table. Counterexample: the table says idea A gained $100 and idea B lost $50; “B gained $100” passes number membership but is false. “A returned 100%,” wrong dates, wrong denominators, total-versus-per-idea substitutions and reversing the sign can also pass a loose match. “Doubled,” “halved,” “outperformed” or “the best idea” can make unsupported quantitative claims with no numeric token at all. A model-computed percentage may be arithmetically valid yet absent from the authorized table; membership cannot decide its meaning.

**Concrete condition:** have code construct a versioned facts table with keys such as `(book, epoch, idea, period, metric, unit, basis, quality)` and canonical display values. Compute all allowed derived metrics in code before the model call, including denominators, rounding and missing-data states. Ask the model for a bounded **claim plan** selecting fact ids and a small set of approved relationships/templates. Validate each relationship against the keyed facts and render numbers, labels and comparisons in code. Unsupported calculations, mismatched entity/period/unit, unobserved values and unsupported comparative words reject that claim or fall back to the code-built report. This preserves a model-authored selection/order while making the financial statements checkable.

If free prose is retained, separate it as attributed, unverified interpretation; it cannot satisfy a promise that every financial statement is verified. Quote stored reasons with the actual action/execution status beside them: a rationale for a rejected SELL does not prove that a sale occurred. Preserve reasons even when the report rejects the model's interpretation.

**Acceptance:** wrong idea with a correct number; wrong currency/unit/sign/period; percentage with wrong denominator; a valid derived percentage not precomputed; “doubled”/“best” without proof; stale source; missing valuation; duplicate/superseded rows; and attempted-trade wording presented as a fill. Each must reject or render a truthful code fallback. B-FIGURES should test entity-bound claims, not just number membership.

## W-12 — Add a product-specific window resolver

**Question:** Q4.1. **Severity:** required design condition.

**Evidence — VERIFIED.** Legacy slots are `open30`, `midday`, `preClose` with 30-minute windows and cadence-tier eligibility (`api/_utils/mandateSessionSlots.js:32–52`, `79–118`). The handler dispatches from `activeTick`/`activeCloseTick` (`api/cron/mandate-evaluate.js:291–294`) and `runBookEval` applies tier gating (`api/cron/mandate-evaluate.js:134–135`). Eval cron fires every 15 minutes in UTC hours 14–22 (`vercel.json:197–198`), covering the requested regular intraday times under both Eastern offsets.

**Smallest safe change:** add an idea-book schedule resolver keyed by `kind` and the epoch's `windowsVersion`, leaving the legacy resolver and tier map unchanged. Pin regular intervals `[11:00,11:30)`, `[13:00,13:30)` and `[15:30,16:00)` Eastern, with the early-close variant in W-15. Route kind-specific work from the existing generously firing handler; bypass legacy tier eligibility only for idea books. Use distinct work/idempotency keys containing product/schedule version, session and window. Share a physical quote snapshot across products only where its observation specification and cutoff are genuinely identical; changing a slot's name while keeping an old cached price is not a new observation.

The note jobs are separate nontrading tasks. Do not implement five model-evaluation slots, flip global transport to batch or run notes through the decision executor. Code's basket/exit/settlement/risk duties execute before optional model work and continue when triggers are absent or spend is exhausted. Include draining books in necessary code duties: today's sweep queries only `status == active` (`api/cron/mandate-evaluate.js:336`, `424–429`, `738`, `779–784`), whereas V2 requires reductions/settlement during drain (`docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md:198`).

**Acceptance:** legacy product slot outputs remain identical; every archetype's idea book gets the same versioned windows; off-window/holiday/unsupported-calendar fires do nothing; retries produce one window receipt; no-trigger rows distinguish “no model action” from code fills/trims that did happen. Exercise pause, drain, spent budget and concurrent close/evaluation. “No change” alone is inaccurate if deterministic code changed the book.

## W-13 — Schedule note production around actual readiness, with separate batch state

**Question:** Q4.2–3. **Severity:** required design condition.

**Evidence — VERIFIED.** The Huddle worker schedule is `*/2 12-21 * * 1-5` (`vercel.json:221–222`), but the current worker's enqueue and claim gate is **08:30 Eastern** (`api/_utils/huddle/worker.js:46–51`, `69`, `119`). Thus the note must be available at the player's job assembly boundary from 08:30 onward, not merely before the 09:30 open. Huddle gathering obtains its own morning symbol evidence (`api/_utils/huddle/gather.js:151–196`). Mandate's close window is close +15 through close +120 minutes, end exclusive (`api/_utils/mandateConfig.js:231–232`; `api/_utils/mandateSessionSlots.js:218–225`). The close snapshot precedes close-book processing (`api/cron/mandate-evaluate.js:735–754`, `807`).

The engine has direct and batch transport interfaces (`api/_utils/mandateModelCall.js:150–153`, `171–201`), but batch decisions use the book's open-submission gate (`api/cron/mandate-evaluate.js:138–160`). The source default is `direct` (`src/config/featureFlags.js:1993`). “Batch has never run in production” is supplied by the brief; this review neither proves nor contradicts it. The acceptance report still distinguishes harness evidence from pending live latency evidence (`docs/audits/MANDATE_ACCEPTANCE_REPORT_V1.md:4`, `106–107`).

**Pre-market recommendation:** submit the next trading session's pre-note after the preceding session's close rows are committed, keyed to that future trading session. Harvest it before 08:30 ET (12:30 UTC in summer, 13:30 UTC in winter). A same-morning alternative must submit before that boundary by a measured turnaround margin; no particular lead time can honestly guarantee a batch result without such evidence. Pin the available note or code fallback atomically when that player's Huddle job takes its book payload, and never hold up the game Huddle waiting for a batch. Use an earlier-hours note worker/branch with an Eastern-time guard and holiday-aware next-session calculation. The current Mandate eval schedule starts too late for this job.

At that hour it can honestly summarize the prior completed close, held ideas, recorded actions, pending settlement, due dates and clearly timestamped overnight inputs. It cannot claim a new morning portfolio valuation or fresh market move from yesterday's engine data. Do not borrow the Huddle's live gathering implicitly: doing so needs a new allowed book-note source, its cutoff/attribution and its cost measurement, while still keeping book data out of the script prompt.

**Is the pre-note model call worth it?** Its incremental informational value is small with the same prior-close ledger. Keep the adopted batch design and mandatory fallback, but measure whether its interpretation adds anything over a code line such as “At Thursday's close, two ideas were held; one is due Friday; no new valuation yet.” This review does not withdraw the founder's batch ruling. A prior-session batch submitted on Friday for Monday must retain Friday's cutoff and be invalidated or replaced by the fallback if its book/epoch has changed before playback.

**Close recommendation:** finish each book's close rows, freeze their shared snapshot reference and action manifest, then submit its close-note batch. Use a separate note queue/request identity `(book, epoch, session, noteKind, inputHash)`, no trading tool, no `execState.openBatchId`, and no path to `executeDecision`. Count spend/reservations/retries and late/unpriced results. Poll notes independently of intraday slots and after the close-duty window if needed; the decision batch's same-session/final-slot rules are not suitable note-delivery rules.

Specify a publication deadline before implementation. A workable proposed pilot deadline is **close +45 minutes**: 16:45 regular, 13:45 early close. If the close row exists, publish the code-built daily report with the validated close note if ready, otherwise its labeled fallback. If the row does not exist, show “close pending/unavailable,” not invented values; when the row commits, build the report from that row and honor the expired note deadline. The 105-minute close window remains a retry/processing window, not a promise of batch turnaround. A late model note is preserved as late and never silently replaces the published note. Do not postpone ledger figures indefinitely for narrative text.

**Acceptance:** summer/winter, Friday→Monday and holiday handoff, 08:29/08:30 claim boundaries, early close, a failed/slow close row, batch before/at/after deadline, epoch change, budget exhaustion, duplicate delivery and process restart. Every note path must have zero trade effects and preserve what the owner already heard/read.

## W-14 — Page size limits scale; latency limits the time available within a page

**Question:** Q4.4. **Severity:** required design condition; no measured throughput claim is available.

**Evidence — VERIFIED.** The eval handler has `maxDuration: 300` and a 290-second work budget (`api/cron/mandate-evaluate.js:63–64`). Snapshot construction scans all active books before paging (`api/cron/mandate-evaluate.js:326–357`). It then reads one page of 25 and processes books sequentially, checking the time budget only before starting each book (`api/cron/mandate-evaluate.js:424–451`, `490–492`). The direct model call supplies no per-call deadline/abort option (`api/_utils/mandateModelCall.js:150–153`). The daily enrichment runs groups of eight and includes corporate-action work (`api/_utils/mandateUniverseSnapshot.js:352–360`, `386–408`). Close also visits one page of 25 per fire (`api/cron/mandate-evaluate.js:779–807`).

**Deduction:** two `*/15` fires fit each 30-minute intraday window. The current structure can start at most **50 distinct books per window**, before slow work, retries or skipped leases. Seven fires fit the 105-minute close window, giving at most **175 close visits**, again before failures. These are upper bounds, not demonstrated throughput. Spreading 500 books over different intraday windows would fail the requirement that every book be checked at every window.

| Population | What binds and what must change |
|---|---|
| 4 books | Page size does not bind. The cold daily snapshot and sequential triggered model calls compete for the 290-second budget; either can dominate. Source alone cannot rank their actual latency. A stalled model can exhaust the function because the outer budget check cannot interrupt it. Qualify all-trigger, no-trigger and cold-cache runs with injected timing before activation. |
| 50 books | Exactly the theoretical two-page limit, with no margin for a missed fire. Each 25-book page needs `snapshot time + code/I/O time + triggered-model time < 290s`. If all 25 trigger, average model-plus-per-book work must be below 11.6 seconds even with zero snapshot overhead. This is not established. Pagination/dispatch and deadline handling must improve before a 50-book promise. |
| 500 books | A hard page/schedule mismatch even if models are instantaneous: 20 pages needed per window versus two fires; likewise 500 closes exceed 175 visits. Add durable per-window work items and bounded fan-out/continuations or multiple pages within a measured deadline, with leases/idempotency. Simply increasing the page limit or using batch does not establish service of every book. |

**Concrete condition:** separate always-required code visits from triggered model work so a slow model cannot consume the remaining books' code checks. Give model calls a remaining-budget deadline/abort path and record missed/deferred outcomes. Maintain an expected-versus-completed ledger per book/window and a recovery policy that preserves original cutoffs; never silently execute an old window's optional action later. Prebuild or otherwise bound the daily snapshot stage, while preserving protected coverage. Keep founder capacity at four until these measurements exist. Neither prompt caching nor batch reduces the requirement to visit all books.

**Acceptance:** fake clocks/clients at 4, 50 and 500, all/no/mixed triggers, cold snapshot, slow or nonreturning model, lease collision, process death and one missed cron fire. Assert which books received required code checks, whether optional actions were deferred, and that the ledger never reports a complete window with unserved books. No production calls are required for this design qualification; real latency remains a later measured activation condition.

## W-15 — Early-close geometry works, but the final-slot rule is transport-specific

**Question:** Q4.5. **Severity:** required design condition.

**Evidence — VERIFIED.** The legacy resolver derives its last slot as close −30 minutes; on a 13:00 close it is 12:30–13:00 (`api/_utils/mandateSessionSlots.js:87–99`). Its midpoint is **11:15**, not Amendment C's 11:00. The final-slot test refers to `preClose` (`api/_utils/mandateSessionSlots.js:151–152`), and only **batch decision submission** is prohibited there (`api/cron/mandate-evaluate.js:393–403`). The close window starts at 13:15 and ends before 15:00 on early-close dates (`api/_utils/mandateSessionSlots.js:218–225`). An offline probe verified those values for 27 November 2026.

**Concrete condition:** idea books use `[11:00,11:30)` and `[12:30,13:00)`, then the close note, with pre-market unchanged. Keep direct triggered management at 12:30; the existing last-slot rule does not prohibit it. If batch decisions are later introduced, preserving action availability at that final window requires a separately reviewed policy; do not silently suppress it or use the note batch as a trading escape hatch. Code duties run at both windows even when no model is called.

The early-close day has **four expected windows**, including the two notes, not five missing-or-present rows. Record the omitted regular intraday windows as calendar-not-applicable if the ledger uses a fixed five-slot schema. C:59's “expected five rows a session” needs that qualification. Test 11:00, 11:30, 12:30, 13:00, 13:15 and 15:00 boundaries, holidays and both offsets; preserve legacy 10:00/11:15/12:30 behavior for quarterly books.

## W-16 — New acquisition times cost requests even for existing symbols

**Question:** Q4.6. **Severity:** required design condition; correct the planning language.

**Evidence — VERIFIED.** The committed curated universe has **136 unique symbols**, counted by an offline import of its exported array (`api/_utils/mandateCandidateUniverse.js:33–86`). Snapshot construction preserves all held names and fills remaining capacity with candidates, even allowing held names beyond the nominal cap (`api/_utils/mandateUniverseSnapshot.js:80–100`). Quote chunks are 100 (`api/_utils/mandateConfig.js:123–126`), and each newly keyed snapshot fetches each chunk once and counts the chunks (`api/_utils/mandateUniverseSnapshot.js:485–508`). The quote function makes one HTTP request for its symbol list (`api/_utils/tournamentPrices.js:47–65`). Daily enrichment is separately keyed by date and reused (`api/_utils/mandateUniverseSnapshot.js:365–372`).

**Arithmetic at the 136-name source baseline, with no extra held/comparison names or duplicate builders:**

| Change | Additional quote acquisition per session |
|---|---|
| One genuinely additional snapshot time | **2 HTTP requests**, covering **136 symbol observations** |
| Two additional snapshot times, e.g. a third and fourth relative to a two-snapshot baseline | **4 HTTP requests**, covering **272 symbol observations** |
| Idea-book-only schedule replaces the old schedule: three intraday snapshots plus one close, pre-note reuses prior close | Same count as today's engine's three intraday snapshots plus close: **8 HTTP requests / 544 symbol observations total**, zero increase in snapshot count solely from the window relabeling |
| Both quarterly and idea-book times need service | Five distinct intraday times (10:00, 11:00, 12:45, 13:00, 15:30) plus close: **12 requests / 816 observations total**, an increase of **4 requests / 272 observations**, if common times share compatible snapshots |

Today's snapshot is platform-wide per active slot regardless of which cadence tiers evaluate (`api/_utils/mandateSessionSlots.js:188–198`; `api/cron/mandate-evaluate.js:326–357`). Therefore “moving a book from two checks to three” is not necessarily adding a third platform snapshot: that snapshot already exists when the engine is active. Conversely, being on the shared list does **not** make a new acquisition time free. Sharing makes acquisition flat across books at the same snapshot, not across time.

These are code-level HTTP counts and symbol observations, **not verified provider-billed credits or dollars**. The internal quota counter is explicitly chunk-based, not an account billing meter (`api/_utils/mandateConfig.js:123–126`; `api/_utils/mandateUniverseSnapshot.js:508`). No account/entitlement/production-universe evidence was queried. If the provider tariff charges per requested symbol, multiply by 136 rather than treating two HTTP requests as two credits. Confirm the applicable tariff separately before quoting dollars. Extra comparison/held names, retries and concurrent builders can raise usage; the pre-note need not add a price fetch, and another same-date snapshot need not repeat the slow layer.

**Concrete condition:** replace Direction:35's blanket “no added cost for names already on the shared price list” with “no per-book acquisition when reusing the same shared snapshot; a new snapshot time adds quote work.” Instrument request counts, symbol counts, retries and billed quota separately, and retain the authoritative coverage reservation before admitting new names.

## W-17 — Receipts must report committed standing, not predict slot release

**Question:** Q5. **Severity:** required design condition; a refusal/unknown state is truthful.

**Evidence.** C:75–89 gives only `open_slot`, `held_name`, `waiting_for_slot` and says a full slot opens by a named session “at the latest.” That guarantee conflicts with settlement waiting for the next eligible observation and cash settlement (`docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md:93–97`) and with C:130's no-fill rule. Pausing, spend exhaustion, coverage and handover have their own states (`docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md:63–65`, `198`, `202–204`). **VERIFIED:** the current nomination builder has queued/source/time/expiry/history fields but no `standing` (`api/_utils/filmRoom/practiceFieldSeam.js:99–110`); the default book resolver returns null (`api/_utils/filmRoom/practiceFieldSeam.js:129–143`). This is a design requirement for the new adapter, not a missing implementation claimed to be live.

**Concrete condition:** make route and eligibility separate fields. Retain the route plus `status/reason`, `asOf`, book revision/epoch, target window if known, expiry, and any conditional/earliest date. Derive the initial standing from the same transactional state used to create the nomination; do not use a stale page snapshot. Store history when standing changes. In an idempotent replay distinguish the original receipt from current standing. “Heard” means received by code, not seen by the agent. Use “queued for consideration” until selection actually occurs.

| State at the request | Truthful immediate receipt |
|---|---|
| Matching slot truly open, funds settled, no known preflight block | “Received for [slot]; queued for [next eligible window]. The agent may accept or decline.” Do not promise admission or a fill. |
| Held-name route eligible | “Received for [held idea]; queued for [window]. The agent may hold, act or decline.” A code timestamp is not a promise that a trade occurs then. |
| Full fitting slots | “Waiting for a slot. [Idea] is scheduled for review on [session]; reopening also requires settlement and may be later.” Mention earlier line exit only as a possibility. Delete “at the latest.” |
| Slot due/about to settle; terminal result exists but sale/cash is pending | “Review due/completed; the slot is still occupied while settlement is pending. Next opening is not yet known.” Do not classify it open from due date alone. |
| Price unavailable, stale, undated, corporate-action freeze or halted name | “Waiting for an eligible price/data resolution; no fill or release time is confirmed.” Preserve the scheduled review endpoint independently. |
| Drafting/model spend paused | “Received; consideration is paused. No model call is scheduled while paused; the input still expires [session].” Do not invent a resume date. |
| Draining or manager handover | “This book is winding down; no new risk/new idea is admitted. Existing settlement continues.” Only offer held-name consideration if the pinned drain/spend policy actually allows it; never transfer the source silently to the new manager. |
| Monthly spend exhausted, reservation pending, or cost unknown | “Received; model consideration is blocked by the spend allowance [or unresolved reservation].” Name a reset only if its exact accounting boundary is known; current expiry still applies. |
| B12 allowance or today's refill already spent | “Deferred: this window's input allowance/today's refill has been used.” Name the next eligible opportunity, distinguish duplicate from overflow, and retain expiry. |
| Outside market hours, after cutoff, weekend/holiday/early close | “Queued for [next scheduled eligible window].” If calendar coverage is unavailable, say scheduling is unavailable rather than guess a date. |
| Missing coverage or insufficient candidate capacity | “Received; [name] lacks reserved price coverage. It cannot be admitted yet; a later session may be needed.” Shared-list presence alone is not a reservation. |
| Insufficient cash/reserve, rails bind, ticker belongs to another idea | “Received; currently blocked by [named constraint].” A running idea is not cut short to clear the constraint. |
| Source/horizon/route ambiguous, unsupported held-card route, or no fitting slot known | “Received; eligibility/routing is unresolved [reason].” Do not infer a horizon from untrusted prose without a specified routing rule. C:93 explicitly leaves held-card routing to T2. |
| Missing book, no verified attribution, wrong owner/archetype, withdrawn/deleted/edited source | “Not queued: [non-leaking eligibility reason].” Preserve the ordinary source's own receipt where authorized; never create a nomination under an arbitrary or foreign book to satisfy the receipt rule. |
| Concurrent state change or temporary read/write failure | Retry a bounded transaction; if it cannot commit, say “Not queued; please retry” or “Receipt could not be confirmed.” Do not report successful receipt merely because the request arrived. A durable source may exist while its nomination does not. |
| Already processed/duplicate, withdrawn or expired | “Already considered [recorded outcome/reason],” “withdrawn,” or “expired: not considered within 10 sessions,” as applicable. A replay does not renew eligibility or turn a prior refusal into a new vote. |

Code can tell the truth in every row by stating its observed state and what is unknown. It cannot know a future agent choice, future market observation, eventual cash release or future worker success at nomination time. The requirement should be an immediate truthful receipt **or an explicit failure to persist one**, not an unconditional prediction.

**Acceptance:** create the receipt with concurrent settle/pause/drain/budget/coverage changes; verify revision-consistent standing, no model call, no premature `testing`, no expiry renewal, no unauthorized read and no guaranteed opening date. If standing is stale when displayed, show its `asOf` and refresh through the same projection. A later agent refusal and a code preflight deferral must have different reasons/actors.

## Verification and limits

Offline baseline validation completed at the reviewed HEAD: **7 test files, 253 tests passed**:

- `api/_utils/huddle/scriptPrompt.test.js` — 38
- `api/_utils/huddle/scriptRules.e3.test.js` — 65
- `api/_utils/huddle/planTemplates.test.js` — 52
- `api/_utils/huddle/applyRules.test.js` — 18
- `api/_utils/mandateSessionSlots.test.js` — 22
- `api/_utils/sharedResearch/session.test.js` — 11
- `api/_utils/mandateRationale.test.js` — 47

The initial test launch failed on filesystem permissions before running tests; rerunning with authorized local access and the dependency junction completed successfully. A separate offline Node probe counted 136 universe symbols, two quote chunks, regular 10:00/12:45/15:30 geometry, early-close 10:00/11:15/12:30 geometry, the 13:15–15:00 early close window, and the book-evidence canary entering `buildUserPrompt`. No provider/model/network call was made by that probe.

These tests validate existing components. The new B-VOICE, input-boundary, receipt, report and load conditions above remain future implementation acceptance requirements. No full suite, build, emulator, production inspection, Firestore, model or EODHD call ran. No pushes, PR activity, deployment or tracked source edits occurred. Runtime capacity, batch turnaround, billing entitlement and production history remain unestablished.

## Completion

- **HEAD:** `d9b4e3c1c8183cf1917ef8d0bd5ad6f4110e7ab6`.
- **Ruling 17:** BUILD WITH CONDITIONS — code playback only, isolated storage/inputs, voice validation and boundary tests (W-01–W-04; reason permissions in W-10).
- **Ruling 19:** BUILD WITH CONDITIONS — explicit attribution, bounded evidence, no input-controlled orders, stable selection/receipts and first-opportunity refill (W-05–W-09, W-17).
- **Q3:** same-book reason readers are permissible only by named exception; validate ledger-linked typed claims, not loose numbers (W-10–W-11).
- **Q4:** a separate versioned idea-book schedule and note queue can deliver five windows; current paging cannot guarantee 50 and cannot serve 500 per window (W-12–W-16).
- **Q5:** receipts can always state committed standing or uncertainty; never promise an unsecured read, fill or slot-opening date (W-17).
- **Report:** `C:\Users\fashr\.codex\visualizations\2026\11\13\01a1d602-795c-7f50-83f1-76a96c7d0bc6\20261113_ASTRA_REVIEW_PRACTICE_FIELD_RULINGS_17_19.md`.
