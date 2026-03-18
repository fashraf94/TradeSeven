// api/_utils/authMiddleware.js
// Server-side Firebase Auth token verification for API endpoints.

import { getFirebaseAuth } from './firebaseAdmin.js';

/**
 * verifyAuthToken(req) — extracts and verifies Firebase ID token
 *
 * @param {Request} req — Vercel serverless request
 * @returns {Promise<{ uid: string, email: string, ... }>} decoded token
 * @throws {Error} if token missing, invalid, or expired
 *
 * Expects header: Authorization: Bearer <idToken>
 */
export async function verifyAuthToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Missing or invalid Authorization header');
    error.statusCode = 401;
    throw error;
  }

  const idToken = authHeader.split('Bearer ')[1];

  if (!idToken || idToken.length < 20) {
    const error = new Error('Invalid token format');
    error.statusCode = 401;
    throw error;
  }

  try {
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (err) {
    const error = new Error('Invalid or expired token');
    error.statusCode = 401;
    error.originalError = err.code;
    throw error;
  }
}

/**
 * requireAuth(req, res) — middleware wrapper for endpoints
 * Returns decoded user or sends 401 and returns null
 *
 * Usage in endpoint:
 *   const user = await requireAuth(req, res);
 *   if (!user) return; // 401 already sent
 */
export async function requireAuth(req, res) {
  try {
    return await verifyAuthToken(req);
  } catch (err) {
    res.status(err.statusCode || 401).json({
      error: 'Authentication required',
      message: err.message
    });
    return null;
  }
}
