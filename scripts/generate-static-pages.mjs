#!/usr/bin/env node
// Generate per-item static HTML files (e.g. dist/item/123.html) by
// rewriting the SEO-critical tags of the built index.html with each item's
// real title, description, image, canonical URL, and JSON-LD Product schema.
//
// Why: the SPA only sets these tags on the client via `useSeo`, which means
// crawlers and OpenGraph scrapers (Google's classic indexer, Facebook,
// WhatsApp, Slack, X, LinkedIn) often see the generic Sharo title instead
// of the real item title. Writing per-item .html files lets nginx's
// `try_files $uri $uri.html $uri/ /index.html` fallback serve the correct
// meta tags to crawlers without any runtime server logic.
//
// We deliberately write FLAT files (`item/{id}.html`) rather than
// `item/{id}/index.html` because the directory variant triggers nginx's
// "missing trailing slash → 301" behavior, which on Railway leaks the
// internal hostname (e.g. http://lendit-front-production.up.railway.app:8080/…).
// A flat file matched via `$uri.html` serves with no redirect at all.
//
// Output dir is configurable via SITEMAP_OUTPUT_DIR (same env as the sitemap
// script) so it can run at build time (writes into ./dist) or at container
// startup (writes into /usr/share/nginx/html).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllItems, getSiteUrl } from "./seo-helpers.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = process.env.SITEMAP_OUTPUT_DIR
  ? path.resolve(process.env.SITEMAP_OUTPUT_DIR)
  : path.resolve(__dirname, "..", "dist");
const indexPath = path.join(distDir, "index.html");

const PAGE_LIMIT = Number(process.env.STATIC_PAGES_LIMIT) || 5000;

const CURRENCY_SYMBOLS = { ILS: "₪", USD: "$", EUR: "€", GBP: "£" };

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function truncate(s, max) {
  if (!s) return "";
  const flat = String(s).replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max - 1).trimEnd() + "…";
}

function getItemPhotoUrl(item, apiBase) {
  if (!item.photos || !item.photos.length) return null;
  const photo = item.photos[0];
  const raw = typeof photo === "string" ? photo : photo?.url;
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (!apiBase) return raw;
  return raw.startsWith("/") ? `${apiBase}${raw}` : `${apiBase}/${raw}`;
}

function getItemType(item) {
  if (item.type) return item.type;
  if ((item.sellPrice ?? item.sell_price) > 0) return "forSale";
  if ((item.pricePerDay ?? item.price_per_day) > 0) return "forRent";
  return "giveaway";
}

function normalizeTags(rawTags) {
  if (!rawTags) return [];
  const arr = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === "string"
      ? rawTags.split(/[,;]+/)
      : [];
  return arr
    .map((t) => (typeof t === "string" ? t : t?.name || t?.label || ""))
    .map((t) => t.trim())
    .filter(Boolean);
}

