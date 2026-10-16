# BaggerBomb stock thresholds v2: allowlist pilot approval

October 15, 2026. Flash (founder) decisions recorded for the v2 build. Fable (Claude.ai) wrote the build prompt that carries them; Claude Code (Opus) built it. The record below is the decision text, not a new ruling.

## Times

| Rulings | Time | Source |
| --- | --- | --- |
| 1–5 | Oct 15, 2026, 11:51 America/Chicago (16:51Z) | Blessed by Flash, as stated in the build prompt |
| 6–16 | Received with the build prompt; this session's first command ran at 15:23:45 America/Chicago (`2026-10-15T20:23:45Z`) | The build prompt says they "were blessed with this prompt" and gives no separate time. The receipt instant is recorded as the best available evidence, not as a founder-stated time. |

`STOCK_APPROVAL.approvedAt` in `api/_utils/stockThresholdPolicyRegistry.js` is that receipt instant (`2026-10-15T20:23:45Z`). A measured creation before it is refused (`approval_not_effective`).

## Identity of the approved model

| Field | Value |
| --- | --- |
| Model | `stock_measured_atr14_fullday_v2`, `modelVersion` 2 |
| Policy file | `docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_V2_20261015.json` |
| Policy SHA-256 (canonical stableStringify) | `22a815985037ddba74526973237817f233e38fd97cb1b1cff5f33e7af345050b` |
| Publication rule | `eodhd_us_completed_session_observation_v1`, unchanged; SHA-256 `3ad8e14b203acd660faba9b8ec7e78c7dcb9f312741ec04cd062bcf79741a85f` |
| Approved reference | `owner_baggerbomb_stock_thresholds_v2_20261015@v1` |
| Collector | `eodhd_stock_server_collector_v1` (collector code unchanged) |
| v1 | Retired, not kept. No v1 battle exists (Phase 0 §B3). A v1 stamp resolves unavailable and can still end under Ruling 4. |

Rulings 1, 3, 4, 7, 8 and 9 are hashed policy fields (`rewardTiming`, `unavailableFrame`, `expiry`, `offHoursCreation`, `crypto`, `quote`). Ruling 2's 45 minutes is a code constant (`STOCK_LATE_START_CUTOFF_MINUTES`, `api/_utils/stockThresholdAdmission.js`), recorded here and deliberately not hashed.

## The rulings

