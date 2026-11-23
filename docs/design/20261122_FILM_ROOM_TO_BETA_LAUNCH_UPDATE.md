# Film Room → beta launch chat: what changed since the Nov 20 reply

**Date:** 22 Nov 2026 · **From:** the Film Room chat · **To:** the beta launch chat, sent once · **Updates:** `claude/FILM_ROOM_REPLY_TO_BETA_LAUNCH_DEBRIEF_NOV20_2026.md`.
**No reply is needed.** Put the dates and the three switches on the launch board.
**Destination:** this chat's launch board. D2's fix round commits it as `docs/design/20261122_FILM_ROOM_TO_BETA_LAUNCH_UPDATE.md`. No docs-only PR.

## 0. In short

- **The debrief is still in for Dec 4,** in a different shape. The founder redirected the design on Nov 20: a page of text was too wordy.
- **The Film Room's front is now a picture of the game:** the score across the day, pins at the swaps and the player's directives, and two counts. The full tape sits behind one door.
- **The agent's debrief is one short line under each swap pin,** written overnight.
- **The idea is out of launch.** It returns after launch with the counts across games.

## 1. What is built

| Build | What | State |
|---|---|---|
| D1 (PR #1102) | The front: the game's flow | Merged Nov 21. On for the allowlist (the founder and FT_QA). |
| D2 (PR #1107) | The agent's words on the swap pins, and D1's follow-up fixes | Built Nov 22. In Astra's review. Merge planned by Mon Nov 30. |

## 2. The Nov 20 rulings, as they stand

| # | Then | Now |
|---|---|---|
| FD-1 | The debrief is the agent's words; the facts are the Film Room's. | Stands. |
| FD-2 | The model reads a day digest. | Stands. The digest holds the day's swaps and the agent's own recorded reasons. It holds no player-written text. |
| FD-3 | A debrief idea, shown and stored, for the Practice Field to take. | **Withdrawn for launch.** No idea is written, shown or stored. |
| FD-4 | One call per battle day, at night, about 2 cents. | Stands, at about a third of a cent per battle day. |
| FD-5 | Its own records and one rules block the founder deploys. | Stands. |
| FD-6 | The old nightly review is untouched. | Stands. |
| FD-7 | The idea's sub-switch as the cut line. | Gone with the idea. There is no `FILM_ROOM_DEBRIEF_IDEA` switch. |

## 3. For the Practice Field chat

The Nov 20 reply's §4 paragraph asked the Practice Field to read debrief ideas. **It is withdrawn.**
- If it was sent, tell the Practice Field chat once that there is no debrief idea at launch and nothing for it to build.
- If it wasn't sent, don't send it.

## 4. The switches and the dates

**Three switches go to `'on'` on Thu Dec 3:**
- `FILM_ROOM_CARDS_MODE`, the cards;
- `FILM_ROOM_FLOW_MODE`, the front;
- `FILM_ROOM_DEBRIEF_MODE`, the agent's words.

| Date | Step |
|---|---|
| By Mon Nov 30 | D2 merged. The same day, the founder deploys the Firestore rules. |
| The night after that deploy | The first words are written, for the founder's and FT_QA's battles. |
| Wed Dec 2 | The FT_QA pass on the cards, the front and the words together. The Film Room writes the brief. |
| Thu Dec 3 | The three switches. Before the cards' switch, the founder runs the one-time count of old Practice cards (Build C, CB-6). |

**Also changed:** the cron count is 47 of 100, with the new nightly job at 10:45 PM Eastern (11:45 PM in summer).

## 5. For the board, after launch

- **"One debrief, not two":** whether the new words replace the old nightly review.
- **The habits:** the front's counts across games, and one idea drawn from them.
