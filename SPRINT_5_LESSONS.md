# Sprint 5 Lessons — Shadow Logger Restoration + Discover→Workshop Bridge

**Date:** May 7, 2026
**Status:** Both phases shipped to production. Shadow logger writes restored across four files. Theme + sector handoff to Workshop is live and visually verified.

---

## What was built

### Phase 0 — Shadow Logger Restoration
**Bug:** Since approximately April 30, 2026, `shadow/daily_regime_brief/` had only one record (April 29). DRB cron was healthy (Firestore writes succeeded daily) but GCS shadow writes were silently failing. Bug had been losing ~7 days of training data by the time it was diagnosed.

**Root cause:** Vercel serverless functions can be torn down immediately after `res.json()` flushes, killing in-flight network requests. The shadow logger's fire-and-forget pattern works only when the calling function has *other* awaited work after the log call to keep the event loop alive. Two callers had no subsequent awaited work:

- `compute-daily-regime-brief.js` — once-per-day cron, manifested as near-total record loss
- `create-entry.js` — user-facing strategy compilation, masked by traffic volume but losing some unknown fraction

During implementation, audit drift surfaced: `parse-signal.js` and `expand-signal.js` had the same anti-pattern in **both** their cache-hit and cache-miss branches (four call sites total, not the two originally identified). Cache-miss is the more frequent path in production, so it was likely losing more records than cache-hit.

**Fix:** Two patterns based on user-facing context:
- **DRB cron (no user waiting):** `await` the log call. Latency invisible.
- **User-facing endpoints (create-entry, parse-signal, expand-signal):** `waitUntil` from `@vercel/functions`. Preserves zero user-facing latency while guaranteeing the log completes before function freeze.

Both patterns preserve the silent-fail contract (`.catch(() => {})`).

**Verified working:** May 7 cron run produced a fresh 1.9 KB record at `gs://fantasytrades/shadow/daily_regime_brief/2026-05-07/...jsonl`. Training data flywheel restored.

### Phase 1 — Discover→Workshop Bridge
**Pre-Sprint-5 audit finding:** The "Workshop Voice Layer rework" referenced in project memory was a phantom. Workshop Mode in `voiceLayerPrompt.js` is feature-complete (last refined April 13). The `FANTASYTRADES_SPRINT2_TIERS_ROADMAP.md` doc referenced in memory does not exist. What memory captured as "rework in progress" was conflation of (a) the unrelated scoring Tier 0 roadmap and (b) the stable Voice Layer Construction Guide spec. Nothing was blocking the bridge work.

**What shipped:** Tapping "Start in Workshop" from a Theme detail modal or a Sector detail modal now opens Workshop with `seedContext` threaded through to Gemma. Empty-state copy mentions the theme/sector by name. `activeThesis` starts empty per locked decision (priming, not pre-filling). The user still drives the dialogue.

**Architecture:** `seedContext` is a discriminated union (`kind: 'theme' | 'sector'`) threaded from rail card → WorkshopChat → API → prompt builder. Forward-compat for `kind: 'signal'` reserved for Signal Drop UI in Sprint 6.

**Eight files modified:**
1. `WorkshopChat.jsx` — accept `seedContext` prop, seed-aware EmptyState (theme/sector/cold-start variants), thread to first POST only
2. `ForgeLanding.jsx` — replace `workshopOpen: boolean` with `workshopState: { open, seedContext }`, expose `requestWorkshopOpen` callback that owns the three pre-flight gates (`agent?.id`, `atLaunchCap`, `nextUpcoming`)
3. `DiscoverPanel.jsx` — inline `themeToSeed(theme)` and `sectorToSeed(ticker)` builders, real `handleStartWorkshop`, new `handleStartSectorWorkshop`, parameterized `logInteraction(source)` for analytics symmetry
4. `ThemeDetailModal.jsx` — removed Sprint 6 stub header comment; CTA visually unchanged but now does real work
5. `SectorDetailModal.jsx` — added Workshop CTA matching ThemeDetailModal's footer pattern
6. `SectorRail.jsx` — forward `onStartWorkshop` prop to SectorDetailModal (the audit deviation — needed because SectorRail is the ownership hop)
7. `api/forge/workshop-chat.js` — accept + validate (forgiving) + persist `seedContext` on first turn, rehydrate from session doc on subsequent turns
8. `api/_utils/voiceLayerPrompt.js` — extend `buildWorkshopContextBlock` with PRELOADED CONTEXT sub-block (theme + sector cases, forward-compat for signal)

**Locked decisions honored:**
- ✅ Priming, not pre-fill — `activeThesis` starts empty, only the prompt sub-block injects context
- ✅ Same gates inherited — no Discover-specific onboarding flow
- ✅ Theme + sector ship together
- ✅ Signal Drop forward-compat reserved
- ✅ Sprint 6 stub copy fully removed
- ✅ Telemetry preserved with source asymmetry handled
- ✅ Additive at every layer — `seedContext === null` path byte-identical to pre-Sprint-5

**Visually verified:** Tapping Energy Transition → Workshop opens with "1Agent is ready to dig into Energy Transition" empty state, all six Active Thesis fields show "Not yet discussed," compile gate copy displayed correctly.

---

## What we learned

