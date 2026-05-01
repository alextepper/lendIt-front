import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// vite-plugin-prerender@1.0.8 ships a broken ESM build (its `.mjs` uses
// `require()` at module load), so we always load the CJS entry via Node's
// createRequire helper instead of `await import("vite-plugin-prerender")`.
const requireCjs = createRequire(import.meta.url);

const isPrerender = process.env.PRERENDER === "true";

// Cap how many item pages we prerender at build time. Top-N items get a real
// static HTML snapshot for instant SEO; the long tail is still discoverable
// via the sitemap and rendered client-side.
const PRERENDER_ITEM_LIMIT = Number(process.env.PRERENDER_ITEM_LIMIT || 50);

async function buildPrerenderRoutes() {
  const baseRoutes = [
    "/",
    "/home",
    "/search",
    "/sell",
    "/giveaway",
    "/terms",
    "/privacy",
  ];

  try {
    const { fetchAllItems, fetchCategories, categoryRoute, itemRoute } =
      await import("./scripts/seo-helpers.mjs");

    const categories = await fetchCategories();
    const categoryRoutes = categories.map((c) => categoryRoute(c));

    const items = await fetchAllItems({ limit: PRERENDER_ITEM_LIMIT });
    const itemRoutes = items
      .filter(
        (i) =>
          i &&
          i.id &&
          !i.deletedAt &&
          !i.deleted_at &&
          i.isDeleted !== true &&
          i.isActive !== false
      )
      .map((i) => itemRoute(i.id));

    const all = Array.from(
      new Set([...baseRoutes, ...categoryRoutes, ...itemRoutes])
    );
    console.log(
      `[prerender] Will snapshot ${all.length} routes ` +
        `(${baseRoutes.length} static, ${categoryRoutes.length} categories, ${itemRoutes.length} items).`
    );
    return all;
  } catch (err) {
    console.warn(
      `[prerender] Failed to expand dynamic routes: ${err.message}. Falling back to static routes only.`
    );
    return baseRoutes;
  }
}

export default defineConfig(async () => {
  let prerenderPlugin = null;
  if (isPrerender) {
    const vitePrerenderModule = requireCjs("vite-plugin-prerender");
    const vitePrerender = vitePrerenderModule.default || vitePrerenderModule;
    const routes = await buildPrerenderRoutes();
    prerenderPlugin = vitePrerender({
      staticDir: path.resolve(__dirname, "dist"),
      outputDir: path.resolve(__dirname, "dist"),
      indexPath: path.resolve(__dirname, "dist", "index.html"),
      routes,
      renderer: new vitePrerender.PuppeteerRenderer({
        maxConcurrentRoutes: 4,
        renderAfterDocumentEvent: "prerender-ready",
        renderAfterTime: 12000,
        headless: true,
      }),
      postProcess(renderedRoute) {
        renderedRoute.route = renderedRoute.originalRoute;
        return renderedRoute;
      },
      minify: {
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeComments: true,
      },
    });
  }

  return {
    plugins: [vue(), ...(prerenderPlugin ? [prerenderPlugin] : [])],
    // Ensure correct asset + router base handling on hosts/subpaths.
    base: process.env.VITE_BASE_PATH || "/",
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Split heavy 3rd-party libs into their own chunks so the entry
          // chunk that the main page needs stays small. Leaflet is loaded
          // lazily by the SearchMap async component, so it lands on its
          // own chunk and isn't pulled into the initial paint.
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("leaflet")) return "leaflet";
            if (id.includes("bootstrap-icons")) return "bootstrap-icons";
            if (id.includes("/bootstrap/")) return "bootstrap";
            if (id.includes("socket.io-client")) return "socketio";
            if (id.includes("@stripe/stripe-js")) return "stripe";
            if (id.includes("vue-datepicker-next")) return "datepicker";
            if (
              id.includes("/vue/") ||
              id.includes("/vue-router/") ||
              id.includes("/vue-i18n/") ||
              id.includes("/pinia/") ||
              id.includes("/@vue/")
            ) {
              return "vue-vendor";
            }
            return "vendor";
          },
        },
      },
    },
    server: {
      proxy: {
        "/api": {
          target: process.env.VITE_API_BASE_URL,
          changeOrigin: true,
          secure: false,
          // Remove /api prefix when forwarding to backend
          // Frontend uses /api/auth/me -> backend receives /auth/me
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
