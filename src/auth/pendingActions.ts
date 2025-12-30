/**
 * Pending Action Management
 * 
 * Manages actions that need to be resumed after authentication.
 * Actions are stored in sessionStorage and consumed once after successful login.
 */

const PENDING_ACTION_KEY = 'oauth_pending_action';

export interface PendingAction {
  type: string;
  [key: string]: any;
}

/**
 * Set a pending action to be resumed after authentication
 * @param action - Action object with type and any additional data
 */
export function setPendingAction(action: PendingAction): void {
  sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(action));
}

/**
 * Get the current pending action without consuming it
 * @returns Pending action or null
 */
export function getPendingAction(): PendingAction | null {
  const stored = sessionStorage.getItem(PENDING_ACTION_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.warn('[PendingActions] Failed to parse pending action:', e);
    sessionStorage.removeItem(PENDING_ACTION_KEY);
    return null;
  }
}

/**
 * Consume (get and remove) the pending action
 * This should be called once after successful authentication
 * @returns Pending action or null
 */
export function consumePendingAction(): PendingAction | null {
  const action = getPendingAction();
  if (action) {
    sessionStorage.removeItem(PENDING_ACTION_KEY);
  }
  return action;
}

/**
 * Clear any pending action
 */
export function clearPendingAction(): void {
  sessionStorage.removeItem(PENDING_ACTION_KEY);
}

/**
 * Run a pending action based on its type
 * This is a generic runner that components can use
 * @param action - The action to run
 * @param handlers - Map of action types to handler functions
 */
export function runPendingAction(
  action: PendingAction,
  handlers: Record<string, (action: PendingAction) => void | Promise<void>>
): void {
  const handler = handlers[action.type];
  if (handler) {
    handler(action);
  } else {
    console.warn('[PendingActions] No handler for action type:', action.type);
  }
}

