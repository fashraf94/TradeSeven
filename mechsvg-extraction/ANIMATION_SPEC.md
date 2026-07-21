# MechSVG — Animation Spec (for Design, no Framer Motion required)

Every behaviour below is transcribed from `src/components/Forge/MechSVG.jsx` at
the cited line. All are **VERIFIED**. Where the brief's request and the code
disagree, both are stated. All motion is gated by reduced-motion: if the
`reducedMotion` prop is set **or** the OS prefers-reduced-motion, breathing,
blink and reactive gestures are all suppressed and CSS transitions become `none`
(`MechSVG.jsx:25-27, 46, 76, 161-164`).

The three the brief asked for are first, then the rest of what actually runs.

---

## 1. Breathing  — ✅ matches the brief exactly

- **Trigger:** idle state only (`STATES.idle.breathing = true`; editing / equipping
  / dormant do not breathe — `MechSVG.jsx:10-12`).
- **Target:** the whole hero wrapper `<div>` (`MechSVG.jsx:230-232`).
- **Keyframes** (`MechSVG.jsx:145-150`):

```css
@keyframes mechBreathe {
  0%, 100% { transform: translateY(0px); }
  50%      { transform: translateY(-4px); }
}
/* applied as: */ animation: mechBreathe 4s ease-in-out infinite;
```

- Duration **4s**, `ease-in-out`, infinite. Amplitude **−4px** at the halfway point.

---

## 2. "Visor pulse (3s)"  — ⚠️ does not exist as written

There is **no 3-second visor pulse** anywhere in `MechSVG.jsx`. The visor/eyes are
lit by a **static** Gaussian-blur glow filter, not a timed pulse:

- `teal-glow` filter (`feGaussianBlur stdDeviation="2.5"`) on eyes + antenna tip
  (`MechSVG.jsx:245-252, 391, 425, 373`).
- `core-glow` filter (`stdDeviation="3"`) on the power-core dot (`:254-261, 347`).

The only **recurring** visor motion is the blink (§4). The only **visor colour**
animation is an 800 ms flash on a reactive pulse (§5c), eased by
`stroke 0.8s ease, fill 0.8s ease` (`visorTransitionStyle`, `MechSVG.jsx:162-164`).

**If Design wants the intended 3s visor pulse, it must be authored new.** A
faithful match to the existing teal look would be an opacity breath on the two eye
irises (`cx 83.5/116.5, cy 55, r 5`, fill `#5EEAD4`):

```css
@keyframes visorPulse {           /* NEW — not in current code */
  0%, 100% { opacity: 1;   }
  50%      { opacity: 0.55; }
}
/* eyes: */ animation: visorPulse 3s ease-in-out infinite;
```

---

## 3. Equip power-up  — ⚠️ "1.5s" is the face-hold; the bounce is 0.8s

Fires when `reactPulse.type === 'equip'` (`MechSVG.jsx:97-105`). Two things run:

**a) Body bounce (0.8s)** — a scale + vertical hop, `easeOut`:

```css
@keyframes mechEquipBounce {      /* times: 0, .2, .5, .7, 1 over 0.8s */
  0%   { transform: scale(1)    translateY(0);   }
  20%  { transform: scale(1.08) translateY(-6px);}
  50%  { transform: scale(0.97) translateY(0);   }
  70%  { transform: scale(1.02) translateY(-2px);}
  100% { transform: scale(1)    translateY(0);   }
}
/* duration 0.8s ease-out, plays once */
```

**b) Happy face held 1.5s** — expression flips to `happy` and reverts after
**1500 ms** (`MechSVG.jsx:103-104`). This is the "1.5s" in the brief. During it:
eyes become upward arcs, mouth becomes the big smile (see §6), swapped in over a
0.15s opacity ease.

So the equip beat = a fast **0.8s** power-up bounce layered under a **1.5s** happy
expression, not a single 1.5s power-up.

**Related, same family — colour surge (0.4s):** whenever `primaryGlow` changes
(e.g. equipping shifts the dominant DNA colour), the wrapper flashes
`filter: brightness(1.3)` for **400 ms**, transition `all 0.15s ease-out`, then
eases back over `0.4s` (`MechSVG.jsx:119-138`).

---

## The rest of what actually animates

### 4. Blink (idle "soul")
Random cadence **5000–8000 ms** (`5000 + Math.random()*3000`), each blink lasts
**150 ms** (`MechSVG.jsx:45-67`). During a blink the round iris (`r 5`) drops to
`opacity 0.3` and a thin squish ellipse (`ry 0.8`) shows, eased `opacity 0.08s`
(`:400-405, 434-439`). Only in non-dormant, non-reduced-motion.

### 5. Reactive pulses (`reactPulse`)  (`MechSVG.jsx:74-117`)
| type | motion | duration |
|---|---|---|
| `ruleAdd` | scale `[1, 1.05, 1]`, easeOut + happy face | 0.4s bounce / 1.5s face |
| `equip` | §3 above | 0.8s bounce / 1.5s face |
| `ruleRemove` | x-shake `[0, −2, 2, −1, 0]`, easeOut | 0.3s |
| any with `.color` | visor colour flash via `glowColorOverride`, auto-clears | 800 ms |

### 6. Expression swaps (idle ↔ blink ↔ happy ↔ thinking)
Cross-faded by `opacity 0.15s ease`; visor colour eased `stroke/fill 0.8s ease`
(`MechSVG.jsx:161-164`). Variants (all in `frames` geometry, omitted from the
static idle export because they sit at `opacity 0` in idle):
- **happy:** eye arcs `M78 57 Q83.5 50 89 57` / `M111 57 Q116.5 50 122 57`; big
  mouth `M85 71 Q100 80 115 71` (`:407, 441, 465`).
- **thinking:** iris shifts up to `cy 52, r 3` (`:414, 448`).
- **blink:** see §4.

### 7. Standby dim (state, not motion)
`mode === 'standby'` → wrapper `opacity 0.4`, `filter: grayscale(30%)`
(`MechSVG.jsx:133-135`). Dormant state → `opacity 0.3`, strokes `#2A2D35`
(`:9, 30`).

---

### Timing summary

| behaviour | duration | easing | loop | brief? |
|---|---|---|---|---|
| Breathing | 4s | ease-in-out | ∞ | ✅ exact |
| Visor pulse | — | — | — | ❌ absent (spec'd new above) |
| Equip bounce | 0.8s | ease-out | once | ⚠️ brief said 1.5s |
| Equip happy-face hold | 1.5s | 0.15s fade | once | ✅ (the "1.5s") |
| Colour surge | 0.4s (0.15s in) | ease-out | once | — |
| Blink | 150ms every 5–8s | 0.08s | ∞ random | — |
| ruleAdd bounce | 0.4s | ease-out | once | — |
| ruleRemove shake | 0.3s | ease-out | once | — |
| Colour flash | 800ms | 0.8s ease | once | — |
