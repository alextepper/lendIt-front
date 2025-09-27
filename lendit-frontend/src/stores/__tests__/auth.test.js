import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "../auth";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock router
vi.mock("../router", () => ({
  default: {
    push: vi.fn(),
    replace: vi.fn(),
    currentRoute: { value: { fullPath: "/" } },
  },
}));

// Mock http
const mockHttp = {
  post: vi.fn(),
  get: vi.fn(),
};

vi.mock("../lib/http", () => ({
  default: mockHttp,
}));

describe("auth store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("starts unauthenticated", () => {
    const s = useAuthStore();
    expect(s.isAuthed).toBe(false);
    expect(s.user).toBe(null);
  });

  it("sets user state correctly", () => {
    const s = useAuthStore();
    const userData = {
      id: 1,
      email: "test@example.com",
      username: "Test User",
      role: "user",
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
    };

    s.user = userData;

    expect(s.isAuthed).toBe(true);
    expect(s.user).toEqual(userData);
  });

  it("handles fetchMe failure gracefully", async () => {
    const s = useAuthStore();

    // Mock failed fetchMe call
    mockHttp.get.mockRejectedValueOnce(new Error("Network error"));

    await expect(s.fetchMe()).rejects.toThrow("Network Error");
    expect(s.user).toBe(null);
    expect(s.isAuthed).toBe(false);
  });

  it("clears state on logout", async () => {
    const s = useAuthStore();
    s.user = { name: "Test" };

    // Mock successful logout call
    mockHttp.post.mockResolvedValueOnce({ data: {} });

    await s.logout();

    expect(s.user).toBe(null);
    expect(s.isAuthed).toBe(false);
    expect(localStorageMock.removeItem).not.toHaveBeenCalled(); // No localStorage with cookies
  });
});
