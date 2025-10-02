import http from "../lib/http";
import { mockFetchItem, mockFetchRelated } from "./mock/item.mock";

const USE_MOCK = false; // set true to use mock

export async function fetchItem(id) {
  if (USE_MOCK) return mockFetchItem(id);
  const { data } = await http.get(`/items/${id}`);

  // Map backend field names to frontend expected names
  const transformedItem = {
    ...data,
    price_per_day: data.pricePerDay, // Keep both for backward compatibility
    rating: data.ratingAvg || 0,
    reviews_count: data.ratingCount || 0,
    location: data.address || data.location, // Use address if available, fallback to location
    photos: data.photos || [],
    owner: data.owner || {
      id: data.ownerId,
      name: "Unknown",
      rating: 0,
      avatar: null,
    },
  };

  return transformedItem;
}

/**
 * Fetch calendar availability for an item
 * @param {string} id - Item ID
 * @param {string} month - Month in format YYYY-MM (optional, defaults to current month)
 * @returns {Promise<Object>} Calendar availability object
 */
export async function fetchItemCalendar(id, month = null) {
  try {
    const params = month ? { month } : {};
    const { data } = await http.get(`/items/${id}/calendar`, { params });

    // Transform calendar data to array of unavailable dates for backward compatibility
    const unavailableDates = [];
    if (data.availability) {
      Object.entries(data.availability).forEach(([date, info]) => {
        if (!info.available) {
          unavailableDates.push(date);
        }
      });
    }

    return {
      month: data.month,
      availability: data.availability,
      unavailableDates, // For backward compatibility
    };
  } catch (error) {
    console.error("Failed to fetch calendar:", error);
    return {
      month: month || new Date().toISOString().slice(0, 7),
      availability: {},
      unavailableDates: [],
    };
  }
}

/**
 * Check if specific date range is available for booking
 * @param {string} id - Item ID
 * @param {string} from - Start date (YYYY-MM-DD)
 * @param {string} to - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} { available: boolean, unavailableRanges: [] }
 */
export async function checkBookingAvailability(id, from, to) {
  try {
    const { data } = await http.get(`/items/${id}/booking-availability`, {
      params: { from, to },
    });
    return data;
  } catch (error) {
    console.error("Failed to check booking availability:", error);
    throw error;
  }
}

/**
 * Update item availability (block/unblock dates)
 * @param {string} id - Item ID
 * @param {Object} payload - { action: 'block' | 'unblock', dates: string[] }
 * @returns {Promise<Object>}
 */
export async function updateAvailability(id, payload) {
  // Transform payload to backend format
  const backendPayload = {
    ranges: payload.dates.map((date) => ({
      from: date,
      to: date,
      available: payload.action === "unblock", // true = unblock (make available), false = block (make unavailable)
    })),
  };

  const { data } = await http.patch(
    `/items/${id}/availability`,
    backendPayload
  );
  return data;
}

export async function fetchRelated(id, limit = 6) {
  if (USE_MOCK) return mockFetchRelated(id, limit);
  const { data } = await http.get(`/items/${id}/related`, {
    params: { limit },
  });

  // Map backend field names to frontend expected names for related items
  const transformedItems = (data.data || data).map((item) => ({
    ...item,
    price_per_day: item.pricePerDay, // Keep both for backward compatibility
    rating: item.ratingAvg || 0,
    reviews_count: item.ratingCount || 0,
    thumbnail:
      item.photos && item.photos.length > 0 ? item.photos[0].url : null,
    location: item.address || item.location, // Use address if available, fallback to location
  }));

  return transformedItems;
}
