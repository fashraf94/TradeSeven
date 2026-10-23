// __mocks__/firebase/firestore.js
//
// TEST-ONLY: vitest's redirect mock for the 'firebase/firestore' package. A
// test opts in with a BARE `vi.mock('firebase/firestore')` — no factory — and
// no test gets it otherwise.
//
// Why a redirect and not a factory: a redirect is loaded as an ordinary
// module, so every import of the package resolves here. A FACTORY mock can
// fall through to the real SDK when one importer's dynamic imports of the
// mocked module overlap — vitest's module runner tracks a mock under
// evaluation on the importer's shared call stack (vitest
// startModuleRunner: "this will not work if user does Promise.all(import(),
// import())"), and App.jsx's effects import firebase/firestore from many
// places in one mount flush (Command Center S3 review T2-8).
//
// Every export is a vi.fn with an inert default; a test programs what it
// needs (getDocs, say) per row.

import { vi } from 'vitest';

const unsub = () => {};

export const getFirestore = vi.fn(() => ({}));
export const collection = vi.fn((db, name) => ({ collection: name }));
export const doc = vi.fn(() => ({}));
export const query = vi.fn((col, ...clauses) => ({ ...col, clauses }));
export const where = vi.fn((field, op, value) => ({ field, op, value }));
export const orderBy = vi.fn(() => ({}));
export const limit = vi.fn(() => ({}));
export const onSnapshot = vi.fn(() => unsub);
export const getDoc = vi.fn(async () => ({ exists: () => false, data: () => null }));
export const getDocs = vi.fn(async () => ({ docs: [], empty: true, size: 0, forEach: () => {} }));
export const setDoc = vi.fn(async () => {});
export const addDoc = vi.fn(async () => ({ id: 'x' }));
export const updateDoc = vi.fn(async () => {});
export const deleteDoc = vi.fn(async () => {});
export const serverTimestamp = vi.fn(() => new Date(0));
export const Timestamp = { now: () => ({ toDate: () => new Date(0) }), fromDate: (d) => ({ toDate: () => d }) };
export const writeBatch = vi.fn(() => ({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {}) }));
export const arrayUnion = vi.fn((...a) => a);
export const arrayRemove = vi.fn((...a) => a);
export const increment = vi.fn((n) => n);
export const runTransaction = vi.fn(async () => {});
