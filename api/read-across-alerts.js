// api/read-across-alerts.js
// GET endpoint — returns active Read-Across alerts (last 24 hours)
// Reads from /tmp/read-across-alerts.json, prunes expired, returns array.

import { applySecurityMiddleware } from './_utils/security.js';
import { readFileSync } from 'fs';

const LOG = '[ReadAcrossAlerts]';
const ALERTS_PATH = '/tmp/read-across-alerts.json';
const ALERT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export default async function handler(req, res) {
  // Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let alerts = [];

    try {
      const raw = readFileSync(ALERTS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        alerts = parsed;
      }
    } catch {
      // File doesn't exist or is corrupt — return empty
    }

    // Prune expired alerts (>24h)
    const now = Date.now();
    alerts = alerts.filter(a => now - a.timestamp < ALERT_TTL_MS);

    return res.status(200).json({
      success: true,
      alerts,
      count: alerts.length,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`${LOG} Error:`, error.message);
    return res.status(200).json({
      success: true,
      alerts: [],
      count: 0,
      retrievedAt: new Date().toISOString(),
    });
  }
}
