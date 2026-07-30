/**
 * JS bridge to the `--ft-*` color token substrate declared in ./tokens.css.
 *
 * Delight Layer arc, Task 1 (Phase 1). Spec V2 §4, ruling R-S2.
 * Basis: docs/audits/20260729_DELIGHT_THEMING_FOUNDATION_PHASE0_DISCOVERY.md
 *
 * This is a NEW SIBLING module. It is deliberately NOT ./tokens.js — that path
 * holds DARK_TOKENS / LIGHT_TOKENS, which feed src/contexts/ThemeContext.jsx:2
 * out to 64 files via useTheme(). ./tokens.js is untouched by this arc (R-S2).
 *
 * ---------------------------------------------------------------------------
 * CONTRACT
 * ---------------------------------------------------------------------------
 * All three functions take the BARE token name — the part after `--ft-`.
 *
 *     cssVar('accent')      -> 'var(--ft-accent)'   (for inline styles)
 *     readToken('accent')   -> '#00d9ff'            (for canvas / WebGL / motion)
 *     readTokenRgb('cyan')  -> '0, 217, 255'        (reads --ft-cyan-rgb)
 *
 * Pass 'accent', never '--ft-accent' and never '--accent'.
 *
 * ---------------------------------------------------------------------------
 * WHY readToken RESOLVES var() ITSELF
 * ---------------------------------------------------------------------------
 * The semantic tier is authored as var() aliases (`--ft-accent: var(--ft-cyan)`)
 * per ruling R-S3. Real browsers substitute those before returning a computed
 * custom property, but jsdom does not — it hands back the literal string
 * 'var(--ft-cyan)'. So this module walks the chain manually (depth cap 4). The
 * same code path therefore returns a final literal in both environments, which
 * is what makes acceptance rows A1/A2/A2b assertable at all.
 *
 * ---------------------------------------------------------------------------
 * REBIND MECHANISM (decision D4 — defined now, no UI ships in this task)
 * ---------------------------------------------------------------------------
 * Accent customization works by rebinding ONE variable at runtime:
 *
 *     document.documentElement.style.setProperty('--ft-accent', '#ff00aa');
 *     readToken('accent');   // -> '#ff00aa'
 *     document.documentElement.style.removeProperty('--ft-accent');  // revert
 *
 * Unlockable themes are the same mechanism applied to the BASE tier, or a
 * `:root[data-theme="..."]` override block. Both re-resolve live.
 *
 * Because of this, values are read LAZILY on every call and are never cached at
 * module scope. Caching would silently freeze the palette at import time and
 * break every future rebind. Acceptance row A3 exists to catch exactly that
 * regression — do not add memoization here without changing A3.
 *
 * ---------------------------------------------------------------------------
 * ⚠ FOUR STANDING HAZARDS
 * ---------------------------------------------------------------------------
 * 1. FRAMER MOTION (hazard H2). Motion interpolates color channels numerically
 *    and CANNOT parse a var() string. Any color that flows into `animate`,
 *    `initial`, `whileHover`, `variants` or a transition MUST use a computed
 *    hex from readToken() — NEVER cssVar(). Two live instances of this pattern
 *    were found in the Dashboard tree at discovery time
 *    (DashboardDesktop.jsx:459, DashboardBattleCard.jsx:381); the second sets a
 *    real base shadow, so a var() target there would visibly destroy it rather
 *    than no-op.
 *
 * 2. rgba HELPERS (ruling R-S9, defect D-6, hazard H1). The repo has 31
 *    alpha() / hexToRgba() implementations with seven different failure modes.
 *    They take a HEX STRING; a var() reference fails SILENTLY — e.g.
 *    src/components/shared/HoloCard.jsx:54 returns grey rgba(128,128,128,a)
 *    with no throw, no warning and no test failure. Helper consolidation is its
 *    own follow-on task and MUST land BEFORE any hex -> var() change inside the
 *    values of holoTheme.js or theme/tokens.js. Until then: pass those helpers
 *    a hex (readToken output is safe), or use the --ft-*-rgb triplets at
 *    literal CSS sites via readTokenRgb().
 *
 * 3. PREFIX NEAR-MISS (ruling R-S8). Our prefix is `--ft-`. The repo already
 *    has `--fw-` (44 occurrences, src/components/Forge/workshop/ForgeWorkshop.jsx:182).
 *    One letter apart. Read carefully when debugging a var that will not resolve.
 *
 * 4. TRIPLET WHITESPACE — ALWAYS GO THROUGH THE BRIDGE (ruling R-A2w). A raw
 *    getComputedStyle read of an RGB triplet token is NOT whitespace-stable
 *    across environments: jsdom collapses the space after each comma
 *    ('0,217,255') while real browsers preserve the authored spacing
 *    ('0, 217, 255'). Both are valid CSS and render identically, so the
 *    difference is invisible until something does string equality on it — a
 *    snapshot, a cache key, a test assertion — and then it fails on one engine
 *    only. readTokenRgb() canonicalizes to the no-space form everywhere, so
 *    consumers MUST use it rather than reading the property directly. The same
 *    ruling makes the A2 acceptance comparator whitespace-insensitive for the 8
 *    triplet rows only; hex and var()-alias rows stay strict equality.
 */

