# SEO Implementation Guide for Sharo (Israel Market)

## Overview

This document describes the SEO optimizations implemented for the Israeli market. All changes focus on improving search engine visibility, social media sharing, and providing rich structured data for Google and other search engines.

---

## 1. Global Meta Tags (index.html)

### Location
`index.html`

### Changes Made

#### HTML Lang and Dir Attributes
- Set `lang="he"` and `dir="rtl"` on the `<html>` tag for Hebrew language and RTL support

#### Title Tag
```html
<title>Sharo | השכרת מוצרים וציוד בין אנשים - להרוויח כסף מהציוד שלך</title>
```

#### Meta Description
Optimized for Israeli market with Hebrew keywords about equipment rental and passive income.

#### Keywords
Includes relevant Hebrew terms:
- השכרת ציוד
- השכרת כלי עבודה
- השכרת מוצרים
- הכנסה פסיבית
- כלכלה שיתופית
- השכרת מצלמות
- השכרת ציוד קמפינג

---

## 2. Multilingual SEO (Hreflang Tags)

Added hreflang tags to identify the Hebrew version for Israel:

```html
<link rel="alternate" hreflang="he-il" href="https://www.sharo-app.com/he" />
<link rel="alternate" hreflang="x-default" href="https://www.sharo-app.com/" />
```

**Note**: Update these URLs to match your actual domain structure.

---

## 3. Open Graph (OG) Tags for Social Media

### Facebook & WhatsApp Optimization

```html
<meta property="og:title" content="Sharo - פשוט לשכור, קל להרוויח" />
<meta property="og:description" content="הפלטפורמה הגדולה בישראל להשכרת ציוד ומוצרים בין אנשים. חסכו כסף ושמרו על הסביבה." />
<meta property="og:image" content="https://www.sharo-app.com/logo.png" />
```

### Twitter Cards
Added Twitter card meta tags for better Twitter/X sharing experience.

**Action Required**: 
- Replace `https://www.sharo-app.com/logo.png` with your actual high-resolution image (1200x630px recommended)
- Consider creating a dedicated OG image with Hebrew text overlay

---

## 4. JSON-LD Structured Data

### WebSite Schema
Helps Google understand the site structure and enables search box in search results:

```json
{
  "@type": "WebSite",
  "name": "Sharo",
  "url": "https://www.sharo-app.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://www.sharo-app.com/search?q={search_term_string}"
  }
}
```

### Organization Schema
Provides business information to search engines.

### Product Schema (Dynamic)
Automatically generated for each item page with:
- Product name and description
- Price in ILS
- Availability status
- Ratings and reviews count
- Location information

---

## 5. Landing Page Semantic Headers (Home.vue)

### SEO-Rich Hebrew Headers

#### Main H1
```html
<h1>השכרת מוצרים וציוד מהשכנים שלכם</h1>
```

#### Categories Section H2
```html
<h2>קטגוריות פופולריות להשכרה בישראל</h2>
```

#### How It Works Section H2
```html
<h2>איך זה עובד? השכירו מוצרים ב-3 צעדים פשוטים</h2>
```

#### Step-by-Step H3s
Three H3 headers explaining the rental process in Hebrew.

---

## 6. Hebrew Font Support (rtl.css)

### Added Fonts
Imported Google Fonts optimized for Hebrew:
- **Heebo** (primary)
- **Assistant** (secondary)

```css
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&family=Assistant:wght@300;400;600;700&display=swap');
```

### Font-Family Declaration
```css
html[lang="he"],
html[lang="he"] body,
.rtl {
    font-family: 'Heebo', 'Assistant', 'Segoe UI', Arial, sans-serif;
}
```

---

## 7. Dynamic SEO Composable (useSeo.js)

### Location
`src/composables/useSeo.js`

### Features
A reusable Vue composable for managing SEO metadata dynamically:

- **updateTitle()**: Update page title
- **updateMetaTag()**: Add/update meta tags
- **updateProductSchema()**: Generate Product schema for item pages
- **addStructuredData()**: Add any JSON-LD structured data
- **updateSeo()**: Update all SEO elements at once

### Helper Functions
- `generateIsraelTitle()`: Creates consistent Hebrew titles
- `generateIsraelDescription()`: Generates default Hebrew descriptions

### Usage Example