1. **Timing.** A corrected position's quote lower bound is its fill quote's provider time (`fillQuote.quoteAsOf`). A strictly later quote is valid; a quote at the same provider time is valid only at exactly the fill price; same time with a different price is unavailable. An exit needs a quote strictly later than the fill quote. `enteredAt` stays recorded and remains the upper bound on fill evidence. Branch A: a tick quote that predates the fill values the position at its own receipt fill (same time, same price). The `stockEntryCommit` marker is deleted, so K2-6 disappears.
2. **Late-start cutoff.** Corrected creation is refused from 45 minutes before the calendar close (15:15 ET normally, 12:15 ET on early-close days), measured at the creation instant against `getSessionForDate(...).closeMs`, in `prepareStockCreation` before any measurement GET. Retriable, with a clear player message. Only an allowlisted creation can reach it.
3. **Missing reward evidence.** The four corrected early returns in `processAgentBattle` continue the tick. The calibrated risk pass, forced exits and deployed guardrails (including the R11 pass) run; reward-dependent stages see an unavailable context; `finalizeCronState` and the normal final write happen on every corrected exit; a null score is never written or shown as 0. The M1 gate is unchanged.
4. **Expiry.** An expired corrected battle settles on its latest stored frame if that frame is valid; otherwise it ends as result unavailable (no last-valid-frame record). The terminal write follows Phase 0 §E3 and does not depend on `readCorrectedInputs`; it also covers route `unavailable`. Both pattern-logger callers check the disposition.
5. **Pilot allowlist.** Keyed on `ownerId` (Ruling 14); details in Ruling 6.
6. **The switch moves to the control document.** `STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED = true` ships with its pins reconciled in the same commit. `stockThresholdControl/admission` (schema 2, carrying `audience`) is the only on-switch. Missing, disabled, unparseable or old-schema control means legacy for everyone, with no measurement reads; this reverses the v1 runbook's "never legacy" for unselected creations. Only `audience: { mode: 'allowlist', ownerIds: [...] }` (non-empty) selects, and only for listed owners; any other mode, including a future `'all'`, is closed and legacy. A selected creation that sees the control change before commit is refused. Approved fence contact: `agentBattleService.js` keys on per-battle selection. Tournament creation stays byte-identical.
7. **Off-hours creation is allowed** (pre-open, after close, weekends). The fill is the latest valid real-time quote at creation, with the strict `close` field, a provider timestamp and the existing activation validation. The opening jump counts as post-fill movement. The 16:00–16:15 ET publication-window refusal stays. Source-session closing-quote rule, from the final Phase 0 §C3: accepted when its provider stamp is at or after the source session's calendar close (the closing bar is stamped exactly at the close); an earlier stamp (the 15:59:00 minute bar still served just after 16:15) is refused, retriably; no tolerance.
8. **Pilot crypto.** An incoming crypto fill with `fallback: true` is refused; the outgoing crypto entry gets the positive check; normal crypto swaps continue.
9. **Strict close.** Corrected stock valuation accepts only a real `close`; the `previousClose` stand-in is unavailable for corrected stocks (an additive field from the shared path; legacy selection unchanged).
10. **Agent instructions.** Approved fence contact in `agentEvalPromptAssembly.js`: corrected games get reward text naming the frozen measured percentage as the divisor, with matching worked examples; legacy prompts and goldens stay byte-identical; the split renderer joins `PROMPT_CONTRIBUTING_MODULES` in the same commit.
11. **Result-unavailable side effects.** Retire the vision. Write no settlement record, stats, mastery stamp, reflection, review queue or pattern log.
12. **Completion timing** (20:00 ET expiry, completion at the next weekday's first run) is accepted as-is.
13. **v2 policy content**, as in the identity table above.
14. **Allowlist key is `ownerId`.** FT_QA owns two agents named Cipher; the account is the unit.
15. **The stock modal on corrected positions** uses the normal BaggerBomb tab layout from the committed context only, draws all six targets on the chart from the fill with HIT markers only from crossed tiers, puts references in a collapsed Details row, states "Measured reward unavailable" clearly and fills Why's proximity text. For every battle, the placeholder "Historical (30 days)" block is removed and no rating renders without a real `ratingText`.
16. **Readers.** Every legacy-only reader in Phase 0 §E4 resolves the pinned model on corrected games; legacy games are unchanged everywhere.

## Switch-on preconditions (build findings, not rulings)

**1. Security identity.** The build's live universe record (Oct 15, 17:34 ET; build report and audit record) found that the collector's security-identity check requires a non-empty `General.ISIN`, which the provider returns as null for almost every US-domiciled stock (220 of 239 symbols refused `security_identity_unqualified`; only 8 non-US-domiciled issuers qualify). **Do not enable the control document until a follow-up that settles the identity rule is merged and the universe record shows the eligible set qualifies.** That follow-up is a contract decision for Flash and Fable (what anchors `securityId` in immutable receipts), not part of this approval.

**2. The evening window.** The build review (lens B1, verified) found that on a regular trading day a full-day battle holding crypto that is created from 16:15 ET up to 20:00 ET expires at 20:00 ET the same evening and never gets a scored check, because no evaluation runs after 16:00 ET. Phase 0 §C3 assumed such a creation "plays the next session"; that holds only for stock-only rosters, and every tiered battle carries crypto. A measured battle created there ends as result unavailable, and the agent cannot redeploy until it settles at the next weekday's first run. Legacy battles in the same window already end as a 0–0 draw (reported separately). Ruling 7 allows after-close creation, so the build does not refuse the window. **Do not enable the control document until Flash rules** on the options in the runbook (refuse the window; move the crypto expiry, which is fenced; or accept and steer players to after 20:00 ET).

## Build readings of the rulings (recorded, not new rulings)

- **Unreadable control (Ruling 6).** A control document that cannot be read is treated like a missing one: legacy creation, no measurement read, and a server warning that names no owner. Refusing instead would 503 every tiered creation on a Firestore blip, which Ruling 6 forbids for non-listed owners. An allowlisted owner can therefore get a legacy battle during an outage; the pilot verify script reports such a battle as `route legacy`.
- **No tick quote (Ruling 1).** Branch A stands in only for a dated, positive tick quote that predates the fill, as ruled. A position whose tick quote is absent stays unavailable for that frame; if that is the final frame (a 15:45 ET swap whose quote fetch failed), Ruling 4 ends the battle as result unavailable.

## Out of scope (reported, not changed)

The CPU flat 2.5%, the rank-0 falsy default, the legacy modal baseline mismatches, the intraday rankings drift and the last-30-minutes scoring gap (Phase 0 §F3 and §C4). Also, from the build review: a legacy full-day battle with crypto created between 16:15 and 20:00 ET on a regular trading day expires unplayed and records a 0–0 draw with stats and a reflection (predates this build).
