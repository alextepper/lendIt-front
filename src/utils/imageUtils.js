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
