import http from "../lib/http";

// ===== NEW ORDERS API ENDPOINTS =====

/**
 * Fetch orders for a specific role (renter or owner)
 * @param {string} role - 'renter' or 'owner'
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Orders data with pagination
 */
export async function fetchOrders(role, params = {}) {
  const queryParams = {
    role,
    page: params.page || 1,
    pageSize: params.pageSize || 50,
    ...params,
  };

  const { data } = await http.get("/orders", {
    params: queryParams,
  });
  return data;
}

/**
 * Fetch orders for a specific item (filtered by itemId)
 * @param {string} itemId - Item ID
 * @param {string} role - 'renter' or 'owner'
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Orders data for the item
 */
export async function fetchItemOrders(itemId, role, params = {}) {
  const queryParams = {
    role,
    page: params.page || 1,
    pageSize: params.pageSize || 50,
    itemId,
    ...params,
  };

  const { data } = await http.get("/orders", {
    params: queryParams,
  });
  return data;
}

/**
 * Fetch bookings for a specific item and month
 * @param {string} itemId - Item ID
 * @param {string} month - Month in YYYY-MM format
 * @param {Object} params - Additional query parameters
 * @returns {Promise<Object>} Bookings data with pagination and statistics
 */
export async function fetchItemBookings(itemId, month, params = {}) {
  const queryParams = {
    month,
    page: params.page || 1,
    limit: params.limit || 50,
    ...params,
  };

  const { data } = await http.get(`/items/${itemId}/bookings`, {
    params: queryParams,
  });
  return data;
}

/**
 * Fetch detailed information about a specific booking
 * @param {string} bookingId - Booking ID
 * @returns {Promise<Object>} Booking details
 */
export async function fetchBookingDetails(bookingId) {
  const { data } = await http.get(`/bookings/${bookingId}`);
  return data;
}

/**
 * Fetch booking statistics for an item
 * @param {string} itemId - Item ID
 * @param {Object} params - Query parameters for statistics
 * @returns {Promise<Object>} Statistics data
 */
export async function fetchItemBookingStatistics(itemId, params = {}) {
  const queryParams = {
    period: params.period || "month",
    startDate: params.startDate,
    endDate: params.endDate,
    ...params,
  };

  const { data } = await http.get(`/items/${itemId}/bookings/statistics`, {
    params: queryParams,
  });
  return data;
}

/**
 * Update booking status
 * @param {string} bookingId - Booking ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated booking
 */
export async function updateBookingStatus(bookingId, status) {
  const { data } = await http.patch(`/bookings/${bookingId}/status`, {
    status,
  });
  return data;
}

/**
 * Cancel a booking
 * @param {string} bookingId - Booking ID
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Object>} Cancelled booking
 */
export async function cancelBooking(bookingId, reason = "") {
  const { data } = await http.post(`/bookings/${bookingId}/cancel`, { reason });
  return data;
}

/**
 * Get booking calendar data for a specific month
 * This is a convenience function that combines bookings and statistics
 * @param {string} itemId - Item ID
 * @param {string} month - Month in YYYY-MM format
 * @returns {Promise<Object>} Combined calendar data
 */
export async function fetchBookingCalendarData(itemId, month) {
  try {
    console.log("Fetching orders for item:", itemId, "month:", month);

    // Fetch orders for the item (as owner)
    const ordersResponse = await fetchItemOrders(itemId, "owner", {
      pageSize: 100, // Get more orders for better calendar coverage
    });

    console.log("Orders response:", ordersResponse);

    // Transform orders to booking format for calendar compatibility
    const bookings =
      ordersResponse.data?.map((order) => ({
        id: order.id,
        startDate: order.start,
        endDate: order.end,
        status: order.status,
        renter: order.renter,
        owner: order.owner,
        item: order.item,
        priceTotal: order.priceTotal,
        currency: order.currency,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })) || [];

    console.log("Transformed bookings:", bookings);

    return {
      bookings,
      pagination: {
        page: ordersResponse.page || 1,
        pageSize: ordersResponse.pageSize || 50,
        total: ordersResponse.total || 0,
      },
      statistics: {
        totalBookings: ordersResponse.total || 0,
        activeBookings: bookings.filter((b) => b.status === "PAID").length,
        cancelledBookings: bookings.filter((b) => b.status === "CANCELLED")
          .length,
      },
    };
  } catch (error) {
    console.error("Failed to fetch booking calendar data:", error);
    throw error;
  }
}

/**
 * Export bookings data to CSV
 * @param {string} itemId - Item ID
 * @param {Object} params - Export parameters
 * @returns {Promise<Blob>} CSV file blob
 */
export async function exportBookingsToCSV(itemId, params = {}) {
  const queryParams = {
    format: "csv",
    ...params,
  };

  const response = await http.get(`/items/${itemId}/bookings/export`, {
    params: queryParams,
    responseType: "blob",
  });

  return response.data;
}

/**
 * Get booking conflicts for a date range
 * @param {string} itemId - Item ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Conflict information
 */
export async function checkBookingConflicts(itemId, startDate, endDate) {
  const { data } = await http.get(`/items/${itemId}/bookings/conflicts`, {
    params: { startDate, endDate },
  });
  return data;
}

/**
 * Get upcoming bookings for an item
 * @param {string} itemId - Item ID
 * @param {number} limit - Number of upcoming bookings to fetch
 * @returns {Promise<Array>} Array of upcoming bookings
 */
export async function fetchUpcomingBookings(itemId, limit = 10) {
  const { data } = await http.get(`/items/${itemId}/bookings/upcoming`, {
    params: { limit },
  });
  return data;
}

/**
 * Get booking history for an item
 * @param {string} itemId - Item ID
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Booking history with pagination
 */
export async function fetchBookingHistory(itemId, params = {}) {
  const queryParams = {
    page: params.page || 1,
    limit: params.limit || 20,
    status: params.status,
    startDate: params.startDate,
    endDate: params.endDate,
    ...params,
  };

  const { data } = await http.get(`/items/${itemId}/bookings/history`, {
    params: queryParams,
  });
  return data;
}
