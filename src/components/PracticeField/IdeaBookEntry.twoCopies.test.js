// src/components/PracticeField/IdeaBookEntry.twoCopies.test.js
//
// The portfolio hub's slice 1 (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md §3) — THE CARD'S TWO
// COPIES STAY ONE CARD. IdeaBookEntry.jsx keeps today's default export byte for byte (so the hub builds as before while the
// portfolio switch is off) and adds IdeaBookEntryView, the same body with the read handed in as props. This pins, from the
// parsed source, that the drawing part's body IS the default's body after its one read line: a fix made to one copy and not
// the other fails here. The behaviour of both is the card suite's (IdeaBookEntry.jsdom.test.jsx runs its switch-on rows
// against each). When the flip collapses the two copies, this file goes with the default's body.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'acorn';
import acornJsx from 'acorn-jsx';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'IdeaBookEntry.jsx'), 'utf8').replace(/\r\n/g, '\n');
const parse = (code) => Parser.extend(acornJsx()).parse(code, { ecmaVersion: 'latest', sourceType: 'module' });

/** The function a top-level export declares: the default (`name` null) or a named one. */
function exported(code, name) {
  for (const node of parse(code).body) {
    if (name === null && node.type === 'ExportDefaultDeclaration' && node.declaration.type === 'FunctionDeclaration') return node.declaration;
    if (name !== null && node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'FunctionDeclaration' && node.declaration.id.name === name) return node.declaration;
  }
  return null;
}

/** The copies, as source text: the default's first statement, the rest of its body, and the drawing part's body and params. */
function copiesOf(code) {
  const def = exported(code, null);
  const view = exported(code, 'IdeaBookEntryView');
  const [first, second] = def.body.body;
  const closing = (fn) => fn.body.end - 1;
  return {
    defaultParams: def.params.length,
    readLine: code.slice(first.start, first.end),
    defaultRest: code.slice(second.start, closing(def)),
    viewParams: code.slice(view.params[0].start, view.params[view.params.length - 1].end),
    viewBody: code.slice(view.body.body[0].start, closing(view)),
  };
}

describe('the entry card\'s two copies (the portfolio hub\'s slice 1)', () => {
  it('the default export reads the book itself, in its first line, and takes no props (today\'s, unchanged)', () => {
    const c = copiesOf(SRC);
    expect(c.defaultParams).toBe(0);
    expect(c.readLine).toBe('const { read, refresh } = useIdeaBook({ enabled: PRACTICE_FIELD_SCREEN_ENABLED });');
  });

  it('the drawing part takes exactly that read as props, and its body is the default\'s after the read, character for character', () => {
    const c = copiesOf(SRC);
    expect(c.viewParams).toBe('{ read, refresh }');
    expect(c.viewBody).toBe(c.defaultRest);
    expect(c.viewBody.length).toBeGreaterThan(1000);
  });

  it('bites: a change to either copy alone is seen', () => {
    const marker = 'const onClose = useCallback(() => { setOpen(false); }, []);';
    const first = SRC.indexOf(marker);
    const second = SRC.indexOf(marker, first + 1);
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    const changed = (at) => `${SRC.slice(0, at)}const onClose = useCallback(() => { setOpen(false); setOpen(false); }, []);${SRC.slice(at + marker.length)}`;
    for (const at of [first, second]) {
      const c = copiesOf(changed(at));
      expect(c.viewBody).not.toBe(c.defaultRest);
    }
  });
});
