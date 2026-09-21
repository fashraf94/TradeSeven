// api/_utils/tickCapture/captureWriter.js
//
// Tick capture — document composition and the one atomic batch (spec V1.3 §3,
// rulings C-1, C-3, C-4, C-9).
//
// TWO DOCUMENTS, ONE BATCH (C-1). `agentBattles/{battleId}/ticks/{tickId}` is
// permanent and holds no free text; `agentBattles/{battleId}/tickBodies/{tickId}`
// holds ALL text and carries `expireAt = capturedAt + 120 days` for a Firestore
// TTL policy to delete whole (C-4, founder-approved Sep 21 2026). Both are
// written in ONE `db.batch()` commit, so a tick is either captured (both exist)
// or missing — never half-written.
//
// NOTHING HERE THROWS, and nothing here alters the tick. The finalizer returns
// a disposition; the caller logs it. A capture that skips, times out or fails
// leaves the tick's own results and writes exactly as they were.
//
// THE TIMEOUT IS `unknown`, NOT `failed` (Phase 0's explicit warning: "a
// Promise race by itself does not cancel a database write that may commit
// after the timeout"). `timed_out` therefore means the export must look:
// scripts/export-tick-capture.js resolves it by checking whether the document
// landed. Nothing writes a second document to report a failed first one.

import { createHash } from 'node:crypto';
import {
  TICKS_SUBCOLLECTION, TICK_BODIES_SUBCOLLECTION, TICK_CAPTURE_SCHEMA_VERSION,
  TICK_CAPTURE_DEADLINE_MS, TICK_CAPTURE_MIN_REMAINING_BUDGET_MS,
  TICK_CAPTURE_TEXT_FIELD_MAX_BYTES, TICK_CAPTURE_BODY_DOC_MAX_BYTES,
  TICK_CAPTURE_BODY_RETENTION_DAYS, CHECK_NAMES,
} from './captureConfig.js';
import { buildUniverse, sanitizePermanentDocument, findFreeText } from './captureSerializer.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

export const utf8Length = (s) => (typeof s === 'string' ? encoder.encode(s).length : 0);

export function sha256Hex(s) {
  return createHash('sha256').update(typeof s === 'string' ? s : '', 'utf8').digest('hex');
}

/**
 * F9 (Astra round 1) — the digest of the RECEIVED BYTES.
 *
 * `.text()` decodes before anything can hash it, and decoding is lossy in ways
 * that matter here: a UTF-8 BOM is stripped, and invalid sequences become
 * U+FFFD. A digest taken after that describes a string the wire never carried,
 * so it cannot be used to prove what arrived. The observer now reads the clone
 * as bytes, hashes those, and decodes only for STORAGE.
 */
export function sha256Bytes(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? 0);
  return createHash('sha256').update(view).digest('hex');
}

/** Cut a string at a byte budget without splitting a code point. */
export function truncateUtf8(s, maxBytes) {
  if (typeof s !== 'string') return s;
  const bytes = encoder.encode(s);
  if (bytes.length <= maxBytes) return s;
  let end = maxBytes;
  // Back off to a code-point boundary (continuation bytes are 0b10xxxxxx).
  while (end > 0 && (bytes[end] & 0b1100_0000) === 0b1000_0000) end--;
  return decoder.decode(bytes.subarray(0, end));
}

/** Race a promise against a timer; the timer is always cleared. */
export function withDeadline(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => { if (timer) clearTimeout(timer); });
}

/** Approximate serialized size of a plain value — enough to police a budget. */
export function approxBytes(value) {
  try { return utf8Length(JSON.stringify(value) ?? ''); } catch { return 0; }
}

/**
 * Resolve the Stage B HTTP body holder into flat facts. Never throws; an absent
 * or failed copy is RECORDED (`copy_failed`), never reconstructed from the
 * parsed object.
 */
