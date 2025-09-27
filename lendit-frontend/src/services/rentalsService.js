import http from "../lib/http";
import { mockFetchRentals } from "./mock/rentals.mock";

const USE_MOCK = false; // set true to use mock

export async function fetchRentals(params = {}) {
  if (USE_MOCK) return mockFetchRentals(params);
  const { data } = await http.get("/orders", { params });
  // expected: [{ id, role:'outgoing'|'incoming', item:{id,title}, counterparty:{id,name}, date_from, date_to, total, status }]
  return data;
}
