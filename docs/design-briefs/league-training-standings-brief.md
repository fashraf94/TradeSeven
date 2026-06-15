# Design Brief — League Training-Pod Standings, Over Five Days

**For:** Claude Design (no repo access — this brief is self-contained)
**What it is:** a redesign of the League **training-pod standings** as an *over-time* view — the four players in a pod, tracked across the five daily closes of one tournament week. It is the **time-series sibling** of the standings pattern we already built for the Snake Draft, retold in the League's obsidian skin.
**Read this as design language only.** No components, no code, no styling tokens — just the information design, the mechanic, the states, the motion, and the feeling.

---

## 1. One-paragraph summary

Four players race for one week (five trading days). Each player has a single **standing** that combines their two markets — a three-pick "user" hand and a six-stock "agent" book — into one number, the *score of record*. We want to plot all four standings **as lines across the five daily closes**, so you can watch the pod reshuffle day by day: who pulled ahead, who slipped, the exact close where someone got overtaken, and — on the final day — who survives. It is a four-lane race chart with a clear leader, a clearly emphasized "you," and a dramatic daily-close beat. It should feel like the **moving-picture version of the four-player standings card the League already has** (the ranked list of four with the teal "you" row and the trophy on the leader) — same vocabulary, now spread across days.

---

## 2. What you're designing — and what it's the over-time version of

The League already shows pod standings as a **static ranked list**: four rows, #1–#4, sorted by the score of record, with the current player's row highlighted in teal, a small "CPU" chip on bot seats, the leader carrying a trophy, and negative scores shown honestly in red (not hidden). That snapshot answers *"where does the pod stand right now?"*

This brief asks for the **same standings, unrolled across the five daily closes** — answering *"how did the pod get here, and where is it heading?"* Keep every piece of that existing vocabulary; just give each player a **line through time** instead of a single row.

The reference pattern we are adapting (from the Snake Draft) has two halves we are fusing:

- **The altitude map** — a single-snapshot view where vertical height *is* score: the higher a player sits, the more points they have; the leader floats at the top; "you" are emphasized and tethered to a center axis; gaps between players are called out ("you're 14 behind 2nd"). Height = standing. That's the *y-axis idea*.
- **The five-day breakdown** — a stacked, day-by-day ledger: five blocks, one per trading day, each a small ranked list for that day's close, marked Complete / In Progress / Upcoming, topped by an overall total. That's the *x-axis idea* (five discrete daily closes) and the *state idea* (each day is banked, live, or not yet played).

**Fuse them:** take "height = standing" from the altitude map and "five daily closes, each banked at market close" from the breakdown, and draw **one line per player across five x-stops**. Lines rise, fall, and cross. That crossing — an overtake landing at a daily close — is the whole point.

---

## 3. The League skin (obsidian) — translate *out* of the holographic look

The reference pattern is rendered in a **holographic / cyan** aesthetic: glowing cyan "rivers," neon hexagon pods, constant pulsing bloom, topographic grid. **Do not carry any of that over.** The League lives in an **obsidian** skin, and the over-time view must be obsidian-native.

Translate the *pattern* (lines, daily-close dots, leader/you emphasis, overtake callout, settle motion) into the League's existing palette and materials — **don't prescribe the Snake Draft's specific objects** (no hexagon pods, no cyan glow, no neon river). Let the visual *form* of the lines and markers be yours to choose; just keep it consistent with the skin below.

