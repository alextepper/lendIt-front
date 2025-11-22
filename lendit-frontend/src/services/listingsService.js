import http from "../lib/http";
import {
  mockFetchListings,
  mockFetchCategories,
  mockFetchLocations,
} from "./mock/listings.mock";

const USE_MOCK = false; // <- set true to use the mock for local demo

export async function fetchListings(params = {}) {
  if (USE_MOCK) return mockFetchListings(params);

  // Use different endpoints based on whether we want user's own listings
  let endpoint = params.mine ? "/items/my-listings" : "/items";

  // Transform params for the API
  const apiParams = { ...params };
  if (apiParams.per_page) {
    apiParams.pageSize = apiParams.per_page;
    delete apiParams.per_page;
  }

  // Transform category to uppercase for backend compatibility
  if (apiParams.category) {
    apiParams.category = apiParams.category.toUpperCase();
  }

  // Handle location-based search - use /items/nearby endpoint when location is provided
  const hasLocation = apiParams.lat != null && apiParams.lng != null;
  if (hasLocation) {
    // Convert to numbers if they're strings
    apiParams.lat = typeof apiParams.lat === 'string' ? parseFloat(apiParams.lat) : apiParams.lat;
    apiParams.lng = typeof apiParams.lng === 'string' ? parseFloat(apiParams.lng) : apiParams.lng;
    
    // Set default radius if not provided (15km default)
    if (apiParams.radiusKm == null || apiParams.radiusKm === '') {
      apiParams.radiusKm = 15;
    } else {
      apiParams.radiusKm = typeof apiParams.radiusKm === 'string' ? parseFloat(apiParams.radiusKm) : apiParams.radiusKm;
    }
    
    // Use dedicated nearby endpoint for location-based searches
    endpoint = "/items/nearby";
    
    // Ensure sort is distance when location is provided (unless explicitly set otherwise)
    if (!apiParams.sort || apiParams.sort === 'relevance') {
      apiParams.sort = 'distance';
    }
  }

  // Transform date format to ISO if provided
  if (apiParams.date_from && typeof apiParams.date_from === 'string' && !apiParams.date_from.includes('T')) {
    // Convert YYYY-MM-DD to ISO format
    apiParams.date_from = new Date(apiParams.date_from + 'T00:00:00Z').toISOString();
  }
  if (apiParams.date_to && typeof apiParams.date_to === 'string' && !apiParams.date_to.includes('T')) {
    // Convert YYYY-MM-DD to ISO format
    apiParams.date_to = new Date(apiParams.date_to + 'T23:59:59Z').toISOString();
  }

  const { data } = await http.get(endpoint, { params: apiParams });

  // Transform backend response to expected frontend format
  // Backend can return: { data: [...], pagination: {...} } or { data: [...], page, pageSize, total }
  let transformedData;
  
  if (data.pagination) {
    // New format with pagination object
    transformedData = {
      items: data.data || [],
      page: data.pagination.page || 1,
      per_page: data.pagination.per_page || data.pagination.pageSize || 12,
      total: data.pagination.total || 0,
      total_pages: data.pagination.total_pages || Math.ceil((data.pagination.total || 0) / (data.pagination.per_page || data.pagination.pageSize || 12)),
    };
  } else {
    // Legacy format
    transformedData = {
      items: data.data || [],
      page: data.page || 1,
      per_page: data.pageSize || 12,
      total: data.total || 0,
      total_pages: Math.ceil((data.total || 0) / (data.pageSize || 12)),
    };
  }

  // Map backend field names to frontend expected names
  transformedData.items = transformedData.items.map((item) => ({
    ...item,
    // Map backend fields to frontend expected fields
    price_per_day: item.pricePerDay, // Keep both for backward compatibility
    rating: item.ratingAvg || 0,
    reviews_count: item.ratingCount || 0,
    thumbnail:
      item.photos && item.photos.length > 0 ? item.photos[0].url : null,
    location: item.address || item.location, // Use address if available, fallback to location
    // Preserve distance if provided (from location-based search)
    distance: item.distance,
    // Preserve latitude/longitude if provided
    latitude: item.latitude,
    longitude: item.longitude,
  }));

  return transformedData;
}

export async function fetchCategories() {
  if (USE_MOCK) return mockFetchCategories();
  const { data } = await http.get("/meta/categories");
  return data; // ["Tools","Consoles",...]
}

export async function fetchLocations() {
  if (USE_MOCK) return mockFetchLocations();
  const { data } = await http.get("/meta/locations");
  return data; // ["Haifa","Tel Aviv",...]
}

export async function createListing(payload) {
  if (USE_MOCK) {
    return { id: Math.floor(Math.random() * 100000), ...payload };
  }

  // Transform category to uppercase for backend compatibility
  const transformedPayload = { ...payload };
  if (transformedPayload.category) {
    transformedPayload.category = transformedPayload.category.toUpperCase();
  }

  // Convert prices to backend format (multiply by 100)
  if (transformedPayload.pricePerDay) {
    transformedPayload.pricePerDay = Math.round(
      transformedPayload.pricePerDay * 100
    );
  }
  if (transformedPayload.initialPrice) {
    transformedPayload.initialPrice = Math.round(
      transformedPayload.initialPrice * 100
    );
  }
  if (transformedPayload.deposit) {
    transformedPayload.deposit = Math.round(transformedPayload.deposit * 100);
  }

  const { data } = await http.post("/items", transformedPayload);
  return data;
}

export async function updateListing(id, payload) {
  if (USE_MOCK) return { id, ...payload };

  // Transform category to uppercase for backend compatibility
  const transformedPayload = { ...payload };
  if (transformedPayload.category) {
    transformedPayload.category = transformedPayload.category.toUpperCase();
  }

  // Convert prices to backend format (multiply by 100)
  if (transformedPayload.pricePerDay) {
    transformedPayload.pricePerDay = Math.round(
      transformedPayload.pricePerDay * 100
    );
  }
  if (transformedPayload.initialPrice) {
    transformedPayload.initialPrice = Math.round(
      transformedPayload.initialPrice * 100
    );
  }
  if (transformedPayload.deposit) {
    transformedPayload.deposit = Math.round(transformedPayload.deposit * 100);
  }

  const { data } = await http.patch(`/items/${id}`, transformedPayload);
  return data;
}

export async function deleteListing(id) {
  if (USE_MOCK) return { ok: true };
  const { data } = await http.patch(`/items/${id}`, { active: false });
  return data;
}

/**
 * Fetch user's listings
 * @param {string} userId - User ID
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} User's listings
 */
export async function fetchUserListings(userId, params = {}) {
  try {
    const queryParams = {
      page: params.page || 1,
      limit: params.limit || 20,
      status: params.status || "active",
      ...params,
    };

    const { data } = await http.get(`/users/${userId}/listings`, {
      params: queryParams,
    });
    return data.listings || data;
  } catch (error) {
    console.error("Failed to fetch user listings:", error);
    throw error;
  }
}
