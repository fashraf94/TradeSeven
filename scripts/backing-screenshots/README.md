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
  and veteran states, over inputs shaped like the endpoints' replies, and writes
  one static page per state. It is not collected by `npm run test:run`.
- `shoot.mjs` — photographs each page with Playwright's Chromium at a 390px
  mobile width, 2× scale. The app's two web fonts are fetched with curl and
  served locally; without them the pages use the system fonts and the script
  says so.
