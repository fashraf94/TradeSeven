# Build B spec V1.0 — Amendment I: founder rulings on Astra's B2 review (2026-10-22)

- **RI-1 — A replay answers only its owner (Astra F1, criterion 4).**
  - A create replay returns a stored entry only when that entry's own `ownerId` is the caller's.
  - A missing or different owner is refused, and the response holds none of the entry.
  - The open-card cap counts only the caller's own entries.
- **RI-2 — A successful write wins on screen (Astra B1).**
  - The receipt and the lists show a create's or retire's own result whenever it is newer, by `version`, than the counter's row.
  - A failed refresh doesn't put an older stage back on screen. Its error is shown beside the result.
- **RI-3 — The source moment is checked atomically (Astra B3).**
  - Inside the create transaction, the tape day is re-read and its exact moment checked again, so a re-write between the endpoint's check and the commit can't file a card for a moment the tape no longer holds.
  - This is built in the screen pass together with RH-6, and Astra's source-refresh race is re-run then.
- **RI-4 — Whitespace at the note's edges is trimmed (Astra B4, restating RH-3).**
  - Leading and trailing whitespace, including spaces, tabs, newlines and carriage returns, is trimmed. Any control character left inside the note is refused, not stripped.
  - Already built; no code change.
- **RI-5 — What the one-door census guards (Astra B2).**
  - The census catches ordinary imports of the ledger and ordinary reads of `plays` on every model path. It does not claim to catch deliberately obfuscated code: template-literal or computed dynamic imports, or string-built collection names.
  - Those spellings are backlog. Code review remains the guard against them, and acceptance C remains the runtime proof.
- **RI-6 — Environment-only failure.** `scripts/experiments/archetype-menu-dry-run/capture.test.js` needs git metadata and fails in any bare archive, the base's included. It is not a finding.
- **RI-7 — The screen pass's review re-checks this round.** That review includes F1's owner check and RI-2 in its scope.
