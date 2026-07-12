# LEVELSTORY — RULINGS & AMENDMENTS (SESSION 3)

**Status:** Founder rulings of record for Session 3 (level construction + lineage engine). Decided; not to be relitigated. Recorded before any build code was written, per the Session-3 prompt §2.
**Session:** LevelStory Session 3 — `02-build-levels.js`: point-in-time level registry + stable level lineage.
**Branch:** `claude/level-study-session3-levels-lineage-8v31gp`, cut from `origin/main` tip `9aaef370` (Sessions 1–2 merged: data discovery + config contract + fetch/normalize layer).
**Precedence for config transcription:** this document → `docs/LEVELSTORY_RULINGS_AND_AMENDMENTS_S2.md` → `docs/LEVEL_STUDY_SPEC_V1_1_ADDENDUM_A_CONTEXT_LAYER_V1_1.md` → `docs/LEVEL_INTERACTION_EVENT_STUDY_SPEC_V1_1.md`.

`STUDY_CONFIG_VERSION` remains **1** — all consumers of the values patched here are unbuilt, so this is still the first built configuration, not a knob change (parent header rule).

---

## §A — Founder rulings (S3-R1 … S3-R5)

### S3-R1 — Time-of-day buckets (closes S2 ⚠ flag #6)

`open` 09:30–10:30, `midday` 10:30–14:30, `power` 14:30–16:00, all ET.
Transcribed to `config.features.fingerprint.todBucketEtCutoffs` as ET-minute half-open intervals `[start, end)`: `{ open: [570, 630], midday: [630, 870], power: [870, 960] }`.

### S3-R2 — Auction-gap EOD fallback (F3 ruling)

Sessions missing the closing-auction print use the **last regular 5m bar** (typically 15:55 ET on full days) as session close, tagged `eodSource: 'fallback_1555'` (vs `'auction'`). The cross-grain invariant **exempts fallback sessions explicitly** — the 0.1% tolerance is **never loosened** to accommodate them. Fallback-session counts are a standing report-footer item.
Transcribed to `config.closingAuction.eodFallback`.

### S3-R3 — Half-day rule

