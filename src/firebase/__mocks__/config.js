// src/firebase/__mocks__/config.js
//
// TEST-ONLY: vitest's redirect mock for src/firebase/config.js. A test opts in
// with a BARE `vi.mock('<relative path>/firebase/config')` — no factory — and
// no test gets it otherwise. A redirect is loaded as an ordinary module, so
// App.jsx's many dynamic `import('./firebase/config')` sites all resolve here;
// a factory mock can fall through to the real config (which throws without
// Firebase env vars) when one importer's dynamic imports of it overlap (see
// __mocks__/firebase/firestore.js; Command Center S3 review T2-8).
//
// `auth.currentUser` is the test's to set.

export const auth = { currentUser: null };
export const db = {};
export default {};
