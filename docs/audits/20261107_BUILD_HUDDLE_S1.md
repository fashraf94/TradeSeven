# Build report — Huddle S1 (the huddle, dark)

**Smoke preview (never merge, flag ON):** https://trade-seven-draa7u56u-fais-projects-bc179554.vercel.app — branch `claude/huddle-s1-smoke` @ `3f13111f` (this branch's `28d2baf5` plus one commit flipping the flag). Set `HUDDLE_PLAYER_UIDS` to your own uid there first (§14).

| | |
|---|---|
| Build prompt | "BUILD — Huddle S1 (the huddle, dark)", issued Nov 7, 2026 |
| Specs | concept V1.2; build spec V1.1 with Amendments A, B and C V1.2 (precedence C > B > A > V1.1), all committed byte-identical in this PR |
| Branch | `claude/huddle-s1` (pushed from the app's worktree branch `claude/huddle-s1-build-852f0a` by refspec) · draft PR into `main` |
| Base | `main` @ `d503dd07` (unchanged through the build: no merge needed) |
| Head | code `563e0550`; this report and the review record are the one docs-only commit on top |
| Built by | Claude Code (Opus 5.5), Nov 7, 2026 |

## 1. In plain terms

- Built the Huddle, switched off: each weekday morning a short spoken brief for each player from their own games and watchlist, with a game plan they can confirm, edit or skip; a confirmed plan reaches their agent's games as an instruction, and the hub shows what happened from receipts.
- With the switch off, the only new thing production does is write one small "the brief ran" marker each morning. Nothing new shows on the hub, every new route answers "not found", the new worker cron exits at once.
- No protected trading file was edited.
- Tried on the founder's own data, read only: the job ran end to end and wrote two real scripts; a third was not generated because both first answers needed one retry and the four allowed model calls ran out.
- The voice could not be checked: the ElevenLabs key saved on this machine is the key's ID, not the key. The huddle fell back to text, as designed.
- A three-part review found nothing wrong while the switch is off. Of 38 findings, 36 held up under a second checker; most would only show once the switch is on (the worst: audio that could keep playing after the sheet closed, a next-step card whose button opened a different game, and unchecked model text on the name cards). 26 are fixed, each with a test that fails on the old code; five need a decision; the rest are reported.
- The full Linux test suite, lint and the production build pass.
- Before the switch can be turned on: a working ElevenLabs key and a voice, one recorded voice response, and five decisions listed at the end.

## 2. Verdict by spec section

| Section | Verdict | Where / note |
|---|---|---|
| V1.1 §1 Scope, §2 Rulings | Built as ruled | — |
| V1.1 §3.1 huddle record | Built | `api/_utils/huddle/records.js`, `job.js` (immutable once ready, A §A2) |
| V1.1 §3.2 plan, C §C2 origin | Built | `planTemplates.js`, `planRecord.js`; every item carries `origin: huddle` |
| V1.1 §3.3 queue, A §A2, B §B4 | Built | `queue.js` (generation-owned claims, reclaim order, attempt cap); emulator rows |
| V1.1 §3.4 brief record | Held — unchanged | — |
| V1.1 §3.5 per-symbol cache → C §C1 | Built as C1's shared evidence record | `api/_utils/evidence/symbolDayEvidence.js` |
| V1.1 §3.6 run marker | Built | `worker.js` `markRun` (the one flag-off write) |
| V1.1 §4.1–§4.4 plan.v1 | Built | `planTemplates.js`: closed templates, 12 drop reasons, ±25 % band, 500-character cap, stable revision hash |
| V1.1 §4.5 filing shape | Built, moved under a precedent | the slot is built with existing keys only; `textVersion` follows the cockpit precedent (RF-3) |
| V1.1 §5.1 enqueue, A §A3, A §A10 | Built | brief handler writes the marker; flag on, enqueue + an in-handler drain that claims nothing at 60 s (RF-2); the worker recovers an unfinished enqueue |
| V1.1 §5.2 shared layer, C §C11 | Built | `sharedLayer.js`: tape, macro, one earnings call; earnings read from the capture's keys |
| V1.1 §5.3 worker, A §A6, B §B3 | Built | `huddle-worker` `*/2 12-21 * * 1-5`; 4 in flight, 130 s reserve; per-job 120 s budget |
| V1.1 §5.4 active players | Built | `players.js` |
| V1.1 §6 routes, A §A1 | Built | `api/huddle/{confirm,skip,status,playback-token,event}.js`, `audio/[token].js`; 404 first while off |
| V1.1 §6.1 apply module, B §B1 | Built | `applyPlan.js`: filing and receipt in ONE transaction (emulator row) |
| V1.1 §6.2 post-deploy hook | Superseded by C §C7 — not built | — |
| V1.1 §6.3 sweep, A §A5, B §B1–B2 | Built | `sweep.js`, one call in `agent-evaluate.js` (pinned) |
| V1.1 §6.4 status, A §A4, C §C3 | Built | receipts only; review fixes L2-4, L2-13 |
| V1.1 §6.5 reconcile, A §A9 | Built | review fixes L1-3, L2-6 |
| V1.1 §7 editorial rules, C §C5, C §C12 | Built | `docs/design/SHADOW_VOICE_RULES_V1.md`; system prompt; forbidden-terms tests; no volume anywhere |
| V1.1 §8 hub, C §C4, §C6–§C8, §C14 | Built; sheet body placement moved under C8 (RF-4) | hub contract, §7 below |
| V1.1 §9 verification | Done in part | model calls ✓; speech ✗ (key is an ID); offline concurrency tests ✓; unit ✓; Linux suite ✓; smoke = founder |
| V1.1 §10 build mechanics | Built | one branch, draft PR, this report (named for the Nov 7 prompt), env names in `.env.example` |
| V1.1 §11 fence and pin manifest | Held, with three listed differences | §6 below |
| V1.1 §12 founder questions | Carried into §11 below | — |
| V1.1 §13 → A §A10 darkness | Held | review lens L1 traced every path |
| A §A7 evidence references | Built; extended to name reads (L2-3) | `scriptPrompt.js` `validateScript` |
| A §A8 query manifest | Built | `docs/specs/huddle-s1-queries.md`; no composite index |
| A §A11, B §B5 tests | Built | emulator suites `test/rules/huddle*.rules.mjs` |
| C §C9 checks and reporting | This report; the hub seen flag-on at 360 px and desktop in a harness; founder smoke | §7 |
| C §C10 pack items | Built | `evidence/packItem.js`; ids unique per fact (RF-12) |
| C §C13 `/news` capture | Built — 2 calls | §5 |
| C §C15 archetype binding | Built to the letter; two dead ends for a ruling (L1-10, L2-2) | `confirmPlan.js`, `applyRules.js` |

**The archetype field confirm reads as "equipped"** (C §C15): the ranked agent's `archetype` — the `agents` document with `ownerId == uid` that is neither `isTrainingClone` nor `isCasualClone` — read inside the confirm transaction (`api/_utils/huddle/confirmPlan.js:50-57`, `:82-91`); the gather step reads the same agent (`gather.js`). The hub's own agent reader excludes the same clones (`src/services/agentService.js:20-30`), so the Deploy card's reconfirm line compares like with like. A battle's archetype is the one deploy froze into `agentContext.archetype` (`api/_utils/agentBattleService.js:193`, fenced, read only).

## 3. Files changed, with reasons

109 files, +9,217 / −50, 27 commits (one per checkpoint, then the verification, final-check and review fixes).

- **Governing docs (new):** the concept, the spec and its three amendments (byte-identical copies); `docs/design/SHADOW_VOICE_RULES_V1.md` (C5's rulebook); `docs/specs/COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2_AMENDMENT_D_20261101.md` (C6's hub-side rulings); `docs/specs/huddle-s1-queries.md` (A8); this report and its review record. **Edited:** `docs/README.md` (a Huddle section), `docs/BUILD_RULES.md` §6 (cron budget 44 → 45).
- **The flag:** `src/config/huddleFlags.js` (its own module, so flag-off folds away and the entry chunk does not move) and its pin test; `src/config/flagPinGuard.test.js` (module registered, dark-by-design entry).
- **Server, new — `api/_utils/huddle/`:** `records.js` (names, keys, ET dates), `gate.js`, `dissentTable.js`, `events.js` (event ids, ET clock), `planTemplates.js`, `planRecord.js`, `applyRules.js` (dispositions, the slot), `applyPlan.js` (the one-transaction filing, reconcile, retire), `confirmPlan.js`, `playback.js`, `audioStore.js`, `routeKit.js`, `queue.js`, `players.js`, `sharedLayer.js`, `gather.js`, `scriptPrompt.js` (Sonnet, structured outputs), `speech.js` (ElevenLabs with timestamps), `job.js`, `worker.js`, `sweep.js`.
- **Server, new — `api/_utils/evidence/`:** `earnings.js`, `eodhdNews.js`, `fantasyTimesStories.js`, `newsfilter.js` (always skipped: no capture), `lastClose.js`, `packItem.js`, `symbolDayEvidence.js`; the capture fixture `api/_utils/__fixtures__/eodhdNewsCapture.js`.
- **Routes and cron, new:** `api/huddle/confirm.js`, `skip.js`, `status.js`, `playback-token.js`, `event.js`, `audio/[token].js`; `api/cron/huddle-worker.js`; `vercel.json` (+1 cron).
- **Server, edited:** `api/cron/compute-daily-regime-brief.js` (the marker after the brief stage; flag on, enqueue + drain); `api/cron/agent-evaluate.js` (one sweep call before the governing preset, one settle-reconcile call; both return at once while off); `firestore.rules` (owner read of the record; three server-only collections); `api/_utils/compositionProtectedStoresScan.js` + allowlist (the four collections and their write sites); `api/_utils/__fixtures__/promptHonestyRegistry.js` (the plan's slot text joins the sweep).
- **Hub, new:** `HuddleChip.jsx`, `HuddleSheet.jsx`, `hub/huddleView.js`, `src/components/Huddle/HuddleSheetBody.jsx`, `src/hooks/useHuddleToday.js`, `src/hooks/useHuddleHistory.js`, `src/services/huddleService.js`.
- **Hub, edited:** `CommandCenterHub.jsx` (the readers, the chip, the sheet, the next action's Huddle rule and its actions, Partnership's summary), `hub/nextAction.js`, `hub/activityRows.js`, `hub/hubCopy.js` (a `huddle` block; no existing string changed), `hub/useHubSheets.js`, `hub/useHubReaders.js`, `panels/PartnershipPanel.jsx`, `panels/AreaPanel.jsx`, `sections/DeploySection.jsx`, `PhoneTabs.jsx`.
- **Tests, new:** 19 unit/jsdom files and 5 emulator files (§8). **Tests and guards edited** to pin new state: §6.
- **`.env.example`:** `HUDDLE_SHADOW_VOICE_ID` (placeholder), `NEWSFILTER_API_KEY` (optional), and `HUDDLE_PLAYER_UIDS` (optional; added so the founder's smoke makes one huddle, not one per active player — §14).
## 4. Verification calls (build prompt §1 rule 4; spec V1.1 §9)

**Spend, exactly as allowed, and no more.** EODHD `/news`: 2 of 2 (the capture, §5 below). Sonnet: 4 of 4. ElevenLabs: 3 of 3. No pre-market probe. No other paid call: the verification run stubbed the `/news` fetcher (its budget went to the capture), stubbed the earnings calendar (one unlisted EODHD call), and read last closes from the cached daily bars instead of refreshing them (a refresh is an EODHD `/eod` call plus a production cache write). Keys were read from `.env.local` by name; no value, uid or playback token was printed or written.

**The fixture.** The founder's own data, read READ-ONLY from production with the Admin SDK (no set, update, delete or transaction was issued; the founder uid was taken from the archived cockpit dump and replaced by `FOUNDER_UID` in every saved file, with an assertion that none was left). Then seeded into a private Firestore emulator (port 8189, project `demo-tradeseven-rules`) and run through the REAL job (`runHuddleJob`: mark generating → gather → script → validate → plan → speech → publish), with the model, speech and storage calls counted by a wrapper outside the SDK (the SDK already has `maxRetries: 0`) and the audio store writing to the scratchpad instead of GCS (`GCS_CREDENTIALS` never loaded). Three runs were planned:

| Run | ET date | What it is | Composition |
|---|---|---|---|
| A | Mon Nov 9, 2026 (prior session Fri Nov 6) | The founder's account exactly as read on Sat Nov 7 | Ranked agent: Diversifier, equipped watchlist of 10 names (ADP, CAT, CSX, ETN, FDX, GEV, PWR, RKLB, UNP, UPS); no active game (a Saturday); the real market context (Friday's close); 1 FantasyTimes story since Friday's close (a sector column, matches no name); cached bars end Oct 30, so no prior close (production would refresh them) |
| B | Mon Nov 2, 2026 (prior session Fri Oct 30) | The founder's real Nov 2 BaggerBomb game, as it stood before the open | Same ranked agent and watchlist; the game seeded `active` with its pre-open portfolio (`agentContext.initialPortfolio`: CCI, LLY star; ACN, ZS core; CVX, UNP, BTC support — the stored `portfolio` carries the day's 3 swaps) and its deploy opener only; real Oct 30 closes from the cached bars; the 6 FantasyTimes stories published between Oct 30's close and 8:30 AM ET Nov 2; the tape OFF (production's market context is Nov 6's, and would have narrated a false "Friday"); the macro calendar's 10:00 AM ET ISM print |
| C | as B | B with ONE disclosed alteration | The ranked agent's archetype set to Trend Follower (`momentum_chaser`, the founder's casual clone's) — **not run**: both A and B regenerated once, so the 4-call budget was spent and the counter refused C's first call (`script_budget_exhausted`) |

**So two scripts were generated, not three** (the prompt asked for three). Both are verbatim below. The first answers that triggered the regenerations were not kept (the job discards them); the regeneration notes were: Run A — `tape: too_long` (over the 380-character cap); Run B — `tickers outside the universe: mentioned:ISM, said:UTC` (the ISM half is fixed by RF-14; UTC rightly fails).

### Run A — published (Mon Nov 9; 479 characters spoken; 4 beats; no drops)

| Beat | Source | Chars (cap) | Sentences and their `evidenceIds` |
|---|---|---|---|
| tape | model | 128 (380) | "Friday's session closed with SPY up 0.66 percent and QQQ up 1.8 percent, and the earnings calendar was not checked this morning." → `88394a549898` (source_status: earnings calendar not checked) |
| names | model | 175 (950) | "Prior closes for ADP, CAT and CSX are not available this morning." → `43f340d0cbf1`, `484cb5f1902c`, `334ac8e5d01b` (close, unavailable ×3) · "EODHD news and newsfilter were also not checked, so we found nothing on your names in the sources we checked." → `6b8c5333f723`, `96e89c1492d1` (source_status ×2) |
| armor | model | 113 (320) | "As a Diversifier, I read a morning with no data as a reason to keep the bets spread and not lean on any one name." → none |
| plan | code | 57 | "Here's what I'd carry in today. One line: no swaps today." |

Plan: no stances; one line `NO_SWAPS_TODAY`; no drops; no dissent. Names: ADP, CAT, CSX, each "No prior close this morning, so no read." Transcript as published:

```
The tape
Friday's session closed with SPY up 0.66 percent and QQQ up 1.8 percent, and the earnings calendar was not checked this morning. [earnings]

Your names
Prior closes for ADP, CAT and CSX are not available this morning. [EODHD daily bars] EODHD news and newsfilter were also not checked, so we found nothing on your names in the sources we checked. [eodhd; newsfilter]

The armor's take
As a Diversifier, I read a morning with no data as a reason to keep the bets spread and not lean on any one name.

The game plan
Here's what I'd carry in today. One line: no swaps today.
```

### Run B — published (Mon Nov 2; 899 characters spoken; 4 beats; no drops)

| Beat | Source | Chars (cap) | Sentences and their `evidenceIds` |
|---|---|---|---|
| tape | model | 266 (380) | "Happy Monday. The market context was not checked this morning, so I have no picture of the prior session to give you." → `f8b0e56d3bf3` (source_status) · "The earnings calendar was not checked either, so I can't say how many reports are listed today. The 10:00 AM ET ISM manufacturing data is scheduled." → `a526506f6906` (source_status), `c910240529d8` (event) |
| names | model | 341 (950) | "FantasyTimes reported on October 30 that Chevron beat with a 10.5% EPS surprise, and that is the source's claim." → `c39af0f877af` (headline) · "CVX closed at 235.52 on October 30, the prior session's close, and it is your support name." → `2f5e1665ce97` (close), `f979e41853c8` (holding) · "On LLY, your star holding, we found nothing new in the sources we checked. EODHD news and newsfilter were both unavailable this morning." → `93930eff5b20` (holding), `cf65acf00194`, `6acad73db510` (source_status) |
| armor | model | 170 (320) | "As a Diversifier, you spread the bets so no single one can sink you, and with news sources down I'd keep the book balanced across your names and not lean on one headline." → `cf65acf00194`, `6acad73db510` (source_status) |
| plan | code | 116 | "Here's what I'd carry in today: hold CVX; hold LLY. One line: no adds before the 10:00 AM ET ISM manufacturing data." |

Plan: `HOLD CVX`, `HOLD LLY`; line `NO_ADDS_BEFORE macro:ism_manufacturing:2026-11-02:1000`; every item `origin: huddle`; no drops; no dissent (no CHASE was proposed, so the Diversifier row did not fire). Names: CVX ("FantasyTimes reported a 10.5% EPS surprise for Chevron on October 30, which is a source's claim and not something I can confirm. It sits in your support slot, so I read it as ballast and nothing more." → headline, holding), LLY ("LLY is a star holding and closed at 1417.54 on October 30, the prior session's close. We found nothing new on it in the sources we checked." → holding, close). Event strip: 1 listed (the ISM print), 0 of 0 earnings. Transcript as published:

```
The tape
Happy Monday. The market context was not checked this morning, so I have no picture of the prior session to give you. [marketContext] The earnings calendar was not checked either, so I can't say how many reports are listed today. The 10:00 AM ET ISM manufacturing data is scheduled. [earnings; macro calendar]

Your names
FantasyTimes reported on October 30 that Chevron beat with a 10.5% EPS surprise, and that is the source's claim. [FantasyTimes] CVX closed at 235.52 on October 30, the prior session's close, and it is your support name. [EODHD daily bars; your game] On LLY, your star holding, we found nothing new in the sources we checked. EODHD news and newsfilter were both unavailable this morning. [your game; eodhd; newsfilter]

The armor's take
As a Diversifier, you spread the bets so no single one can sink you, and with news sources down I'd keep the book balanced across your names and not lean on one headline. [eodhd; newsfilter]

The game plan
Here's what I'd carry in today: hold CVX; hold LLY. One line: no adds before the 10:00 AM ET ISM manufacturing data.
```

**For Fable's script review** (not changed here): Run B leads its names beat with CVX (support, 10 %) ahead of LLY and CCI (star, 20 % each) because CVX had the only headline — the prompt says biggest exposure first (RF-18); Run B calls the two skipped news sources "unavailable" and "down" when they were not checked (RF-17); a tape sentence's SPY/QQQ figures have no pack item to cite (RF-16); Run A's armor beat speaks as "I" in the archetype's name.

### Model calls (each logged)

| # | Run | `stop_reason` | Input / output tokens | Time | Result |
|---|---|---|---|---|---|
| 1 | A | `end_turn` | 3,908 / 811 | 7.6 s | valid JSON; failed `tape: too_long` → regenerate |
| 2 | A | `end_turn` | 3,948 / 550 | 4.3 s | clean → published |
| 3 | B | `end_turn` | 4,714 / 1,004 | 7.0 s | valid JSON; failed `mentioned:ISM, said:UTC` → regenerate |
| 4 | B | `end_turn` | 4,771 / 843 | 5.9 s | clean → published |
| — | C | — | — | — | refused by the counter (`budget_exhausted`); nothing sent |

Model `claude-sonnet-5-5`, structured outputs (`output_config.format` json_schema, closed), effort low, `max_tokens` 8000, no refusal, no cut-off.

### Speech calls and the alignment check

| # | What | Result |
|---|---|---|
| 1 | Run A's joined beats (479 chars), with-timestamps, the academy placeholder voice `pNInz6obpgDQGcFmaJgB` (api/academy/generate-audio.js:14) | HTTP 400, body discarded by the helper at the time |
| 2 | Run B's joined beats (899 chars) | HTTP 400, body discarded |
| 3 | Run B's beats again, after the helper learned to keep the error code (RF-13) | HTTP 400 `api_key_id_used_as_api_key` |

The `ELEVENLABS_API_KEY` value in the local `.env.local` is the key's **ID**, not the key. So no audio came back, no `alignment` was seen, and **the alignment check is not verified live**. Both runs published transcript-only with `speech:http_400` recorded in `generation.sourceFailures` — the designed fallback, observed working. What is verified: the beat-boundary computation on a synthetic alignment (`api/_utils/huddle/speech.test.js`: start = first character's start time, end = last character's end time; a length mismatch yields no timings rather than wrong ones).

### Measured per-job times (emulator; production adds network)

| Run | Gather | Script (2 calls) | Speech | Store | Total |
|---|---|---|---|---|---|
| A | 984 ms | 11,900 ms | 305 ms (400) | — | 13,295 ms |
| B | 762 ms | 12,922 ms | 135 ms (400) | — | 13,888 ms |

Gather here read an emulator and no vendor; in production it adds up to 8 `/news` calls and 8 daily-bar refreshes per player (shared per symbol per morning through `symbolDayEvidence`), and speech adds the ElevenLabs time for ~900 characters. Against the job's 120 s budget and the worker's 130 s start reserve, the model time (two calls, ~12–13 s) is the dominant measured cost.
## 5. The dissent table, the `/news` capture, and the query manifest

### The dissent table (founder question 1 — ratify)

One row per archetype, a code constant in `api/_utils/huddle/dissentTable.js` (zero imports; `dissentTable.test.js` pins its keys equal to the fenced `VALID_ARCHETYPES`). Every row moves a stance toward WATCH, never toward more risk. An archetype with no row fails closed: the plan is still proposed, but confirm answers `archetype_unsupported` and nothing is filed.

| Archetype (id) | Will not carry | Carries instead | The reason the plan card shows |
|---|---|---|---|
| Trend Follower (`momentum_chaser`) | FADE | WATCH | A trend follower does not lean against a move, so it watches this name instead. |
| Contrarian (`contrarian`) | CHASE | WATCH | A contrarian does not chase a crowded move, so it watches this name instead. |
| Diversifier (`diversifier`) | CHASE | WATCH | A diversifier does not press one name on a move, so it watches this name instead. |
| Speculator (`degen`) | FADE | WATCH | A speculator rides a swing rather than fading it, so it watches this name instead. |
| Fundamental Investor (`analyst`) | CHASE | WATCH | A fundamental investor does not buy a price move on its own, so it watches this name instead. |
| Capital Preserver (`guardian`) | CHASE | WATCH | A capital preserver protects the downside before chasing upside, so it watches this name instead. |

In the verification run no row fired: neither script proposed a CHASE or FADE (Run C, the Trend Follower variant, was not run — budget).

### The EODHD `/news` capture (C13) — 2 calls, Sat Nov 7 2026, 20:23 UTC

Committed as `api/_utils/__fixtures__/eodhdNewsCapture.js`, token stripped (it was only ever in the request URL, which is not stored). Calls: `/news?s=AAPL.US&limit=3` and `/news?s=PFE.US&limit=3` (PFE chosen as the likeliest to carry a press-wire item; it carried none).
- Exactly **7 keys** per item: `date, title, content, link, symbols, tags, sentiment`.
- `date`: ISO 8601 with an explicit `+00:00` (UTC).
- `link`: present on every item, absolute https (finance.yahoo.com, seekingalpha.com) — C1's required url holds.
- `content`: present (3,699–7,866 characters); truncated to 240 in the fixture, with `contentLength` kept.
- `symbols`: present, EODHD codes incl. non-US listings and indices. **An item tagged with a symbol is often about another company** (all three AAPL items are about MRVL, GIL and CSCO), so the fetcher keeps an item only when its title names the ticker or it lists at most two US names.
- **No item id** (C1: `newsId` is derived from the normalized url). **No `source` key**: `api/news/stock.js:65` reads `item.source` and always gets its `'Unknown'` fallback (out of scope; reported).
- **Contradiction with C1: none.** Not proven: a press-wire item, so the press-wire host list in `api/_utils/evidence/eodhdNews.js` is unexercised by real data.
- The fetcher reads only `raw.date`, `raw.link`, `raw.symbols`, `raw.title` (pinned by `api/_utils/evidence/evidence.test.js`); earnings reads only the nine keys of the committed earnings capture (C11; `earnings.test.js`).

### Queries and indexes (A8) — `docs/specs/huddle-s1-queries.md`

| # | Where | Collection | Shape | Composite? |
|---|---|---|---|---|
| Q-A1 | `applyPlan.js` `activeBattleIdsOf`; `gather.js` | `agentBattles` | `ownerId ==`, `status ==` | No (equality only) |
| Q-G1 | `confirmPlan.js` (in the confirm transaction), `gather.js` | `agents` | `ownerId ==` | No |
| Q-R2 | `applyPlan.js` `findHeardTick` | `agentBattles/{id}/ticks` | `capturedAt >=` + `orderBy capturedAt`, limit 40 | No (one field; `controls` is index-exempt, so "heard" is tested in memory — RF-7) |
| Q-W1/W2/W3 | `queue.js` | `huddleQueue` | `etDate ==` + `status ==` / `reconcile ==` | No (equality only) |
| Q-P1/P2/P3 | `players.js` | `agentBattles`, `agents` | single-field `status ==`, `completedAt >=`, `lastDeployedAt >=` | No |
| Q-E2 | `evidence/fantasyTimesStories.js` | `fantasyTimesStories` | `publishedAt >=` + `orderBy publishedAt desc`, limit 300; tickers in memory | No (deliberately not `fetchRecentNews`'s array-contains + range, which needs a composite the manifest lacks — RF-1) |

**Result: no composite index needed; `firestore.indexes.json` unchanged.** The verification run exercised Q-A1, Q-G1, Q-E2 and the queue queries against the emulator, and Q-A1 / Q-G1 / Q-E2's shapes read-only against production (the founder fixture read).
## 6. Every pin, golden, baseline, allowlist, NAMED and copy-guard entry touched — and the test that required it

| Entry | File:place | Required by | What changed |
|---|---|---|---|
| The flag's value pin | `src/config/huddleFlags.test.js` (new) | `src/config/flagPinGuard.test.js` (every flag carries a `// Pinned by:` pointer it keeps honest) | `DRB_HUDDLE_ENABLED` pinned `false` |
| Flag-source module registration | `src/config/flagPinGuard.test.js` `FLAG_SOURCE_MODULES` | BUILD_RULES §2 (a new flag-source module must be registered or its pins are unguarded) | `+ 'src/config/huddleFlags.js'` |
| Dark-by-design entry | `src/config/flagPinGuard.test.js` `DARK_BY_DESIGN` | the same guard's intent-aware message for a deliberately dark flag | `+ DRB_HUDDLE_ENABLED` with its runway note |
| Cron count 44 → 45 | `api/agent/research.dark.test.js:141`, `api/cron/agent-evaluate.measuredFollowup.test.js:188`, `api/cron/compute-index-intelligence.axes.test.js:123` | each pins `vercel.json`'s cron count | 45 (the third found by the Linux suite, RF-9) |
| Cron budget line | `docs/BUILD_RULES.md` §6 | BUILD_RULES §6 (the count is written down with its authority) | 45/100, `huddle-worker` `*/2 12-21 * * 1-5` (B §B3's window), its authority |
| Cron entry | `vercel.json` | spec V1.1 §5.3 as amended by B §B3 | `+ /api/cron/huddle-worker` |
| Protected collections | `api/_utils/compositionProtectedStoresScan.js` `PROTECTED_COLLECTIONS` | spec V1.1 §11 ("compositionProtectedStoresScan.js list + allowlist keys"); `api/_utils/compositionProtectedStores.scan.test.js` | `+ huddles, huddleQueue, symbolDayEvidence, huddleRuns` |
| Protected-store write sites | `api/_utils/compositionProtectedStoresAllowlist.json` | `compositionProtectedStores.scan.test.js` (every counted write site needs its key) | 25 Huddle keys + `_notes_huddle_s1` (HUMAN REVIEW note). Two came from the review: `worker.js::markRun::set::huddleRuns` (L1-5: the flag-off marker write was not counted) and `queue.js::markReconciled::update::huddleQueue` (L1-3) |
| Brief handler rows | `api/cron/compute-daily-regime-brief.test.js` | its rows asserted "no Firestore write" on skip paths; the marker is now a write | 7 `not.toHaveBeenCalled` → `briefWrites()` equals `[]` (the brief's own writes, the marker excluded); 4 new marker rows |
| Sweep placement pins | `api/cron/agent-evaluate.tickStamps.pins.test.js` | spec V1.1 §11 ("one helper call; new pin row") | new describe: the sweep call's exact place, the settle call's exact place, and a flag-off twin |
| Firestore rules | `firestore.rules` + `test/rules/huddleDenials.rules.mjs` | spec V1.1 §3 / §11 | owner read of `huddles/{uid}/days/{etDate}`; the other three server-only |
| Mount guard: permitted terminals | `src/components/CommandCenter/commandCenterHub.mount.guard.test.js` `PERMITTED_TERMINALS` | C7 ("pinned by the mount guard's permitted map") | `+ src/config/huddleFlags.js, src/hooks/useHuddleToday.js, src/hooks/useHuddleHistory.js, src/components/Huddle/HuddleSheetBody.jsx` |
| Mount guard: NAMED | same file, `NAMED` | C7 ("and NAMED list") | `+ '/config/huddleFlags': ['DRB_HUDDLE_ENABLED'], '/hooks/useHuddleToday': ['default'], '/hooks/useHuddleHistory': ['default'], '/Huddle/HuddleSheetBody': ['default']` |
| Mount guard: new rows | same file | C7 | single service import per reader and the body; no hub file imports the service; the provider walk reaches no Huddle file |
| Activity guard manifest | `src/components/CommandCenter/commandCenterHub.activity.guard.test.js` | C7 and C8 ("every listener in the activity guard manifest") | `HUDDLE_TODAY`, `HUDDLE_HISTORY`, `HUDDLE_BODY` + a plant row. Review L3-4 / L3-9 changed `HUDDLE_BODY` (three effects and one microtask: the unmount stop moved to the audio element's ref cleanup) and replaced its text-match stop assertions with behaviour rows in `Huddle.jsdom.test.jsx` |
| Copy guard | `hubCopy.guard.test.js` | C14 | **unchanged**; it reads the new `huddle` block whole. Added beside it: `hubCopy.huddle.guard.test.js` (the voice rules' patterns over the block, the receipt words pinned) |
| Motion guard list + baseline | `src/theme/motion.guard.test.js` `GUARDED_FILES`, `src/theme/motionGuardBaseline.json` | `motion.guard.test.js` "every file under src/components/CommandCenter/ is on this list (hazard 34)" — failed on the Linux full suite at `6a5cd38c` | `+ HuddleChip.jsx, HuddleSheet.jsx, hub/huddleView.js, src/components/Huddle/HuddleSheetBody.jsx`, count 0 each, with an authority note (`eddd0d58`) |
| Token guard list + baseline | `src/theme/tokens.guard.test.js` `GUARDED_FILES`, `src/theme/tokenGuardBaseline.json` | `tokens.guard.test.js`, the same hazard-34 row — failed on the same run | the same four files, no core-palette hex (`eddd0d58`) |
| Prompt-honesty sweep | `api/_utils/__fixtures__/promptHonestyRegistry.js` `PROMPT_CONTRIBUTING_MODULES` | review L1-4 (the plan's slot text is model-visible through the directive block, as `callRecords/callActions.js` is) | `+ huddle/planTemplates.js` |
| Area summaries | `src/components/CommandCenter/CommandCenterHub.s5.jsdom.test.jsx` | — (a row ADDED, nothing moved) | Partnership's summary with and without a Huddle section |

**Not touched, though V1.1 §11 lists them:** `firestore.indexes.json` (no query needs a composite — the manifest, §5 below); `src/config/featureFlags.js` (the flag has its own module so the entry chunk does not move — C7); `archetypeImportBoundaryBaseline.json` (no new importer of a legacy archetype table: the dissent table holds the six ids as values and `dissentTable.test.js` pins them equal to `VALID_ARCHETYPES`; the job reads names through `archetypeRegistry.getArchetypeDefinition`). No golden file was touched.
## 7. Hub contract (Amendment C §C9) — for the Command Center chat

Each hub rule of C4, C6, C7, C8, C14 and C15's Deploy card line, **held** or **moved under a ruling**. "Seen" means checked in a real browser: the flag-on hub harness (the real `CommandCenterHub`, flag sed'ed on in a private tree, the two Huddle readers and the service stubbed with Run B's real published record re-dated to Mon Nov 9; headless Edge at 360 × 780 phone and 1440 × 900 desktop; the harness is untracked and was never committed).

| Rule | Status | Where it holds | Evidence |
|---|---|---|---|
| C4 chip: a state label and a door — no badge, pulse, toast, count or live region | Held | `src/components/CommandCenter/HuddleChip.jsx`; labels from `hub/huddleView.js` `huddleChipOf` | `Huddle.jsdom.test.jsx` (no `aria-live`, no `role=status`, no `role=alert`); seen: "Huddle", "Huddle unavailable", "Huddle · plan confirmed" (L3-7 replaced "heard") |
| C4 outside Shadow's fixed box, 44 px target, fits at 360 px | Held | rendered after the stage (`CommandCenterHub.jsx`, phone and wide shells) | seen: 87 × 44 px at 360 px, 0 px horizontal overflow at 360 and 1440 |
| C6 one rule, Later key `huddle:{etDate}`, order game in session → Huddle ready → (the S4 rules: pre-open game, review, deployment) | Held | `hub/nextAction.js` (`deriveNextAction` takes `huddle`), `hub/huddleView.js` `huddleCandidateOf` | `hub/huddleView.test.js` (order, Later both ways, loading while the live poll is unresolved, no candidate after confirm / skip / close) |
| C6 rows the new order moves re-pinned | Held — none moved | with no Huddle candidate `deriveNextAction` is the S4 function unchanged | no `nextAction.test.js` or `CommandCenterHub.s4` row changed; `huddleView.test.js` asserts `huddle: null` equals the call without it |
| C6 Amendment D committed with a README row; hub spec file unchanged | Held | `docs/specs/COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2_AMENDMENT_D_20261101.md`, `docs/README.md` | the V1.2 hub spec file is not in the diff |
| C7 no client post-deploy hook; nothing the root deploy provider imports reaches the Huddle service | Held | no hook, no `apply` route | `commandCenterHub.mount.guard.test.js` walks `DeployAttemptContext.jsx` and `agentDeploy.js` transitively: no Huddle file |
| C7 one reader per record, keyed by uid and auth epoch, single service import, permitted map and NAMED | Held | `src/hooks/useHuddleToday.js`, `src/hooks/useHuddleHistory.js`, called once each in `ConnectedHub` | mount guard rows (one `huddleService` import each, one call each, no hub file imports the service) |
| C7 no poll; refresh on sheet open, confirm/skip, `visibilitychange` | Held | the reader's one effect | `commandCenterHub.activity.guard.test.js` (call-by-call manifest, plants bite); `Huddle.jsdom.test.jsx` (one read on mount, one on visible, none after 10 minutes) |
| C7 entry chunk checked by sourcemap attribution before and after | Held | `src/config/huddleFlags.js` (own module, imports nothing; flag-off folds away) | see "Entry chunk" below |
| C8 Partnership: replaces the reserved text; loading, none, error, as-of note | Held — **moved under C8 / D5** | `panels/PartnershipPanel.jsx`, `hub/huddleView.js` `huddlePartnershipOf`, `huddlePartnershipSummaryOf` | `Huddle.jsdom.test.jsx`, `huddleView.test.js`; seen: the summary reads "Proposed · not confirmed yet". The area **summary** beside Shadow ("Not in this release") was first left unchanged; seen in the harness and fixed (`a85e2c63`): it now says the panel's state while the flag is on. Flag off, the reserved panel and summary are byte-for-byte the base strings |
| C8 words: every string in `hub/hubCopy.js` under the copy guard; no learning claims; plan status from receipts only | Held | `hubCopy.js` `huddle` block | `hubCopy.guard.test.js` (unloosened) and `hubCopy.huddle.guard.test.js` |
| C8 audio: no autoplay; stops on unmount, hidden tab, ceremony; listeners in the activity manifest | Held | `src/components/Huddle/HuddleSheetBody.jsx` | activity guard rows; `Huddle.jsdom.test.jsx`; seen: `preload="none"`, not autoplaying, paused |
| C8 sheet: a HubSheet on the overlay stack (inert background, focus to Close, Escape, focus return) | Held; the body's placement **moved under C8** | `HuddleSheet.jsx` wraps `HubSheet`; the body is a STATIC import listed in `PERMITTED_TERMINALS` (V1.1 §8 said "a lazy module"; the mount guard pins exactly one lazy edge — RF-4) | seen: focus on Close at both widths, Escape closes |
| C8 activity: "Plan confirmed" / "Plan skipped", ids `huddle-plan:{uid}:{etDate}`, the standard cutoff | Held | `hub/activityRows.js`, `huddleView.js` `huddleActivityOf` | `huddleView.test.js` |
| C14 guards pass unloosened | Held | no guard edited except to ADD rows | **one string a guard rejected**: a draft of the plan card's note ("…instructions, not guarantees") tripped the voice rules' `guarantee` pattern in `hubCopy.huddle.guard.test.js`; reworded to "Lines are instructions your agent reads at its next check. They do not bind what it trades." No existing hub string was changed |
| C15 Deploy card reconfirm line: pure derivation; no service call; never blocks or delays a deploy | Held | `sections/DeploySection.jsx` `ReconfirmLine`, `PhoneTabs.jsx`; `huddleView.js` `needsReconfirmOf` | `Huddle.jsdom.test.jsx` (line only when handed one; the hold control unchanged); `huddleView.test.js` |

**Not seen in the harness:** the C6 card itself (the harness stubs the readers' next-action inputs, so the hub showed its fixture card) and the C15 line (the stubbed agent's archetype equals the record's); both are covered by the jsdom and unit rows above and are part of the founder's smoke.

**Entry chunk (C7), sourcemap attribution.** `vite build --sourcemap` of base `d503dd07`, of the hub checkpoint `9735877c`, and of `f2d1c9a0` (the last commit that changed shipped code; the one after it changes tests only), entry chunk attributed by its source map:

| | Base `d503dd07` | Hub checkpoint `9735877c` | Head `f2d1c9a0` |
|---|---|---|---|
| Entry file | `assets/index-BYnPCOYp.js` | `assets/index-BGofrKIg.js` | `assets/index-CrrjTC9s.js` |
| Bytes | 4,843,048 | 4,843,048 | 4,843,048 |
| `src/` sources | 686 | 686 (none added or removed; no Huddle file) | 686 (the same; no Huddle file) |
| Exported locals | 570 | 570, the same set | 570, the same set |
| Code before the final `export{}` statement, lazy-chunk hashes masked | — | identical | identical |
| What differs | — | lazy-chunk file names (hashes) and two swapped alias letters in the export table | the same kind only |
| Hub chunk | `CommandCenterHub-B9LroiTM.js` 141,720 bytes | `CommandCenterHub-izjQYR6b.js` 150,050 bytes | `CommandCenterHub-Cz-_grhH.js` 151,134 bytes (+9,414 over base) |

The entry's bytes, sources and code are unchanged; only the names of the lazy chunks it points at (the hub chunk among them) moved.
## 8. Tests

| Check | Result | Where |
|---|---|---|
| Full vitest suite, Linux (WSL, Node 20.20.2, `TZ=UTC`, `--maxWorkers=8`, under `flock`) at `563e0550` | Test Files: 1313 passed, 8 skipped (1321) · Tests: 28912 passed, 89 skipped (29001) · **exit 0** | `Test Files` line read from the run log; exit code from the shell |
| Firestore-emulator rules suite (all files, private emulator) | Test Files: 37 passed (37) · Tests: 690 passed (690) · **exit 0**, at `563e0550` | an LF tree: the Windows checkout's CRLF fails one pre-existing comment-stripping row (`agentEvalRunsDenials.rules.mjs`, `/\/\/.*$/` cannot cross `\r`; that block is unchanged from base) |
| `npm run lint:gate` | exit 0 | WSL, same head |
| `vite build` | exit 0 (entry `assets/index-CrrjTC9s.js`, 4,843.05 kB) | WSL, same head |

**What the full suite caught that targeted runs did not:** at `3ccacef2` the third cron-count pin (RF-9); at `6a5cd38c` the motion and token guards' hazard-34 rows (the three new hub files were not on their guarded lists, fixed in `eddd0d58` with the sheet body added).

**New test files:** 19 unit/jsdom files (`api/_utils/huddle/{applyRules,dissentTable,gather,planTemplates,players,scriptPrompt,speech,sweep,worker}.test.js`, `api/_utils/evidence/{earnings,evidence}.test.js`, `api/huddle/{audio,confirm,routes.dark}.test.js`, `src/config/huddleFlags.test.js`, `hub/huddleView.test.js`, `Huddle.jsdom.test.jsx`, `CommandCenterHub.huddle.jsdom.test.jsx`, `hubCopy.huddle.guard.test.js`) and 5 emulator files. The emulator files: `huddleDenials` (rules), `huddleApply` (B1, retire, heard), `huddleConfirm` (A1, C15), `huddleEvidence` (C1 claims), `huddleQueue` (B4, the job, the worker, reconcile).

## 9. Review (BUILD_RULES §2) — record and tally

Full record: `docs/audits/20261107_HUDDLE_S1_BUILD_REVIEW.md`.

- **Shape.** Three read-only lenses on their own `git archive` snapshots of `6a5cd38c`, unprimed (specs and the build prompt's hard rules only; told not to read this report): L1 the flag-off guarantee, the fence and the safety rules; L2 server domain correctness; L3 the hub and client contract. Every finding went to a separate refuter on its own snapshot, told to refute it with a repro. The mutation lens ran last, on its own snapshot of the fixed head `b7573512`, with its own emulator.
- **Tally.** 38 findings: **36 confirmed or partly confirmed, 2 refuted** (L1-9 — B §B1 does not promise to retract an in-flight commit; L2-11 — the answer endpoint gates on the resolved mode first). No blocker: every dark guarantee held. **26 fixed** (each with a row that fails on the old code), **5 to rulings** (L1-1 capture, L1-10 / L2-2 archetype dead ends, L2-1 transient speech, L3-11 attention order), the rest reported (nits, spec-mandated, or design points).
- **Mutation lens:** 37 mutants on the fixed head, **30 killed, 7 survived**; the 7 guards were fixed in `563e0550` and each mutant, re-planted, now fails (the review record has the table).
- **Before the review**, the verification run and the flag-on harness found six more, fixed with mutation-checked rows: holdings sharing one pack id (RF-12), the speech error body discarded (RF-13), an acronym failing `mentionedTickers` (RF-14), the Partnership summary still "Not in this release" (RF-23), source lines repeating and showing raw keys (RF-24), and the theme guards (RF-21).
- **Disclosure:** L1 printed this report's running-findings section while paging the branch diff (the report is in the diff); it states every finding was checked in code.

## 10. Spec-vs-repo contradictions (fixed nothing out of scope)

- **RF-1** `api/_utils/agentTriggerGate.js:235-240` `fetchRecentNews` queries `fantasyTimesStories` with `tickers array-contains` + a `publishedAt` range; `firestore.indexes.json` has no composite for it and the catch at `:256` swallows the error. The Huddle uses a single-field range instead.
- **RF-2** V1.1 §5.1 drains in the brief handler "while ≥ 150 s of the 300 s maxDuration remain"; that handler's `maxDuration` is 60 (`api/cron/compute-daily-regime-brief.js:37`), so the in-handler drain claims nothing and the worker drains within two minutes.
- **RF-3** V1.1 §4.5 wants `textVersion: 'plan.v1'`; `buildDirectiveSlot` emits `textVersion` only for a call-family filing (`api/_utils/directiveFiling.js:34-46`, `:87`). The plan's slot is built with existing keys only.
- **RF-4** V1.1 §8 calls the sheet "a lazy module"; the mount guard pins exactly one lazy edge (`commandCenterHub.mount.guard.test.js:826-834`). The body is a static permitted terminal (C8's HubSheet ruling).
- **RF-5** C6 names "research awaiting your direction" in the order; no such rule exists in `hub/nextAction.js` at base (`:8-17`). S1 adds only the Huddle rule.
- **RF-6** Superseded and not built: V1.1 §6's 60 s poll (C7), §5.1's `30 12,13` brief entry (A10), §6.2's post-deploy hook and `apply` route (C7).
- **RF-7** `firestore.indexes.json` exempts `ticks.controls`, so "heard" is read by a `capturedAt` range and tested in memory.
- **RF-8** The brief's `today` is the UTC date (`compute-daily-regime-brief.js:194`); the marker is keyed by the ET date. They agree at 12:30 UTC.
- **RF-19** The FantasyTimes `sector_column` story carries sector names in `tickers`, so it never matches a name (correct; noted).
- **RF-20** The founder's cached daily bars ended Oct 30 on Nov 7; production refreshes them through `getStockAnalysisData` (an `/eod` call and a cache write per stale symbol).
- **V1.1 §11** lists `src/config/featureFlags.js`, `archetypeImportBoundaryBaseline.json` and `firestore.indexes.json` as touched; none needed it (own flag module; no legacy-table importer; no composite).
- **L2-2 / L1-10** C15 assumes one equipped archetype per player; a training clone can carry an override (`api/_utils/trainingClone.js:140-143`, `api/_utils/trainingLoadoutSpec.js:47-78`).

## 11. Founder questions

1. **Ratify the dissent table** (§5; V1.1 §12 question 2). *Recommended: ratify as it stands — every row moves toward WATCH.*
2. **Shadow's voice and the ElevenLabs key.** The key saved in `.env.local` is the key's ID (the API said `api_key_id_used_as_api_key`); the Vercel value of the same name is unchecked. Rule 8 also wants a committed capture of the with-timestamps response before the reader is trusted (L1-1). *Recommended: set a real key and a voice id (`HUDDLE_SHADOW_VOICE_ID`) on the preview; authorize one capture call during the smoke, committed key-stripped before the flip PR.*
3. **Plans for battles under another archetype** (L2-2, L1-10). A training game with an archetype override, or a game deployed before an archetype switch, can never receive a plan confirmed under the equipped archetype, yet its status offers "Reconfirm", which does nothing then. *Recommended: keep C15's rule; show "Reconfirm" only when the reconfirm door exists, and word the other case as "not this game's approach"; decide in the flip PR whether confirm should record every archetype in play.*
4. **A transient voice failure** (L2-1). One 429 / 5xx / timeout from ElevenLabs publishes that day's huddle as text only, for good. *Recommended: keep it for S1; in the flip PR add a speech-only retry that re-voices the stored script (no new model calls), which needs `audio` exempt from the record's immutability.*
5. **The Wire's N1.1 boundary** (RF-11). Should the Huddle's FantasyTimes headline reader join the voice-layer consumer set? *Recommended: yes — register it as a consumer that speaks headlines only as attributions ("FantasyTimes reported: …").*

**For the Command Center chat (a ruling, not one of the five):** L3-11 — before the open, a multi-day game already scored reads as "in session" and outranks "Huddle ready" every morning (D1's "has opened" against C6's "before the open").

**Recommendations, no decision needed now:** newsfilter (V1.1 §12 question 3) stays off in S1 — it needs its own capture first (the C13 precedent); Sonnet's server-side fallbacks were not enabled, to keep the four-call budget exact — revisit with the regeneration rate the smoke shows (two of two here, RF-15).

## 12. Out of scope — reported, not touched

- `api/news/stock.js:65` reads an EODHD `source` key the payload never has (always "Unknown").
- RF-1's `fetchRecentNews` composite.
- C11's phantom-key readers in the newsroom; C12's bench RVOL stamp; Shared Research record changes (all named out of scope by the prompt).
- The brief's own trading-day skip and DST pin (A10: the flip PR's).
- L3-12's Activity knowledge join (the S4 runtime's; a loading history can read as "nothing recorded yet").
- `test/rules/agentEvalRunsDenials.rules.mjs`'s comment stripper fails on a CRLF checkout (Windows only).

## 13. Not verified

- **Speech end to end**: no audio came back (the key is an ID), so the stored mp3, the live alignment check, the beat timings on real audio, GCS storage and the audio route against a real object are unverified. The beat-boundary computation is verified on a synthetic alignment.
- **iOS Safari**: whether a `play()` after an awaited token fetch keeps the tap gesture (L3-4); the founder's smoke is the first real check.
- **The third script** (Run C, the Trend Follower variant) was not generated: budget.
- **Production timing**: the per-job times were measured on an emulator with vendor calls stubbed.
- **The C6 card and the C15 Deploy line in a real browser**: covered by jsdom and the flag-on suite; the harness could not show them (§7).
- **Platform request logs** for the path token (L1-6).

## 14. Founder smoke (on the preview above, your own account)

The preview runs this branch plus one commit that turns the flag on. It reads and writes the production Firestore (the preview has no database of its own), and Vercel does not run crons on previews.

1. On Vercel, for the preview only: **set `HUDDLE_PLAYER_UIDS` to your own uid** (without it, the worker run below makes — and pays for — a huddle for every active player, in the production database); set `HUDDLE_SHADOW_VOICE_ID`; check `ELEVENLABS_API_KEY` is the key, not its id (without the voice the huddle is text only, which is also a valid smoke).
2. Make a huddle: on a weekday between 8:30 AM and 4 PM ET, after that morning's brief has run in production (it writes the marker the worker waits for), call the preview's worker once with the cron secret (`/api/cron/huddle-worker`); it enqueues you and drains.
3. iPhone Safari, and desktop at 360 px and wide: the chip under Shadow; open the sheet; play (if voiced); confirm on a day with an active game, then watch that game's line move to "Read by your agent at …" after its next check (production's evaluation cron reads the slot; the preview's status read stamps the receipt); one edit (remove an item or change a level); one skip on another day; the Partnership panel and its summary beside Shadow; Recent activity's "Plan confirmed".
4. Close the sheet while playing, and switch tabs while playing: the audio stops.
5. **After 4 PM ET, open the preview hub once (or call the preview's worker once)**: production's crons keep the flag off, so only the preview retires the plan from your game's slot at the close. Until then the plan stays in that game's instructions.

## Appendix — running findings (as written during the build)

- RF-1 `fetchRecentNews` (`api/_utils/agentTriggerGate.js:235-240`) queries `fantasyTimesStories` with `tickers array-contains` + `publishedAt >` + `orderBy publishedAt desc`; `firestore.indexes.json` carries no composite for it, and the catch at `:256` logs and returns nothing per symbol. It may return no stories in production. Out of scope: reported, not fixed. The Huddle's story fetcher uses a single-field `publishedAt` range instead (no new index).
- RF-2 V1.1 §5.1 drains jobs in the brief handler "while ≥ 150 s of the 300 s maxDuration remain"; the brief handler's `maxDuration` is 60 s (`api/cron/compute-daily-regime-brief.js:37`). A10 says the handler behaves as HEAD, so it stays 60 s and its drain stage claims nothing (`drainedInHandler: 0`); the worker's first tick drains within two minutes.
- RF-3 V1.1 §4.5 wants `textVersion: 'plan.v1'` on the slot; `buildDirectiveSlot` emits `textVersion` only for a call-family filing (`api/_utils/directiveFiling.js:34-46`, `:87`). The plan filing builds its slot object itself with existing keys only (`text, expiry, directiveThreadId, createdAt, textVersion`), the cockpit precedent for `textVersion`.
- RF-4 V1.1 §8 calls the Huddle sheet "a lazy module outside the hub directory"; the mount guard pins exactly one lazy edge in the hub graph (`commandCenterHub.mount.guard.test.js:826-834`). The sheet body is a static import listed in `PERMITTED_TERMINALS`, moved under C8's HubSheet ruling.
- RF-5 C6's agreed order names "research awaiting your direction"; no such rule exists in `hub/nextAction.js` at HEAD (`:8-17`). S1 adds only the Huddle rule.
- RF-6 Superseded, so a reader of V1.1 alone does not look for them: V1.1 §6's 60 s status poll (withdrawn by C7: no poll); V1.1 §5.1's `30 12,13` brief entry (withdrawn by A10); V1.1 §6.2's post-deploy hook and the `apply` route (withdrawn by C7).
- RF-7 `firestore.indexes.json` exempts `ticks.controls` (and `manifest`, `checks`, `actions`, …) from indexing, so "heard" cannot be a query on `controls.*`. Reconcile reads the battle's ticks by a single-field `capturedAt` range from the filing instant and tests `controls` in memory.
- RF-8 The brief handler's `today` is the UTC date (`compute-daily-regime-brief.js:194`); the `huddleRuns` marker is keyed by the ET date. At 12:30 UTC they agree.
- RF-9 Three tests pin the cron count at 44: `api/agent/research.dark.test.js:141`, `api/cron/agent-evaluate.measuredFollowup.test.js:188`, and `api/cron/compute-index-intelligence.axes.test.js:123` (the third found only by the Linux full suite at `3ccacef2`; re-pinned in `863ee19d`).
- RF-10 The `/news` capture (2 calls, Nov 7 2026, AAPL and PFE, `limit=3`): exactly 7 keys per item (`date, title, content, link, symbols, tags, sentiment`); `date` is ISO 8601 with `+00:00` (UTC); `link`, `content` and `symbols` present on every item; NO item id; NO `source` key — `api/news/stock.js:65` reads `item.source` and always gets its `'Unknown'` fallback (out of scope, reported). No contradiction with C1 (url and vendor date present). Not proven: a press-wire item (none came back), so the press-wire host list is unexercised by real data. Relevance finding: an item tagged with a symbol is often about another company (all three AAPL items are about MRVL, GIL, CSCO), so the fetcher keeps an item only when its title names the ticker or it lists at most two US names.
- RF-11 The Wire's N1.1 boundary (`api/_utils/agentSafeWireEntry.boundary.test.js`) scopes "no `fantasyTimesStories` source text" to the voice-layer consumer set; the Huddle's story fetcher (`api/_utils/evidence/fantasyTimesStories.js`) reads story `headline`s for Shadow's script, which the player hears and the trading brain never reads. Whether the Huddle should join that consumer set is a ruling question, not decided here.
- RF-12 (fixed, `10f288bb`) The verification dry run on the founder's Nov 2 game found every holding of one game sharing one pack id (`agentBattle|{battleId}|{createdAt}`), so the pack's dedup kept the first holding (CCI) and dropped six. Holding items now carry `{battleId}#{symbol}`; `gather.test.js` pins one item and one id per holding and per opener paragraph.
- RF-13 (fixed, `9c51bf99`) All three ElevenLabs calls returned HTTP 400. The first two bodies were discarded by the speech helper; it now keeps the short `detail.status` code in the reason (never the message or the key). The third call read `api_key_id_used_as_api_key`: the `ELEVENLABS_API_KEY` value in the local `.env.local` is the key's ID, not the key. Speech, the stored mp3 and the live alignment check are therefore NOT verified; the beat-boundary computation is unit-tested on a synthetic alignment (`speech.test.js`). The Vercel value of the same name is unchecked (the academy route reads it too).
- RF-14 (fixed, `168040d0`) Run B's first answer listed `ISM` in `mentionedTickers`; `ISM` was already allowed in the spoken text (the `ACRONYMS` list), so one word failed one check and passed the other, and the job paid a regeneration. The list check now skips the same acronyms. `UTC` (said in the same answer) still fails, as it should: Shadow says ET.
- RF-15 Both verification jobs regenerated once (Run A: tape beat over its 380-character cap; Run B: RF-14 plus `UTC` said). Two runs is too few to call a rate, but at 2 of 2 a huddle costs two Sonnet calls and ~12 s of script time.
- RF-16 The tape has no C10 pack-item kind (C10's S1 kinds: close, headline, event, holding, agent_pick, opener, prior_plan, source_status), so a tape sentence's SPY / QQQ figures cite nothing; Run A's tape sentence cites only the earnings source status. Spec as written; a `tape` kind is a question for a later slice.
- RF-17 A source the job SKIPPED is a `source_status` item with status `unavailable` and the fact "… was not checked this morning" (C10 as written). Run B's model turned that into "were both unavailable" and "with news sources down": wrong in fact (nothing was down). For Fable's script review.
- RF-18 Run B's names beat led with CVX (support, 10 %) because it had the only headline, ahead of LLY and CCI (star, 20 % each); the prompt says "biggest exposure first". For Fable's script review.
- RF-19 The FantasyTimes `sector_column` story carries sector names in `tickers` (`['Technology','Financials','Utilities']`), so `storiesForSymbol` can never match it to a name. Correct behaviour for a ticker filter; noted so nobody reads its absence as a fetch failure.
- RF-20 The founder's cached daily bars (`marketDataCache/{SYM}_daily`) stopped at Oct 30 on Nov 7; in production `fetchLastClose` refreshes them through `getStockAnalysisData` (one EODHD `/eod` call and one cache write per stale symbol). The verification run read the cache only (no spend, no production write), so Run A's names have no prior close.
- RF-21 (fixed, `eddd0d58`) The Linux full suite at `6a5cd38c` failed the motion and token guards' hazard-34 rows: every file under `src/components/CommandCenter/` must be on their guarded lists with a baseline entry. The three new hub files were registered (with the sheet body), count 0 / no core-palette hex, baseline entries inserted by hand so existing entries keep their escapes.
- RF-22 `test/rules/agentEvalRunsDenials.rules.mjs` "ONE block … `allow read, write: if false;`" fails on the Windows checkout only: its comment stripper `/\/\/.*$/` cannot cross the CRLF's `\r`. The block is unchanged from base; the rules suite is recorded on an LF tree.
- RF-23 (fixed, `a85e2c63`) Seen in the flag-on harness: the Partnership panel carried the Huddle but its summary beside Shadow still read "Not in this release" (D5 replaces the reserved text).
- RF-24 (fixed, `744472e5`) Seen in the harness on Run B's record: a card's source line repeated "your game" and showed raw keys ("eodhd", "marketContext"); source-status items now carry readable labels and a line names each source once.
