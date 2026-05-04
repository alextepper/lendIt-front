/**
 * Get full URL for an image
 * @param {string} imageUrl - Image URL (can be relative or absolute)
 * @returns {string} Full URL with base URL prepended if needed
 */
export function getImageUrl(imageUrl) {
  if (!imageUrl) {
    return null;
  }

  // If it's already a full URL, return as is
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  // Get API base URL from runtime config or fallback to build-time env var
  const baseURL =
    (typeof window !== "undefined" && window.__API_BASE_URL__) ||
    import.meta.env.VITE_API_BASE_URL ||
    "";

  // If it starts with /uploads or /, return relative URL (nginx will proxy)
  if (imageUrl.startsWith("/uploads/") || imageUrl.startsWith("/")) {
    return baseURL ? `${baseURL}${imageUrl}` : imageUrl;
  }

  // Otherwise, assume it's a relative path
  return baseURL ? `${baseURL}/${imageUrl}` : `/${imageUrl}`;
}

/**
 * Get full URL for item photos
 * @param {Array|Object} photos - Photos array or single photo object
 * @returns {Array|string} Full URLs
 */
export function getItemPhotoUrl(photos) {
  if (!photos) {
    return null;
  }

  // If it's an array, return array of URLs
  if (Array.isArray(photos)) {
    if (photos.length === 0) {
      return null;
    }
    // Get first photo URL
    const firstPhoto = photos[0];
    const url = typeof firstPhoto === "string" ? firstPhoto : firstPhoto.url;
    return getImageUrl(url);
  }

  // If it's a single photo object or string
  const url = typeof photos === "string" ? photos : photos.url;
  return getImageUrl(url);
}

/**
 * If media is hosted on the API origin, return the same path on the current page origin
 * so fetch() is same-origin (requires nginx or similar to serve /uploads on the app host).
 */
export function rewriteMediaUrlToSiteOrigin(imageUrl) {
  if (typeof window === "undefined" || !imageUrl) return null;
  try {
    const u = new URL(imageUrl, window.location.href);
    const base =
      (typeof window !== "undefined" && window.__API_BASE_URL__) ||
      import.meta.env.VITE_API_BASE_URL ||
      "";
    if (!base) return null;
    const apiOrigin = new URL(base, window.location.href).origin;
    if (u.origin === apiOrigin && u.pathname) {
      return `${window.location.origin}${u.pathname}${u.search}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Load a remote image into a blob: URL so html-to-image/canvas is not CORS-tainted.
 * Call revoke() when the URL is no longer needed (e.g. component unmount).
 * @param {string} imageUrl
 * @returns {Promise<{ objectUrl: string | null, revoke: () => void }>}
 */
export async function fetchImageAsObjectUrl(imageUrl) {
  const noop = () => {};
  if (!imageUrl) return { objectUrl: null, revoke: noop };

  const tryOnce = async (url) => {
    const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  };

  let objectUrl = null;
  try {
    objectUrl = await tryOnce(imageUrl);
  } catch {
    const alt = rewriteMediaUrlToSiteOrigin(imageUrl);
    if (alt && alt !== imageUrl) {
      try {
        objectUrl = await tryOnce(alt);
      } catch {
        /* leave null */
      }
    }
  }

  return {
    objectUrl,
    revoke() {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
  };
}
