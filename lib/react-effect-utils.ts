/**
 * React useEffect Utility Functions
 * Provides defensive programming utilities to prevent "destroy is not a function" errors
 */

/**
 * Creates a safe cleanup function that validates the cleanup is actually a function
 * Prevents "destroy is not a function" errors in React useEffect hooks
 */
export function createSafeCleanup(cleanup: (() => void) | undefined | null, context = 'useEffect'): (() => void) | undefined {
  if (cleanup === null || cleanup === undefined) {
    return undefined;
  }
  
  if (typeof cleanup !== 'function') {
    console.warn(`[${context}] Cleanup is not a function:`, typeof cleanup, cleanup);
    return undefined;
  }
  
  return () => {
    try {
      cleanup();
    } catch (error) {
      console.error(`[${context}] Error during cleanup:`, error);
    }
  };
}

/**
 * Validates that a useEffect cleanup return value is safe
 * Returns undefined if the cleanup is invalid, preventing React errors
 */
export function validateEffectCleanup(cleanup: any, context = 'useEffect'): (() => void) | undefined {
  if (cleanup === undefined || cleanup === null) {
    return undefined;
  }
  
  if (typeof cleanup === 'function') {
    return cleanup;
  }
  
  // If cleanup is a Promise (from async function), warn and return undefined
  if (cleanup && typeof cleanup.then === 'function') {
    console.error(`[${context}] useEffect callback returned a Promise. useEffect callbacks cannot be async functions.`);
    return undefined;
  }
  
  console.warn(`[${context}] useEffect cleanup is not a function:`, typeof cleanup, cleanup);
  return undefined;
}

/**
 * Wraps a useEffect cleanup function with error handling
 */
export function wrapEffectCleanup(cleanup: () => void, context = 'useEffect'): () => void {
  return () => {
    try {
      if (typeof cleanup === 'function') {
        cleanup();
      } else {
        console.warn(`[${context}] Cleanup function is not a function:`, typeof cleanup);
      }
    } catch (error) {
      console.error(`[${context}] Error during cleanup:`, error);
    }
  };
}

/**
 * Safe useEffect wrapper that prevents async callback issues
 * Usage: safeUseEffect(() => { ... return cleanup; }, deps)
 */
export function createSafeEffect(callback: () => (() => void) | void | undefined, context = 'useEffect') {
  return () => {
    try {
      const cleanup = callback();
      return validateEffectCleanup(cleanup, context);
    } catch (error) {
      console.error(`[${context}] Error in effect callback:`, error);
      return undefined;
    }
  };
}

/**
 * Utility to check if a value is a valid cleanup function
 */
export function isValidCleanupFunction(value: any): value is () => void {
  return typeof value === 'function';
}

/**
 * Utility to safely call a cleanup function
 */
export function safeCleanup(cleanup: any, context = 'cleanup'): void {
  try {
    if (isValidCleanupFunction(cleanup)) {
      cleanup();
    } else if (cleanup !== undefined && cleanup !== null) {
      console.warn(`[${context}] Invalid cleanup function:`, typeof cleanup, cleanup);
    }
  } catch (error) {
    console.error(`[${context}] Error during cleanup:`, error);
  }
}
