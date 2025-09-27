export async function mockFetchRentals() {
  await new Promise((r) => setTimeout(r, 150));
  return [
    {
      id: 1,
      role: "outgoing",
      item: { id: 12, title: "PS5" },
      counterparty: { id: 7, name: "Dana" },
      date_from: "2025-10-02",
      date_to: "2025-10-05",
      total: 120,
      status: "approved",
    },
    {
      id: 2,
      role: "incoming",
      item: { id: 5, title: "Drill" },
      counterparty: { id: 3, name: "Noam" },
      date_from: "2025-09-28",
      date_to: "2025-09-29",
      total: 20,
      status: "requested",
    },
  ];
}
