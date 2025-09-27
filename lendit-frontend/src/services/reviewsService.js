import http from "../lib/http";
import {
  mockFetchAggregate,
  mockFetchReviews,
  mockCreateReview,
} from "./mock/reviews.mock";

const USE_MOCK = true;

export async function fetchAggregate(itemId) {
  if (USE_MOCK) return mockFetchAggregate(itemId);
  const { data } = await http.get(`/listings/${itemId}/reviews/aggregate`);
  // { avg:4.3, count:37, breakdown:{5:20,4:10,3:5,2:1,1:1} }
  return data;
}

export async function fetchReviews(itemId, params = {}) {
  if (USE_MOCK) return mockFetchReviews(itemId, params);
  const { data } = await http.get(`/listings/${itemId}/reviews`, { params });
  // { items:[{ id,user:{name,avatar},rating,comment,created_at }], page, total_pages }
  return data;
}

export async function createReview(itemId, payload) {
  if (USE_MOCK) return mockCreateReview(itemId, payload);
  const { data } = await http.post(`/listings/${itemId}/reviews`, payload);
  // created review
  return data;
}
