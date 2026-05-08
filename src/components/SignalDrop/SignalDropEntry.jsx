// src/components/SignalDrop/SignalDropEntry.jsx
//
// Sprint 6 Phase 3A — Entry modal for Signal Drop V2.
//
// User-facing surface where a paste / URL / image is submitted to
// /api/forge/parse-signal. Two visual phases inside a single modal
// shell:
//
//   1. Input phase  — paste textarea, optional URL, optional image
//      upload. CTA gated on at-least-one input.
//   2. Confirm phase — parse summary (topic, tickers, direction,
//      horizon). Bailout case shows a distinct "no actionable
//      signal" surface. Hard-checkpoint case adds a warning banner
//      but keeps the dialogue CTA enabled.
//
// Modal shell mirrors src/components/discover/ThemeDetailModal.jsx
// (framer-motion overlay+card, scroll lock, Esc handler, useTheme
// tokens). Width 640px on desktop per Phase 3 spec; full-screen
// takeover on mobile.
//
// dropId is generated client-side via crypto.randomUUID (with a
// Math.random fallback for the few browsers without it). The same
// id flows into the watchlist-dialogue session in Phase 3B.
//
// In Phase 3A the "Start dialogue" CTA invokes onStartDialogue with
// { parseResult, dropId } — Phase 3A's parent placeholder logs and
// closes; Phase 3B replaces it with the actual WatchlistChat hand-off.

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Upload,
  Camera,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Image as ImageIcon,
  Link2,
  FileText,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import { useIsMobile } from '../../hooks/useIsMobile';

// ── Constants ─────────────────────────────────────────────────────────

const TEXT_MAX = 2000;
const TEXT_WARN_THRESHOLD = 1500;
const URL_MAX = 1000;
const IMAGE_MAX_BYTES = 4 * 1024 * 1024; // 4 MB raw cap
const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const ACCEPTED_LABEL = 'PNG, JPEG, or WEBP';

// ── Helpers ───────────────────────────────────────────────────────────

