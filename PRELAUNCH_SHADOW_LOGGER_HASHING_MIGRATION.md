# Pre-Launch Cleanup — Shadow Logger UID Hashing Migration

**Status:** Backlog — to complete before public launch (post-beta)
**Owner:** Flash + Claude Code
**Estimated effort:** 1-2 focused sessions (~6-10 hours)
**Priority:** High — privacy posture for public launch
**Prerequisite:** Beta has completed; no major shadow logger schema changes pending
**Filed:** April 25, 2026, during Phase 0 audit of Discover/Signal Drop specs

---

## Why this exists

The shadow logger (`api/_utils/shadowLogger.js`) currently writes raw Firebase UIDs to GCS streams. Audit finding from the Phase 0 audit of the Discover/Signal Drop specs surfaced this as a privacy gap: Firebase UIDs are opaque strings, but they can be cross-referenced with the `users` Firestore collection to identify a person. The data we collect post-launch will live in those streams for as long as we retain it.

At beta scale with TOS-accepting users, this is acceptable. At public launch — when anyone can sign up and we're collecting at scale — it isn't. Migrating to hashed UIDs before public launch is the right time: late enough that we're not changing infrastructure right before beta ships, early enough that the bulk of our retention-relevant data is hashed from day one of public availability.

This document defines the work needed.

---

## Scope

Migrate every shadow logger call site to hash the user ID before logging. Update the appendToStream utility to make hashing the default behavior so future streams inherit it.

Affected:
- `api/_utils/shadowLogger.js` (the utility itself)
- Every call site that passes a `userId` field into a shadow log record
- The deletion-request flow used by Signal Drop's user-data controls (must hash before deletion lookup)
- Any future analytics queries that filter by user (must hash before query)

Not affected (intentionally):
- Firestore documents — Firestore continues to use raw UIDs for ownership rules. Hashing is GCS-only.
- The user-facing UI — users never see UIDs, hashed or otherwise.
- Existing GCS data — historical raw-UID records are NOT retroactively hashed. They remain as-is until natural expiration via retention policy. Migration applies only to NEW records written after the cutover.

---

## Implementation outline

### 1. Hashing utility

Create `api/_utils/hashUserId.js`:

```js
import crypto from 'crypto';

const SALT = process.env.SHADOW_LOG_SALT;

if (!SALT) {
  throw new Error('SHADOW_LOG_SALT environment variable is required');
}

/**
 * Deterministically hash a Firebase UID for shadow log writes.
 * Uses SHA-256 with a server-side salt. Same UID always produces same hash,
 * enabling per-user analytics on aggregated data without storing raw UIDs.
 */
export function hashUserId(uid) {
  if (!uid || typeof uid !== 'string') {
    return 'h_anonymous';
  }
  const hash = crypto.createHash('sha256');
  hash.update(SALT);
  hash.update(uid);
  return 'h_' + hash.digest('hex').slice(0, 16);  // 16-char prefix is sufficient for uniqueness at our scale
}
```

Add `SHADOW_LOG_SALT` to Vercel environment variables. Generate a strong random value (~32 bytes hex) and store it. **Do not commit it to the repo.** Rotating the salt later would invalidate analytical joins, so treat it as a one-time decision.

### 2. shadowLogger.js update

Modify `appendToStream` to hash automatically:

```js
import { hashUserId } from './hashUserId.js';

async function appendToStream(stream, record) {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const eventId = generateEventId();

  // Hash any userId field before logging
  const sanitized = { ...record };
  if (sanitized.userId) {
    sanitized.userIdHash = hashUserId(sanitized.userId);
    delete sanitized.userId;
  }

  const enrichedRecord = {
    ...sanitized,
    _stream: stream,
    _loggedAt: now.toISOString(),
  };

  // ... rest of existing GCS write logic
}
```

This is the load-bearing change. Every existing call site that passes `{ userId: user.uid, ... }` continues to work — the utility intercepts and hashes. No call-site changes required for the basic case.

### 3. Call-site audit and fixes

Search the codebase for all shadow logger usage:

```bash
grep -rn "logConversation\|logDecision\|logDailyRegimeBrief\|logSignalDrops\|appendToStream" api/ --include="*.js"
```

Expected hits (as of audit time, may have grown):
- `api/agent/chat.js:336`
- `api/forge/workshop-chat.js:370`
- `api/cron/compute-daily-regime-brief.js`
- All Signal Drop endpoints (post-V1.1 ship)
- Any agent decision logging
- Any review/reflection logging

