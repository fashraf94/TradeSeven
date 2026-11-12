# Practice Field shared contract V2 — the idea book's records

**Date:** 12 Nov 2026 · **Author:** the Practice Field chat (Fable), per ruling 24 of concept V6.1 · **Status:** derived from concept V6.1, whose 26 rulings the founder approved on 12 Nov 2026; awaiting his adoption of this text · **For:** the Film Room chat (card stages, nominations, the receipt), the architecture chat (the drafting call's proposal shape and methods packet), and every Practice Field build. Handed to each chat once. Corrections of fact come back once with the first build's spec; design disagreements go to the founder as rulings.
**Supersedes:** shared contract V1 (10 Oct) §1 rows 5–7, §5 (ledger stages and play parts), §6 (the drill record, now dormant) and §7 (one door). V1 §2 (situation registry), §3 (tape additions), §4 (tagger, counter, list), §8 slots S1–S8 and the card slots S9–S10 stand unchanged.
**Checked against:** `main` at `c37baa0d` (the #1044 merge): `api/_utils/filmRoom/cardStore.js`, `src/data/cardSlots.js`, `api/_utils/mandateSchema.js`, `firestore.rules` (`/mandates/{mandateId}` and its `dailyRows` and `decisions`).
**Destination:** `docs/design/20261112_PRACTICE_FIELD_SHARED_CONTRACT_V2.md`, carried by the T0a build's commit. No docs-only PR.

## 0. In plain terms

The Practice Field is a paper-money book the player's agent fills with ideas, three at a time by horizon, and manages on its own. This contract says what gets written down: the book, each idea and its own accounting, the ideas the Film Room offers the agent, the result when an idea resolves, and the offer the Forge shows the player. It says who may write each record, who may read it, which model calls may see it, and what the Film Room's card stages become. It fixes meanings, not field names; the implementer picks names and the acceptance cases in §14 hold either way.

## 1. The chain and who builds each link

| Link | Built by | Writes |
|---|---|---|
| Situation registry, tape additions, tagger, counter, list, card (stages `card`, `nominated`) | Film Room (built) | the tape, the ledger |
| Sector-cap translation, stored reasons, idle-data skip | T0a, T0b, T0c | the engine's vintage and decision records |
| The book, ideas, sub-ledgers, reservations, basket entry, fills, comparisons | T1a-1 + T1c | `mandates/{bookId}` (kind `idea_book`), `…/ideas`, `…/dailyRows`, `…/decisions` |
| Lifecycle, cutoffs, results, evidence packets, owner access | T1a-2 | `…/ideas`, `…/ideas/{ideaId}/evidence` |
| Settings snapshot, manifest, drafting, validation, considered drafts | T1b + T1d | the book's epoch, `…/drafts` |
| The risk budget | T1e | the book's rails and trims |
| Nominations, card stages `testing` and `tested`, the receipt link | T2 (Practice Field with the Film Room's readers) | `…/nominations`, the ledger's stage, every stage reader |
| Offers, adoption and rollback | T3 | `…/offers`, the existing equip endpoints |
| Branch books (release 2) | T4 | books of kind `branch_book` |

## 2. Vocabulary

| Word | Meaning |
|---|---|
| **Book** | One paper portfolio per player, a product kind on the Mandate engine |
| **Epoch** | The frozen pin of model, settings snapshot, methods packet and contract versions under which ideas run |
| **Idea** | One thesis with names, a horizon slot, a comparison, a price line per holding, reserved capital and a review session; its own sub-ledger inside the book |
| **Slot** | Short (10 sessions), medium (30), long (60); one idea each |
| **Nomination** | A source the player offered the agent (a Film Room card, an idea version); the agent may take it or decline it |
| **Draft** | A structured proposal from the drafting call, accepted or refused by code |
| **Reservation** | Capital and data coverage set aside atomically before an idea enters |
| **Result** | The five-column record written when an idea resolves |
| **Offer** | A typed proposal the Forge shows the player after a result; never an automatic change |
| **Run status / result / adoption** | Three states, always kept apart |

## 3. The book

**Home.** `mandates/{bookId}`, the engine's book document, with `kind: 'idea_book'`. Books of other kinds keep their existing meaning. Server-only writes; owner read, as today.

**Identity, written once:** owner uid; attribution agent instance (the ranked record, never a casual clone); archetype code id and identity version; the epoch (§3.1); the rails version; the contract version (this document's); `createdAt`.

**What the engine's fields mean for this kind.**

| Engine field | Meaning for an idea book |
|---|---|
| `status` | `active` while the book runs; `draining` after a manager switch (no new risk, reductions and settlement only); `closed` after handover |
| `portfolio` (cash, positions) | The whole book. Cash is the treasury every idea reserves from; positions carry an `ideaId` and no two ideas hold the same ticker (B-SAME, §14) |
| `revision` | The correctness backbone, as today; every mutation increments it |
| `quarterIndex`, `quarterKey`, `nextRolloverAt`, `escapeHatchEligibleUntil` | Not used. Quarterly rollover, repinning and the escape hatch do not apply to this kind. The **epoch key** takes the quarter key's role in stale-submission protection |
| `vintageRef` | Resolved through a versioned discriminant: an idea book loads its immutable epoch config, never the quarterly archetype vintage |
| `cadenceTier` | Pinned to two checks a day for every archetype |
| `costTelemetry` | Extended with the monthly spend reservation and its exhausted state (B9) |

### 3.1 The epoch

Written once per epoch, immutable: epoch id; model id and generation settings; the settings snapshot (archetype identity and version, equipped list and idea version, leans, tempo, rule bundles) with its content hash; the manifest of inputs the manager receives; the methods packet version; the rails version; the contract version; `openedAt`. A new epoch opens only by an explicit migration policy recorded on the book; no idea is ever repinned under a running epoch. The manager's label on every screen: "Test version of your <archetype>".

### 3.2 Pause and wind-down

Account-level fields on the book: `drafting: 'on' | 'paused'`, `windDown: null | { requestedAt }`. Paused stops drafting and model spend; wind-down lets ideas settle and then closes. Neither extends an idea's clock or deletes a record.

## 4. The idea

**Home.** `mandates/{bookId}/ideas/{ideaId}`. Server-only writes; owner read.

### 4.1 The contract, frozen at admission

| Field | Content |
|---|---|
| Thesis | One sentence; `author: 'agent'`; sources by id (§5); labelled as the agent's words |
| Slot | `short` 10 / `medium` 30 / `long` 60 sessions; start session; due session; both inside the maintained calendar |
| Names | 1–4 (B3) normalised symbols with reserved coverage; none held by another idea |
| Comparison | type (`same_stock_held` / `sector_fund` / `industry_fund` / `frozen_basket`); exact identifier(s); initial quantities; cost policy; the question it answers, as a fixed phrase |
| Wrong-if lines | One per holding: operator, threshold, basis `completed_session_close`, due time. An event condition may be recorded as `observational` and never settles anything in release 1 |
| Capital | The fixed amount reserved at admission, within slot cap (B1), cash floor (B2), the archetype's caps and the risk budget (B7) |
| Risk assumption | `exit_at_line_next_eligible_fill`; the label states that gaps and missing observations change the realised loss |
| Band | 0.25% (B4) of this idea's reserved capital, with its version |
| Epoch, rails version, contract version | As pinned |

### 4.2 The sub-ledger, mutable only through recorded actions

Reserved cash; cash remaining; quantities and basis per holding; costs paid; corporate-action receipts; flows in and out; the comparison's quantities, cash and value; per-idea valuation rows per session (value, cash, quantities, marks, price quality, cumulative costs, comparison value, gap, remaining marked loss to lines); the inception row before costs. Sleeve totals reconcile to the book after every mutation (B-RECON, §14). Every fill carries `ideaId`, epoch id and contract version.

### 4.3 Lifecycle (run status)

`drafted → accepted → entering → holding → line_hit_exit_pending → settled → resulted → retired`

- `entering`: the basket fill by code at the first eligible observation after admission. Partial fills record what was filled and what was not, with reasons; the start mark is the first fill's observation time.
- `holding`: the model's management actions apply; code watches the lines each session.
- `line_hit_exit_pending`: code exits at the first eligible observation after the line is recognised; the exit receipt is its own record.
- `settled`: the review endpoint is the idea's value at the scheduled due session's post-close snapshot; liquidation that frees the capital happens at the next eligible observation with its own receipt; the slot refills only after that cash settles.
- Actions after the due session's cutoff are refused. A missed final valuation is recovered from the scheduled session's prices or the result reads `inconclusive`. Abandonment (`abandoned`) is recorded, never deleted.
- Every transition is idempotent: operation id, fingerprint, expected version.

### 4.4 The result, five columns

| Column | States |
|---|---|
| `contractCondition` | `met` / `breached` / `unobserved` |
| `economicResult` | `ahead` / `behind` / `within_band` / `unmeasurable` |
| `processQuality` | `followed_plan` / `deviated` / `blocked` |
| `evidenceScope` | `single_forward_observation` / `repeated_comparable` / `controlled_experiment` |
| `adoption` | `no_offer` / `offered` / `accepted` / `expired` / `retired` |

Written with: the gap after costs, the largest decline between recorded session-close values, trades and costs, invested exposure, data quality, the agent's closing note (quoted, unverified), and the one-observation label. The main labels on screens are *ahead*, *behind*, *inconclusive*. The words *validated*, *proven* and *supported* do not appear anywhere in these records or their renderings. A breach and an economic result coexist.

## 5. Sources, nominations and drafts

### 5.1 Sources the drafting call may read

The player's own: SignalDrop picks (`users/{uid}/signalDrops`), game moments (`agentBattles/{battleId}` and its tape), the player's conversations with their agent (battle `chatExchanges`, workshop sessions), Film Room cards (`agents/{attributionAgentId}/plays`), and this archetype's completed ideas. Attribution to the archetype is recorded at source time or verified; a source with no verifiable archetype binding is excluded, never inferred. Bounded fields only; no full chat histories, no other person's words, no raw identifiers; opaque local labels resolved server-side. Nothing from another player or archetype.

### 5.2 Nominations

**Home.** `mandates/{bookId}/nominations/{nominationId}`. Written by the server when the player offers a source (the Film Room's "send to test" becomes "offer to the agent").

`queued → considered → accepted | deferred | declined | expired`

Fields: the source reference (card entry id, hypothesis version, SignalDrop id); `queuedAt`; the reason on `declined` and `deferred`; the idea id on `accepted`; `expiresAt` (B6: a nomination not considered within 10 sessions expires with the reason `not_considered`). A nomination is never shown as running.

### 5.3 Drafts

**Home.** `mandates/{bookId}/drafts/{draftId}`, bounded (the last 50 kept). Each: the structured proposal as the model wrote it; the deterministic acceptance or refusal with the failed check named (§5.4); missing fields; model id, prompt version, methods packet version; `createdAt`. A refused draft stays visible to the player as "considered".

### 5.4 Admission, by code

| Check | Deterministic |
|---|---|
| Thesis | present, bounded, author and sources present |
| Horizon | supported slot; calendar covers start to due |
| Names | normalised; coverage reserved; data complete; not held by another idea |
| Comparison | supported type; identifiers resolve; quantities and cost policy fixed |
| Wrong-if | typed operator, threshold, basis, due time for every holding |
| Capital | atomic reservation including costs and the cash floor; every execution gate; the risk budget |

Reservations are atomic and ordered: mandatory reductions and due exits before optional entries; two drafts cannot spend the same balance; a losing draft is `queued` or refused with a reason. One refill attempt per slot per session; up to three drafts per drafting call (B6).

## 6. The evidence packet

**Home.** `mandates/{bookId}/ideas/{ideaId}/evidence/{packetId}`, immutable, written at admission and at the result: the source excerpts and prices the decision and the result relied on, their observation times and quality, content hashes. Kept beyond the engine's 120-day snapshot retention; access as the idea; deletion only with the book. References alone do not recreate expired content.

## 7. The ledger's stages (Film Room)

**Vocabulary version 2** (`CARD_STAGE_VOCAB_VERSION = 2`, alongside `CARD_SCHEMA_VERSION` and `CARD_SLOTS_VERSION`):

`card → nominated → testing → tested → installed → retired`

- `drilled`, `drafted`, `proven` are dropped before anything writes them.
- `testing` is written by the server when an idea that took this card as a source reaches its **first executed fill**. Not at nomination, not at acceptance.
- `tested` is written at any terminal result, including `inconclusive` and `abandoned`, with the result reference.
- `installed` is written when a Forge offer from this card's idea is accepted.
- **Counting (S9):** `card`, `nominated` and `testing` count as open; `tested` counts until `parkedAt` is set or the card is retired. A separate limit for parked cards is not set in this version.
- **Shelving** stays computed at read from the archetype. A shelved card whose idea is still running receives its `tested` receipt through a narrow server transition bound to the original run and owner. Shelving never grants adoption to the new archetype.
- **Readers to migrate together,** with history never rewritten: `CARD_STAGES` and `OPEN_STAGES` in `cardStore.js`; `isOpen` and the retire transition; the screen's open-stage list and grouping (`FilmRoomCardRegions.jsx`, `filmRoomCards.js`); the labels (`filmRoomCopy.js`); the card endpoint's operations (a new `nominate` op beside `create` and `retire`); the legacy-reader tests.
- The receipt on a nominated card shows the nomination's state and reason, and links to the idea once one exists.

## 8. The Forge offer

**Home.** `mandates/{bookId}/offers/{offerId}`, server-written, owner read; the Forge queries by owner and attribution agent.

| Field | Content |
|---|---|
| `kind` | `equip_idea_list` / `retire_idea` (release 1); `set_control` / `rule_version` (release 2) |
| `ideaRef`, `resultRef` | The idea and its result |
| Applicability | `horizonFit`, `archetypeCompatible`, `exactVersion`, `installTarget`, `expiresAt`; an offer is shown only when every check passes |
| `state` | `offered → accepted | declined | expired | retired` |
| Adoption record on `accepted` | `adoptedAt`, the writer used, the exact version written, `rollbackRef` |

- An offer is created only for a result with `contractCondition: met` and `economicResult: ahead`, and only if it still applies.
- Acceptance writes through the **existing equip endpoints**, inside their existing checks: never a running battle; effect at the next battle's creation.
- Adopted ideas are labelled player instructions. Declining or retiring an offer keeps the result and its evidence.
- Ideas that finished `behind` or `inconclusive` remain readable to the drafting call as questions and never become offers.

## 9. Access and the one-door exception

| Record | Write | Read |
|---|---|---|
| book, ideas, sub-ledgers, evidence, nominations, drafts, offers | server only | the owner |
| the card ledger's stage | server only | the owner |

**What may read these records into a model prompt.** Only the book's own manager (its frozen snapshot, the book's state and effective headroom) and the drafting call (§5.1 sources, this archetype's completed ideas, the methods packet). Both assemblers and their inputs are registered in the Mandate honesty registry and covered by its sweep.

**What may never read them:** the deployed agent's battle and draft prompts, memory, consolidation, any other player's or archetype's prompts, the shared knowledge base. This replaces V1 §7 rules 1–2 with one narrow exception and keeps the prohibition everywhere else. V1 §7 rules 3–6 stand, with rule 5 restated: a Watch card never becomes an idea record to bypass adoption; ideas keep their own writer and versions.

**Negative tests, required before the drafting call is connected:** byte-identical battle and draft prompts with and without a populated book; no memory or consolidation write from any Practice Field path; no cross-owner and no cross-archetype read.

## 10. Idempotency

Every operation carries an operation id and a request fingerprint and checks an expected version, following `api/_utils/hypothesisRecords/store.js` as the card store does. Creation, admission, fills, line exits, settlement, results, nominations, offers and handover are each create-once or replay-safe. Late model results after a cutoff are recorded and never executed.

## 11. The manager switch and handover

On an explicit Practice Field manager assignment: the book enters `draining` (no new risk; reductions, line exits and settlement continue under the original epoch); when every idea has `settled` and every receipt is written, one atomic handover transfers the settled cash to a new book under the new epoch and closes the old one. Cash is never reset. The old book and its records stay readable to the player and to the originating archetype only. Game loadout changes do not trigger any of this.

## 12. Spend, coverage and capacity

- **Spend (B9):** a hard monthly reservation per book; each model call reserves before it runs; retries and unpriced calls count; an exhausted budget sets an honest state on the book and stops drafting and management calls while valuation, line exits and settlement continue without model calls.
- **Coverage:** every held, pending and comparison symbol is reserved against the authoritative membership version before admission; admission fails visibly when the reserved universe or the candidate floor would be breached; held coverage is never dropped.
- **Capacity (B8):** a founder cap on concurrent books, enforced at creation; an expected-versus-observed check ledger per book per session.

## 13. Founder slots for the book

The Film Room keeps S1–S8 (contract V1) and S9–S10 (`cardSlots.js`). The book's slots are **B1–B9**, in their own versioned module; concept V6.1's S-numbers map onto them as shown.

| Slot | Meaning | Value (V6.1) |
|---|---|---|
| B1 (V6.1 S1) | Share of the book an idea may reserve: short / medium / long | 20% / 30% / 40% |
| B2 (S2) | Cash floor | 10% |
| B3 (S3) | Names per idea | 1–4 |
| B4 (S4) | No-difference band, of the idea's reserved capital | 0.25% |
| B5 (S5) | Price-line distance below entry: short / medium / long | 3–8% / 6–15% / 10–25% |
| B6 (S6) | Drafts per drafting call; refill attempts per slot per session; nomination expiry | 3; 1; 10 sessions |
| B7 (S7) | Risk budget: remaining marked loss to lines, of marked book equity | 8% |
| B8 (S8) | Founder cap on concurrent books | 4 |
| B9 (S9) | Monthly spend bound per book | $3 |

A slot value changes only by a PR that bumps the module's version.

## 14. Acceptance cases

1. **B-RECON.** After any mutation, the sum of every idea's cash and holdings plus the treasury's unreserved cash equals the book's portfolio, to the cent.
2. **B-SAME.** A draft naming a ticker another idea holds is refused with `ticker_held_by_other_idea`.
3. **B-RESERVE.** Two drafts in one session that together exceed available cash: exactly one enters; the other is `queued` or refused with a reason.
4. **B-ORDER.** A due exit and an optional entry in the same session: the exit executes first.
5. **B-FILL.** A decision at 10:20 never receives a mark observed before 10:20; a carried-forward mark never qualifies as a fresh fill.
6. **B-ENTER.** Admission of a four-name idea fills the basket by code at the first eligible observation; the model's action count is unchanged.
7. **B-LINE.** A completed-session close below a holding's line sets `line_hit_exit_pending`; the exit fills at the next eligible observation with its own receipt.
8. **B-CUTOFF.** An action submitted after the due session's cutoff is refused and recorded; the review endpoint is the due session's post-close value.
9. **B-MISSED.** A failed final valuation is recovered from the scheduled session's prices, or the result reads `inconclusive`; the window never extends.
10. **B-RESULT.** An idea that breached its line and finished ahead carries `contractCondition: breached` and `economicResult: ahead`, both shown.
11. **B-BAND.** A $20,000 idea with a $40 gap reads `within_band`; the same gap on a $10,000 idea reads `ahead`.
12. **B-RISK.** An admission that would take remaining marked loss to lines above B7 is sized down or refused; a trim under the frozen policy names the idea with the largest contribution.
13. **B-DRAIN.** After a manager switch, no new entry is admitted; a line exit still executes; handover transfers settled cash only.
14. **B-STAGE.** A nominated card reaches `testing` only at the first executed fill; a declined nomination leaves the card at `nominated` with the reason on its receipt.
15. **B-DOOR.** With a populated book, the deployed agent's battle and draft prompts are byte-identical to the empty-book case; no memory or consolidation write originates in any Practice Field path.
16. **B-OFFER.** A result with `met` and `ahead` but a failed applicability check produces no offer; an accepted offer writes through the equip endpoint and never touches a running battle.
17. **B-SPEND.** Once the monthly reservation is exhausted, no model call runs; valuation, line exits and settlement still run that session.
18. **B-COVER.** An admission whose names would breach the reserved universe fails with `coverage_unavailable`; held coverage is unchanged.

## 15. Not decided here

- **The Film Room chat** owns the nomination control's placement, the receipt copy and the migration of its readers to vocabulary version 2.
- **The architecture chat** owns the methods packet's contents and versioning, and aligns its proposal record with §5.3's draft shape so one shape serves both.
- **The hub chat** receives one note about the Forge offer slot when T3 is specified.
- **The framework arc** keeps idea records and `hypothesisRef`; an offer names the exact version it equips.
- **Release 2** (branch books, `set_control` and `rule_version` offers, the offset experiment) adds its records by amendment.
