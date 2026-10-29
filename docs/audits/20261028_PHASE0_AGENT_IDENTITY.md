# Phase 0: Agent identity (Shadow + archetype armor). Read-only discovery

**Run date:** October 28, 2026 · **Model:** Opus · **Branch:** `claude/phase0-agent-identity`, cut from `main` @ `be52068c` (pushed from the worktree branch `claude/phase0-agent-identity-10b17e`) · **Design file:** `Agent Identity Boards v2 (standalone).html`, 2,037,153 bytes, SHA-256 `7409b86b…02ec39`.

**Preamble.** `git fetch origin` ran first; `origin/main` = `be52068c` = the branch base. The tree was clean at the start. This run changed no application code. It made the commits listed in §14 and nothing else. Fenced files read: `api/agent/decide.js:942-950` and `api/_utils/agentBattleService.js:188-194`. Fenced functions called: none. Fenced files edited: none.

**Markers.** **V** = I read the line in this session. **V·h** = a read-only helper read it in this session and I did not re-read it. Design-file lines cite the committed copies `docs/design/agent-identity-v2/*.txt`, whose line numbers equal the original payloads.

---

## Executive verdict

| # | Question | Verdict |
|---|---|---|
| 0 | Unpack the design | **Done.** The manifest decodes: 18 entries. The engine and the three board files are committed byte for byte, with a `.txt` suffix because CI's lint gate would otherwise go red (§0). The Three.js inside the file is npm `three@0.184.0`, byte for byte. |
| 1 | Shadow today | A **2D canvas** (`ShadowCanvas.jsx`) with an SVG still. Mounted at two sites: 340 desktop, 260 tablet, 200 phone. **It is already one swappable component.** The seam needs one new prop (the archetype). The fps readout is **not on `main`**; it lives only on the smoke branch. |
| 2 | Visual inventory | 31 places. **Live:** the hub Shadow, the picker's robot faces, three battle-view faces, the Film Room mark, the league heads, the onboarding robot. Cockpit and chat have **no** agent visual today. Side finding: every battle-screen face shows "neutral", whatever the archetype. |
| 3 | Three.js in the bundle | Not a dependency. Behind a dynamic import from the hub chunk: **whole library 733 KB / 189 KB gzip; real engine plus tree-shaken three 574 KB / 150 KB gzip.** The entry chunk and `index.html` are unchanged once chunk hashes are masked. The throwaway branch is deleted. |
| 4 | Engine audit | Portable, but it needs these changes: **seven globals, a CDN fallback, no teardown, an idle frame loop that never stops, no context-loss handling (measured: blank, then a black square), and a bloom that loses its blur on iOS Safari.** `draw(item, t)` is deterministic given the same build order (measured). Size: 29 KB minified, 12 KB gzip. |
| 5 | Performance plan | Headless machines can measure correctness, draw calls and relative cost. Frame rate and heat need the iPhone. **Measured on this laptop: 5–6 ms per armored hero frame versus 1.8 ms for bare Shadow.** That is already at the hub's 6 ms bar. I propose a flag-gated lab page and a one-constant fallback (§5). |
| 6 | Moods | **Battle view: confident/worried is live today; waiting is live when the cockpit is on; celebrating and researching can be derived but have no reader.** Hub: only confident/worried, from the 120 s poll, and celebrating from the recent-games list. Two standing rulings collide with idle motion and with celebrating in battle. |
| 7 | Growth | **No real source for either track today.** Partnership doesn't exist. The plays ledger is dark and reaches only `card`, `nominated` and `retired`. No per-agent, per-archetype battle count is stored. The adapter returns stage 1 everywhere. |
| 8 | Allegiance | Player and opponent are separated by **field position**, not identity. **1v1 CPU opponents have no archetype.** League CPUs and humans do. `--ft-copper` already exists and already means "opponent" in the arena. Mirroring fits the layout. |
| 9 | Who speaks | **One agent carries four labels:** "Shadow" (hub), its stored name (battle chat, cockpit), the archetype name (league voice), and "Your agent". There are also three different fallbacks. Listed for the ruling; nothing changed. |
| 10 | Small sizes | **Yes:** sequences render headless at 40 px, 2×, deterministically. A 3 s loop is **156–316 KB as WebP and 235–643 KB as PNG**. **The engine never animates below 60 px.** Recommendation: stills at 24–40 px in `public/`. Contact sheet committed. |
| 11 | Videos | Yes, after the port. Remotion's `t = frame / fps` matches `draw(item, t)`. Two caveats: build order (for bit-exact frames) and the renderer's 1024 px cap. |
| 12 | Stages | **Add an S0 before S1:** the engine port plus a lab page, so the founder's iPhone decides the budget. S1 needs a ruling on three hub guards. S3 needs a ruling on battle motion. |

---

## 0. The design file (Step 0)

`<script type="__bundler/manifest">` parsed as JSON. Each entry's `data` was base64-decoded and gunzipped when `compressed` was true. All 18 entries decoded. **V**

| Manifest uuid | Bytes (decoded) | First line / identity | Committed? |
|---|---|---|---|
| `bb0345bf-…` | 44,773 | `// af3-standalone.js — classic-script build of the agent engine…` | `docs/design/agent-identity-v2/af3-standalone.js.txt` |
| `718af151-…` | 22,353 | `// agent-boards-v2.jsx — one being…` (intro, boards 1, 2, 3, 4, 7) | `…/agent-boards-v2.jsx.txt` |
| `7a983776-…` | 19,170 | `// agent-cc-v2.jsx — Board 5 … and Board 6 (the armory)` | `…/agent-cc-v2.jsx.txt` |
| `5e003339-…` | 15,501 | `// ff-ui.jsx — tokens + primitives…` | `…/ff-ui.jsx.txt` |
| `5dfc7fe4-…` | 1,427,497 | Three.js core, `REVISION = '184'` | No |
| `b62968b2-…` | 648,961 | Three.js module (`import { … } from './three.core.js'`) | No |
| `1a942cf1-…`, `eb281f09-…` | 109,931; 1,080,227 | React / ReactDOM 18.3.1 development builds | No |
| `17ab36d9-…` | 3,137,752 | Babel standalone | No |
| 8 × `font/woff2` | 1,640–46,752 | JetBrains Mono subsets | No |

- **The two Three.js payloads are npm `three@0.184.0`, byte for byte.** The SHA-256 of `build/three.core.js` and `build/three.module.js` equals the decoded payloads (`368dc788…` and `61134198…`). The port can therefore bundle the npm release and render exactly what the boards render. **V**
- **Why `.txt`.** CI runs `npm run lint:gate` (`.github/workflows/tests.yml:109`), which applies `no-undef` at error level to every `**/*.{js,jsx}`. Run on the extracted files, the gate gives **125 errors** from the board files' prototype globals (`React`, `FF`, `Agent`, …). The engine alone gives 0. Committed as `.js`/`.jsx`, they would turn the first build PR red. That PR carries these docs. The suffix keeps the bytes identical and leaves the lint config alone. The folder's `README.md` records each file's uuid and SHA-256. **V**
- The HTML is committed as `docs/design/20261014_AGENT_IDENTITY_BOARDS_V2.html`. Its committed blob's SHA-256 equals the Downloads file's. **V**

---

## 1. Shadow today

**Where and how it renders.**

