#!/usr/bin/env python3
# _generate.py — provenance tool for the MechSVG asset extraction.
#
# Read-only extraction: this script transcribes the HERO / IDLE render of
# src/components/Forge/MechSVG.jsx into standalone, self-contained .svg files
# (filters inlined, no React, no Framer Motion, no external refs). It does NOT
# import or modify any product file. Every geometry value below is copied
# verbatim from MechSVG.jsx at the citation noted in 00_README.md.
#
# Idle-state resolution (STATES.idle = {opacity:1, glow:true, breathing:true}):
#   strokeColor  = '#E6EDF3'   (state !== 'dormant')
#   activeGlow   = primaryGlow = '#5EEAD4'   (hero default, no prop override)
#   activeVisor  = visorColor  = '#5EEAD4'
#   wire      -> stroke #E6EDF3, fill #0D0E12, stroke-width 2.5
#   accent    -> stroke #5EEAD4, stroke-width 2.5, fill none, round caps/joins
#   accentFill-> fill #5EEAD4, stroke none
# Expression is 'idle', so blink / happy / thinking variants (opacity 0) are
# omitted from the static export and captured in ANIMATION_SPEC.md instead.

import os, math

HERE = os.path.dirname(os.path.abspath(__file__))

# Backdrop is a design-viewing aid ONLY (added so the light #E6EDF3 strokes read
# on their own). It is NOT part of the component. Slightly darker than the mech
# body fill (#0D0E12) so panels read as distinct shapes.
BG = '  <rect x="0" y="0" width="200" height="280" fill="#0B0D11"/>\n'

DEFS = (
    '  <defs>\n'
    '    <filter id="teal-glow" x="-50%" y="-50%" width="200%" height="200%">\n'
    '      <feGaussianBlur stdDeviation="2.5" result="blur"/>\n'
    '      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>\n'
    '    </filter>\n'
    '    <filter id="core-glow" x="-50%" y="-50%" width="200%" height="200%">\n'
    '      <feGaussianBlur stdDeviation="3" result="blur"/>\n'
    '      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>\n'
    '    </filter>\n'
    '  </defs>\n'
)

# ── power-core spokes: [0,60,120,180,240,300]deg, r 5 -> 11 (MechSVG.jsx:351-360) ──
def spokes():
    out = []
    for a in (0, 60, 120, 180, 240, 300):
        r = math.radians(a)
        x1, y1 = math.cos(r) * 5, math.sin(r) * 5
        x2, y2 = math.cos(r) * 11, math.sin(r) * 11
        out.append(
            f'      <line x1="{x1:.3f}" y1="{y1:.3f}" x2="{x2:.3f}" y2="{y2:.3f}" '
            f'stroke="#5EEAD4" stroke-width="0.8" opacity="0.3" stroke-linecap="round"/>'
        )
    return "\n".join(out)

