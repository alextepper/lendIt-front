import http from "../lib/http";
import {
  mockFetchListings,
  mockFetchCategories,
  mockFetchLocations,
} from "./mock/listings.mock";

const USE_MOCK = true; // <- set true to use the mock for local demo

export async function fetchListings(params = {}) {
  if (USE_MOCK) return mockFetchListings(params);
  // expected backend params: q, category, location, price_min, price_max, date_from, date_to, sort, page, per_page
  const { data } = await http.get("/listings", { params });
  // expected data shape: { items: [...], page, per_page, total, total_pages }
  return data;
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
  const { data } = await http.post("/listings", payload);
  return data;
}

export async function updateListing(id, payload) {
  if (USE_MOCK) return { id, ...payload };
  const { data } = await http.put(`/listings/${id}`, payload);
  return data;
}

export async function deleteListing(id) {
  if (USE_MOCK) return { ok: true };
  const { data } = await http.delete(`/listings/${id}`);
  return data;
}