export function buildSeoForItem(item, siteUrl, apiBase) {
  const title = item.title || "פריט";
  const itemType = getItemType(item);
  const currency = item.currency || "ILS";
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const priceCents =
    itemType === "forSale"
      ? item.sellPrice ?? item.sell_price ?? 0
      : item.pricePerDay ?? item.price_per_day ?? 0;
  const priceShekel = Math.round((priceCents || 0) / 100);
  const location = item.address || item.location || "";
  const category = item.category || "";
  const tags = normalizeTags(item.tags);

  const seoTitle = `${title} – להשכרה ב-Sharo`;
  const fullTitle = `${seoTitle} | השכרת מוצרים בישראל`;
  const description = truncate(
    item.description ||
      `${title} להשכרה ב-Sharo${location ? ` באזור ${location}` : ""}${tags.length ? ` – ${tags.join(", ")}` : ""}. שכרו מהשכנים בישראל וחסכו כסף.`,
    160
  );
  const ogTitle = `${title} - להשכרה ב-Sharo`;
  const canonical = `${siteUrl}/item/${item.id}`;
  const image = getItemPhotoUrl(item, apiBase) || `${siteUrl}/logo.png`;

  // Tags get the highest weight here because they are user-curated synonyms
  // for the item (e.g. brand names like "Meta Quest 3", "מטה קווסט", "vr").
  const keywords = [
    ...tags,
    ...tags.map((t) => `${t} להשכרה`),
    `השכרת ${title}`,
    `${title} להשכרה`,
    category && `השכרת ${category}`,
    location && `השכרה ב${location}`,
    "השכרת ציוד",
    "השכרת מוצרים",
  ]
    .filter(Boolean)
    .join(", ");

  // JSON-LD Product schema for rich results in Google.
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description: item.description || description,
    image: image,
    sku: String(item.id),
    category: category || undefined,
    keywords: tags.length ? tags.join(", ") : undefined,
    brand: { "@type": "Brand", name: "Sharo" },
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: currency,
      price: priceShekel,
      priceSpecification:
        itemType === "forRent"
          ? {
              "@type": "UnitPriceSpecification",
              price: priceShekel,
              priceCurrency: currency,
              unitCode: "DAY",
              referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "DAY" },
            }
          : undefined,
      availability:
        item.isActive === false || item.status === "inactive"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      availableAtOrFrom: location
        ? {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: location, addressCountry: "IL" },
          }
        : undefined,
    },
  };
  if (item.ratingAvg && item.ratingCount) {
    productSchema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: item.ratingAvg,
      reviewCount: item.ratingCount,
    };
  }
  // Strip undefined entries for a cleaner JSON-LD blob.
  const cleanSchema = JSON.parse(JSON.stringify(productSchema));

  return {
    fullTitle,
    description,
    keywords,
    ogTitle,
    canonical,
    image,
    priceShekel,
    symbol,
    location,
    tags,
    schema: cleanSchema,
  };
}

// Build a small block of crawler-visible HTML to embed in the SPA root.
// Even with `<div id="app">…</div>` getting wiped on hydration, this content
// is in the initial HTML response and gives non-JS crawlers (and slow Googlebot
// renders) a real H1 + paragraph to index for the item.
function buildCrawlerVisibleBody(item, seo) {
  const safeTitle = escapeHtml(item.title || "פריט");
  const safeDescription = escapeHtml(item.description || seo.description);
  const safeLocation = escapeHtml(seo.location);
  const safeImage = escapeAttr(seo.image);
  const safeAlt = escapeAttr(item.title || "פריט");
  const priceLine = seo.priceShekel
    ? `<p><strong>מחיר:</strong> ${seo.symbol}${seo.priceShekel} ליום</p>`
    : "";
  const locationLine = safeLocation
    ? `<p><strong>מיקום:</strong> ${safeLocation}</p>`
    : "";
  const tagsLine =
    Array.isArray(seo.tags) && seo.tags.length > 0
      ? `<p><strong>תגיות:</strong> ${seo.tags.map((t) => escapeHtml(t)).join(", ")}</p>`
      : "";
  return [
    "<noscript>",
    "  <article>",
    `    <h1>${safeTitle}</h1>`,
    `    <img src="${safeImage}" alt="${safeAlt}" width="600" />`,
    `    <p>${safeDescription}</p>`,
    `    ${priceLine}`,
    `    ${locationLine}`,
    `    ${tagsLine}`,
    `    <p><a href="${escapeAttr(seo.canonical)}">צפו בפרטי הפריט המלאים</a></p>`,
    "  </article>",
    "</noscript>",
  ].join("\n");
}

