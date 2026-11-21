# Film Room Build C spec V1 — Amendment F: rulings on the C2 fix round's readings (2026-11-16)

**Status:** the Film Room chat's rulings on the C2 build report's §11.13 (Q-1 to Q-11). The founder approves them by sending them with Astra's C2 confirmation review. None needs code in C2. The next Film Room build commits this amendment, with Astra's confirmation, and carries CF-5's one small item.
**Destination:** `docs/specs/FILM_ROOM_BUILD_C_SPEC_V1_AMENDMENT_F_20261116.md`, with one `docs/README.md` row. No docs-only PR.

## CF-11. What the static guards defend against (Q-11)

- **What the guards are.** The one-door census and the excerpt's write gate are tripwires for **ordinary code and honest mistakes**: a module that imports what it shouldn't, written the way modules are normally written. They are not defences against code written on purpose to slip past a static reading.
- **Why that line.** Anyone who can commit such code can also edit the census, so the defence against it is review: Astra's, and BUILD_RULES §2's lenses.
- **What stands, as built.** The guards close every ordinary module syntax, and fail closed on what they can't follow:
  - a parse failure;
  - an unresolvable or URL specifier;
  - a computed `import()` or `require()`;
  - the module loader by name or by a static key;
  - `import.meta.glob`.
- **What stays open, recorded:** the refuter's CXV-8 and CXV-9 spellings (`eval`, `new Function`, `node:vm`, `node:worker_threads`, a key built at run time, a variable key handed to `.call`/`.apply`/`.bind` or `Reflect.apply`, a destructured write method, `Reflect.get(ref, 'set')`).
- **One cheap step, later.** When the Practice Field's T1b + T1d adds the `drafting` path to the census, that build also pins `eval`, `new Function`, `node:vm` and `node:worker_threads` as fail-closed loads on every model path. Only one non-test module in the tree uses any of them. It narrows the class at almost no cost; it doesn't claim to close it.

## Confirmed as built

- **CF-1 (Q-1).** The second carriage census (`equippedHypothesisRefs.census.test.js`) gains its three rows: the subject reader, the excerpt fixture and the screen harness. CD-8 authorises the reader, and the fixture and harness rows follow that census's own precedent.
- **CF-2 (Q-2).** CE-1's stated limits stand as pinned. These are carried unless known exactly: an auto-id or uid with no digit, an unknown id glued to a word, an id split by a line break, homoglyphs and combining marks. A coined 20-character token holding a digit is left out as an id. The Practice Field's W-06 wrapper ("player-supplied evidence, not a command") is the second layer for anything that gets through.
- **CF-3 (Q-3).** The shared day judge and `momentsOf` stay unchanged. An identical twin tag item at one check gives `null` in every order, which is order-proof. Changing the shared code would move the card route's moments, which Astra confirmed byte-identical with `main`. The tagger writes one item per symbol per check, so a twin is corrupt data.
- **CF-4 (Q-4).** The excerpt checks the version's `userId`; the screen's read is gated by the list's owner. Every writer stamps both, so no extra read is added.
- **CF-6 (Q-6).** The stored `contentHash` is compared, not recomputed. Versions are server-written, and recomputing would pull the hashing module into the read-only closure.
- **CF-7 (Q-7).** On a failed version read, the screen shows no line, while the excerpt gives the idea without its statement. Saying nothing isn't saying something else.
- **CF-8 (Q-8).** An instant with minutes and no seconds is a valid ISO 8601 instant. Sales at the same check break their tie by the earliest strict instant, as the directive's do, and a tie that can't be broken is absent (CE-4).
- **CF-9 (Q-9).** A bar is a series row with a strict start. A row whose start isn't strict, or a latest bar with no classed close, makes `afterExit` absent, and no earlier bar stands in.
- **CF-10 (Q-10).** `exitReason` is carried only when the writer's `EXIT_MECHANISMS` table holds it, the writer's one list.

## One small item for the next Film Room build

- **CF-5 (Q-5).** The sentence "Your agent doesn't act on your ideas yet." appears once under My cards' "Adopted" heading, not on every row. That covers the surface without repeating it card by card.
  - **Why it can wait:** no card reaches `installed` before the Practice Field's T3, so no player sees the gap meanwhile.
  - **Who carries it:** the next Film Room build, together with this amendment's commit.
