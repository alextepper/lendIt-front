import http from "../lib/http";

const USE_MOCK = false; // Set to true for local development

export async function fetchUnavailableDates(itemId, month) {
  if (USE_MOCK) {
    // Mock unavailable dates for testing
    const mockDates = [
      new Date(2024, 11, 25), // Christmas
      new Date(2024, 11, 26), // Boxing Day
      new Date(2024, 11, 31), // New Year's Eve
    ];
    return { unavailableDates: mockDates };
  }

  try {
    const { data } = await http.get(`/items/${itemId}/calendar`, {
      params: { month },
    });
    return data;
  } catch (error) {
    console.warn("Failed to fetch unavailable dates:", error);
    return { unavailableDates: [] };
  }
}

export async function getQuote(itemId, payload) {
  if (USE_MOCK) {
    // Mock quote check
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API delay

    const { from, to, guests } = payload;
    const start = new Date(from);
    const end = new Date(to);
    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    // Mock some unavailable dates
    const unavailableDates = [
      new Date(2024, 11, 25), // Christmas
      new Date(2024, 11, 26), // Boxing Day
    ];

    const isUnavailable = unavailableDates.some(
      (date) => date >= start && date <= end
    );

    if (isUnavailable) {
      return {
        available: false,
        message: "Those dates are unavailable. Try different dates.",
      };
    }

    const nightlyPrice = 5000; // Mock price in cents (₪50.00)
    const subtotal = nights * nightlyPrice;
    const fees = Math.round(subtotal * 0.08); // 8% service fee
    const total = subtotal + fees;

    return {
      available: true,
      nights,
      nightlyPrice,
      subtotal,
      fees,
      total,
      currency: "ILS",
      vatIncluded: true,
    };
  }

  try {
    const { data } = await http.post(`/items/${itemId}/quote`, payload);
    return data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || "Failed to get quote");
  }
}

export async function createPendingBooking(payload) {
  if (USE_MOCK) {
    // Mock pending booking creation
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API delay
    return {
      bookingId: `booking_${Date.now()}`,
      paymentIntentId: `pi_${Date.now()}`,
      status: "pending",
      total: payload.quote.total,
      from: payload.from,
      to: payload.to,
      guests: payload.guests,
      itemId: payload.itemId,
    };
  }

  try {
    // Generate idempotency key
    const idempotencyKey = crypto.randomUUID();

    const { data } = await http.post("/bookings", payload, {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    });
    return data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to create booking"
    );
  }
}

export async function confirmBooking(bookingId) {
  if (USE_MOCK) {
    // Mock booking confirmation
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate API delay
    return {
      bookingId,
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
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

export async function getBooking(bookingId) {
  if (USE_MOCK) {
    // Mock booking details
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API delay
    return {
      bookingId,
      status: "pending",
      total: 50000, // Mock total in cents
      from: "2024-12-01",
      to: "2024-12-05",
      guests: 2,
      itemId: "item_123",
      item: {
        title: "Sample Item",
        location: "Tel Aviv",
        thumbnail: "https://picsum.photos/300/200",
      },
      createdAt: new Date().toISOString(),
    };
  }

  try {
    const response = await http.get(`/bookings/${bookingId}`);
    // Backend returns { success: true, data: {...} }
    return response.data?.data || response.data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to fetch booking"
    );
  }
}

/**
 * Fetch bookings for the current user
 * Uses GET /api/bookings?role=renter|owner
 * Unified endpoint for both renter and owner views
 * @param {Object} params - Query params { role: 'renter'|'owner', status, page, etc. }
 */
export async function fetchUserBookings(params = {}) {
  if (USE_MOCK) {
    // Mock user bookings
    await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate API delay

    const mockBookings = [
      {
        id: "booking_1",
        status: "CONFIRMED",
        total: 150000, // ₪1,500
        from: "2024-12-15",
        to: "2024-12-18",
        nights: 3,
        guests: 2,
        itemId: "item_1",
        item: {
          title: "Professional Camera Kit",
          location: "Tel Aviv",
          thumbnail: "https://picsum.photos/300/200?random=1",
        },
        createdAt: "2024-11-20T10:30:00Z",
      },
      {
        id: "booking_2",
        status: "PENDING_OWNER",
        total: 75000, // ₪750
        from: "2024-12-22",
        to: "2024-12-24",
        nights: 2,
        guests: 1,
        itemId: "item_2",
        item: {
          title: "Mountain Bike",
          location: "Haifa",
          thumbnail: "https://picsum.photos/300/200?random=2",
        },
        createdAt: "2024-11-25T14:15:00Z",
      },
      {
        id: "booking_3",
        status: "AWAITING_PAYMENT",
        total: 200000, // ₪2,000
        from: "2024-12-28",
        to: "2025-01-02",
        nights: 5,
        guests: 4,
        itemId: "item_3",
        item: {
          title: "Camping Equipment Set",
          location: "Jerusalem",
          thumbnail: "https://picsum.photos/300/200?random=3",
        },
        createdAt: "2024-11-28T09:45:00Z",
      },
      {
        id: "booking_4",
        status: "CONFIRMED",
        total: 60000, // ₪600
        from: "2024-11-10",
        to: "2024-11-12",
        nights: 2,
        guests: 1,
        itemId: "item_4",
        item: {
          title: "Gaming Laptop",
          location: "Ramat Gan",
          thumbnail: "https://picsum.photos/300/200?random=4",
        },
        createdAt: "2024-11-05T16:20:00Z",
      },
      {
        id: "booking_5",
        status: "OWNER_DECLINED",
        total: 45000, // ₪450
        from: "2024-10-25",
        to: "2024-10-27",
        nights: 2,
        guests: 2,
        itemId: "item_5",
        item: {
          title: "Electric Scooter",
          location: "Herzliya",
          thumbnail: "https://picsum.photos/300/200?random=5",
        },
        createdAt: "2024-10-20T11:45:00Z",
      },
    ];

    // Filter by status if provided
    let filteredBookings = mockBookings;
    if (params.status) {
      filteredBookings = mockBookings.filter(
        (booking) => booking.status === params.status
      );
    }

    return {
      bookings: filteredBookings,
      totalPages: 1,
      currentPage: params.page || 1,
      total: filteredBookings.length,
    };
  }

  try {
    const { data } = await http.get("/bookings", { params });
    return {
      bookings: data.bookings || data.items || data,
      total: data.total || 0,
      page: data.page || 1,
    };
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to fetch bookings"
    );
  }
}

export async function cancelBooking(bookingId) {
  if (USE_MOCK) {
    // Mock booking cancellation
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API delay
    return {
      bookingId,
      status: "CANCELLED",
      cancelledAt: new Date().toISOString(),
    };
  }

  try {
    const { data } = await http.post(`/bookings/${bookingId}/cancel`);
    return data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || "Failed to cancel booking"
    );
  }
}
