export async function mockFetchRentals() {
  await new Promise((r) => setTimeout(r, 150));
  return [
    {
      id: 1,
      role: "outgoing",
      item: { id: 12, title: "PS5 Console", location: "Tel Aviv" },
      counterparty: { id: 7, name: "Dana Cohen" },
      date_from: "2024-12-15",
      date_to: "2024-12-18",
      total: 12000, // ₪120
      status: "approved",
    },
    {
      id: 2,
      role: "incoming",
      item: { id: 5, title: "Professional Drill", location: "Haifa" },
      counterparty: { id: 3, name: "Noam Levi" },
      date_from: "2024-12-10",
      date_to: "2024-12-12",
      total: 2000, // ₪20
      status: "approved",
    },
    {
      id: 3,
      role: "outgoing",
      item: { id: 8, title: "Mountain Bike", location: "Jerusalem" },
      counterparty: { id: 15, name: "Sarah Green" },
      date_from: "2024-11-28",
      date_to: "2024-12-01",
      total: 8000, // ₪80
      status: "completed",
    },
    {
      id: 4,
      role: "incoming",
      item: { id: 22, title: "Camera Lens", location: "Eilat" },
      counterparty: { id: 9, name: "David Miller" },
      date_from: "2024-11-20",
      date_to: "2024-11-22",
      total: 5000, // ₪50
      status: "completed",
    },
    {
      id: 5,
      role: "outgoing",
      item: { id: 33, title: "Camping Tent", location: "Netanya" },
      counterparty: { id: 12, name: "Rachel Brown" },
      date_from: "2024-11-15",
      date_to: "2024-11-17",
      total: 3000, // ₪30
      status: "requested",
    },
  ];
}
