import http from "../lib/http";

/**
 * Create a new order
 * @param {Object} payload - { itemId, from, to }
 * @returns {Promise<Object>} Created order object
 */
export async function createOrder(payload) {
  // Transform payload to match backend expectations
  const backendPayload = {
    itemId: payload.itemId,
    start: new Date(payload.from).toISOString(),
    end: new Date(payload.to).toISOString(),
  };

  const { data } = await http.post("/orders", backendPayload);
  return data;
}

/**
 * Get order details
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Order object
 */
export async function fetchOrder(orderId) {
  const { data } = await http.get(`/orders/${orderId}`);
  return data;
}

/**
 * List user's orders
 * @param {Object} params - { page, pageSize, status, role }
 * @returns {Promise<Object>} { data: [], pagination: {} }
 */
export async function fetchOrders(params = {}) {
  const { data } = await http.get("/orders", { params });
  return data;
}

/**
 * Create payment intent for an order (Stripe)
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} { clientSecret, amount, currency }
 */
export async function createCheckoutIntent(orderId) {
  const { data } = await http.post(`/orders/${orderId}/checkout-intent`);
  return data;
}

/**
 * Mock payment for an order (for testing without Stripe)
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Updated order object
 */
export async function mockPayment(orderId) {
  const { data } = await http.post(`/orders/${orderId}/mock-payment`);
  return data;
}

/**
 * Update order status
 * @param {string} orderId - Order ID
 * @param {string} status - New status (HANDED_OVER, RETURNED, CANCELLED)
 * @returns {Promise<Object>} Updated order object
 */
export async function updateOrderStatus(orderId, status) {
  const { data } = await http.patch(`/orders/${orderId}/status`, { status });
  return data;
}

/**
 * Get price quote for an item rental
 * @param {string} itemId - Item ID
 * @param {Object} payload - { from, to }
 * @returns {Promise<Object>} Quote with pricing breakdown
 */
export async function getQuote(itemId, payload) {
  // Check if backend expects ISO strings or date strings
  // If backend API doc shows it accepts YYYY-MM-DD format, keep as is
  // If it needs ISO format, transform like createOrder
  const { data } = await http.post(`/items/${itemId}/quote`, payload);
  return data;
}
