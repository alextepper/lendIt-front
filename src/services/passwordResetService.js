import http from '../lib/http'

/**
 * Request a password reset email
 * @param {string} email - User's email address
 * @returns {Promise<{message: string}>}
 */
export async function requestPasswordReset(email) {
  const { data } = await http.post('/auth/password/reset-request', {
    email,
  })
  return data
}

/**
 * Reset password using a token
 * @param {string} token - Reset token from email
 * @param {string} newPassword - New password (minimum 8 characters)
 * @returns {Promise<{message: string}>}
 */
export async function resetPassword(token, newPassword) {
  const { data } = await http.post('/auth/password/reset', {
    token,
    newPassword,
  })
  return data
}

