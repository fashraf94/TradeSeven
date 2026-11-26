// api/_utils/explore/__fixtures__/docs/makeDocs.mjs
//
// Writes the small documents the publish step's tests fetch through an injected fetcher (build prompt K-13). Run it
// once by hand (`node api/_utils/explore/__fixtures__/docs/makeDocs.mjs`) and commit what it writes; the tests read
// the committed files and never run this. The two PDFs are built here byte by byte: one page each, Helvetica, a
// creation date in the document's own information dictionary.
//
//   release.html      a company release: a sentence with curly quotes, an en dash and a non-breaking space; a sentence
//                     broken over two lines; a results table whose row cells are separate elements; a published-time tag
//   script-only.html  a page whose text sits only inside a script (a data blob), with a published-time tag
//   text.pdf          a text PDF: one sentence over two lines, created 2026-09-29 08:30:12 -04:00
//   table.pdf         a PDF whose one table row is five separately placed pieces of text

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const RELEASE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Example Corp reports results</title>
<meta property="article:published_time" content="2026-10-29T20:05:00Z">
<style>p { margin: 0 }</style>
<script>window.reportText = "Cloud revenue grew 77% in the quarter";</script>
</head>
<body>
<h1>Example Corp reports third quarter results</h1>
<p>Cloud revenue increased 48% &ndash; driven by “data center” demand, to $46.0&nbsp;billion.</p>
<p>Capital expenditures, which primarily reflected investments in technical
infrastructure, were $51.4 billion for the three months.</p>
<p hidden>Hidden revenue figure of 99%.</p>
<table>
<tr><th>(in millions)</th><th>Q3 2026</th><th></th><th>Q3 2025</th></tr>
<tr><td>Revenue</td><td>$</td><td>3,661</td><td>$</td><td>1,365</td></tr>
</table>
</body>
</html>
`;

const SCRIPT_ONLY = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="date" content="2026-11-04">
<title>Results</title>
</head>
<body>
<div id="root"></div>
<script type="application/json" id="data">{"headline":"Data Center revenue of $107.6 billion, up 110% from a year ago"}</script>
</body>
</html>
`;

/** A one-page PDF of the given content stream, with a creation date in its information dictionary. */
function pdfOf(stream, creationDate) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Title (Fixture) /CreationDate (${creationDate}) >>`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const TEXT_STREAM = [
  'BT /F1 12 Tf 72 720 Td (Data center billing peak load as of August 2026) Tj ET',
  'BT /F1 12 Tf 72 704 Td (is 4.8 GW, against 54 GW under contract.) Tj ET',
].join('\n');

// One table row: each piece placed on its own, as a statement table is typeset.
const TABLE_STREAM = [
  'BT /F1 10 Tf 72 700 Td (Revenue) Tj ET',
  'BT /F1 10 Tf 300 700 Td ($) Tj ET',
  'BT /F1 10 Tf 330 700 Td (3,661) Tj ET',
  'BT /F1 10 Tf 420 700 Td ($) Tj ET',
  'BT /F1 10 Tf 450 700 Td (1,365) Tj ET',
  'BT /F1 10 Tf 72 680 Td (Net loss) Tj ET',
  'BT /F1 10 Tf 330 680 Td (\\(110\\)) Tj ET',
].join('\n');

writeFileSync(path.join(HERE, 'release.html'), RELEASE, 'utf8');
writeFileSync(path.join(HERE, 'script-only.html'), SCRIPT_ONLY, 'utf8');
writeFileSync(path.join(HERE, 'text.pdf'), pdfOf(TEXT_STREAM, "D:20260929083012-04'00'"));
writeFileSync(path.join(HERE, 'table.pdf'), pdfOf(TABLE_STREAM, 'D:20261106120000Z'));
console.log('wrote release.html, script-only.html, text.pdf, table.pdf');