# ── the anatomical groups, idle values inlined (build-vs-archetype note in README) ──
GROUPS = {
"platform": '''  <g id="platform">
    <ellipse cx="100" cy="260" rx="65" ry="8" stroke="#5EEAD4" stroke-width="1.5" stroke-dasharray="6 6" fill="none" opacity="0.5"/>
  </g>''',

"plant-in-boot": '''  <g id="plant-in-boot">
    <path d="M148 260 L163 260 L163 253 L158 253 L158 245 L148 245 Z" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2"/>
    <path d="M153 245 Q153 238 158 235" stroke="#5EEAD4" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M153 241 Q148 239 150 237 Q153 237 153 241" fill="#5EEAD4" stroke="none"/>
    <path d="M156 238 Q161 236 160 233 Q156 234 156 238" fill="#5EEAD4" stroke="none"/>
  </g>''',

"arms": '''  <g id="arms">
    <rect x="45" y="95" width="20" height="12" rx="4" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <rect x="48" y="107" width="14" height="35" rx="6" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <circle cx="55" cy="146" r="6" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <rect x="48" y="152" width="14" height="30" rx="6" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <rect x="50" y="182" width="10" height="6" rx="2" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <path d="M50 188 L45 200 L49 200 L53 188 Z" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2"/>
    <path d="M60 188 L65 200 L61 200 L57 188 Z" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2"/>
    <rect x="135" y="95" width="20" height="12" rx="4" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <rect x="138" y="107" width="14" height="35" rx="6" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <circle cx="145" cy="146" r="6" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <rect x="138" y="152" width="14" height="30" rx="6" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <rect x="140" y="182" width="10" height="6" rx="2" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <path d="M140 188 L135 200 L139 200 L143 188 Z" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2"/>
    <path d="M150 188 L155 200 L151 200 L147 188 Z" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2"/>
  </g>''',

"legs": '''  <g id="legs">
    <rect x="73" y="170" width="10" height="35" rx="4" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <circle cx="78" cy="209" r="6" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <rect x="73" y="215" width="10" height="35" rx="4" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <path d="M65 260 L91 260 L85 248 L71 248 Z" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <rect x="117" y="170" width="10" height="35" rx="4" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <circle cx="122" cy="209" r="6" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <rect x="117" y="215" width="10" height="35" rx="4" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <path d="M109 260 L135 260 L129 248 L115 248 Z" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
  </g>''',

"torso": '''  <g id="torso">
    <rect x="90" y="80" width="20" height="15" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <line x1="93" y1="88" x2="107" y2="88" stroke="#E6EDF3" stroke-width="1.5"/>
    <rect x="65" y="93" width="70" height="68" rx="10" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <rect x="70" y="161" width="60" height="14" rx="4" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <g id="chest-framing" opacity="0.6">
      <path d="M85 110 L80 110 L80 115" stroke="#5EEAD4" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M115 110 L120 110 L120 115" stroke="#5EEAD4" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M80 141 L80 146 L85 146" stroke="#5EEAD4" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M120 141 L120 146 L115 146" stroke="#5EEAD4" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g id="power-core" transform="translate(100, 128)">
      <circle cx="0" cy="0" r="12" fill="none" stroke="#5EEAD4" stroke-width="1.5" opacity="0.4"/>
      <circle cx="0" cy="0" r="8" fill="none" stroke="#5EEAD4" stroke-width="1" opacity="0.6"/>
      <circle cx="0" cy="0" r="4" fill="#5EEAD4" opacity="0.8" filter="url(#core-glow)"/>
      <circle cx="0" cy="0" r="1.5" fill="#FFFFFF" opacity="0.9"/>
__SPOKES__
    </g>
  </g>''',

"head": '''  <g id="head">
    <g id="antenna">
      <line x1="100" y1="22" x2="100" y2="35" stroke="#E6EDF3" stroke-width="1.5"/>
      <circle cx="100" cy="20" r="4" stroke="#5EEAD4" stroke-width="1.2" fill="#5EEAD4" opacity="1" filter="url(#teal-glow)"/>
    </g>
    <rect x="65" y="35" width="70" height="48" rx="14" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <rect x="70" y="44" width="27" height="22" rx="11" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <rect x="103" y="44" width="27" height="22" rx="11" stroke="#E6EDF3" fill="#0D0E12" stroke-width="2.5"/>
    <line x1="97" y1="55" x2="103" y2="55" stroke="#E6EDF3" stroke-width="3"/>
    <g id="eyes">
      <circle cx="83.5" cy="55" r="5" fill="#5EEAD4" filter="url(#teal-glow)" opacity="1"/>
      <circle cx="85" cy="53.5" r="1.5" fill="#FFFFFF" opacity="0.8"/>
      <circle cx="116.5" cy="55" r="5" fill="#5EEAD4" filter="url(#teal-glow)" opacity="1"/>
      <circle cx="118" cy="53.5" r="1.5" fill="#FFFFFF" opacity="0.8"/>
    </g>
    <g id="mouth">
      <path d="M87 72 Q100 77 113 72" stroke="#5EEAD4" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.8"/>
    </g>
  </g>''',
}
GROUPS["torso"] = GROUPS["torso"].replace("__SPOKES__", spokes())

