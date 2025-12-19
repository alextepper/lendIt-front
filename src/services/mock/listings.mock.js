// Simple static mock you can switch on while backend isn't ready
const CATS = ["Tools", "Electronics", "Games", "Outdoors", "Other"];
const LOCS = ["Haifa", "Tel Aviv", "Jerusalem", "Afula", "Yokneam"];
const IMG = "https://picsum.photos/seed/seedNUM/640/360";

function gen(n = 42, isUserItems = false) {
  return Array.from({ length: n }).map((_, i) => {
    const baseItems = [
      "Professional Drill Set with 50+ Bits",
      "Sony PS5 Console with 2 Controllers",
      "Canon EOS R5 Mirrorless Camera",
      "4-Person Camping Tent",
      "Electric Lawn Mower",
    ];

    const descriptions = [
      "Complete professional drill set with 50+ high-quality bits. Perfect for home improvement projects and professional work. Includes carrying case and all accessories.",
      "Sony PlayStation 5 console with 2 wireless controllers. Includes 3 games and all original packaging. Excellent condition, barely used.",
      "Canon EOS R5 mirrorless camera with 24-70mm lens. Professional grade camera perfect for photography and videography. Includes memory cards and accessories.",
      "4-person camping tent in excellent condition. Waterproof, easy to set up, includes rain fly and ground tarp. Perfect for family camping trips.",
      "Electric lawn mower with grass collection bag. Cordless operation, lightweight and easy to use. Perfect for small to medium sized lawns.",
    ];

    return {
      id: `item_${i + 1}`,
      title: isUserItems ? baseItems[i % 5] : baseItems[i % 5] + " #" + (i + 1),
      description: isUserItems
        ? descriptions[i % 5]
        : `A great ${baseItems[i % 5].toLowerCase()} for rent.`,
      category: CATS[i % CATS.length].toUpperCase(),
      pricePerDay: ((i % 5) + 1) * 500, // 500, 1000, 1500, 2000, 2500 ILS
      currency: "ILS",
      deposit: ((i % 5) + 1) * 1000, // 1000, 2000, 3000, 4000, 5000 ILS
      latitude: 32.0853 + (Math.random() - 0.5) * 0.1,
      longitude: 34.7818 + (Math.random() - 0.5) * 0.1,
      address: LOCS[i % LOCS.length] + ", Israel",
      isActive: true,
      ratingAvg: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
      ratingCount: 5 + (i % 20),
      createdAt: new Date(
        Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000
      ).toISOString(),
      updatedAt: new Date(
        Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
      photos: [
        {
          id: `photo_${i + 1}_1`,
          url: IMG.replace("NUM", String(i + 1)),
          position: 0,
        },
      ],
      _count: {
        orders: Math.floor(Math.random() * 10),
        reviews: 5 + (i % 20),
      },
      // Legacy fields for backward compatibility
      price_per_day: ((i % 5) + 1) * 500,
      rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
      reviews_count: 5 + (i % 20),
      thumbnail: IMG.replace("NUM", String(i + 1)),
      location: LOCS[i % LOCS.length] + ", Israel",
      currency: "ILS",
      active: true,
      created_at: new Date(
        Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000
      ).toISOString(),
    };
  });
}

const ALL = gen(150);
const USER_ITEMS = gen(8, true); // Generate 8 user-specific items

export async function mockFetchListings(params) {
  const {
    q = "",
    category = "",
    location = "",
    price_min = 0,
    price_max = 9999,
    page = 1,
    per_page = 12,
    pageSize = 12, // Support both per_page and pageSize
    sort = "relevance",
    mine = false,
  } = params || {};

  // Use pageSize if provided, otherwise use per_page
  const itemsPerPage = pageSize || per_page;

  // Use user items if mine=true, otherwise use all items
  let items = mine ? USER_ITEMS : ALL;

  items = items.filter(
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
  const total_pages = Math.max(1, Math.ceil(total / itemsPerPage));
  const start = (page - 1) * itemsPerPage;
  const slice = items.slice(start, start + itemsPerPage);

  await new Promise((r) => setTimeout(r, 250)); // tiny delay to demo loader
  return { items: slice, page, per_page: itemsPerPage, total, total_pages };
}

export async function mockFetchCategories() {
  return CATS;
}
