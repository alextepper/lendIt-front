const LOREM = "Well-kept, fully functional. Includes standard accessories.";
function pics(id) {
  return Array.from({ length: 5 }).map(
    (_, i) => `https://picsum.photos/seed/item${id}_${i}/1280/720`
  );
}
function one(id) {
  const price = 10 + (id % 5) * 5;
  return {
    id,
    title:
      ["Drill", "PS5", "Mirrorless Camera", "Tent", "Lawn Mower"][id % 5] +
      " #" +
      id,
    description: LOREM,
    category: ["Tools", "Consoles", "Cameras", "Camping"][id % 4],
    location: ["Haifa", "Tel Aviv", "Jerusalem", "Afula", "Yokneam"][id % 5],
    price_per_day: price,
    photos: pics(id),
    owner: {
      id: 100 + id,
      name: `Owner ${id}`,
      rating: 4.5,
      avatar: `https://i.pravatar.cc/80?img=${(id % 70) + 1}`,
    },
    rating: 4.2,
    reviews_count: 37,
  };
}
export async function mockFetchItem(id) {
  await new Promise((r) => setTimeout(r, 200));
  return one(Number(id));
}
export async function mockFetchRelated(id, limit) {
  const base = Number(id) + 1;
  await new Promise((r) => setTimeout(r, 150));
  return Array.from({ length: limit }).map((_, i) => ({
    id: base + i,
    title: `Related #${base + i}`,
    price_per_day: 10 + ((base + i) % 5) * 5,
    thumbnail: `https://picsum.photos/seed/rel${base + i}/640/360`,
    category: ["Tools", "Consoles", "Cameras", "Camping"][(base + i) % 4],
    location: ["Haifa", "Tel Aviv", "Jerusalem", "Afula", "Yokneam"][
      (base + i) % 5
    ],
    rating: 3.5 + Math.random() * 1.5,
    reviews_count: 3 + (i % 9),
  }));
}