export async function resolveBodyHolder(holder, { deadlineMs = TICK_CAPTURE_DEADLINE_MS, deadlineAt = null } = {}) {
  const remaining = () => (deadlineAt === null ? deadlineMs : Math.max(0, deadlineAt - Date.now()));
  const empty = {
    dispatched: false,
    request: { body: null, bytes: null, sha256: null, truncated: false },
    response: { body: null, bytes: null, sha256: null, truncated: false, status: null, returnedModel: null },
    copyError: null,
  };
  if (!holder || holder.dispatched !== true) return empty;

  const out = { ...empty, dispatched: true };
  const reqBody = typeof holder.requestBody === 'string' ? holder.requestBody : null;
  if (reqBody !== null) {
    // The request body is a string the SDK itself built (JSON.stringify), so
    // its UTF-8 encoding IS the dispatched bytes — encoding it back is exact.
    out.request = { body: reqBody, bytes: utf8Length(reqBody), sha256: sha256Bytes(encoder.encode(reqBody)), truncated: false };
  } else {
    out.copyError = holder.requestError ? String(holder.requestError).slice(0, 200) : 'request_body_absent';
  }

  out.response.status = Number.isFinite(holder.status) ? holder.status : null;
  if (holder.responseTextPromise) {
    let settled = null;
    try {
      settled = await withDeadline(holder.responseTextPromise, remaining(), 'tick_capture_body_copy');
    } catch (err) {
      settled = { ok: false, error: String(err?.message || err) };
    }
    if (settled && settled.ok === true && typeof settled.text === 'string') {
      const text = settled.text;
      out.response.body = text;
      // BYTES, not the decoded string (F9). `settled.bytes` is what the clone
      // actually yielded; the encode fallback covers a holder built by a test
      // double that carries text only.
      const bytes = settled.bytes instanceof Uint8Array ? settled.bytes : encoder.encode(text);
      out.response.bytes = bytes.length;
      out.response.sha256 = sha256Bytes(bytes);
      // Derived from OUR OWN copied bytes, never from the SDK's parsed object.
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed.model === 'string') out.response.returnedModel = parsed.model;
      } catch { /* a malformed body is still captured; it just names no model */ }
    } else {
      out.copyError = out.copyError || String(settled?.error || 'response_copy_failed').slice(0, 200);
    }
  } else if (holder.responseError) {
    out.copyError = out.copyError || String(holder.responseError).slice(0, 200);
  } else {
    out.copyError = out.copyError || 'response_body_absent';
  }
  return out;
}

/** The declared default for every C-6 check the tick never reached. */
function defaultChecks(recorded) {
  const out = {};
  for (const name of CHECK_NAMES) {
    out[name] = recorded[name] || { status: 'not_evaluated', result: null, stage: null, symbolOut: null, symbolIn: null, reason: null };
  }
  return out;
}

