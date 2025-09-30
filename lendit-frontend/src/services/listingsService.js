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
  const endpoint = params.mine ? "/items/my-listings" : "/items";

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

  const { data } = await http.get(endpoint, { params: apiParams });

  // Transform backend response to expected frontend format
  // Backend returns: { data: [...], page, pageSize, total }
  // Frontend expects: { items: [...], page, per_page, total, total_pages }
  const transformedData = {
    items: data.data || [],
    page: data.page || 1,
    per_page: data.pageSize || 12,
    total: data.total || 0,
    total_pages: Math.ceil((data.total || 0) / (data.pageSize || 12)),
  };

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

  const { data } = await http.patch(`/items/${id}`, transformedPayload);
  return data;
}

export async function deleteListing(id) {
  if (USE_MOCK) return { ok: true };
  const { data } = await http.patch(`/items/${id}`, { active: false });
  return data;
}