// crypto.randomUUID is widely supported (Chrome 92+, Safari 15.4+,
// Firefox 95+) but the fallback covers older browsers without
// crashing. RFC4122 v4 shape.
function generateDropId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Resolve a File to a base64 data URL. Validation happens BEFORE
// this is called — we never read a 50MB file into memory just to
// reject it.
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function stripDataUrlPrefix(dataUrl) {
  if (typeof dataUrl !== 'string') return '';
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

function getMimeFromDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return 'image/png';
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  return match ? match[1] : 'image/png';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Direction badge palette. Falls back to a neutral grey for
// "uncertain" / unknown values so the badge never disappears.
function directionStyle(direction, tokens) {
  switch (direction) {
    case 'bullish':
      return { bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.35)', color: tokens.emerald };
    case 'bearish':
      return { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)', color: tokens.red };
    case 'neutral':
      return { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)', color: tokens.amber };
    case 'mixed':
      return { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.35)', color: tokens.purpleText };
    default:
      return { bg: tokens.bgIcon, border: tokens.borderDefault, color: tokens.textMuted };
  }
}

function titleCase(s) {
  if (typeof s !== 'string' || s.length === 0) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Main component ────────────────────────────────────────────────────

export default function SignalDropEntry({ open, onClose, onStartDialogue }) {
  const { tokens } = useTheme();
  const { isDesktop } = useIsMobile();

  const [phase, setPhase] = useState('input'); // 'input' | 'submitting' | 'confirming'
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [dropId, setDropId] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  // Reset state when the modal closes. Defer slightly so the exit
  // animation runs against the populated state instead of an empty
  // form snap.
  useEffect(() => {
    if (open) return undefined;
    const t = setTimeout(() => {
      setPhase('input');
      setText('');
      setUrl('');
      setUrlError(null);
      setImageFile(null);
      setImagePreviewUrl(null);
      setImageError(null);
      setIsDragging(false);
      setParseResult(null);
      setDropId(null);
      setSubmitError(null);
      dragCounterRef.current = 0;
    }, 250);
    return () => clearTimeout(t);
  }, [open]);

  // Body scroll lock + Esc handler. Mirrors ThemeDetailModal.
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(e) {
      if (e.key === 'Escape' && phase !== 'submitting') {
        onClose?.();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, phase]);

  const trimmedText = text.trim();
  const trimmedUrl = url.trim();
  const hasInput = Boolean(trimmedText || trimmedUrl || imageFile);
  const isSubmitting = phase === 'submitting';
  const ctaDisabled = !hasInput || isSubmitting;

  function handleFileSelect(file) {
    if (!file) return;
    setImageError(null);
    if (!ACCEPTED_MIME.includes(file.type)) {
      setImageError(`Unsupported format. Use ${ACCEPTED_LABEL}.`);
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setImageError(`Image is ${formatBytes(file.size)} — max 4 MB.`);
      return;
    }
    // Validation passed → read the bytes. A 50MB image never reaches
    // this branch because we bailed on size above.
    readFileAsDataURL(file)
      .then((dataUrl) => {
        setImageFile(file);
        setImagePreviewUrl(dataUrl);
      })
      .catch(() => {
        setImageError('Could not read this file.');
      });
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }

  function validateUrlOnBlur() {
    if (!trimmedUrl) {
      setUrlError(null);
      return;
    }
    try {
      const u = new URL(trimmedUrl);
      if (!['http:', 'https:'].includes(u.protocol)) {
        setUrlError('Use an http or https URL.');
      } else {
        setUrlError(null);
      }
    } catch {
      setUrlError('That doesn\'t look like a valid URL.');
    }
  }

  // Drag-and-drop counter. We track entries vs. leaves to avoid the
  // dragleave-firing-on-child-elements issue.
  function onDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  }
  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  function onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  }
  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelect(file);
  }

  async function handleSubmit() {
    if (ctaDisabled) return;

    // URL mode requires a passing URL validation. Image and text don't
    // care about URL state.
    if (!imageFile && !trimmedText && trimmedUrl && urlError) return;

    const newDropId = generateDropId();
    setDropId(newDropId);
    setPhase('submitting');
    setSubmitError(null);

    // Priority: image > text > url. parse-signal accepts a single
    // `type`. When the user provides text+URL, the URL is dropped in
    // MVP — Phase 3+ would persist it as attribution metadata, but
    // the API doesn't expose that field today.
    let body;
    if (imageFile && imagePreviewUrl) {
      body = {
        type: 'image',
        imageBase64: stripDataUrlPrefix(imagePreviewUrl),
        imageMime: getMimeFromDataUrl(imagePreviewUrl),
        dropId: newDropId,
      };
    } else if (trimmedText) {
      body = {
        type: 'text',
        text: trimmedText,
        dropId: newDropId,
      };
    } else if (trimmedUrl) {
      body = {
        type: 'url',
        url: trimmedUrl,
        dropId: newDropId,
      };
    } else {
      setPhase('input');
      return;
    }

    try {
      const res = await fetchWithAuth('/api/forge/parse-signal', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = errBody.message || errBody.error || `Request failed (${res.status}).`;
        setSubmitError(msg);
        setPhase('input');
        return;
      }
      const data = await res.json();
      setParseResult(data);
      setPhase('confirming');
    } catch (err) {
      setSubmitError(err?.message || 'Network error. Try again.');
      setPhase('input');
    }
  }

  function handleTryAgain() {
    setParseResult(null);
    setSubmitError(null);
    setPhase('input');
  }

  function handleStartDialogue() {
    if (!parseResult || !dropId) return;
    onStartDialogue?.({ parseResult, dropId });
  }

  // Allow click-outside dismissal on desktop only. Mobile is full-screen
  // with no backdrop, so there's no "outside" to click.
  function handleOverlayClick() {
    if (!isDesktop || isSubmitting) return;
    onClose?.();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="signal-drop-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleOverlayClick}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 250,
            background: isDesktop ? 'rgba(0,0,0,0.75)' : tokens.bgApp,
            backdropFilter: isDesktop ? 'blur(8px)' : 'none',
            WebkitBackdropFilter: isDesktop ? 'blur(8px)' : 'none',
            display: 'flex',
            alignItems: isDesktop ? 'center' : 'stretch',
            justifyContent: 'center',
            padding: isDesktop ? 20 : 0,
          }}
        >
          <motion.div
            key="signal-drop-card"
            initial={{ opacity: 0, scale: 0.97, y: isDesktop ? 12 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: isDesktop ? 12 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signal-drop-title"
            style={{
              width: '100%',
              maxWidth: isDesktop ? 640 : '100%',
              height: isDesktop ? 'auto' : '100%',
              maxHeight: isDesktop ? '85vh' : '100%',
              background: tokens.bgApp,
              borderRadius: isDesktop ? 20 : 0,
              border: isDesktop ? `1px solid ${tokens.borderDefault}` : 'none',
              boxShadow: isDesktop ? '0 25px 60px rgba(0,0,0,0.5)' : 'none',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ModalHeader
              tokens={tokens}
              isDesktop={isDesktop}
              isSubmitting={isSubmitting}
              phase={phase}
              onClose={onClose}
              onBackToInput={phase === 'confirming' ? handleTryAgain : null}
            />

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: isDesktop ? '20px 24px 24px' : '16px 16px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              {phase === 'confirming' && parseResult ? (
                <ConfirmView parseResult={parseResult} tokens={tokens} />
              ) : (
                <InputView
                  tokens={tokens}
                  isDesktop={isDesktop}
                  text={text}
                  setText={setText}
                  url={url}
                  setUrl={setUrl}
                  urlError={urlError}
                  validateUrlOnBlur={validateUrlOnBlur}
                  imageFile={imageFile}
                  imagePreviewUrl={imagePreviewUrl}
                  imageError={imageError}
                  onFileSelect={handleFileSelect}
                  onRemoveImage={handleRemoveImage}
                  isDragging={isDragging}
                  onDragEnter={onDragEnter}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  fileInputRef={fileInputRef}
                  cameraInputRef={cameraInputRef}
                  submitError={submitError}
                  isSubmitting={isSubmitting}
                />
              )}
            </div>

            <ModalFooter
              tokens={tokens}
              phase={phase}
              parseResult={parseResult}
              ctaDisabled={ctaDisabled}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              onTryAgain={handleTryAgain}
              onStartDialogue={handleStartDialogue}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Header ────────────────────────────────────────────────────────────

function ModalHeader({ tokens, isDesktop, isSubmitting, phase, onClose, onBackToInput }) {
  // Mobile uses a back arrow as the dismiss; desktop uses an X. When
  // we're on the confirm view AND on mobile, the back arrow returns to
  // the input phase rather than closing — preserves the user's input.
  const showMobileBack = !isDesktop;
  const mobileBackHandler = showMobileBack && onBackToInput ? onBackToInput : onClose;

  return (
    <div
      style={{
        position: 'relative',
        padding: isDesktop ? '20px 24px 14px' : '14px 16px',
        borderBottom: `1px solid ${tokens.borderDefault}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: tokens.bgApp,
      }}
    >
      {showMobileBack && (
        <button
          type="button"
          aria-label={onBackToInput ? 'Back' : 'Close'}
          onClick={isSubmitting ? undefined : mobileBackHandler}
          disabled={isSubmitting}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: 8,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            color: tokens.textMuted,
            opacity: isSubmitting ? 0.5 : 1,
          }}
        >
          <ArrowLeft size={20} />
        </button>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <h2
          id="signal-drop-title"
          style={{
            margin: 0,
            fontSize: isDesktop ? 20 : 17,
            fontWeight: 700,
            color: tokens.textPrimary,
            lineHeight: 1.25,
          }}
        >
          Drop a Signal
        </h2>
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: tokens.teal,
          }}
        >
          {phase === 'confirming' ? 'Signal Read' : 'Watchlist Workshop'}
        </div>
      </div>

      {isDesktop && (
        <button
          type="button"
          aria-label="Close"
          onClick={isSubmitting ? undefined : onClose}
          disabled={isSubmitting}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: tokens.bgIcon,
            border: 'none',
            borderRadius: '50%',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            color: tokens.textMuted,
            opacity: isSubmitting ? 0.5 : 1,
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

// ── Input view ────────────────────────────────────────────────────────

function InputView(props) {
  const {
    tokens,
    isDesktop,
    text,
    setText,
    url,
    setUrl,
    urlError,
    validateUrlOnBlur,
    imageFile,
    imagePreviewUrl,
    imageError,
    onFileSelect,
    onRemoveImage,
    isDragging,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    fileInputRef,
    cameraInputRef,
    submitError,
    isSubmitting,
  } = props;

  const charCount = text.length;
  const showCharCounter = charCount > TEXT_WARN_THRESHOLD;
  const overLimit = charCount > TEXT_MAX;

  return (
    <>
      {submitError && (
        <ErrorBanner tokens={tokens} kind="error">
          {submitError}
        </ErrorBanner>
      )}

      {/* Paste textarea — primary input */}
      <FieldGroup
        label="Paste the content you want to explore"
        icon={<FileText size={14} />}
        tokens={tokens}
      >
        <div style={{ position: 'relative' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
            placeholder="Tweet, article, news clip, transcript — anything you want to dig into"
            disabled={isSubmitting}
            rows={6}
            style={{
              width: '100%',
              minHeight: 132,
              maxHeight: 264,
              padding: '12px 14px',
              background: tokens.bgCard,
              border: `1px solid ${overLimit ? tokens.red : tokens.borderInput}`,
              borderRadius: 10,
              color: tokens.textPrimary,
              fontSize: 14,
              fontFamily: 'inherit',
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
              opacity: isSubmitting ? 0.6 : 1,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = tokens.teal;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = overLimit
                ? tokens.red
                : tokens.borderInput;
            }}
          />
          {showCharCounter && (
            <div
              style={{
                position: 'absolute',
                right: 10,
                bottom: 8,
                fontSize: 11,
                fontWeight: 500,
                color: overLimit ? tokens.red : tokens.textFaint,
                background: tokens.bgCard,
                padding: '2px 6px',
                borderRadius: 4,
                pointerEvents: 'none',
              }}
            >
              {charCount} / {TEXT_MAX}
            </div>
          )}
        </div>
      </FieldGroup>

      {/* URL field */}
      <FieldGroup
        label="Source URL (optional)"
        icon={<Link2 size={14} />}
        tokens={tokens}
        helper="Adds attribution so you can return to the original."
        error={urlError}
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value.slice(0, URL_MAX))}
          onBlur={validateUrlOnBlur}
          placeholder="https://..."
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: tokens.bgCard,
            border: `1px solid ${urlError ? tokens.red : tokens.borderInput}`,
            borderRadius: 10,
            color: tokens.textPrimary,
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box',
            opacity: isSubmitting ? 0.6 : 1,
          }}
          onFocus={(e) => {
            if (!urlError) e.currentTarget.style.borderColor = tokens.teal;
          }}
        />
      </FieldGroup>

      {/* Image upload */}
      <FieldGroup
        label="Or upload a screenshot"
        icon={<ImageIcon size={14} />}
        tokens={tokens}
        helper={`Drag a file here or pick one. ${ACCEPTED_LABEL}, max 4 MB.`}
        error={imageError}
      >
        {imagePreviewUrl ? (
          <ImagePreview
            tokens={tokens}
            previewUrl={imagePreviewUrl}
            file={imageFile}
            onRemove={onRemoveImage}
            disabled={isSubmitting}
          />
        ) : (
          <DropZone
            tokens={tokens}
            isDesktop={isDesktop}
            isDragging={isDragging}
            disabled={isSubmitting}
            fileInputRef={fileInputRef}
            cameraInputRef={cameraInputRef}
            onFileSelect={onFileSelect}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          />
        )}
      </FieldGroup>
    </>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────

function DropZone({
  tokens,
  isDesktop,
  isDragging,
  disabled,
  fileInputRef,
  cameraInputRef,
  onFileSelect,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const acceptAttr = ACCEPTED_MIME.join(',');

  return (
    <div
      onDragEnter={disabled ? undefined : onDragEnter}
      onDragOver={disabled ? undefined : onDragOver}
      onDragLeave={disabled ? undefined : onDragLeave}
      onDrop={disabled ? undefined : onDrop}
      style={{
        padding: '18px 14px',
        background: isDragging ? `${tokens.teal}14` : tokens.bgCard,
        border: `1px dashed ${isDragging ? tokens.teal : tokens.borderInput}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        transition: 'background 0.15s ease, border-color 0.15s ease',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Upload size={20} color={isDragging ? tokens.teal : tokens.textMuted} />
      <div
        style={{
          fontSize: 12,
          color: tokens.textMuted,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        {isDragging
          ? 'Drop to upload'
          : isDesktop
          ? 'Drag a screenshot here, or'
          : 'Add a screenshot from'}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptAttr}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFileSelect(f);
          }}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          style={pickerButtonStyle(tokens, disabled)}
        >
          <ImageIcon size={14} />
          {isDesktop ? 'Choose file' : 'Choose file'}
        </button>

        {!isDesktop && (
          <>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFileSelect(f);
              }}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled}
              style={pickerButtonStyle(tokens, disabled)}
            >
              <Camera size={14} />
              Take photo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function pickerButtonStyle(tokens, disabled) {
  return {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    background: tokens.bgIcon,
    border: `1px solid ${tokens.borderInput}`,
    borderRadius: 8,
    color: tokens.textSecondary,
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  };
}

// ── Image preview ─────────────────────────────────────────────────────

function ImagePreview({ tokens, previewUrl, file, onRemove, disabled }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        background: tokens.bgCard,
        border: `1px solid ${tokens.borderInput}`,
        borderRadius: 10,
      }}
    >
      <img
        src={previewUrl}
        alt="Upload preview"
        style={{
          width: 56,
          height: 56,
          objectFit: 'cover',
          borderRadius: 6,
          background: tokens.bgIcon,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: tokens.textPrimary,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {file?.name || 'screenshot'}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            color: tokens.textFaint,
          }}
        >
          {file ? formatBytes(file.size) : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove image"
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: tokens.bgIcon,
          border: 'none',
          borderRadius: '50%',
          color: tokens.textMuted,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Field group + error banner ────────────────────────────────────────

function FieldGroup({ label, icon, tokens, helper, error, children }) {
  return (
    <div>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.4px',
          textTransform: 'uppercase',
          color: tokens.textMuted,
          marginBottom: 8,
        }}
      >
        <span style={{ color: tokens.teal, display: 'inline-flex' }}>{icon}</span>
        {label}
      </label>
      {children}
      {(helper || error) && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: error ? tokens.red : tokens.textFaint,
            lineHeight: 1.5,
          }}
        >
          {error || helper}
        </div>
      )}
    </div>
  );
}

