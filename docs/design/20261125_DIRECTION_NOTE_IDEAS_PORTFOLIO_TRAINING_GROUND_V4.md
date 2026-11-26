# Direction note V4 — the Ideas portfolio is the agents' training ground

**Date:** 25 Nov 2026 · **Author:** Fable (the Command Center and Forge direction chat) · **Replaces:** V2 and V3 of the same day and the 24 Nov note. None was sent.
**Status:**
- **IP-1 to IP-9:** adopted by the founder, 24 Nov 2026.
- **IP-10, IP-12 and IP-13:** the founder's direction of 25 Nov 2026 on the short slot. The shape is open, and nothing is built from it until the Practice Field chat has answered Q4 and Q5.
- **IP-11 and IP-14 to IP-17 are withdrawn** (§4). The player doesn't trade in the portfolio.
- **Items marked ◇** are Fable's shaping, which the founder accepted at gist level. The Practice Field chat may bring him a better shape for any of them.
- **§6 holds six questions,** not rulings.

**Follows:** concept V6.1 and its amendments, the two-desk agent build (B2), the direction note "the game and the account" (13 Nov), and the trader v1 spec.
**Destination:** attached once to the Practice Field chat. It enters the repo as `docs/design/20261125_DIRECTION_NOTE_IDEAS_PORTFOLIO_TRAINING_GROUND_V4.md` with that chat's next build that carries documents. No docs-only PR. Nothing comes back to this chat.

"Ideas portfolio" is the founder's name for the idea book. They are the same thing.

## 1. In plain terms

- **The portfolio exists to train the agents.** It isn't a managed account, and nobody defends it by selling.
- **Every test is clean.** One agent opens it, runs it to its end and owns the result.
- **The risk is seen before a test starts.** Each archetype sets its downside in its own way.
- **Learning runs one way.** What an archetype earns in the short slot can go into battles. What it earns in battles doesn't come back automatically.
- **The two desks test different things.** The medium and long slots test ideas, which need an investigation. The short slot tests setups: a named strategy with a plan.
- **The player has three roles, and none is trading.** They choose which archetype runs the short slot, set how the money is split between the two desks, and bring ideas through Explore and Work an idea.

## 2. Rulings of 24 Nov

| # | Ruling | Source | What it means for the book |
|---|---|---|---|
| IP-1 | **The portfolio is the agents' training ground.** A falling market, or a player who wants to be defensive, doesn't change that. | Founder: "we need to lean into the idea that this is for training the agents" | The player has no way to close, trim or hand over a running idea. Ruling 5 of 13 Nov stands: the player influences, never manages. |
| IP-2 | **Every idea finishes under the desk and archetype that opened it.** It is never handed to another archetype. | Founder agreed, 24 Nov | V6.1 §10's rule, kept. A handover would leave a result that belongs to no one. |
| IP-3 | **The portfolio's archetype and the battle archetype are separate choices.** The player may pick any archetype for either. | Founder: "The archetype the user uses in the Portfolio is not automatically the one they use in a baggerbomb battle. Both are separate." | Changing a game loadout never touches the book. Changing the book's archetype never touches a game. |
| IP-4 ◇ | **An idea counts in an archetype's record only if that archetype opened it and ran it to its end.** | Fable's shaping | The record needs the archetype on every idea (§5). |
| IP-5 | **Learning runs one way.** What an archetype earns in the short slot may be equipped by that archetype in battles. What it earns in battles stays in battles. | Founder: "the lessons learned from the baggerbomb games may not always carry over to how the archetypes trade in the idea's portfolio" | ◇ A trading hunch that comes out of a battle enters the portfolio as something to test. It doesn't go straight to the Forge. |
| IP-6 | **What an archetype earns belongs to that archetype alone, and it keeps it after it stops running the short slot.** | Founder: "I think yes" | Matches ruling 5 of 10 Oct: plays stay with the archetype they were earned on, shelved on a switch and restored on return. |
| IP-7 ◇ | **The Shadow desk's results belong to the partnership.** They survive every archetype change, and their ideas and lists may be equipped by any archetype. | Fable's shaping; the two-desks note's A2 said the same | The medium and long record is never shelved with an archetype. |
| IP-8 | **Downside is set before entry, per archetype.** Each archetype has its own range for where a line sits, some tight and some loose. The screen shows the risk at the line before entry. | Founder: "always baking in the downside and risk for each idea" | Pulls forward V6.1 §3's "an archetype policy may narrow them in release 2". The numbers come from the archetype chat's Part B once it is locked. Until then V6.1's defaults stand. |
| IP-9 ◇ | **A stop-out is recorded with what the market did.** | Founder: a blown-out idea "could lead to a learned strategy where the archetype adjusts certain factors depending on what the market is doing". The tag is Fable's shaping | See §5. |

