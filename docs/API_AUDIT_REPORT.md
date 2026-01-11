# MarketClash API Security & Architecture Audit Report

**Generated:** 2026-01-11
**Phase 1: Discovery & Audit**

---

## 1. API Architecture Summary

### 1.1 Serverless API Endpoints (/api/)

| Endpoint | Purpose | External API | Method |
|----------|---------|--------------|--------|
| `/api/ai-advisor.js` | AI-powered market advisor | Anthropic Claude API | POST |
| `/api/crypto/prices.js` | Crypto price data | EODHD | GET |
| `/api/crypto/metrics.js` | Crypto metrics (volatility, momentum) | EODHD | GET |
| `/api/news/stock.js` | Stock-specific news | EODHD | GET |
| `/api/news/market.js` | General market news | EODHD | GET |
| `/api/week-ahead-earnings.js` | Upcoming earnings data | EODHD | GET |
| `/api/week-ahead-events.js` | Economic events calendar | Static data | GET |
| `/api/volatility/thresholds.js` | ATR-based volatility thresholds | EODHD | GET |
| `/api/stocks/prices.js` | Stock prices, historical, technical | EODHD | GET |
| `/api/stocks/earnings.js` | Individual stock earnings | EODHD | GET |
| `/api/stocks/fundamentals.js` | Stock fundamentals & analyst data | EODHD | GET |

### 1.2 Frontend API Service Files

| File | Purpose | External APIs |
|------|---------|---------------|
| `src/services/eodhdAPI.js` | Primary API service (EODHD via proxy) | Uses `/api/` endpoints |
| `src/services/stockAPI.js` | Legacy API service | Finnhub (direct), CoinGecko (via CORS proxy) |

### 1.3 Environment Variables Usage

**Server-side (process.env) - SECURE:**
- `EODHD_API_KEY` - Used in all `/api/` serverless functions
- `CLAUDE_API_KEY` - Used in `/api/ai-advisor.js`

**Client-side (import.meta.env) - Exposed to Browser:**
- `VITE_FINNHUB_API_KEY` - **SECURITY ISSUE** (src/services/stockAPI.js:4)
- `VITE_FIREBASE_*` - Firebase configuration (acceptable for client-side auth)
- `VITE_EODHD_API_KEY` - In .env.example but NOT used in production code

---

## 2. Security Vulnerability Report

### 2.1 Critical Issues

#### CRITICAL: Exposed API Key in Frontend
**File:** `src/services/stockAPI.js:4`
```javascript
const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
```

**Risk:** The Finnhub API key is exposed in the client-side JavaScript bundle. Anyone can extract this key from browser DevTools and use it to make API calls.

**Impact:**
- API quota abuse
- Cost implications if Finnhub charges per call
- Key could be revoked by Finnhub for TOS violations

**Recommendation:** Create a server-side proxy endpoint `/api/stocks/finnhub.js` similar to the EODHD endpoints.

### 2.2 High Priority Issues

#### HIGH: No Authentication on API Endpoints
All `/api/` endpoints have:
- CORS set to `*` (allow all origins)
- No authentication headers required
- No rate limiting implemented

**Files Affected:**
- All 11 files in `/api/` directory

**Example from `api/crypto/prices.js`:**
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
```

**Impact:**
- Anyone can call these endpoints directly
- Potential API quota exhaustion attacks
- No user identification for abuse prevention

**Recommendation:**
1. Implement API key or JWT authentication
2. Add rate limiting (per IP or per user)
3. Restrict CORS to your domain

### 2.3 Medium Priority Issues

#### MEDIUM: CoinGecko Direct API Calls via CORS Proxies
**File:** `src/services/stockAPI.js`

The legacy stockAPI.js uses public CORS proxy services:
```javascript
const CORS_STRATEGIES = [
  (url) => ({ url, needsJsonParse: false }),  // Direct
  (url) => ({ url: `https://corsproxy.io/?...`, needsJsonParse: false }),
  (url) => ({ url: `https://api.allorigins.win/raw?url=...`, needsJsonParse: false }),
  // ...
];
```

**Risk:**
- Public CORS proxies can be unreliable
- Some may log or intercept requests
- Rate limits are unpredictable

**Recommendation:** Create server-side endpoints for all external API calls.

#### MEDIUM: Firebase Security Rules Not Verified
No `firestore.rules` file found in the repository.

**Risk:** Without explicit security rules, Firestore may be:
- Using default rules (may be overly permissive)
- Deployed rules unknown without Firebase Console access

**Recommendation:**
1. Add `firestore.rules` to repository
2. Implement proper read/write rules based on authentication

### 2.4 Low Priority Issues

#### LOW: Console Logging in Production
Multiple files contain `console.log` and `console.warn` statements that may expose sensitive information in browser DevTools.

**Recommendation:** Use a logging utility that strips logs in production.

---

## 3. Current Caching Mechanisms

### 3.1 In-Memory Caches

| Service | Cache Type | Duration | Items Cached |
|---------|------------|----------|--------------|
| `eodhdAPI.js` | Object literal | 60s | Stock/crypto prices |
| `eodhdAPI.js` | Object literal | 5min | News articles |
| `eodhdAPI.js` | Object literal | 24h | Earnings data |
| `stockAPI.js` | Map | 5min | All API responses |
| `storage/cache.js` | APICache class | Configurable | Technical indicators, sector data |

### 3.2 Cache Configuration Details

**eodhdAPI.js:**
```javascript
const priceCache = {
  stocks: {},
  crypto: {},
  lastFetch: { stocks: 0, crypto: 0 },
  CACHE_DURATION: 60000,  // 1 minute
};