function ErrorBanner({ tokens, kind = 'error', children }) {
  const palette =
    kind === 'warn'
      ? { bg: 'rgba(245, 158, 11, 0.10)', border: 'rgba(245, 158, 11, 0.35)', color: tokens.amber, Icon: AlertTriangle }
      : { bg: 'rgba(239, 68, 68, 0.10)', border: 'rgba(239, 68, 68, 0.35)', color: tokens.red, Icon: AlertCircle };
  const { Icon } = palette;
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '10px 12px',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 10,
        color: palette.color,
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      <Icon size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ── Confirm view ──────────────────────────────────────────────────────

function ConfirmView({ parseResult, tokens }) {
  const parse = parseResult?.parse || {};
  const validation = parseResult?.validation || {};
  const validatedSymbols = Array.isArray(validation.validated)
    ? validation.validated.map((v) => v.symbol).filter(Boolean)
    : [];
  const impliedSymbols = Array.isArray(parse.impliedTickers) ? parse.impliedTickers : [];
  const allTickerChips = [
    ...validatedSymbols.map((s) => ({ symbol: s, implied: false })),
    ...impliedSymbols
      .filter((s) => !validatedSymbols.includes(s))
      .map((s) => ({ symbol: s, implied: true })),
  ];

  const topic = (parse.topic || '').trim();
  const direction = parse.signalDirection || null;
  const horizon = parse.timeHorizon && parse.timeHorizon !== 'unspecified' ? parse.timeHorizon : null;
  const dirStyle = directionStyle(direction, tokens);
  const isBailout = Boolean(parseResult.shouldBailout);
  const isCheckpoint = Boolean(parseResult.shouldHardCheckpoint) && !isBailout;

  if (isBailout) {
    return (
      <>
        <ErrorBanner tokens={tokens} kind="warn">
          This signal doesn&apos;t look actionable for a watchlist. Try a piece
          of content with a clearer thesis or specific tickers.
        </ErrorBanner>
        <BailoutSummary parse={parse} tokens={tokens} />
      </>
    );
  }

  return (
    <>
      {isCheckpoint && (
        <ErrorBanner tokens={tokens} kind="warn">
          We have some questions about this content. The dialogue will explore
          them with you.
        </ErrorBanner>
      )}

      <div>
        <SectionLabel tokens={tokens}>Topic</SectionLabel>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: tokens.textPrimary,
            lineHeight: 1.3,
          }}
        >
          {topic || 'Topic not identified'}
        </div>
      </div>

      {(direction || horizon) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {direction && (
            <Badge
              bg={dirStyle.bg}
              border={dirStyle.border}
              color={dirStyle.color}
            >
              {titleCase(direction)}
            </Badge>
          )}
          {horizon && (
            <Badge
              bg={tokens.bgIcon}
              border={tokens.borderDefault}
              color={tokens.textSecondary}
            >
              {titleCase(horizon)}
            </Badge>
          )}
        </div>
      )}

      {allTickerChips.length > 0 && (
        <div>
          <SectionLabel tokens={tokens}>
            Tickers found ({allTickerChips.length})
          </SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allTickerChips.map((t) => (
              <span
                key={t.symbol}
                title={t.implied ? 'Implied ticker' : undefined}
                style={{
                  background: tokens.bgAgent,
                  border: `1px solid ${tokens.borderDefault}`,
                  color: tokens.teal,
                  padding: '4px 9px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  letterSpacing: '0.3px',
                  opacity: t.implied ? 0.75 : 1,
                  fontStyle: t.implied ? 'italic' : 'normal',
                }}
              >
                {t.symbol}
              </span>
            ))}
          </div>
        </div>
      )}

      <SourceAttribution parseResult={parseResult} tokens={tokens} />
    </>
  );
}

