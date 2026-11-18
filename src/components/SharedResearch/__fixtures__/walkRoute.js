// src/components/SharedResearch/__fixtures__/walkRoute.js — fixture support (the phone round, P-8).
//
// The walk's route over its tree (thesisWalk.json, composed by thesisAnswers.test.js with the server's own
// functions): one point at a time; a request that matches one of the point's taps moves on and gets that tap's answer;
// any other request gets a plain line naming the taps this point answers. Used by the smoke page's ?srFixture=walk and
// by the rows that check it. Nothing here composes an answer: every answer is the tree's, as received.

/** "Not in this walk", naming the taps this point does answer, in plain words. */
export function notInWalk(says) {
  const list = says.length <= 1 ? (says[0] ?? 'nothing more — the walk ends here') : `${says.slice(0, -1).join('; ')}; or ${says.at(-1)}`;
  return { status: 400, body: { error: 'smoke_not_in_walk', message: `SMOKE ONLY — that tap is not in this walk. Here it answers: ${list}.` } };
}

const norm = (x) => String(x).trim().replace(/\s+/g, ' ').toLowerCase();

/** Does a request body hold what a walk tap expects? Every expected key must match; `{ $text }` compares words loosely. */
export function matches(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected) && Object.hasOwn(expected, '$text')) return typeof actual === 'string' && norm(actual) === norm(expected.$text);
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((e, i) => matches(actual[i], e));
  if (expected && typeof expected === 'object') return Boolean(actual) && typeof actual === 'object' && Object.keys(expected).every((k) => matches(actual[k], expected[k]));
  return actual === expected;
}

/** The route: `({ key, body }) => answer`, where `key` is the request's action ('open', 'step', 'card', 'adopt') or 'get'. */
export function walkRouteOf(tree) {
  let at = tree.start;
  return ({ key, body }) => {
    const point = tree.nodes[at];
    const says = point.accepts.map((a) => a.say);
    if (key === 'get') return point.get ?? notInWalk(says);
    const hit = point.accepts.find((a) => matches(body, a.match));
    if (!hit) return notInWalk(says);
    at = hit.next;
    return hit.answer;
  };
}
