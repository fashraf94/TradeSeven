// src/services/watchlistService.js
// Watchlist persistence — uses localStorage (consistent with localStorage auth)

const STORAGE_PREFIX = 'mc_watchlist_';

function getStorageKey(userId) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function getCustomWatchlist(userId) {
  if (!userId) return [];
  try {
    const data = localStorage.getItem(getStorageKey(userId));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addToWatchlist(userId, symbol) {
  if (!userId) return;
  const list = getCustomWatchlist(userId);
  if (list.includes(symbol)) return;
  list.push(symbol);
  localStorage.setItem(getStorageKey(userId), JSON.stringify(list.slice(0, 30)));
}

export function removeFromWatchlist(userId, symbol) {
  if (!userId) return;
  const list = getCustomWatchlist(userId).filter(s => s !== symbol);
  localStorage.setItem(getStorageKey(userId), JSON.stringify(list));
}

export function setWatchlist(userId, symbols) {
  if (!userId) return;
  localStorage.setItem(getStorageKey(userId), JSON.stringify(symbols.slice(0, 30)));
}
