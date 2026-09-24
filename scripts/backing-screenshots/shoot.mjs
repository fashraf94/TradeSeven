// scripts/backing-screenshots/shoot.mjs
//
// Backing Beta PR 4 — photographs the pages harness.render.jsx wrote.
//
//   node scripts/backing-screenshots/shoot.mjs <pages dir> <png dir> [page prefix]
//
// Desktop pages (`desk-*.html`, written by desktop.render.jsx) are photographed
// in a 1440×900 viewport at 1×; the mobile pages keep the 390px column at 2×.
// On a desktop page that shows the stake control in the Backing screen's
// right column, the script also MEASURES the rule the desktop brief sets —
// the three disclosure lines and Confirm visible without scrolling at
// 1440×900 — and prints each measurement (and fails if one is off-screen).
// The optional third argument photographs only the pages whose names start
// with it (e.g. `desk-`).
//
// Fonts: the app's two web fonts (index.html) are fetched once with curl —
// which honours the environment's proxy and CA bundle — and served to the
// browser as local files, so the page never needs the network. When the
// fetch fails the pages fall back to the system fonts and this script says so.
//
// The browser is Playwright's Chromium; set BACKING_SHOTS_CHROMIUM to an
// executable to override the one Playwright resolves.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [pagesDir, pngDir] = process.argv.slice(2, 4).map((p) => path.resolve(p));
const prefix = process.argv[4] ?? '';
if (!pagesDir || !pngDir) {
  console.error('usage: node scripts/backing-screenshots/shoot.mjs <pages dir> <png dir>');
  process.exit(2);
}
mkdirSync(pngDir, { recursive: true });

const FONT_CSS = [
  'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,700;0,6..72,800;1,6..72,400&display=swap',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function curl(url, outFile) {
  const args = ['-sS', '--fail', '--max-time', '30', '-A', UA, url];
  if (outFile) args.push('-o', outFile);
  return execFileSync('curl', args, { encoding: outFile ? undefined : 'utf8' });
}

function localFonts() {
  const fontsDir = path.join(pagesDir, 'fonts');
  mkdirSync(fontsDir, { recursive: true });
  let css = '';
  try {
    for (const url of FONT_CSS) {
      let sheet = curl(url);
      sheet = sheet.replace(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, (_, fontUrl) => {
        const file = path.join(fontsDir, path.basename(new URL(fontUrl).pathname));
        if (!existsSync(file)) curl(fontUrl, file);
        return `url(file://${file})`;
      });
      css += `${sheet}\n`;
    }
    console.log(`fonts: ${readdirSync(fontsDir).length} files served locally`);
  } catch (error) {
    console.warn(`fonts: unavailable (${error.message.split('\n')[0]}); pages use the system fonts`);
    css = '';
  }
  writeFileSync(path.join(pagesDir, 'fonts.css'), css);
}

localFonts();

const browser = await chromium.launch({
  executablePath: process.env.BACKING_SHOTS_CHROMIUM || undefined,
  args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
});
const failures = [];
try {
  const mobile = await (await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' })).newPage();
  const desktop = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' })).newPage();
  const pages = readdirSync(pagesDir).filter((f) => f.endsWith('.html') && f.startsWith(prefix)).sort();
  for (const file of pages) {
    const page = file.startsWith('desk-') ? desktop : mobile;
    await page.goto(`file://${path.join(pagesDir, file)}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const shot = await page.$('#shot');
    const out = path.join(pngDir, file.replace(/\.html$/, '.png'));
    await shot.screenshot({ path: out });
    console.log(`wrote ${path.relative(process.cwd(), out)}`);
    // The desktop brief's rule: the three lines above Confirm, visible without scrolling at 1440×900.
    const measured = await page.evaluate(() => {
      const col = document.querySelector('[data-desk-col="right"]');
      const lines = col?.querySelector('[data-backing="disclosures"]');
      const confirm = col?.querySelector('[data-backing="confirm"]');
      if (!col || !lines || !confirm || !col.querySelector('[data-backing="stake-control"]')) return null;
      const rect = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; };
      return { viewport: window.innerHeight, scrollTop: col.scrollTop, disclosures: rect(lines), confirm: rect(confirm), confirmBelowLines: rect(confirm).top >= rect(lines).bottom };
    });
    if (measured) {
      const ok = measured.scrollTop === 0 && measured.disclosures.bottom <= measured.viewport && measured.confirm.bottom <= measured.viewport && measured.confirmBelowLines;
      console.log(`  ${ok ? 'OK ' : 'OFF'} ${file}: the three lines ${measured.disclosures.top}–${measured.disclosures.bottom}px, Confirm ${measured.confirm.top}–${measured.confirm.bottom}px, viewport ${measured.viewport}px, column scrolled ${measured.scrollTop}px`);
      if (!ok) failures.push(file);
    }
  }
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`the three disclosure lines or Confirm are off-screen at 1440×900 on: ${failures.join(', ')}`);
  process.exit(1);
}
