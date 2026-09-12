# Forge Record — Design Spec V1.1

**Date:** September 12, 2026
**Status:** Build-governing for step 0 on commit to `docs/`. Not Phase 0-verified: every [doc] / [assumed] tag stands until CC Phase 0 confirms it. Path: commit V1.1 → CC Phase 0 against §10 (read-only, hard STOP, file:line citations) → founder rulings on the Phase 0 report → V1.2 only if Phase 0 changes a decision → build per §11.
**Owner:** Flash
**Workstream:** Forge Record arc — the background stream running alongside the BaggerBomb Command Center arc. Coupling rules in §7.
**Position:** Sits below `AGENT_LEARNING_CHARTER_V1.md` (governs anything called a lesson) and `FORGE_RULES_THESIS_V1_2.md` (governs what a rule is). Sits above the bench-level specs. Governs what the Forge *is* and how every item on it is labeled. Does not specify the regret miner — that is `AGENT_LEARNING_PHASE_B_DESIGN_V1.md`, written after Phase 0 so it is grounded in the real corpus.
**Companions:** `SCOUTING_FOCUS_FOUNDATION_DESIGN_V1_1.md` · `SCOUTING_FOCUS_BUILD_SPEC_V1_3.md` · `STRATEGY_LAYER_AND_ARCHETYPE_V2_BOOKMARK.md` · `ARCHETYPE_IDENTITY_CONTRACT_V1.md` · `FORGE_RULES_VISION_AND_IMPLEMENTATION_CONTEXT.md` · `CONVERSATION_TO_RULE_PIPELINE_QUICK_REFERENCE.md` · `20260822_ASK2_REQUIREMENTS_BOOKMARK.md` · `FANTASYTRADES_PRODUCT_STATE_AND_DESIGN_SYNTHESIS.md` · `SOL_BLIND_REVIEW_PROMPT_FORGE_RECORD_V1.md` and the two Sol responses of Sep 12 (review ledger in §15).

**Version notes:**
- **V1.0** (Sep 12, 2026): initial draft from the Sep 12 Forge review.
- **V1.0.1** (Sep 12, 2026, pre-review self-edit): "Learned" reserved for Trial-proven, "On trial" added; chat-origin endorsement gate; H1 scoped; C2 race; Q-05b; ledger glossary.
- **V1.1** (Sep 12, 2026): folds Sol's blind review — findings S-1–S-22, the Charter conformance pass, and directed answers B1–B7 — under founder rulings approved Sep 12. Headline changes: **step 0 ships no counter proposals and no agent-initiated rule proposals** (S-1, S-4, S-12, S-17, S-18; RF-03 cut outright, S-19); a Hunch is never equippable and Accept means entering a trial at Testable (S-1); provenance stamping is unconditional with the schema and enforced by a writer-supply guard, the flag gates rendering only (S-2, S-3); the Ledger has two kinds from birth — intent and lesson — and step 0 writes intents only (S-8); chat-origin cards quote the user verbatim and enter only on an explicit gesture (S-9, B3); `originRef` added (S-6); migrated items render "source not recorded" (S-7); inbox/canonical migration rule (S-11); client stamping constrained by Firestore rules (S-10); discipline-duplicate check at Accept (S-5); active bench authoritative, Ledger equip state derived (S-22); H1 restated as a state-based test and `deployedGuardrails` flagged for classification (B2); C3 is a hard gate with named conditions (B6); the passive-user consent path is assigned to Phase B under D-l (S-21); Q-18–Q-20 added; §15 records every finding's disposition. Thesis LD-4 verified; LD-5 condition met; LD-26 recorded as outstanding.

**Verification stance.** Written from the project record and the Sep 12 Forge screens, not from a live-code audit. Every field, file, and component name is tagged **[seen]** (visible in shipped screens), **[doc]** (from a project document — verify at Phase 0), or **[assumed]** (Phase 0 confirms or strikes). Nothing is locked until Phase 0 confirms the reference. The field-reference lesson from the Enforcement arc applies: a spec that names a field the code doesn't have is a silent-failure bug in waiting.

---

## 0. Why this document exists

The Sep 12 review of the shipped Forge (three benches: Watchlists · Rule bundles · Character) reached three findings, all accepted:

1. **The components are right; the frame is wrong.** The benches are the correct compile targets — the Charter's own rule is that every T1 lesson compiles into an existing control (lean, dial, rule paramValue). But the Forge presents them as the user's primary *authoring* surface, in engine vocabulary, for a user (User 3) the product lens defers.
2. **The UI is not built for Users 1+2**, and the June rulings already said so: "most users should experience the full power of their agent without building anything" (Scouting Focus Foundation §1); execution dials cut because two customization systems is the overwhelm being escaped (Foundation §3). The Rules Thesis LD-26 novice readouts — "What your agent will do" card, Risk Preview — are not on the shipped benches. Two honesty defects are visible: the Character bench reports `0 / 2 SLOTS` while rendering two dead leans from another archetype; the one "What this changes" line present is the same sentence under two different leans.
3. **The growth loop is designed and unbuilt.** The Charter's lesson card — claim, honest denominator, maturity tier, compiled control with provenance, points-since-adoption — is the artifact the Forge is missing. Phase B has no build record; the Aug 22 bookmark records that nothing learns whether an exit was good. The dossier that does exist (`consolidatedInsight`, `disciplines`, `lessons[]`, `forgeSuggestions[]` [doc]) has no user surface; `forgeSuggestions[]` is a dark write.

The adversarial review sharpened the second half of the answer: a growth loop *shown* before its machinery exists is finding 3 in a new coat. So this document is the record contract, and the learning science is adjudicated once, in Phase B, not twice.

---

## 1. The thesis

> **The Forge is the agent's record: what it hunts, how it decides, who it is, and what it has learned with its owner. Every item on it carries where it came from. Authoring is one of three ways an item gets there — the other two are proposal and learning. The Forge is read far more often than it is edited.**

The product rationale in one line: **authored is copyable; earned is not.** Two Contrarians diverge on what they hunt, what they've been told, and what they've learned with their owners. Only the third compounds, and only the third can't be rebuilt from a screenshot of someone else's loadout (Charter §7 corollary: the agent depreciates outside the arena). Today the Forge shows the first two. Time spent *building* is a weak moat; battles played that compound into an agent nobody else can reproduce is the strong one.

### 1.1 What the thesis commits us to

