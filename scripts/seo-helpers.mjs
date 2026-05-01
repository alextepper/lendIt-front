// Shared helpers used by both the sitemap generator and the prerender route
// builder. We isolate the (potentially flaky) network calls behind a small,
// well-defined surface so a backend hiccup never breaks the production build.

const DEFAULT_API =
  process.env.VITE_API_BASE_URL ||
  process.env.SITEMAP_API_BASE_URL ||
  "https://api.sharo-app.com";

const DEFAULT_SITE = process.env.SITE_URL || "https://www.sharo-app.com";

const STATIC_CATEGORIES = ["Tools", "Electronics", "Outdoors", "Games"];

const STATIC_ROUTES = [
  { path: "/", changefreq: "daily", priority: 1.0 },
  { path: "/search", changefreq: "daily", priority: 0.9 },
  { path: "/sell", changefreq: "daily", priority: 0.8 },
  { path: "/giveaway", changefreq: "daily", priority: 0.7 },
  { path: "/home", changefreq: "monthly", priority: 0.6 },
  { path: "/terms", changefreq: "yearly", priority: 0.3 },
  { path: "/privacy", changefreq: "yearly", priority: 0.3 },
];

function joinUrl(base, path) {
  if (!path) return base;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const cleanedBase = base.replace(/\/+$/, "");
  const cleanedPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanedBase}${cleanedPath}`;
}

async function fetchJson(url, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch active items from the backend for inclusion in the sitemap +
 * prerender list. Returns at most `limit` items, paginated as needed.
 * Returns an empty array if the backend is unreachable so the build still
 * succeeds.
 */
export async function fetchAllItems({
  apiBase = DEFAULT_API,
  limit = 5000,
  pageSize = 100,
} = {}) {
  const items = [];
  let page = 1;
  try {
    while (items.length < limit) {
      const url = joinUrl(apiBase, `/items?page=${page}&pageSize=${pageSize}`);
      const data = await fetchJson(url);
      const batch = (data && (data.data || data.items)) || [];
      if (!Array.isArray(batch) || batch.length === 0) break;
      items.push(...batch);
      const total =
        (data.pagination &&
          (data.pagination.total_pages || data.pagination.totalPages)) ||
        Math.ceil(((data.pagination && data.pagination.total) || 0) / pageSize);
      if (total && page >= total) break;
      if (batch.length < pageSize) break;
      page += 1;
    }
  } catch (err) {
    console.warn(
      `[seo] Failed to fetch items from ${apiBase}: ${err.message}. Continuing without dynamic item URLs.`
    );
    return [];
  }
  return items.slice(0, limit);
}

export async function fetchCategories({ apiBase = DEFAULT_API } = {}) {
  try {
    const url = joinUrl(apiBase, "/meta/categories");
    const data = await fetchJson(url);
    if (Array.isArray(data) && data.length > 0) return data;
    if (Array.isArray(data?.data) && data.data.length > 0) return data.data;
  } catch (err) {
    console.warn(
      `[seo] Failed to fetch categories from ${apiBase}: ${err.message}. Falling back to static category list.`
    );
  }
  return STATIC_CATEGORIES;
}

export function getStaticRoutes() {
  return [...STATIC_ROUTES];
}

export function getSiteUrl() {
  return DEFAULT_SITE.replace(/\/+$/, "");
}

export function categoryRoute(category) {
  return `/search?category=${encodeURIComponent(category)}`;
}

export function itemRoute(id) {
  return `/item/${id}`;
}