For each hit, verify:
- The record contains `userId` (will be auto-hashed by utility)
- No record contains a *different* user-identifying field (e.g., `user.uid` directly, or `userEmail`) that would bypass the hash
- Any nested user references (e.g., inside an `actor` object) are also hashed

If a call site passes user info in a non-standard shape, normalize it to `{ userId: uid, ... }` so the utility catches it.

### 4. Downstream consumer updates

Anywhere shadow log data is read for analytics:
- Update queries to use `userIdHash` instead of `userId`
- Update the deletion flow (`/api/forge/delete-drop-history` per Signal Drop spec) to compute the hash from the user's UID before searching GCS for records to mark for deletion
- Any internal dashboards or analytics scripts that filter by user must be updated to hash the input UID

### 5. TOS / privacy policy update

After migration:
- Update the TOS clause in the Signal Drop spec (Section 7.3) to reflect that GCS shadow logs use hashed user IDs, not raw
- Update any public-facing privacy policy to match
- Send a one-time courtesy notification to beta users that pre-launch infrastructure improvements include enhanced anonymization of analytics data (optional but consistent with honesty-as-a-value)

---

## Validation checklist

Before considering the migration complete:

- [ ] `SHADOW_LOG_SALT` is set in Vercel production environment and documented in internal credentials store
- [ ] `hashUserId.js` utility exists and is unit-tested with a few known inputs (verify deterministic output)
- [ ] `shadowLogger.js` automatically hashes `userId` fields; verified by writing a test record and inspecting GCS output
- [ ] All call sites grepped for `userId` in shadow log records have been verified to flow through the utility
- [ ] The Signal Drop deletion flow correctly hashes input UID before searching GCS
- [ ] No raw UID appears in any *new* shadow log record written after cutover (spot-check 50 records across all streams)
- [ ] Historical raw-UID records remain untouched; retention policy applies as before
- [ ] TOS / privacy policy updated to reflect hashed-UID behavior
- [ ] Spec documents updated to remove the "raw UIDs in shadow logs" caveat

---

## What this is NOT

To prevent scope creep:

- **NOT a Firestore migration.** Firestore continues to use raw UIDs. Ownership rules depend on it.
- **NOT retroactive.** Old GCS records are not re-hashed. Migration applies forward only.
- **NOT a full anonymization layer.** Other potentially identifying fields (IP addresses if logged elsewhere, content of user notes, etc.) are out of scope for this task. This task is specifically the UID-to-hash migration.
- **NOT a cryptographic-grade anonymization.** The hash is deterministic and can be reversed by brute force if an attacker has the salt and a list of candidate UIDs. The goal is reasonable privacy posture for analytics, not zero-knowledge anonymization. Higher bars require differential privacy techniques out of scope for this work.

---

## Risks and mitigations

**Risk:** Salt leaks. If `SHADOW_LOG_SALT` is committed to the repo or leaked via logs, anyone with it and a candidate UID list can reverse the hash. **Mitigation:** Salt is environment-only, never in code, never logged. Treat as production secret.

**Risk:** Salt rotation. If we ever rotate the salt, all analytical joins between pre-rotation and post-rotation data break. **Mitigation:** Treat the salt as one-time. Document that rotating it requires re-hashing or accepting analytics discontinuity.

**Risk:** Call site missed. A new shadow log call added between this writeup and migration time bypasses the utility. **Mitigation:** Step 3 grep is exhaustive at migration time. Any post-migration call sites must use the utility — make this a code review check.

**Risk:** Hash collisions. SHA-256 prefix at 16 chars is ~64 bits of entropy. At 100K users, collision probability is ~10^-9 (birthday-bound). **Mitigation:** None needed at our scale. If we ever hit 10M+ users, expand prefix to 24 chars.

---

## Effort breakdown

- Utility + env setup: 1-2 hours
- shadowLogger.js modification + unit tests: 1-2 hours
- Call site audit and fixes: 2-3 hours (depends on call site count at migration time)
- Downstream consumer updates (deletion flow, analytics): 1-2 hours
- TOS / docs updates: 30 minutes
- Validation pass: 1-2 hours

Total: ~6-10 hours, fits in 1-2 focused sessions.

---

## When to schedule

Target window: **2-3 weeks before public launch.** Late enough that all major schema changes are settled. Early enough to allow validation time and a couple of days of "live but watched" monitoring before launch traffic hits.

Add to pre-launch checklist alongside other privacy/security items (TOS finalization, privacy policy review, data retention policy).

---

*Filed during Phase 0 audit of Discover/Signal Drop specs.*
*Surfaced because Signal Drop V1.1 spec assumed hashed UIDs in shadow logs but audit revealed raw UIDs are current behavior across all 10 streams.*
