# Film Room Build C spec V1 — Amendment E: rulings on Astra's C2 review (2026-11-16)

**Status:** the Film Room chat's rulings on Astra's C2 review (`docs/audits/20261116_ASTRA_REVIEW_FILM_ROOM_C2_EXCERPT.md`: DO NOT MERGE, findings C2-F1 to C2-F4, the §5 boundaries for Amendment D, and the §6 backlog). The founder approves them by sending the C2 fix prompt. The fix round builds them and commits this amendment.
**Destination:** `docs/specs/FILM_ROOM_BUILD_C_SPEC_V1_AMENDMENT_E_20261116.md`, with one `docs/README.md` row, committed by C2's fix round. No docs-only PR.

## CE-1. No identifier rides in on someone's words (C2-F1)

Labels kept ids out of the excerpt's own fields, but not out of the words it quotes: a player's note, the agent's rationale or a directive can hold a pasted id. Shared contract V2 §5.1 says no raw identifiers reach a prompt, and BC-1 says nobody's words are rewritten. So a quotation that holds an identifier is **left out whole**, never redacted.

**The policy, one shared module, applied when the excerpt is built:**
1. **Exact ids.** A quotation is omitted when its text contains any id this excerpt knows:
   - the battle;
   - the owner's uid;
   - the battle's agent, the clone and the parent;
   - the card's entry;
   - the idea's watchlist;
   - the nomination;
   - the book, when known.
2. **Id shapes.** A quotation is omitted when its text contains a token, bounded by non-alphanumerics, of any shape the platform mints. At least:
   - a Firestore auto-id: exactly 20 characters of `[A-Za-z0-9]`, holding a digit, an upper-case letter and a lower-case letter;
   - a UUID;
   - the platform's prefixed agent ids (`casual-agent-…` and the Mandate's `mgr_…`, among others).

   The build lists every id kind the platform mints, and pins the list.
3. **Recorded words are checked against their own domains.** A field outside its domain is absent:
   - `symbol`, against the ticker shape the universe uses;
   - `situationId`, against the registry;
   - the route, against `CARD_ROUTES`;
   - the exit's mechanism and reason, against the writer's lists;
   - the card's question, against the menu at its version.

- **Applies to:** every quotation (the note as `inputQuote`, the idea's statement, the rationale's two texts, the directive's two texts).
- **The screen** uses the same rule. A statement the excerpt would leave out is not on the subject line either (CC-7).
- **Ordinary prose must pass:** tickers, prices, dates, percentages and ordinary words of any length. Rows pin that.

## CE-2. The census reads imports with a real parser (C2-F2)

A hand lexer can't always tell a regex literal from division, and Astra hid a real import behind one.
- **The fix.** Import extraction for the census and the write gate moves to a real JavaScript parser: `@babel/parser`, with JSX, at the version the lockfile already holds, declared as a devDependency so it isn't borrowed from another package. No new package is downloaded.
- **What it must still catch:** static and dynamic imports, `import()` with an options argument, re-exports, the `@/` alias, and same-line imports. Strings and templates that only look like imports are not imports.
- **Unchanged:** every path, root, reach pin, the direct-edge rule and the whole-closure ledger check.
- **The parse cache** keeps the census inside its time limits.

## CE-3. Every time is a real instant, or nothing is inferred from it (C2-F3)

- **One strict parser** for every instant the excerpt carries or compares: a full ISO 8601 date-time with an offset or `Z`, on a real calendar date and a real clock time. 30 February, 31 April and 24:00 are refused.
- **What uses it:** the shared `instantText`, the exit and bar comparison in `afterExit`, and every tie-break by time.
- **`afterExit` needs a strict exit instant.** Without one it is absent. The R6 check boundary by `tickSeq` stays as built, and doesn't need a time.
- **A quotation whose time is not strict** keeps `at: null` (its words stay, if CE-1 allows them).

## CE-4. A tie the rules don't settle means nothing is said (C2-F4)

At each selection (the rationale row, the directive, the exit, the count's item or check, the series bar):
- **Identical candidates count as one.** Candidates that tie at the selecting key and carry identical values for every field the excerpt would take are one candidate.
- **Conflicting candidates leave the field out.** Candidates that tie and disagree make the field absent, with every field that depends on it. `afterExit` depends on the exit, and `barsAfter` counts distinct bar starts.
- **Array order is never a rule.** A permutation of the stored rows never changes the answer.

## CE-5. Amendment D, as Astra bounded it

The fix round builds CD-3, CD-8, CD-14, CD-16 and CD-17 within Astra's §5 rows, including CD-8's four completeness details:
1. **The battle already read.** Use the battle `ownedDayOf` already reads; add no new lookup.
2. **The version's provenance.** Give the frozen version a truthful recorded provenance on both the excerpt and the screen bindings.
3. **The check.** Compare the version document with the carriage's list, version, owner and content hash.
4. **The pins to update:**
   - the `equippedHypothesis` reader census in `api/_utils/hypothesisRecords/carriage.test.js`;
   - the fixture's carriage and hash;
   - the read-scope rows;
   - the goldens;
   - the subject bindings.

   Keep the excerpt's no-write closure honest.

**Two corrections to Amendment D's wording, to what was built:**
- **CD-8, the version document.**
  - **Another owner's version, or one that contradicts the carriage** (another list, another version number, another hash): **no idea at all.** The carriage is server-written, so a mismatch is corruption, and nothing is said.
  - **A version that is missing or that failed to read:** the idea without its statement.
  - **The screen and the excerpt** treat each case the same way.
- **CD-10, a read the rules deny.** The subject line shows without the idea ("ETN · Industrials"), as built. CD-10's "no line" covered only loading and failure, and the denied case wasn't meant to be in it.

## CE-6. Astra's backlog, settled in the fix round

- **A null argument** returns `null`, like any other malformed argument. Validate before destructuring.
- **Report §6.2 is narrowed.** A failed core read (the card, the tape day, the battle) gives `null`. A failed auxiliary read (the version, the series) gives a partial excerpt, as each field's contract says.
- **The contract says what the excerpt is not:** a consistent snapshot, or a commit-time receipt. Its gets can see different revisions. The consumer's W-05 rechecks at selection and before commit remain the consumer's.
- **The root count** reads twenty roots on nine paths, everywhere it is stated.
- **The pre-existing import gaps** (same-line imports, `import()` with options, false positives inside strings) close with CE-2.