export function rewriteHead(html, seo, item) {
  let out = html;

  // <title>
  out = out.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(seo.fullTitle)}</title>`
  );

  // <meta name="description">
  out = out.replace(
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${escapeAttr(seo.description)}" />`
  );

  // <meta name="keywords">
  if (/<meta\s+name=["']keywords["'][^>]*>/i.test(out)) {
    out = out.replace(
      /<meta\s+name=["']keywords["'][^>]*>/i,
      `<meta name="keywords" content="${escapeAttr(seo.keywords)}" />`
    );
  } else {
    out = out.replace(
      "</head>",
      `  <meta name="keywords" content="${escapeAttr(seo.keywords)}" />\n  </head>`
    );
  }

  // <link rel="canonical">
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(out)) {
    out = out.replace(
      /<link\s+rel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${escapeAttr(seo.canonical)}" />`
    );
  } else {
    out = out.replace(
      "</head>",
      `  <link rel="canonical" href="${escapeAttr(seo.canonical)}" />\n  </head>`
    );
  }

  // OpenGraph
  out = replaceOrInsertMeta(out, "og:type", "product", true);
  out = replaceOrInsertMeta(out, "og:url", seo.canonical, true);
  out = replaceOrInsertMeta(out, "og:title", seo.ogTitle, true);
  out = replaceOrInsertMeta(out, "og:description", seo.description, true);
  out = replaceOrInsertMeta(out, "og:image", seo.image, true);

  // Twitter
  out = replaceOrInsertMeta(out, "twitter:url", seo.canonical, false);
  out = replaceOrInsertMeta(out, "twitter:title", seo.ogTitle, false);
  out = replaceOrInsertMeta(out, "twitter:description", seo.description, false);
  out = replaceOrInsertMeta(out, "twitter:image", seo.image, false);

  // JSON-LD Product schema (insert just before </head>)
  const jsonLd = `<script type="application/ld+json">${JSON.stringify(seo.schema)}</script>`;
  out = out.replace("</head>", `  ${jsonLd}\n  </head>`);

  // Crawler-visible body content (replaces the existing <noscript> block)
  const crawlerBody = buildCrawlerVisibleBody(item, seo);
  if (/<noscript>[\s\S]*?<\/noscript>/i.test(out)) {
    out = out.replace(/<noscript>[\s\S]*?<\/noscript>/i, crawlerBody);
  } else {
    out = out.replace(
      '<div id="app">',
      `<div id="app">\n      ${crawlerBody}\n      `
    );
  }

  return out;
}

