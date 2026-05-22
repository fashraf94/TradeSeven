# Phase 2 / 2.5 / 3 Voice Layer — Follow-Up Backlog

Small fixes and deferrals captured while shipping Phase 2, Phase 2.5, and Phase 3. Items here are not blocking the current phase but should be picked up before they accumulate.

## Open

### Fix discovery sampler script credential parsing (small)

**File**: `api/scripts/sample-voice-layer-terms.js:57`

`JSON.parse` on the `GCS_CREDENTIALS` env var fails with `"Expected property name or '}' in JSON at position 4."` Likely cause: multiline JSON in `.env.local` not parsing correctly under PowerShell, or wrong env-var format (path vs JSON string).

**Trigger to fix**: when refreshing the Phase 2.5 TERM_UNIVERSE against production shadow logs (i.e., the first term-universe expansion past the initial 12). Until then, prompt-content proxy analysis is the workable substitute.

**Filed**: May 22, 2026 — Phase 2.5 discovery step.

### Plural-form term detection (Phase 2.5.5 candidate)

The Phase 2.5 chat highlighter detects exact-match uppercase tokens only. Plurals like `SMAs` or `EMAs` won't highlight because the lowercase `s` doesn't form a word boundary against the uppercase token.

**Trigger to fix**: post-deploy observation that Gemma frequently pluralizes acronyms in narrations. If shadow-log review of Phase 2.5 production usage shows pluralized terms appearing often enough to be a visible gap, build phrase/plural detection as part of Phase 2.5.5.

**Filed**: May 22, 2026 — Phase 2.5 planning.

### Multi-word and lowercase concept detection (Phase 2.5.5 candidate)

Phase 2.5 ships single-token uppercase terms only. Multi-word concepts ("moving averages", "support/resistance", "institutional support", "momentum", "regime", "relative strength") are valid product candidates but require phrase-matching detection beyond the existing `[A-Z]{1,5}` regex.

**Trigger to fix**: post-deploy review showing Gemma using these phrases frequently AND users not understanding them. Don't build speculatively.

**Filed**: May 22, 2026 — Phase 2.5 spec §2 Decision 1 carve-out.

### Frontend `knownTickers` is scoped to current battle roster (latent bug)

**File**: `src/screens/AgentBattleScreen.jsx:625`

`knownTickers` is built only from the current battle's deployed portfolio (`star/core/support`). Tickers Gemma mentions in chat that aren't currently held — including any from closed trades or scout alerts — fall through to the unknown-token branch.

**Trigger to fix**: Phase 2.5 changes the unknown-token branch from "clickable (broken modal)" to "plain text," so this bug becomes a UX hole: Gemma can say "NVDA" but the user can't click it unless NVDA is in their roster. Either (a) union in tickers from `agentBattle?.trades` (closed positions) as a one-line hedge, or (b) wire `knownTickers` to the canonical `ALL_TICKERS` / `STOCK_UNIVERSE` from `src/constants/sectors.js`.

**Filed**: May 22, 2026 — Phase 2.5 planning. Documented as out-of-scope for the current phase per the locked spec.

### ESC key support for modals (small UX gap)

Neither `AssetResearchModal` (`src/components/draft/AssetResearchModal.jsx`) nor `CenteredModal` (`src/components/shared/CenteredModal.jsx`) handle the ESC key to close. Phase 2.5's new `TermResearchModal` will inherit this gap by reusing `CenteredModal`.

**Trigger to fix**: any accessibility pass, or first user complaint. Adding it to `CenteredModal` fixes both the term modal and any other consumer of the shared shell.

**Filed**: May 22, 2026 — Phase 2.5 planning.

## Filed during Phase 3

### PHASE_RULES BOTTOM-table inconsistency in Phase 3 spec

Phase 3 spec §4.2's BOTTOM block table lists `PHASE_RULES[phase]` after `ANTICIPATION_INSTRUCTIONS`. The implementation correctly omits this per Phase 2 trade-narration precedent — `PHASE_RULES` are designed for conversational chat turns (CONFIRMATION→EXECUTION patterns, "set hasDirective:true", multi-option presentation) and directly contradict anticipation's structured-output contract (forced `hasDirective: false`, no question-presenting, reporting register). Rationale is documented inline at `api/_utils/voiceLayerPrompt.js:3082-3091`.

**Trigger to fix**: when writing Phase 4 / 5 / 6 specs that involve structured-output prompts. Do NOT copy-paste the BOTTOM table row that includes `PHASE_RULES[phase]`. Re-evaluate against the prompt's output contract — `PHASE_RULES` belongs in conversational paths only.

**Filed**: May 22, 2026 — Phase 3 audit findings.

### Anticipation observability gap (eval→exchange direction)

`api/scripts/test-voice-layer-phase-3.js` A1 tests the anticipation→eval direction (each anticipation entry has a non-null `anticipationContext.evaluationId` and is best-effort matchable in `battle.evaluations`). This is the forward audit-trail check. The reverse direction — "Haiku flagged candidates that Gemma dropped" — is NOT detectable by any test because Haiku's flagged `anticipationCandidates` are not separately persisted to the evaluation record. The dispatch is fire-and-forget; if Gemma fails (timeout, parse error, Firestore write failure), only the shadow log at `shadow/anticipation/` carries the breadcrumb, and no behavioral test asserts that path.

**Trigger to fix**: post-deploy review of `shadow/anticipation/` shows a non-trivial rate of `errorStep != null` records. The real fix is to persist Haiku's flagged candidates as a separate event type — e.g., add `logHaikuAnticipationFlag(...)` invoked at the cron's push site (right after `pendingAnticipations.push`), independent of Gemma's later success. Then A1 can read both streams and compute eval→exchange match coverage.

Likely revisit during Phase 6 polish or the next shadow-logger expansion.

**Filed**: May 22, 2026 — Phase 3 audit findings.

### Undefined directive behavior in anticipation prompts

`buildAnticipationPrompt` accepts a `directive` parameter and threads it through `buildActiveDirectiveBlock` into the MIDDLE prompt block. But `ANTICIPATION_INSTRUCTIONS` provides no guidance on how Gemma should reference the active directive in anticipation messages. Trade narration has an explicit EXCEPTION clause that grounds directive callbacks against the active directive. Anticipation does not — the directive will appear as context but Gemma has no instruction on whether to mention it.

**Trigger to fix**: post-deploy observation. If anticipation messages feel disconnected from the user's active directive in production (e.g., user issues a directive "watching cyber names this week," Haiku flags CRWD as a potential_entry, Gemma's anticipation message doesn't acknowledge the directive connection), add a one-line instruction to `ANTICIPATION_INSTRUCTIONS`:

> "If an active directive is present in your context, reference it when relevant to the watching candidate. Don't force the connection if it doesn't apply."

Small fix-up if needed; defer until production observation warrants it.

**Filed**: May 22, 2026 — Phase 3 audit findings.
