# Practice Field — concept V6.1: the idea book, revised after Astra's review

**Date:** 12 Nov 2026 · **Author:** the Practice Field chat (Fable) · **Status:** direction approved by the founder on 12 Nov 2026 and confirmed after Astra's review ("fold them in"); the rulings in §16 await his explicit approval · **Supersedes on adoption:** concept V3 (14 Oct) and Amendment A (21 Oct). V4, V5, V5.1 and V6 were withdrawn before adoption; V6.1 revises V6 in place.
**Rests on:** V6 and Astra's review of it (`20261112_ASTRA_REVIEW_PRACTICE_FIELD_CONCEPT_V6.md`, verdict "revise the implementation contract, keep the product direction", reviewed `main` at `c37baa0d`), Astra's two reviews of V5.1, the test portfolio audit (`docs/audits/20261112_PHASE0_TEST_PORTFOLIO_AUDIT.md`), the architecture chat's design revision (11 Nov) and its work on agent-originated proposals, the KB focus brief (9 Nov), Growth Loop Map V1.2, the Mandate substrate spec V1.4, its runbook and acceptance report.
**Scope:** design only. Adoption authorises no implementation, deployment, PR closure, model spending or production change. Each build keeps its own task and prompt.
**Destination:** `docs/design/20261112_PRACTICE_FIELD_CONCEPT_V6_1.md`, carried by the first build's commit (T0a) with the audit report and Astra's three reviews in `docs/audits/`. No docs-only PR.

## 0. What changed since V6

Astra kept the direction and rejected the implementation contract. All twelve findings are folded in (Appendix A). In plain terms:

- **Each idea keeps its own books inside the book.** Reserved capital, shares, costs and proceeds per idea, reconciled to the whole after every change. Two ideas may not hold the same stock in the pilot.
- **Rails are numbers the gate enforces,** not descriptions. The engine's 15-position limit stands, so an idea holds one to four names in the pilot.
- **Hedging becomes a risk budget.** My inverse-fund offset did not reduce the loss it claimed to reduce. Release 1 caps the book's remaining loss to its lines and meets the cap by sizing and trimming. The offset is a release 2 experiment with a matched comparison.
- **Code enters, exits and settles; the model manages.** Entering an idea is a basket fill by code at the first eligible observation after admission. Exits at a line and settlement at a review run as code. The model's one action per check manages what is held.
- **Automatic entry passes the full gate,** not a shape check: a typed contract, authorised sources, a resolved comparison, sufficient data, reserved capital and data coverage, and every execution limit.
- **"Validated" is gone.** A result has separate columns: did the stated condition hold, was it ahead or behind its comparison, did the agent follow its plan, how strong is the evidence, what was adopted.
- **The book is pinned to an explicit manager,** with epochs, independent of which game loadout is active.
- **A nomination is not a test.** A Film Room card the player offers is queued, considered, then accepted, deferred, declined or expired. `testing` starts at the first executed fill.
- **Data coverage is reserved before entry.** The shared price list protects held names and shrinks the candidate list; it is not a hard cap and is not treated as one.
- **The idea book is a new product kind on the Mandate engine,** with a dated supersession note on the Spec 1 documents and its own acceptance matrix.
- **Wording:** the agent proposes, manages within enforced limits and explains; deterministic code settles outcomes. What the book produces is experience-informed adaptation, not training and not established improvement. Claims about production history are qualified as audit-reported.
- **An account-level pause** stops new drafting and spend and winds the book down without trading buttons in the book.
- **The build is reordered** around an end-to-end accounting test before anyone sees a screen.

## 1. The promise, and the loop

Your agent develops ideas from your shared activity and its own private experience. The Practice Field follows those ideas in a paper portfolio across three horizons. It records what the agent expected, what it did, what happened, and what remains uncertain. Completed observations inform new proposals. Separate controlled tests evaluate changes to the agent's methods. The Forge presents specific, current changes for your approval before they reach your deployed agent.

