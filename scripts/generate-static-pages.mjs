#!/usr/bin/env node
// Generate per-item static HTML files (e.g. dist/item/123/index.html) by
// rewriting the SEO-critical tags of the built index.html with each item's
// real title, description, image, canonical URL, and JSON-LD Product schema.
//
// Why: the SPA only sets these tags on the client via `useSeo`, which means
// crawlers and OpenGraph scrapers (Google's classic indexer, Facebook,
// WhatsApp, Slack, X, LinkedIn) often see the generic Sharo title instead
// of the real item title. Writing per-item index.html files lets nginx's
// `try_files $uri $uri/ /index.html` fallback serve the correct meta tags
// to crawlers without any runtime server logic.
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

  const seoTitle = `${title} – להשכרה ב-Sharo`;
  const fullTitle = `${seoTitle} | השכרת מוצרים בישראל`;
  const description = truncate(
    item.description ||
      `${title} להשכרה ב-Sharo${location ? ` באזור ${location}` : ""}. שכרו מהשכנים בישראל וחסכו כסף.`,
    160
  );
  const ogTitle = `${title} - להשכרה ב-Sharo`;
  const canonical = `${siteUrl}/item/${item.id}`;
  const image = getItemPhotoUrl(item, apiBase) || `${siteUrl}/logo.png`;

  const keywords = [
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
  return [
    "<noscript>",
    "  <article>",
    `    <h1>${safeTitle}</h1>`,
    `    <img src="${safeImage}" alt="${safeAlt}" width="600" />`,
    `    <p>${safeDescription}</p>`,
    `    ${priceLine}`,
    `    ${locationLine}`,
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
    const dir = path.join(distDir, "item", String(item.id));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "index.html"), html, "utf8");
    written += 1;
  }

  console.log(
    `[seo] Wrote ${written} per-item static HTML pages under ${path.join(distDir, "item")}/`
  );
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
