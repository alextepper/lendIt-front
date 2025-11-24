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

  // In production, use relative URLs - nginx will proxy /uploads/ to backend
  // In development, use VITE_API_BASE_URL if set
  const baseURL = import.meta.env.PROD
    ? "" // Production: use relative URLs, nginx proxies to backend
    : import.meta.env.VITE_API_BASE_URL || ""; // Dev: use env var if set

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
