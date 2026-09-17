// api/_utils/chatTextSanitize.js
//
// THE ONE SANITIZE PATH FOR CHAT-TURN FREE TEXT.
//
// This is the transform `api/agent/chat.js` has always applied to the user's
// message before it touches a prompt, a log or Firestore: cap the length,
// flatten the control whitespace that would break a single-line record, and
// strip the angle brackets and braces that carry the injection and
// JSON-confusion shapes. It moved here, unchanged, the moment a SECOND caller
// needed it — the directive gate's forensics fields, which persist the model's
// own free text beside the user's.
//
// It lives in ONE module because two copies of a sanitizer eventually disagree,
// and the copy that is missing a rule is the one that writes the record
// (BUILD_RULES §4: never create a local copy). `sanitizeChatText` is the
// byte-for-byte transform chat.js applied inline; `sanitizeOptionalChatText`
// is the nullable wrapper the gate needs, because a model-proposed field may be
// absent, null, or not a string at all — and `String(null)` is the string
// "null", which is exactly the kind of fabricated record this build exists to
// prevent.
//
// ZERO IMPORTS on purpose: it must load under plain Node and must never join a
// mocked graph.

// The user-message cap chat.js has always used.
const MAX_CHAT_TEXT_LENGTH = 2000;

/**
 * The transform, on a value already known to be worth keeping.
 * @param {*} raw
 * @returns {string} possibly empty
 */
export function sanitizeChatText(raw) {
  return String(raw)
    .slice(0, MAX_CHAT_TEXT_LENGTH)
    .replace(/[\n\r\t]/g, ' ')
    .replace(/[<>{}]/g, '')
    .trim();
}

/**
 * The same transform for an OPTIONAL field: anything that is not a string, and
 * anything that sanitizes to nothing, is null rather than a coerced stand-in.
 * @param {*} raw
 * @returns {string|null}
 */
export function sanitizeOptionalChatText(raw) {
  if (typeof raw !== 'string') return null;
  return sanitizeChatText(raw) || null;
}

export default sanitizeChatText;
