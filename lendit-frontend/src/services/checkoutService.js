import http from "../lib/http";

const USE_MOCK = true;

export async function quoteOrder(payload) {
  // payload: { item_id, date_from, date_to, coupon? }
  if (USE_MOCK) return mockQuote(payload);
  const { data } = await http.post("/checkout/quote", payload);
  // { days, subtotal, fee, discount, total }
  return data;
}

export async function createOrder(payload) {
  // payload: { item_id, date_from, date_to, contact, delivery, coupon? }
  if (USE_MOCK) return mockCreate(payload);
  const { data } = await http.post("/checkout/create", payload);
  // { order_id }
  return data;
}

export async function payOrder(orderId, method, cardPayload) {
  if (USE_MOCK) return mockPay(orderId, method, cardPayload);
  const { data } = await http.post(`/checkout/${orderId}/pay`, {
    method,
    ...cardPayload,
  });
  // { status:'success'|'failure', redirectUrl? }
  return data;
}

/* ---------- Optional local mocks ---------- */
function daysBetween(a, b) {
  const d = Math.ceil((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
  return Math.max(0, d);
}

async function mockQuote(p) {
  await new Promise((r) => setTimeout(r, 120));
  const pricePerDay = 20;
  const days = daysBetween(p.date_from, p.date_to);
  const subtotal = days * pricePerDay;
  const fee = Math.round(subtotal * 0.08);
  const discount = p.coupon === "SAVE10" ? Math.min(10, subtotal) : 0;
  const total = subtotal + fee - discount;
  return { days, subtotal, fee, discount, total, price_per_day: pricePerDay };
}

async function mockCreate(p) {
  await new Promise((r) => setTimeout(r, 150));
  return { order_id: Math.floor(Math.random() * 1e6) };
}

async function mockPay(orderId, method) {
  await new Promise((r) => setTimeout(r, 400));
  return { status: method === "card" ? "success" : "failure" };
}
