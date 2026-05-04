import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'

/**
 * Composable for managing SEO metadata dynamically
 * Supports title, description, Open Graph tags, and JSON-LD structured data
 */
export function useSeo(options = {}) {
  const route = useRoute()
  const originalTitle = document.title
  const addedElements = []

  /**
   * Update page title
   */
  function updateTitle(title) {
    if (title) {
      document.title = title
    }
  }

  /**
   * Update or create a meta tag
   */
  function updateMetaTag(name, content, isProperty = false) {
    if (!content) return

    const attribute = isProperty ? 'property' : 'name'
    let element = document.querySelector(`meta[${attribute}="${name}"]`)
    
    if (!element) {
      element = document.createElement('meta')
      element.setAttribute(attribute, name)
      document.head.appendChild(element)
      addedElements.push(element)
    }
    
    element.setAttribute('content', content)
  }

  /**
   * Update or create the canonical link tag
   */
  function updateCanonical(href) {
    if (!href) return
    let link = document.querySelector('link[rel="canonical"]')
    const isPreExisting = !!link
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      document.head.appendChild(link)
      addedElements.push(link)
    } else if (!isPreExisting) {
      // Already added by us in a prior call within this view
    }
    link.setAttribute('href', href)
  }

  /**
   * Add JSON-LD structured data
   */
  function addStructuredData(data) {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(data)
    document.head.appendChild(script)
    addedElements.push(script)
    return script
  }

  /**
   * Update Product schema for item pages
   */
  function updateProductSchema(product) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.title,
      "description": product.description,
      "image": product.image || product.images || [],
      "offers": {
        "@type": "Offer",
        "price": product.price,
        "priceCurrency": "ILS",
        "availability": product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "url": product.url || window.location.href
      }
    }

    // Add rating if available
    if (product.rating && product.reviewCount) {
      schema.aggregateRating = {
        "@type": "AggregateRating",
        "ratingValue": product.rating,
        "reviewCount": product.reviewCount
      }
    }

    // Add category if available
    if (product.category) {
      schema.category = product.category
    }

    // Add location if available
    if (product.location) {
      schema.offers.availableAtOrFrom = {
        "@type": "Place",
        "address": product.location
      }
    }

    return addStructuredData(schema)
  }

  /**
   * Update all SEO tags
   */
  function updateSeo({
    title,
    description,
    keywords,
    ogTitle,
    ogDescription,
    ogImage,
    ogUrl,
    ogType,
    canonical,
    productSchema,
    structuredData,
  }) {
    if (title) {
      updateTitle(title)
    }

    if (description) {
      updateMetaTag('description', description)
    }

    if (keywords) {
      updateMetaTag('keywords', keywords)
    }

    if (ogTitle) {
      updateMetaTag('og:title', ogTitle, true)
      updateMetaTag('twitter:title', ogTitle)
    }

    if (ogDescription) {
      updateMetaTag('og:description', ogDescription, true)
      updateMetaTag('twitter:description', ogDescription)
    }

    if (ogImage) {
      updateMetaTag('og:image', ogImage, true)
      updateMetaTag('twitter:image', ogImage)
    }

    if (ogUrl) {
      updateMetaTag('og:url', ogUrl, true)
      updateMetaTag('twitter:url', ogUrl)
    }

    if (ogType) {
      updateMetaTag('og:type', ogType, true)
    }

    if (canonical) {
      updateCanonical(canonical)
    }

    if (productSchema) {
      updateProductSchema(productSchema)
    }

    if (structuredData) {
      addStructuredData(structuredData)
    }
  }

  /**
   * Cleanup function to restore original state
   */
  function cleanup() {
    // Restore original title
    document.title = originalTitle

    // Remove added elements
    addedElements.forEach(element => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element)
      }
    })
    addedElements.length = 0
  }

  // Initialize with provided options
  onMounted(() => {
    updateSeo(options)
  })

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  // Watch for route changes and cleanup
  watch(() => route.path, () => {
    // Cleanup when route changes
    cleanup()
  })

  return {
    updateSeo,
    updateTitle,
    updateMetaTag,
    updateCanonical,
    updateProductSchema,
    addStructuredData,
    cleanup
  }
}

/**
 * Build a fully-qualified canonical URL for the current site.
 * Uses window.location.origin in the browser; falls back to the production
 * host so prerendered HTML still gets a sensible canonical.
 */
export function buildCanonical(path = '/') {
  const origin =
    (typeof window !== 'undefined' && window.location && window.location.origin) ||
    'https://www.sharo-app.com'
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${origin}${cleanPath}`
}

/**
 * Helper function to generate SEO-friendly title for Israel market
 */
export function generateIsraelTitle(
  pageTitle,
  marketplaceTagline = 'השכרת מוצרים וציוד בישראל'
) {
  return `${pageTitle} | Sharo - ${marketplaceTagline}`
}

/**
 * Helper function to generate default Hebrew description
 */
export function generateIsraelDescription(customText = '') {
  const baseDescription = 'השכרת ציוד ומוצרים בין אנשים בישראל. חסכו כסף ושמרו על הסביבה.'
  return customText ? `${customText} - ${baseDescription}` : baseDescription
}
