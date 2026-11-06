# Loadout boards v1 — extracted sources

Decoded from `docs/design/20261104_LOADOUT_BOARDS_V1.html` (the Claude Design standalone export `Loadout_Boards_v1 (standalone).html`, 2,063,151 bytes, SHA-256 `66a961a47b1d089c32205a7000773e76de584a4cf635160102ef7e6c9a7301cf`), for build A2 (per-game loadouts). What A2 inherits from them, with the founder's adjustments, is §14 of `docs/audits/20261104_BUILD_ARMORY_A1.md`.

Each file is the gunzipped payload of one `__bundler/manifest` entry, byte for byte. Nothing was reformatted.

| File | Manifest uuid | Bytes | SHA-256 |
|---|---|---|---|
| `loadout-boards-a.jsx.txt` — the system intro, board 1 (the loadout overview), board 2 (the Deploy card's line), board 3 (the League lobby's line) | `12434149-a4ed-48cf-9bf6-12b9fb64408e` | 16,576 | `4cc7a34ce57fb7988998c7838dfc94b9b0e568c34d2c4adaf5c05aabb8d02473` |
| `loadout-boards-b.jsx.txt` — board 4 (the armory with a loadout context), board 5 (the flow), board 6 (the hero wears the surface's loadout), board 7 (decisions) | `b7212350-b1f4-46bd-a541-e2d5d90d2e12` | 17,928 | `d4d630fc464926876a356953d0b2ca1c49134ebe746bc3956180ec4d5c5318c9` |
| `loadout-parts.jsx.txt` — the shared pieces (the loadout card and line, the phone and desktop frames, the armory in the hero, the Deploy card) | `3e7251c2-ae39-4ff7-b4e7-dd05ffcff2fa` | 28,730 | `868a26ccef2b3cae01e9dd44b7afddafc998fc64ca4826c63505987c8acb375b` |

**Already committed, not repeated here.** The export also carries the identity boards' four files, byte for byte the ones in `docs/design/agent-identity-v2/` (the same SHA-256): `ff-ui.jsx` (`72dcf12c-…`), `agent-boards-v2.jsx` (`0b88edfe-…`), `agent-cc-v2.jsx` (`fc38afec-…`) and the engine `af3-standalone.js` (`01b2eb9a-…`). The loadout boards reuse their `Agent`, `Board`, `Panel` and `Motion`.

**Why `.txt`.** As in `agent-identity-v2/`: CI's lint gate (`npm run lint:gate`) runs `no-undef` over every `**/*.{js,jsx}`, and the boards use the prototype's globals (`React`, `FF`, `Agent`, …). The suffix keeps them out of ESLint, Vite and Vitest without editing their bytes or the lint config.

**Not committed:** Three.js r184 (`three.module.js` and `three.core.js`, manifest `9a2d5b2b-…` and `68b61d9f-…`), React and ReactDOM 18.3.1 development builds, Babel standalone, and eight woff2 font subsets. All of them are still inside the HTML.

To decode again, read the JSON in `<script type="__bundler/manifest">`; for each entry, base64-decode `data` and gunzip it when `compressed` is true.
