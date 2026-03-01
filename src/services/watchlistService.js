import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

function getAuthUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

export async function getCustomWatchlist() {
  const uid = getAuthUid();
  const userDoc = await getDoc(doc(db, 'users', uid));
  return userDoc.data()?.customWatchlist || [];
}

export async function addToWatchlist(symbol) {
  const uid = getAuthUid();
  await updateDoc(doc(db, 'users', uid), {
    customWatchlist: arrayUnion(symbol),
  });
}

export async function removeFromWatchlist(symbol) {
  const uid = getAuthUid();
  await updateDoc(doc(db, 'users', uid), {
    customWatchlist: arrayRemove(symbol),
  });
}

export async function setWatchlist(symbols) {
  const uid = getAuthUid();
  await updateDoc(doc(db, 'users', uid), {
    customWatchlist: symbols.slice(0, 30),
  });
}
