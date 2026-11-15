// src/components/Research/Sheet/rankingsRead.js
//
// ONE read of the platform's rankings document, indexIntelligence/stockRankings
// (the Ranks tab's own read, CompeteTab.jsx) — MOVED out of useSheetView.js
// unchanged so the research sheet and Battle Research (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md §10) read it through one
// function. Resolves the document's data, or null when it does not exist; a
// failed read rejects (each caller keeps its own catch).

/** One read of the rankings doc. */
export async function readRankings() {
  const [{ db }, fs] = await Promise.all([import('../../../firebase/config'), import('firebase/firestore')]);
  const snap = await fs.getDoc(fs.doc(db, 'indexIntelligence', 'stockRankings'));
  return snap.exists() ? snap.data() : null;
}
