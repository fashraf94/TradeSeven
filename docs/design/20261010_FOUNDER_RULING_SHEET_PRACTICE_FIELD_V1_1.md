# Founder ruling sheet — Practice Field V1.1

**Date:** 10 Oct 2026 · **Status:** Adopted by founder, 10 Oct 2026 · **Supersedes:** V1 · **Rests on:** the Practice Field discovery and its Addendum A (branch `claude/practice-field-phase0`), the Film Room handover, concept V2

## Part 1 — The six founder calls, as ruled

**1. Fix the reflection outage before the camp. ADOPTED.**
- Flash: fix the outages now, before anything else.
- Step one is a read-only pass to find why the reflection calls fail. Step two stops a failed reflection from being saved as a lesson and lets it retry.

**2. The paragraphs already built from failure lines. ADOPTED as leaned.**
- Leave them until we have scored whether stopping those trades helped (the 29 changed moments, no model spend). Then reset them at a week boundary.

**3. Should the agent be told the score? ADOPTED WITH A CHANGE: yes, on request only.**
- Flash: reacting to the score is a big part of a trading agent that can find ideas to close a gap. The agent does not need the score at every check. It is told the score when the player asks a situational question. If this proves heavy to build or needs a lot of pushback, it can be deferred.
- Fable's reading, to be confirmed by Flash: the player calls the situation ("we are down, find ideas"), and at its next check the agent sees the gap and comes back with picks for the player to choose from.
- Built with the "down" and "good lead" camps, after the first camp.

**4. The first camp. ADOPTED WITH A CHANGE.**
- The first camp is "our stocks are not moving", on the player's own film. The Film Room lists the moments and the player picks one. The agent is asked fresh at that frozen moment, the player makes a call too, and the reveal shows hold against swap.
- Flash: making a play has to be easy. Most players will not know how to write one or think about trading analytically, so the agent should walk them through it.
- So the player never starts from a blank page. They choose each part of the play from a short menu the camp builds from the drills, and the agent explains each choice in plain words with the drill numbers beside it.
- On the player's own film only the agent's call counts toward "who was right". The player's calls start counting on moments they have not seen.

**5. Plays and learning stay with the archetype. ADOPTED.**
- A play and a learned paragraph belong to the archetype they were earned on. Switching archetype shelves them and switching back restores them. Nothing is deleted. The record of who was right when the pair split stays with Shadow across archetypes.
- Business note from Flash, for after launch and not for the beta: the first archetype a player builds with keeps its lessons and memory at no cost. Keeping them for more than one archetype is a paid option, $50 a month. In the beta every archetype keeps everything.
- Whether archetypes can share data is a later discussion.

**6. One door. ADOPTED.**
- Nothing reaches the agent as learning except a play that passed the proof. A Film Room card never enters the agent's prompt on its own, which closes the Film Room's earlier "Watch card" route. The player's own instructions (rules, leans, directives, watchlist ideas) keep the doors they have.

## Part 2 — Approved by default (no objection raised, 10 Oct 2026)

7. **"Did better" is measured in both points and price.** The tape already holds both.
8. **The camp may say who was closer; the tape never does.** The camp shows its basis and time window every time.
9. **Drills ask the production model.** The cheaper model almost never trades, so it teaches nothing about swaps.
10. **Drills get their own key and spending limit before any drill asks the agent.** On Oct 8 the shared limit refused ten live checks. This one needs Flash: a separate key in the Anthropic Console.
11. **The tape gains two recorded facts.** The opponent's score at each check, labelled "no opponent" where there is none, and the outcome of each gameplan meeting the player approved, rejected or let expire.
12. **In tournaments, "down" and "lead" use the group standing at each day's close.** A standing at every check is not stored and is not worth building yet.
13. **"Not moving" is defined against the platform's own stagnation rule.** The situation is live when a holding is within two checks of that rule firing. The two is a founder slot, and the contract sets a number for the archetype that has the rule switched off.
14. **One situation list, one ledger.** The situations live in one versioned code file that every screen reads. A card and a play are stages of one entry in a new record under the agent.
15. **The Film Room lists, the player picks.** Moments are ordered by time spent in the situation, longest first.
16. **League film is a filtered view, never a copy.** It is built from a list of allowed fields, with every person's and agent's words dropped. Later milestone.
17. **"Ask me first" is built in the cockpit before any play promises it.**
18. **The agent can be drilled on the last 120 days of film.** Older days stay reviewable, but the agent cannot be re-asked about them.
19. **The Practice Field chat writes the shared contract, and the Film Room chat receives it once.**
20. **V2's limits stand.** Five slots, three of them fixed, and one counting camp a week.

## Part 3 — Order of work

1. Reflection outage: read-only root cause (prompt issued 10 Oct 2026), then the fix build. The same discovery sizes the archetype carry-over fix from ruling 5.
2. The shared contract: situations, counter, the card-to-play ledger, one door, and the tape additions. Handed to the Film Room chat once.
3. Score the 29 changed moments (ruling 2).
4. The Film Room's card build, from the contract.
5. The first camp, on top of the card build.
