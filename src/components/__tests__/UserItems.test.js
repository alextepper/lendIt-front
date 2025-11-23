import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import UserItems from "../UserItems.vue";
import { fetchListings } from "../../services/listingsService";

// Mock the listings service
vi.mock("../../services/listingsService", () => ({
  fetchListings: vi.fn(),
}));

// Mock router-link component
const mockRouterLink = {
  name: "router-link",
  template: "<a><slot /></a>",
  props: ["to"],
};

describe("UserItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    fetchListings.mockResolvedValue({ items: [], total: 0 });

    const wrapper = mount(UserItems, {
      global: {
        components: {
          "router-link": mockRouterLink,
        },
      },
    });

    expect(wrapper.find(".spinner-border").exists()).toBe(true);
    expect(wrapper.text()).toContain("Loading your items...");
  });

  it("renders empty state when no items", async () => {
    fetchListings.mockResolvedValue({ items: [], total: 0 });

    const wrapper = mount(UserItems, {
      global: {
        components: {
          "router-link": mockRouterLink,
        },
      },
    });

    // Wait for async operations
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(wrapper.text()).toContain("No items yet");
    expect(wrapper.text()).toContain(
      "Start earning by listing items for rent."
    );
    expect(wrapper.find("a").exists()).toBe(true);
  });

  it("renders items correctly", async () => {
    const mockItems = [
      {
        id: 1,
        title: "PS5 Console",
        price_per_day: 50,
        category: "Consoles",
        location: "Tel Aviv",
        thumbnail: "https://example.com/ps5.jpg",
        rating: 4.5,
        reviews_count: 10,
      },
      {
        id: 2,
        title: "Professional Drill",
        price_per_day: 20,
        category: "Tools",
        location: "Haifa",
        thumbnail: "https://example.com/drill.jpg",
        rating: 4.2,
        reviews_count: 5,
      },
    ];

    fetchListings.mockResolvedValue({ items: mockItems, total: 2 });

    const wrapper = mount(UserItems, {
      global: {
        components: {
          "router-link": mockRouterLink,
        },
      },
    });

    // Wait for async operations
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(wrapper.text()).toContain("PS5 Console");
    expect(wrapper.text()).toContain("Professional Drill");
    expect(wrapper.text()).toContain("My Items for Rent");
  });

  it("shows show more button when there are more than 4 items", async () => {
    const mockItems = [
      {
        id: 1,
        title: "Item 1",
        price_per_day: 10,
        category: "Tools",
        location: "Tel Aviv",
      },
      {
        id: 2,
        title: "Item 2",
        price_per_day: 20,
        category: "Tools",
        location: "Haifa",
      },
      {
        id: 3,
        title: "Item 3",
        price_per_day: 30,
        category: "Tools",
        location: "Jerusalem",
      },
      {
        id: 4,
        title: "Item 4",
        price_per_day: 40,
        category: "Tools",
        location: "Eilat",
      },
    ];

    fetchListings.mockResolvedValue({ items: mockItems, total: 8 });

    const wrapper = mount(UserItems, {
      global: {
        components: {
          "router-link": mockRouterLink,
        },
      },
    });

    // Wait for async operations
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const showMoreButton = wrapper.find("a");
    expect(showMoreButton.exists()).toBe(true);
    expect(showMoreButton.text()).toContain("Show More (8)");
  });

  it("does not show show more button when there are 4 or fewer items", async () => {
    const mockItems = [
      {
        id: 1,
        title: "Item 1",
        price_per_day: 10,
        category: "Tools",
        location: "Tel Aviv",
      },
      {
        id: 2,
        title: "Item 2",
        price_per_day: 20,
        category: "Tools",
        location: "Haifa",
      },
    ];

    fetchListings.mockResolvedValue({ items: mockItems, total: 2 });

    const wrapper = mount(UserItems, {
      global: {
        components: {
          "router-link": mockRouterLink,
        },
      },
    });

    // Wait for async operations
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that there's no "Show More" button in the header
    const showMoreButton = wrapper.find(".btn-outline-primary");
    expect(showMoreButton.exists()).toBe(false);
  });

  it("calls fetchListings with correct parameters", async () => {
    fetchListings.mockResolvedValue({ items: [], total: 0 });

    mount(UserItems, {
      global: {
        components: {
          "router-link": mockRouterLink,
        },
      },
    });

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fetchListings).toHaveBeenCalledWith({
      mine: true,
      page: 1,
      pageSize: 4,
    });
  });

  it("renders error state when fetch fails", async () => {
    fetchListings.mockRejectedValue(new Error("Failed to fetch"));

    const wrapper = mount(UserItems, {
      global: {
        components: {
          "router-link": mockRouterLink,
        },
      },
    });

    // Wait for async operations
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(wrapper.text()).toContain("Failed to fetch");
    expect(wrapper.find(".alert-danger").exists()).toBe(true);
  });
});
