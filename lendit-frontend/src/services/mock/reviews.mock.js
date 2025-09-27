const DB = {};

function seed(id) {
  if (DB[id]) return;
  DB[id] = Array.from({ length: 18 }).map((_, i) => ({
    id: i + 1,
    user: {
      name: `User ${i + 1}`,
      avatar: `https://i.pravatar.cc/64?img=${(i % 60) + 1}`,
    },
    rating: (i % 5) + 1,
    comment: ["Great!", "Works fine", "As described", "Okay", "Not ideal"][
      i % 5
    ],
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
  }));
}

export async function mockFetchAggregate(id) {
  seed(id);
  await new Promise((r) => setTimeout(r, 100));
  const rows = DB[id];
  const count = rows.length;
  const avg =
    Math.round((rows.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10;
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  rows.forEach((r) => breakdown[r.rating]++);
  return { avg, count, breakdown };
}

export async function mockFetchReviews(id, { page = 1, per_page = 6 } = {}) {
  seed(id);
  await new Promise((r) => setTimeout(r, 120));
  const rows = DB[id];
  const total_pages = Math.max(1, Math.ceil(rows.length / per_page));
  const start = (page - 1) * per_page;
  return { items: rows.slice(start, start + per_page), page, total_pages };
}

export async function mockCreateReview(id, payload) {
  seed(id);
  await new Promise((r) => setTimeout(r, 120));
  const item = {
    id: (DB[id].at(-1)?.id || 0) + 1,
    user: { name: "You", avatar: "https://i.pravatar.cc/64?img=13" },
    rating: payload.rating,
    comment: payload.comment,
    created_at: new Date().toISOString(),
  };
  DB[id].unshift(item);
  return item;
}