| Stage | What happens | Owner | State on `main`, 12 Nov |
|---|---|---|---|
| Sources | The player plays, picks in SignalDrop, talks to the agent, reviews in the Film Room. Each leaves a record | Cockpit, SignalDrop, chat, Film Room | Live or allowlist; cards not yet in production |
| Idea | The agent drafts an idea from those records; code validates its contract, reserves capital and data, and admits it if a slot is open | Practice Field | The idea record exists (list, horizon, review date); drafting, validation and reservation do not |
| Book | Code fills the idea's basket. The agent manages the book twice a day within the rails, with a written reason per action. Code exits at a line and settles at a review | Practice Field, on the Mandate engine | Engine built and switched on; the audit reported no book created; not independently verified |
| Result | At the review session or at the line: the five-column result (§4) | Practice Field | Risk metrics exist; no result record |
| Forge | An idea whose conditions held and which finished ahead, and which still fits the next game, arrives as an offer: equip it and its list, or not | Forge, from a Practice Field build declared once to the hub chat | Equip endpoints exist; no offer |
| Film Room | A result links back to the review that produced the idea; the agent reads its own completed ideas when drafting the next | Film Room, Practice Field | — |

## 2. The book

- **One book per player,** $100,000 of paper money, a new product kind on the Mandate engine, which supplies the paper book, fills with modelled costs, splits and dividends, the daily close and its rows, and one shared price snapshot for every book.
- **The manager is the test version of the player's agent:** the engine's model seat running a frozen snapshot of the agent's settings (archetype identity, equipped list and idea version, leans, tempo, rule bundles), with a manifest of what it received and a measured check of which settings move its decisions (T1b). Not carried in release 1: game memory and the wisdom paragraph. Labelled "Test version of your Trend Follower" until behaviour matches the declared settings.
- **A manager epoch** pins the model, settings snapshot and contract versions. An idea keeps its epoch to settlement. A new epoch opens only by an explicit migration policy; nothing is repinned under a running idea.
- **Two checks a day, pinned for every archetype.** One management action per check (add, trim, sell, hold), with two to five sentences of reason. Entries, line exits and review settlement are code, not model actions.
- **Pause and wind-down** live in account settings: stop new drafting and spend, let running ideas settle, keep every record. Pausing never extends an idea's clock.
- **The book never trades a battle and a battle never reads the book.**

## 3. Slots and rails

| Slot | Horizon | Share of the book an idea may reserve (S1) | Judged |
|---|---|---|---|
| Short | 10 sessions | up to 20% | at session 10, or earlier at its line |
| Medium | 30 sessions | up to 30% | at session 30, or at its line |
| Long | 60 sessions | up to 40% | at session 60, or at its line. Daily swings change nothing |
| Cash | — | at least 10% (S2) | — |

Every entry and add must satisfy, at decision time: the idea's remaining reserve, the single-position cap (35%), the sector cap (the archetype's count translated to a share, §16 ruling 25), the 15-position limit, the cash floor, and the risk budget (§6). The tighter limit binds, and the manager is shown its effective headroom and every binding constraint, never just the first failure. Cash is a valid allocation.

| Archetype | Sector cap after translation | One-stock ceiling, short / medium / long |
|---|---|---|
| Trend Follower, Fundamental Investor, Contrarian | 50% | 20% / 30% / 35% |
| Speculator | 66⅔% | 20% / 30% / 35% |
| Diversifier, Capital Preserver | 33⅓% | 20% / 30% / 33⅓% |

Proposed arithmetic for an otherwise empty book; existing exposure in other slots reduces every headroom.

- **Names per idea: one to four (S3).** Three full slots are twelve positions under the engine's limit of fifteen.
- **Line distances are numbers (S5):** a short idea's price line sits 3% to 8% below entry, a medium idea's 6% to 15%, a long idea's 10% to 25%, proposed defaults; an archetype policy may narrow them in release 2.
- **Appreciation above a cap blocks further buys and does not force a trim,** unless the risk budget requires one.
- **Intraday ideas (2 sessions) are excluded.**
- **Premium adds slots** when an entitlement system exists; the slot count is read from one function.

## 4. An idea

The contract is frozen at admission and shown on the screen.

