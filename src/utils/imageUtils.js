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

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error("readAsDataURL failed"));
    fr.readAsDataURL(blob);
  });
}

/**
 * URLs to try when embedding listing photos for share/canvas (same-origin first).
 */
export function collectShareImageFetchCandidates(imageUrl) {
  const list = [];
  const seen = new Set();
  function push(u) {
    if (!u || typeof u !== "string") return;
    const t = u.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    list.push(t);
  }

  if (typeof window !== "undefined" && imageUrl?.trim().startsWith("/")) {
    try {
      push(new URL(imageUrl.trim(), window.location.origin).href);
    } catch {
      /* ignore */
    }
  }

  push(imageUrl?.trim());
  const alt = rewriteMediaUrlToSiteOrigin(imageUrl);
  push(alt);

  if (typeof window !== "undefined" && imageUrl?.trim()) {
    try {
      const u = new URL(imageUrl.trim(), window.location.href);
      const base =
        (typeof window !== "undefined" && window.__API_BASE_URL__) ||
        import.meta.env.VITE_API_BASE_URL ||
        "";
      if (base && u.pathname.startsWith("/uploads")) {
        const apiOrigin = new URL(base, window.location.href).origin;
        if (u.origin === apiOrigin) {
          push(`${window.location.origin}/api${u.pathname}${u.search}`);
        }
      }
    } catch {
      /* ignore */
    }
  }

  return list;
}

/**
 * Fetch listing photo bytes and return a data URL so html-to-image can paint it
 * (avoids cross-origin img tainting and races with crossorigin=anonymous).
 * @param {string} imageUrl
 * @param {{ maxEdge?: number }} [opts]
 * @returns {Promise<string|null>} data:image/... URL or null
 */
export async function fetchImageAsDataUrlForShare(imageUrl, opts = {}) {
  if (!imageUrl) return null;
  const maxEdge = opts.maxEdge ?? 1600;
  const candidates = collectShareImageFetchCandidates(imageUrl);

  let blob = null;
  for (const url of candidates) {
    try {
      let sameOrigin = false;
      try {
        sameOrigin = new URL(url).origin === window.location.origin;
      } catch {
        sameOrigin = false;
      }
      const res = await fetch(url, {
        mode: "cors",
        credentials: sameOrigin ? "include" : "omit",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      blob = await res.blob();
      break;
    } catch {
      /* try next */
    }
  }
  if (!blob) return null;

  try {
    if (typeof createImageBitmap === "function" && maxEdge > 0) {
      const bmp = await createImageBitmap(blob, { resizeWidth: maxEdge });
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return await blobToDataURL(blob);
      ctx.drawImage(bmp, 0, 0);
      bmp.close?.();
      const jpeg = canvas.toDataURL("image/jpeg", 0.88);
      if (jpeg && jpeg.length > 32) return jpeg;
    }
  } catch {
    /* fall through to full blob */
  }

  try {
    return await blobToDataURL(blob);
  } catch {
    return null;
  }
}
