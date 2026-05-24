# Firestore Index Drift Cleanup — Follow-up Workstream

**Filed**: May 24, 2026 (during Phase 4 Voice Layer Rework merge)
**Priority**: Medium — non-blocking, but blocks future safe `firebase deploy --only firestore:indexes` runs
**Estimated effort**: 30–60 min in a quiet maintenance window
**Trigger**: Next time anyone needs to deploy a new Firestore index via CLI, OR during the next pre-launch hygiene pass

## Context

During Phase 4 merge prep, attempting `firebase deploy --only firestore:indexes` surfaced two persistent issues with the project's Firestore index management:

### Issue 1: Source-of-truth drift

13+ indexes exist in production but are NOT in `firestore.indexes.json`. When `firebase deploy` runs, it prompts to delete them (because they're not in the source file). The user must remember to answer No every time, which is dangerous — one accidental Yes would delete production indexes that real queries depend on.

The 13+ drifted indexes (per the May 24 deploy attempt output):

- `discoverSectors` — `(status ASC, displayOrder ASC)`
- `battles` — `(opponent.uid ASC, archived ASC, timeline.createdAt DESC)`
- `fantasyTimesStories` — `(status ASC, expiresAt ASC)`
- `battles` — `(challengeCode ASC, state.status ASC, archived ASC)`
- `earningsEntries` — `(odUserId ASC, tournamentId ASC, entryNumber ASC)`
- `fantasyTimesStories` — `(primaryTicker ASC, reporter ASC, publishedAt ASC)`
- `fantasyTimesStories` — `(reporter ASC, type ASC, publishedAt ASC)`
- `battles` — `(creator.uid ASC, archived ASC, timeline.createdAt DESC)`
- `fantasyTimesStories` — `(tickers CONTAINS, publishedAt DESC)`
- `trackedPatterns` — `(userID ASC, CreatedAt DESC)` (note the capital C — likely typo)
- `discoverThemes` — `(status ASC, displayOrder ASC)`
- `trackedPatterns` — `(userId ASC, createdAt DESC)` (correct casing)
- `agentBattles` — `(agentId ASC, ownerId ASC, createdAt DESC)`
- Possibly others not captured in the May 24 output

### Issue 2: Malformed entry causing HTTP 400

At least one entry in the current `firestore.indexes.json` is malformed enough that the Firestore API rejects the deploy with HTTP 400. From the May 24 error:

```
Request to https://firestore.googleapis.com/v1/projects/tradeseven/databases/(default)/collectionGroups/ingestedClaims/indexes had HTTP Error: 400, this index is not necessary, configure using single field index controls
```

The `ingestedClaims` collection has an entry that should be a single-field index control (managed differently), not a composite index entry in the file.

**Impact**: All future Firestore index creation must be done manually via the Firebase Console until this is resolved. The `agentBattles (ownerId, status, completedAt DESC)` index added during Phase 4 was successfully created via console; the codebase entry at `firestore.indexes.json:234-251` matches production but the surrounding file is in a degraded state.

## Workflow

### Phase 1 — Inventory current production state

1. Run `firebase firestore:indexes --project tradeseven`. This outputs the current production index state as JSON.
2. Save the output to a temp file: `firestore-prod-indexes.json`. This is your source of truth for what production actually has.
3. Compare against the existing `firestore.indexes.json`. Identify:
   - Indexes in production but NOT in file (the 13+ drifted entries)
   - Indexes in file but NOT in production (would-be-deleted entries on next CLI deploy — most concerning)
   - Indexes in both that match correctly (the well-managed entries)

### Phase 2 — Identify and fix the malformed entry

1. Find the `ingestedClaims` entry in `firestore.indexes.json`. Inspect its shape.
2. Per the error message, the entry should be using "single field index controls" rather than the composite index format. Single-field exemptions live in the `fieldOverrides` section of `firestore.indexes.json`, not the `indexes` section.
3. Either:
   - Remove the malformed `ingestedClaims` entry entirely if it's not needed
   - Convert it to the correct `fieldOverrides` shape if a single-field index exemption was actually intended
4. Verify by attempting `firebase deploy --only firestore:indexes --project tradeseven --dry-run` (if the CLI supports dry-run for indexes — check `firebase deploy --help`). If not, this gets verified in Phase 4.

### Phase 3 — Restore drift back into the source file

1. For each of the 13+ production-only indexes, add the correct entry to `firestore.indexes.json` under the `indexes` array. The shape is:

   ```json
   {
     "collectionGroup": "<collection>",
     "queryScope": "COLLECTION",
     "fields": [
       { "fieldPath": "<field>", "order": "ASCENDING|DESCENDING" }
     ]
   }
   ```

2. For indexes with `CONTAINS` (like the `fantasyTimesStories.tickers` entry), the field type is `arrayConfig: "CONTAINS"` rather than `order`.
3. Be careful about typo-cased fields. The `trackedPatterns` collection has both `userID` AND `userId` indexed — preserve both if they're actually used by different queries, but flag for the team to investigate whether one is legacy/dead.

### Phase 4 — Validate clean deploy

1. Run `firebase deploy --only firestore:indexes --project tradeseven`.
2. Expected output: no "indexes not present in your file" warning, no prompt to delete indexes, no HTTP 400 errors.
3. The deploy should report something like "no changes to indexes" if everything matches, OR "creating index X" only for genuinely new entries.
4. Confirm in Firebase Console → Firestore → Indexes that no indexes are missing and none are in "Building" state from this deploy.

### Phase 5 — Commit and document

1. Commit `firestore.indexes.json` to a feature branch with message: `chore: reconcile firestore.indexes.json with production drift`.
2. Open PR with a brief description of what was done and a confirmation that no indexes were created or destroyed by this commit (only the source file was updated to match reality).
3. After merge, future `firebase deploy --only firestore:indexes` runs will be safe to execute without the "delete these indexes?" prompt.
4. Add a note to the project's deployment runbook (or create one if it doesn't exist): "Firestore indexes are managed via `firestore.indexes.json`. To add a new index: edit the file, deploy via `firebase deploy --only firestore:indexes --project tradeseven`, wait for Enabled status in console. Do NOT create indexes via console anymore — it will reintroduce drift."

