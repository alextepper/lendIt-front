import http from "../lib/http";

const USE_MOCK = false;

/**
 * Create a booking request (renter sends request to owner)
 * Uses POST /api/bookings - creates booking with status PENDING_OWNER
 * @param {Object} payload - { itemId, from, to, notes }
 * Backend expects: { itemId, startDate (ISO 8601), endDate (ISO 8601), notes? }
 */
export async function createBookingRequest(payload) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      id: `req_${Date.now()}`,
      status: "PENDING_OWNER",
      itemId: payload.itemId,
      from: payload.from,
      to: payload.to,
      notes: payload.notes,
      createdAt: new Date().toISOString(),
    };
  }

  try {
    // Transform payload to match backend expectations
    // Backend expects startDate and endDate as ISO 8601 date strings
    // Convert date strings (YYYY-MM-DD) to ISO 8601 datetime strings
    let startDate = null;
    let endDate = null;

    if (payload.from) {
      // Create date at midnight in local timezone, then convert to ISO
      const date = new Date(payload.from);
      date.setHours(0, 0, 0, 0);
      startDate = date.toISOString();
    }

    if (payload.to) {
      // Create date at midnight in local timezone, then convert to ISO
      const date = new Date(payload.to);
      date.setHours(0, 0, 0, 0);
      endDate = date.toISOString();
    }

    const requestPayload = {
      itemId: payload.itemId,
      startDate: startDate,
      endDate: endDate,
    };

    // Add notes only if provided
    if (payload.notes && payload.notes.trim()) {
      requestPayload.notes = payload.notes.trim();
    }

    const { data } = await http.post("/bookings", requestPayload);
    return data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to create booking request"
    );
  }
}

/**
 * Fetch **all** bookings for the current user (both as renter and owner)
 * Uses GET /api/bookings without role filter
 * @param {Object} params - Query params (status, page, etc.)
 */
export async function fetchAllBookings(params = {}) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      bookings: [],
      total: 0,
    };
  }

  try {
    const { data } = await http.get("/bookings", { params });
    return {
      bookings: data.bookings || data.items || data,
      total: data.total || 0,
    };
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to fetch bookings"
    );
  }
}

/**
 * Approve a booking request (owner action)
 * Uses POST /api/bookings/:id/owner-approve
 * 
 * Lifecycle:
 * 1. Owner can adjust pricing (optional): rentalPrice, depositAmount, totalAmount
 * 2. Booking is updated: status = AWAITING_PAYMENT
 * 3. No Order entity - bookings handle payments directly
 * 
 * @param {string} bookingId - Booking ID
 * @param {Object} paymentModifications - Optional payment changes { rentalPrice, depositAmount, totalAmount }
 * @returns {Promise<Object>} Response with booking and message: { booking: {...}, message: "..." }
 */
export async function approveBookingRequest(bookingId, paymentModifications = {}) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      booking: {
        id: bookingId,
        status: "AWAITING_PAYMENT",
        ...paymentModifications,
      },
      message: "Booking approved successfully. Renter can now proceed to payment.",
    };
  }

  try {
    const response = await http.post(`/bookings/${bookingId}/owner-approve`, paymentModifications);
    // Backend returns: { booking: {...}, message: "..." }
    // Handle both { success: true, data: {...} } and direct response
    const data = response.data?.data || response.data;
    return data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to approve booking request"
    );
  }
}

/**
 * Reject a booking request (owner action)
 * Uses POST /api/bookings/:id/owner-decline
 * Status changes: PENDING_OWNER → OWNER_DECLINED
 * @param {string} bookingId - Booking ID
 * @param {string} reason - Optional rejection reason
 */
export async function rejectBookingRequest(bookingId, reason = "") {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      id: bookingId,
      status: "OWNER_DECLINED",
      reason,
    };
  }

  try {
    const { data } = await http.post(`/bookings/${bookingId}/owner-decline`, { reason });
    return data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to reject booking request"
    );
  }
}

/**
 * Get a single booking by ID
 * Uses GET /api/bookings/:id
 * @param {string} bookingId - Booking ID
 */
export async function getBookingRequest(bookingId) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      id: bookingId,
      status: "PENDING_OWNER",
    };
  }

  try {
    const { data } = await http.get(`/bookings/${bookingId}`);
    return data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to fetch booking"
    );
  }
}

/**
 * Create checkout intent for a booking (Stripe payment)
 * Uses POST /api/bookings/:id/checkout-intent
 * Returns: { clientSecret, paymentIntentId } for Stripe Elements
 * @param {string} bookingId - Booking ID
 * @returns {Promise<Object>} { clientSecret, paymentIntentId }
 */
export async function createBookingCheckoutIntent(bookingId) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      clientSecret: `pi_mock_${Date.now()}_secret_mock`,
      paymentIntentId: `pi_mock_${Date.now()}`,
    };
  }

  try {
    const { data } = await http.post(`/bookings/${bookingId}/checkout-intent`);
    // Handle both { success: true, data: {...} } and direct response
    return data.data || data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to create checkout intent"
    );
  }
}

/**
 * Confirm a booking manually (fallback)
 * Uses POST /api/bookings/:id/confirm
 * Status changes: AWAITING_PAYMENT → CONFIRMED (after payment verified)
 * @param {string} bookingId - Booking ID
 */
export async function confirmBooking(bookingId) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      id: bookingId,
      status: "CONFIRMED",
    };
  }

  try {
    const { data } = await http.post(`/bookings/${bookingId}/confirm`);
    return data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to confirm booking"
    );
  }
}

