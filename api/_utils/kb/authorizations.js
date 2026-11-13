// api/_utils/kb/authorizations.js
//
// KB-0 — THE APP-USE AUTHORIZATION LIST (Shared Research spec V1.2,
// Amendment A §A3.4; founder ruling R-KB-5). Accepting a method's content and
// allowing the app to use it are two separate acts. The knowledge base's
// acceptance record is the first; one entry here is the second.
//
// SHIPPED EMPTY. With this list empty, every call to loadAuthorizedMethod and
// authorizedMethodFor answers `not_authorized`, so no player and no prompt can
// change. The first entry, its pin (packages.test.js, the row that pins this
// list to `[]`) and its record under docs/approvals/ move together in ONE
// founder-merged commit (Amendment A §A6 step 5). Rollback is removing the
// entry: a session holding the method falls back to the baseline on its next
// turn and records the change.
//
// THE ENTRY'S SHAPE (loader.js isAuthorizationEntry checks it; a malformed
// entry is ignored at run time, and packages.test.js fails the build if this
// list holds one):
//
//   { id,                 the method's id, e.g. 'KB-IDEA-EVALUATION-001'
//     version,            its version, e.g. '0.1'
//     sha256,             the method hash: SHA-256 of method_text (64 lowercase hex)
//     acceptanceSha256,   SHA-256 of the acceptance record's text (64 lowercase hex)
//     consumers,          a non-empty list, e.g. ['shared_research.observation']
//     audience,           'allowlist' | 'all'
//     newSessions,        optional; false for a superseded version: sessions that
//                         hold it keep it, new sessions don't get it
//     authorizedAt,       an ISO instant
//     authorizedBy,       e.g. 'founder'
//     evidenceRef }       the record under docs/approvals/
//
// No other key is allowed. No two entries taking new sessions may share a
// consumer. Widening an audience to 'all' is a separate change of its own.
//
// No imports: this file is data.

export const KB_APP_USE = Object.freeze([]);
