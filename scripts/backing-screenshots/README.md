# Backing screenshots (Backing Beta PR 4)

The pictures in `docs/design/backing/screenshots/` are rendered from the real
components with `BACKING_BETA_ENABLED` forced on in a test harness. The shipped
flag stays `false`; nothing here changes it.

```sh
SHOTS=/tmp/backing-shots
BACKING_SHOTS_DIR=$SHOTS npx vitest run --config scripts/backing-screenshots/vitest.config.mjs
node scripts/backing-screenshots/shoot.mjs $SHOTS docs/design/backing/screenshots
# (where Playwright has no matching browser of its own, point it at one:
#  BACKING_SHOTS_CHROMIUM=/opt/pw-browsers/chromium node scripts/backing-screenshots/shoot.mjs …)
```

- `harness.render.jsx` — renders the landing strip (through its gated mount,
  `BackingLandingStrip`) in its four states and the team card in its first-week
  and veteran states, over INVENTED inputs shaped like the endpoints' replies
  (no real pod, team or stake is pictured), and writes
  one static page per state. It is not collected by `npm run test:run`.
- `shoot.mjs` — photographs each page with Playwright's Chromium at a 390px
  mobile width, 2× scale. The app's two web fonts are fetched with curl and
  served locally; without them the pages use the system fonts and the script
  says so.

## Desktop (Backing desktop layouts)

The pictures in `docs/design/backing/desktop/screenshots/` come from
`desktop.render.jsx`, the same way: the real desktop surfaces with the flag
forced on in the harness only, over invented inputs, written as `desk-*.html`
pages and photographed at **1440×900, 1×**.

```sh
SHOTS=/tmp/backing-desk-shots
BACKING_SHOTS_DIR=$SHOTS npx vitest run --config scripts/backing-screenshots/vitest.config.mjs scripts/backing-screenshots/desktop.render.jsx
node scripts/backing-screenshots/shoot.mjs $SHOTS docs/design/backing/desktop/screenshots desk-
```

- `desktop.render.jsx` — frames each page the way App lays out a desktop
  width by default: the real `DesktopSidebar` collapsed to its 64px rail (App.jsx starts it collapsed) with the surface beside it.
  It walks the real flow — the lobby's strip → the Backing screen → a seat →
  "Back" — and writes: the landing (not seated / seated × no bracket /
  bracket), each strip state, the Backing screen during the window (no card
  yet, first-week card, veteran card, stake control, top-up, the one-time
  confirmation), Your Backing, the results, and the private record and the
  trainer stats in their desktop home (the Command surface's left column,
  beside the pitch — its other two columns are not rendered).
- `shoot.mjs` photographs `desk-*` pages at 1440×900 and, on the pages that
  show the stake control, MEASURES the desktop brief's rule — the three
  disclosure lines and Confirm on screen without scrolling — and fails if
  either is off-screen. The third argument limits the run to pages with that
  name prefix.