# Layer order matches MechSVG.jsx (platform, then body: plant, arms, legs, torso, head)
ORDER = ["platform", "plant-in-boot", "arms", "legs", "torso", "head"]

SVG_OPEN = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280" '
            'width="280" height="392" fill="none" '
            'stroke-linecap="round" stroke-linejoin="round">\n')

def doc(inner, title):
    return (SVG_OPEN + f'  <title>{title}</title>\n' + DEFS + BG + inner + '\n</svg>\n')

def write(path, text):
    full = os.path.join(HERE, path)
    with open(full, "w") as f:
        f.write(text)
    print("wrote", path)

# 1) full base frame (the ONLY frame — MechSVG has no per-archetype frames)
frame_inner = "\n".join(GROUPS[g] for g in ORDER)
write("frames/mech_base_frame__hero_idle.svg",
      doc(frame_inner, "MechSVG base frame - hero, idle"))

# 2) each anatomical group standalone, in-place (viewBox unchanged so overlaying reconstructs the frame)
for g in ORDER:
    write(f"overlays/overlay_{g}.svg", doc(GROUPS[g], f"MechSVG group - {g}"))

# ── PALETTES ────────────────────────────────────────────────────────────────
INK, INK2, HAIR = "#E6EDF3", "#8B95A5", "#232833"
MONO = 'font-family="ui-monospace, SFMono-Regular, Menlo, monospace"'
SANS = 'font-family="system-ui, -apple-system, Segoe UI, sans-serif"'

# (A) six per-archetype color pairs — archetypeCharacter.js:57-137 (mirror of avatarColors)
ARCH = [
    ("momentum_chaser", "Trend Follower",       "#5eead4", "#a855f7"),
    ("contrarian",      "Contrarian",           "#a855f7", "#ef4444"),
    ("diversifier",     "Diversifier",          "#10b981", "#3b82f6"),
    ("degen",           "Speculator",           "#ef4444", "#f59e0b"),
    ("analyst",         "Fundamental Investor", "#3b82f6", "#5eead4"),
    ("guardian",        "Capital Preserver",    "#3b82f6", "#10b981"),
]

def palette_arch():
    W, rowH, top = 760, 74, 92
    H = top + rowH * len(ARCH) + 24
    defs = ['  <defs>']
    for i, (cid, _, a, b) in enumerate(ARCH):
        defs.append(f'    <linearGradient id="g{i}" x1="0" y1="0" x2="1" y2="0">'
                    f'<stop offset="0%" stop-color="{a}"/><stop offset="100%" stop-color="{b}"/></linearGradient>')
    defs.append('  </defs>')
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" fill="none">',
         f'  <title>Palette A - six per-archetype gradients (Forge Character roster)</title>',
         "\n".join(defs),
         f'  <rect x="0" y="0" width="{W}" height="{H}" fill="#0B0D11"/>',
         f'  <text x="28" y="40" {SANS} font-size="20" font-weight="700" fill="{INK}">Archetype gradients &#8212; Forge Character roster</text>',
         f'  <text x="28" y="64" {MONO} font-size="11.5" fill="{INK2}">src/data/archetypeCharacter.js:57  &#183;  ARCHETYPE_CHARACTER[*].colors  (mirror of avatarColors)</text>',
         f'  <line x1="28" y1="80" x2="{W-28}" y2="80" stroke="{HAIR}"/>']
    for i, (cid, disp, a, b) in enumerate(ARCH):
        y = top + i * rowH
        s += [
            f'  <rect x="28" y="{y}" width="150" height="52" rx="8" fill="url(#g{i})"/>',
            f'  <rect x="188" y="{y}" width="52" height="52" rx="8" fill="{a}"/>',
            f'  <rect x="248" y="{y}" width="52" height="52" rx="8" fill="{b}"/>',
            f'  <text x="320" y="{y+21}" {SANS} font-size="16" font-weight="600" fill="{INK}">{disp}</text>',
            f'  <text x="320" y="{y+40}" {MONO} font-size="12" fill="{INK2}">{cid}</text>',
            f'  <text x="{W-28}" y="{y+21}" text-anchor="end" {MONO} font-size="13" fill="{a}">{a}</text>',
            f'  <text x="{W-28}" y="{y+40}" text-anchor="end" {MONO} font-size="13" fill="{b}">{b}</text>',
        ]
    s.append('</svg>')
    return "\n".join(s) + "\n"

