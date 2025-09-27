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
vi.mock("../lib/http", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
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

  it("stores token on _afterAuth", async () => {
    const s = useAuthStore();
    const authData = {
      access_token: "abc123",
      refresh_token: "refresh123",
      user: { id: 1, name: "Test User", email: "test@example.com" },
    };

    await s._afterAuth(authData);

    expect(s.isAuthed).toBe(true);
    expect(s.token).toBe("abc123");
    expect(s.refreshToken).toBe("refresh123");
    expect(s.user?.name).toBe("Test User");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("token", "abc123");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "refresh_token",
      "refresh123"
    );
  });

  it("loads token from localStorage on init", () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === "token") return "stored-token";
      if (key === "refresh_token") return "stored-refresh";
      return null;
    });

    const s = useAuthStore();
    expect(s.token).toBe("stored-token");
    expect(s.refreshToken).toBe("stored-refresh");
  });

  it("clears state on logout", () => {
    const s = useAuthStore();
    s.token = "some-token";
    s.user = { name: "Test" };
    s.isAuthed = true;

    s.logout();

    expect(s.token).toBe(null);
    expect(s.user).toBe(null);
    expect(s.isAuthed).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("token");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("refresh_token");
  });
});