- **Three benches stay.** Bench 1 — what it hunts (watchlists / scouting focus). Bench 2 — how it decides (rule bundles, and any per-agent hard constraint derived from the user's own strategy work — see §5.5). Bench 3 — who it is (archetype, standing leans, and the dossier's reflections). No new bench: a learned item lands on the bench its control lives on. A fourth "lessons" bench would be a second source of truth for the same controls.
- **The third column.** Every bench item carries provenance (§3) — You / Proposed / On trial / Learned / Default, or the honest "source not recorded" state. This is the attachment mechanic: "why is this in my agent?" is always answerable, from the item, in one tap (Charter §5, item 4) — including for items whose source is unknown (S-7).
- **The Ledger.** A surface for the user's recorded intents (step 0) and, with Phase B, lessons (§4). It never trades. Accepting a Ledger item compiles it onto a bench through the existing equip pipeline — Charter P1: learning proposes, the control system disposes. **A Hunch is never equippable.** A lesson may enter trading only by entering a trial at Testable, and nothing before Phase B can reach Testable (S-1).
- **Two-way — with Phase B.** The agent proposes, not just the user, once the maturity machinery exists. Step 0 ships no agent-initiated proposals (Thesis LD-4, S-4); it ships the plumbing that lets the user's own chat suggestions land, and the record contract that Phase B lessons compile into.
- **Reading first.** The Forge home is the record — what changed since the last visit, then the benches — not the builder. The builders remain one tap away and unchanged.
- **Conversation is the front door** (§6), sequenced behind the Command Center arc's prompt-side work because it touches the same files.
- **Honesty inherits.** Forbidden-terms test, receipts-first, client-honest / server-authoritative, never claim more than the system can prove (§8).

### 1.2 Standing decisions this document does not reopen

- Users 1+2 are the design lens; User 3 is deferred.
- Rules Thesis §2.1 ("rules are authored, not learned") **stands at the data model** and is **amended at the UX layer only**: authored and learned items sit side by side on the same benches, distinguished by provenance, and enter through the same gated controls. Nothing learned gets special authority (Charter P1, §8).
- **Thesis LD-4** — agent-initiated rule proposals deferred to post-launch — is honored, verified against the Thesis text (S-4). Step 0 ships none. The Phase B document amends LD-4 by version bump if Phase B is scheduled before launch (D-i). **Thesis LD-5** deferred the disciplines/lessons re-framing until after the Forge revamp shipped; that condition is met (June 2026), so §5.5 reopens nothing. **Thesis LD-26** committed the novice readouts to the precursor; they are outstanding on the shipped benches (§5.4).
- Archetype identity is mechanically enforced; identity and calibration are separate layers (Strategy bookmark §4). No item on any bench may reverse an archetype's core.
- Platform guardrails are separate, largely invisible, explainable after the fact (Thesis §2.6). Per-agent hard constraints the user's own work produced are not platform guardrails (§5.5, Q-18).
- Persistent equip; loadout as thin presentation layer; execution dials internal.
- Maturity gates are never engagement-tuned (Charter §8). Display budgets in this document (expiry windows, strip length) are UX budgets, never evidence thresholds — confirmed as conformant by the Charter pass.
- XP/levels and lessons are two tracks, never blended (Charter §6). The Forge record shows lessons; it does not show XP.

---

## 2. What the user sees

**Forge home (the record).** Header: archetype, and a provenance summary. Before Phase B it can only read *"9 items on the record · 4 yours · 1 from your chats · 4 default."* With Phase B it adds proposed / on trial / learned. Beneath it the **Ledger strip**: chat suggestions awaiting a call, leans retired on an archetype switch, items equipped since the last visit, and — with Phase B — lessons that changed tier. Then the three benches as today, every item wearing a provenance chip. Headline copy (D-g): before Phase B, *"What Shadow hunts, how it decides, and where each piece came from."* Once Phase B is live for the agent, *"…and what it's learned with you."* Learning language never precedes the learning machinery (S-18). The "Command bridge" button and the "Build a …" buttons stay where they are.

**A bench item.** Name · plain-English line (what it makes the agent do) · provenance chip · status (Ready / Draft, as today). The engine line ("Prefer stocks with RSI below 30", "AGENT DIRECTIVE · VERBATIM") is demoted to a reveal, never removed (H9).

**Tapping the chip — "Why is this in my agent?"** A sheet: source, date, the battle or conversation it came from (linked), and if a lesson backs it, the lesson card (Charter §5: claim · evidence with denominators · tier · compiled control · points since adoption once Phase B reconciles the ledger). For a Default item: which archetype or focus seeded it and what would change if removed. For a migrated item: *"Source not recorded — this was equipped before the record tracked sources"* plus whatever is known (date, bundle version). For a Learned item, always: *"proven in FantasyTrades battles, not in markets"* (B1, H11).

**A chat suggestion card (step 0).** *You said, Sep 3, review chat: "yeah make that a rule — no entries without volume behind them."* → **Reads as:** *Require volume confirmation on entries · standing rule, every battle until you remove it.* Actions: Equip · Dismiss · Open the chat. No tier — it is a declaration of intent, not a claim (S-9, B3).

**A lesson card (Phase B, shown for orientation).** *"In 5 of 8 exits near a bonus threshold this month, holding through close would have scored higher."* Tier: **Hunch** — informational, no action. At **Testable**, the action appears: *Start a trial.* The Phase B document owns this card; it is here so the record's shape is visible end to end.

**Empty states.** A new agent's record reads: *"Everything here came with Shadow. What you change here, and what you tell Shadow in chat, shows up on the record."* The learning line is added only when Phase B is live for the agent. No dead slots, no "doesn't apply here."

**Mobile.** Same structure in the Mobile Loop shell; chips and the sheet are the only new interaction primitives. No new gesture vocabulary.

---

## 3. The provenance model (the third column)

### 3.1 Storage shape

Every equippable item — a watchlist entry, a rule inside a bundle version, a standing lean — carries one object:

```
provenance: {
  source:         <enum, §3.2>
  at:             timestamp
  actor:          'user' | 'agent' | 'system'
  originRef?:     { type: 'archetype' | 'focus' | 'assignment' | 'conversation' | 'directive' | 'lesson', id: string }
  battleId?:      string      // the battle whose receipts or directive produced it, if any
  schemaVersion:  1
}
```

`originRef` is what lets one stored value prove its label — *Default · Contrarian* and *Scouted · Buy the Dip* derive from `source` + `originRef`, never from a field outside the provenance object (S-6). Provenance is **metadata**: it must not participate in `equippedConfigHash` [doc — telemetry is live; Phase 0 Q-02 confirms the hash inputs] and must not alter what Haiku reads. Adding it changes no behavior.

### 3.2 Source enum (open) and display labels (closed)