# (B) CATEGORY_COLORS (RuleDetailSheet.jsx:8-16 / ForgeRuleCard.jsx:7-15) + the mech's
#     real color engine (getMechColors.js DNA_COLORS + STANDBY). MECH_BAY_TOKENS: not found.
CATEGORY = [
    ("technical", "#5eead4"), ("fundamental", "#f59e0b"), ("risk", "#ef4444"),
    ("allocation", "#8b5cf6"), ("mid_battle", "#6366F1"), ("game_state", "#94A3B8"),
    ("threshold", "#e879f9"), ("tier_strategy", "#fbbf24"),
]
DNA = [("instincts", "#5EEAD4"), ("strategy", "#F59E0B"), ("discipline", "#EF4444")]
STANDBY = [("primaryGlow", "#718096"), ("visorColor", "#4A5568")]

def chip_row(s, items, x0, y, W):
    cw, gap = 128, 12
    per = max(1, (W - 56) // (cw + gap))
    for j, (name, hexv) in enumerate(items):
        cx = x0 + (j % per) * (cw + gap)
        cy = y + (j // per) * 62
        s += [
            f'  <rect x="{cx}" y="{cy}" width="{cw}" height="52" rx="8" fill="#15171E" stroke="{HAIR}"/>',
            f'  <rect x="{cx+10}" y="{cy+10}" width="32" height="32" rx="6" fill="{hexv}"/>',
            f'  <text x="{cx+50}" y="{cy+24}" {SANS} font-size="12.5" font-weight="600" fill="{INK}">{name}</text>',
            f'  <text x="{cx+50}" y="{cy+40}" {MONO} font-size="11" fill="{INK2}">{hexv}</text>',
        ]
    rows = (len(items) + per - 1) // per
    return s, y + rows * 62

def palette_cat():
    W = 820
    s = [f'  <rect x="0" y="0" width="{W}" height="__H__" fill="#0B0D11"/>',
         f'  <text x="28" y="40" {SANS} font-size="20" font-weight="700" fill="{INK}">CATEGORY_COLORS  &amp;  mech color engine</text>',
         f'  <text x="28" y="63" {MONO} font-size="11.5" fill="{INK2}">MECH_BAY_TOKENS: not found in repo (0 matches). Mech color is derived, not tokenized.</text>']
    y = 88
    s += [f'  <text x="28" y="{y}" {MONO} font-size="12" letter-spacing="0.08em" fill="{INK2}">CATEGORY_COLORS &#183; RuleDetailSheet.jsx:8 / ForgeRuleCard.jsx:7 (rule categories)</text>']
    s, y = chip_row(s, CATEGORY, 28, y + 12, W)
    y += 22
    s += [f'  <line x1="28" y1="{y}" x2="{W-28}" y2="{y}" stroke="{HAIR}"/>']
    y += 24
    s += [f'  <text x="28" y="{y}" {MONO} font-size="12" letter-spacing="0.08em" fill="{INK2}">DNA_COLORS &#183; getMechColors.js:8 (drives primaryGlow / visorColor of the ONE mech)</text>']
    s, y = chip_row(s, DNA, 28, y + 12, W)
    y += 22
    s += [f'  <text x="28" y="{y}" {MONO} font-size="12" letter-spacing="0.08em" fill="{INK2}">STANDBY &#183; getMechColors.js:14 (no DNA equipped &#8594; grey mech)</text>']
    s, y = chip_row(s, STANDBY, 28, y + 12, W)
    H = y + 28
    head = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" fill="none">\n  <title>Palette B - CATEGORY_COLORS and mech color engine</title>\n'
    return head + "\n".join(s).replace("__H__", str(H)) + "\n</svg>\n"

write("palettes/palette_A_archetype_gradients.svg", palette_arch())
write("palettes/palette_B_category_and_mech_colors.svg", palette_cat())
print("done")
