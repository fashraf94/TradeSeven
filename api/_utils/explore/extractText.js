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
//                 is still read (no style sheet is applied). The walk follows sibling links without recursion, so its
//                 cost grows with the page and a deep page cannot overflow the stack (review S3); a page of more than
//                 HTML_LIMITS.ELEMENTS_MAX elements is refused, never read on.
//   PDFs          pdfText.js: read in a worker thread under a heap limit and a time limit (review S3).
//   documentDate  documentDate.js: a page's published-time tag (META_DATE_KEYS), a PDF's creation date; never the
//                 author's `dated`, never this machine's time zone.
//
// The text returned is raw: matchStory.js puts it under the word-for-word rule (matchRule.js).

import { JSDOM, VirtualConsole } from 'jsdom';
import { documentDateOf } from './documentDate.js';
import { pdfTextInWorker } from './pdfText.js';

export { documentDateOf, pdfDateOf } from './documentDate.js';

export const TYPES = Object.freeze({ HTML: 'html', PDF: 'pdf', OTHER: 'other' });
const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml']);
/** The limit on reading one page (named, as the fetcher's are). */
export const HTML_LIMITS = Object.freeze({ ELEMENTS_MAX: 1_000_000 });

/** The document's type, from its bytes first (a PDF is a PDF whatever the server calls it), then its content type. */
export function typeOf(contentType, bytes) {
  if (bytes && bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString('latin1') === '%PDF-') return TYPES.PDF;
  const ct = String(contentType ?? '').split(';')[0].trim().toLowerCase();
  return HTML_TYPES.has(ct) ? TYPES.HTML : TYPES.OTHER;
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

const tooManyElements = (max) => Object.assign(new Error(`the page has more than ${max} elements`), { code: 'EXPLORE_HTML_LIMIT' });

/** The visible text of an element tree (see the header): an explicit stack, sibling links, no recursion. */
function visibleTextOf(root, maxElements) {
  const parts = [];
  let elements = 0;
  const CLOSE = Symbol('close');
  const stack = root ? [root] : [];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === CLOSE) { parts.push(' '); continue; }
    if (node.nodeType === 3) { parts.push(node.data); continue; }
    if (node.nodeType !== 1) continue;
    elements += 1;
    if (elements > maxElements) throw tooManyElements(maxElements);
    const name = node.localName;
    if (NOT_VISIBLE.has(name) || node.hasAttribute('hidden')) continue;
    if (HIDING_STYLE.test(node.getAttribute('style') ?? '')) continue;
    const breaks = BREAKS.has(name);
    if (breaks) { parts.push(' '); stack.push(CLOSE); }
    // Children pushed last-first, so they come off the stack in document order.
    let child = node.lastChild;
    while (child) { stack.push(child); child = child.previousSibling; }
  }
  return parts.join('');
}

/** A page's own published date (META_DATE_KEYS, then a `<time itemprop="datePublished">`), or null. */
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
export function htmlTextOf(bytes, contentType = 'text/html', { maxElements = HTML_LIMITS.ELEMENTS_MAX } = {}) {
  // A Buffer lets jsdom read the charset as a browser would (BOM, then the server's charset, then a meta tag). Every
  // page is parsed as HTML (an XHTML page too: the forgiving parser, never the strict XML one).
  const charset = String(contentType ?? '').match(/;\s*charset=([^;\s]+)/i)?.[1] ?? null;
  const dom = new JSDOM(Buffer.from(bytes), { contentType: charset ? `text/html; charset=${charset}` : 'text/html', virtualConsole: new VirtualConsole() });
  try {
    const { document } = dom.window;
    return { text: visibleTextOf(document.body, maxElements), documentDate: htmlDateOf(document) };
  } finally {
    // jsdom's close recurses over the tree and overflows the stack on a very deep page, after the text is read. No
    // script ran and no timer was set in this window, so a close that fails leaves nothing open.
    try { dom.window.close(); } catch { /* see above */ }
  }
}

/**
 * A fetched document's text: `{ type, text, documentDate, reason }`. `text` is null for any other type, and when
 * extraction fails or meets a limit (with the reason); an empty text is reported as no text. `pdf` reads a PDF (the
 * worker, pdfText.js); `html` takes the page's own options (its element limit).
 */
export async function extractText({ bytes, contentType }, { pdf = pdfTextInWorker, html = {} } = {}) {
  const type = typeOf(contentType, bytes);
  if (type === TYPES.OTHER) return { type, text: null, documentDate: null, reason: `the document is of a type with no text here (${String(contentType ?? 'none').split(';')[0] || 'none'})` };
  try {
    const out = type === TYPES.PDF ? await pdf(bytes) : htmlTextOf(bytes, contentType, html);
    if (!out.text || !out.text.trim()) return { type, text: null, documentDate: out.documentDate ?? null, reason: `no text could be read from the ${type === TYPES.PDF ? 'PDF (it may be scanned images)' : 'page'}` };
    return { type, text: out.text, documentDate: out.documentDate ?? null, reason: null };
  } catch (err) {
    return { type, text: null, documentDate: null, reason: `the ${type === TYPES.PDF ? 'PDF' : 'page'} could not be read (${err?.message ?? String(err)})` };
  }
}