**One open point on IP-8.** The founder's words allow an archetype to be looser than today's default as well as tighter. V6.1 lets a policy only narrow the slot's range (short: 3% to 8% below entry). Whether any archetype may go past that range is his to rule when the numbers arrive.

## 3. Direction of 25 Nov: the short slot tests setups

The founder saw the Command Center mock-up with the portfolio at its center and said the archetype felt detached from it. His direction: the archetype's side should revolve around short-term technical and momentum strategies, shown so the player can see how each works "from the discipline and risk/reward standpoint".

| # | Direction | Source | What it would mean for the book |
|---|---|---|---|
| IP-10 | **The short slot tests setups, not theses.** A short-slot entry names one strategy from the playbook and carries a plan. The medium and long slots keep theses. | Founder: "shorter term idea's don't need an investigation like the medium-longer term ideas" | The plan has trader v1's shape: a stop, a target, a time limit and a progress action. The stop is the book's line. The strategy comes from the same closed list trader v1 uses (SP-3), "No Recognized Setup" included. The archetype always picks its own tests. |
| IP-12 ◇ | **A strategy is shown as the shape of a bet, never as a promise.** | Fable's shaping. The 18 Nov payoff check found no tested setup beat an ordinary day, and the founder concluded that day that technicals matter most for risk management. | The screen shows what a strategy risks, what it aims for, how long it waits, the share of wins it needs to break even, and the archetype's record of plans followed. Below 20 closed trades the record reads "too few to tell" (TV-17). No screen claims an edge. |
| IP-13 ◇ | **Each strategy says how its setup is recognised:** checked by code, or judged by the agent. | SP-2 | Today only Pullback and Resume and Trend Breakout have complete detectors, and Trend Breakout is almost never valid under today's rule. |

**Why this fits what exists.** The Part B review (17 Nov, item 2b) already asked for each family to be split into a setup and a plan template, because "the setup layer is what the Ideas Portfolio can reuse to time an entry". The supply is there: the frequency count found a typical morning has 18 valid Pullback and Resume names across the 228 stocks.

## 4. Withdrawn on 25 Nov: the player trading in the portfolio

Two ideas were drawn in the Command Center's design rounds and then dropped by the founder. They are recorded so nobody rebuilds them from an old mock-up.

| # | What it was | Why it went |
|---|---|---|
| IP-11 | The player nominating the archetype's next test | A pick queued inside the archetype's test blurs whose result it is |
| IP-14 to IP-17 | The player holding a share of the book and making their own calls from the playbook | Founder: "it gets confusing when it comes to understanding the difference between what your short term archetype does and what the user does" |

- **V6.1's "no buttons in the book" stands whole.**
- **Parked, not ruled:** showing valid setups in Explore as a way into a company. The founder may come back to it.

## 5. What the record must carry

These make later learning possible. None of them claims learning now.

1. **The desk, the archetype and its frozen settings on every idea.** V6.1 §10 already speaks of the "frozen manager". Please confirm it is on the record as built.
2. **The market's context at a line exit (IP-9).** Code derives it at settlement from lines already on the record: SPY, and the idea's fund or basket. A model never judges it.
   - **The tag has two values:** "fell with the market" and "fell alone".
   - **A single stock's own comparison can't answer this.** That comparison is the same shares held unchanged, so the tag must use the context line.
   - **The threshold needs measurement.** Please don't pick one by feel.
   - **One stop-out is one observation.** Several of the same kind are needed before anything is offered.