function BailoutSummary({ parse, tokens }) {
  const topic = (parse?.topic || '').trim();
  return (
    <div>
      <SectionLabel tokens={tokens}>What we read</SectionLabel>
      <div
        style={{
          fontSize: 14,
          color: tokens.textSecondary,
          lineHeight: 1.5,
        }}
      >
        {topic || 'No clear financial topic detected.'}
      </div>
    </div>
  );
}

function SourceAttribution({ parseResult, tokens }) {
  // The dropId record stores the input shape but not the verbatim
  // values back in the response. Show a minimal "source" affordance
  // based on what the parse contains.
  const parse = parseResult?.parse || {};
  const contentType = parse.contentType || null;
  const referenced = (parse.referencedDate || '').trim();
  if (!contentType && !referenced) return null;
  return (
    <div>
      <SectionLabel tokens={tokens}>Source</SectionLabel>
      <div
        style={{
          fontSize: 12,
          color: tokens.textFaint,
          lineHeight: 1.5,
        }}
      >
        {contentType ? titleCase(contentType.replace(/_/g, ' ')) : ''}
        {contentType && referenced ? ' · ' : ''}
        {referenced ? `Anchored to ${referenced}` : ''}
      </div>
    </div>
  );
}

function SectionLabel({ tokens, children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.6px',
        textTransform: 'uppercase',
        color: tokens.teal,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function Badge({ bg, border, color, children }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.3px',
      }}
    >
      {children}
    </span>
  );
}

