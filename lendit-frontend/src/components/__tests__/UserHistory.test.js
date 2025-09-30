import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import UserHistory from "../UserHistory.vue";
import { fetchRentals } from "../../services/rentalsService";
import { fetchUserBookings } from "../../services/bookingService";

// Mock the services
vi.mock("../../services/rentalsService", () => ({
  fetchRentals: vi.fn(),
}));

vi.mock("../../services/bookingService", () => ({
  fetchUserBookings: vi.fn(),
}));

describe("UserHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    fetchRentals.mockResolvedValue([]);
    fetchUserBookings.mockResolvedValue({ bookings: [] });

    const wrapper = mount(UserHistory);

    expect(wrapper.find(".spinner-border").exists()).toBe(true);
    expect(wrapper.text()).toContain("Loading history...");
  });

  it("renders empty state when no history", async () => {
    fetchRentals.mockResolvedValue([]);
    fetchUserBookings.mockResolvedValue({ bookings: [] });

    const wrapper = mount(UserHistory);

    // Wait for async operations
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(wrapper.text()).toContain("No history yet");
    expect(wrapper.text()).toContain(
      "Your rental and lending history will appear here."
    );
  });

  it("renders history items correctly", async () => {
    const mockRentals = [
      {
        id: 1,
        role: "outgoing",
        item: { id: 12, title: "PS5 Console", location: "Tel Aviv" },
        counterparty: { id: 7, name: "Dana Cohen" },
        date_from: "2024-12-15",
        date_to: "2024-12-18",
        total: 12000,
        status: "approved",
      },
    ];

    const mockBookings = [
      {
        id: "booking_1",
        status: "ACTIVE",
        total: 150000,
        from: "2024-12-15",
        to: "2024-12-18",
        nights: 3,
        guests: 2,
        itemId: "item_1",
        item: {
          title: "Professional Camera Kit",
          location: "Tel Aviv",
        },
        createdAt: "2024-11-20T10:30:00Z",
      },
    ];

    fetchRentals.mockResolvedValue(mockRentals);
    fetchUserBookings.mockResolvedValue({ bookings: mockBookings });

    const wrapper = mount(UserHistory);

    // Wait for async operations
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(wrapper.text()).toContain("PS5 Console");
    expect(wrapper.text()).toContain("Professional Camera Kit");
    expect(wrapper.text()).toContain("Dana Cohen");
  });

  it("filters history by tab correctly", async () => {
    const mockRentals = [
      {
        id: 1,
        role: "outgoing",
        item: { id: 12, title: "PS5 Console", location: "Tel Aviv" },
        counterparty: { id: 7, name: "Dana Cohen" },
        date_from: "2024-12-15",
        date_to: "2024-12-18",
        total: 12000,
        status: "approved",
      },
    ];

    const mockBookings = [
      {
        id: "booking_1",
        status: "ACTIVE",
        total: 150000,
        from: "2024-12-15",
        to: "2024-12-18",
        nights: 3,
        guests: 2,
        itemId: "item_1",
        item: {
          title: "Professional Camera Kit",
          location: "Tel Aviv",
        },
        createdAt: "2024-11-20T10:30:00Z",
      },
    ];

    fetchRentals.mockResolvedValue(mockRentals);
    fetchUserBookings.mockResolvedValue({ bookings: mockBookings });

    const wrapper = mount(UserHistory);

    // Wait for async operations
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Test rents filter
    await wrapper.find('button[data-testid="rents-tab"]').trigger("click");
    expect(wrapper.text()).toContain("Professional Camera Kit");
    expect(wrapper.text()).not.toContain("PS5 Console");

    // Test lends filter
    await wrapper.find('button[data-testid="lends-tab"]').trigger("click");
    expect(wrapper.text()).toContain("PS5 Console");
    expect(wrapper.text()).not.toContain("Professional Camera Kit");
  });
});