| Part | What it is |
|---|---|
| Thesis | One sentence in the agent's words, labelled as the agent's, with its author and sources |
| Slot | Short, medium or long |
| Names | One to four stocks with reserved data coverage |
| Comparison | Matched to the subject: a single stock against the same quantities held unchanged; a sector against its fund; a theme against a frozen basket of its own names; an industry against its fund or a frozen basket. The comparison keeps its initial quantities except for corporate actions, holds unused capital as cash, pays the same cost policy and receives the same distributions. SPY is a second line for context. The screen names the question the comparison answers |
| Wrong if | A typed price line per holding: operator, threshold, observation basis (completed-session close), due time. An event condition is recorded and shown but is observational in release 1; every admitted position still carries a price line |
| Capital | A fixed initial amount reserved at admission, inside the slot cap, the archetype's caps and the risk budget. Proceeds stay in the idea until it resolves |
| Risk at the lines | Remaining marked loss to lines: Σ shares × max(current mark − line, 0), as a share of marked book equity; the exit-cost estimate shown separately. It assumes exits at the lines on the next eligible fill; gaps and missing observations change the realised loss, and the label says so. A breached line is its own state, never a zero |
| Sources | SignalDrop pick, game moment, chat exchange, Film Room card or "agent's own", by id, with verified attribution |
| Entered | The basket fill by code at the first eligible observation after admission; the start mark and its time |
| Review | The scheduled session on which it is judged |

**Lifecycle:** drafted → accepted → entering → holding → line hit, exit pending → settled → resulted → offered or not → retired. Run status, result and adoption state are kept apart.

**The result has five columns.**

| Column | States |
|---|---|
| Contract condition | met / breached / unobserved |
| Economic result | ahead / behind / within band / unmeasurable |
| Process quality | followed plan / deviated / blocked by data or execution |
| Evidence scope | single forward observation / repeated comparable observations / controlled experiment |
| Adoption | no offer / offered / accepted / expired / retired |

- **The main labels are ahead, behind and inconclusive.** "Validated", "proven" and "supported" do not appear. A breach and an economic result coexist; neither overwrites the other.
- **The no-difference band (S4)** is 0.25% of the idea's own frozen initial capital, versioned before entry.
- **The review endpoint** is the idea's value at the scheduled session's post-close snapshot. The liquidation that frees its capital happens at the next eligible observation and has its own receipt; the slot refills only after that cash settles.

## 5. How ideas enter

- **The agent drafts; code admits.** When a slot opens, one drafting call proposes up to three structured drafts (S6) from the player's own sources, the agent's completed ideas for this archetype, and the approved methods packet. Code validates each draft against the contract and the gates. No per-idea player approval.

| Check | Deterministic part | What stays judgment, and is recorded as such |
|---|---|---|
| Thesis | Present, bounded, with author and source references | Plausibility and mechanism |
| Horizon | Supported slot, trading calendar covers the whole window, fixed start and due session | Whether the mechanism fits the horizon |
| Names | Normalised symbols, reserved coverage, data completeness, not held by another idea | Whether the names express the thesis |
| Comparison | Supported type, exact identifier, quantities, prices, cost policy | Suitability, unless chosen from a reviewed mapping |
| Wrong if | Typed operator, threshold, basis, due time | Any event or thesis interpretation |
| Capital | Atomic reservation including costs and the cash floor; every execution limit | The agent's preferred size within the limits |

- **Reservations are atomic and ordered.** Capital and data coverage are reserved before entry; two drafts cannot spend the same balance; a draft that loses the reservation is queued or refused with a reason. Mandatory reductions and due exits precede optional entries.
- **A draft that fails stays visible** in a private "considered" list with its reason and version. Retries are bounded: one refill attempt per slot per session.
- **If nothing passes, the slot sits in cash and says so.** "No idea passed today" is an honest state.
- **Nominations.** A Film Room card the player offers becomes a nomination: queued → considered → accepted, deferred, declined or expired, with the reason. A nomination is never shown as running.
- **Sources are the player's own, with verified attribution.** A SignalDrop pick or a chat carries no archetype stamp at creation, so nothing is assigned to the current archetype by inference; attribution is recorded at the time or the source is excluded.
- **Later:** a player-approval mode is one ruling, not a redesign.

## 6. Risk, as one rule

