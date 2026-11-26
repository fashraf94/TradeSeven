// api/_utils/explore/fetchSource.test.js
//
// Explore publish step — THE FETCHER (build prompt K-5, SQ-2, SQ-3). No network: the real fetchDocument is handed a
// transport that answers from committed documents and a resolver that answers from a table
// (__fixtures__/fixtureFetch.js). The transport asks the request's own lookup for every host, so the address checks
// run exactly where they run in production: inside the request, redirects included.

import { describe, it, expect } from 'vitest';
import {
  fetchDocument, isPublicAddress, vettedLookup, contactOf, userAgentOf, CONTACT_ENV, MAX_REDIRECTS, FETCH_TIMEOUT_MS, MAX_DOCUMENT_BYTES,
} from './fetchSource.js';
import { fixtureTransport, fixtureResolver, TEST_CONTACT, PUBLIC_ADDRESS } from './__fixtures__/fixtureFetch.js';

const A = 'https://investor.example.com/release';
function run(url, routes, { hosts = {}, ...opts } = {}) {
  const calls = [];
  const asked = [];
  const p = fetchDocument(url, { contact: TEST_CONTACT, transport: fixtureTransport(routes, calls), resolve: fixtureResolver(hosts, asked), timeoutMs: 200, ...opts });
  return p.then((res) => ({ res, calls, asked }));
}

describe('addresses: only public ones are ever fetched', () => {
  it.each([
    ['93.184.216.34', true], ['8.8.8.8', true], ['2606:4700::1111', true], ['::ffff:93.184.216.34', true],
    ['10.0.0.5', false], ['172.16.0.1', false], ['172.31.255.255', false], ['192.168.1.1', false], ['127.0.0.1', false],
    ['169.254.169.254', false], ['100.64.0.1', false], ['0.0.0.0', false], ['224.0.0.1', false], ['255.255.255.255', false],
    ['192.0.2.1', false], ['198.18.0.1', false], ['::1', false], ['::', false], ['fe80::1', false], ['fc00::1', false],
    ['fd12:3456::1', false], ['ff02::1', false], ['::ffff:10.0.0.1', false], ['::ffff:127.0.0.1', false], ['2001:db8::1', false],
    ['2002:a00:1::1', false], ['not-an-address', false], ['', false], [null, false],
  ])('%s → public %s', (ip, expected) => {
    expect(isPublicAddress(ip)).toBe(expected);
  });

  it('a host is refused when ANY address it resolves to is not public', async () => {
    const lookup = vettedLookup(async () => [{ address: PUBLIC_ADDRESS, family: 4 }, { address: '10.0.0.7', family: 4 }]);
    const err = await new Promise((resolve) => lookup('mixed.example.com', { all: true }, (e) => resolve(e)));
    expect(err.code).toBe('EXPLORE_NOT_PUBLIC');
  });

  it('the lookup answers both callback forms with the checked address', async () => {
    const lookup = vettedLookup(async () => [{ address: PUBLIC_ADDRESS, family: 4 }]);
    const one = await new Promise((resolve) => lookup('h', {}, (e, address, family) => resolve([e, address, family])));
    const all = await new Promise((resolve) => lookup('h', { all: true }, (e, list) => resolve([e, list])));
    expect(one).toEqual([null, PUBLIC_ADDRESS, 4]);
    expect(all).toEqual([null, [{ address: PUBLIC_ADDRESS, family: 4 }]]);
  });
});

