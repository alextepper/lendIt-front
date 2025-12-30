/**
 * Google OAuth Popup Flow
 * 
 * This module handles the complete OAuth popup flow:
 * 1. Opens OAuth URL in a popup window (not a new tab)
 * 2. Saves current route and pending action to sessionStorage
 * 3. Listens for postMessage from the popup callback
 * 4. Refreshes auth state and resumes pending action on success
 * 5. Handles errors and popup blockers gracefully
 */

import { setPendingAction, consumePendingAction } from './pendingActions';

// Configuration
const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;
const POPUP_FEATURES = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},scrollbars=yes,resizable=yes,centerscreen=yes`;

/**
 * Get the OAuth start URL
 * Uses the same logic as the auth store to determine backend URL
 */
function getOAuthUrl(): string {
  let backendBaseURL: string;

  // Check if we're in development mode
  const isDev =
    import.meta.env.DEV ||
    import.meta.env.MODE === 'development' ||
    (typeof window !== 'undefined' &&
      window.location.hostname === 'localhost' &&
      window.location.port === '5173');

  // In development, always use localhost:4000 unless explicitly overridden
  if (isDev) {
    if (import.meta.env.VITE_API_BASE_URL) {
      const envURL = import.meta.env.VITE_API_BASE_URL;
      if (envURL.startsWith('http://') || envURL.startsWith('https://')) {
        backendBaseURL = envURL;
      }
    }
    if (!backendBaseURL) {
      backendBaseURL = 'http://localhost:4000';
    }
  } else {
    // Production mode
    if (typeof window !== 'undefined' && window.__API_BASE_URL__) {
      const runtimeURL = window.__API_BASE_URL__;
      if (runtimeURL.startsWith('http://') || runtimeURL.startsWith('https://')) {
        backendBaseURL = runtimeURL;
      }
    }

    if (!backendBaseURL && import.meta.env.VITE_API_BASE_URL) {
      const envURL = import.meta.env.VITE_API_BASE_URL;
      if (envURL.startsWith('http://') || envURL.startsWith('https://')) {
        backendBaseURL = envURL;
      }
    }

    if (!backendBaseURL) {
      backendBaseURL = `${window.location.origin}/api`;
    }
  }

  // Normalize backendBaseURL - remove trailing slash
  backendBaseURL = backendBaseURL.endsWith('/') ? backendBaseURL.slice(0, -1) : backendBaseURL;

  // Build the OAuth URL - use relative path for same-origin, absolute for cross-origin
  const isSameOrigin = backendBaseURL === window.location.origin || 
                       backendBaseURL === `${window.location.origin}/api` ||
                       backendBaseURL.startsWith(window.location.origin);
  
  if (isSameOrigin) {
    // Same origin - use relative path
    return '/api/auth/google';
  } else {
    // Cross-origin - build absolute URL
    // If backendBaseURL already includes /api, don't add it again
    if (backendBaseURL.endsWith('/api')) {
      return `${backendBaseURL}/auth/google`;
    } else {
      return `${backendBaseURL}/api/auth/google`;
    }
  }
}

/**
 * Get the callback URL for the popup
 * This should be the frontend route that handles the OAuth callback
 */
function getCallbackUrl(): string {
  // Use relative URL - router will handle it
  return '/auth/popup/callback';
}

/**
 * Center the popup window on screen
 */
function getCenteredFeatures(): string {
  const left = (window.screen.width - POPUP_WIDTH) / 2;
  const top = (window.screen.height - POPUP_HEIGHT) / 2;
  return `${POPUP_FEATURES},left=${left},top=${top}`;
}

/**
 * Main function to initiate Google OAuth in a popup
 * @param pendingAction - Optional action to resume after successful login
 * @returns Promise that resolves when OAuth completes (or rejects on error)
 */
export async function loginWithGooglePopup(pendingAction?: {
  type: string;
  [key: string]: any;
}): Promise<void> {
  // Import auth store dynamically
  const { useAuthStore } = await import('../stores/auth');
  const auth = useAuthStore();

  // Get current route from window.location (more reliable than Vue Router in async context)
  const currentUrl = new URL(window.location.href);
  const routeState = {
    path: currentUrl.pathname,
    query: {} as Record<string, string>,
    hash: currentUrl.hash || '',
  };

  // Parse query params from URL
  currentUrl.searchParams.forEach((value, key) => {
    routeState.query[key] = value;
  });

  // Remove modal-related query params from saved state
  delete routeState.query.modal;
  delete routeState.query.redirect;

  // Save route state and pending action to sessionStorage
  sessionStorage.setItem('oauth_return_route', JSON.stringify(routeState));
  if (pendingAction) {
    setPendingAction(pendingAction);
  }

  // Build OAuth URL with callback and return_url
  const oauthUrl = getOAuthUrl();
  const callbackUrl = getCallbackUrl();
  
  // Build full callback URL (absolute URL)
  const fullCallbackUrl = new URL(callbackUrl, window.location.origin).toString();
  
  // Build OAuth URL - handle both relative and absolute
  let url: URL;
  if (oauthUrl.startsWith('http://') || oauthUrl.startsWith('https://')) {
    url = new URL(oauthUrl);
  } else {
    // Relative path - construct absolute URL
    url = new URL(oauthUrl, window.location.origin);
  }
  
  // Ensure no double slashes in path
  url.pathname = url.pathname.replace(/\/+/g, '/');
  
  // Set query params - encode return_url only once
  url.searchParams.set('return_url', fullCallbackUrl);
  url.searchParams.set('popup', 'true');

  // Open popup window (not a new tab)
  const popup = window.open(
    url.toString(),
    'google-oauth-popup',
    getCenteredFeatures()
  );

  // Check if popup was blocked
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    // Popup was blocked - show error to user
    throw new Error('POPUP_BLOCKED');
  }

  // Return a promise that resolves when OAuth completes
  return new Promise((resolve, reject) => {
    let messageListener: ((event: MessageEvent) => void) | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let checkClosedInterval: ReturnType<typeof setInterval> | null = null;

    // Cleanup function
    const cleanup = () => {
      if (messageListener) {
        window.removeEventListener('message', messageListener);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (checkClosedInterval) {
        clearInterval(checkClosedInterval);
      }
      if (popup && !popup.closed) {
        try {
          popup.close();
        } catch (e) {
          // Ignore errors closing popup
        }
      }
    };

    // Primary method: Listen for postMessage from popup
    messageListener = (event: MessageEvent) => {
      // Strict origin validation - only accept messages from same origin
      if (event.origin !== window.location.origin) {
        console.warn('[GooglePopup] Rejected message from different origin:', event.origin);
        return;
      }

      if (event.data?.type === 'OAUTH_SUCCESS') {
        cleanup();
        
        // Refresh auth state
        auth.fetchMe()
          .then(() => {
            // Restore route if it changed
            const savedRoute = sessionStorage.getItem('oauth_return_route');
            if (savedRoute) {
              try {
                const routeState = JSON.parse(savedRoute);
                // Build the full URL to navigate to
                const queryString = new URLSearchParams(routeState.query).toString();
                const fullPath = routeState.path + (queryString ? '?' + queryString : '') + (routeState.hash || '');
                
                // Only restore if we're not already on that route
                const currentPath = window.location.pathname + window.location.search + window.location.hash;
                if (fullPath !== currentPath) {
                  // Use window.location for navigation (works in all contexts)
                  window.location.replace(fullPath);
                } else {
                  sessionStorage.removeItem('oauth_return_route');
                }
              } catch (e) {
                console.warn('[GooglePopup] Failed to restore route:', e);
                sessionStorage.removeItem('oauth_return_route');
              }
            }

            // Resume pending action if any
            const action = consumePendingAction();
            if (action) {
              // Action will be resumed by the component that called requireAuth
              // We just need to signal success
            }

            resolve();
          })
          .catch((err) => {
            console.error('[GooglePopup] Failed to refresh auth state:', err);
            reject(new Error('Failed to refresh authentication state'));
          });
      } else if (event.data?.type === 'OAUTH_ERROR') {
        cleanup();
        const errorMsg = event.data.error || 'OAuth authentication failed';
        reject(new Error(errorMsg));
      }
    };

    window.addEventListener('message', messageListener);

    // Fallback method: Poll popup.closed and check auth state
    // This handles cases where postMessage might not work
    let pollCount = 0;
    const MAX_POLLS = 300; // 5 minutes max (300 * 1000ms)
    
    pollInterval = setInterval(() => {
      pollCount++;
      
      if (popup.closed) {
        // Popup closed - check if user is now authenticated
        // This could mean success (callback closed popup) or user cancelled
        auth.fetchMe()
          .then(() => {
            if (auth.isAuthed) {
              // User is authenticated - success!
              cleanup();
              
              // Restore route
              const savedRoute = sessionStorage.getItem('oauth_return_route');
              if (savedRoute) {
                try {
                  const routeState = JSON.parse(savedRoute);
                  // Build the full URL to navigate to
                  const queryString = new URLSearchParams(routeState.query).toString();
                  const fullPath = routeState.path + (queryString ? '?' + queryString : '') + (routeState.hash || '');
                  
                  // Only restore if we're not already on that route
                  const currentPath = window.location.pathname + window.location.search + window.location.hash;
                  if (fullPath !== currentPath) {
                    // Use window.location for navigation (works in all contexts)
                    window.location.replace(fullPath);
                  } else {
                    sessionStorage.removeItem('oauth_return_route');
                  }
                } catch (e) {
                  console.warn('[GooglePopup] Failed to restore route:', e);
                  sessionStorage.removeItem('oauth_return_route');
                }
              }

              // Resume pending action
              const action = consumePendingAction();
              
              resolve();
            } else {
              // Popup closed but user not authenticated - likely cancelled
              if (pollCount >= 10) {
                // Only reject after a few polls to avoid false negatives
                cleanup();
                reject(new Error('OAuth was cancelled'));
              }
            }
          })
          .catch(() => {
            // Not authenticated
            if (popup.closed && pollCount >= 10) {
              cleanup();
              reject(new Error('OAuth was cancelled'));
            }
          });
      }

      // Timeout after max polls
      if (pollCount >= MAX_POLLS) {
        cleanup();
        reject(new Error('OAuth timeout - please try again'));
      }
    }, 1000); // Poll every second

    // Also check if popup was closed manually (user clicked X)
    checkClosedInterval = setInterval(() => {
      if (popup.closed && !auth.isAuthed) {
        // Popup closed and user still not authenticated after a delay
        // This likely means user cancelled
        setTimeout(() => {
          if (!auth.isAuthed) {
            cleanup();
            reject(new Error('OAuth was cancelled'));
          }
        }, 2000); // Wait 2 seconds before declaring cancelled
      }
    }, 500);
  });
}

