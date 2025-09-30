import http from "../lib/http";
import { mockFetchRentals } from "./mock/rentals.mock";

const USE_MOCK = false; // set true to use mock

export async function fetchRentals(params = {}) {
  if (USE_MOCK) return mockFetchRentals(params);

  // Use the new orders/history endpoint
  const { data } = await http.get("/orders/history", { params });

  // Transform the new API response to match the expected format
  const transformedData = data.data.map((order) => ({
    id: order.id,
    role: order.type === "rental" ? "outgoing" : "incoming", // rental = user rented (outgoing), lending = user lent (incoming)
    item: {
      id: order.item.id,
      title: order.item.title,
      description: order.item.description,
      category: order.item.category,
      location: order.item.address,
      thumbnail: order.item.photo,
    },
    counterparty:
      order.type === "rental"
        ? order.participants.owner
        : order.participants.renter,
    date_from: order.dates.start,
    date_to: order.dates.end,
    total: order.cost.total,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt,
    duration: order.dates.duration,
    dailyRate: order.cost.dailyRate,
    reviews: order.reviews,
  }));

  return transformedData;
}
