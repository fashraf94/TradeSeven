// api/_utils/explore/extractText.js
//
// Explore publish step — A FETCHED DOCUMENT'S TEXT (build prompt K-6). Server code, run only by the founder's
// command (scripts/explore-publish.mjs); no route imports it.
//
//   typeOf        'pdf' when the bytes begin with the PDF signature; 'html' when the server names text/html or
//                 application/xhtml+xml; otherwise 'other'. Any other type has no text.
//   htmlTextOf    the page's VISIBLE text: parsed by jsdom with scripting off and no resource loading (no JavaScript is
//                 run, nothing more is fetched); scripts, styles, templates, noscript blocks, frames and embedded
//                 objects removed, and so is any element the page hides itself (the `hidden` attribute, or an inline
//                 style of display none or visibility hidden); entities decoded by the parser; a space put at the
//                 edges of every block, of every cell of a table and of every superscript and subscript, so the cells
//                 of one table row read as one line and a footnote mark never joins the figure before it. Text that
//                 sits only inside a script is not visible text. A LIMIT, stated: text a style sheet hides by a class
//                 is still read (no style sheet is applied).
//   pdfTextOf     the PDF's text, by unpdf (pdf.js 5.6, run in-process with eval off and no font face, no network):
//                 each page's text items in order, a line break where pdf.js marks one.
//   documentDate  a date the machine found in the document's own metadata, or null: a page's published-time tag
//                 (META_DATE_KEYS), a PDF's creation date. Never the author's `dated`, and never this machine's time
//                 zone (review H9): a date and time that names its zone is recorded as an ISO instant; a date, or a
//                 date and time with no zone, as its calendar date (YYYY-MM-DD); anything else as null.
//
// The text returned is raw: matchStory.js puts it under the word-for-word rule (matchRule.js).

import { JSDOM, VirtualConsole } from 'jsdom';

export const TYPES = Object.freeze({ HTML: 'html', PDF: 'pdf', OTHER: 'other' });
const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml']);

/** The document's type, from its bytes first (a PDF is a PDF whatever the server calls it), then its content type. */
export function typeOf(contentType, bytes) {
  if (bytes && bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString('latin1') === '%PDF-') return TYPES.PDF;
  const ct = String(contentType ?? '').split(';')[0].trim().toLowerCase();
  return HTML_TYPES.has(ct) ? TYPES.HTML : TYPES.OTHER;
}

/** A real calendar date "YYYY-MM-DD", or null. */
function calendarDateOf(y, m, d) {
  const iso = `${y}-${m}-${d}`;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * A document's own date as recorded (see the header): an ISO 8601 date and time WITH a zone → the ISO instant; a date,
 * or a date and time without a zone → "YYYY-MM-DD"; anything else → null. Never read in this machine's zone.
 */
export function documentDateOf(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i);
  if (!m) return null;
  const date = calendarDateOf(m[1], m[2], m[3]);
  if (!date) return null;
  if (m[4] === undefined || m[7] === undefined) return date;
  const zone = /^z$/i.test(m[7]) ? 'Z' : m[7].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
  const t = Date.parse(`${date}T${m[4]}:${m[5]}:${m[6] ?? '00'}${zone}`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

// ── HTML ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Elements whose content is never visible text. */
const NOT_VISIBLE = new Set(['script', 'style', 'noscript', 'template', 'head', 'title', 'iframe', 'object', 'embed']);
/** Elements that begin and end a line, or a cell of a table row: a space is put at their edges. */
const BREAKS = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'caption', 'dd', 'details', 'dialog', 'div', 'dl', 'dt', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'li', 'main',
  'nav', 'ol', 'p', 'pre', 'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul', 'option',
  'sup', 'sub',
]);
/** An inline style that hides its element. */
const HIDING_STYLE = /display\s*:\s*none|visibility\s*:\s*hidden/i;
/** The published-time tags read for a page's own date, in this order (meta property, name or itemprop). */
export const META_DATE_KEYS = Object.freeze([
  'article:published_time', 'og:published_time', 'datepublished', 'citation_publication_date', 'dc.date.issued',
  'dcterms.issued', 'dc.date', 'dcterms.date', 'dcterms.created', 'date', 'publish-date', 'publish_date', 'pubdate',
]);