Session end is derived **per-session from the data**, never hardcoded 16:00. Half-days are tagged `halfDay: true`; EOD labels use the last regular bar of the actual session. (The S2 normalizer's `earlyClose` session tag is the existing precursor; the `halfDay` tag vocabulary is now the ruling of record.)
Transcribed to `config.session.halfDay`.

### S3-R4 — SPHB/SPLV: daily-grain only (F4 ruling)

SPHB and SPLV are **daily-grain only**. Their 5m is never fetched or referenced; `beta_appetite_20d` is a daily feature.
Transcribed to `config.universe.dailyGrainOnly` and `config.features.market.breadth.betaAppetiteGrain`.

### S3-R5 — sectorMap populated from the frozen universe

`research/level-study/universe_frozen.json` (universeVersion 1, frozen 2026-07-11) exists at the Session-3 gate. `config.universe.sectorMap` is populated from it verbatim (11 symbols) — **data transcription, not a decision**. `config.universe.universeFilePath` updated from the S2 placeholder name to the actual file. Closes the S2 "awaits founder universe freeze" ⚠ flag on `sectorMap`.

---

## §B — Session-3 application choices (S3-C1 … S3-C16) — ⚠ CHOICE register

These are the deterministic conventions `02-build-levels.js` needs where the specs are silent or ambiguous. They are **Session-3 choices, not founder rulings** — each is greppable in `config.js` (`levels.construction`) as `⚠ CHOICE`, and each is listed in the traceability table's ambiguity register for founder review. None loosens a spec invariant; where a choice interacts with an invariant, the conservative direction was taken.

| # | Choice | Value chosen | Why it was a choice | Risk if wrong |
|---|---|---|---|---|
| S3-C1 | Volume basis for VWAP/centroid weights | raw volume ÷ adjFactor | A1 fixes the *price* basis; volume basis across a split is unstated. Post-split share counts are ~f× pre-split; V/f puts weights on one comparable basis. | Tiny weight drift on dividend factors; only affects centroid/AVWAP weighting, symmetric across both harness paths. |
| S3-C2 | AVWAP price input | typical price (H+L+C)/3 | Parent §5.1 names "anchored VWAP" without the price input. HLC3 is the standard convention. | AVWAP level offsets of a few bp vs a close-only convention; consistent everywhere. |
| S3-C3 | Fractal comparison | strict (`>` all k each side) | Parent §5.1 says "fractal pivots, k=3 bars each side" without tie handling. Strict is the classical Bill Williams definition and makes flat series pivot-free (clean tests). | Rare equal-high double tops produce no pivot; both harness paths agree. |
| S3-C4 | Structural clustering algorithm | ascending price, greedy join while within `clusterPct` of the running volume-weighted centroid | Parent §5.1 gives radius (0.5%) and centroid (volume-weighted) but no algorithm. Greedy-ascending is order-deterministic. | Cluster boundaries could differ from another algorithm; deterministic + point-in-time either way. |
| S3-C5 | Confluence grouping algorithm | ascending price, greedy join while within `alignPct` of the running unweighted mean centroid | Parent §5.1: "families align when within 0.5% of each other" — no algorithm; pivots have no volume, so cross-family weighting is undefined. | Same as S3-C4. |
| S3-C6 | Composite availability (clusters & snapshots) | max of members' formation/firstKnown/firstTradable | §5.3 defines availability per source structure; a cluster/snapshot is a composite. Latest-member is the conservative direction — a composite is never available earlier than its newest constituent. | Slightly late availability for old zones whose newest touch is recent; never lookahead. |
| S3-C7 | **Calendar firstTradableDate = the session it applies to** | same-session tradable | Parent §5.3 says calendar `firstKnownDate` = "the session they apply to" AND the universal rule says `firstTradable = firstKnown + 1`. Applied literally together, a daily pivot for session D becomes tradable on D+1 — when it no longer exists (D+1 has its own pivots). That bars the calendar family from ever being referenced, contradicting §5.1 making it a first-class confluence family. Calendar levels are derived wholly from prior completed bars, so the +1 offset's purpose ("known at prior close") is already satisfied. | **The one materially interpretive choice this session.** If the founder rules the literal +1 reading was intended, calendar levels drop out of event referencing entirely; one-line config flip (`calendarTradableSameSession: false`) + rebuild. Flagged for explicit founder review. |
| S3-C8 | Snapshot side rule | centroid ≤ D−1 adjusted close → support; else resistance | §5.4 says matching ignores side but never defines side. D−1 close is the only point-in-time reference price at registry-build time. Tie → support (deterministic). | At-the-money zones get a side by convention; roles can flip next session by design. |
| S3-C9 | Merge/split %-distance denominator | pair midpoint | "within 0.4%" / "separate by >1.5%" don't state the base. Midpoint is symmetric (A vs B == B vs A). | Sub-bp threshold shifts vs min/max denominators. |
| S3-C10 | Family observed centroid (anchor-EMA input) | unweighted mean of matched snapshot centroids | §5.4's EMA is defined over "matched snapshot centroids"; with >1 matched snapshot per session (required for split detection to exist) the combination is unstated. | Anchor drift path differs slightly in multi-snapshot sessions; deterministic. |
| S3-C11 | Same-session founded family matchable | yes | The ascending-price pass must decide whether a family founded earlier in the pass is a candidate for later snapshots. "Yes" is simpler and keeps one rule. | Two nearby new zones may share a family one session earlier than otherwise; merge/split rules correct it. |
| S3-C12 | Session role side source | nearest matched snapshot, distance to pre-update anchor | With >1 matched snapshot a family can straddle price; a single session side is needed for the role log. | Only affects straddling sessions. |
| S3-C13 | Split execution | nearest-to-anchor snapshot keeps the elder id; each other matched snapshot founds a branch (`splitFrom`) | §5.4: "the elder keeps the id; the new branch gets a fresh id" — which physical branch *is* the elder is unstated. Nearest-to-anchor is the structure the anchor has been tracking. | Branch identity assignment; deterministic. |
| S3-C14 | Split needs ≥2 matched snapshots to execute | yes | Confluence chaining can produce a single snapshot whose members span >1.5%; a single snapshot cannot be partitioned. The 5-session counter still runs; execution waits for ≥2 snapshots. | A wide single-snapshot family stays whole until it visibly separates; conservative. |
| S3-C15 | Merge state transfer | absorbed family's matchHistory + touchHistory carried to survivor (entries tagged with source familyId); survivor keeps its own anchor & roleLog; `zeroSupportRun = min(both)`; absorbed record keeps `mergedInto`, its own roleLog, and stops being matchable | §5.4: "in-flight episode state transfers to the survivor" — episode state doesn't exist until Session 4; this fixes the S3-visible state transfer and leaves the hook for S4. | S4 inherits the survivor-carry convention; revisit at S4 if episode state needs more. |
| S3-C16 | Weekly pivot week definition | ISO Monday-keyed weeks; prior completed week = latest Monday-key strictly before the session's week, aggregated H/L/last-C | Parent §5.1: "weekly pivots from prior completed week" — calendar convention unstated. | Holiday-shortened weeks still count as completed weeks; consistent both harness paths. |

**Also recorded (not a choice):** level construction runs on the **adjusted daily basis** (`levels.construction.priceBasis`) — this is the A1 one-basis rule applied to Stage 1: raw OHLC × per-session `adjFactor`, identical to the basis the 5m grain is placed on. Without it, a split (NVDA 2024-06, 10:1) would teleport every level −90% and shred lineage.

---

## §C — Session-3 operating notes (application record, not new rulings)

- **Phase A / Phase B split:** `research/level-study/data/` is **absent** in this session's environment → Phase B (real-data run + sanity stats) is **SKIPPED** per the session prompt §0.2/§4; the founder runs it locally via `npm run levels`. Phase A (builder + synthetic/fixture tests) is complete in this session.
- **Universe file present** → Phase B scope, when the founder runs it, is the frozen universe's 11 study symbols (context symbols host no levels — they are not study subjects per the universe file note).
- **The governing integrity rule** (parent §5.2, S3 prompt §3.1): registry state for session D is built from data through **D−1 close only**. The incremental day-by-day forward engine is permitted **only because** the equivalence harness (incremental ≡ from-scratch truncated rebuild on sampled (symbol, day) pairs) is a required, passing test. If they ever disagree, **the truncated rebuild is the definition of correct**.
- Artifacts (`data/levels/`) are gitignored (covered by the existing `research/level-study/data/` ignore rule) and never committed.
- No network calls were needed or made this session; no credentials touched.

*Recorded 2026-07-12 — LevelStory Session 3, Phase 0.*