const iso = (v) => (typeof v === 'string' && v ? v : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Compose both documents from a finalized context. Pure: no clock beyond the
 * `nowMs` it is handed, no Firestore, no flag read.
 *
 * @returns {{permanent: object, body: object, universeSize: number, rejected: Array}}
 */
export function buildCaptureDocuments(state, {
  nowMs = Date.now(),
  bodyFacts,
  captureMs = 0,
  remainingBudgetMs = null,
  // G6 (Astra round 2): the cap is an explicit bound of the composer, so the
  // boundary can be placed precisely by a test instead of guessed at.
  maxDocBytes = TICK_CAPTURE_BODY_DOC_MAX_BYTES,
  // G4 (Astra round 2): the in-document timing is stamped AFTER the documents
  // exist and BEFORE the final measurement — it could not previously include
  // the serialization it was supposed to describe.
  timingAtComposition = null,
} = {}) {
  const capturedAt = new Date(nowMs).toISOString();
  const expireAt = new Date(nowMs + TICK_CAPTURE_BODY_RETENTION_DAYS * 86_400_000);
  const universe = buildUniverse(state.universeSets);

  // ---- the body: ALL text, under the TTL ----------------------------------
  const body = {
    schemaVersion: TICK_CAPTURE_SCHEMA_VERSION,
    tickId: state.tickId,
    battleId: state.battleId,
    tickSeq: state.tickSeq,
    evalId: state.evalId,
    capturedAt,
    expireAt,
    request: { ...bodyFacts.request },
    response: { ...bodyFacts.response },
    copyError: bodyFacts.copyError,
    // The model's proposal EXACTLY as returned, copied before the deterministic
    // layer could replace it, and what the tick finally acted on.
    originalToolResult: state.originalTool,
    finalToolResult: state.finalTool,
    // The controls AS RENDERED — directive text, lean text, rule text. This is
    // a copy of what the model already received (C-3 rule 2), not new exposure.
    controlsAsRendered: state.controlTexts,
    // NAMED FOR WHAT IT IS (F4): the source templates, which the fenced
    // assembler sanitizes and — for SX-04 — rewrites before rendering. They are
    // kept because forensics wants them; they never claim to be the fragment
    // the model saw. The request body is the authority on that.
    controlSourceText: state.controlSourceTexts,
    faults: {
      model: state.modelFaultMessage,
      guardrail: state.guardrailFaultMessage,
      capture: state.faulted,
    },
    validationErrors: state.validationErrorTexts,
    rejectedFields: [],
  };

  // ---- the permanent record: ids, enums, numbers, symbols, timestamps, hashes
  const composed = {
    schemaVersion: TICK_CAPTURE_SCHEMA_VERSION,
    tickId: state.tickId,
    battleId: state.battleId,
    tickSeq: state.tickSeq,
    evalId: state.evalId,
    agentId: state.agentId,
    ownerId: state.ownerId,
    gameMode: state.gameMode,
    day: state.day,
    battlePhase: state.battlePhase,
    capturedAt,
    stageReached: state.stageReached,
    exitReason: state.exitReason,
    universeSize: universe.size,

    model: {
      outcome: state.modelFacts.outcome,
      failureClass: state.modelFacts.failureClass,
      invalidField: state.modelFacts.invalidField ?? null,
      timeoutKind: state.modelFacts.timeoutKind ?? null,
      attempted: state.modelFacts.attempted === true,
      dispatched: state.modelFacts.dispatched === true,
    },
    guardrail: {
      faultClass: state.guardrailFacts.faultClass ?? null,
      sourceNote: state.guardrailFacts.sourceNote ?? null,
      overrideCount: num(state.guardrailFacts.overrideCount),
      evaluated: state.guardrailFacts.evaluated === true,
      deployedCount: num(state.guardrailFacts.deployedCount),
      suppressionPassRan: state.guardrailFacts.suppressionPassRan === true,
      suppressionPassFaulted: state.guardrailFacts.suppressionPassFaulted === true,
    },
    checks: defaultChecks(state.checks),
    // C-7 (F5): the per-symbol risk verdicts and the guardrail evaluation the
    // tick ACTUALLY computed. Allowlisted: an action and a reason id per
    // symbol, nothing free-text.
    risk: {
      verdicts: state.riskFacts.verdicts ?? {},
      lockedCount: num(state.riskFacts.lockedCount),
      forcedExitCount: num(state.riskFacts.forcedExitCount),
      evaluatedCount: num(state.riskFacts.evaluatedCount),
    },
    decision: {
      // The ORIGINAL proposal's three fields, read by NAME off the copy taken
      // before the deterministic layer could replace it — never a spread of
      // the tool result, and never the synthesized final object. Each still
      // passes the serializer's enum/symbol admission below, so model free
      // text in a `decision` field cannot land on the permanent record.
      original: state.decisionFacts.original ?? (state.originalTool?.decision ?? null),
      final: state.decisionFacts.final ?? null,
      originalSymbolOut: state.decisionFacts.originalSymbolOut ?? (state.originalTool?.symbolOut ?? null),
      originalSymbolIn: state.decisionFacts.originalSymbolIn ?? (state.originalTool?.symbolIn ?? null),
      finalSymbolOut: state.decisionFacts.finalSymbolOut ?? null,
      finalSymbolIn: state.decisionFacts.finalSymbolIn ?? null,
      conviction: num(state.decisionFacts.conviction),
      tier: state.decisionFacts.tier ?? null,
      holdKind: state.decisionFacts.holdKind ?? null,
      downgraded: state.decisionFacts.downgraded === true,
      validationErrorCount: state.validationErrorTexts.length,
      replacedByDeterministic: state.decisionFacts.replacedByDeterministic === true,
    },
    actions: state.actions,
    controls: {
      rendered: state.controlFacts.rendered ?? 'not_rendered',
      suppressedControlCount: num(state.controlFacts.suppressedControlCount),
      activeRuleRendered: state.controlFacts.activeRuleRendered ?? null,
      directiveThreadId: state.controlFacts.directiveThreadId ?? null,
      directiveAdjustmentId: state.controlFacts.directiveAdjustmentId ?? null,
      directiveCanonicalTextVersion: num(state.controlFacts.directiveCanonicalTextVersion),
      directiveTextHash: state.controlFacts.directiveTextHash ?? null,
      directiveSuppressed: state.controlFacts.directiveSuppressed ?? null,
      standingLeanIds: state.controlFacts.standingLeanIds ?? [],
      standingLeanVersions: state.controlFacts.standingLeanVersions ?? [],
      standingLeanTextHashes: state.controlFacts.standingLeanTextHashes ?? [],
      activeRuleIds: state.controlFacts.activeRuleIds ?? [],
      activeRuleTextHashes: state.controlFacts.activeRuleTextHashes ?? [],
      equippedConfigHash: state.controlFacts.equippedConfigHash ?? null,
      controlEpoch: num(state.controlFacts.controlEpoch),
    },
    manifest: {
      evidenceKeys: state.manifestFacts.evidenceKeys ?? [],
      vintages: state.manifestFacts.vintages ?? {},
      vintageLabels: state.manifestFacts.vintageLabels ?? {},
      notRenderedFields: state.manifestFacts.notRenderedFields ?? [],
    },
    callEnvelope: {
      requestedModel: state.envelope.requestedModel ?? null,
      returnedModel: bodyFacts.response.returnedModel ?? null,
      temperature: num(state.envelope.temperature),
      maxOutputTokens: num(state.envelope.maxOutputTokens),
      inputTokens: num(state.envelope.inputTokens),
      outputTokens: num(state.envelope.outputTokens),
      buildMs: num(state.envelope.buildMs),
      callMs: num(state.envelope.callMs),
      httpStatus: num(bodyFacts.response.status),
      promptBuiltAt: iso(state.envelope.promptBuiltAt),
    },
    body: {
      status: 'skipped',
      incomplete: null,
      requestSha256: bodyFacts.request.sha256,
      responseSha256: bodyFacts.response.sha256,
      requestBytes: num(bodyFacts.request.bytes),
      responseBytes: num(bodyFacts.response.bytes),
      expireAt: expireAt.toISOString(),
    },
    scores: {
      active: num(state.scoreFields?.active),
      banked: num(state.scoreFields?.banked),
      total: num(state.scoreFields?.total),
      opponent: num(state.scoreFields?.opponent),
      bankedBadgePoints: num(state.scoreFields?.bankedBadgePoints),
    },
    capture: {
      // NAMED FOR WHAT IT MEASURES (Astra round 1, F7). This number is written
      // INSIDE the document being committed, so it structurally cannot include
      // its own commit. Calling it the tick's capture overhead was wrong: the
      // TOTAL — body resolution + serialization + commit — is returned to the
      // caller and logged there, and that is what the flip decision reads.
      preCommitMs: num(captureMs) ?? 0,
      deadlineMs: TICK_CAPTURE_DEADLINE_MS,
      minRemainingBudgetMs: TICK_CAPTURE_MIN_REMAINING_BUDGET_MS,
      remainingBudgetMs: num(remainingBudgetMs),
      // A document that EXISTS was written by a tick that completed
      // serialization and handed the batch to Firestore. Coverage is measured
      // by presence against the persisted counter, never by this field.
      disposition: 'written',
      rejectedFieldCount: 0,
    },
  };

  // ---- the size cap (spec §3, Astra round 1 F8) --------------------------
  // EVERY text-bearing field is bounded, not only the two HTTP bodies: a
  // control block, a fault message or a validation list can each be arbitrarily
  // long, and the old cap left all three unbounded and then returned without
  // re-checking the document it had just "fixed".
  const truncatedParts = [];
  const shedFields = [];

  const boundText = (value) => {
    if (typeof value !== 'string') return value;
    if (utf8Length(value) <= TICK_CAPTURE_TEXT_FIELD_MAX_BYTES) return value;
    return truncateUtf8(value, TICK_CAPTURE_TEXT_FIELD_MAX_BYTES);
  };
  const boundField = (owner, key, label) => {
    const before = owner[key];
    if (typeof before === 'string') {
      const after = boundText(before);
      if (after !== before) { owner[key] = after; shedFields.push(label); }
      return;
    }
    if (Array.isArray(before)) {
      let changed = false;
      owner[key] = before.map((v) => {
        const after = boundText(v);
        if (after !== v) changed = true;
        return after;
      });
      if (changed) shedFields.push(label);
    }
  };

  for (const part of ['request', 'response']) {
    const text = body[part].body;
    if (typeof text !== 'string') continue;
    if (utf8Length(text) > TICK_CAPTURE_TEXT_FIELD_MAX_BYTES) {
      body[part].body = truncateUtf8(text, TICK_CAPTURE_TEXT_FIELD_MAX_BYTES);
      body[part].truncated = true;
      truncatedParts.push(part);
    }
  }
  // The digests and byte counts above are of the ORIGINAL bytes and stay that
  // way: a truncated copy must never claim the whole body's hash.

  for (const key of Object.keys(body.controlsAsRendered ?? {})) boundField(body.controlsAsRendered, key, `controlsAsRendered.${key}`);
  for (const key of Object.keys(body.controlSourceText ?? {})) boundField(body.controlSourceText, key, `controlSourceText.${key}`);
  for (const key of Object.keys(body.faults ?? {})) boundField(body.faults, key, `faults.${key}`);
  boundField(body, 'validationErrors', 'validationErrors');

  // ---- C-3: nothing the serializer cannot classify reaches the record ------
  const { doc: permanent, rejected } = sanitizePermanentDocument(composed, { universe });
  if (rejected.length) {
    body.rejectedFields = rejected.map((r) => ({
      path: r.path,
      reason: r.reason,
      // The value travels as TEXT, in the TTL document, where text belongs.
      value: typeof r.value === 'string' ? r.value : JSON.stringify(r.value ?? null),
    }));
    permanent.capture.rejectedFieldCount = rejected.length;
  }

  // ---- body status ---------------------------------------------------------
  if (!bodyFacts.dispatched) {
    permanent.body.status = 'skipped';
  } else if (bodyFacts.request.body === null || bodyFacts.response.body === null) {
    permanent.body.status = 'copy_failed';
    permanent.body.incomplete = 'copy_failed';
  } else if (truncatedParts.length) {
    permanent.body.status = 'truncated';
    permanent.body.incomplete = truncatedParts.length === 2 ? 'both_truncated' : `${truncatedParts[0]}_truncated`;
  } else {
    permanent.body.status = 'written';
  }

  // ---- the timing stamp, then the FINAL measurement (G4 / G6) -------------
  // Everything that can grow either document is now on it: the capped fields,
  // the C-3 rejections, the body status — and, below, the shed metadata. The
  // size check has to come after ALL of that, because `shedFields` and
  // `bodyIncomplete` are themselves bytes, and appending them after the last
  // measurement is how a body inside the cap crossed it and was batched anyway.
  if (typeof timingAtComposition === 'function') {
    try {
      const timing = timingAtComposition() || {};
      permanent.capture.preCommitMs = num(timing.preCommitMs) ?? permanent.capture.preCommitMs;
      permanent.capture.bodyMs = num(timing.bodyMs) ?? null;
    } catch { /* timing is an observation; it can never cost the record */ }
  }

  const SHED_ORDER = [
    ['rejectedFields', () => { body.rejectedFields = []; }],
    ['controlSourceText', () => { body.controlSourceText = {}; }],
    ['originalToolResult', () => { body.originalToolResult = null; }],
    ['finalToolResult', () => { body.finalToolResult = null; }],
    ['controlsAsRendered', () => { body.controlsAsRendered = {}; }],
    ['validationErrors', () => { body.validationErrors = []; }],
    ['response.body', () => { if (typeof body.response.body === 'string') { body.response.body = null; body.response.truncated = true; } }],
    ['request.body', () => { if (typeof body.request.body === 'string') { body.request.body = null; body.request.truncated = true; } }],
    ['faults', () => { body.faults = { model: null, guardrail: null, capture: null }; }],
  ];

  /** Write the shed metadata, then measure the document WITH it. */
  const stampAndMeasure = () => {
    if (shedFields.length) {
      body.shedFields = [...new Set(shedFields)];
      body.bodyIncomplete = permanent.body.incomplete;
    }
    return Math.max(approxBytes(body), approxBytes(permanent));
  };

  if (shedFields.length && permanent.body.incomplete === null) {
    permanent.body.incomplete = 'field_capped';
  }
  if (stampAndMeasure() > maxDocBytes) {
    for (const [label, shed] of SHED_ORDER) {
      shed();
      shedFields.push(label);
      permanent.body.incomplete = 'doc_budget';
      if (permanent.body.status !== 'copy_failed' && permanent.body.status !== 'skipped') {
        permanent.body.status = 'truncated';
      }
      // Re-measured WITH the metadata each step writes, so the loop stops at a
      // size that is actually final.
      if (stampAndMeasure() <= maxDocBytes) break;
    }
  }

  return { permanent, body, universeSize: universe.size, rejected, freeTextPaths: findFreeText(permanent, { universe }) };
}

/**
 * THE BOUNDARY (C-9). Called as the last thing a tick does. Returns a
 * disposition; never throws, never alters the tick.
 *
 * @returns {Promise<{disposition: string, tickId: string|null, ms: number, error?: string}>}
 */
export async function finalizeTickCapture(db, ctx, {
  nowMs = Date.now(),
  remainingBudgetMs = null,
  deadlineMs = TICK_CAPTURE_DEADLINE_MS,
  minRemainingBudgetMs = TICK_CAPTURE_MIN_REMAINING_BUDGET_MS,
} = {}) {
  if (!ctx || ctx.enabled !== true || !ctx.state) return { disposition: 'skipped', tickId: null, ms: 0, totalMs: 0 };
  const state = ctx.state;
  const startedMs = Date.now();
  // ONE ABSOLUTE DEADLINE for the whole operation (Astra round 1, F7). Body
  // resolution, serialization and the commit share it and each gets only what
  // is left. Two independent allowances made the real worst case 2 ×
  // deadlineMs plus unbounded serialization, so the declared three-second
  // bound was not the bound.
  const deadlineAt = startedMs + deadlineMs;
  const remainingDeadline = () => Math.max(0, deadlineAt - Date.now());

  // The budget gate: a skipped capture is a COUNTED gap (the export sees the
  // minted sequence with no document), never a silent one, and it can never
  // alter the tick's own results or writes.
  if (Number.isFinite(remainingBudgetMs) && remainingBudgetMs < minRemainingBudgetMs) {
    return { disposition: 'skipped_budget', tickId: state.tickId, ms: 0, totalMs: 0 };
  }

  let docs;
  let bodyMs = 0;
  let preCommitMs = 0;
  try {
    const bodyStartedMs = Date.now();
    const bodyFacts = await resolveBodyHolder(state.bodyHolder, { deadlineAt });
    bodyMs = Date.now() - bodyStartedMs;
    // Serialization lives inside the shared deadline too: past it the record is
    // abandoned rather than allowed to run on into the tick's own budget.
    if (remainingDeadline() === 0) {
      const spent = Date.now() - startedMs;
      return { disposition: 'timed_out', tickId: state.tickId, ms: spent, totalMs: spent, preCommitMs: spent, bodyMs };
    }
    docs = buildCaptureDocuments(state, {
      nowMs, bodyFacts, remainingBudgetMs,
      // G4: stamped after composition, so the number on the record is the one
      // the caller also reports.
      timingAtComposition: () => {
        preCommitMs = Date.now() - startedMs;
        return { preCommitMs, bodyMs };
      },
    });
    // G4: and CHECKED AGAIN after serialization. Composition is real work; a
    // deadline verified only on the way in was never a bound on it.
    if (remainingDeadline() === 0) {
      const spent = Date.now() - startedMs;
      return { disposition: 'timed_out', tickId: state.tickId, ms: spent, totalMs: spent, preCommitMs, bodyMs };
    }
  } catch (err) {
    const spent = Date.now() - startedMs;
    return { disposition: 'serialize_failed', tickId: state.tickId, ms: spent, totalMs: spent, bodyMs, error: String(err?.message || err).slice(0, 200) };
  }

  try {
    const battleRef = db.collection('agentBattles').doc(state.battleId);
    const batch = db.batch();
    batch.set(battleRef.collection(TICKS_SUBCOLLECTION).doc(state.tickId), docs.permanent);
    batch.set(battleRef.collection(TICK_BODIES_SUBCOLLECTION).doc(state.tickId), docs.body);
    // G4: the allowance is taken IMMEDIATELY BEFORE the commit — building and
    // staging the batch is real work, and an allowance measured before it is
    // already stale when the write is dispatched — and it GATES the call rather
    // than only racing it. Passed as an argument to `withDeadline`,
    // `batch.commit()` was already in flight by the time the deadline could
    // reject it, so a zero allowance still wrote.
    const allowance = remainingDeadline();
    if (allowance === 0) {
      const spent = Date.now() - startedMs;
      return { disposition: 'timed_out', tickId: state.tickId, ms: spent, totalMs: spent, preCommitMs, bodyMs };
    }
    await withDeadline(batch.commit(), allowance, 'tick_capture_commit');
    const totalMs = Date.now() - startedMs;
    return { disposition: 'written', tickId: state.tickId, ms: totalMs, totalMs, preCommitMs, bodyMs };
  } catch (err) {
    const message = String(err?.message || err);
    // A timeout is UNKNOWN, not failed: the race does not cancel a commit that
    // may still land. The export resolves it by looking for the document.
    const disposition = message.includes('tick_capture_commit_timeout') ? 'timed_out' : 'write_failed';
    const totalMs = Date.now() - startedMs;
    return { disposition, tickId: state.tickId, ms: totalMs, totalMs, preCommitMs, bodyMs, error: message.slice(0, 200) };
  }
}