const newsCache = {
  market: { data: null, timestamp: 0 },
  stocks: {},
  CACHE_DURATION: 300000,  // 5 minutes
};
```

**storage/cache.js (APICache):**
```javascript
export const CACHE_DURATIONS = {
  PRICES: 30 * 1000,           // 30 seconds
  TECHNICALS: 30 * 60 * 1000,  // 30 minutes
  SECTOR_DATA: 5 * 60 * 1000,  // 5 minutes
  HISTORICAL: 60 * 60 * 1000,  // 1 hour
  NEWS: 10 * 60 * 1000,        // 10 minutes
  THRESHOLDS: 15 * 60 * 1000,  // 15 minutes
};
```

### 3.3 Missing Caching

| Endpoint | Issue | Impact |
|----------|-------|--------|
| `/api/stocks/prices` | No server-side cache | Redundant EODHD calls |
| `/api/crypto/prices` | No server-side cache | Redundant EODHD calls |
| `/api/volatility/thresholds` | No server-side cache | Heavy EODHD usage |

---

## 4. Recommendations Summary

### Immediate Actions (Critical)

1. **Remove VITE_FINNHUB_API_KEY from frontend**
   - Create `/api/stocks/finnhub.js` proxy endpoint
   - Update stockAPI.js to use proxy

2. **Add authentication to API endpoints**
   - Implement Firebase Auth token verification
   - Add rate limiting middleware

### Short-term Actions (High)

3. **Add server-side caching**
   - Use Vercel Edge Config or KV storage
   - Implement cache headers for browser caching

4. **Secure Firestore**
   - Add `firestore.rules` to repository
   - Implement user-based access rules

### Medium-term Actions

5. **Consolidate API services**
   - Remove legacy stockAPI.js
   - Use only eodhdAPI.js with proxy endpoints

6. **Add API monitoring**
   - Track usage per endpoint
   - Set up alerts for abuse patterns

---

## 5. Files Requiring Changes

| File | Change Type | Priority |
|------|-------------|----------|
| `src/services/stockAPI.js` | Remove VITE_FINNHUB_API_KEY | CRITICAL |
| `api/*.js` (all) | Add auth & rate limiting | HIGH |
| `api/*.js` (all) | Add server-side caching | HIGH |
| `firestore.rules` | Create file with security rules | HIGH |
| `src/services/eodhdAPI.js` | Remove CORS proxy fallbacks | MEDIUM |

---

## Appendix: Environment Variables Checklist

### Required in Vercel (Server-side):
- [ ] `EODHD_API_KEY` - EODHD API access
- [ ] `CLAUDE_API_KEY` - Anthropic Claude API

### Required in .env (Client-side):
- [ ] `VITE_FIREBASE_API_KEY`
- [ ] `VITE_FIREBASE_AUTH_DOMAIN`
- [ ] `VITE_FIREBASE_PROJECT_ID`
- [ ] `VITE_FIREBASE_STORAGE_BUCKET`
- [ ] `VITE_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `VITE_FIREBASE_APP_ID`

### Should be REMOVED:
- [ ] `VITE_FINNHUB_API_KEY` - Move to server-side proxy
- [ ] `VITE_EODHD_API_KEY` - Already handled server-side
