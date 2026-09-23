# Cockpit — Founder Ruling Sheet after Phase 0 (Sep 23, 2026)

**Source:** `docs/audits/20260923_PHASE0_COCKPIT.md` @ `e078d4b6` (HEAD `2a1a16b1`), read in full. **Format:** each ruling states the finding, the options, and Fable's recommendation. **Approve-by-default:** reply "approved" with exceptions by number; contract V1.1 and spec V1 follow in one pass.

---

## Build 0 — declarations · call writer · shadow

**CR-1 — Teaching route.** The schema file is not fenced; only a system-prompt section would be. *Recommend:* **schema-description route** for Build 0 (Haiku learns `declarations` from the tool's `description` fields, exactly as `anticipationCandidates` does today) — zero fence contact. If the shadow week shows poor declaration quality, add the prompt section via the DR-13 flag-split as a follow-up.

**CR-2 — The schema must be flag-conditional (must).** `TRADE_DECISION_TOOL` is one frozen constant sent on every tick; a `declarations` property would be model-visible at `off`. *Recommend:* build the tool with a `buildTradeDecisionTool({ declarations })` that includes the property only when `CALL_RECORDS_MODE !== 'off'`, pinned by a byte-identical-at-`off` test; measure the `m7e2eBudget` margin in the build.

**CR-3 — Capture schema version.** New `calls[]` paths on the tick are an allowlist change by V1.4 amendment 4. *Recommend:* bump `TICK_CAPTURE_SCHEMA_VERSION` to 2 — the record's shape changes, and the version exists to say so.

**CR-4 — Call id.** *Recommend:* deterministic `${tickId}:call:${n}` (idempotent under a re-run transaction callback), never `randomUUID`.

**CR-5 — Mint-time validity check (replaces the threshold lint).** `threshold` is prose by ruling and nothing validates a typed level. *Recommend:* a call is minted `invalidated` when its symbol is absent from the tick's present signals (reuse `buildPresentSignals`), its `condition.level` is not a finite number, or the level is implausible against the tick's own price for that symbol (|level − px| / px > 25%). Anything else is `open`. The prose threshold stays on the anticipation entry untouched.

## Build 1 — endpoint · directive kinds · sweep · calls block · chip

**CR-6 — Two divergent answers in one interval.** `battle.directive` is one latest-wins slot; multi-directive is STOP-class. Options: latest wins (silently discards the first call); **refuse the second divergent answer while the slot is unheard**; multi-directive (fenced, later). *Recommend:* refuse, with a typed 409 `directive_pending` naming the pending call, rendered on the tile as "waiting on the 1:45 check · one call at a time." Endorsing acks never touch the slot. Multi-directive is a later fenced build if the shadow data shows players hit the limit.

**CR-7 — Acks write an exchange and do not charge.** Both chat surfaces render receipts from `chatExchanges`, so an ack with no exchange shows nothing. *Recommend:* an agent-initiated exchange (the trade-narration shape, `hasDirective: false`) that does not charge, per the deploy-opener precedent; a divergent answer files through the chip route's transaction and charges one message, as a chip does today.

**CR-8 — Join key is `callId`; no exchange id.** *Recommend:* drop `render.chatExchangeId` and `playerResponse.exchangeId` from the contract; the anticipation writer stamps `callId` into `anticipationContext`, the answer receipt carries `callId`, the bubble renders `data-call-id`, and the reverse deep link scrolls to it. `directiveId` → `directiveThreadId` throughout.

**CR-9 — Horizon-bound directives need a registered expiry.** `directiveUtils` treats an unknown expiry as active (fail-open, out-of-scope finding 10). *Recommend:* register `until_ms` (an absolute market-time instant) in `isDirectiveActiveOnDay`, used by the hold-off / ask-first kinds; the registration closes the fail-open for any future value too.

**CR-10 — The sweep host.** *Recommend:* `ended_with_battle` inside `completeBattle`'s transaction; horizons that pass on a day the battle never triggers again handled by the queue-flag pattern (a per-battle flag drained by an existing cron, the `pendingReflection` shape) — no new cron. **Critical-path dependency:** the deferred-beat PR is on no branch; it is queued in this arc and is now Build 1's first prerequisite.

**CR-11 — B2's fate before Build 1.** `claude/b2-directive-transaction` is 13 commits ahead, one JSON conflict, but `chat.js` was rewritten since. *Recommend:* decide now — either an Astra review of a rebased B2 and merge (the answer endpoint then calls the shared transaction), or abandon it and let `call-response.js` mirror `file-directive.js`'s transaction. Fable leans **abandon** for schedule: the endpoint needs the transaction shape, not the attestation, and the attestation can be added to both routes later.

## Build 2 — the UI

**CR-12 — Colours.** The shipped player colour is teal and copper is the CPU; V4's purple/copper collide. *Recommend:* seven `--ft-call-*` aliases derived from the existing palette, with **teal** for "your call filed" and "held off," green for acted, gold for asking, `--ft-text-muted` for expired, and a muted red/warning alias (never copper) for dropped; the tile's state dot is a new `--ft-*` dot, since no fuse exists in the Battle View. Tokens by name; no hex.

**CR-13 — Motion.** V4's 320 ms bezier and 180 ms fade match no token. *Recommend:* the slide on `smooth` (0.3 easeOut) and the reduced-motion cross-fade on `fade` (0.2); the Board ⇄ Cockpit track as **native scroll-snap** (the `ArchetypePicker` precedent: `touch-action: pan-x`, reduced motion falls back to native snap) with a framer `layoutId` thumb on `smooth`; never a CSS transition (neutered under reduced motion). The LOCKED table is not tuned.

**CR-14 — The pinned mobile header is a layout change, and we make it.** Nothing is pinned on the mobile Battle View today. *Recommend:* a bounded board column with its own scroller (mirroring desktop's) and `ThisTurnStrip` lifted above the track, **behind the cockpit flag** so the shipped screen is byte-identical at `off`. Also: a shell-aware pane section list (desktop pane gets Cockpit first; the mobile mark keeps Chat · Bench · Tape); `paneUnread` keeps clearing only when Chat is viewed; the calls badge is its own count; Show It in the research sheet is gated by `isShowItOn()`; and **"flag for next deploy" is deferred out of v1** — the research sheet ships with two outcomes (answer · ask in chat) until an add-ticker endpoint and mid-battle watchlist semantics are ruled.

---

## For the framework chat — proposed BaggerBomb R6 horizon table (confirm or amend)

R6 says each mode's setup contract defines the translation; none exists for BaggerBomb. Proposed `horizonPhrase` enum and `expiresAt`:

| `horizonPhrase` | `expiresAt` (market time) |
|---|---|
| `next_check` | the next scheduled check after `promptBuiltAt` (+15 min on the shipped cadence; recomputed from the schedule, never a count) |
| `this_session` | 16:00 ET on the session of `promptBuiltAt` |
| `this_battle` | the battle's scheduled end |
| `explicit` | a stated instant the declaration carries (`expiresAtMs`), clamped to `this_battle` |

Default when the model omits it: `this_session`. The check flips `expired_unresolved` on encounter; the sweep is the backstop.

## Fold into contract V1.1 and direction V4.1 (mechanical)

Contract: §2 and §10 lose "fenced"; §3 `evidence.priceAsOf = promptBuiltAt` (tick-level, derived display); §3 drops the exchange-id fields per CR-8; `directiveId` → `directiveThreadId`; §6 adds CR-6/CR-7; §8 adds CR-2 (conditional schema) and the mint-time check per CR-5; the horizon table per above. V4: §4 colours per CR-12; §3 motion per CR-13; §1 the flagged layout change per CR-14; §5 Show It gate corrected; research outcomes reduced to two for v1.

## Docs PR
Merge `claude/phase0-cockpit`. In the same PR commit the four inputs under `docs/design/` as `COCKPIT_DESIGN_BRIEF_V1_SEP22.md`, `COCKPIT_DESIGN_DIRECTION_V3.md`, `COCKPIT_DESIGN_DIRECTION_V4.md`, `CALL_RECORD_FIELD_CONTRACT_V1_0.md` (V1.1 supersedes it once written) — the Sep 1 hub brief keeps its filename.
