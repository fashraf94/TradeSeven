// api/_utils/filmTape/errorClass.js
//
// Film Room B1.1 item 5 — ONE SAFE ERROR-CLASS LIST (Build B Amendment C,
// RC-4; Astra's B1 confirmation, N1). Every error class the tape or the census
// prints comes from this fixed list of REAL error classes; any other name
// prints as `Error`. A lexical rule ("an identifier ending in Error") let a
// class-shaped name carry an id past the scrubber (N1: `FakeOwner31Error`);
// a list cannot be planted into.
//
// Used by: the T1 note (tapeAssemble.js opponentReader), the meetings note
// (tapeAssemble.js meetingsOrUnavailable), the tagger's failure note
// (tapeTags.js tagTapeDay) and the census's failure line
// (scripts/census-film-room-b1.mjs censusErrorLine).
//
// Zero imports, data and one pure function: the census's write-grep gate
// reads the files it runs over production data, so this holds no mutators.

/**
 * The real error classes these paths can raise, each with where it comes
 * from (the versions installed with this tree's package-lock.json).
 */
export const ERROR_CLASSES = Object.freeze([
  // ECMAScript built-ins (ECMA-262: Error, the six NativeError types, AggregateError)
  'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'EvalError', 'URIError', 'AggregateError',
  // firebase-admin 13.7.0, lib/utils/error.js. Each sets no `name` of its own
  // (an instance's name is "Error"), so it is known by its constructor:
  'FirebaseError',          // :25, the base every Admin SDK error extends; a FirebaseFirestoreError instance reports
                            //      it, because the base constructor resets the prototype to its own (:38)
  'FirebaseAppError',       // :95, app initialisation and the credential (lib/app/credential-internal.js:85-324)
  'FirebaseFirestoreError', // :187, getFirestore()'s own failures (lib/firestore/firestore-internal.js:39, :80, :121, :137)
  // google-gax 4.6.1, build/src/googleError.js:23: the RPC error a @google-cloud/firestore 7.11.6
  // call can reject with (build/src/call.js:49, :73, :104). A gRPC status error from @grpc/grpc-js
  // 1.9.15 is a plain Error (build/src/call.js:29-33 callErrorFromStatus), so it prints `Error`.
  'GoogleError',
  // gaxios 6.7.1, build/src/common.js:31: the HTTP error of the service account's token request
  // (google-auth-library 9.15.1, the credential under Firestore's gRPC calls)
  'GaxiosError',
]);

/**
 * An error's class for a note or a failure line: the most specific LISTED
 * class it carries — its `name` when that is a listed class other than the
 * generic Error, else its constructor's name when that is listed — and
 * otherwise `Error`. Never throws (a getter that throws reads as no name).
 */
export function errorClassOf(err) {
  const read = (fn) => { try { const v = fn(); return typeof v === 'string' ? v : null; } catch { return null; } };
  const name = read(() => err?.name);
  const ctor = read(() => err?.constructor?.name);
  for (const c of [name, ctor]) if (c && c !== 'Error' && ERROR_CLASSES.includes(c)) return c;
  return 'Error';
}
