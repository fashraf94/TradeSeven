# Firestore Security Rules — Version History

| Version | Date | Changes | Deployed By |
|---------|------|---------|-------------|
| v1 | — | Initial rules with basic read/write controls | Firebase Console |
| v2 | — | Added tiered structure (System/User-Owned/Gameplay) | Firebase Console |
| v3 | — | Added bugReports, errorLogs, draftUserStats, options/earnings entries | Firebase Console |
| v4 | Feb 16, 2026 | Fixed battles/trainingBattles create for V4 object format; Opened earningsTournaments & optionsTournaments for client create/update; Added bugReports/_counter; Simplified draftUserStats | Firebase Console |

## v4 Change Details

| Collection | Before (v3) | After (v4) | Why |
|------------|-------------|------------|-----|
| `battles` | `create: creator is string` | `creator is string` OR `creator is map` | BaggerBomb V3/V4 stores creator as object |
| `trainingBattles` | `create: userId is string` | `userId is string` OR `creator.odUserId is string` | Training battles may use creator object |
| `trainingBattles` | `update: checked creator.odUserId` | `update: true` (beta open) | Real-time state needs open updates |
| `earningsTournaments` | Read-only (all writes blocked) | Read + Create + Update | Client-side getOrCreate pattern needs create/update |
| `optionsTournaments` | Read-only (all writes blocked) | Read + Create + Update | Same getOrCreate pattern |
| `draftUserStats` | Complex write condition | `create, update, delete: true` | Simplified for beta, doc ID = userId |
| `bugReports/_counter` | Not present | `read, write: true` | ClashBot ticket counter support |

## Deployment Steps

1. Go to **Firebase Console** → your project
2. Navigate to **Firestore Database → Rules** tab
3. Replace the entire rules content with the contents of `firestore.rules`
4. Click **Publish**
5. Test all game modes (see verification checklist below)

## Post-Launch Security Hardening (When Firebase Auth Added)

Once Firebase Auth is implemented, tighten these rules:

```
// Tournament creation — only allow if authenticated
match /earningsTournaments/{doc} {
  allow read: if true;
  allow create: if request.auth != null;
  allow update: if request.auth != null;
  allow delete: if false;
}

// Battles — verify creator identity
match /battles/{battleId} {
  allow create: if request.auth != null
                && (request.resource.data.creator == request.auth.uid
                    || request.resource.data.creator.odUserId == request.auth.uid);
}
```
