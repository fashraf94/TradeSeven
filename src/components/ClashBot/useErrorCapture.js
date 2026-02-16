import { useEffect, useRef, useCallback } from 'react';

const MAX_ERRORS = 5;
const MAX_MESSAGE_LENGTH = 200;

/**
 * Custom hook that captures recent console errors and unhandled rejections.
 * Stores the last 5 error messages in a ref (no re-renders).
 *
 * IMPORTANT: Filters out errors containing "ClashBot" or "BugReport" to
 * prevent infinite loops if the widget itself throws during render.
 */
export default function useErrorCapture() {
  const errorsRef = useRef([]);
  const originalConsoleError = useRef(null);

  const capture = useCallback((msg) => {
    const str = typeof msg === 'string' ? msg : String(msg);

    // Guard: don't capture our own errors to prevent infinite loops
    if (str.includes('ClashBot') || str.includes('BugReport') || str.includes('clashbot')) {
      return;
    }

    const truncated = str.length > MAX_MESSAGE_LENGTH
      ? str.substring(0, MAX_MESSAGE_LENGTH) + '...'
      : str;

    const buffer = errorsRef.current;
    buffer.push(truncated);
    // Keep only the last MAX_ERRORS entries (circular buffer)
    if (buffer.length > MAX_ERRORS) {
      buffer.shift();
    }
  }, []);

  useEffect(() => {
    // Store original console.error
    originalConsoleError.current = console.error;

    // Override console.error to intercept errors
    console.error = (...args) => {
      // Call original first so behavior is unchanged
      originalConsoleError.current?.apply(console, args);
      // Capture the first argument as the error message
      if (args.length > 0) {
        capture(args[0]);
      }
    };

    // Listen for uncaught errors
    const handleError = (event) => {
      capture(event.message || 'Unknown error');
    };

    // Listen for unhandled promise rejections
    const handleRejection = (event) => {
      const reason = event.reason;
      const msg = reason instanceof Error ? reason.message : String(reason || 'Unhandled rejection');
      capture(msg);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      // Restore original console.error
      if (originalConsoleError.current) {
        console.error = originalConsoleError.current;
      }
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [capture]);

  const clearErrors = useCallback(() => {
    errorsRef.current = [];
  }, []);

  // Return a getter that snapshots the current errors array
  const getRecentErrors = useCallback(() => {
    return [...errorsRef.current];
  }, []);

  return { getRecentErrors, clearErrors };
}
