import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export async function getCustomWatchlist(uid) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  return userDoc.data()?.customWatchlist || [];
}

export async function addToWatchlist(uid, symbol) {
  await updateDoc(doc(db, 'users', uid), {
    customWatchlist: arrayUnion(symbol),
  });
}

export async function removeFromWatchlist(uid, symbol) {
  await updateDoc(doc(db, 'users', uid), {
    customWatchlist: arrayRemove(symbol),
  });
}

export async function setWatchlist(uid, symbols) {
  await updateDoc(doc(db, 'users', uid), {
    customWatchlist: symbols.slice(0, 30),
  });
}
