import http from "../lib/http";
import { mockFetchItem, mockFetchRelated } from "./mock/item.mock";

const USE_MOCK = true; // set true to use mock

export async function fetchItem(id) {
  if (USE_MOCK) return mockFetchItem(id);
  const { data } = await http.get(`/listings/${id}`);
  // expected shape:
  // { id, title, description, category, location, price_per_day, photos:[...],
  //   owner:{ id, name, rating, avatar }, rating, reviews_count }
  return data;
}

export async function fetchRelated(id, limit = 6) {
  if (USE_MOCK) return mockFetchRelated(id, limit);
  const { data } = await http.get(`/listings/${id}/related`, {
    params: { limit },
  });
  return data; // [{id, title, price_per_day, thumbnail, ...}]
}