describe('fetching one document', () => {
  it('a plain page: 200, its bytes, its type, the time it arrived, the user agent naming the app and the contact', async () => {
    const { res, calls } = await run(A, { [A]: { html: '<p>hello</p>' } }, { now: () => new Date('2026-11-25T16:00:00Z') });
    expect(res).toMatchObject({ ok: true, url: A, finalUrl: A, status: 200, contentType: 'text/html; charset=utf-8', fetchedAt: '2026-11-25T16:00:00.000Z', redirects: [] });
    expect(res.bytes.toString()).toBe('<p>hello</p>');
    expect(calls[0].headers['user-agent']).toBe(`FantasyTrades-ExplorePublish/1 (+${TEST_CONTACT})`);
    expect(Object.keys(calls[0].headers).sort()).toEqual(['accept', 'accept-encoding', 'user-agent']); // no cookie, no credential
  });

  it('a redirect is followed, and each hop is checked again', async () => {
    const B = 'https://cdn.example.net/doc.pdf';
    const { res, asked } = await run(A, { [A]: { redirect: '/moved' }, 'https://investor.example.com/moved': { redirect: B, status: 301 }, [B]: { html: 'x' } });
    expect(res).toMatchObject({ ok: true, finalUrl: B, redirects: ['https://investor.example.com/moved', B] });
    expect(asked).toEqual(['investor.example.com', 'investor.example.com', 'cdn.example.net']);
  });

  it(`more than ${MAX_REDIRECTS} redirects are refused`, async () => {
    const routes = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`https://a.example.com/${i}`, { redirect: `https://a.example.com/${i + 1}` }]));
    const { res } = await run('https://a.example.com/0', routes);
    expect(res).toMatchObject({ ok: false, reason: `more than ${MAX_REDIRECTS} redirects` });
    expect(res.redirects).toHaveLength(MAX_REDIRECTS);
  });

  it('a redirect to an http link is refused', async () => {
    const { res, calls } = await run(A, { [A]: { redirect: 'http://investor.example.com/plain' } });
    expect(res).toMatchObject({ ok: false, reason: 'a redirect was refused: the link is not https (http)' });
    expect(calls).toHaveLength(1);
  });

  it('a redirect to a host that resolves to a private address is refused, and that host is never requested', async () => {
    const { res, calls } = await run(A, { [A]: { redirect: 'https://intranet.example.com/x' }, 'https://intranet.example.com/x': { html: 'secret' } }, { hosts: { 'intranet.example.com': '10.1.2.3' } });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/10\.1\.2\.3, which is not a public address/);
    expect(calls.map((c) => c.url)).toEqual([A]);
  });

  it.each([
    ['a host that resolves to a private address', 'https://intranet.example.com/x', { 'intranet.example.com': '192.168.0.10' }, /not a public address/],
    ['a host that resolves to loopback (IPv6)', 'https://local.example.com/x', { 'local.example.com': '::1' }, /not a public address/],
    ['a host written as a link-local address', 'https://169.254.169.254/latest/meta-data', {}, /169\.254\.169\.254 is not a public address/],
    ['a host written as a loopback address', 'https://[::1]/x', {}, /::1 is not a public address/],
    ['an http link', 'http://investor.example.com/release', {}, /not https \(http\)/],
    ['an ftp link', 'ftp://investor.example.com/release', {}, /not https \(ftp\)/],
    ['a link carrying a password', 'https://user:pw@investor.example.com/release', {}, /user name or password/],
    ['no link at all', 'not a link', {}, /not a valid URL/],
  ])('%s is never requested', async (_, url, hosts, reason) => {
    const { res, calls } = await run(url, { [url]: { html: 'x' } }, { hosts });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(reason);
    expect(calls).toEqual([]);
  });

  it('a refusal (403), an error and a missing page are answers, not failures of the run', async () => {
    expect((await run(A, { [A]: { status: 403 } })).res).toMatchObject({ ok: false, status: 403, reason: 'the server answered 403' });
    expect((await run(A, { [A]: { error: 'ECONNRESET' } })).res.reason).toMatch(/the request failed \(ECONNRESET/);
    expect((await run(A, {})).res).toMatchObject({ ok: false, reason: 'the server answered 404' });
  });

  it('a time-out ends the request', async () => {
    const t0 = Date.now();
    const { res } = await run(A, { [A]: { hang: true } }, { timeoutMs: 120 });
    expect(res).toMatchObject({ ok: false, reason: 'no answer within 0.12 seconds' });
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('a document over the size limit is refused', async () => {
    const { res } = await run(A, { [A]: { body: 'x'.repeat(2048), type: 'application/pdf' } }, { maxBytes: 1024 });
    expect(res).toMatchObject({ ok: false, reason: 'the document is larger than the size limit' });
  });

  it('without a contact address nothing is fetched (SQ-2)', async () => {
    const calls = [];
    const res = await fetchDocument(A, { contact: undefined, transport: fixtureTransport({ [A]: { html: 'x' } }, calls), resolve: fixtureResolver() });
    expect(res).toMatchObject({ ok: false, reason: `not fetched: no contact address (${CONTACT_ENV})` });
    expect(calls).toEqual([]);
  });

  it('the limits are named constants', () => {
    expect([FETCH_TIMEOUT_MS, MAX_DOCUMENT_BYTES, MAX_REDIRECTS]).toEqual([20_000, 20 * 1024 * 1024, 5]);
  });
});

describe('the contact address (SQ-2)', () => {
  it.each([
    ['ops@example.com', 'ops@example.com'], ['https://example.com/contact', 'https://example.com/contact'], ['  ops@example.com  ', 'ops@example.com'],
    ['', null], ['http://example.com', null], ['ops@example.com\r\nX-Evil: 1', null], ['two words@example.com', null], [undefined, null],
  ])('%j → %j', (value, expected) => {
    expect(contactOf({ [CONTACT_ENV]: value })).toBe(expected);
  });
  it('the user agent', () => { expect(userAgentOf('a@b.co')).toBe('FantasyTrades-ExplorePublish/1 (+a@b.co)'); });
});
