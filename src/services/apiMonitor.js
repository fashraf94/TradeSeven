/**
 * API Usage Monitor for MarketClash
 *
 * Tracks all API calls to help identify:
 * - Excessive API usage
 * - Components making redundant calls
 * - Cache effectiveness
 *
 * Enable in console: localStorage.setItem('mc_api_debug', 'true')
 * View report: window.apiMonitor.report()
 */

class APIMonitor {
  constructor() {
    this.calls = [];
    this.sessionStart = Date.now();
    this.enabled = this._checkEnabled();
  }

  _checkEnabled() {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('mc_api_debug') === 'true' ||
           import.meta.env?.DEV === true;
  }

  /**
   * Track an API call
   * @param {string} endpoint - API endpoint called
   * @param {object} params - Parameters sent
   * @param {string} source - Component/function that made the call
   */
  track(endpoint, params = {}, source = 'unknown') {
    if (!this.enabled) return;

    const call = {
      endpoint,
      params,
      source,
      timestamp: Date.now(),
      sessionTime: Date.now() - this.sessionStart,
    };

    this.calls.push(call);

    // Keep last 1000 calls to prevent memory issues
    if (this.calls.length > 1000) {
      this.calls = this.calls.slice(-1000);
    }

    // Log in development
    if (import.meta.env?.DEV) {
      console.log(`[API Call] ${endpoint}`, { params, source });
    }
  }

  /**
   * Get statistics about API usage
   */
  getStats() {
    const now = Date.now();
    const lastMinute = this.calls.filter(c => now - c.timestamp < 60000);
    const last5Minutes = this.calls.filter(c => now - c.timestamp < 300000);
    const lastHour = this.calls.filter(c => now - c.timestamp < 3600000);

    // Group by endpoint
    const byEndpoint = {};
    this.calls.forEach(call => {
      byEndpoint[call.endpoint] = (byEndpoint[call.endpoint] || 0) + 1;
    });

    // Group by source
    const bySource = {};
    this.calls.forEach(call => {
      bySource[call.source] = (bySource[call.source] || 0) + 1;
    });

    // Find potential issues (same endpoint called many times quickly)
    const rapidCalls = this._findRapidCalls();

    return {
      totalCalls: this.calls.length,
      lastMinute: lastMinute.length,
      last5Minutes: last5Minutes.length,
      lastHour: lastHour.length,
      sessionDuration: Math.round((now - this.sessionStart) / 1000 / 60) + ' minutes',
      byEndpoint,
      bySource,
      rapidCalls,
      callsPerMinute: lastHour.length > 0
        ? (lastHour.length / Math.min(60, (now - this.sessionStart) / 60000)).toFixed(1)
        : '0'
    };
  }

  /**
   * Find rapid successive calls to same endpoint (potential bugs)
   */
  _findRapidCalls() {
    const issues = [];
    const windowMs = 5000; // 5 second window
    const threshold = 10; // More than 10 calls in 5 seconds is suspicious

    // Group calls by endpoint within time windows
    const endpointCalls = {};
    this.calls.forEach(call => {
      if (!endpointCalls[call.endpoint]) {
        endpointCalls[call.endpoint] = [];
      }
      endpointCalls[call.endpoint].push(call);
    });

    // Check each endpoint for rapid calls
    Object.entries(endpointCalls).forEach(([endpoint, calls]) => {
      for (let i = 0; i < calls.length; i++) {
        const windowStart = calls[i].timestamp;
        const windowEnd = windowStart + windowMs;
        const callsInWindow = calls.filter(c =>
          c.timestamp >= windowStart && c.timestamp < windowEnd
        );

        if (callsInWindow.length >= threshold) {
          issues.push({
            endpoint,
            count: callsInWindow.length,
            window: '5 seconds',
            sources: [...new Set(callsInWindow.map(c => c.source))],
            timestamp: new Date(windowStart).toISOString()
          });
          // Skip ahead to avoid duplicate reports
          i += callsInWindow.length - 1;
        }
      }
    });

    return issues;
  }

  /**
   * Print a formatted report to console
   */
  report() {
    const stats = this.getStats();

    console.log('\n========================================');
    console.log('   MarketClash API Usage Report');
    console.log('========================================\n');

    console.log(`Session Duration: ${stats.sessionDuration}`);
    console.log(`Total API Calls: ${stats.totalCalls}`);
    console.log(`Calls/Minute (avg): ${stats.callsPerMinute}`);
    console.log('');

    console.log('--- Last Period ---');
    console.log(`Last minute: ${stats.lastMinute} calls`);
    console.log(`Last 5 min:  ${stats.last5Minutes} calls`);
    console.log(`Last hour:   ${stats.lastHour} calls`);
    console.log('');

    console.log('--- By Endpoint ---');
    Object.entries(stats.byEndpoint)
      .sort((a, b) => b[1] - a[1])
      .forEach(([endpoint, count]) => {
        console.log(`  ${endpoint}: ${count}`);
      });
    console.log('');

    console.log('--- By Source ---');
    Object.entries(stats.bySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Top 10
      .forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
      });
    console.log('');

    if (stats.rapidCalls.length > 0) {
      console.log('--- Potential Issues (Rapid Calls) ---');
      stats.rapidCalls.forEach(issue => {
        console.log(`  ${issue.endpoint}: ${issue.count} calls in ${issue.window}`);
        console.log(`    Sources: ${issue.sources.join(', ')}`);
      });
    } else {
      console.log('No rapid call issues detected');
    }

    console.log('\n========================================\n');

    return stats;
  }

  /**
   * Get recent calls for debugging
   */
  getRecentCalls(count = 20) {
    return this.calls.slice(-count).map(call => ({
      endpoint: call.endpoint,
      source: call.source,
      age: Math.round((Date.now() - call.timestamp) / 1000) + 's ago',
      params: call.params
    }));
  }

  /**
   * Enable monitoring
   */
  enable() {
    this.enabled = true;
    localStorage.setItem('mc_api_debug', 'true');
    console.log('API monitoring enabled');
  }

  /**
   * Disable monitoring
   */
  disable() {
    this.enabled = false;
    localStorage.removeItem('mc_api_debug');
    console.log('API monitoring disabled');
  }

  /**
   * Clear recorded calls
   */
  clear() {
    this.calls = [];
    this.sessionStart = Date.now();
    console.log('API monitor cleared');
  }

  /**
   * Export data for analysis
   */
  export() {
    return {
      sessionStart: new Date(this.sessionStart).toISOString(),
      exportTime: new Date().toISOString(),
      stats: this.getStats(),
      calls: this.calls
    };
  }
}

// Singleton instance
export const apiMonitor = new APIMonitor();

// Make available in browser console
if (typeof window !== 'undefined') {
  window.apiMonitor = apiMonitor;
}

export default apiMonitor;