| Piece | File:line | Technique | Marker |
|---|---|---|---|
| Moving form | `src/components/CommandCenter/ShadowCanvas.jsx:52-247`: `getContext('2d')` `:94`, rAF loop `:123-134`, IntersectionObserver `:151-158`, visibility listener `:159` | **Canvas 2D**, no WebGL | V |
| Still (reduced motion, no canvas, phone constant) | `ShadowStill.jsx` (SVG), chosen at `ShadowCanvas.jsx:70`, `:214-225` | SVG | V |
| Pure drawing modules | `hub/shadowCanvas.js` (260 lines), `hub/shadowGeometry.js` (201), `hub/shadowBloom.js` (37), `hub/shadowStatus.js` (97) | — | V |
| Wide mount (desktop, tablet, stacked) | `ShadowStage.jsx:157` ← `CommandCenterHub.jsx:442` | — | V |
| Phone mount | `ShadowStage.jsx:190` (`PhoneStage`) ← `CommandCenterHub.jsx:349-360`, with `stillOnly={PHONE_SHADOW === 'still'}` `:360` | — | V |
| Sizes | `CommandCenterHub.jsx:154-159`, `shadowSizeFor`: **340** desktop, **260** tablet/stacked, **200** phone (**196** under 375 px) | — | V |
| Tier | `shadowTierFor` (`hub/shadowGeometry.js`, imported at `CommandCenterHub.jsx:132`): phone low, otherwise mid | — | V |
| Reduced motion | framer-motion `useReducedMotion()`, read once (`CommandCenterHub.jsx:182`; Q-S7-9) | — | V |
| Status | `'processing'` only while a hub-started deploy submits, otherwise `'ambient'` (`CommandCenterHub.jsx:202-204`) | — | V |

**Flags.** Shadow has no flag of its own. It ships with the hub, `COMMAND_CENTER_HUB_ENABLED = true` (`src/config/featureFlags.js:3455`). The one Shadow switch is the phone constant `PHONE_SHADOW = 'canvas'` (`hub/hubFlags.js:49`); `'still'` is its pinned fallback. **V**

**The frame-rate readout is not on `main`.** It is smoke commit `d93146f6`, "SMOKE ONLY, NEVER MERGE: a corner readout of Shadow's fps and frame cost". That commit sits on `claude/command-center-hub-s7-smoke` (local and `origin`) and adds 28 lines to `ShadowCanvas.jsx`:
- a fixed corner `div[data-shadow-readout]`, updated every 500 ms;
- the last second: `fps N · cost X ms`;
- the last 60 s: average fps, average and p95 cost of one frame's step and draw, and `late` = the share of frames more than 25 ms apart.

It is documented on `main` at `docs/audits/20261025_BUILD_COMMAND_CENTER_HUB_S7.md:404`, `:432` and `:436`. The iPhone 16 check passed (`docs/audits/20261028_ACTIVATION_COMMAND_CENTER_HUB.md:44`). The verbatim 60 s line is still "pending — the founder pastes it". **V**

**Is Shadow behind one component boundary? Yes, by design.**
- `ShadowStill.jsx:8-24`: "ONE SWAPPABLE COMPONENT … a later arc can swap this whole component (S7's ShadowFilaments, an armoured Shadow) without touching the layout."
- `ShadowCanvas.jsx:4-8` keeps the same props contract.
- The connector, the area controls and the status line anchor to the `size × size` box, never to a filament (`ShadowStage.jsx:93-109`, `:155-158`). **V**

**The smallest seam** is `ShadowCanvas`'s default export, mounted at exactly two sites. It lacks one thing: **the archetype.** Neither stage receives it.
- The hub has the raw key on `runtime.agent`. `useHubRuntime.js:104-107` already reads `agent?.archetype` for the Loadout's text (`archetypeLines`). **V**
- S1 threads one prop, the archetype code id, from `CommandCenterHub.jsx` through `ShadowStage` and `PhoneStage` to the swapped component.
- Nothing has to land first for the seam itself. The guards in §12 do.

---

## 2. Every agent or archetype visual today

Size is CSS px. "Face" = AgentPresence, an SVG robot head (`src/components/AgentPresence/faceEngine.jsx`), gated by `AGENT_PRESENCE_ENABLED = true` (`featureFlags.js:1338`, **V**). The canonical keys are `src/data/archetypeDisplay.js:18-25` (**V**):
- `momentum_chaser` → Trend Follower
- `degen` → Speculator
- `contrarian` → Contrarian
- `analyst` → Fundamental Investor
- `guardian` → Capital Preserver
- `diversifier` → Diversifier

