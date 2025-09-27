// Simple static mock you can switch on while backend isn't ready
const CATS = ["Tools", "Consoles", "Cameras", "Camping"];
const LOCS = ["Haifa", "Tel Aviv", "Jerusalem", "Afula", "Yokneam"];
const IMG = "https://picsum.photos/seed/seedNUM/640/360";

function gen(n = 42) {
  return Array.from({ length: n }).map((_, i) => ({
    id: i + 1,
    title:
      ["Drill", "PS5", "Mirrorless Camera", "Tent", "Lawn Mower"][i % 5] +
      " #" +
      (i + 1),
    price_per_day: ((i % 5) + 1) * 10,
    category: CATS[i % CATS.length],
    location: LOCS[i % LOCS.length],
    thumbnail: IMG.replace("NUM", String(i + 1)),
    rating: Math.round((3 + Math.random() * 2) * 10) / 10,
    reviews_count: 5 + (i % 15),
  }));
}

const ALL = gen(150);

export async function mockFetchListings(params) {
  const {
    q = "",
    category = "",
    location = "",
    price_min = 0,
    price_max = 9999,
    page = 1,
    per_page = 12,
    sort = "relevance",
  } = params || {};

  let items = ALL.filter(
    (it) =>
      it.title.toLowerCase().includes(String(q).toLowerCase()) &&
      (!category || it.category === category) &&
      (!location || it.location === location) &&
      it.price_per_day >= Number(price_min) &&
      it.price_per_day <= Number(price_max)
  );

  if (sort === "price_asc")
    items = items.sort((a, b) => a.price_per_day - b.price_per_day);
  if (sort === "price_desc")
    items = items.sort((a, b) => b.price_per_day - a.price_per_day);
  if (sort === "rating_desc") items = items.sort((a, b) => b.rating - a.rating);

  const total = items.length;
  const total_pages = Math.max(1, Math.ceil(total / per_page));
  const start = (page - 1) * per_page;
  const slice = items.slice(start, start + per_page);

  await new Promise((r) => setTimeout(r, 250)); // tiny delay to demo loader
  return { items: slice, page, per_page, total, total_pages };
}

export async function mockFetchCategories() {
  return CATS;
}
export async function mockFetchLocations() {
  return LOCS;
}
