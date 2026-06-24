// src/components/League/battleArena/arenaLayout.js
//
// League Battle View V2 — the desktop arena's fixed design geometry. Kept in a
// constants-only module so ArenaDesktop stays component-only (a clean
// react-refresh boundary) and the entry can size its scale-to-fit stage from the
// same numbers.

export const AD_W = 1360; // the stage width the arena is composed at
export const AD_H = 800;  // the stage height (top strip + hero + dock + padding)
export const HERO_W = 1316;
export const HERO_H = 420;
export const DOCK_H = 288;
