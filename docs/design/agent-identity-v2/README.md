# Agent identity boards v2 — extracted sources

Decoded from `docs/design/20261014_AGENT_IDENTITY_BOARDS_V2.html` (the Claude Design standalone export, 2,037,153 bytes, SHA-256 `7409b86b07bcd8259f7f822d18a9239e342a37a028096cebcbcb93860002ec39`), for the Phase 0 read in `docs/audits/20261028_PHASE0_AGENT_IDENTITY.md`.

Each file is the gunzipped payload of one `__bundler/manifest` entry, byte for byte. Nothing was reformatted.

| File | Manifest uuid | Bytes | SHA-256 |
|---|---|---|---|
| `af3-standalone.js.txt` — the engine (Three.js r184, one shared WebGL renderer) | `bb0345bf-61f2-42c5-9217-a4d4342617bf` | 44,773 | `6d2fc8ad03cebf484f9b83eb444274237ba7417a651f42ef65d81cfc342de448` |
| `agent-boards-v2.jsx.txt` — system intro and boards 1, 2, 3, 4, 7 | `718af151-8050-4d82-9f01-18aefb6f4152` | 22,353 | `f9e2d1403c18a315548a99a3875df0a6d7cd55d4685a10153afe2f4b1e425fa8` |
| `agent-cc-v2.jsx.txt` — board 5 (Command Center) and board 6 (the armory) | `7a983776-de4b-4e0d-87b0-90887926efdf` | 19,170 | `8cc1d64eee1a755a5bfcd4476a8e10df9c2d8e9a2b030deb6aecce5191a4f792` |
| `ff-ui.jsx.txt` — design tokens and primitives | `5e003339-d1e2-4d9f-8bbd-9b98c558945b` | 15,501 | `01ffba260582c741e2da453f5bb21031e716f16095a5194c540f533df906b75a` |

**Why `.txt`.** CI's lint gate (`npm run lint:gate`, `.github/workflows/tests.yml`) runs `no-undef` over every `**/*.{js,jsx}` in the repo. The board files use the prototype's globals (`React`, `FF`, `Agent`, …) and would add 125 errors there. The suffix keeps them out of ESLint, Vite and Vitest without editing their bytes or the lint config. The engine passes the gate as `.js`; it carries the suffix too so that nothing in this folder is code.

**Not committed:** Three.js r184 (`three.module.js` and `three.core.js`, manifest `b62968b2-…` and `5dfc7fe4-…`), React and ReactDOM 18.3.1 development builds, Babel standalone, and eight JetBrains Mono woff2 subsets. All of them are still inside the HTML.

To decode again, read the JSON in `<script type="__bundler/manifest">`; for each entry, base64-decode `data` and gunzip it when `compressed` is true.
