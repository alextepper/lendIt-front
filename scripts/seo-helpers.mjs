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
    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    if (
      !contentType.includes("application/json") &&
      !body.trim().startsWith("{") &&
      !body.trim().startsWith("[")
    ) {
      // Looks like an HTML page (e.g. the SPA shell, an error page).
      // Throw a clearer error so the caller can try a different path.
      const preview = body.slice(0, 80).replace(/\s+/g, " ");
      throw new Error(
        `Non-JSON response (content-type=${contentType || "?"}): "${preview}…"`
      );
    }
    return JSON.parse(body);
  } finally {
    clearTimeout(timer);
  }
}

// Some deployments expose the API directly at the root (`/items`), others
// proxy it through `/api/items` (e.g. when the frontend and backend share
// the same hostname). We auto-detect by trying both paths the first time
// and caching the prefix that works.
let cachedApiPrefix = null;

async function fetchJsonAuto(apiBase, pathSuffix) {
  const candidates = cachedApiPrefix
    ? [cachedApiPrefix]
    : ["", "/api"];
  let lastErr = null;
  for (const prefix of candidates) {
    const url = joinUrl(apiBase, `${prefix}${pathSuffix}`);
    try {
      const data = await fetchJson(url);
      cachedApiPrefix = prefix;
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("All API path candidates failed");
}

// A single sitemap.xml is allowed up to 50,000 URLs by the sitemap protocol
// (https://www.sitemaps.org/protocol.html). Past that we have to switch to a
// sitemap index. Default the cap to that protocol limit so we ship as many
// items as possible by default.
const SITEMAP_PROTOCOL_MAX = 50000;

/**
 * Fetch active items from the backend for inclusion in the sitemap +
 * prerender list. Paginates through every page (no artificial cap by
 * default) and returns up to `limit` items. Tolerates API failure: if the
 * backend is unreachable we return whatever we already paged in (or `[]`)
 * so the build still succeeds.
 *
 * Override the default limit with the SITEMAP_ITEM_LIMIT env var.
 */
export async function fetchAllItems({
  apiBase = DEFAULT_API,
  limit = Number(process.env.SITEMAP_ITEM_LIMIT) || SITEMAP_PROTOCOL_MAX,
  pageSize = 200,
  maxPages = 1000,
} = {}) {
  const items = [];
  let page = 1;
  try {
    while (items.length < limit && page <= maxPages) {
      const data = await fetchJsonAuto(
        apiBase,
        `/items?page=${page}&pageSize=${pageSize}`
      );
      const batch = (data && (data.data || data.items)) || [];
      if (!Array.isArray(batch) || batch.length === 0) break;
      items.push(...batch);
      const totalPages =
        (data.pagination &&
          (data.pagination.total_pages || data.pagination.totalPages)) ||
        Math.ceil(((data.pagination && data.pagination.total) || 0) / pageSize);
      if (totalPages && page >= totalPages) break;
      if (batch.length < pageSize) break;
      page += 1;
    }
  } catch (err) {
    console.warn(
      `[seo] Failed to fetch items from ${apiBase} (page ${page}, tried prefixes: ${
        cachedApiPrefix !== null ? `"${cachedApiPrefix}"` : '"" and "/api"'
      }): ${err.message}. Returning ${items.length} items collected so far.`
    );
    return items.slice(0, limit);
  }
  return items.slice(0, limit);
}

export async function fetchCategories({ apiBase = DEFAULT_API } = {}) {
  try {
    const data = await fetchJsonAuto(apiBase, "/meta/categories");
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
