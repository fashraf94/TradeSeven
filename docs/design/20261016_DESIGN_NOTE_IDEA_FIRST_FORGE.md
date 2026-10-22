# Design Note: The Idea Leads, the Watchlist Is Its Universe

**Date:** 16 October 2026 · **Author:** Fable · **For:** the Command Center / Forge redesign · **Founder ruling:** adopted as direction, 16 Oct 2026 · **Destination:** this note travels to the hub-redesign chat as an input; it commits to `docs/design/` with that arc's spec.

## The ruling, in one paragraph

The Forge presents watchlists as the primary object and the idea as a sub-panel under one. The founder's first live week showed that reads backwards: an idea written onto an old manual list felt bolted on. The direction is now **idea-first**: the idea is the thing a player creates, reviews and grows; the watchlist is the idea's **universe**, the set of names the idea applies to. This is a presentation and creation-flow change. The storage already works this way and does not change.

## What already exists (do not rebuild)

- An idea lives on its list as versioned records (`watchlists/{id}/hypothesisVersions/v{n}`), one idea per list, with a time-frame, a status and a review clock. A deploy carries the newest ready version into the battle, frozen. Every call the agent makes in that battle is tagged with that version. (Pilot P1a, P1b, P2; live for allowlisted accounts since 9 Oct.)
- **SignalDrop and theme are already idea-first.** The player starts from an article or a theme, the thesis and time-frame are parsed, the dialogue with the agent is the research, and the list is the *output*. Its v1 is saved as "researched". This is the shape to make universal.
- The manual path is list-first: the player builds names, and may write an idea afterward. That is where the seam showed.

## The redesign direction

1. **The Forge bench reads "Ideas", not "Watchlists."** Each card leads with the idea's statement, its status chip (Draft, Researched, Ready, Activated, Review due) and time-frame; the names appear underneath as "Universe · 10 names". A list with no idea is a legitimate state, labelled plainly: "Plain watchlist · no idea yet". Starter lists stay that way.
2. **"New idea" is the primary action**, with four doors: from an article (SignalDrop), from a theme, from a screen, written by hand. The universe is chosen or built in the same flow after the idea. "Build a watchlist" stays as the secondary door for pure universe lists.
3. **Deploy and the hub speak in ideas.** The deploy station says "Deploying with: *[statement]* · 10 names". The hub shows the player's ideas with their status, and surfaces **ideas due for review** (a count badge and a list). The growth rings the redesign draws should be rings *of ideas*: written, tested, reviewed, reaffirmed or retired.
4. **Review is a first-class moment.** When an idea comes due, the player sees evidence (how the universe did against the market over the idea's window, which battles carried it) and chooses reaffirm or retire. The deploy flow offers the same choice inline when a due idea is in the way; it never blocks the battle. (Built in the record slice: Pilot P1c build, Oct 2026.)
5. **Honest about the agent.** Until the learning arc lands (P3/P4), the agent does not read or act on ideas. Every idea surface says so in one line. Ideas are the player's record of what they believed and tested; the agent's relationship to them comes later and will be shown as such.

## What not to do

- **Do not make ideas a separate object spanning several lists.** It adds a "which idea rides?" step to every deploy and breaks the one-idea-per-battle record that the Film Room and the call records rely on.
- **Do not require every list to have an idea.**
- **Do not rebuild storage.** One idea (with versions) per list is the right model; only the surface flips.

## Known limit, accepted for now

Two different theses about the same names need two lists. If that chafes, a contained later change allows several ideas per list with one marked active for deploy.

## Vocabulary for the redesign

| Say | Not |
|---|---|
| Idea | Thesis, hypothesis (internal only) |
| Universe · N names | Watchlist (except for the plain, idea-less case) |
| Ready · Activated · Review due | Equipped, armed, pending |
| Reaffirm / Retire | Approve, delete, archive |

Status strings come from the blessed language tables (`docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md`, table C); no §E words.