3. **The risk at the line, on the screen, before entry.** The 23 Nov screen brief shows each name's line and its distance. The "Entering" state should show them too.
4. **On a short-slot test (IP-10): the strategy, the detector's verdict and rule version, and the plan as filled.** With these, short-slot and battle results can be compared by strategy, and "was the plan followed" can be graded the way trader v1 §5.8 grades it.

## 6. Six questions for the Practice Field chat

Answer the founder in your own chat.

**Q1. What happens today when the player changes the portfolio's archetype?** After B2, does a switch drain only the short slot (the two-desks note's A2), or the whole book (V6.1 §10)? IP-2 and IP-3 need it to touch the short slot alone.

**Q2. When does the new archetype start?** The short slot holds one idea. So the new archetype starts when the running short idea finishes: at most 10 sessions, sooner at its line or on its desk's own exit.
- Fable told the founder the new archetype could start at once on free cash. That doesn't fit one short slot, and this note corrects it.
- **Option (a):** wait, as above.
- **Option (b):** more than one short slot. See Q5, which would settle this too.

**Q3. Can the player's view reach a desk?** Fable also told the founder he could tell the archetype the market looks risky, and that it might tighten or exit in character. As built, a desk reads the price list and saved theses, and its only calls are hold and exit. Is a short player note that the desk reads at the close a small addition, or a new source with its own rules? It isn't needed for launch.

**Q4. What does a short-slot test with a strategy and a plan take?**
- Which parts of trader v1's plan check can the book reuse? Input A-5 calls for one plan check shared by the game and every screen.
- The book has line exits and settlement at session 10. A target exit, a time limit and a progress action would be new. What is the smallest first step: the strategy label and the plan recorded on the idea, with exits unchanged?
- Trader v1's plan limits are sized for a three-day match. The book needs its own plan template per family for 10 sessions. Every number in it needs measurement.
- The desk drafts after the close and code buys at the next session's first window. Does that match "valid at the prior close", with the shelf life the frequency count supports (the confirmation session and the next two)?

**Q5. Pace.** One short slot with one 10-session test gives each archetype about two tests a month. The founder wants this side to feel faster, and the Command Center's design draws the short slot as three small setups. Could the short desk hold several single-name setups at once, each with its own plan? Please bring him:
- the effect on the short slot's 20% cap and the 15-position limit;
- the effect on the $3 monthly bound;
- whether a new archetype could then take a free setup at once, which would answer Q2.

**Q6. The split between the two desks.** The Command Center's design shows a two-part bar at the top of the screen: the agent's share and the archetype's, each with how much is in use. A tap opens the setting.
- Is the allocation setting from the two-desks note built? If not, what is the smallest version?
- How does a split sit on today's slot caps (short 20%, medium 30%, long 40%, cash 10%)? The founder's first example was 33% short and 67% longer.
- Can the book report how much of each desk's share is at work?

## 7. What does not change

- V6.1's loop, the medium and long slots, the rails, the matched comparisons, the risk rule and the result words.
- "No buttons in the book", the $100,000 book and the $3 monthly bound, until Q5 is ruled.
- The two desks as built.
- Nothing from the book reaches a battle except through the Forge offer.
- Release 1 claims no learning.

## 8. Where this is heading (context, no action)

- **The Command Center** is being redrawn as the portfolio's home. Four Claude Design rounds are back and a fifth is the final pass:
  - the top shows the player's agent and the archetype side by side, with the split bar under them;
  - the Overview is the Idea book's positions table;
  - the tabs are Overview · Ideas · Setups · Partnership.
- **The Idea book would stop being a separate screen.** Its three tabs fold into the hub: Positions into Overview, Desks into Ideas and Setups, History into Partnership. The founder will bring you the final mock-up before anything is built.
- **The 23 Nov idea book screen brief** draws the short slot as a thesis card. If IP-10 goes ahead, that card changes to the hub's setup row.
- **The Forge rebuild** comes later. It would hold three kinds of earned item:
  - ideas and their lists, owned by the partnership (IP-7);
  - plays, owned by the archetype that earned them (IP-6). A play is a strategy with a record behind it;
  - risk settings, owned the same way.
- **The Forge build waits** on trader v1 battles that carry named strategies.
