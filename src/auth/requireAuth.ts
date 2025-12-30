/**
 * Authentication Guard Composable
 * 
 * Provides a requireAuth function that:
 * 1. Checks if user is authenticated
 * 2. If not authenticated, shows login modal and saves pending action
 * 3. If authenticated, executes the action immediately
 * 4. After OAuth login, automatically resumes the pending action
 */

import { useAuthStore } from '../stores/auth';
import { useAuthModal } from '../composables/useAuthModal';
import { setPendingAction, getPendingAction, consumePendingAction, runPendingAction } from './pendingActions';

/**
 * Require authentication before executing an action
 * 
 * @param pendingAction - Action to save and resume after login (e.g. {type: 'BOOK', itemId: '123'})
 * @param actionFn - Function to execute if user is already authenticated
 * @param options - Optional configuration
 * @returns Promise that resolves when action is executed (or after login)
 */
export async function requireAuth<T = void>(
  pendingAction: { type: string; [key: string]: any },
  actionFn: () => void | Promise<T>,
  options: {
    showModal?: boolean; // Show login modal (default: true)
    useGooglePopup?: boolean; // Use Google popup for OAuth (default: true)
  } = {}
): Promise<T | void> {
  const auth = useAuthStore();
  const { openLoginModal, closeModals } = useAuthModal();
  const { showModal = true, useGooglePopup = true } = options;

  // If already authenticated, execute action immediately
  if (auth.isAuthed) {
    return await actionFn();
  }

  // Not authenticated - save pending action
  setPendingAction(pendingAction);

  // Show login modal if requested
  if (showModal) {
    // Get current route from window.location (works in all contexts)
    const currentUrl = new URL(window.location.href);
    const pathWithoutModal = currentUrl.pathname;
    
    // Build query params without modal/redirect
    const queryParams = new URLSearchParams(currentUrl.search);
    queryParams.delete('modal');
    queryParams.delete('redirect');
    const queryString = queryParams.toString();
    
    const returnPath = pathWithoutModal + (queryString ? '?' + queryString : '') + (currentUrl.hash || '');
    
    openLoginModal(returnPath);
  }

  // If using Google popup, we can optionally trigger it automatically
  // But for now, let the user click the button in the modal
  // The modal's GoogleSignInButton will handle the popup flow

  // Return a promise that resolves when auth completes
  // Components should listen for auth state changes or use the pending action system
  return Promise.resolve();
}

/**
 * Check if there's a pending action and resume it
 * This should be called after successful authentication
 * @returns The action if it was consumed and handled, null otherwise
 */
export async function resumePendingAction(
  handlers: Record<string, (action: { type: string; [key: string]: any }) => void | Promise<void>>
): Promise<{ type: string; [key: string]: any } | null> {
  const action = getPendingAction();
  if (action) {
    const handled = await runPendingAction(action, handlers);
    if (handled) {
      // Only consume if it was actually handled
      consumePendingAction();
      return action;
    }
  }
  return null;
}


