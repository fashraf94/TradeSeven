# Step 3 — `POST /api/forge/parse-signal` smoke test

## How to run

After Vercel preview deploy of `claude/signal-drop-phase-1-7n4CI`:

```bash
export API_URL='https://<vercel-preview-url>'
export ID_TOKEN='<firebase-id-token-for-test-user>'

# happy path: text drop with explicit ticker
curl -sS -X POST "$API_URL/api/forge/parse-signal" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  --data @scripts/test-results/step-3-smoke/sample-request-text.json \
  | tee scripts/test-results/step-3-smoke/response-text.json

# url drop (URL fetch path; expect urlFetchSucceeded reflected via the parse)
curl -sS -X POST "$API_URL/api/forge/parse-signal" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  --data @scripts/test-results/step-3-smoke/sample-request-url.json \
  | tee scripts/test-results/step-3-smoke/response-url.json

# junk path: should bailout
curl -sS -X POST "$API_URL/api/forge/parse-signal" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  --data @scripts/test-results/step-3-smoke/sample-request-junk.json \
  | tee scripts/test-results/step-3-smoke/response-junk.json

# injection path: should set parse.suspectedInjection=true and not follow override
curl -sS -X POST "$API_URL/api/forge/parse-signal" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  --data @scripts/test-results/step-3-smoke/sample-request-injection.json \
  | tee scripts/test-results/step-3-smoke/response-injection.json

# cache hit: re-run any of the above with the SAME body — second response should have cached: true
```

## Expected response shape

```jsonc
{
  "dropId": "<echo of request dropId>",
  "parse": {
    "extractedText": "<verbatim cleaned content>",
    "topic": "<3-8 word topic>",
    "keyClaim": "<one-sentence thesis candidate>",
    "tickers": ["AAPL", ...],
    "impliedTickers": [...],
    "confidence": 0.0-1.0,
    "contentType": "tweet|news_article|blog_post|research_note|chart|dm_screenshot|casual_text|unknown",
    "signalDirection": "bullish|bearish|neutral|mixed|uncertain",
    "timeHorizon": "intraday|swing|positional|longterm|unspecified",
    "referencedDate": "<date phrase or empty>",
    "dataPoints": [...],
    "suspectedInjection": false  // true on the injection sample
  },
  "validation": {
    "validated": [{ "symbol": "AAPL", "sectorId": "XLK" }, ...],
    "unsupported": [...]
  },
  "shouldBailout": false,         // true on the junk sample
  "shouldHardCheckpoint": false,  // may be true if confidence 0.5–0.6
  "cached": false                 // true on a re-run with the same content
}
```

## Per-sample expectations

| sample          | expected `shouldBailout` | expected `shouldHardCheckpoint` | expected `parse.suspectedInjection` |
|-----------------|--------------------------|---------------------------------|--------------------------------------|
| text (AAPL)     | false                    | false (confidence ≥ 0.6)        | false                                |
| url             | depends on fetch + parse | depends on confidence           | false                                |
| junk (dog)      | true                     | false (because bailout)         | false                                |
| injection       | depends                  | depends                         | **true**                             |

## Side effects to verify

1. **Firestore**: a doc lands at `users/<test-uid>/signalDrops/<dropId>` with `expansion: null`, `outcome: { forkChosen: null }`, and the full parse + validation echo.
2. **Firestore**: a doc lands at `signalDropCache/<contentHash>` with `expiresAt` set ~6h in the future.
3. **GCS shadow log**: a record lands at `gs://fantasytrades/shadow/signal_drops/<YYYY-MM-DD>/<eventId>.jsonl` containing the parse + input.
4. **Cache hit verification**: re-running the same request returns `cached: true` and a NEW drop record at `users/<uid>/signalDrops/<new-dropId>` (different dropId on each call).

## Failure modes the endpoint must handle gracefully

- Missing `Authorization` header → 401
- Missing `dropId` → 400
- Malformed `url` → 400
- `imageBase64` with invalid base64 → 400
- Anthropic API failure → 500 with error message (not a stack trace leak)
- URL fetch timeout → request continues; parse runs with `urlFetchSucceeded=false` marker