- **The rule.** The book's **remaining marked loss to lines** (§4) may not exceed S7 of marked book equity (lean 8%). Code enforces it by sizing new entries smaller and, under a frozen policy, trimming the idea with the largest contribution until the book is under budget. Cash is the unallocated balance, not a credit against risk.
- **What the player sees.** Each idea's loss to its lines, the book's total against the budget, every trim the rule caused and why, and a one-sentence explanation of the rule.
- **No offset instrument in release 1.** An inverse fund does not reduce the loss to a stock's line, and most track daily moves, so over weeks they mirror nothing. The **offset experiment** is release 2: its instrument, scenarios, sizing, reset policy, matched no-offset comparison and evaluation are specified before activation; it reports net return, drawdown, tail losses, exposure and offset costs, distinguishes protection from timing, and reads inconclusive when no risk event occurred. The Charter's protection-value rule governs it; there is no automatic scrap-by-cost rule.
- **Why it is still the hedging lesson.** Risk is sized before the outcome, every day, in dollars the player can see.

## 7. What the player sees

- **The book.** Value, the gap to SPY, loss to lines against the budget, cash.
- **Three rows, one per slot.** The thesis, the names, the idea's gap to its own comparison, the horizon clock ("day 12 of 60, not judged yet"), its risk at the lines, the status chip, the agent's latest note. A long idea's row does not change colour on a bad day.
- **The chart.** The book against SPY; tap a row for the idea against its comparison, with the question that comparison answers.
- **The result card.** The five columns, the gap after costs, the largest decline between recorded closes, trades and costs, invested exposure, data quality, the agent's closing note, the one-observation label, and the Forge offer when one applies.
- **The record, by horizon.** All attempts from the first, including inconclusive and refused; a repeat line after two comparable completed runs. Two is a screen threshold, not a statistical one.
- **The next idea,** announced when a slot refills: the thesis and where it came from. Or "no idea passed today".
- **No buttons in the book.** The player reads. The Forge is the only decision. Pause lives in account settings.
- **Ways in:** the hub's Archetype area card, the Film Room receipt on a nominated card, the Forge when an offer waits.

## 8. Honesty rules

- **One idea is one observation.** The result card says so.
- **Comparisons are matched, not merely simultaneous:** same start mark, same cost policy, fixed quantities except for corporate actions, same distributions, same end mark.
- **Fills follow the information.** A decision's fill is the first eligible observation after it, never a price older than the information the decision used. A carried-forward mark or a receipt-time substitute never qualifies as a fresh fill for a full-quality result. Values are "post-close snapshot values" until an official-close source is verified.
- **Missing data stays visible** and prevents a full-quality result.
- **Size with counts.** The largest decline, costs and exposure sit beside every gap. The engine's composite score is not shown as confidence. Conviction is a diagnostic.
- **Market and game stay apart.**
- **Horizon is respected.** An idea is judged at its review or at its line.
- **The agent's words are quoted, not rewritten,** with their time, unverified. Deterministic code settles conditions and economic results; the agent's interpretation is shown as unverified.
- **An outage never extends an idea.** Actions after a cutoff are refused; a missed valuation is recovered from the scheduled session's prices or recorded as inconclusive.
- **The book changes the deployed agent only through the Forge, only when the player confirms.**

## 9. What reaches the agent

| Where | What it may see |
|---|---|
| **The deployed agent's battle and draft prompts, memory, consolidation** | Nothing from the book |
| **The book's manager** | Its frozen settings snapshot, the book's state and effective headroom. The one exception to "nothing reaches a prompt before installed", granting no deployed-agent, memory, cross-player or cross-archetype access |
| **The drafting call** | A bounded envelope: identity, schema and methods (about 1,500–2,000 tokens), selected sources (up to 3,000), prior outcomes (up to 1,500), for up to three structured drafts. Opaque local source labels, resolved server-side; no full chat histories, screenshots or raw identifiers. Design budgets, measured before activation |
| **Another player, another archetype, the shared knowledge base** | Nothing |

The drafting assembler and its inputs join the Mandate honesty registry and its sweep. Nothing from the Practice Field is added to a battle prompt under any of these tasks.

## 10. Ownership and the Charter

