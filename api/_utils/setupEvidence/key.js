// api/_utils/setupEvidence/key.js
//
// ID-1 Build 1 — THE SNAPSHOT KEY (shape note V1.5 §3). One snapshot per
// (completed session, symbol, rule set). The document id is
// `${session}__${symbol}__${ruleKey}`, and the rule key encodes the WHOLE
// rule-set triple losslessly: `${setupVersion}.${thresholdsHash}.${semanticsId
// with "/" replaced by "~"}` (today tf-setup-v1.26f3f411b566.tf-setup-v1~sem-1).
// Each member is validated against its known shape, none can hold a reserved
// character, and an extra key on the rule set is refused, because a fourth
// identity member would otherwise vanish from the key. So parsing an id returns
// the exact triple and two different triples can never share an id.
//
// Pure: no clock, no I/O, no product imports.

const NAME = '[a-z0-9]+(?:-[a-z0-9]+)*-v[0-9]+';
const SETUP_VERSION_RE = new RegExp(`^${NAME}$`);
const THRESHOLDS_HASH_RE = /^[0-9a-f]{12}$/;
const SEMANTICS_ID_RE = new RegExp(`^${NAME}/sem-[0-9]+$`);
const SESSION_RE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * Upper-case letters and digits joined by single hyphens, as positions hold them (BRK-B). One instrument has one
 * key, so another spelling is refused, never repaired: `BRK.B` asks the provider for BRK-B.US, and accepting both
 * would give one instrument two immutable snapshots; `.US` is the provider's suffix, not a symbol.
 */
const SYMBOL_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const SYMBOL_MAX_LENGTH = 12;
const RULE_SET_KEYS = Object.freeze(['semanticsId', 'setupVersion', 'thresholdsHash']);
const SEPARATOR = '__';

const refuse = (what, value) => new TypeError(`setupEvidence key: malformed ${what}: ${JSON.stringify(value) ?? String(value)}`);

function assertSession(session) {
  const real = typeof session === 'string' && SESSION_RE.test(session)
    && !Number.isNaN(Date.parse(`${session}T12:00:00Z`)) && new Date(`${session}T12:00:00Z`).toISOString().slice(0, 10) === session;
  if (!real) throw refuse('session', session);
}

function assertSymbol(symbol) {
  if (typeof symbol !== 'string' || !SYMBOL_RE.test(symbol) || symbol.length > SYMBOL_MAX_LENGTH) throw refuse('symbol', symbol);
}

function assertRuleSet(ruleSet) {
  if (ruleSet === null || typeof ruleSet !== 'object' || Array.isArray(ruleSet)) throw refuse('rule set', ruleSet);
  if (Object.keys(ruleSet).sort().join() !== RULE_SET_KEYS.join()) throw refuse('rule set', ruleSet);
  const { setupVersion, thresholdsHash, semanticsId } = ruleSet;
  if (typeof setupVersion !== 'string' || !SETUP_VERSION_RE.test(setupVersion)) throw refuse('setupVersion', setupVersion);
  if (typeof thresholdsHash !== 'string' || !THRESHOLDS_HASH_RE.test(thresholdsHash)) throw refuse('thresholdsHash', thresholdsHash);
  if (typeof semanticsId !== 'string' || !SEMANTICS_ID_RE.test(semanticsId)) throw refuse('semanticsId', semanticsId);
}

/** The rule set as a document-id segment. Throws on a malformed triple. */
export function ruleKeyOf(ruleSet) {
  assertRuleSet(ruleSet);
  return `${ruleSet.setupVersion}.${ruleSet.thresholdsHash}.${ruleSet.semanticsId.replace('/', '~')}`;
}

/** The document id of (session, symbol, rule set). Throws on any malformed member. */
export function snapshotIdOf({ session, symbol, ruleSet } = {}) {
  assertSession(session);
  assertSymbol(symbol);
  return `${session}${SEPARATOR}${symbol}${SEPARATOR}${ruleKeyOf(ruleSet)}`;
}

/** The exact { session, symbol, ruleSet } of a document id. Throws on anything snapshotIdOf would not have produced. */
export function parseSnapshotId(id) {
  if (typeof id !== 'string') throw refuse('snapshot id', id);
  const parts = id.split(SEPARATOR);
  if (parts.length !== 3) throw refuse('snapshot id', id);
  const [session, symbol, ruleKey] = parts;
  const members = ruleKey.split('.');
  if (members.length !== 3) throw refuse('snapshot id', id);
  const [setupVersion, thresholdsHash, semantics] = members;
  const parsed = { session, symbol, ruleSet: { setupVersion, thresholdsHash, semanticsId: semantics.replace('~', '/') } };
  if (snapshotIdOf(parsed) !== id) throw refuse('snapshot id', id);
  return parsed;
}