## Risks and considerations

- **Production safety**: Phase 4 (the actual deploy) must NEVER answer "Yes" to the "delete these indexes" prompt, even if Phase 3 was done carefully. Always verify the file matches production state before deploying.
- **Index naming/casing**: the `trackedPatterns` collection has both `userID` and `userId` indexes. Investigate whether both are still used by live queries before assuming one is legacy. Use Firebase Console's "Index usage" stats if available, or grep the codebase for both casings.
- **CONTAINS vs ASCENDING/DESCENDING**: the `fantasyTimesStories` `tickers` index uses array containment. The JSON shape is different — uses `arrayConfig: "CONTAINS"` instead of `order: "ASCENDING"`. Refer to existing entries in the file for the correct format.
- **`ingestedClaims` collection**: verify with the team whether this collection is still in use and what queries (if any) it serves before removing or reshaping the entry.

## Done criteria

- [ ] `firestore.indexes.json` accurately represents production state (no drift in either direction)
- [ ] `firebase deploy --only firestore:indexes --project tradeseven` runs without prompts or errors
- [ ] PR merged with the reconciled file
- [ ] Runbook updated with the "edit file, deploy CLI" workflow
- [ ] Team notified to stop creating indexes via console (or, if console is preferred, runbook updated to require manual file updates after console creation)

## Related notes

- The Phase 4 `(ownerId, status, completedAt DESC)` agentBattles index was created manually via the Firebase Console on May 24, 2026 during merge. The matching entry exists in `firestore.indexes.json` at lines 234–251 (per the commit on `claude/brave-galileo-wh6cN`). This is the ONE drifted index where source and production happen to match coincidentally — the rest of the file has the drift problem described above.
- If a Phase 5+ workstream needs a new Firestore index, the implementation should: (a) add the entry to `firestore.indexes.json` in the feature branch, AND (b) create it manually via console during merge prep. This is dual-write but unavoidable until this cleanup workstream completes.
