/**
 * Secure token storage utility
 * 
 * This provides a layer of abstraction for token storage with:
 * - Basic obfuscation (not encryption, but makes casual inspection harder)
 * - Consistent API for token management
 * - Easy to swap implementation (e.g., to encrypted storage later)
 * 
 * NOTE: localStorage is still vulnerable to XSS attacks.
 * This is a fallback for cross-domain scenarios where httpOnly cookies don't work.
 * Primary authentication should always use httpOnly cookies when possible.
 */

const TOKEN_PREFIX = 'lt_'; // LendIt token prefix for easy identification
const ACCESS_TOKEN_KEY = `${TOKEN_PREFIX}access`;
const REFRESH_TOKEN_KEY = `${TOKEN_PREFIX}refresh`;

/**
 * Simple base64 encoding (not encryption - just obfuscation)
 * This makes tokens less obvious in localStorage but doesn't provide real security
 */
function encodeToken(token) {
  if (!token) return null;
  try {
    // Double encode to make it less obvious
    return btoa(btoa(token));
  } catch (e) {
    console.warn('Token encoding failed:', e);
    return token; // Fallback to plain storage
  }
}

function decodeToken(encodedToken) {
  if (!encodedToken) return null;
  try {
    return atob(atob(encodedToken));
  } catch (e) {
    // If decoding fails, might be plain token (backward compatibility)
    return encodedToken;
  }
}

export const tokenStorage = {
  /**
   * Store access token
   */
  setAccessToken(token) {
    if (!token) {
      this.removeAccessToken();
      return;
    }
    try {
      const encoded = encodeToken(token);
      localStorage.setItem(ACCESS_TOKEN_KEY, encoded);
    } catch (e) {
      console.error('Failed to store access token:', e);
    }
  },

  /**
   * Get access token
   */
  getAccessToken() {
    try {
      const encoded = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!encoded) return null;
      return decodeToken(encoded);
    } catch (e) {
      console.error('Failed to get access token:', e);
      return null;
    }
  },

  /**
   * Remove access token
   */
  removeAccessToken() {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      // Also remove legacy key for backward compatibility
      localStorage.removeItem('access_token');
    } catch (e) {
      console.error('Failed to remove access token:', e);
    }
  },

  /**
   * Store refresh token
   */
  setRefreshToken(token) {
    if (!token) {
      this.removeRefreshToken();
      return;
    }
    try {
      const encoded = encodeToken(token);
      localStorage.setItem(REFRESH_TOKEN_KEY, encoded);
    } catch (e) {
      console.error('Failed to store refresh token:', e);
    }
  },

  /**
   * Get refresh token
   */
  getRefreshToken() {
    try {
      const encoded = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!encoded) return null;
      return decodeToken(encoded);
    } catch (e) {
      console.error('Failed to get refresh token:', e);
      return null;
    }
  },

  /**
   * Remove refresh token
   */
  removeRefreshToken() {
    try {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      // Also remove legacy key for backward compatibility
      localStorage.removeItem('refresh_token');
    } catch (e) {
      console.error('Failed to remove refresh token:', e);
    }
  },

  /**
   * Clear all tokens
   */
  clearAll() {
    this.removeAccessToken();
    this.removeRefreshToken();
  },

  /**
   * Check if tokens exist
   */
  hasTokens() {
    return !!(this.getAccessToken() || this.getRefreshToken());
  },
};



