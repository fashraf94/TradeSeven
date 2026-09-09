PHASE C. SHOW IT. SOL SHORT PASS

Scope: §7 only.

FINDINGS

C-1. BLOCKER. The persisted research card loses its provenance when it enters ordinary narrator history.

Plain language: The screen tells the player “this is platform data,” but the prompt path risks telling the character “this was something you said earlier.”

§3 persists the card as `messageType: 'research'`, `groundingVersion: 1` specifically so a follow-up sees it in history. §5 then relies on one shared grounding rule to tell the narrator the card is platform data. fileciteturn2file0

The discovery identified this exact failure mode. A grounded exchange enters the EARLIER MESSAGES history unless specifically excluded. It warns not to persist a research card with `groundingVersion: 1` into that path because the narrator can treat the platform numbers as its own earlier words. fileciteturn1file5

The §5 sentence governs what the model should say. It does not repair what role the history serializer assigns to the card.

That distinction matters. If the prompt structurally presents:

“Earlier messages: Research card. MPC. P/E 14.2…”

then the narrator receives contradictory signals. The history structure says prior conversation. The prose rule says platform data.

Required contract before build:

Persist the card, as ruled. But do not feed it back as an ordinary earlier narrator message.

Either the research exchange must enter the grounded prompt through a separately typed `PLATFORM RESEARCH` context block with symbol, dates and provenance preserved, or the history renderer must preserve an equally explicit non-narrator role.

This does not reopen persistence, the chip, or narration policy. It fixes provenance at the prompt boundary.

Acceptance test: after a research card, prompts such as “what did you see?”, “does your evidence support this?” and “what do you think about those numbers?” must never produce a claim that the research data was part of the decider’s check or the narrator’s prior evidence.

C-2. MAJOR. `1 of 3` does not yet have one defined meaning.

Plain language: The cap source is sound. The number printed on the door is underspecified.

The spec says the label counts persisted research cards and says the door reads `Show it · 1 of 3`. It also describes this as cost-before-tap. fileciteturn2file0

Those are two different numbers.

If zero cards exist before the first tap:

Persisted count \= 0\.

Next-card ordinal \= 1\.

So `1 of 3` cannot literally be “the count of persisted research cards” before the first use.

The discovery correctly establishes `chatExchanges[]` as the clean source of truth. It is transaction-safe, client-derivable and requires no new battle field. fileciteturn1file9

The spec needs one exact display function.

For example, if the label means the next use, it derives from `used + 1`, not directly from `used`.

If it means usage already consumed, the initial label must represent zero used.

I do not care which presentation wins. I care that server, client and tests share one definition.

The transaction itself is sound if the count and append happen atomically. A failed final transaction then creates no research exchange and consumes no slot.

The remaining race is UI freshness. A subscribed battle document can lag the server or another tab. Therefore the route must remain authoritative on the fourth request. The client must reconcile to the returned persisted count or the subsequent battle snapshot rather than treating its displayed count as authorization.

Required tests:

Two simultaneous taps with one slot remaining produce one card.

A failed transaction consumes no slot.

Two browser tabs cannot create a fourth card.

No optimistic client increment survives a failed route.

The exhausted state and the pre-tap `3 of 3` state, if both use that text, have an explicit enabled or disabled contract.

C-3. PASS. “Research does not cost a message” is economically coherent.

The discovery framed the choice correctly. A normal chat turn consumes the influence budget. A Show it tap is a separately capped, code-composed platform-data read. fileciteturn1file7

The apparent loophole is not real in V1.

Typing a research question does not invoke the Show it data path. The spec explicitly leaves typed `research_only` behavior unchanged. The structured chip invokes a different operation with its own three-use scarcity. fileciteturn2file0

Three research reads plus the normal message budget is therefore an intentional product allocation, not dishonest accounting.

I would keep D-118’s “no message charged.”

C-4. PASS WITH ONE CONTRACT CONDITION. The two on-screen labels are semantically strong enough.

`What the check saw`

versus

`Platform data · not what the check saw`

is a real provenance distinction. The second label explicitly negates the inference most likely to cause trouble. The card also dates technicals and fundamentals separately, and D-119 forbids the two data classes from sharing a section. fileciteturn2file0

The discovery supports the need for exactly this distinction. Existing UI already labels the decider side in several ways, while no equivalent platform-data label currently exists. fileciteturn1file7

I would not add more explanatory prose.

One contract matters: `Platform data · not what the check saw` must travel with the research card itself. It cannot exist only as a distant page-level legend or header. A player looking at the numbers must see their provenance without reconstructing which label governs which section.

With that condition, the labels pass.

The phrase “never be confused with it” in §3 is stronger than the spec can prove. The enforceable claim is narrower: the two sources never share a section and each section carries its own provenance.

CLAIMS AUDIT

PASS. Three-per-battle cap derived from persisted `research` exchanges.

PASS. No new counter field or collection required.

PASS. A failed atomic count-and-append transaction does not durably consume a research use.

FAIL AS WRITTEN. `Show it · 1 of 3` is “from the same count.” The spec has not defined whether the displayed integer means cards already persisted or the ordinal of the next card.

PASS. Research does not charge the message budget. This is a separate code-composed read with its own cap.

PASS. `What the check saw` and `Platform data · not what the check saw` form a defensible user-facing provenance pair.

PASS CONDITIONALLY. Platform data and check evidence never share a section. The platform-data label must remain attached to the research card.

FAIL. “Persist the research card into grounded history and §5’s one-line rule is enough.” The discovery directly identifies the structural history-role hazard.

FAIL UNTIL C-1 IS FIXED. “The character speaks about the card on follow-up without treating it as its own evidence.” The current spec states the desired behavior but does not yet specify a prompt representation that guarantees the provenance boundary.

VERDICT

STOP. One BLOCKER. One MAJOR.

The architecture is otherwise clean.

D-118 survives. Keep the persisted-exchange cap and no-message economics. Define the displayed counter precisely and make the route authoritative under races.

D-119 survives. Keep both labels.

The one thing I would not send to build unchanged is §3 plus §5. Persistence is fine. Ordinary conversational-history treatment is not. The research card needs a structurally distinct platform-data identity when it re-enters the grounded prompt.

Fix that boundary and the cap-display contract, and I see no reason for another broad design pass.