### About Vercel serverless lifecycle
**The `waitUntil` pattern is the canonical answer for fire-and-forget background work in serverless.** Plain `Promise.then()` or unawaited promises will get killed when the function instance freezes. `waitUntil` from `@vercel/functions` tells the runtime "this promise must complete before tearing down the instance." For background writes that don't affect user response, this preserves UX (no latency tax) while guaranteeing completion.

**Pattern selection rule:**
- **No user waiting** (cron, scheduled task) → use `await`. Simplest. Latency invisible.
- **User-facing endpoint** → use `waitUntil`. Background work guaranteed without user-visible delay.
- **Naked `.catch(() => {})` after `res.json()`** → bug. The function may freeze before the catch ever fires.

This is broadly applicable across the codebase. Worth auditing other places where the pattern might be silently failing.

### About audit drift
**Initial grep-based audits can miss patterns that nuanced code reading would catch.** The Phase 0 audit identified two callers with the anti-pattern; implementation surfaced two more in cache-miss branches that the multi-line grep had missed. Claude Code surfaced the drift before edits and asked for scope expansion — exactly the right pattern.

**Cache-miss paths are usually the more frequent code path in production.** The audit drift was specifically dangerous because the cache-hit branches (which were initially identified) are *less* common than cache-miss. Fixing only cache-hit would have left the bigger leak unfixed.

### About process discipline (Claude Code)
**STOP-and-surface beats push-through-with-rationalization.** Two relevant moments this sprint:

1. **Phase 0 audit drift:** Claude Code stopped before edits, presented the four-call-site reality with a tabular diff, asked for scope decision. Excellent.
2. **Phase 0 stop-hook conflict:** Claude Code surfaced the conflict between the "STOP for review before pushing" instruction and the harness's stop-hook directive, offered four clear options, and waited for explicit decision. Exemplary discipline after an earlier sprint's push-through incident.

The pattern that works: when something unexpected surfaces, stop, show what's there, offer options, wait for decision. Claude Code internalized this between Phase 0 implementation and the follow-up Phase 0.5 commit.

### About phantom problems in project memory
**Project memory accumulates conflations over time.** The "Workshop Voice Layer rework in progress" entry was actually two separate, unrelated items merged into one mental model: the scoring Tier 0 roadmap (already shipping) and the Voice Layer Construction Guide (stable spec). Neither was a "rework in progress."

**A discovery audit can disambiguate.** Spent 15-20 minutes on a read-only audit before any Sprint 5 build work; saved hours of unnecessary scope detangling. Worth doing whenever project memory suggests blocking work that doesn't have clear evidence in code.

---

## What's preserved for Sprint 6+

The `seedContext` discriminated union pattern is forward-compat. When Signal Drop UI ships:

- Add `kind: 'signal'` to the union (TypeScript + JSDoc)
- Add a third case in `validateSeedContext()` server-side
- Add a third branch in `renderPreloadedContextBlock()` in voiceLayerPrompt.js
- Wire Signal Drop's "Start in Workshop" CTA to `requestWorkshopOpen({ kind: 'signal', ... })`

**No rework needed.** The bridge mechanism is built; Signal Drop plugs into it.

The inline seed-builder approach (rather than centralizing in `workshopSeed.js`) was a deliberate choice. With three callers eventually, refactoring to a shared helper may make sense — but only after Signal Drop is real and we know what its actual seed shape needs.

---

## Carried forward

**Operational backlog (none new this sprint):**
- ⏳ Forge Season Mode implementation (design complete, not yet started)
- ⏳ DKB upload completion (8 thematic entries)
- ⏳ Vision Phase 2a/2b (Phase 1 schema merged, Phase 2a drafted)
- ⏳ Reporter Context Pipeline / FantasyTimes Macro Signal Layer
- ⏳ Agent battle view redesign
- ⏳ TradingView signal bridge
- ⏳ Universe Intelligence + Leadership Intelligence
- ⏳ Forge Season Mode rule audit (post-launch)

**Pre-launch must-fix (status):**
- ✅ DRB shadow logger silent — RESOLVED in Phase 0

No new pre-launch must-fixes surfaced this sprint.

---

## Restart checklist

When future Flash (or future Claude) revisits this work:

1. **Read this doc + SPRINT_4_LESSONS.md** for sequential context across the two sprints
2. **Verify shadow logger still writing** — check `gs://fantasytrades/shadow/daily_regime_brief/` has recent dates; check `shadow/strategy_configs/`, `shadow/signal_drop/` similarly
3. **Verify Discover→Workshop bridge works** — tap a Featured Theme and confirm Workshop opens with seed context
4. **Build Sprint 6 (Signal Drop UI)** by extending the `seedContext` pattern with `kind: 'signal'` — see "What's preserved for Sprint 6+" above
5. **Voice Layer Construction Guide is stable, NOT rework** — if project memory says otherwise, it's outdated; check VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md
6. **`waitUntil` pattern is canonical** for user-facing fire-and-forget background work in this codebase

---

## End of Sprint 5

Phase 0: shipped to production
Phase 1: shipped to production
Both verified working

Two clean phases, zero regressions, real shadow logger fix that closes a 7-day data debt, and a real product feature wired up the way users will actually use it.