- **The book has an explicit owner, attribution agent instance, archetype identity and version, and manager epoch.** Game loadout changes do not move it. On an explicit Practice Field manager switch the old book stops refilling, takes no new risk, continues reductions and settlement under its original pin, and when every idea and receipt has settled, one atomic handover passes the remaining cash to the new epoch. Cash is never reset to $100,000. The old record stays readable to the player and its originating archetype only.
- **The partnership record stays with Shadow and the player.**
- **What release 1 claims.** Release 1 uses the originating archetype's private observations to propose subsequent ideas. This is experience-informed adaptation. It does not change model weights, establish a repeatable advantage, or install a deployed-agent policy. Economic outcomes and explanatory hypotheses stay separate.
- **The strategy-change path is preserved.** A portfolio idea and a strategy-change proposal are different artifacts. A completed idea may motivate a proposed rule, indicator, filter or risk policy; that proposal receives a candidate version, a baseline, required inputs and a test plan, goes through offline implementation and validation (the archetype arc's work), and is then compared in release 2 branch books without skipping development and confirmation. The live book is not evidence that a rule change improves outcomes; it supplies observations and questions for that work.
- **Author and origin are explicit.** An agent-authored proposal carries its author field and never masquerades as the player's own idea version.
- **The Charter stands.** Its bar on per-user market-alpha promotion holds; its older cross-user aggregation language does not authorise exporting this private experience; shared contract V2 states the book's exclusion. Release 1 needs a reconciled scope addendum, not a loosening.
- **The player chooses what gets adopted, not what gets tested.** The 10 Oct "player picks the moment" ruling becomes optional nomination of a source.

## 11. The record

- **The book,** a product kind on the engine, with its epoch, settings snapshot and manifest.
- **Ideas,** each a sub-ledger: reserved cash, quantities, basis, costs, corporate-action receipts, flows, per-idea valuation rows with cash, quantities, marks, price quality and comparison holdings and value; the inception row before costs; the contract and its version; the five-column result.
- **Nominations and considered drafts,** with reasons and versions.
- **The evidence packet:** a bounded, immutable snapshot of the sources and prices a decision and a result relied on, kept beyond the engine's 120-day snapshot retention, with defined access and deletion. References alone do not recreate expired content.
- **Card stages:** `testing` at the first executed fill; `tested` at any terminal result, including inconclusive; a `testing` card counts as open; a `tested` card counts until parked or retired; the reserved `drilled → drafted → proven` stages are dropped; the shared vocabulary is versioned and every reader migrated together; history is never rewritten. A shelved card whose idea is still running gets a narrow server transition to settle and receive its `tested` receipt.
- **Three states kept apart:** run status, result, adoption.
- **Shared contract V2** specifies the idea record, nominations, card stages and the Forge offer. This chat writes it.

## 12. Hand-offs

**Sources → book.** Automatic: drafting, validation, reservation, admission. A Film Room "send to test" is a nomination with priority at the next refill, which the agent may decline with a reason.

**Book → Forge.** An idea whose contract condition was met and which finished ahead becomes a typed offer only if it still applies: current horizon fit, archetype compatibility, expiry, exact version and a supported install target. The offer names what it changes (a stock list, an idea instruction, a setting, a rule version). Adopted ideas are labelled player instructions. Retiring an offer keeps its evidence. Ideas that finished behind or inconclusive stay available to the agent's drafting as questions, never as installs.

| Offer | Writer | Takes effect |
|---|---|---|
| Equip the idea and its list, naming the exact version | the watchlist and idea endpoints | next battle, at the existing freeze boundary |
| Retire the idea | the book and the card ledger | at once |
| Set a lean, dial or bundle (release 2) | the equip endpoints | next battle |
| A new rule version (release 2) | the archetype arc's install route (ID-4) | by that route |

**Book → Film Room.** A result links back to the review that produced the idea.

## 13. Cost and capacity

| | Per player per month (21 sessions) |
|---|---|
| Manager, two checks a day, direct | $0.63 (planning figure; the real prompt is measured in T1b) |
| Drafting, about 3 refills a month at full occupancy, up to 3 drafts each | about $0.05 at the design envelope; measured before activation |
| Release 2 branch book, when running | $0.63 |
| Market data | flat for names already in the shared list; about 6 to 16 units a day per name outside it |

- **The $3 monthly bound per book (S9) is a hard admission and spend reservation,** with retries and unpriced calls counted and an honest exhausted-budget state. Valuation and settlement continue without model calls.
- **Data coverage is reserved, not assumed.** Held names, pending idea names and comparison funds are reserved against an authoritative membership version; admission fails visibly when the budget would be breached. Thirteen players with disjoint twelve-name books already approach the list's nominal size; T5 expands it, T1 accounts for it from the first book.
- **Capacity ceilings are not tested figures:** about 50 book visits per check window as written. A founder cap of 4 books (S8) and an expected-versus-observed check ledger ship with the first book.
- **Today's idle acquisition** stops in T0c, with the qualification in §15.

## 14. What exists and what is missing

| Piece | Status |
|---|---|
| One paper book per user, fills with costs, splits and dividends, daily close and rows, risk metrics, one shared snapshot, capital carried across periods, idempotent execution | Exists: the Mandate engine. The prior audit reported it switched on with no book ever created; not independently verified in review |
| Idea record with a list, a horizon class and a review date | Exists, allowlist only |
| SignalDrop picks, game moments and tape, chat exchanges, Film Room cards | Exist in their own stores, owner-ruled; cards not yet in production; no archetype stamp on picks or chats at creation |
| Benchmark and sector fund prices | Collected by other jobs as latest values; must join the engine's valuation build with a dated series and an ETF classification for costs, sectors and corporate actions |
| The agent's written reason per decision | Produced and dropped |
| Per-idea sub-ledgers, reservations, basket entry, line exits and settlement by code, horizon rails in the gate, the risk budget, drafting and validation, nominations, the five-column result, the manager epoch and settings snapshot, the evidence packet, the screen | Missing |
| Catalyst records, industry lists, versioned themes, one sector list, an entitlement system | Missing |
| **Bug:** the sector cap copied as a count and checked as a share | Confirmed; fixed in T0a |

## 15. Order of work

| # | Package | Delivers | Size |
|---|---|---|---|
| **Design lock** | V6.1 adopted; shared contract V2; the Charter scope addendum; a dated supersession note for the Spec 1 runbook and acceptance report | — | — |
| T0a | Sector-cap translation at the frozen-config boundary (2 → 1/3, 3 → 1/2, 4 → 2/3), versioned, new vintage, admission rejects an uncorrected profile, boundary tests. Carries this concept and the reviews into the repo | Correct limits | Small |
| T0b | Store the agent's reason and conviction on the decision record, bounded, attributed, direct and batch | The notes | Small |
| T0c | Skip new market-data acquisition only when no active book and no outstanding execution or settlement duty requires it; continue cancellation, billing, receipts and cleanup; recheck every fire; never write an empty snapshot | Idle waste stops | Small |
| T1a-1 + T1c | Book and idea identities, atomic reservations, per-idea sub-ledgers, the inception row, basket entry and post-decision fills, costs, corporate actions, the passive comparison, benchmark and fund series, ETF classification, price labels. Synthetic fixtures first | The accounting | Medium to large |
| T1a-2 | Lifecycle, cutoffs and recovery, line exits and settlement by code, deterministic five-column results, owner access, retained evidence packet, calendar check, spend reservation, check ledger. Exercised with one, two and three overlapping ideas, same-symbol refusal, simultaneous reservations, drain, gaps, late jobs and restart | The plumbing | Medium to large |
| T1b + T1d | The frozen settings snapshot and manifest, the measured check of which settings move decisions, the small methods packet, bounded drafting sources, the contract validator, the considered queue, the refill budget | The agent fills the book honestly | Medium |
| T1e | The risk budget: loss to lines, the book cap, sizing and the frozen trim policy, the one-sentence explanation | Risk made visible | Small to medium |
| T1f | Founder-only three-slot screen behind its own flag and server-only uid list, opened after an end-to-end synthetic run reconciles; a smaller name limit if eight names were ever contemplated | The first watchable book | Medium |
| T2 | Nominations, `testing`/`tested`, the versioned stage vocabulary across every reader, shelving with the settlement exception, the return link | Cards feed the book | Small to medium |
| T3 | Forge offers with applicability checks, adoption and rollback record, proof of no running-battle mutation; the Forge slot declared once to the hub chat | The loop closes | Medium |
| T4 | Release 2: branch books for changes to the agent, including the offset experiment, with common evidence cutoffs, capital, opportunity sets, cost policy and schedule; the archetype arc's candidates as inputs | Tests of changes | Large |
| T5 | Measured capacity, the membership budget, paging, the slot-count function and premium, calendar maintenance | More players | Medium |
| T6 | Subject records: catalyst events, industry lists, versioned themes, one sector list | More kinds of idea | Medium each |

The first watchable book also needs, inside these packages: a supported calendar through every due date, incomplete-data states, the pause and wind-down control, current-capacity visibility, idempotent restart, source-access tests, and a visible distinction between a running observation and a qualified strategy change. After T1f the screen's design round runs from real book days.

## 16. Rulings for the founder

Proposed rulings awaiting explicit approval. Answer "yes to all" or name the numbers. ◆ marks items new or changed since V6.

1. **Adopt V6.1** in place of V3 and Amendment A; V4, V5, V5.1 and V6 withdrawn.
2. ◆ **The idea book is a new product kind on the Mandate engine.** The quarterly Spec 1 format is retired as a product with a dated supersession note on its runbook and acceptance report; the engine stays; the idea book gets its own acceptance matrix and operating procedure.
3. ◆ **Stop idle data acquisition by the qualified skip** in T0c, not by switching the engine off.
4. **Close PRs #760, #761 and #762.**
5. **Season Mode stays dead;** keep only its "you vs SPY" chart.
6. ◆ **The agent drafts; code admits.** No per-idea player approval. Admission requires the typed contract, authorised sources, a resolved comparison, sufficient data, reserved capital and coverage, and every execution gate.
7. ◆ **No buttons in the book.** The player reads; the Forge is the only decision. An account-level pause stops new drafting and spend and winds the book down, preserving every record and never extending a clock.
8. **Three slots: short 10, medium 30, long 60 sessions,** one each for every player; intraday excluded; premium adds slots when an entitlement system exists.
9. ◆ **Rails (S1, S2, S3, S5):** slot caps 20% / 30% / 40%; cash floor 10%; one to four names per idea; price-line distances 3–8% / 6–15% / 10–25% below entry by horizon; the archetype's caps and the engine's 15-position limit bind where tighter; appreciation above a cap blocks buys and does not force a trim.
10. **The manager is the test version of the player's agent** on the engine's model seat with a frozen settings snapshot and epoch; game memory and the wisdom paragraph not carried; labelled "Test version of your Trend Follower".
11. **Starting paper money: $100,000** per book; an idea's capital is a fixed reservation at admission.
12. ◆ **Comparisons per subject as §4,** fixed quantities except for corporate actions, same cost policy, cash earns nothing, end marked to market at the scheduled session, SPY as a second line.
13. ◆ **Entries, line exits and review settlement are code;** the model's one action per check manages what is held.
14. ◆ **Risk as one rule (S7):** remaining marked loss to lines capped at 8% of marked book equity, met by sizing and the frozen trim policy; no offset instrument in release 1; the offset experiment is release 2 under the Charter's protection-value rule.
15. ◆ **Result words:** ahead, behind, inconclusive, beside the five columns in §4; "validated", "proven" and "supported" never appear; the band (S4) is 0.25% of the idea's frozen capital.
16. **Store the agent's reasons,** quoted and unverified; conviction as a diagnostic, never shown as confidence.
17. ◆ **Nothing from the book reaches the deployed agent's prompts, memory or consolidation.** The manager and the drafting call read only what §9 lists; the drafting assembler joins the Mandate honesty registry.
18. ◆ **Drafting sources** are the player's own with verified attribution: SignalDrop picks, game moments, conversations with their agent, Film Room cards, the agent's completed ideas for this archetype. No inference of archetype from current state.
19. ◆ **Forge offers** are typed, never automatic, and shown only when the idea's conditions held, it finished ahead, and it still applies (horizon fit, compatibility, expiry, exact version, install target). Release 1 offers: equip the idea and its list; retire.
20. ◆ **Manager switch:** explicit assignment only; the old book takes no new risk, continues reductions and settlement under its pin, and hands over its settled cash atomically; the record stays with the old archetype.
21. **Price labels:** "post-close snapshot value" until an official-close source is verified; fills at the first eligible observation after the decision.
22. ◆ **Pilot controls:** direct transport; a founder cap of 4 books (S8); a $3 monthly spend bound per book (S9) as a hard reservation with an exhausted-budget state; data coverage reserved before admission.
23. **Release 2 follows release 1** and consumes the archetype arc's offline candidates; the offset experiment runs there.
24. **This chat writes shared contract V2** and the Charter scope addendum, handed once to the Film Room chat and once to the architecture chat; the hub chat receives one note about the Forge offer slot when T3 is specified.
25. **Sector-cap translation 2 → 1/3, 3 → 1/2, 4 → 2/3,** versioned, new vintage; the fenced archetype table is not touched.
26. ◆ **Refill bounds (S6):** up to three drafts per drafting call, one refill attempt per slot per session.

## 17. Limits

- **A result is one observation.** The record over repeats, by horizon, is where a player learns what their agent is good at.
- **Fills are paper:** delayed quotes and modelled costs, no real liquidity.
- **Release 1 risk management is sizing and lines.** It teaches the lesson; it is not insurance.
- **The agent's ideas will sometimes be dull, refused or wrong.** "No idea passed today" will happen, and an empty slot is a result.
- **Capacity and cost are planning figures** until T1b measures the prompt and T1a-2 measures the sweep.
- **Everything so far is founder and tester play.**

## Appendix A. Disposition of Astra's V6 findings

| Finding | Disposition | Where |
|---|---|---|
| C6-01 Separate the shared book from each idea's accounting | Accepted | §4, §11, T1a-1 |
| C6-02 Rails as executable limits; the 15-position cap; numeric widths; pinned cadence | Accepted; names per idea 1–4 | §3, rulings 9, 13 |
| C6-03 Replace the hedge arithmetic; no inverse-fund credit; delete the scrap rule | Accepted; risk budget in release 1, offset experiment in release 2 | §6, ruling 14 |
| C6-04 Automatic entry needs the full gate; standing-text amendments | Accepted | §5, §10, ruling 6 |
| C6-05 Source provenance, bounded retrieval, prompt contract, honesty registry | Accepted | §5, §9, §11, ruling 18 |
| C6-06 Separate economic result, thesis evidence and process quality; band per idea | Accepted; "validated" dropped | §4, ruling 15 |
| C6-07 Retiring the quarterly product needs a versioned lifecycle and supersession notes | Accepted | §2, ruling 2 |
| C6-08 Pin the manager independently of game loadouts; drain semantics; shelved-card settlement | Accepted | §10, §11, ruling 20 |
| C6-09 Reserve symbol capacity; describe the cap accurately | Accepted | §13, ruling 22 |
| C6-10 Nomination record separate from the card lifecycle; `testing` at first fill | Accepted | §5, §11 |
| C6-11 Six text edits; Forge applicability; pause control | Accepted | §1, §8, §10, §12, rulings 7, 19 |
| C6-12 Reorder the build; qualify T0c; one-action fill limit; cost controls in the first book | Accepted; plus the basket-entry rule (Fable) | §2, §15, rulings 3, 13, 22 |

## Appendix B. What carries forward from V3 and Amendment A

| From | Now |
|---|---|
| §3 what a better partner is | Stands |
| §6 three fixed situations and the cockpit button | Stand; `down` and `good_lead` are release 2 game-state tests |
| §8 the drill, the vote, the reveal with the swap tax | Stand as an optional later activity ("Chase or hold") |
| §8.5 proof as fidelity + no harm; A4 control plays | Replaced by §4, §8 and §10 |
| §9 one door | Replaced by §9 here, with the narrow Practice Field exception |
| §10 league film | Parked under §10 ownership |
| A1 two information sets; A2 five fields; A3 vote agreement and "can't tell"; A5 development and confirmation; A6 `thesis_broken` | Stand, for the drill and for release 2 |
| A4 rule-version plays | Stand as the release 2 "new rule version" offer by the archetype arc's route |
| The 10 Oct rulings | Stand except where this document says otherwise; "the player picks the moment" becomes optional nomination |
| The reset of the failure-built paragraphs | Still to run, on a weekend |
