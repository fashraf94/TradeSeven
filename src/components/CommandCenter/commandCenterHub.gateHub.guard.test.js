// src/components/CommandCenter/commandCenterHub.gateHub.guard.test.js
//
// Command Center hub, slice S3 (ruling R-S3-10; S3 review T5-17) — the gate
// forwards App's `hub` object and reads nothing in it.
//
// commandCenterHub.mount.guard.test.js pins that with one regular expression,
// /\bhub\s*(?:\?\.|\.|\[)/ — a member read written `hub.x`, `hub?.x` or
// `hub[x]`. A destructuring (`const { activePoll } = hub;`) and a spread
// (`{ ...hub }`) read members too and passed it. This guard parses the gate
// (acorn with acorn-jsx, as the other hub guards) and lists EVERY reference to
// `hub` outside the parameter list: the one allowed is the value of the
// `hub={hub}` attribute on <Hub>, handed on as it came.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'acorn';
import acornJsx from 'acorn-jsx';
import { describe, expect, it } from 'vitest';

const JsxParser = Parser.extend(acornJsx());
const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = readFileSync(path.join(HERE, 'CommandCenterHubGate.jsx'), 'utf8').replace(/\r\n/g, '\n');

/** Every reference to the identifier `hub` outside a function's parameter list, as where it stands. */
function hubReferences(code) {
  const ast = JsxParser.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  const found = [];
  const walk = (node, ancestors, inParams) => {
    if (!node || typeof node.type !== 'string') return;
    const parent = ancestors[ancestors.length - 1];
    if (!inParams && node.type === 'Identifier' && node.name === 'hub') {
      const isMemberName = parent?.type === 'MemberExpression' && parent.property === node && !parent.computed;
      if (!isMemberName) {
        const attribute = ancestors[ancestors.length - 2];
        const opening = ancestors[ancestors.length - 3];
        found.push(parent?.type === 'JSXExpressionContainer' && attribute?.type === 'JSXAttribute'
          ? `value of ${opening?.name?.name ?? '?'} ${attribute.name.name}=`
          : `${parent?.type ?? 'root'}`);
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'start' || key === 'end') continue;
      const next = inParams || (key === 'params' && /Function/.test(node.type));
      if (Array.isArray(value)) value.forEach((child) => walk(child, [...ancestors, node], next));
      else if (value && typeof value.type === 'string') walk(value, [...ancestors, node], next);
    }
  };
  walk(ast, [], false);
  return found;
}

/** The attributes of every <Hub> element, in order. */
function hubElementAttributes(code) {
  const ast = JsxParser.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  const elements = [];
  const walk = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'JSXOpeningElement' && node.name.name === 'Hub') {
      elements.push(node.attributes.map((a) => (a.type === 'JSXAttribute' ? a.name.name : a.type)));
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'start' || key === 'end') continue;
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value.type === 'string') walk(value);
    }
  };
  walk(ast);
  return elements;
}

describe('the gate forwards hub and reads nothing in it (R-S3-10; S3 review T5-17)', () => {
  it('its only reference outside the parameter list is the value of <Hub hub={hub} />', () => {
    expect(hubReferences(GATE)).toEqual(['value of Hub hub=']);
  });

  it('...and that element is handed its site and the hub, nothing else', () => {
    expect(hubElementAttributes(GATE)).toEqual([['site', 'hub']]);
  });

  it('the scan bites: a read, a destructure, a spread, an optional chain, a call and a copy are each another reference', () => {
    const wrap = (body, element = '<Hub site={site} hub={hub} />') => `function G({ site, hub }) { ${body} return ${element}; }`;
    const allowed = ['value of Hub hub='];
    expect(hubReferences(wrap(''))).toEqual(allowed);
    for (const body of [
      'const p = hub.activePoll;',
      'const { activePoll } = hub;',
      'const { activePoll: poll, ...rest } = hub;',
      // Read with a default, a member read that never throws for a missing hub — so no gate render would show it.
      'const { activePoll } = hub ?? {};',
      'const copy = { ...(hub ?? {}) };',
      'const copy = { ...hub };',
      "const q = hub['activePoll'];",
      'const r = hub?.activePoll;',
      'const s = Object.keys(hub);',
      'if (hub) { site = 1; }',
    ]) {
      expect(hubReferences(wrap(body)), body).not.toEqual(allowed);
    }
    expect(hubReferences(wrap('', '<Hub site={site} hub={{ ...hub }} />'))).not.toEqual(allowed);
    expect(hubReferences(wrap('', '<Hub site={site} hub={hub.activePoll} />'))).not.toEqual(allowed);
  });

  it('...and the element scan sees an extra, a dropped and a spread attribute', () => {
    expect(hubElementAttributes('const x = <Hub site={site} hub={hub} extra={1} />;')).toEqual([['site', 'hub', 'extra']]);
    expect(hubElementAttributes('const x = <Hub site={site} />;')).toEqual([['site']]);
    expect(hubElementAttributes('const x = <Hub {...props} site={site} hub={hub} />;')).toEqual([['JSXSpreadAttribute', 'site', 'hub']]);
  });
});
