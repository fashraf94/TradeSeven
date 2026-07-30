# WIRE EXEMPLAR SHORTLIST — ZERO-GROUPS DIAGNOSIS (read-only)

**Date:** July 29, 2026 (build session) · **Method:** read-only code diagnosis, no production access
**Trigger:** the founder ran `api/scripts/wire-exemplar-shortlist.js` against production and got three zero groups (reporter × type combinations with no shortlisted candidates).
**Basis:** 4-reader adversarial workflow (1 reader hit the structured-output cap; that dimension — Doug-recap — is filled from the third-group reader + the verify pass + this session's own grounding). Every claim below is code-grounded; **we have no production access, so each mechanism carries the exact observation that would confirm or kill it from the founder's own output/logs.**

---

## 0. The one number that resolves everything

The script already prints, per group, **`considered`** (the pre-filter `snap.size`, `wire-exemplar-shortlist.js:144`) next to `shortlisted`. That single number mechanically separates the two failure classes:

- **`considered = 0`** → the type is **not being written at all** (or was retention-deleted) — a production condition.
- **`considered > 0`, `shortlisted = 0`** → the type IS written but every row failed a script filter — a script/data-shape condition.

Read those three numbers first; they collapse most of the hypothesis space. Everything below is what the code says each class means.

---

## 1. Verdict table

| Zero group | Class (code-grounded) | Live defect? | Confirming observation (founder-side) |
|---|---|---|---|
| **neta** (a Neta type) | `econ_recap` most likely **never written** — production gate depends on Sonar returning a Tier-1 event with `actual != null`, which a forward-looking Sonar calendar structurally leaves null | **Yes** (fragile Sonar dependency) | `considered` for neta×econ_recap = 0; and recurring prod log `No Tier 1 events with released data found` on every recap cron fire |
| **doug earnings_recap** | Data-availability timing: the evening crons query EODHD for the UTC "today" and require `actual_eps` already populated, but after-hours (AMC) actuals aren't in EODHD's calendar at cron time | **Yes** | `considered` = 0; prod log compare `Raw earnings for today` (`generate-recap.js:110`) vs `Tracked earnings with results` (`:127`) — raw>0, tracked=0 confirms |
| **third group** (inference) = the **other Neta type** (`econ_preview`) | Sparse + retention-clipped: weekly cron, only a handful land inside the retention window | Likely **no** (expected sparsity) | `considered` = a small number (3-5) or 0; cross-check any rows' dates against recent Mondays |

**The founder's `considered` counts settle which of the two Neta types is the named zero vs the third, and whether Doug-recap is truly `considered=0`.** The table's "third group" is inference pending that output.

---

## 2. The Neta wiper hypothesis — REFUTED for story production

The founder asked to name and test the wiper hypothesis (the `seedConsensus` economics-array wipe, Phase 0 §5.2 / Step 0, fixed in PR #682). **The code refutes it as a cause of any Neta zero group**, and the refutation is clean:

- Both Neta generators source their events from **Sonar**, not the consensus doc: `handleRecap` calls `fetchEconomicEvents()` → `calendar.thisWeek` (`generate-econ.js:188,191`); `handlePreview` the same → upcoming events (`:446-450`). Neither reads `fantasyTimesConsensus/{date}.economics[]`.
- That array is **written** by Neta *after* the story publishes (`appendEconomics`, `generate-econ.js:393-404`) and **read** only by `buildConsensusBlock` (`fantasyTimesConsensus.js:287`) for **Kai/Kim** prompt context and as the D-P2-8 adapter operand. It is never an input to Neta story generation.

So the wipe — real, and now fixed — degrades **cross-reporter prompt context and Phase-3 gate evidence**, not whether a Neta story row exists. It **cannot** zero a shortlist group, which reads `fantasyTimesStories`. Verified against both Neta paths and the consumer census; the adversarial verifier strengthened this to "cannot zero **any** reporter's story production."

**What actually zeroes a Neta type:** `econ_recap`'s production gate is a live dependency on Sonar populating `actual` for released Tier-1 events (`generate-econ.js:191-194`); a search-LLM generating a forward-looking calendar tends to leave `actual` null, so `releasedTier1` is empty and the recap early-skips with no story written (`:196-203`). That is the high-likelihood live defect for the Neta zero — **not** the wiper.

---

## 3. Doug earnings_recap — treated as a live defect, ranked

A 60-day zero is implausible from sparsity alone (earnings seasons guarantee tracked reporters), so this is a genuine defect. Ranked:

1. **`actual_eps` availability timing (primary).** `fetchTodaysEarnings` queries EODHD's earnings **calendar** for `from=today&to=today` and keeps only rows where `actual_eps != null` (`generate-recap.js:114-125`). EODHD populates `actual_eps` only *after* the company reports **and** EODHD ingests it. After-hours reporters' actuals are typically not in the calendar at the same-evening cron time → the filter is empty every run. `actual_eps` is a real field (read identically at `ingest-earnings.js:127`), so this is **not** a field-name typo — it's a timing gap. *Confirm:* raw count (`:110`) > 0 while tracked count (`:127`) = 0 in prod logs.
2. **UTC-date window (secondary, one firing only).** The window uses `new Date().toISOString().split('T')[0]` = the **UTC** date (`generate-recap.js:68`). The cron `0 20,21,22,23,0 * * 1-5`: the four `20-23` UTC firings land on the correct ET trading day, but the `0`-UTC firing runs on the *next* UTC calendar day and queries the wrong date. So the UTC bug alone corrupts only 1 of 5 firings — it compounds (1) but doesn't cause the zero by itself. *(Worth a dedicated fix regardless — see §6.)*
3. **Retention ceiling (bounds any recovery).** `cleanup.js:30-58` marks stories expired at `expiresAt < now` and hard-deletes them ~30 days later. Doug's `expiryHours = 168` (`fantasyTimesPrompts.js:45`) → effective history ~**37 days**. So even if recaps were being written, `--days 60` could never surface anything older than ~37d. This caps the window for *every* group (kai/alex ~31d, neta ~32d, doug ~37d, kim ~44d) and is itself a contributor to thin groups.

`getEarningsResult`/write-path throws and dedup were checked and are **not** the cause (dedup is per-symbol-per-day; a throw is caught per-invocation).

---

## 4. Script filters ruled out as a false-zero cause

A zero could, in principle, be the shortlist script over-filtering a type that IS written. The workflow ruled this out for all three filters:

- **`wireConflict`/`wireSuperseded`**: only ever stamped under `WIRE_WRITES_ENABLED`, which is **false** in production — so these exclude nothing today.
- **`dataSnapshot` required**: all seven story types write a truthy `dataSnapshot` (verified per storyDoc).
- **body band [400, 4200]**: can trim individual candidates, never a whole type — both Neta bodies (~1.1-3.3k chars) and the others sit inside the band.

So the three zeros are **real production conditions, not script artifacts.** (One caveat the script now surfaces: with the spread cap on, a `considered=0` banner and per-group `note` distinguish "never written" from "cap/scan ran short" — see the shortlist change shipped alongside this doc.)

---

## 5. What the founder's re-run will show

With the spread cap + `considered` banners now in the script, the re-run output is self-diagnosing:

- **neta×econ_recap `considered=0`** → confirms §2/§3-Neta: recap never written (the Sonar `actual` gate). This is the deferred type and the live defect to file.
- **doug×earnings_recap `considered=0`** → confirms §3: the `actual_eps` timing gap.
- **neta×econ_preview small nonzero** → confirms §1's third-group inference: sparse, kept-but-thin, not a defect.
- Any group with **`considered>0, shortlisted=0`** → not expected; would point back at a filter and I'd re-open §4 for that type.

---

## 6. Separate-tasking register (report, do not fix — surfaced by this diagnosis)

- **`econ_recap` Sonar-actuals fragility** (`generate-econ.js:191-194`): the entire recap desk is gated on a search-LLM populating `actual` on a forward-looking calendar. Consider sourcing actuals from the deterministic EODHD/`economicCalendar` feed, or at minimum logging `releasedTier1.length` per run so the silent zero is visible. *High — it silently zeroes a whole reporter-type.*
- **`generate-recap.js:68` UTC-date window**: the `0`-UTC cron firing queries the wrong ET trading day; a dedicated date-boundary fix (ET-aware, per BUILD_RULES §6) is warranted independent of the `actual_eps` timing. *Medium.*
- **`submit-earnings-batch.js:145-159` unbounded dedup**: queries all published `earnings_preview` with `limit(100)` and no time bound; as the collection grows the cap can silently drop legitimate re-preview candidates. *Medium — scaling hazard, not a current zero.*
- **`poll-batch.js` `const results` TDZ shadow** (`:66` vs `:95`): already the founder-authorized N6 fix; re-confirmed live. Corrupts the endpoint's HTTP `batches` response array (caught harmlessly otherwise). *Medium — N6.*
- **preview `dataSnapshot` carries no adapter operands** (`weekHighlight`/`totalEvents`/`highImpactCount`): `econ_preview` exemplars will always show `—` operands, weakening their N2.1 dual-output value even when shortlisted. *Low — expected per the Addendum §2 CIRCULAR classification.*

---

*Read-only diagnosis. No production data was read; every figure is a count of code-permitted behavior. The three zero groups are real; the wiper hypothesis is refuted for story production; the `considered` counts in the founder's re-run confirm the exact split.*
