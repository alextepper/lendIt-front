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