**The obsidian palette already in use (anchor to these, don't reinvent):**

| Role | Treatment |
|---|---|
| Ground / canvas | Near-black obsidian (≈ `#0D0E12`); cards a hair lighter (≈ `#15171E`) |
| The agent layer's tint | A faintly purpled dark (≈ `#1C1A27`) — used when the agent book is in view |
| "You" accent | **Teal** (≈ `#5EEAD4` / `#14B8A6`) — the player's own line, dot, label, and row highlight |
| Leader / trophy | **Gold** (medal gold, ≈ `#F0C75E`) — the top line and the winner's marker |
| Up / positive | **Emerald** (≈ `#34D399` / `#10B981`) |
| Down / negative | **Red** (≈ `#EF4444`) — shown honestly, never hidden |
| The agent (bot) layer | **Purple** (≈ `#9333EA` / `#A78BFA`) — reserve purple for "agent," not for players |
| Text | Primary off-white (≈ `#E2E8F0`); muted slate (≈ `#94A3B8`); faint (≈ `#64748B`) |
| Material / depth | A carved-bevel feel — a faint top highlight and a soft bottom shadow inset into each surface — *instead of* outer neon glow |
| Numerals | Tabular / monospaced figures so columns of points line up |

**The aesthetic shift in one line:** the Snake Draft *glows*; the League *is carved.* Replace bloom and pulse with restraint, hairline dividers, beveled surfaces, and a single confident accent (teal for you, gold for the leader). Motion is quiet and gated (see §7).

---

## 4. Information design — what every visual element maps to

**The plot.** A wide chart. Time runs left→right; standing runs bottom→top.

- **Player → a line (a "track").** Four players, four lines, drawn the full width. The line *is* the player; their face/name/seat lives at the line's right end (its current head).
- **Day → x-position.** Five fixed stops across the width, left to right: **Day 1 … Day 5**, each one a **daily close** (the moment the day's scores are banked at market close). The space between two stops is "one trading day's worth of movement." Label the stops with the weekday/date.
- **Standing (score) → y-position (altitude).** Higher = better. A line's height at a given day-stop is **that player's running standing after that close** — not that single day's points, but where they stand in the pod at that moment (see §5 for why this matters). The y-axis is the **score of record** (the combined number from §8), with a clear zero line; gridlines optional and faint. Rank (#1–#4) is *emergent* from height — the topmost line is 1st — exactly as in the altitude reference, where order falls out of altitude rather than being drawn as a bare ladder.

**Emphasis — who reads loudest:**

- **The leader** (top line at the current/last stop): gold accent, slightly heavier weight, a trophy/crown marker at its head. This is the "who's winning" read at a glance.
- **"You"** (the viewing player's line): **teal**, the thickest/brightest line, an emphasized head marker, and a persistent label. If it helps legibility, anchor it with a light tether or a baseline reference the way the altitude reference tethers the user to the axis — but obsidian-quiet, not glowing. You should be able to find yourself in under a second.
- **The other two players:** muted slate, thin lines, lower contrast — present and readable, but clearly background to you-and-the-leader. **CPU seats** carry the same small "CPU" chip used in the existing standings, and read as the most muted of all (a bot is context, not a rival to fear).
- **Gaps / overtakes:** where it's dramatic — the gap between you and the seat directly above you, and the gap between 1st and 2nd — surface a small callout near those two lines ("+14," "you're 6 back"), echoing the reference's gap callouts. Keep them sparse; one or two at a time, not on every pair.

**Standings movement across the five days** is the headline data: because each line is a *running* standing, the lines **cross** whenever the order changes. A line climbing past another between two day-stops *is* an overtake; a line sliding under another is a fall. The shape of the four lines over the week tells the story — a runaway leader pulling away, a tight four-way knot, a late surge on Day 5.

---

## 5. The day-to-day mechanic — five daily closes, and how the eye reads a climb or a fall

**Five closes, banked one at a time.** The week is five trading days. At each day's **market close** the standings are "banked" — frozen into that day's stop on the chart. So the chart fills in **left to right, one stop per day**: Day 1 banks, then Day 2, and so on through Day 5.

**Each stop is a *cumulative* standing, not a day's delta.** This is the single most important data fact for getting the visualization right: the number banked at each close is **where the player stands so far**, already including every prior day — not "points earned today." (This differs from a naïve daily-bar reading.) Consequences for the drawing:

- A line's **height** at Day *N* = the player's standing through Day *N*. The right-most banked stop is the current standings.
- The **slope** of a segment between Day *N* and Day *N+1* is how much ground that player gained or lost *that day*: steep-up = a big day, flat = treading water, **down-sloping = they actually lost ground** (very possible — a player can give back points on a bad day, since the combined score can fall). Down-sloping lines are part of the drama; don't assume lines only ever rise.
- **Reading a climb or a fall:** the eye follows a single line's segments — up-up-up is a player building a lead; a line that dips then crosses below a neighbor is a player who lost a place. The **overtake** reads as the instant two lines swap vertical order between two stops.

**Day states** (carry these straight from the existing five-day breakdown):

- **Complete / banked** — a solid stop with a solid segment leading into it.
- **In progress (today, live)** — the right-most active day, not yet banked: draw its leading segment as **provisional** (a dashed or lighter "leading edge") running to a live, still-moving head, tagged **LIVE**. It can still reshuffle until close.
- **Upcoming** — days not yet played: ghosted/empty x-stops to the right, so the player can see how much week remains.

---

## 6. Interaction + states

**Live mid-week vs. final — the two top-level states:**

- **Live (mid-week):** the week is in flight. Days 1…*N–1* are banked (solid); today is the live leading edge (provisional, LIVE-tagged, still moving as prices move); days *N+1*…5 are ghosted ahead. The whole chart should feel *unsettled* — this is a race in motion, and nothing is final until banked. Surface a quiet "Day *N* of 5 · live until 4:00 PM ET" status.
- **Final (week banked):** all five stops solid; the Day-5 stop **is the week's verdict**. Crown the leader in gold with the trophy. Because this is bracket play, the **top two advance and the bottom two are knocked out** — so at Final, visually separate the four into **advancers vs. eliminated** (e.g., the two surviving lines stay full-color and lift/brighten; the two eliminated lines recede/desaturate). Reuse the League's existing end-of-week verdict language — *"You advanced," "Your run ended," "Bracket champion,"* with "Advancing: You, …" called out in emerald.

**Tap a day → that day's close.** Tapping an x-stop (or its date header) opens **that day's close scores**: the four players ranked by where they stood at that close, each expandable to the per-holding breakdown (which picks/stocks earned or lost that day). This is the existing five-day breakdown, reached *by tapping the point on the line.* For a live day, this reads as the current provisional close.

**Tap a player → that player's detail.** Tapping a line (or its head) opens **that player's standing, split into its two layers**: their three-pick user hand and their six-stock agent book, with the per-position detail and the running "why." Respect the League's transparency rule: another player's **agent reasoning stays concealed while their battle is live** and **unlocks for everyone at completion** (the end-of-week "film room"). Your own is always open. The leader and "you" are the obvious first taps.

**Secondary affordances:** let the player toggle emphasis (e.g., solo a single line, or mute the two background players) without losing the leader/you anchors. Keep the default uncluttered — four lines, you and the leader loud, the rest quiet.

---

## 7. Motion — how rank changes animate (the "altitude" rising and falling)

The signature motion is **altitude resolving at the daily close.** When a new day banks:

1. The four lines **extend one stop to the right** and **settle to their new heights** in one smooth move. A player who climbed visibly *rises*; a player who slipped *sinks*. This re-layout is the "rank change animates" beat — it should draw the eye to whoever moved most.
2. Each line's **head number counts up/down** to its new standing as it lands (an animated figure rolling to its value), so the magnitude of the day registers, not just the position.
3. If the move **crosses two lines** (an overtake), mark the crossing quietly — a brief accent on the two lines involved and a small "overtook" / gap callout at the cross — in obsidian styling (a restrained emerald or teal touch, **no cyan bloom, no shockwave**).

**Live (intra-day) motion** is gentler: the leading edge and its head drift as prices move — a soft, continuous "still-live" cue (a subtle breathing on the live head, a faint dash flow on the provisional segment), clearly lighter than the decisive close-time settle.

**Restraint and accessibility are mandatory.** The League's motion is **always reduced-motion-aware**: every animation must have a calm, near-instant, opacity-only fallback when reduced motion is requested. Translate the reference's *constant* glow/pulse into **occasional, meaningful** motion — things move when something *happened* (a close banked, an overtake landed), and rest otherwise. Carved obsidian, not a neon aquarium.

---

## 8. The data story + the emotional beat

**What's being plotted.** Each player's line is their **score of record — one combined number** built from two parallel markets they run at once:

- a **three-pick user hand** (their own picks, with overnight claims and in-week flips, shorts allowed), and
- a **six-stock agent book** (an AI "agent" running a long-only six-stock lineup that trades intraday on their behalf).

The two are fused into a single standing — the **agent book plus 1.5× the user hand** — and *that* single number is what climbs and falls on the chart. (On tap, §6, the line splits back into those two layers; but the line itself is always the one combined number.) Reserve **purple** for the agent layer wherever the split is shown, so "your hand vs. your bot" stays legible.

**Why it's dramatic to watch.** It's a **five-day elimination race** where the standings are *provisional until banked.* You're not just up or down — you're up or down *with two more closes to play.* Every afternoon at 4:00 the lines lurch and resettle; an overtake you didn't see coming lands at the close; your teal line claws toward the gold one or slips toward the cut line. And on **Day 5 the chart becomes a verdict** — top two advance, bottom two go home. The whole appeal is the *shape of the week*: the comeback, the runaway, the four-way knot that breaks on the last day. The over-time view exists to make that shape **visible and suspenseful** in a single glance.

---

## 9. Critical adaptations — state these explicitly

1. **Reframe for the League training pod.** This is **four players, five days, one combined score per player** — the *composite of two parallel layers* (a three-pick user hand + a six-stock agent book), **not** the Snake Draft's single self-managed portfolio. The line on the chart is that one combined standing; the two layers are a tap-away detail, not separate lines.

2. **The plotted number is a running standing, not a daily delta.** Each daily close already carries the *cumulative* standing through that day. Height at Day *N* = standing through Day *N*; slope between stops = that day's gain/loss (and it can be negative). Build the visualization on cumulative standings so the lines cross correctly — do **not** plot per-day points as the height.

3. **Render in the obsidian League skin — translate out of holographic/cyan.** Obsidian near-black ground, carved-bevel surfaces, hairline dividers; **teal = you, gold = leader, emerald = up, red = down, purple = the agent layer.** **Do not** import Snake-Draft-specific objects — no hexagon pods, no cyan "river," no neon glow, no shockwaves. Describe-the-pattern, choose-the-League-treatment: the line-per-player / day-on-x / altitude-on-y / leader-and-you emphasis / daily-close beat / overtake callout / settle-motion are the pattern; their obsidian *form* is yours to design.

4. **It must feel like the over-time version of the four-player pod standing the League already built.** Same vocabulary — the ranked four, the teal "you," the "CPU" chips, the honest red negatives, the trophy on the leader, the "advancing: …" verdict — **just spread across the five days** instead of frozen in a single snapshot. A player who knows the existing standings card should recognize this instantly as "that, but moving."

5. **Honor the League's two non-negotiables:** **transparency timing** (another player's agent reasoning is concealed while live, unlocks for all at completion) and **reduced-motion safety** (every animation has a calm opacity-only fallback). Both are skin-defining, not optional polish.

---

## 10. Quick do / don't

**Do**
- Make "you" (teal) and the leader (gold) findable in under a second.
- Let lines **cross**; the overtake at a close is the hero moment.
- Allow **down-sloping** segments — losing ground is part of the story.
- Fill the chart left→right; ghost the days not yet played.
- Make the Day-5 stop read as a **verdict** (advance vs. eliminated).
- Move on events (a close, an overtake); rest otherwise.

**Don't**
- Don't use cyan, neon glow, hexagon pods, rivers, or shockwaves.
- Don't plot per-day points as line height (use the running standing).
- Don't draw the two layers as two lines — one combined line, split on tap.
- Don't let the two background players (or CPUs) out-shout you and the leader.
- Don't animate constantly; don't ship motion without a reduced-motion fallback.
- Don't reveal a live opponent's agent reasoning before completion.
