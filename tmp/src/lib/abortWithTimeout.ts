export function abortWithTimeout(caller: AbortSignal, ms: number): { signal: AbortSignal; cancel: () => void } {
  // Native timeout signals do not expose a timer handle.
  if (typeof AbortSignal.any === 'function' && typeof AbortSignal.timeout === 'function') {
    return {
      signal: AbortSignal.any([caller, AbortSignal.timeout(ms)]),
      cancel: () => {},
    };
  }

  const controller = new AbortController();
  const onAbort = () => controller.abort(caller.reason);
  if (caller.aborted) {
    onAbort();
    return { signal: controller.signal, cancel: () => {} };
  }

  caller.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => {
    controller.abort(new DOMException('The operation timed out.', 'TimeoutError'));
  }, ms);

  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timer);
      caller.removeEventListener('abort', onAbort);
    },
  };
}
