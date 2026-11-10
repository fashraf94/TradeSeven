// api/_utils/__fixtures__/leagueGroupsDouble.js
//
// The armory flip (Nov 7, 2026) — the `tournamentGroups` collection as the League writers' lock read sees it. With
// PER_GAME_LOADOUT_ENABLED on, change-archetype, equip-watchlist and unequip-watchlist read the League lock inside their
// transaction (api/_utils/perGameLoadout.js readLeagueLockInTx: `where('groupMembers', 'array-contains', uid)`, read
// through `tx.get(query)`), so a writer suite's fake Firestore needs the collection. `groups` are `{ id, ...data }`; the
// default is none: the player between weeks, the League loadout open, so a suite's rows assert what they did before the
// flip. A host suite's transaction double reads it through `ref.get()`, as for a document.

export function leagueGroupsDouble(groups = []) {
  const snap = (docs) => ({ docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) });
  const matches = (data, field, op, value) => (op === 'array-contains'
    ? Array.isArray(data[field]) && data[field].includes(value)
    : data[field] === value);
  return {
    where: (field, op, value) => ({
      get: async () => snap(groups
        .filter(({ id: _id, ...data }) => matches(data, field, op, value))
        .map(({ id, ...data }) => ({ id, data: () => ({ ...data }) }))),
    }),
  };
}