const PREFIX = '--ft-';

/**
 * Depth cap for var() chain resolution (ruling R-S3). The deepest chain the
 * locked token list defines is 2 (--ft-warp-tint -> --ft-accent -> --ft-cyan);
 * 4 leaves headroom for future themes while bounding a malformed cycle.
 */
const MAX_VAR_DEPTH = 4;

/**
 * Matches `var(--name)` and `var(--name, fallback)`. Constructed per call so a
 * global regex's lastIndex can never leak between invocations.
 */
function varPattern() {
  return /var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/g;
}

/**
 * Canonicalize an RGB triplet to the no-space form, e.g. '0, 217, 255' ->
 * '0,217,255' (ruling R-A2w).
 *
 * Necessary because the two environments disagree: jsdom collapses the space
 * after a comma inside a custom property value, real browsers preserve the
 * authored spacing. Canonicalizing here means readTokenRgb() returns one stable
 * string everywhere, so consumers never have to care which engine they are on.
 */
function canonicalizeTriplet(value) {
  return value.replace(/\s*,\s*/g, ',').trim();
}

/**
 * Computed style of the document root, or null when there is no DOM (the repo's
 * vitest default environment is 'node'). Callers degrade to '' rather than throw.
 */
function rootStyles() {
  if (typeof document === 'undefined' || !document.documentElement) return null;
  return getComputedStyle(document.documentElement);
}

/**
 * Substitute var() references until the value is literal or the cap is reached.
 * Unresolvable references are left verbatim so a missing token is visible in the
 * output rather than silently becoming ''.
 */
function resolveVarChain(styles, value) {
  let current = String(value).trim();

  for (let depth = 0; depth < MAX_VAR_DEPTH && current.includes('var('); depth += 1) {
    let substituted = false;

    current = current.replace(varPattern(), (whole, refName, fallback) => {
      const looked = styles.getPropertyValue(refName).trim();
      if (looked) {
        substituted = true;
        return looked;
      }
      if (fallback !== undefined) {
        substituted = true;
        return fallback.trim();
      }
      return whole;
    });

    if (!substituted) break;
  }

  return current.trim();
}

/**
 * A `var()` reference to a token, for inline styles and CSS strings.
 *
 *     style={{ color: cssVar('accent') }}   // -> 'var(--ft-accent)'
 *
 * Prefer this wherever the browser resolves the value. Use readToken() instead
 * for canvas, WebGL and Framer Motion, which cannot parse var() (hazard H2).
 *
 * @param {string} name Bare token name, e.g. 'accent'.
 * @returns {string} e.g. 'var(--ft-accent)'.
 */
export function cssVar(name) {
  return `var(${PREFIX}${name})`;
}

/**
 * The computed literal value of a token, resolving var() aliases.
 *
 * Read lazily on every call so runtime rebinds (decision D4) are picked up.
 * Use for canvas / WebGL / Framer Motion consumers — anything that needs a real
 * color rather than a CSS reference. Task 2's starfield reads its tint with
 * readToken('warp-tint').
 *
 * @param {string} name Bare token name, e.g. 'accent'.
 * @returns {string} e.g. '#00d9ff'. Empty string if undeclared or no DOM.
 */
export function readToken(name) {
  const styles = rootStyles();
  if (!styles) return '';

  const raw = styles.getPropertyValue(`${PREFIX}${name}`).trim();
  if (!raw) return '';

  return resolveVarChain(styles, raw);
}

/**
 * The companion RGB triplet for a token, for rgba() composition at literal sites:
 *
 *     background: `rgba(${readTokenRgb('cyan')}, 0.1)`   // 'rgba(0,217,255, 0.1)'
 *
 * Reads `--ft-<name>-rgb`. Only the colors the census showed are used
 * translucently have triplets (ruling R-S9) — see ./tokens.css.
 *
 * The return value is canonicalized to the no-space form in every environment
 * (ruling R-A2w), so it is stable across browser and jsdom. See hazard 4 in the
 * module header for why that matters and why a raw getComputedStyle read is not
 * a substitute for this function.
 *
 * ⚠ Do NOT feed this to the existing alpha() / hexToRgba() helpers; they parse
 * hex, not triplets. See hazard 2 in the module header.
 *
 * @param {string} name Bare token name, e.g. 'cyan'.
 * @returns {string} e.g. '0,217,255'. Empty string if undeclared or no DOM.
 */
export function readTokenRgb(name) {
  const styles = rootStyles();
  if (!styles) return '';

  const raw = styles.getPropertyValue(`${PREFIX}${name}-rgb`).trim();
  if (!raw) return '';

  return canonicalizeTriplet(resolveVarChain(styles, raw));
}
