# OAuth Popup Implementation

## Overview

This document describes the complete OAuth popup flow implementation that:
- Opens OAuth in a popup window (not a new tab)
- Keeps users on the same page/route after login
- Resumes pending actions (booking, messaging) after authentication
- Uses postMessage for robust completion detection

## Files Created

1. **src/auth/googlePopup.ts** - Main popup OAuth flow logic
2. **src/auth/pendingActions.ts** - Pending action management system
3. **src/auth/requireAuth.ts** - Authentication guard composable
4. **src/views/auth/OAuthPopupCallback.vue** - Dedicated popup callback page

## Files Modified

1. **src/components/GoogleSignInButton.vue** - Updated to use new popup system
2. **src/views/Item.vue** - Updated booking and messaging actions to use requireAuth
3. **src/components/OwnerPanel.vue** - Updated messageOwner to use requireAuth
4. **src/components/BookingFlow.vue** - Updated submitBookingRequest to use requireAuth
5. **src/router/index.js** - Added `/auth/popup/callback` route
6. **src/stores/auth.js** - Added `refreshSession()` method
7. **src/views/auth/OAuthCallback.vue** - Updated message type to `OAUTH_SUCCESS`

## Key Features

### 1. Popup OAuth Flow

- Opens OAuth URL in a proper popup window (500x600, centered)
- Saves current route state to sessionStorage
- Listens for `postMessage` from popup callback
- Falls back to polling if postMessage fails
- Handles popup blockers gracefully

### 2. Pending Actions

Actions are saved when user tries to perform a privileged action while unauthenticated:
- `{type: 'BOOK', itemId: '123', from: '...', to: '...', notes: '...'}`
- `{type: 'MESSAGE', ownerId: '123', itemId: '456'}`

After successful login, actions are automatically resumed.

### 3. Authentication Guard

The `requireAuth()` function:
- Checks if user is authenticated
- If not, shows login modal and saves pending action
- If yes, executes action immediately
- Works seamlessly with OAuth popup flow

### 4. Route Preservation

- Current route (path, query, hash) is saved before OAuth
- Route is restored after successful login
- No redirects to home page
- User stays exactly where they were

## Backend Requirements

The backend must:
1. Accept `popup=true` query parameter in `/api/auth/google` endpoint
2. Redirect to `/auth/popup/callback` (or configured callback URL) when `popup=true`
3. Include `access_token` and `refresh_token` in callback URL query params
4. Support the existing `/auth/me` endpoint for session refresh

**Minimal backend changes needed:**
- Update OAuth redirect URI configuration to include `/auth/popup/callback`
- Ensure callback URL includes tokens in query params (already done if using existing callback)

## Testing Checklist

### Manual Testing Steps

1. **Popup OAuth Flow**
   - [ ] Click "Continue with Google" button
   - [ ] Verify popup window opens (not new tab)
   - [ ] Complete Google OAuth in popup
   - [ ] Verify popup closes automatically
   - [ ] Verify main tab stays on same page (no redirect to home)
   - [ ] Verify user is logged in (navbar shows user info)

2. **Booking Flow**
   - [ ] As anonymous user, navigate to item detail page
   - [ ] Click "Book Now" button
   - [ ] Verify login modal appears
   - [ ] Click "Continue with Google" in modal
   - [ ] Complete OAuth in popup
   - [ ] Verify booking modal opens automatically after login
   - [ ] Verify user stays on item detail page

3. **Messaging Flow**
   - [ ] As anonymous user, navigate to item detail page
   - [ ] Click "Message Owner" button
   - [ ] Verify login modal appears
   - [ ] Click "Continue with Google" in modal
   - [ ] Complete OAuth in popup
   - [ ] Verify owner modal opens automatically after login
   - [ ] Verify user stays on item detail page

4. **Popup Blocker Handling**
   - [ ] Enable popup blocker in browser
   - [ ] Click "Continue with Google"
   - [ ] Verify error message appears about popup being blocked
   - [ ] Verify user can still use email/password login

5. **Route Preservation**
   - [ ] Navigate to item detail page with query params (e.g., `?ref=search`)
   - [ ] Start OAuth flow
   - [ ] Complete login
   - [ ] Verify you're still on item detail page with same query params

6. **Multiple Actions**
   - [ ] Try to book while unauthenticated
   - [ ] Cancel login modal
   - [ ] Try to message owner
   - [ ] Complete OAuth
   - [ ] Verify only the last action (message) is resumed

## Configuration

### Environment Variables

No new environment variables needed. Uses existing:
- `VITE_API_BASE_URL` - Backend API base URL

### Popup Settings

Popup dimensions can be adjusted in `src/auth/googlePopup.ts`:
```typescript
const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;
```

## Error Handling

- **Popup Blocked**: Shows user-friendly error message
- **OAuth Cancelled**: Detects when user closes popup manually
- **OAuth Failed**: Shows error message, keeps user on same page
- **Network Errors**: Handled gracefully, user can retry

## Security

- Strict origin validation for postMessage
- No tokens stored in localStorage (uses httpOnly cookies)
- SessionStorage used only for temporary state (route, pending actions)
- All OAuth URLs validated to prevent open redirects

## Notes

- The popup callback route (`/auth/popup/callback`) is separate from the main callback route
- This allows different handling for popup vs full-page OAuth flows
- The main callback route (`/auth/callback`) still works for non-popup flows
- Pending actions are stored in sessionStorage and cleared after use
- Multiple components watch for auth state changes to resume actions