| `source` | Meaning | Display |
|---|---|---|
| `user_forge` | Built or equipped on a bench by hand | **You** |
| `user_chat` | Compiled from a suggestion the user made and endorsed in conversation | **You** · from chat |
| `user_directive` | Promoted from a mid-battle Direct, if a promotion path exists [assumed, Q-09] | **You** · in battle N |
| `agent_proposed` | *(Phase B)* Compiled from a lesson the user chose to trial at Testable | **Proposed** |
| *(derived)* | `agent_proposed` whose lesson is Testable and in an active trial | **On trial** |
| *(derived)* | `agent_proposed` whose lesson is Trial-proven | **Learned** |
| `archetype_default` | Seeded by the archetype at creation | **Default** · Contrarian |
| `focus_scouted` | Populated by a chosen scouting focus (`originRef.type = 'focus'`) | **Scouted** · Buy the Dip |
| *(reserved)* | Assignments V2 registers its own value at its build (§7 C2) | maps to Default or You at registration |
| `system_migrated` | Backfill for items that pre-date this field | **Source not recorded** (a state, not a label) |

Rules: the **enum is open** — a future writer may register a new value — but the **label set is closed**: every new value maps to exactly one of You / Proposed / On trial / Learned / Default at registration, or it may not be written. **On trial** and **Learned** are never stamped by a writer; they are rendered from the referenced lesson's tier, so a bench item is never re-stamped when its lesson matures — the tier lives on the lesson (§4.4). The word "Learned" is reserved for Trial-proven: a Testable claim has enough evidence to be tested, not to be believed, and the label says so (B1). "Proposed" describes provenance, not current state; the item it decorates is only ever on a bench because a trial was started at Testable (S-1).

### 3.3 The writers rule — enforced, not ordered

**A writer that cannot stamp provenance does not ship.** Stamping is **unconditional from the moment the schema lands** (S-2) — provenance is behavior-neutral metadata, so it needs no dark flag; the flag in §7 C1 gates *rendering* only. Enforcement is mechanical, not a merge-order courtesy (S-3): a writer-supply guard test (working name `provenanceSupplyGuard.test.js`, on the pattern of the C-2 repo-level caller-supply guard [doc]) fails the suite if any code path that writes to the three primitives omits the provenance object. Every path stamps: the bench builders [seen], the compile-rule endpoint [doc], the Accept endpoint (§4.6), Assignments V2 seeding and the Direct menu when they write (§7 C2), and the Phase B compiler.

Who may stamp what (S-10): `agent_proposed` and everything derived from it are **server-authored** — the Accept endpoint stamps them under the Admin SDK; the client cannot mint them. `user_forge` may be written by the client only under Firestore rules that (a) permit `source: user_forge` and nothing else from a client, (b) only on the caller's own agent, and (c) forbid mutation of `provenance` after create. If Phase 0 Q-08 finds equip is already server-authoritative, all stamping moves server-side and (a)–(c) become a defense in depth.

### 3.4 Migration

Existing items are backfilled `system_migrated` and render the **"source not recorded"** state: the chip is present, the sheet opens, and it says so without guessing authorship (S-7 — "why is this in my agent?" must be answerable even when the answer is "we didn't track it yet"). Watchlist entries that already carry a `source` tag [doc] are **mapped**, not migrated (S-3). This is why the provenance PR lands first in the merge order: every item equipped before it is unknown forever.

### 3.5 Where the field lives

Phase 0 Q-07 confirms the exact write points. Expected homes [doc]: watchlist entries already carry a `source` tag for focus vs. manual (Scouting Focus Build Spec V1.3 §9 — the list-level `MANUAL` label is visible today [seen]); rules in `agents/{id}/rules/{id}` and bundle versions in `agents/{id}/bundles/{id}` (bundles immutable once forged; reforge creates a version, so bundle-member provenance is per version); standing leans in `agent.standingLeans` (cap 2, atomic canonical strings). The mapping from existing watchlist `source` values to the enum is a Phase 0 deliverable.

---

## 4. The Ledger

### 4.1 What it holds — two kinds from birth (S-8)

| Kind | What it is | Tier | Written by | Step 0 |
|---|---|---|---|---|
| `intent` | The user's own suggestion, made and endorsed in a conversation | none — a declaration, not a claim | the inbox sync (§4.7) | **yes** |
| `lesson` | A Charter §5 claim: typed behavior fields, evidence with denominators, maturity tier, compile target | Hunch / Testable / Trial-proven | Phase B machinery only | **no** — schema owned by the Phase B doc; R1/R2 fields populated at creation (S-20) |

Object identity never changes with maturity: a lesson is a lesson at Hunch and the same record at Trial-proven. Nothing is "promoted" from intent to lesson — they are different things.

### 4.2 The invariant

**Nothing on the Ledger influences trading.** Only bench items do. Accept compiles a Ledger item onto a bench through the existing equip pipeline — no new write path to `activeRules[]` or `standingLeans`, no bypass of caps, conflict groups, the archetype allowlist, or Archetype Integrity Mode (Q-20 confirms the path is identical to a human-authored equip). A proposal that needs a full lean slot says so and offers the swap; it never silently evicts.

**A Hunch is never equippable** (S-1). A lesson enters trading only by entering a trial at Testable, through the same Accept path; the trial *is* the consent, and the Charter's trials are episode generators (Charter §6), so trial initiation belongs to the Phase B document. Before Phase B nothing can reach Testable, so before Phase B no lesson reaches a bench.

**The active bench is authoritative** (S-22). A Ledger item stores `compiledRef` as history — *compiled on Sep 20 into "Require volume confirmation" on bundle v3* — and whether that control is currently active is **derived by lookup at read time, never persisted**. Unequip, reforge, an archetype switch that retires a lean, or a superseding lesson need no reconciliation job: the record shows what the bench shows.

### 4.3 The chat origin — step 0's only origin, and its honesty regime (S-9, B3)

Endorsement is necessary and not sufficient. The regime has five parts, and the cost of a wrong item is low because the Ledger never trades:

1. **Explicit gesture, never a detector.** An item enters only on the user's explicit ask — the existing "send that to the Forge as a rule" gesture [doc] — never on a model reading "sure" or "sounds good" as durable intent. Q-11 confirms how the writer fires today; if it fires on model-detected endorsement, the read-through filters to explicit gestures, and the in-chat confirmation chip that would make this airtight is §6 work (it lives in `AgentChat.jsx`, Command Center territory).
2. **The user's words, verbatim.** The card's primary content is the user's own turn, quoted and linked. The model's extraction renders beneath it as *Reads as: …* — the Ledger never states in the model's words what the user said.
3. **Preview-confirmed, scope stated.** Accept requires confirming the compiled control, which names its scope out loud — *standing rule, every battle until you remove it* versus *this battle only* — and routes to the right primitive (a standing lean or rule versus `agentBattles.directive` [doc]). The "four channels" problem (Rules Vision §3) is resolved at the preview, not by the user.
4. **Pending is harmless, and it expires.** A wrong or casually endorsed item sits pending, can be dismissed, and expires after a window (placeholder: 10 battles or 30 days, D-d) so a reversed intent doesn't linger.
5. **User-initiated only in step 0** (Thesis LD-4, S-4). A suggestion the agent made in chat and the user endorsed is agent-initiated and is not a step-0 Ledger item. Q-11 asks whether the writer records the initiator. **Contingency:** if the initiator is not recoverable and the writer cannot be amended without touching `chat.js`, D-i is re-presented with two options — amend LD-4 now, narrowly (an endorsed-in-chat suggestion is user-authored for Thesis §2.1 purposes), or hold the chat origin until the writer can be amended post-Command-Center.

