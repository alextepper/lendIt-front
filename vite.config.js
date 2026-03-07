import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isPrerender = process.env.PRERENDER === "true";

export default defineConfig(async () => {
  let prerenderPlugin = null;
  if (isPrerender) {
    const vitePrerender = (await import("vite-plugin-prerender")).default;
    prerenderPlugin = vitePrerender({
      staticDir: path.resolve(__dirname, "dist"),
      outputDir: path.resolve(__dirname, "dist"),
      indexPath: path.resolve(__dirname, "dist", "index.html"),
      routes: ["/", "/home", "/search", "/terms", "/privacy"],
      renderer: new vitePrerender.PuppeteerRenderer({
        maxConcurrentRoutes: 4,
        renderAfterDocumentEvent: "prerender-ready",
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
    build: {
    sourcemap: false,
      chunkSizeWarningLimit: 900,
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
