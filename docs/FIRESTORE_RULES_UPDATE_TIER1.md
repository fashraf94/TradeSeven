# Firestore Rules Update — Tier 1 Security Hardening

**Date:** March 2026
**Status:** [ ] Pending / [ ] Applied

## Change: errorLogs Abuse Protection

### What this fixes
The errorLogs collection currently allows ANY document to be created with no size or field constraints. A malicious actor could flood this collection with junk documents containing massive payloads, inflating Firestore costs.

### Current rule
```javascript
match /errorLogs/{logId} {
  allow create: if true;
  allow read: if false;
  allow update: if false;
  allow delete: if false;
}
```

### New rule
```javascript
match /errorLogs/{logId} {
  allow create: if request.resource.data.keys().size() > 0
                && request.resource.data.keys().size() < 15
                && request.resource.data.message is string
                && request.resource.data.message.size() > 0
                && request.resource.data.message.size() < 2000;
  allow read: if false;
  allow update: if false;
  allow delete: if false;
}
```

### How to apply
1. Open Firebase Console > Firestore > Rules
2. Find the `errorLogs` section
3. Replace the `allow create` line with the new version above
4. Click "Publish"
5. Verify: Open browser console and try `firebase.firestore().collection('errorLogs').add({ message: 'test' })` — it should succeed. Then try `firebase.firestore().collection('errorLogs').add({})` — it should fail.

### What the constraints mean
- `keys().size() > 0` — Document can't be empty
- `keys().size() < 15` — Max 15 fields per document (prevents bloated payloads)
- `message is string` — Must have a message field of type string
- `message.size() > 0` — Message can't be empty
- `message.size() < 2000` — Message limited to ~2KB (prevents massive string payloads)
