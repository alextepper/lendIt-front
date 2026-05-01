#!/usr/bin/env node
// Generate dist/sitemap.xml after `vite build`.
//
// Pulls active items + categories from the backend so search engines can
// discover deep links (item pages, category-filtered search pages). Tolerant
// of API failure: if the backend is unreachable we still emit a sitemap
// containing the static routes so the deploy isn't blocked.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchAllItems,
  fetchCategories,
  getStaticRoutes,
  getSiteUrl,
  categoryRoute,
  itemRoute,
} from "./seo-helpers.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "..", "dist");
const outputPath = path.join(distDir, "sitemap.xml");

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  const parts = [`    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority != null) parts.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${parts.join("\n")}\n  </url>`;
}

function toIsoDate(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

async function main() {
  const siteUrl = getSiteUrl();
  const today = new Date().toISOString().slice(0, 10);

  const entries = [];

  for (const route of getStaticRoutes()) {
    entries.push({
      loc: `${siteUrl}${route.path}`,
      lastmod: today,
      changefreq: route.changefreq,
      priority: route.priority,
    });
  }

  const categories = await fetchCategories();
  for (const category of categories) {
    entries.push({
      loc: `${siteUrl}${categoryRoute(category)}`,
      lastmod: today,
      changefreq: "weekly",
      priority: 0.7,
    });
  }

  const items = await fetchAllItems({ limit: 5000 });
  let activeItemCount = 0;
  for (const item of items) {
    if (!item || !item.id) continue;
    if (
      item.deletedAt ||
      item.deleted_at ||
      item.isDeleted === true ||
      item.deleted === true ||
      item.isActive === false
    ) {
      continue;
    }
    const lastmod =
      toIsoDate(item.updatedAt) ||
      toIsoDate(item.updated_at) ||
      toIsoDate(item.createdAt) ||
      toIsoDate(item.created_at) ||
      today;
    entries.push({
      loc: `${siteUrl}${itemRoute(item.id)}`,
      lastmod,
      changefreq: "weekly",
      priority: 0.6,
    });
    activeItemCount += 1;
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(urlEntry),
    "</urlset>",
    "",
  ].join("\n");

  await fs.mkdir(distDir, { recursive: true });
  await fs.writeFile(outputPath, xml, "utf8");

  console.log(
    `[seo] Wrote ${outputPath} with ${entries.length} URLs ` +
      `(static: ${getStaticRoutes().length}, categories: ${categories.length}, items: ${activeItemCount}).`
  );
}

main().catch((err) => {
  console.error("[seo] Failed to generate sitemap:", err);
  // Don't fail the build if sitemap generation crashes hard - emit a minimal
  // static-only sitemap so we still ship something usable.
  const siteUrl = getSiteUrl();
  const today = new Date().toISOString().slice(0, 10);
  const minimal = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...getStaticRoutes().map((r) =>
      urlEntry({
        loc: `${siteUrl}${r.path}`,
        lastmod: today,
        changefreq: r.changefreq,
        priority: r.priority,
      })
    ),
    "</urlset>",
    "",
  ].join("\n");
  fs.mkdir(distDir, { recursive: true })
    .then(() => fs.writeFile(outputPath, minimal, "utf8"))
    .then(() => {
      console.warn(`[seo] Wrote fallback sitemap to ${outputPath}.`);
      process.exit(0);
    })
    .catch(() => process.exit(0));
});
