import http from "../lib/http";
import {
  mockFetchAggregate,
  mockFetchReviews,
  mockCreateReview,
} from "./mock/reviews.mock";

const USE_MOCK = false; // Set to false to use real API endpoints

export async function fetchAggregate(itemId) {
  if (USE_MOCK) return mockFetchAggregate(itemId);
  const { data } = await http.get(`/listings/${itemId}/reviews/aggregate`);
  // { avg:4.3, count:37, breakdown:{5:20,4:10,3:5,2:1,1:1} }
  return data;
}

export async function fetchReviews(itemId, params = {}) {
  if (USE_MOCK) return mockFetchReviews(itemId, params);
  const { data } = await http.get(`/listings/${itemId}/reviews`, { params });
  // { items:[{ id,user:{name,avatar},rating,comment,created_at }], page, total_pages }
  return data;
}

export async function createReview(itemId, payload) {
  if (USE_MOCK) return mockCreateReview(itemId, payload);
  const { data } = await http.post(`/listings/${itemId}/reviews`, payload);
  // created review
  return data;
}

/**
 * Fetch reviews for a specific item
 * @param {string} itemId - Item ID
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} Item reviews
 */
// ===== NEW REVIEW SYSTEM API ENDPOINTS =====

/**
 * Create a review for a booking
 * @param {string} bookingId - Booking ID
 * @param {Object} reviewData - Review data
 * @returns {Promise<Object>} Created review
 */
export async function createOrderReview(bookingId, reviewData) {
  try {
    const { data } = await http.post(`/api/bookings/${bookingId}/reviews`, reviewData);
    return data;
  } catch (error) {
    console.error("Failed to create booking review:", error);
    throw error;
  }
}

/**
 * Respond to a review
 * @param {string} reviewId - Review ID
 * @param {string} responseText - Response text
 * @returns {Promise<Object>} Review response
 */
export async function respondToReview(reviewId, responseText) {
  try {
    const { data } = await http.post(`/reviews/${reviewId}/response`, {
      responseText,
    });
    return data;
  } catch (error) {
    console.error("Failed to respond to review:", error);
    throw error;
  }
}

/**
 * Mark review as helpful
 * @param {string} reviewId - Review ID
 * @returns {Promise<Object>} Response
 */
export async function markReviewHelpful(reviewId) {
  try {
    const { data } = await http.post(`/reviews/${reviewId}/helpful`);
    return data;
  } catch (error) {
    console.error("Failed to mark review helpful:", error);
    throw error;
  }
}

/**
 * Remove helpful mark from review
 * @param {string} reviewId - Review ID
 * @returns {Promise<Object>} Response
 */
export async function unmarkReviewHelpful(reviewId) {
  try {
    const { data } = await http.delete(`/reviews/${reviewId}/helpful`);
    return data;
  } catch (error) {
    console.error("Failed to unmark review helpful:", error);
    throw error;
  }
}

/**
 * Report a review
 * @param {string} reviewId - Review ID
 * @param {string} reason - Report reason
 * @param {string} details - Report details
 * @returns {Promise<Object>} Response
 */
export async function reportReview(reviewId, reason, details) {
  try {
    const { data } = await http.post(`/reviews/${reviewId}/report`, {
      reason,
      details,
    });
    return data;
  } catch (error) {
    console.error("Failed to report review:", error);
    throw error;
  }
}

/**
 * Get reviews for a specific item
 * @param {string} itemId - Item ID
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} Item reviews
 */
export async function fetchItemReviews(itemId, params = {}) {
  try {
    const queryParams = {
      sort: params.sort || "NEWEST",
      offset: params.offset || 0,
      limit: params.limit || 20,
      ...params,
    };

    const { data } = await http.get(`/items/${itemId}/reviews`, {
      params: queryParams,
    });

    return data.reviews || data;
  } catch (error) {
    console.error("Failed to fetch item reviews:", error);
    return [];
  }
}

/**
 * Get reviews received by a user
 * @param {string} userId - User ID
 * @param {string} role - 'owner' or 'renter'
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} User reviews received
 */
export async function fetchUserReviewsReceived(userId, role, params = {}) {
  try {
    const queryParams = {
      role,
      sort: params.sort || "NEWEST",
      offset: params.offset || 0,
      limit: params.limit || 20,
      ...params,
    };

    const { data } = await http.get(`/users/${userId}/reviews/received`, {
      params: queryParams,
    });

    return data.reviews || data;
  } catch (error) {
    console.error("Failed to fetch user reviews received:", error);
    return [];
  }
}

/**
 * Get reviews given by a user
 * @param {string} userId - User ID
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} User reviews given
 */
export async function fetchUserReviewsGiven(userId, params = {}) {
  try {
    const queryParams = {
      offset: params.offset || 0,
      limit: params.limit || 20,
      ...params,
    };

    const { data } = await http.get(`/users/${userId}/reviews/given`, {
      params: queryParams,
    });

    return data.reviews || data;
  } catch (error) {
    console.error("Failed to fetch user reviews given:", error);
    return [];
  }
}

/**
 * Get a specific review by ID
 * @param {string} reviewId - Review ID
 * @returns {Promise<Object>} Review details
 */
export async function fetchReviewById(reviewId) {
  try {
    const { data } = await http.get(`/reviews/${reviewId}`);
    return data;
  } catch (error) {
    console.error("Failed to fetch review:", error);
    throw error;
  }
}

// ===== LEGACY FUNCTIONS (for backward compatibility) =====
