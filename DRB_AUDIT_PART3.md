# DRB Audit — Part 3: Sonnet + Shadow Logger + Risks + Env

## Section E — Sonnet Call Conventions

### E.1 Wrapper location
No shared Sonnet wrapper exists in `api/_utils/`. Every caller inlines the `@anthropic-ai/sdk` import plus a lazy singleton (`agent/decide.js:1,24-30`, `agent/reflect.js:8,20-26`, `cron/agent-evaluate.js:8,40-48`, `cron/agent-batch-review.js:7,20-26`, `forge/compile-dimensions.js:23,195-203`, `fantasytimes/*`, etc.). Canonical form:

```js
let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 2 });
  }
  return anthropicClient;
}
```

### E.2 Model string
`claude-sonnet-4-20250514` is used everywhere Sonnet is called — `agent/decide.js:109`, `agent/reflect.js:140`, `academy/generate-script.js:23`, `earnings/verify-stock.js:196`, `earnings/verify-batch.js:328`, `fantasytimes/generate-econ.js:446,486`, `fantasytimes/submit-earnings-batch.js:213`, `fantasytimes/poll-batch.js:148`, `_utils/fantasyTimesPrompts.js:52`, `_utils/seasonPrompts/pitStopDebrief.js:310`, `ai-advisor.js:1017` (deep mode). No other Sonnet build is referenced.

### E.3 Tool Use vs raw JSON
Forced Tool Use is the standard for structured outputs: `tool_choice: { type: 'tool', name: ... }` with a single tool schema. Example `agent/decide.js:108-116` (strategy) and `:161-168` (portfolio); also `agent/reflect.js:145-146` (`submit_reflection`). Tool schemas live in `_utils/agentToolSchema.js` and `_utils/agentEvalToolSchema.js`. A small number of LLM calls (e.g. `fantasytimes/generate-recap.js`) rely on raw JSON instructed by the prompt rather than Tool Use.

### E.4 Prompt location convention
Prompts live in dedicated `_utils` assembler files that export builder functions — `agentPromptAssembly.js`, `agentEvalPromptAssembly.js`, `voiceLayerPrompt.js`, `fantasyTimesPrompts.js`, `intelligencePrompt.js`, `technicalAnalysisPrompts.js`, and the `seasonPrompts/` directory (`blackSwanEscalation.js`, `entryTiebreak.js`, `pitStopDebrief.js`, `pitStopReply.js`). No markdown prompt files. Callers compose blocks via exported `buildXSystemPrompt` / `buildXUserPrompt` helpers (see imports in `agent/decide.js:6-13`).

### E.5 Error handling
Timeouts are enforced with `Promise.race` against `setTimeout` (`agent/reflect.js:138-149` — 30s; `cron/agent-evaluate.js:768-770` — 10s for Haiku). Voice layer (Gemma) uses `AbortController` + 15s abort (`agent/chat.js:258-270`). SDK-level retries set via `new Anthropic({ apiKey, maxRetries: 2 })` (`agent/decide.js:27`, `agent/reflect.js:23`, `forge/compile-dimensions.js:201`). Fallbacks: if `tool_use` block is absent, code falls through to deterministic defaults (`agent/decide.js:122-131` falls back to top-35 archetype-scored shortlist; `agent/reflect.js:153-154` throws and is caught upstream).

### E.6 Token/cost logging
Token usage is captured from `response.usage.input_tokens` / `output_tokens` and passed through `tokenUsage` on the shadow-log record (`agent/decide.js:327-330`, `:482-485`; `cron/agent-evaluate.js:772-773,1087`). No dollar-cost conversion, no per-model pricing table, no aggregated counter in the repo. `agent/chat.js:345` logs `tokenUsage: null` because Gemma runs via OpenRouter and the call site doesn't thread usage back.

## Section F — Shadow Logger

### F.1 Write path
Module `api/_utils/shadowLogger.js`. Writes JSONL records to GCS bucket `fantasytrades` (`:8`) at path `shadow/{stream}/{YYYY-MM-DD}/{timestamp}_{rand}.jsonl` (`:40-42`) via `@google-cloud/storage`. Exported streams: `logConversation`, `logDecision`, `logReflection`, `logEvaluation`, `logCompilation`, `logPartnerSignal`, `logStrategyConfig`, `logPipelineDecision`, `logReviewInteraction` (`:59-72`). Signature: `(record: object) => Promise<void>`; contract is fire-and-forget and never throws (`:4`, `:54-56`).

### F.2 Cron-generated precedent
Yes. `cron/agent-evaluate.js:1071-1088` calls `logEvaluation` on every per-battle Haiku evaluation, and `cron/season-daily-evaluate.js:432` calls `logPipelineDecision`. Both are cron-driven, no user in the loop. Other callers are user-triggered (`agent/chat.js:328`, `agent/decide.js:315,469`, `agent/reflect.js:82`, `forge/compile-dimensions.js:415`, `forge/workshop-chat.js:321`, `season/create-entry.js:431`, `season/generate-debrief.js:180`, `season/log-lockin.js:105`, `season/pit-stop-reply.js:187`).

