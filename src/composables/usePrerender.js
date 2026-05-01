// Helper to signal vite-plugin-prerender that the current page has finished
// rendering and is safe to snapshot. The plugin is configured with
// `renderAfterDocumentEvent: 'prerender-ready'` in vite.config.js.
//
// We expose two flavors:
//   * notifyPrerenderReady() - low-level "fire it now"
//   * markPrerendered(promise) - "fire it when this promise resolves" with a
//                                hard timeout so the build can never hang.

let alreadyFired = false;

export function notifyPrerenderReady() {
  if (typeof document === "undefined") return;
  if (alreadyFired) return;
  alreadyFired = true;
  // requestAnimationFrame ensures Vue has flushed its render queue and the
  // browser has painted the new DOM before the prerender snapshot is taken.
  const fire = () => {
    try {
      document.dispatchEvent(new Event("prerender-ready"));
    } catch {
      // ignore - not a real browser
    }
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(fire));
  } else {
    fire();
  }
}

/**
 * Resolve `promise`, then fire the prerender-ready event. If the promise
 * doesn't settle within `timeoutMs` we fire anyway so a slow API call doesn't
 * stall the build.
 */
export function markPrerendered(promise, { timeoutMs = 5000 } = {}) {
  if (typeof document === "undefined") return;
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    notifyPrerenderReady();
  }, timeoutMs);
  Promise.resolve(promise)
    .catch(() => {})
    .finally(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      notifyPrerenderReady();
    });
}