| # | Surface | Drawn at | Technique · size | Live? | Stage |
|---|---|---|---|---|---|
| 1 | Hub Shadow, moving | `ShadowCanvas.jsx:239-244` | canvas 2D · 340 / 260 / 200 / 196 | LIVE (V) | **S1** |
| 2 | Hub Shadow, still | `ShadowStill.jsx` | SVG · same | LIVE fallback (V) | **S1** (the new form's still replaces it) |
| 3 | Hub "Equipped Archetype" control and Loadout panel | `AreaControls.jsx:69-71` ring glyph; `panels/LoadoutPanel.jsx:154-172` text and a 3 px gold bar | CSS ring 22 · text | LIVE (V·h) | **S1, indirectly**: the hero wears the set. The control itself has no visual to replace. |
| 4 | Archetype picker hero cards (the hub's "Change archetype" sheet) | `Dashboard/ArchetypePicker.jsx:84-95` (face 72 in the phone carousel, 46 in a 54 tile on the wide list); card gradient `:72`; mounted at `LoadoutSheets.jsx:135` | gradient card + SVG face | LIVE (V) | **S2** (the armory) |
| 5 | Agent record sheet orb | `Dashboard/AgentRecordSheet.jsx:229` (`AgentOrb`) | CSS orb · 56 | LIVE (V·h) | S4 |
| 6–8 | Forge "Character": ArchBand, ArchSigil, roster, "Born with" rail | `Forge/workshop/traits/TraitsExplorationKit.jsx:31-104`, `:328-375`; `character/CharacterKit.jsx:291-330` | CSS gradients · sigil 48 / 58, roster 34 / 40 | LIVE behind `RELEASE3_CHARACTER_TAB_ENABLED` (V·h) | Out of scope; a later armory reuse |
| 9 | Battle view arena header face | `screens/battleView/ArenaHeader.jsx:232-244` | SVG face, static · 56 desktop / 40 mobile (`:167`) | LIVE (V) | **S3** |
| 10 | Battle view floating character mark | `battleView/CharacterAvatar.jsx:263-281` | SVG face, static · 44 / 40 | LIVE (V·h) | **S3** |
| 11 | Character pane header face | `battleView/CharacterPane.jsx:342-359` | SVG face, static · 36 | LIVE (V·h) | **S3** |
| 12 | Battle loading glyph | `AgentBattleScreen.jsx:444-449` | lucide `Bot` · 24 | LIVE (V·h) | Out of scope |
| 13 | Film Room v2 agent mark | `screens/filmRoomV2/FilmRoomScreenV2.jsx:165-172` | SVG face, static · box 40 / 34 | LIVE (V·h) | S4 |
| 14 | League arena FuseHero heads (every seat) | `League/battleArena/FuseHero.jsx:94-102` | SVG face · 44 / 36; compact 30 / 25 | LIVE (V·h) | S4 |
| 15 | League ClimbArena heads | `battleArena/ClimbArena.jsx:225-233` | SVG face · 64 / 58 / 50; compact 54 / 48 / 44 | LIVE, Training tab (V·h) | S4 |
| 16 | League dock "agent orb" | `battleArena/CommandDock.jsx:129`, `:451` | CSS orb · 22 / 38 | LIVE (V·h) | Out of scope (22 px is below the boards' 24 px stress test) |
| 17 | League `AgentAvatar` (orb, ring, badge) | `League/LeagueParts.jsx:37-54` and call sites | CSS orb · 26–44 | LIVE (V·h) | S4 |
| 18–19 | Live-draft and draft-room orbs | `liveDraft/SeatedStatusParts.jsx:342`; `League/draft/PickPanel.jsx:123` | CSS orb · 40–46 / 38 | LIVE (V·h) | Out of scope |
| 20–21 | `Flat6BattleView` header and draft replay glyph | `Tournament/Flat6BattleView.jsx:255`; `DraftPlaybackTheater.jsx:184` | lucide `Bot` · 16 / 15 | LIVE, secondary (V·h) | Out of scope |
| 22 | Onboarding avatar and reveal | `Agent/AgentCreationFlow.jsx:510-516`, `:668-675`, `:708-718`, `:756-768` | gradient circle + lucide `Bot`/`Sparkles` · 80–100 | LIVE (V·h) | Out of scope for S1–S4. A natural later "first suiting up" moment. |
| 23–26 | Legacy dashboards (identity head, portrait, brief orbs, picker mounts) | `EquipStation.jsx:228-233`, `desktop/IdentityPanel.jsx:89-93`, … | SVG face / orb · 32–140 | **Fallback only** (hub chunk failure, `CommandCenterHubGate.jsx:258-271`) (V·h) | Out of scope |
| 27–31 | Forge mech SVG, old Traits orbs, legacy ScoreHeader face, loop-shell icons, `*.ARCHIVED` | `Forge/MechSVG.jsx`, `ForgeScreen.jsx:396-420`, … | — | DEAD or archived (V·h) | Out of scope |
| — | **Cockpit tiles** | `Cockpit2b.jsx`, `CockpitFeed.jsx`, `BoardCockpit.jsx`: no `<svg>`, `<canvas>` or `<img>` | **none today** (V·h) | — | **S3 or S4 (a new placement)** |
| — | **Chat avatars** | `Agent/AgentChat.jsx` imports only `Send`; the bubble has a name eyebrow only (`:395-399`) | **none today** (V) | — | **S4 (a new placement)** |

**Side finding, for separate tasking (not fixed): every battle-screen face draws the neutral disposition.**
- Rows 9–11 and 13 pass the battle document as `agent` (`ArenaHeader.jsx:234-236`, **V**).
- The face reads `agent?.archetype` (`useAgentPresence.js:38`, **V**).
- The battle doc carries the key only at `agentContext.archetype` (`api/_utils/agentBattleService.js:191-193`, **V**).
- `useAgentBattle` spreads the doc unchanged (`src/hooks/useAgentBattle.js:75`, **V**), so `archetypeToDisposition(undefined)` returns `'neutral'` (`presenceBinding.js:51-54`, **V**).
- S3's new form must read `agentContext.archetype`. The current faces are wrong today, regardless of this program.

**No 3D, Lottie or video exists in `src/` today.** The new form would be the app's first WebGL dependency (V·h; `package.json`, **V** for `three`).

---

## 3. Three.js in the bundle

- **Not a dependency.** `package.json` has no `three`. `package-lock.json` has 0 `node_modules/…three` entries. The root `node_modules` has no `three`. **V**
- **The probe.** A throwaway local branch `throwaway/q3-three-probe` was cut from `be52068c` in a scratch worktree.
  - `three@0.184.0` was installed into a separate scratch prefix and resolved by a Vite alias. The shared `node_modules` was never written.
  - `"three": "0.184.0"` was added to the probe's `package.json`.
  - A `ThreeProbe` component was rendered inside `ShadowCanvas.jsx`, which sits in the lazy hub chunk.
  - An unmodified baseline was built first, then two variants. Each build took about 60 s.

| Build | New chunk | Raw | gzip | brotli | Hub chunk (151,505 raw) | Entry chunk | `index.html` |
|---|---|---|---|---|---|---|---|
| A: `import('three')` (the whole namespace; upper bound) | `three.module-*.js` | **732,883** | **188,764** | 153,986 | +186 B | **Identical once chunk hashes are masked** (same 4,830,278 bytes) | Identical (masked); 0 → 0 `modulepreload` |
| B: `import('./af3EngineProbe.js')`, the engine as an ES module with `import * as THREE from 'three'` (realistic, tree-shaken) | `af3EngineProbe-*.js` | **574,365** | **150,397** | 124,163 | +187 B | Identical (masked) | Identical (masked); no preload |

- For scale: the hub chunk is 151,505 raw / 46,819 gzip, and the entry 4,830,278 raw / 1,299,365 gzip. The realistic engine chunk is **about 3.2× the hub chunk** and about 12% of the entry, gzip for gzip. It loads only when the form first mounts.
- Raw entry bytes differ only because the hub chunk's filename (its hash) changes, and the entry names it. That cascade also renames every lazy chunk. No chunk's content changed beyond the hub's +186/+187 bytes.
- **The engine alone** (esbuild, `three` external): **29,161 B minified, 12,279 B gzip, 10,891 B brotli**, from 44,773 B source. Three.js tree-shaken to the 38 classes the engine uses is therefore about 545 KB raw / 138 KB gzip. Most of that is `WebGLRenderer` and the physical material's shader chunks. **V**
- **Teardown.** The `node_modules` junction was unlinked (`rmdir`). The worktree was removed and `git branch -D throwaway/q3-three-probe` run. `git branch --list 'throwaway/*'` is empty; no remote ref exists. Nothing was committed or pushed. **V**
- **Guard consequence for S1.** `commandCenterHub.mount.guard.test.js:790-796` pins "the hub side loads nothing later: no import() or require() in its graph". Variant B, the right shape, breaks that row by design. So does any lazy engine in the hub graph. `PERMITTED_PACKAGES` (`:624`) is exactly `framer-motion`, `react`, `react-dom`, so a static `three` import breaks a second row. S1 needs a ruling (§12). **V**

---

## 4. Engine audit for the port

Cites `docs/design/agent-identity-v2/af3-standalone.js.txt`. The proposed wrapper is `<AgentForm archetype mood coreStage armorStage allegiance size />`.

| Item | Where | What the port changes |
|---|---|---|
| **Globals** | `window.__resources` `:4`; `window.FF` `:321`; `window.AF_MOTION` `:379`, `:383`, `:388`, `:395`, `:398`; `window.AF_NOBLOOM` `:373`; `window.AF3` `:400`; events `af3-ready` `:401` and `af-motion` `:398`. The boards' wrapper waits on `af3-ready` (`agent-boards-v2.jsx.txt:17-22`) | ES module exports only. Motion and bloom become arguments. Reduced motion comes from the hub's one source (R-S7-1 forbids a second media query). No window events. |
| **CDN fallback** | `:6` `import('https://unpkg.com/three@0.184.0/…')`; `:5` builds a blob-URL module from `__resources` | Delete both. `import * as THREE from 'three'` at the top of the lazily loaded engine module. Q3 variant B proves the shape. The app never fetches three from a CDN. |
| **Work at load** | The renderer is created at module evaluation (`:322-324`). PMREM studio environment `:326-332`. Scene and lights `:333-337`. A document listener `:399` | Create all of it lazily on the first mount, reference-counted. |
| **Teardown** | `unmount` (`:397`) only removes the view from the registry. Never disposed: built forms (`FORMS`, `:340-348`: geometries, `EdgesGeometry`, fade lines, one material per form), the glow texture `:102-103`, the icosahedron cache `:291-302`, the environment texture, bloom canvases `:350-352`, the renderer. The IntersectionObserver `:389` is never disconnected. The `visibilitychange` listener `:399` is never removed. **The frame loop never stops:** `frame()` re-requests unconditionally (`:386`), so after the last view unmounts it runs every frame doing nothing. | Dispose a form's geometries and materials when its last view unmounts, or keep a small cache with a cap. Stop the loop at zero views. Disconnect the observer and remove the listener; dispose the renderer and environment at zero views. A guard row per call, as S7's activity guard does. |
| **WebGL context loss** | No handler in the engine. Three r184 itself calls `preventDefault()` on loss and re-initialises on restore (`three/build/three.module.js:16323-16324`, `:17033-17063`, **V**). **Measured** with `WEBGL_lose_context`: during the loss the view draws **nothing** (0 opaque pixels). After restore the form returns **inside an opaque black square**, with changed reflections (159,623 of 160,000 pixels differ). | Listen on the renderer's canvas. On loss, show each view's still: a cached 2D image of the `stillT` frame, or the ShadowStill path. On restore, rebuild the environment and re-clear with alpha before drawing again. This needs an iPhone check: backgrounding and memory pressure trigger real losses. |
| **Per-frame readback** | Each view does one `renderer.render` into a scissored corner, then `ctx.drawImage(renderer.domElement, …)` into its own 2D canvas (`:370-372`). At 160 px and above there is a second copy for bloom (`:353`). | This copy makes one context serve many canvases: the armory (7 views) and the battle header (2). Measured here (headless Edge, Intel Iris Xe, 3×), per draw including the copy: bare Shadow 1.8 ms; armored hero 4.9–6.2 ms; a 40 px armored avatar 6.7–7.7 ms. **Cost follows draw calls, not pixels** (§5). iOS cost unknown (ASSUMED: the copy forces a GPU sync per view). For S1's single hero, a direct-to-canvas mode (no copy) is worth measuring in the lab. |
| **Bloom on iOS** | `:354` uses `ctx.filter = 'blur(…)'` | `CanvasRenderingContext2D.filter` is **disabled by default in iOS Safari 18.0–26.3** ([caniuse](https://caniuse.com/mdn-api_canvasrenderingcontext2d_filter)). On the founder's iPhone the bloom pass draws an unblurred quarter-size copy, scaled up additively (ASSUMED look: a brighter, softer double, not a glow). Options: bloom in WebGL, a CSS-blurred overlay canvas, or no bloom on iOS. This needs a device look. |
| **Reduced-motion still** | `AF_MOTION` is read once from `matchMedia` at load (`:379`), the same class as Q-S7-9. The still is `stillT(spec)` (`:380`): a designer-chosen time per form (`META[*].still`, `:32-38`) plus stage, seed and celebration offsets. | Keep `stillT`; it is good and deterministic. The hub's `reducedMotion` prop chooses it. |
| **Determinism of `draw(item, t)`** | `render` (`:358-375`) and every `update` take time only from `t`. `rng` (`:40`) is seeded and used at build time only. `hash` (`:41`) is pure. **No `Math.random` or `Date` anywhere** in the engine. `performance.now` appears only in the scheduler (`:378`, `:385`, `:395`). Inside `render`, the only environment reads are `devicePixelRatio` (`:359`) and `AF_NOBLOOM` (`:373`). | **Measured:** 168 frames (7 forms × 6 moods × 2 times × 40 and 200 px), all distinct. Re-rendered in reverse order on the same page, with junk renders between, **0 differ**: no hidden state. A fresh page that builds forms in a different order: 44 of 168 differ, in **8–15 pixels by at most 1 level** on one channel. Building in the same order first gives **0 of 168**. Mechanism (ASSUMED): Three's global object ids follow build order and break sort ties between transparent objects at equal depth. Port: build forms in a fixed order (or set `renderOrder`) for bit-exact frames. |
| **Scheduler** | 5 ms frame budget with round-robin (`:385`). Sizes under 100 px redraw every third frame. **Views under 60 px are never animated** (`:384`, `it.px >= 60`). | The budget is frame-cost-driven skipping, which R-S7-2 forbids in the hub ("no frame-cost self-downgrade"). Remove it for the single hero, or rule on it. The <60 px rule means the boards' 40 px chat and cockpit avatars are **stills**. The board's "the streams trail" at 40 px (`agent-boards-v2.jsx.txt:166`) is not what the engine does. |
| **Equip timeline** | The engine has none. `fit` is a static value (`:359`, `:366-367`). The boards show five fits as five separate views (`agent-boards-v2.jsx.txt:74-90`). The React wrapper remounts on every prop change (`:17-22`, the effect's deps include `fit` and `state`). | Give each view a mutable spec plus an internal tween: equip 0→1 over 900 ms, unequip 1→0 over 700 ms with `unfit`. Change mood without a remount. Missing from the engine but described on the boards: the "one seam flash" at lock (board 2, `:74`), celebrating's "one ring burst every 2.4 s" (`:115`), "empty sets still at 70 % light; hover starts their idle" (`agent-cc-v2.jsx.txt:121`), and the board 5 emphasis rule (armor edges vs core brighten by selected area, `:61`). |
| **Tokens (BUILD_RULES §10)** | Palette hexes `:12-17`; plate colour `0x151b28` `:93`; studio panel colours `:327-329`; fog `#15171E` `:321` | Teal near/far = `--ft-teal` / `--ft-teal-2` (`tokens.css:120`, `:181`); copper near = `--ft-copper` (`:155`). Read them with `readToken` (the WebGL route). Copper far `#F6C496`, both cores, the mono and unlit palettes and the plate and studio colours have no token: new tokens or a stated exception. |
| **Size after minification** | — | **29.2 KB minified, 12.3 KB gzip.** With tree-shaken three, 574 KB / 150 KB gzip (§3). |

---

## 5. Performance plan

**What a headless machine can and cannot measure.**
- **Can:** rendering correctness, determinism, no network fetch, draw calls and triangles per form, relative cost per form and size, bundle size, heap growth across mount/unmount cycles, context-loss behaviour, layout at 360/390/834/1280.
- **Cannot:** the iPhone's frame rate, GPU time, the iOS readback cost, Safari's canvas-filter behaviour, thermal throttling over minutes, battery. These need the founder's iPhone 16.

**Measured here** (headless Edge, Intel Iris Xe, ANGLE D3D11; each `render()` call including the 2D copy; 3×, 300 draws × 3 rounds):

| Form @ size (core stage 2) | Draw calls (armor stage 1 / 3) | ms per draw |
|---|---|---|
| Shadow bare @ 200 | 28 | 0.35–2.1 |
| Trend Follower @ 200 | 64 / 93 | 2.2 / 4.6 |
| Contrarian | 49 / 59 | 2.9 / 3.6 |
| Speculator | 67 / 99 | 3.7 / 4.5 (hero 340: 4.9–6.2) |
| Capital Preserver | 94 / **196** | 5.3 / **8.1** |
| Diversifier | 59 / 78 | 3.6 / 5.5 |
| Fundamental Investor | 73 / 128 | 6.0 / 7.8 |

For comparison, today's 2D Shadow read 0.65 ms per frame on the S7 smoke readout, also headless (`20261025_BUILD_COMMAND_CENTER_HUB_S7.md:436`). One armored form is already about S7's whole 6 ms scripting bar on a laptop GPU. **The phone number decides S1.** If the cost is too high, merge each set's plates into one batched mesh (`THREE.BatchedMesh` is in r184): 100–200 draw calls become about 5.

**The lab (propose as S0, behind a flag).**
- **Route:** `src/screens/AgentFormLab.jsx`, lazily mounted from `App.jsx` under `?agentFormLab=1` only while `AGENT_FORM_LAB_ENABLED` is true. The flag is false in the PR and flipped on a smoke branch for the Vercel preview, like S7's `d93146f6`.
- **Controls:**
  - number of views N (1–12);
  - size (24, 40, 72, 112, 200, 260, 340);
  - form;
  - mood;
  - core and armor stage;
  - allegiance;
  - bloom on/off;
  - shared renderer with copy vs. direct canvas;
  - "play equip / unequip".
- **Readout:** S7's format, unchanged:
  - last second: `fps · cost`;
  - last 60 s: fps, average and p95 cost, late % (frames more than 25 ms apart);
  - plus a **5 min** line for heat;
  - plus draw calls per frame.
  - Cost is timed around the whole render, copy included.
- **Founder runs on the iPhone 16, each for 60 s and then 5 min:**
  1. one hero at 200 (the phone hub);
  2. two at 230 (the battle header);
  3. seven at 72 + one at 190 (the armory phone sheet);
  4. twelve at 40 (to see what live small sizes would cost).

**Proposed budgets.**
- **Desktop:** 60 fps; p95 cost ≤ 6 ms; late ≤ 2% (S7's own targets).
- **iPhone 16, one hero plus the hub UI:**
  - **pass** = ≥ 55 fps on the 60 s line and ≥ 50 fps on the 5 min line, p95 ≤ 8 ms, late ≤ 2%;
  - **floor** = a steady 30 fps (render every other frame, on purpose) with late ≤ 5%.

**Fallback rule.** One constant, like `PHONE_SHADOW`:

`AGENT_FORM_PHONE = 'live' | 'half' | 'still'`

The founder sets it from the lab reading, and the run is recorded. No device sniffing and no runtime self-downgrade (R-S7-2). Below the floor, the phone shows the form's still. Pre-rendered loops are for 72 px and below only (§10). A 200 px phone hero at 3× would be 600 px frames: too heavy as sprites.

---

## 6. Moods → real signals

| Mood | Record / field (file:line) | Hub (no new server work) | Battle view | Cockpit |
|---|---|---|---|---|
| **researching** (evaluation in flight) | `agentBattles/{id}.cronState.evaluatingAt`, set when the evaluate lock is taken (`api/cron/agent-evaluate.js:964-965`, **V**), cleared at finalize. **No `src/` reader** (V·h) | **No usable signal.** The hub's `processing` is a hub-started *deploy* submitting (`CommandCenterHub.jsx:202-204`, V), not an evaluation. `evaluatingAt` is in the 120 s poll's docs, but a tick is shorter than the poll (V·h) | Field arrives live through `onSnapshot` (`useAgentBattle.js:69-75`, V). Needs only a client derivation. **Collides with a standing ruling:** "IT NEVER MOVES BETWEEN EVENTS" (`CharacterAvatar.jsx:13-19`, V) and the dropped "agent is reading the desk" state (`presenceBinding.js:100-104`, V) | Same field via the battle doc |
| **waiting for your call** | Cockpit calls; `cockpitFeed.needsYouCount` (`screens/battleView/cockpitModel.js:720`, V); rule: newest call open, has buttons, unanswered or carries a lead ask (`:635-636`, V) | **Not available.** The battle doc has no open-call count; it needs a per-battle cockpit read or a new server field (V·h). `pendingProposal` is dormant: `LAUNCH_EXECUTION_MODE = 'autopilot'` (`api/_utils/executionAuthority.js:25`, V) | **Available while the cockpit is on:** `buildCockpitFeed` (`AgentBattleScreen.jsx:2610-2631`, V). The cockpit runs only while `status === 'active'` (`:1222`, V) | **Available:** `needsYouCount`; Cockpit 2b `nowCount` (`cockpit2bModel.js:455`, V) |
| **confident / worried** (lead / deficit) | `scoreState.currentScore` / `opponentScore`; `standingFromDuel` (`presenceBinding.js:90-97`, V) | **Derivable**, up to 120 s stale, from the hub's active-battle poll (V·h). Tournament battles have a group, not a 1v1 opponent (V·h) | **Live, already wired:** `displayPlayerScore` / `displayOpponentScore` (`AgentBattleScreen.jsx:1714-1723`, V) → `useAgentPresence.js:42` (V) | Cockpit 2b sees `records.battle.scoreState` (V·h); CockpitFeed does not |
| **celebrating** (won) | **The battle doc has no winner field.** Derived from `status === 'completed'` + the `battle_complete` feed entry + mine > theirs: `deriveGameOutcome` (V·h) | **Derivable** from the hub's 10 recent games (`useHubCompletedBattles`), but there is no "seen" field, so a recency window is needed (V·h) | Derivable from the live doc; **not wired**. `presenceBinding.js:100-104` dropped win/loss "for lack of a real source" (V). Re-adding it reopens that decision | **Impossible:** the cockpit ends with the battle |
| **idle** | None of the above | Default | Neutral standing | — |

**What each surface can read without new server work:**
- **Hub:** confident/worried (stale, from the poll), celebrating (from recent games), idle.
- **Battle view:** confident/worried (live); waiting (cockpit on); celebrating and researching (derivable; both need rulings).
- **Cockpit:** waiting; confident/worried (2b only).

---

## 7. Growth → honest sources

**Rulings as found in `docs/` (V):**
- The 26 Sep hub ruling ("no growth levels until the agent's-record contract exists") is **not in `docs/`**. I searched "26 Sep", "Sep 26", "2026-09-26", "growth level" and "record contract". The nearest committed text is the hub spec: "No intelligence, improvement, growth, or earned-render-tier claim is permitted" (`docs/specs/20261012_COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2.md:37`). The same spec lists Shadow's split record as a "later dependency; no score or growth widget in V1" (`:321`).
- The growth loop map V1.2 (`claude/GROWTH_LOOP_MAP_V1_2_OCT28_2026.md`) is **not committed**. Only a mention exists (`docs/audits/20261028_TF_SETUP_EVALUATOR_SLICE1.md:414`, V·h). I quote only the prompt: growth is installed plays and rule versions, not activity.
- Adopted direction: plays belong to the archetype they were earned on, and "the record of who was right when the pair split stays with Shadow across archetypes" (`docs/design/20261010_FOUNDER_RULING_SHEET_PRACTICE_FIELD_V1_1.md:25-27`, V).

| Object | Where | Real today? |
|---|---|---|
| **Partnership** (confirmed / proposed) | **None.** The hub shows "Not in this release" (`hub/hubCopy.js:128-132`, V). Spec: deferred (`SPEC_V1_2.md:15`, `:305`, V). The boards' "1 confirmed · 1 proposed" is design fixture text (`agent-cc-v2.jsx.txt:3`) | **No** |
| **Shared research outcomes** | Idea versions `watchlists/{id}/hypothesisVersions/v{n}` and `researchWork/{id}`. Read through the list GET → `hub/useHubResearch.js:140` → `researchView.js`. Behind `HYPOTHESIS_RECORDS_ENABLED = true` (V·h; spec `:315`, V) | **Yes** (production population unverified). Not a growth stage: there is no "unresolved" state (V·h) |
| **Plays ledger** `agents/{agentId}/plays` | `api/_utils/filmRoom/cardStore.js`. Fields include `archetypeCodeId`, `stage`, `stageHistory` (V·h). Stages written: **`card`, `nominated`, `retired` only** (`:45-46`, V: "The camp's `drilled → drafted → proven → installed` are not here"). Route dark: `FILM_ROOM_CARDS_MODE = 'off'` (`featureFlags.js:3501`, V). **No rule-version field** (V·h) | **No** (dark, and it never reaches `installed`) |
| **Rule versions** (closest) | Forge rules `agents/{id}/rules/{id}.status`; bundle `version` / `previousVersionId` (`forgeService.js`, V·h) | Live, but not plays. Treating them as growth is a ruling, not a fact |
| **Per-archetype battle counts** | **Not stored per agent.** The nearest, `masteryProfiles/{uid}.archetypes[a].battlesCounted`, is per *user*, XP-based, and its writer is dark (`MASTERY_XP_ENABLED = false`, `api/_utils/masteryConfig.js:41`, V) | **No** |
| Cost to compute them | `agentBattles` where `ownerId ==` and `agentContext.archetype ==`; the one matching index is (ownerId, agentContext.archetype, createdAt) (`firestore.indexes.json:255-272`, V). It is one count query per archetype (six per player) and probably a new index for a status filter (ASSUMED). Hub games run on the casual clone `agents/casual-agent-{uid}`, so filtering by the ranked `agentId` misses them (V·h) | — |

**Conflicts to note.**
- The live `getAgentLevel(gamesPlayed)` ("Rookie… Partner at 15 games", `src/constants/agentProgression.js:35-63`, V·h) is an activity level, shown in the record sheet the hub opens.
- The boards drive both tracks from battle counts: `STAGE_LABELS = ['First battle', '20 battles', '60+ battles']` (`agent-boards-v2.jsx.txt:93`); "31 battles in this armor" (`:155`); the armory's `growth()` (`agent-cc-v2.jsx.txt:67-76`); and the core labelled "24 battles · stage 2" (`:98`). The last contradicts the boards' own rule that the core "grows with the partnership" (`agent-boards-v2.jsx.txt:45`).

**Proposed adapter** (read-only, pure, no thresholds):

```js
// src/components/AgentForm/agentGrowth.js (proposed). No Firestore read in V1: the caller hands in records it already holds.
export function getAgentGrowth(agentId, sources = {}) {
  // sources.core:  e.g. Shadow's split record or confirmed partnership preferences, once they exist
  // sources.armor: e.g. installed plays on this archetype (agents/{agentId}/plays, stage 'installed'), once that stage has a writer
  const core = Array.isArray(sources.core) ? sources.core : [];
  const armor = Array.isArray(sources.armor) ? sources.armor : [];
  return { coreStage: 1, armorStage: 1, sources: { core, armor } }; // stage 1 until a real source exists; thresholds are a ruling
}
```

- Stages are 1-based. The wrapper maps stage *n* to the engine's `CORE[n-1]` / `ARMOR[n-1]` (`af3-standalone.js.txt:28-29`).
- `agentId` is the ranked agent. A later reader must also resolve the casual clone's records.
- The armory and the battle header show **no battle counts** and no "Never worn" until a source exists.

---

## 8. Allegiance and opponents

- **Which side is the player.**
  - 1v1 battle view: **by field position.** The player is the doc's own `portfolio` / `scoreState.currentScore`; the opponent is `opponent.portfolio` / `scoreState.opponentScore` (`AgentBattleScreen.jsx:1714-1723`, V). The opponent label is a literal "CPU" (`ArenaHeader.jsx:330`, V).
  - League: `you = !!uid && odUserId === uid` (`League/leagueAdapter.js:231`, V).
- **CPU archetype.**
  - **1v1 CPU: none.** The opponent is `{ portfolio, bench, username: 'CPU Opponent', odUserId: 'cpu' }` (`api/agent/decide.js:944-949`, fenced, read only, V).
  - **League CPUs: yes.** `agents/cpu-agent-{n}` carries `archetype` (`api/_utils/tournamentCpu.js:63-70`, V). The client resolves it with no read (`buildArenaModel.js:176-178`, V).
  - League humans: through the spectator projection (`agentContext.archetype`), only while the fuse hero polls (V·h).
- **Copper exists and already means "opponent".**
  - `--ft-copper: #e8927c` (`src/theme/tokens.css:155`, V), added for exactly this: "the CPU is an opponent, not an error" (`:149-154`; `ArenaHeader.jsx:13-17`, V).
  - Two clashes:
    - on the hub, copper means *trouble* (failed or uncertain deploy, review due) (V·h);
    - copper is also a player-selectable agent colour (`agentColorPalette.js:105`, V·h).
  - The new form's allegiance light must not follow the player's DNA colour. Otherwise a copper player meets a copper opponent.
- **Mirroring.**
  - **No layout clash.** The arena header is a `1fr auto 1fr` grid with the CPU on the right, `alignItems: 'flex-end'` (`ArenaHeader.jsx:221`, `:316-319`, V). The legacy ScoreHeader already "mirrors the CPU side on the right" (V·h).
  - The engine mirrors by `ctx.scale(-1, 1)` (`af3-standalone.js.txt:371`), so the key light swaps sides too, as the boards intend (`agent-boards-v2.jsx.txt:173`).
  - The opponent's mood needs a sign flip: `standingFromDuel(opp, mine)`.
  - There is no opponent cell at all for a 1v1 CPU without an archetype (Founder question 1).

---

## 9. Who speaks (no change made)

| Source of the label | Where (file:line) | Attribution |
|---|---|---|
| Name copied onto the battle (`agentContext.agentName`, server fallback `'Agent'`, `agentBattleService.js:192`, V) | Battle chat eyebrow: `AgentChat.jsx:399` (CSS upper-case `:395`), from `AgentBattleScreen.jsx:3181` with fallback `'Your Agent'` (V). Arena and pane headers (V·h). Cockpit 2b: "{agent}'s next check" (`battleViewCopy.js:1099`, V), "{agent} plans to…", "Let {agent} choose" (V·h). Film Room (legacy and v2) (V·h) | The agent's custom name |
| Live `agent.name` | Hub Loadout `LoadoutPanel.jsx:144-149` (fallback 'Your agent'). Forge and watchlist chats (fallback **'Gemma'**). Record sheet (V·h) | Custom name |
| Archetype as speaker | League voice lane: "{archName}'s voice" (`League/battleArena/VoiceLane.jsx:92`, V); `archName` = `archetypeLabel(...)` (V·h) | "Trend Follower's voice" |
| Generic | Film Room v2 "the agent"; battle "Why" footers "The agent's own words"; "Your agent declares calls…"; chat chrome (V·h) | "the agent" / "Your agent" |
| Fixed "Shadow" | Hub only: name and role `hubCopy.js:83-84` (V), stage label, status line, image label, "Send Shadow into a game" (V·h). It never labels a chat line | "Shadow" |
| Player | Unlabelled bubbles; "You said / You agreed / You asked" (V·h) | — |

**Inconsistencies for the ruling:**
- Fallbacks 'Agent', 'Your Agent', 'Your agent' and 'Gemma'.
- Three casing rules: CSS upper-case, first-letter capital, "never change case" in Film Room v2.
- **'Shadow' is also one of the placeholder names offered at agent creation** (`AgentCreationFlow.jsx:70`, V). A player can name their agent "Shadow" while the hub calls the brain "Shadow".

The boards attribute chat lines "Shadow · wearing Trend Follower" and "Shadow" (`agent-boards-v2.jsx.txt:162-164`).

---

## 10. Small sizes

- **Headless frame sequences: yes.** The extracted engine (unmodified, plus a scratch-only export of `render`/`draw`/`stillT`) runs in headless Edge with three served locally and every other request blocked: 0 blocked, 0 page errors.
- **Measured:** 72 frames (24 fps × 3 s) at 40 px and 2× (80 × 80 per frame), six form × mood pairs. Deterministic per build order (§4).

| Pair (stage 2/2) | PNG sprite sheet (720 × 640) | WebP q0.85 sheet | Sum of single-frame PNGs (≈ unoptimised APNG) |
|---|---|---|---|
| Trend Follower · idle | 234,765 | 156,146 | 600,916 |
| Speculator · idle | 463,700 | 292,928 | 756,206 |
| Diversifier · researching | 471,830 | 316,340 | 790,318 |
| Capital Preserver · worried | 344,199 | 235,620 | 747,530 |
| Fundamental Investor · celebrating | 643,446 | 277,376 | 877,487 |
| Shadow bare · waiting | 372,776 | 285,966 | 747,795 |

- **Video with alpha:** not encodable here (no ffmpeg); ASSUMED much smaller per loop. **Safari ignores alpha in WebM**; it needs HEVC with alpha (.mov), so every asset would ship twice ([Jake Archibald 2024](https://jakearchibald.com/2024/video-with-transparency/)).
- **The engine's motion does not loop.** Its frequencies (`0.27`, `0.21`, random `rotV`, …) are incommensurate, so a 3 s loop jumps at the seam unless a loop-aware time warp or crossfade is designed.
- **Recommendation for 24–40 px: stills, not loops.**
  - The engine itself never animates below 60 px (§4), so the boards' small avatars are already stills.
  - One still per form × mood × allegiance (7 × 6 × 2 = 84) at 2× is about 8–12 KB as PNG (the frame average above), **about 1 MB total**. Ship it from **`public/agent-forms/v1/`**: versioned with the engine, CDN-cached, no Firebase read or rules.
  - Loops for every pair would be about 84 × 250 KB ≈ 21 MB (WebP). If wanted at all, only at 60–72 px, lazily, from Firebase Storage.
- **Contact sheet:** `docs/audits/assets/agent-identity-40px.png` (3033 × 1761, 3× = iPhone 16 density).
  - Content: the seven forms at 112 px (reference), 40 px colour, 40 px grayscale (desaturated), 40 px in the boards' own pewter palette, 24 px colour and 24 px grayscale.
  - Rendered as the idle frame, the engine's own still, at stage 1, the stage every agent shows today.
- **What the sheet shows** (my read; the founder's eye decides):
  - **Speculator vs Diversifier:** apart at 40 px. Speculator is a round burst of shards; Diversifier is a wide, flat ring of pods. At 24 px both become "bits around a dot" and separate mainly by width.
  - **Capital Preserver's closed shell hides the white core completely** at 40 and 24 px: a dark ball with lit seams. Fundamental Investor and Trend Follower hide most of it too.

---

## 11. Videos (Remotion)

Yes, with no change beyond the port. Remotion drives a frame number, and the ported `render(ctx, spec, t)` with `t = frame / fps` is exactly the engine's contract: no wall-clock or random input inside drawing (§4).

What the video project must handle:
1. Load three before the first frame (`delayRender` until the engine module resolves).
2. Run Chromium with a GL backend (`chromiumOptions.gl: 'angle'` or SwiftShader). This run's headless Edge used ANGLE/D3D11.
3. Build forms in a fixed order per tab, or concurrent render tabs will differ by one level in a few pixels.
4. Raise the shared renderer's 1024 px cap (`GL = 1024`, `af3-standalone.js.txt:321`) for a full-frame 1080p agent, or it is upscaled.

The canvas-filter bloom works in Chromium, so videos keep the glow the iPhone loses.

---

## 12. Stage plan

**Add S0 before S1.** S1's risks (cost on the iPhone, Safari bloom, context loss) are device questions. Answering them inside the hub, under its guards, mixes two reviews.

| Stage | Files touched (expected) | Flag(s) | Fence contact | Tests | Founder's phone smoke |
|---|---|---|---|---|---|
| **S0 Engine port + lab** | New `src/components/AgentForm/engine/{core,armor,engine}.js` (the ES-module port), `AgentForm.jsx`, `agentGrowth.js`; `src/screens/AgentFormLab.jsx`; `App.jsx` (one lazy import + one gated mount); `package.json` + lock (`three@0.184.0`); `featureFlags.js` | `AGENT_FORM_LAB_ENABLED = false` (flipped only on a smoke branch) | None | Pure engine rows in Node (states, `stillT`, fit math, determinism of the geometry builders). Wrapper rows with the canvas kit: no WebGL → still; context lost → still; unmount disposes everything (call-count manifest like S7's activity guard). A source scan for `unpkg`, `window.`, `Math.random`, `Date`, `matchMedia` in the engine. An import-graph row: `three` reachable only through the lazy engine module. `vite build`: entry chunk unchanged (hash-masked) | The §5 lab runs: 60 s and 5 min lines, four layouts; lock and unlock the phone (context loss); Reduce Motion on |
| **S1 Hub hero + equip** | `ShadowCanvas.jsx` (or a sibling the stage chooses by flag), `ShadowStage.jsx` (one `archetype` prop at `:157` and `:190`), `CommandCenterHub.jsx` (thread `runtime.agent?.archetype`), `hub/hubCopy.js` (image label "Shadow wearing …"), `hub/hubFlags.js` (`AGENT_FORM_PHONE`), the guards | `AGENT_FORM_HUB_ENABLED = false`; `AGENT_FORM_PHONE` | None. The archetype is read from the agent doc; the change still uses the shipped `changeArchetype` | **Guard amendments, each a founder ruling:** (1) `commandCenterHub.mount.guard.test.js:790-796`, "no import() in the hub graph": allow exactly one lazy edge to the engine, or make `AgentForm` a `PERMITTED_TERMINAL`; (2) `PERMITTED_PACKAGES` (`:624`) if `three` is reached statically; (3) `ALLOWED_ACTIVITY` (`:714`) and the activity guard's call manifest for the new view; (4) R-S7-2: remove the engine's frame budget (§4). Flag-off rows: today's ShadowCanvas path byte-identical. Equip plays once per archetype change; reduced motion swaps to the new still. `vite build`; mutation-checked rows; the full suite (the mount guard is red only there) | The hub with the readout on the iPhone 16; change archetype → 900 ms suit-up; Reduce Motion; background 1 min; lock and unlock; 360 and 390 widths |
| **S2 Armory** | New `Armory.jsx` (beside `LoadoutSheets.jsx`), the swap at `LoadoutSheets.jsx:135`. **`ArchetypePicker.jsx` stays**: the League loadout chooser reuses `ARCHETYPE_ORDER` and the card (`:45-47`) | `AGENT_FORM_ARMORY_ENABLED` | None. The commit stays `changeArchetype`: battle-locked, 409 mid-battle, an immediate change (`ArchetypePicker.jsx:12-16`, V) | Parity with the picker's sheet tests (focus, escape, close, staged confirm, 409 path); seven views share one renderer; no growth counts shown (§7); flag-off byte-identical | Open the armory on the phone: seven forms at ≥ 30 fps; preview a set (equip on the centre); Equip → closes → the hub plays the same motion; try mid-battle → the locked message |
| **S3 Battle header + moods** | `screens/battleView/ArenaHeader.jsx:232-244`, `CharacterAvatar.jsx`, `CharacterPane.jsx`, `AgentBattleScreen.jsx` (pass `agentContext.archetype`); new pure `deriveAgentMood({ battle, cockpitFeed })` | `AGENT_FORM_BATTLE_ENABLED` (inside the existing character-pane gates) | None (reads only) | The mood table of §6, row by row, on fixtures. Opponent: copper, mirrored, sign-flipped standing. **Needs the motion ruling:** `CharacterAvatar.jsx:13-19` ("never moves between events", D-97) and `presenceBinding.js:100-104` (win/loss dropped) | A live battle: lead flips → confident/worried; a cockpit call → waiting; the 1v1 CPU side per Founder question 1 |
| **S4 Small sizes** | Chat bubbles (`AgentChat.jsx` eyebrow row), cockpit tiles, `FilmRoomScreenV2.jsx:165-172`, the league heads (`FuseHero.jsx`, `ClimbArena.jsx`, `LeagueParts.jsx`), the record sheet orb; a still set in `public/agent-forms/v1/` plus a script that renders it with the engine | `AGENT_FORM_SMALL_ENABLED` | None | A manifest row: every form × mood × allegiance still exists and matches the engine render, hash-pinned (bit-exact under the fixed build order) | Chat and cockpit at 40 px; Film Room; league lobby; grayscale legibility |

**Must land before S1:**
1. S0 and its device reading.
2. The four guard rulings above.
3. A decision on the iOS bloom.

The battle-face archetype bug (§2) is separate tasking. Fix it before or with S3.

---

## 13. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | The armored hero misses 60 fps on the iPhone (laptop proxy: 5–6 ms per draw; 196 draw calls for Capital Preserver at stage 3) | High | Phone hub regresses from today's 60 fps Shadow | S0 lab first; `BatchedMesh` per set; `AGENT_FORM_PHONE` = half or still |
| R2 | The bloom has no blur on iOS Safari (`ctx.filter` disabled by default) | Certain on iOS | The designed glow looks different on the founder's phone | WebGL or CSS bloom, or none on iOS; look on the device in S0 |
| R3 | Context loss: blank form, then a black square after restore (measured) | Medium (backgrounding, memory pressure) | A visible defect on the hub | Loss and restore handlers; still fallback; rebuild the environment |
| R4 | The engine never frees anything and its loop never stops | Certain as extracted | Memory and battery drain across navigation | The port's teardown, plus a guard manifest |
| R5 | A lazy chunk breaks the hub's "no import()" guard | Certain | S1 cannot pass CI without a ruling | Rule before S1 (§12) |
| R6 | Growth tracks have no honest source | Certain today | The boards' battle counts would be activity-as-growth, against the rulings | Stage 1 everywhere through `getAgentGrowth`; no counts shown |
| R7 | Battle motion and celebrating conflict with standing rulings (D-91/D-97; win/loss dropped) | Certain | S3 can't ship the boards' moods as drawn | Founder ruling before S3 |
| R8 | The 1v1 CPU has no archetype | Certain | The battle header has no opponent form | Founder question 1 |
| R9 | Small sizes: Capital Preserver hides the core; Speculator and Diversifier converge at 24 px | Visible on the sheet | Identity unclear in chat and cockpit | Founder looks; adjust design or keep 24 px off-spec |
| R10 | The armory copy says "applies on your next deploy"; the shipped change is immediate and battle-locked | Certain | A wrong promise in the UI (display-agreement, §9) | Copy follows the shipped behaviour unless the founder rules a change |
| R11 | Copper means both "opponent" and "trouble"; copper is also a selectable agent colour | Medium | Confusing colour meaning | Allegiance light is fixed teal/copper, never the DNA colour |
| R12 | Bundle: +150 KB gzip on the first form mount | Certain | Slower first hub paint on cellular (the form loads after the hub) | Lazy chunk; ShadowStill or the form's still until it loads |
| R13 | Board copy describes effects the engine lacks (seam flash, ring burst, 70 % idle sets, emphasis by area, trailing streams at 40 px) | Certain | Build/design disagreement at review | List them in the S1/S2 spec as either built or dropped |

---

## Founder questions

1. **The computer opponent has no style in solo battles.** In a one-on-one battle against the computer, the opponent was never given an archetype. Should it appear as a bare copper Shadow, as no figure at all, or should we give computer opponents a style?
2. **If the phone can't keep up, what should it do?** Today's Shadow runs perfectly smoothly on your iPhone. The armored version does several times more work. If it can't hold full smoothness, would you rather it run steadily at half speed or show a still picture on phones?
3. **May the agent move in battle?** You ruled earlier that the battle-screen face stays still between events, and that "won" and "thinking" weren't shown because there was no honest signal. The new figure idles continuously, and the boards show "celebrating" and "researching". Keep battle still, allow gentle idle motion, or allow all six moods?
4. **Small sizes, from the contact sheet.** At chat size, Capital Preserver's shell hides the glowing core completely. At the smallest size, Speculator and Diversifier look alike. Are these acceptable, or should the designs change before small sizes ship?
5. **When does a new armor take effect?** The armory board says a change "applies on your next deploy". Today a change takes effect immediately and is blocked during a battle. Which should the armory promise?

---

## 14. This run's commits and artifacts

- `docs/design/20261014_AGENT_IDENTITY_BOARDS_V2.html`: the design file, byte for byte.
- `docs/design/agent-identity-v2/{af3-standalone.js,agent-boards-v2.jsx,agent-cc-v2.jsx,ff-ui.jsx}.txt` + `README.md`: the extracted sources and their provenance.
- `docs/audits/assets/agent-identity-40px.png`: the contact sheet.
- This report.

Not committed: the scratch harness that produced §4, §5 and §10's measurements. It consists of a contact-sheet page, a lab page with a scratch-only export of `render`, a Playwright runner on headless Edge, the Q3 probe files and builds, and the ES-module conversion script. No application code, no PR.