### 4.4 Card shape (Charter §5)

| Field | Intent (step 0) | Lesson (Phase B) |
|---|---|---|
| Claim | the user's turn, verbatim | rendered from typed fields, never authored as prose |
| Evidence | link to the conversation turn | `n of N eligible episodes`, partition-disciplined |
| Tier | *(none)* | Hunch / Testable / Trial-proven, FPR-calibrated |
| Compiled control | *Reads as:* preview, scope stated | preview, archetype-scoped |
| Points since adoption | — | withheld until the ledger reconciles with visible scoring (H5) |

The lesson → bench link is bidirectional: the bench item holds `originRef {type:'lesson', id}`; the Ledger item holds `compiledRef` as history. The tier lives on the Ledger item only.

### 4.5 Phase B candidate families (D-e′) and the standards they inherit

Step 0 ships no counters (S-1, S-12, S-17). The Phase B document starts from this candidate set and these standards, both fixed here so they are not re-litigated:

| id | Family | Status | Compiles to |
|---|---|---|---|
| **RF-01 Threshold abandonment** | The Charter's flagship T1 example (§4-T1) | flagship; counterfactual defined against the V4 scorer per Q-05b | th-04 / th-05 / th-10 posture family [doc], archetype-scoped |
| **RF-02 Early harvest** | Charter T1 harvest-abandoned / swap-timing family | recast: outcome is the frozen scorer's replay, never "moved another ATR"; T2-checked per Q-19 | the archetype's "hold longer" allowlist move (e.g. CN-08) or the mb-08 family; not generated where the allowlist has no such move |
| ~~RF-03 Dead weight~~ | — | **cut** (S-19): names × battles is bookkeeping, not an eligible-but-rejected episode with a one-step counterfactual | if a watchlist-utilization notice ever exists, it is a bench-1 housekeeping line with no tier and no claim |

Standards, inherited verbatim by the Phase B document: episode grain (M1); one-step counterfactuals (M2); policies, never trades (M3); **a family's counterfactual is the frozen scorer's replay of the untaken policy, and the claim names the game metric that differs** (S-15); R1 behavior fields market-native and **populated at creation** (S-20); `domain`, denomination, and provenance are three separate fields, never conflated (S-13); the T2 dual ledger is designed first (Charter §9, item 1); no market-alpha family (Charter §2); the visible-but-inert test on every compile target (H7); the discipline-duplicate check at Accept (S-5); a Hunch is informational, the action appears at Testable (S-1).

**The corpus probe (D-j).** After Phase 0 answers Q-01–Q-06, a **read-only script** runs RF-01 and RF-02 over the persisted corpus and produces distributions for the Phase B document — no durable writes, no Ledger records, no flag, no UI. Its report is the founder's read, and its purpose is that the claims machinery is designed against real mined distributions (Charter §9, item 3).

### 4.6 Lifecycle and the Accept endpoint

