# LEVELSTORY — RULINGS & AMENDMENTS (SESSION 2)

**Status:** Founder rulings of record for Session 2 (config contract + fetch/normalize layer). Decided; not to be relitigated. Recorded before any code was written, per the Session-2 prompt §2.
**Session:** LevelStory Session 2 — Config Contract + Fetch/Normalize Layer.
**Branch:** `claude/level-study-session2-config-fetcher`, cut from the Session-1 completion tip `87ea275` (fixtures + graded discovery report).
**Precedence for config transcription:** this document → `docs/LEVEL_STUDY_SPEC_V1_1_ADDENDUM_A_CONTEXT_LAYER_V1_1.md` → `docs/LEVEL_INTERACTION_EVENT_STUDY_SPEC_V1_1.md`.

These rulings resolve the open questions Session 1 handed to the founder (range, RKLB disposition, adjustment/synthetic-bar operational policy, earnings point-in-time discipline). They are transcribed here verbatim so the config in `research/level-study/config.js` has a single citable source.

---

## R1 — Range (Option A)

Study window locked at **2023-07-10 → 2026-07-10** (36 months). Holdout: final ~7 months. Warmup: ≥ 550 trading sessions of daily data before 2023-07-10.

## R2 — Universe eligibility rule

Every universe member must have verified daily history ≥ 550 trading sessions before 2023-07-10 (i.e., listed roughly pre-May 2021). HOOD (IPO 2021-07-29) is excluded by this rule. The full universe freeze is a founder deliverable, pending; this session builds at probe scale.

## R3 — RKLB disposition

Dropped. Its pre-de-SPAC (Aug 2021) bars are SPAC-shell prices, not economically RKLB; truncating at de-SPAC leaves it short of the R2 warmup floor. Both gap-prone probe slots (HOOD, RKLB) will be replaced in the universe freeze with pre-2021-listed gap-prone names of the founder's choosing.

## A1 — Adjustment policy (operational form of parent §4.3)

EODHD 5m data is UNADJUSTED for splits (verified: NVDA split window). Ingest applies daily-derived split factors to the 5m grain so all grains share one basis. The standing cross-grain invariant test: **raw daily `close` vs the closing-auction 5m print, same session, tolerance 0.1%** — the exact pairing proven in discovery (84/84 non-split + 8/8 split-window sessions).

## A2 — Synthetic-bar policy: TAG, don't strip

The one-per-session bar with `volume=null`, O=H=L=C is the **closing-auction print** — the authoritative session close. It is tagged (`closingAuction: true`), EXCLUDED from all pattern/range/volume/excursion/hourly-aggregation math, and USED as the session-close price for EOD outcome labels and the cross-grain invariant.

## A3 — Earnings point-in-time guard

The calendar's `actual===null` distinction (scheduled vs reported) reflects CURRENT state only — it does NOT provide point-in-time scheduling history. `sessions_to_next_earnings_actual` remains post_touch/descriptive; the expected-earnings proxy (Addendum §A5.2) remains the only pre_touch forward-earnings feature. Nothing in this session or any later one may treat calendar scheduled-dates as historically known.

---

## Session-2 operating notes derived from the rulings (not new rulings — application record)

- **Probe set for this session (founder-frozen, §4 of the S2 prompt):** AAPL, NVDA, MSFT, KO, PG, JNJ, TSLA, AMD, COIN (equities) + SPY, XLK, XLE, SPHB, SPLV (context) = **14 symbols**. HOOD dropped per R2; RKLB dropped per R3. The full-universe fetch runs only after the founder commits the frozen universe file (including the two gap-prone replacements). The fetcher accepts any symbol list; it fetches only the probe this session.
- **Credential name:** the key is stored in `.env` as `VITE_EODHD_API_KEY` (Session 1 §10 item 6 recorded this; the S2 prompt's `EODHD_API_KEY` label is the variant name). Never printed, logged, or committed.
- **Data isolation:** all fetched data lives under `research/level-study/data/`, which is gitignored before the first fetch. Only code, config, tests, docs, and the small fetch manifest are committed.

*Recorded 2026-07-10 — LevelStory Session 2, Phase 0, step 1.*