function replaceOrInsertMeta(html, name, content, isProperty) {
  const attr = isProperty ? "property" : "name";
  const re = new RegExp(`<meta\\s+${attr}=["']${escapeRegex(name)}["'][^>]*>`, "i");
  const tag = `<meta ${attr}="${name}" content="${escapeAttr(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace("</head>", `  ${tag}\n  </head>`);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Inject a "Featured items" section into the homepage noscript so Googlebot's
// fast first-pass crawler (which reads only the initial HTML, not the JS pass)
// can follow `<a href="/item/...">` links and discover every item directly
// from /. Without this, Google has to either wait for the JS render pass
// (days/weeks behind the initial crawl) or rely on the sitemap alone.
//
// Also emits an ItemList structured-data block so Google understands these
// are part of a curated listing, which is eligible for the "Sitelinks" /
// product carousel UI in search results.
// Markers used to make repeated runs idempotent (e.g. container restart that
// re-reads an already-enriched index.html). Anything between matching BEGIN
// and END markers is stripped before re-injecting.
const FEATURED_BEGIN = "<!-- BEGIN sharo-featured-items -->";
const FEATURED_END = "<!-- END sharo-featured-items -->";
const SCHEMA_BEGIN = "<!-- BEGIN sharo-itemlist-schema -->";
const SCHEMA_END = "<!-- END sharo-itemlist-schema -->";

function stripBetween(html, beginMarker, endMarker) {
  // Also consume any leading whitespace on the BEGIN line and the trailing
  // newline after END, otherwise repeated runs accumulate stray indent that
  // shifts the section right by 10 spaces each time.
  const re = new RegExp(
    `[ \\t]*${escapeRegex(beginMarker)}[\\s\\S]*?${escapeRegex(endMarker)}[ \\t]*\\n?`,
    "g"
  );
  return html.replace(re, "");
}

export function injectFeaturedItemsIntoHome(template, items, siteUrl, apiBase) {
  const safeItems = items.filter((it) => it && it.id);
  if (!safeItems.length) return template;

  // Strip any previously injected blocks first so this is safe to re-run.
  let out = stripBetween(template, FEATURED_BEGIN, FEATURED_END);
  out = stripBetween(out, SCHEMA_BEGIN, SCHEMA_END);

  const links = safeItems
    .map((it) => {
      const title = escapeHtml(it.title || "פריט");
      const href = escapeAttr(`/item/${it.id}`);
      const photo = getItemPhotoUrl(it, apiBase);
      const imgPart = photo
        ? ` <img src="${escapeAttr(photo)}" alt="${title}" width="80" loading="lazy" />`
        : "";
      return `              <li>${imgPart} <a href="${href}">${title}</a></li>`;
    })
    .join("\n");

  const featuredSection = [
    `          ${FEATURED_BEGIN}`,
    "          <section>",
    "            <h2>פריטים אחרונים להשכרה</h2>",
    "            <ul>",
    links,
    "            </ul>",
    "          </section>",
    `          ${FEATURED_END}`,
  ].join("\n");

  // Insert just before </main> inside <noscript>. If we can't find that
  // anchor (e.g. older index.html), fall back to inserting just before
  // </noscript>. If neither exists, insert before </body>.
  if (out.includes("        </main>\n      </noscript>")) {
    out = out.replace(
      "        </main>\n      </noscript>",
      `${featuredSection}\n        </main>\n      </noscript>`
    );
  } else if (out.includes("</noscript>")) {
    out = out.replace(
      "</noscript>",
      `<noscript>\n${featuredSection}\n      </noscript>\n`
    );
  } else {
    out = out.replace(
      "</body>",
      `<noscript>\n${featuredSection}\n      </noscript>\n  </body>`
    );
  }

  // ItemList JSON-LD - lets Google understand these are featured products
  // and may render them as a carousel in search results.
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "פריטים אחרונים להשכרה ב-Sharo",
    itemListElement: safeItems.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `${siteUrl}/item/${it.id}`,
      name: it.title || "פריט",
    })),
  };
  const jsonLd = [
    SCHEMA_BEGIN,
    `<script type="application/ld+json">${JSON.stringify(itemList)}</script>`,
    SCHEMA_END,
  ].join("\n  ");
  out = out.replace("</head>", `  ${jsonLd}\n  </head>`);

  return out;
}

async function main() {
  let template;
  try {
    template = await fs.readFile(indexPath, "utf8");
  } catch (err) {
    console.warn(
      `[seo] Cannot read template at ${indexPath}: ${err.message}. Skipping per-item HTML generation.`
    );
    process.exit(0);
  }

  const siteUrl = getSiteUrl();
  const apiBase =
    process.env.SITEMAP_API_BASE_URL ||
    process.env.VITE_API_BASE_URL ||
    "";

  const items = await fetchAllItems({ limit: PAGE_LIMIT });
  if (!items.length) {
    console.warn(
      "[seo] No items fetched; not writing any per-item static pages. " +
        "(Check VITE_API_BASE_URL / network access from this container.)"
    );
    return;
  }

  const itemsDir = path.join(distDir, "item");
  await fs.mkdir(itemsDir, { recursive: true });

  // Clean up legacy directory-style pages from earlier deploys
  // (item/{id}/index.html). These cause nginx to issue trailing-slash
  // 301 redirects, which on Railway leak the internal hostname.
  try {
    const entries = await fs.readdir(itemsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await fs.rm(path.join(itemsDir, entry.name), {
          recursive: true,
          force: true,
        });
      }
    }
  } catch {
    // First run, nothing to clean up
  }

  let written = 0;
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
    const seo = buildSeoForItem(item, siteUrl, apiBase);
    const html = rewriteHead(template, seo, item);
    await fs.writeFile(
      path.join(itemsDir, `${String(item.id)}.html`),
      html,
      "utf8"
    );
    written += 1;
  }

  console.log(
    `[seo] Wrote ${written} per-item static HTML pages as ${itemsDir}/{id}.html`
  );

  // Now also enrich the homepage so Googlebot can discover these items by
  // following plain <a href> links from `/`, not just via the sitemap.
  try {
    const featuredCount = Math.min(
      Number(process.env.HOME_FEATURED_LIMIT) || 24,
      items.length
    );
    const featured = items.slice(0, featuredCount);
    const enrichedHome = injectFeaturedItemsIntoHome(
      template,
      featured,
      siteUrl,
      apiBase
    );
    if (enrichedHome !== template) {
      await fs.writeFile(indexPath, enrichedHome, "utf8");
      console.log(
        `[seo] Injected ${featured.length} featured-item links + ItemList schema into homepage (${indexPath}).`
      );
    }
  } catch (err) {
    console.warn(`[seo] Could not enrich homepage: ${err.message}`);
  }
}

// Only auto-run when invoked directly (e.g. `node generate-static-pages.mjs`),
// not when imported as a module for testing.
const isDirectRun = (() => {
  try {
    const invoked = process.argv[1] && path.resolve(process.argv[1]);
    return invoked === __filename;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  main().catch((err) => {
    console.error("[seo] Failed to generate per-item static pages:", err);
    // Don't fail the container start; SPA still works without these files.
    process.exit(0);
  });
}