/** The visible text of an element tree (see the header). */
function visibleTextOf(root) {
  const parts = [];
  const walk = (node) => {
    if (node.nodeType === 3) { parts.push(node.data); return; }
    if (node.nodeType !== 1) return;
    const name = node.localName;
    if (NOT_VISIBLE.has(name) || node.hasAttribute('hidden')) return;
    if (HIDING_STYLE.test(node.getAttribute('style') ?? '')) return;
    const breaks = BREAKS.has(name);
    if (breaks) parts.push(' ');
    for (const child of node.childNodes) walk(child);
    if (breaks) parts.push(' ');
  };
  if (root) walk(root);
  return parts.join('');
}

/** A page's own published date (META_DATE_KEYS, then a `<time itemprop="datePublished">`), as ISO, or null. */
function htmlDateOf(document) {
  const found = new Map();
  for (const meta of document.querySelectorAll('meta[content]')) {
    const key = (meta.getAttribute('property') || meta.getAttribute('name') || meta.getAttribute('itemprop') || '').trim().toLowerCase();
    if (META_DATE_KEYS.includes(key) && !found.has(key)) found.set(key, meta.getAttribute('content'));
  }
  for (const key of META_DATE_KEYS) {
    const date = documentDateOf(found.get(key));
    if (date) return date;
  }
  const time = document.querySelector('time[itemprop="datePublished"][datetime]');
  return time ? documentDateOf(time.getAttribute('datetime')) : null;
}

/** An HTML document's visible text and its own date. Nothing is run and nothing is loaded. */
export function htmlTextOf(bytes, contentType = 'text/html') {
  // A Buffer lets jsdom read the charset as a browser would (BOM, then the server's charset, then a meta tag). Every
  // page is parsed as HTML (an XHTML page too: the forgiving parser, never the strict XML one).
  const charset = String(contentType ?? '').match(/;\s*charset=([^;\s]+)/i)?.[1] ?? null;
  const dom = new JSDOM(Buffer.from(bytes), { contentType: charset ? `text/html; charset=${charset}` : 'text/html', virtualConsole: new VirtualConsole() });
  try {
    const { document } = dom.window;
    return { text: visibleTextOf(document.body), documentDate: htmlDateOf(document) };
  } finally {
    dom.window.close();
  }
}

// ── PDF ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A PDF date ("D:20260929083012-04'00'") as recorded: with its time and zone → the ISO instant; with a day but no
 * zone or no time → "YYYY-MM-DD"; with no day (a year, a month) → null. Nothing is invented.
 */
export function pdfDateOf(raw) {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(?:D:)?(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?)?(?:([Zz])|([+-])(\d{2})'?(\d{2})?'?)?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '00', z, sign, oh, om = '00'] = m;
  if (h === undefined || (!z && !sign)) return calendarDateOf(y, mo, d);
  return documentDateOf(`${y}-${mo}-${d}T${h}:${mi}:${s}${z ? 'Z' : `${sign}${oh}:${om}`}`);
}

/** The options every PDF is opened with: no eval, no font face, warnings off. Nothing is fetched (no URL is given). */
export const PDF_OPTIONS = Object.freeze({ isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 });

/** A PDF's text, page by page, and its own creation date. */
export async function pdfTextOf(bytes) {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(bytes), { ...PDF_OPTIONS });
  try {
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => `${item.str ?? ''}${item.hasEOL ? '\n' : ''}`).join(''));
    }
    let documentDate = null;
    try {
      const meta = await pdf.getMetadata();
      documentDate = pdfDateOf(meta?.info?.CreationDate);
    } catch {
      documentDate = null;
    }
    return { text: pages.join('\n'), documentDate, pages: pdf.numPages };
  } finally {
    await pdf.destroy();
  }
}

/**
 * A fetched document's text: `{ type, text, documentDate, reason }`. `text` is null for any other type, and when
 * extraction fails (with the reason); an empty text is reported as no text.
 */
export async function extractText({ bytes, contentType }) {
  const type = typeOf(contentType, bytes);
  if (type === TYPES.OTHER) return { type, text: null, documentDate: null, reason: `the document is of a type with no text here (${String(contentType ?? 'none').split(';')[0] || 'none'})` };
  try {
    const out = type === TYPES.PDF ? await pdfTextOf(bytes) : htmlTextOf(bytes, contentType);
    if (!out.text || !out.text.trim()) return { type, text: null, documentDate: out.documentDate ?? null, reason: `no text could be read from the ${type === TYPES.PDF ? 'PDF (it may be scanned images)' : 'page'}` };
    return { type, text: out.text, documentDate: out.documentDate ?? null, reason: null };
  } catch (err) {
    return { type, text: null, documentDate: null, reason: `the ${type === TYPES.PDF ? 'PDF' : 'page'} could not be read (${err?.message ?? String(err)})` };
  }
}