Intents: `pending → accepted | dismissed | expired | superseded`. Lessons: Phase B. One server endpoint handles Accept for both kinds: validate the target against caps, the archetype allowlist, conflict groups, and Archetype Integrity Mode; **check the compile target against active disciplines** (structured selection/execution rules [doc]) and either reject or explicitly supersede the reflection so one learned belief never lives at ladder layers 3–4 and 6 at once (S-5, Thesis §2.4); compile; equip via the existing path (Q-20); stamp provenance; flip status — atomically, with a `verifying` re-read before any error terminal (terminal-state honesty). Display budget: chat items are uncapped (they are the user's own); Phase B sets the lesson display budget.

### 4.7 Store, and the inbox rule (S-11)

Home: `agents/{id}/ledger/{ledgerId}` — a subcollection, per the Mar 28 architecture's reason for subcollections (no agent-doc bloat). Server-written only (Admin SDK); the client reads the projection; receipts and atoms stay client-read-blocked (Charter §9, item 4). Firestore rules with **ownership verification**, not string-existence checks. The `lesson` kind is reserved in schema v1 with the Charter's R1/R2 fields present; Phase B populates them.

**`forgeSuggestions[]` is an inbox; the ledger is canonical.** A sync in the reflection chain (§4.8) moves entries into the ledger under an idempotent key (working shape: `hash(agentId, createdAt, text)` [assumed]) and marks the array entry migrated; after PR 3 nothing reads the array for state. The writer in `chat.js` keeps writing to the array until the post-Command-Center window, when its target changes to the ledger (D-k) — a fenced-adjacent file is not touched for this arc. Q-11 confirms the array is read by no evaluation or prompt path today; if it is, that hidden path is a Blocker for PR 3, not something the migration may inherit.

### 4.8 Where it runs

The inbox sync — and later the Phase B miner — runs **co-tenant in the `process-pending-reflections` chain** [doc: Sprint 1 queue-flag cron] — mine first, then narrate (Charter §3: arithmetic decides, language describes; §9, item 5 repositions reflection over mined distributions). Zero new cron slots at 38–40/40. Phase 0 Q-12 confirms the chain's time budget against the function timeout; if it is tight, the sync takes a separate tick of the same cron under the queue-flag pattern — never fire-and-forget (Sprint 1 lesson).

---

## 5. Bench-level changes (parallel-safe)

None of these touch a fenced file, a voice-layer prompt, or the Command Center's surfaces.

### 5.1 Honesty fixes (fixes, not features — no flag)
- **Stale slots.** On archetype switch, standing-lean slots holding leans not on the new archetype's allowlist are cleared, with a one-line notice in the Ledger strip ("2 Diversifier leans retired when you switched to Contrarian"). The `0 / 2 SLOTS` counter and the slot cards must never disagree [seen].
- **Per-lean "What this changes."** One real sentence per lean, per archetype (~45 lines across six allowlists), authored from the archetype DEFs (D-h). The identical placeholder under Tighter Stop and Sell Into Strength [seen] is retired. A content PR; no code path changes.
- **Plain-English first.** Each rule card leads with its `agentUseDescription` [doc — verify field] and demotes the parameterized engine line to a reveal. Copy refinement across the library is real work (Rules Vision §6) and is scoped as content PRs, category by category.

### 5.2 The VERBATIM label
`AGENT DIRECTIVE · VERBATIM` [seen] is honest — it is exactly what the gate writes — and it stays reachable. It moves under a "what the agent is told" reveal on the lean card, beneath the plain-English line. Demoted, never hidden (H9).

### 5.3 Bench 1 (Watchlists)
Source shown at **entry** level, not only list level: a focus-scouted name reads *Scouted · Buy the Dip*; a hand-added name reads *You*; a Signal Drop name reads *You · from Signal Drop*. Maps the existing `source` tags [doc] onto §3.2.

### 5.4 Bench 2 (Rule bundles) — a Thesis commitment still outstanding
Thesis LD-26 committed the **"What your agent will do" card** and the **Risk Preview** to the precursor as derived, non-authoritative readouts. They are not on the shipped benches. They ship here **only if** a resolved rule set exists to derive from — the canonical rule manifest (Thesis §9.6, LD-21) — because a card derived from raw rules could contradict conflict-suppressed or mode-ineligible state and would be a dishonest summary. Phase 0 Q-13 decides; if the manifest hasn't shipped, both remain outstanding, recorded as such, and this document does not approximate them.

### 5.5 Bench 3 (Character) — and one item H1 catches on bench 2
Three strata, each honestly labeled: the **archetype** (Default — the one-line disposition [seen] stays), **standing leans** (You / Proposed / On trial / Learned), and the **dossier's `consolidatedInsight` and `disciplines`** [doc] rendered read-only as *Reflection — from your agent's post-game reviews; not evidence-tested.* Rationale: they already influence Haiku's reasoning (Thesis §9.5 ladder, layer 6), and H1's test puts every agent-specific decision input on the record. They are not editable — only consolidation writes them (funnel principle) — and they carry no tier until Charter §9, item 5 puts consolidation over mined distributions (D-c).

H1's test (B2) also catches **`deployedGuardrails`** [doc]: per-agent hard overrides on Haiku's decisions, derived from the user's own Laboratory dimensions. That is agent-specific state read at decision time — not a platform guardrail in the Thesis §2.6 sense — so it belongs on bench 2 with `user_chat` / Workshop-derived provenance. Q-18 classifies it and every other per-agent field the runtime reads.

---

## 6. The front door (sequenced — see §7 C3)

**What it is.** A "Tell your agent how you want it to trade" entry on the Forge home that opens Workshop Mode targeting the **BaggerBomb loadout** — the three benches — instead of Season dimension values. The compile step (Haiku, constrained composition of existing primitives — `api/forge/compile-rule.js`, `ruleCompiler.js` [doc]) proposes bench writes; the user confirms the preview; items land with `user_chat` provenance and a link to the conversation. Mechanically this is §4.3 with a dedicated entry point and a wider compile target. The in-chat confirmation chip for chat-origin items (§4.3, part 1) is built here too.

**What it is not.** Not a third authoring pipeline. The synthesis records two (Mech Bay bundles → `activeRules[]` as prompt material; dimension strategies → `activeRules[]` + `deployedGuardrails`) as standing debt. The front door writes through the bundle path. Whether the dimension pipeline is retired is out of scope here and logged as a standing question for a later arc.

**Modality.** Text first. Voice is a modality decision, secondary to the mechanism; Prerequisite C owns voice-layer model evaluation. Nothing in this document depends on which model speaks.

**Gate.** Workshop Mode's prompt rules for a loadout target live in `voiceLayerPrompt.js` and `chat.js` [doc] — the files Ask 2 names as a fenced surface and the grounding walk is changing. The front door is subject to the §7 C3 gate conditions. Until then the Forge keeps its "Build a …" buttons as the way in, and the Ledger's chat origin already gives review-mode suggestions a home.

---

## 7. Coupling with the Command Center arc

The constraint is founder review attention and three file collisions, not CC capacity.

**C1 — Flags.** One small early PR registers the Forge Record flags, so no later branch in this arc touches `featureFlags.js` (a standing merge-conflict surface). Two flags; the counters flag from V1.0.1 is gone with the counters.

| Flag | Gates | Default |
|---|---|---|
| `FORGE_PROVENANCE_RENDER` | chips, the "Why?" sheet, the record header and summary | `false` |
| `FORGE_LEDGER_ENABLED` | the Ledger store sync, the Ledger strip, chat-origin cards, the Accept endpoint | `false` |

Provenance *stamping* is not flagged (S-2, §3.3). `flagPinGuard.test.js` pins both at `false`; each flip is its own PR with the pin update and registry removal in one commit. Bench honesty fixes (§5.1) are fixes and ship unflagged.

**C2 — The schema precedes the writers, as a gate.** Assignments V2 and the Direct menu are in the approved Command Center build order and both produce equip-side writes. **PR 1 is a recorded merge prerequisite for both**, entered in the Command Center arc's ledger, and the writer-supply guard (§3.3) makes the prerequisite mechanical: a writer that lands without stamping fails the suite. The §3.2 enum and label mapping are settled here so those writers register their values under the closed label set. If PR 1 is somehow late, the only recoverable class is watchlist entries with the existing `source` tag (S-3); a lean or rule written without provenance is unknown forever — which is why the guard, not the order, is the mechanism.

**C3 — Fenced and prompt-side work is not eligible to start until three named conditions are true** (B6). This replaces "later in the merge order." PR 7 (the citation loop in `agentEvalPromptAssembly.js`) and PR 8 (the front door) may begin only when:
1. `VOICE_GROUNDING_MODE` is `on` in production and has held for the period the grounding arc defines for stability;
2. Ask 2 has merged and the A9 window (identity-above-rules vs. rules-above-identity) is closed on both the eval and voice surfaces;
3. the grounding arc has defined the **citation contract** — where in the prompt a lesson citation may appear and what it is allowed to claim — so the loop is built against a settled contract, not one in motion.
Until all three hold, PR 7 and PR 8 have no branch. Everything else in this arc is fence-free and file-disjoint from the Command Center work.

**Review budget.** One fenced stream in review at a time; the Command Center owns that slot now. Forge Record PRs are either smoke-testable in under ten minutes or report-shaped (the corpus probe is a report you read, not a UI you drive). Anything that isn't waits.

**Merge order (manual merges make this binding):** flags → provenance (the C2 gate) → honesty fixes (any time) → Ledger + inbox sync + Accept → *(after Phase 0)* corpus probe → *(Phase B doc, then Phase B build)* miner → lesson cards → *(C3 conditions)* citation loop → front door.

**Vocabulary, noted.** "Bench" in the Forge means a workshop bench (Watchlists · Rule bundles · Character) [seen]; "bench" in the battle view means the bench of alternative names (`hotBench`, the A3 Bench section). Specs that touch both say *workshop bench* and *hot bench*. "Ledger" in this document is the intents-and-lessons surface (§4); the Charter's "points-since-adoption ledger" is a field on a lesson card; the "D-number ledger" is the rulings record. Copy never uses "ledger" for the last two.

---

## 8. Honesty rules

- **H1 — Nothing on the Ledger influences trading; every agent-specific input to trading is visible on the record with its source.** The test is state-based, not component-based (B2): *if two agents can carry different persisted values that the runtime reads when deciding, the value belongs on the record; an invariant platform mechanism does not.* Bench items via chip; the dossier's `consolidatedInsight` and `disciplines` on the Character bench labeled Reflection; `deployedGuardrails` on bench 2 (§5.5). Platform machinery — Haiku defaults, the Risk Manager, the DRB, platform guardrails — stays out of the Forge by design (Thesis §2.6) and is explained where it acts, after the fact, in the Film Room. Calling an enclosing system "platform" does not exempt a per-agent parameter inside it; Q-18 is how the line gets drawn on real fields.
- **H2 — No claim beats a wrong claim.** Unknown provenance renders an honest "source not recorded" state — never a guess, never a silent absence.
- **H3 — Two origins, two regimes.** A *lesson* is server-computed from persisted receipts and template-rendered from typed fields with denominators visible; the model voice discusses it and never mints it. An *intent* is model-extracted, user-endorsed on an explicit gesture, quoted verbatim, and preview-confirmed; it carries no tier because it is not a claim (S-9).
- **H4 — Tier is always shown on a claim.** Hunch is a legitimate tier and is labeled as such. Nothing pre-miner is labeled above Hunch.
- **H5 — No points attribution before the Phase B ledger reconciles with the visible scoring surfaces.** "Equipped since battle N" only. A naive score-since-equip is not attribution and would be a claim the system can't prove.
- **H6 — The T2 dual ledger is designed before any risk family ships** (Charter §4-T2, §9 item 1), and no lesson family reaches a user before the Phase B document exists (S-12).
- **H7 — Accept must move behavior.** Every compile target passes the visible-but-inert test; decorative equips are cut.
- **H8 — The forbidden-terms test extends to the Ledger.** No "learned," "improved," "smarter," "knows" on a Hunch card, a Reflection, or any surface before Phase B is live for the agent (S-18).
- **H9 — Engine text is demoted, never hidden.** The verbatim directive and the parameterized rule line stay reachable on every card.
- **H10 — Policies, never trades (Charter M3).** No card names a single decision as a mistake; every claim is a behavior across eligible episodes with its denominator.
- **H11 — "Learned" never quietly becomes "market-proven."** Every Learned item's sheet states it was proven in FantasyTrades battles, not in markets (Charter R3, B1).
- **H12 — Nothing equips below Testable; nothing before Phase B reaches Testable** (S-1). The Ledger's only actionable items in step 0 are the user's own intents.

---

## 9. Telemetry

Reuse the parked Admin-SDK → Firestore telemetry endpoint (Scouting Focus Build Spec V1.3 §10) [doc — Q-17]. Engine-level events first, UI events second.

| Event | Properties |
|---|---|
| `provenance_stamped` | agentId, surface, source, actor, originRefType |
| `intent_synced` | agentId, ledgerId, idempotencyKey, conversationMode, initiator (if recoverable) |
| `intent_acted` | ledgerId, action (accepted / dismissed / expired / superseded), scope (standing / battle) |
| `record_why_opened` | agentId, source of the item, hadLesson, wasMigrated |
| `stale_leans_cleared` | agentId, fromArchetype, toArchetype, count |

Two questions these must answer within the first weeks live: does anyone open "Why is this in my agent?" — if not, the attachment mechanic isn't landing and the record needs rethinking — and what fraction of synced intents are accepted, dismissed, or left to expire, which is the first honest read on whether chat-to-Forge is a path Users 1+2 actually take. Phase B adds lesson and trial events.

---

## 10. Phase 0 discovery questions (read-only, hard STOP, file:line citations, report to Fable)

One pass serves this document and the Phase B design document.

**Corpus (Phase B prerequisites)**
- Q-01 Is the Corpus Capture Patch merged? What is the corpus epoch v2 boundary date? Which receipts lack archetype identity or the three swap classes?
- Q-02 Do receipts carry archetype + config version? Is `equippedConfigHash` on every receipt, and what are its inputs (so provenance metadata can be excluded)?
- Q-03 Is a battle-level regime stamp written, and is its vocabulary the Harness arc's Regime Taxonomy §1? If two vocabularies exist, which is canonical?
- Q-04 Is the agent leg isolated from the user leg in stored score (Strategy bookmark §5 check 2)?
- Q-05 For RF-01/RF-02: are stored thresholds, ATR at exit, and same-day close per symbol readable post-battle from persisted data (`marketDataCache` or equivalent), or would they be re-fetched? API cost if re-fetched.
- Q-05b The exact threshold-capture semantics in the V4 scorer (banked on touch vs. on close; lock and `bankedBadgePoints` mechanics [doc]) so RF-01's "hold through close" counterfactual (Charter M2) is a replay through the real scoring function, not a guess.
- Q-06 What persisted data can establish that a symbol was *eligible and considered* (in the universe, on the hot bench, evaluated, a slot available) in a given battle — the eligibility predicate any bench-utilization family would need (S-14, S-19).

**Equip primitives (provenance)**
- Q-07 Exact field names and write points for watchlist entries (existing `source` values), rules in `agents/{id}/rules/{id}`, bundle members in `agents/{id}/bundles/{id}`, and `agent.standingLeans`. Every writer, with file:line — this is the writer-supply guard's list.
- Q-08 Is equip client-authoritative or server-authoritative today (`forgeService.js`, `useForge.js` actions [doc])? Where would a server-authored stamp live, and can Firestore rules constrain a client-created `provenance` as §3.3 requires?
- Q-09 Does any promotion path exist from `agentBattles.directive` to a standing lean? (Decides whether `user_directive` has a writer today.)
- Q-10 Does `AgentLearnedSection.jsx` [doc, Apr 2] survive the June Forge redesign, and what does it read? (Candidate seed for the Reflection strip, or dead code to retire.)

**Ledger plumbing**
- Q-11 `agent.forgeSuggestions[]`: current shape and writers; does review mode still write it; **is it read by any evaluation or prompt path** (a yes is a PR 3 Blocker); does the writer fire only on an explicit user gesture or also on model-detected endorsement; **does it record who initiated the suggestion** (decides §4.3 part 5 and the D-i contingency).
- Q-12 The `process-pending-reflections` chain: sequence, time budget, and whether the inbox sync (later the miner) fits before reflection without a new slot.
- Q-13 Did the canonical rule manifest (Thesis §9.6, LD-21) ship? If yes, its shape (unblocks §5.4). If no, §5.4 stays outstanding.
- Q-14 The existing BundleConfirmationCard / compile-rule path: is it live, and can it accept a bench target other than a Season entry?

**Runtime inputs (H1)**
- Q-18 Enumerate every per-agent field read by evaluation (`decide.js`, `agentEvalPromptAssembly.js`), compilation, and execution — including `deployedGuardrails`, `disciplines`, `convictions[]`, `consolidatedInsight`, `partnerProfile`, and anything inside the Risk Manager or enforcement paths that varies per agent. Classify each as: on a bench (which), Reflection strip, or a specifically justified platform exclusion. Reuse the Harness arc's trading-stack inventory where it exists (S-16).
- Q-19 For every "hold longer" allowlist move (CN-08, the mb-08 family, and each archetype's equivalent): does the compiled control affect only profit-taking, or can it delay a protective or risk exit? A yes makes that family T2 and moves it behind the dual ledger (Charter conformance pass, conditional hold).
- Q-20 Does the Accept endpoint's equip travel the identical caps / conflict-group / archetype-allowlist / Integrity-Mode / enforcement path a human-authored equip travels, with no learning-only branch? Cite the path.

**Surface and flags**
- Q-15 Forge home component tree as shipped (ForgeLanding / ForgeScreen [doc]) and the stale-slot bug's root cause (where slots are read on archetype switch).
- Q-16 `featureFlags.js` registration pattern and the current `flagPinGuard.test.js` list.
- Q-17 The parked telemetry endpoint: path, auth, and whether it is wired.

---

## 11. Build sequence (staged PRs; one task = one branch; Flash merges)

| # | PR | Eligible | Flag | Smoke shape |
|---|---|---|---|---|
| 0 | Flag registration (C1) | now | both registered at `false` | test suite, `Test Files` line read |
| 1 | Provenance schema + `originRef` + **unconditional stamping** in every writer + writer-supply guard test + backfill `system_migrated` + watchlist `source` mapping + Firestore rule constraints on client stamping | now — **C2 gate for Assignments V2 and the Direct menu** | none on writes; `FORGE_PROVENANCE_RENDER` on chips/sheet | equip one item on each bench, read the doc; switch archetype, read the doc |
| 2 | Bench honesty fixes (§5.1) + per-lean copy (content PR) + VERBATIM demotion | now, any time | none | switch archetype; open three lean cards |
| 3 | Ledger store + rules + inbox sync with idempotent key + Accept endpoint (discipline check, Q-20 path) + Ledger strip + "Why?" sheet incl. "source not recorded" + Reflection strip | now | `FORGE_LEDGER_ENABLED` | one endorsed suggestion → synced → Accept → chip on bench; unequip → Ledger shows history, not "active" |
| 4 | Corpus probe — read-only script over RF-01/RF-02, report only, no writes | after Phase 0 (needs Q-01–Q-06) | none | a report Flash reads; its distributions feed the Phase B doc |
| 5 | *(Phase B doc, then Phase B build)* taxonomy, miner, claims, lesson cards, trial initiation, the passive-user consent path (D-l) | after the Phase B doc is committed | per Phase B doc | report-shaped, then one Testable lesson → Start a trial |
| 6 | *(C3 conditions)* citation loop in the eval prompt — fenced, §7-gated, dual adversarial review | not eligible until C3 conditions 1–3 hold | per C3 | live battle with a cited lesson |
| 7 | *(C3 conditions)* front door (§6) + in-chat confirmation chip | not eligible until C3 conditions 1–3 hold | new flag | workshop → confirm → chip |

`/code-review` at high effort on any PR ≥10 files or ≥1500 lines, and on PR 1, PR 3, and PR 6 regardless of size (a schema every writer touches; a new write path; a fenced file). Dual adversarial review on PR 6 per BUILD_RULES §7.

---

## 12. Considered and not adopted

- **Counter proposals in step 0** (V1.0.1 §4.5). Not adopted: a Hunch cannot be equippable (S-1), the counters were a miniature learning pipeline ahead of the document that owns its semantics (S-12, B7), and they turned the hero area into a low-confidence configuration inbox for users who don't build (S-17). Moved to Phase B as candidate families (§4.5).
- **Informational Hunch cards before Phase B.** Not adopted: "the system must resist manufacturing progress to solve the feeling" (B5); learning language never precedes learning machinery (S-18).
- **RF-03 "dead weight."** Cut (S-19): bookkeeping dressed as regret.
- **Persisting the Ledger's "equipped" state.** Not adopted (S-22): derived by lookup; the bench is authoritative.
- **Rendering "You" for migrated items, or no chip at all.** Not adopted (S-7, D-b): an honest unknown state.
- **A seventh "Custom" archetype, or a no-guardrail mode.** Guardrails are catastrophe floors, not identity; they stay for everyone. What "custom" would relax is the identity gate, which Archetype Integrity Mode, the 464-cell compatibility matrix, and per-archetype lesson scoping depend on; the convergence argument (Strategy bookmark §4) applies — unconstrained agents climb the same hill. Users already hold more custom-ness than the UI shows (Ask 1: user rules above archetype stance). Surface that first. If User 3 demands a blank slate later, it is a post-launch product with its own lesson-scoping rules.
- **A fourth bench for lessons.** Lessons compile into existing controls; a lessons bench would be a second source of truth for the same items (Pattern 7). The Ledger is a surface for intents and claims, and it never trades (B7 confirmed).
- **A third authoring pipeline for the front door.** Writes through the bundle path (§6).
- **Rendering dossier reflections as lessons above Hunch.** Stories are not evidence (Charter P2). Reflections appear only as untiered *Reflection* on the Character bench (§5.5, D-c).
- **Naive score-since-equip as "points since adoption."** Not attribution (H5). Waits for Phase B.
- **Any T2 family before the dual ledger.** Charter §4-T2.
- **Deciding voice modality here.** Prerequisite C owns it.

---

## 13. Founder rulings

Blessed Sep 12, 2026 unless marked *pending*. D-numbers are assigned in the shared ledger on commit.

- **D-a** Ledger placement — hero strip on the Forge home. *(recommended; pending at commit)*
- **D-b** Migrated items — the "source not recorded" state, sheet still opens. **Blessed** (re-ruled from V1.0.1).
- **D-c** Reflections on the Character bench — shown as untiered *Reflection*. *(recommended; pending at commit)*
- **D-d** Display budgets — chat items uncapped; pending intents expire after 10 battles or 30 days (placeholder). *(pending; the counter budgets from V1.0.1 are gone with the counters)*
- **D-e′** Phase B candidate families — RF-01 flagship; RF-02 recast to score-replay, T2-checked per Q-19; RF-03 cut. **Blessed** (replaces D-e).
- **D-f** Front door placement — beside the "Build a …" buttons; the power path stays. *(recommended; pending at commit)*
- **D-g** Home headline — pre-Phase B *"…and where each piece came from"*; post-Phase B *"…and what it's learned with you."* *(recommended; pending at commit)*
- **D-h** Per-lean copy — Fable drafts all ~45 lines from the archetype DEFs for founder read-through before the content PR. *(pending)*
- **D-i** Thesis LD-4 stance — step 0 ships user-initiated intents only; counter proposals are Phase B; LD-4 amended by version bump in the Phase B doc if Phase B precedes launch. Contingency in §4.3 part 5 if the initiator is not recoverable. **Blessed.**
- **D-j** Corpus probe — a read-only script after Phase 0, feeding the Phase B doc; no writes, no UI. **Blessed.**
- **D-k** `chat.js` write target — untouched in this arc; inbox sync instead; target changes post-Command-Center. **Blessed.**
- **D-l** Passive-user consent model — Phase B designs a per-agent standing consent ("let Shadow act on what it learns") under which a Testable lesson enters its trial automatically, is announced in the post-market debrief, wears an "On trial · auto" chip, and has one-tap rollback; opt-in and default off through the beta; Phase B sets the default with real data. Evidence accrues for a passive user regardless; consent, not evidence, is the bottleneck. **Blessed.**

---

## 14. Charter and Thesis conformance (per the Sep 12 Charter pass, with conditions)

- **Charter §8 P1** — holds: Ledger state has no trading authority; accepted items gain authority only through the existing control path (§4.2, Q-20 confirms the implementation).
- **Charter §8 P2** — holds: intents carry no tier; reflections are labeled not evidence-tested; lessons rest on arithmetic (§4.1, §5.5).
- **Charter §8 engagement gates** — holds: no maturity promotion is tied to visits, clicks, acceptance, or battle count; expiry and strip length are UX budgets (§1.2, §4.3).
- **Charter §8 calibration fence** — holds at the document level; Q-20 verifies the implementation. The only fenced item in this arc is the citation loop, gated by C3.
- **Charter §8 market-alpha exclusion** — holds for step 0 (no families ship); for Phase B, RF-02's recast to score-replay is the condition (S-13, S-15).
- **Charter §4-T2** — untouched in step 0; conditional for Phase B on Q-19 (a "hold longer" control that can delay a protective exit is T2).
- **Charter §5** — tier vocabulary and ledger honesty hold (H4, H5); the citation loop and points-since-adoption are Phase B and C3 work.
- **Charter §6** — two tracks hold; trial initiation and the passive-user path are Phase B (D-l).
- **Charter §7 R1** — conditional: no lesson exists until its behavior fields are market-native and populated at creation (S-20, §4.1). **R2** — `domain` conforms; RF-02's `general` tag stands only with the score-replay recast (S-13). **R3** — holds: arena provenance stays arena, unknown is never rewritten, Learned carries the arena qualifier (H2, H11). **R4** — holds: no export or executor path is introduced.
- **Thesis §2.1** — stands at the data model (§1.2). **§2.4** — variability enforced on every compile target (H7) and the discipline-duplicate check closes the two-channel gap (S-5). **§2.6** — platform guardrails stay separate and invisible; per-agent `deployedGuardrails` are classified under H1's test, not §2.6 (§5.5). **§9.5** — the ladder is unchanged; nothing here adds a layer. **LD-4** — honored (D-i). **LD-5** — condition met. **LD-26** — recorded outstanding (§5.4).

---

## 15. Review ledger (Sol, Sep 12 — Message 1, Charter pass, Message 2)

| S | Sev | Disposition | Folded at |
|---|---|---|---|
| S-1 | Blocker | Accept | §1.1, §4.2, H12 — Hunch never equippable; Accept = trial at Testable |
| S-2 | Blocker | Accept | §3.3, §7 C1 — stamping unconditional; flag gates rendering |
| S-3 | Major | Accept | §3.3, §7 C2 — writer-supply guard; PR 1 a recorded prerequisite |
| S-4 | Major | Accept (LD-4 verified) | §1.2, §4.3 part 5, D-i |
| S-5 | Major | Accept | §4.6 — discipline-duplicate check at Accept |
| S-6 | Major | Accept | §3.1, §3.2 — `originRef`; `focus_scouted` split |
| S-7 | Major | Accept | §3.4, H2, D-b — "source not recorded" state |
| S-8 | Major | Accept | §4.1 — intent / lesson kinds from birth |
| S-9 | Major | Accept, stronger mechanism | §4.3 — verbatim quote; "Reads as:" |
| S-10 | Major | Accept via rules | §3.3 — client may create `user_forge` only; Q-08 |
| S-11 | Major | Accept | §4.7 — inbox / canonical; idempotent key; D-k |
| S-12 | Major | Accept | §4.5, §11 — probe is read-only after Phase 0; cards to Phase B |
| S-13 | Major | Partial (spec mislabel) | §4.5 standards — domain / denomination / provenance are three fields |
| S-14 | Major | Accept | Q-06 — eligibility predicate |
| S-15 | Major | Accept as standard | §4.5 — counterfactual = frozen-scorer replay naming the metric |
| S-16 | Major | Accept | Q-18 — per-agent field inventory |
| S-17 | Major | Accept | §2, §12 — actions only at actionable maturity |
| S-18 | Minor | Accept | §2, H8 — learning language gated on Phase B live |
| S-19 | Major | Accept | §4.5 — RF-03 cut |
| S-20 | Major | Accept | §4.1, §4.5 — R1 fields populated at creation |
| S-21 | Major | Accept — Phase B requirement | D-l — passive-user consent path |
| S-22 | Major | Accept — derive, don't persist | §4.2 — bench authoritative |
| B1–B7 | — | Folded | H11 (B1); H1 test + `deployedGuardrails` (B2); §4.3 five parts (B3); §4.5 (B4); §2, §12 (B5); C3 gate conditions (B6); §4.7 Q-11 read-path check (B7) |

---

*Forge Record — Design Spec V1.1. September 12, 2026. Next: commit to `docs/` with the Sep 12 review responses alongside; CC Phase 0 against §10; founder rulings on the Phase 0 report; then `AGENT_LEARNING_PHASE_B_DESIGN_V1.md`.*