// ── Footer ────────────────────────────────────────────────────────────

function ModalFooter({
  tokens,
  phase,
  parseResult,
  ctaDisabled,
  isSubmitting,
  onSubmit,
  onTryAgain,
  onStartDialogue,
}) {
  const isBailout = Boolean(parseResult?.shouldBailout);

  if (phase === 'confirming') {
    if (isBailout) {
      return (
        <FooterShell tokens={tokens}>
          <PrimaryButton tokens={tokens} onClick={onTryAgain}>
            <ArrowLeft size={14} />
            Try a different signal
          </PrimaryButton>
        </FooterShell>
      );
    }
    return (
      <FooterShell tokens={tokens}>
        <SecondaryButton tokens={tokens} onClick={onTryAgain}>
          Try again
        </SecondaryButton>
        <PrimaryButton tokens={tokens} onClick={onStartDialogue}>
          <Sparkles size={14} />
          Start dialogue
          <ArrowRight size={14} />
        </PrimaryButton>
      </FooterShell>
    );
  }

  return (
    <FooterShell tokens={tokens}>
      <PrimaryButton
        tokens={tokens}
        onClick={onSubmit}
        disabled={ctaDisabled}
        full
      >
        {isSubmitting ? (
          <>
            <Loader2
              size={14}
              style={{ animation: 'signaldrop-spin 0.8s linear infinite' }}
            />
            Reading…
          </>
        ) : (
          <>
            Read this signal
            <ArrowRight size={14} />
          </>
        )}
      </PrimaryButton>
      <SpinKeyframes />
    </FooterShell>
  );
}

function FooterShell({ tokens, children }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderTop: `1px solid ${tokens.borderDefault}`,
        background: tokens.bgApp,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({ tokens, onClick, disabled, full, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: full ? 1 : '1 1 auto',
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '12px 18px',
        background: disabled ? tokens.bgIcon : tokens.teal,
        border: 'none',
        borderRadius: 10,
        color: disabled ? tokens.textFaint : tokens.bgApp,
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '0.3px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        transition: 'box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.boxShadow = tokens.glowTealNav;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ tokens, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: 'none',
        padding: '12px 16px',
        background: 'transparent',
        border: `1px solid ${tokens.borderInput}`,
        borderRadius: 10,
        color: tokens.textSecondary,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

// Inline keyframes for the submit spinner. Inline-style approach is
// per project convention; the @keyframes go in a tiny style tag the
// component renders alongside the spinner so we don't pollute global
// CSS.
function SpinKeyframes() {
  return (
    <style>{`@keyframes signaldrop-spin { to { transform: rotate(360deg); } }`}</style>
  );
}