### F.3 Metadata schema
No enforced schema — each stream has its own shape composed by the caller. The logger injects two fields only: `_stream` (stream name) and `_loggedAt` (ISO timestamp) via spread at write time (`shadowLogger.js:44-48`). Common but optional keys across callers: `userId`, `agentId`, `battleId`, `archetype`, `mode`/`battlePhase`, `tokenUsage`, plus stream-specific payload (e.g. `decision`, `rationale`, `scores`, `userMessage`/`agentMessage`).

## Section G — Risks

### G.1 TradingView bridge scaffolding
None. `TradingView` appears only as philosophy/tag strings in `src/data/forgeCollections.js` and `src/data/forgeKnowledgeBase.js`; zero hits under `/api`, `/docs`, `vercel.json`. `shadowLogger.js:64` exports `logPartnerSignal` → `partner_signals` stream but has no callers — reserved but unused.

### G.2 scoutAlerts single-source assumption
`scoutAlerts` is written only by `cron/voice-layer-cache.js:181-241,374,382` and read only by `_utils/voiceLayerPrompt.js:433-441,627,727`. The reader treats it as a plain array — no writer identity check, no provenance field, no de-dup key — so adding a second producer would silently append without conflict.

### G.3 Chat Firestore read count
Four reads per Gemma chat via `buildVoiceLayerPrompt`: `agentBattles/{battleId}` (`agent/chat.js:163`), `agents/{agentId}` (`:183`), `indexIntelligence/marketContext` (`:217`), `voiceLayerCache/{battleId}` (`:218`). The last two are parallelized in one `Promise.all`. `voiceLayerPrompt.js` performs zero Firestore reads — it only formats.

### G.4 Block 3.5 empty-source fallback
When `anchorContext` is missing, Block 3.5 substitutes the literal string `'No market data available. Focus on game state and partner preferences.'` (`voiceLayerPrompt.js:721`); review mode uses `'Market closed. Focus on today\'s trades and patterns.'` (`:623`). Blocks 4A/4B/4C return `null` and are simply omitted from the assembled prompt (`:417-418,433-434,443-445,755-758`). No retry, no cache-warm trigger, no user-facing error — the prompt just ships without that block.

## Section H — Env

### H.1 Env var list
Voice layer / cron / Sonnet env vars referenced in `api/`: `CLAUDE_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `PERPLEXITY_API_KEY`, `EODHD_API_KEY`, `ELEVENLABS_API_KEY`, `CRON_SECRET`, `ADMIN_SECRET`, `GCS_CREDENTIALS`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `NODE_ENV`, `VERCEL_ENV`, `VERCEL_REGION`.

### H.2 CLAUDE_API_KEY Vercel status
Assumed configured in Vercel — referenced by 22+ production Sonnet call sites across `api/agent/`, `api/cron/`, `api/fantasytimes/`, `api/academy/`, `api/season/`, `api/forge/`, `api/earnings/`, `api/_utils/`. No repo-side check; Vercel dashboard is the source of truth and this audit is read-only.

## Unknowns
- Whether `CLAUDE_API_KEY` is actually set in Vercel prod/preview — cannot verify from repo.
- Whether `ANTHROPIC_API_KEY` is also provisioned (required by `cron/season-daily-evaluate.js:76` and `season/generate-debrief.js:38` raw-fetch calls); if only `CLAUDE_API_KEY` is set, those two endpoints 401 silently.
- Whether `partner_signals` stream has downstream readers (training pipeline? analytics?) — not visible in repo.
- Whether `GCS_CREDENTIALS` is set in Vercel; if not, `shadowLogger.js:16-19` logs a warning and shadow logging is silently no-op.

## Flags
- Env-var inconsistency: two endpoints use `ANTHROPIC_API_KEY` via raw `fetch` (`season-daily-evaluate.js:76`, `generate-debrief.js:38`) while every SDK caller uses `CLAUDE_API_KEY`. Pre-loaded context specifies `CLAUDE_API_KEY`; the two raw-fetch endpoints will break unless both vars are provisioned.
- No shared Sonnet client means a new DRB cron must re-implement the lazy-singleton + `maxRetries: 2` pattern; drift between callers is likely (some set `maxRetries`, some don't).
- `voiceLayerCache` is per-battle (Part 1). A DRB writer targeting a global daily doc won't collide with `voice-layer-cache.js:377` writes, but any per-battle enrichment would race the 15-min cron.
- `scoutAlerts` has no provenance field — if DRB ever emits alerts into the same array, downstream UI cannot distinguish sources.
- Block 3.5 empty-source fallback is a silent string substitution; a DRB synthesis outage would degrade prompt quality invisibly rather than surfacing an error.
- No cost/$ accounting anywhere; token counts are logged per-record but not aggregated. Budget overruns only visible via Anthropic dashboard.
