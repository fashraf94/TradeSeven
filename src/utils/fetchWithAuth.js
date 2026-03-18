// src/utils/fetchWithAuth.js
// Fetch wrapper that auto-attaches Firebase ID token for authenticated API calls.

import { getIdToken } from '../firebase/authService';

/**
 * fetchWithAuth(url, options) — fetch wrapper that auto-attaches Firebase ID token
 *
 * Falls back to unauthenticated request if no user is logged in
 * (server will reject with 401 if endpoint requires auth)
 */
export async function fetchWithAuth(url, options = {}) {
  const token = await getIdToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