```vue
<script setup>
import { useSeo, generateIsraelTitle } from '@/composables/useSeo'

const { updateSeo } = useSeo()

// Update SEO for a specific page
updateSeo({
  title: generateIsraelTitle('שם המוצר'),
  description: 'תיאור המוצר בעברית',
  ogTitle: 'שם המוצר - להשכרה ב-Sharo',
  ogImage: 'https://example.com/image.jpg',
  productSchema: {
    title: 'שם המוצר',
    price: '50',
    available: true,
    rating: 4.5,
    reviewCount: 12
  }
})
</script>
```

---

## 8. Item Page SEO Integration (Item.vue)

### Features
Automatically generates SEO metadata for each item:

- **Dynamic Title**: "מוצר | Sharo - השכרת מוצרים וציוד בישראל"
- **Dynamic Description**: Includes item description, location, and price
- **Dynamic Keywords**: Generated from item title, category, and location
- **Product Schema**: Complete structured data for each item
- **Open Graph Tags**: Dynamic OG tags with item image and details

### Implementation
The `updateItemSeo()` function runs automatically when an item loads, extracting:
- Item title and description
- Price and location
- Photos for OG images
- Category and tags
- Rating and reviews

---

## 9. RTL Support

### Current Implementation
- `dir="rtl"` set on HTML element
- Hebrew fonts loaded and applied
- RTL-specific CSS in `assets/rtl.css`
- Language store (`stores/language.js`) handles dynamic dir attribute changes

### Verification
The app correctly switches between RTL and LTR based on the selected language.

---

## Testing Checklist

### 1. Meta Tags Validation
- [ ] Use [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) to test OG tags
- [ ] Use [Twitter Card Validator](https://cards-dev.twitter.com/validator) for Twitter cards
- [ ] Test how links appear in WhatsApp

### 2. Structured Data Validation
- [ ] Use [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Validate JSON-LD with [Schema.org validator](https://validator.schema.org/)

### 3. Search Engine Testing
- [ ] Test site in Google Search Console
- [ ] Verify hreflang implementation
- [ ] Check mobile-friendliness

### 4. Hebrew Font Rendering
- [ ] Verify Hebrew text displays correctly in Chrome, Firefox, Safari
- [ ] Check font weight and readability
- [ ] Test on mobile devices

---

## Next Steps & Recommendations

### 1. Update URLs
Replace placeholder URLs in `index.html`:
- Change `https://www.sharo-app.com` to your actual domain
- Update hreflang URLs to match your multilingual structure

### 2. Create High-Quality OG Image
- Create a 1200x630px image with:
  - Sharo logo
  - Hebrew text: "פשוט לשכור, קל להרוויח"
  - Brand colors
- Save as `/public/og-image.png`
- Update `og:image` meta tag

### 3. Add Favicon Sizes
Add more favicon sizes for better browser support:
```html
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
```

### 4. Enable Google Search Console
- Verify ownership of sharo-app.com
- Submit sitemap (create with a sitemap generator)
- Monitor search performance

### 5. Add Breadcrumbs Schema
For better navigation in search results:
```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://sharo-app.com" },
    { "@type": "ListItem", "position": 2, "name": "Category", "item": "..." }
  ]
}
```

### 6. Implement Canonical URLs
Add canonical tags to prevent duplicate content issues:
```html
<link rel="canonical" href="https://www.sharo-app.com/item/123" />
```

### 7. Create XML Sitemap
Generate and submit an XML sitemap with:
- Homepage
- All item pages
- Category pages
- Static pages (Terms, Privacy)

### 8. Monitor Performance
Use tools like:
- Google PageSpeed Insights
- Lighthouse (built into Chrome DevTools)
- GTmetrix

---

## Technical Notes

### Composable Cleanup
The `useSeo` composable automatically cleans up:
- Restores original title on unmount
- Removes dynamically added meta tags
- Clears JSON-LD scripts when navigating away

This prevents SEO tag conflicts when navigating between pages.

### Server-Side Rendering (SSR)
For better SEO, consider implementing SSR with:
- **Nuxt.js** (if migrating to Nuxt)
- **Vite SSR** (for current setup)

This ensures search engines can crawl all content, especially dynamic item pages.

---

## Contact

For questions or issues related to this SEO implementation, please refer to this document or consult the codebase.

---

**Last Updated**: February 3, 2026  
**Version**: 1.0
