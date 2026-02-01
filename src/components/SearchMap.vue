<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getImageUrl } from '../utils/imageUtils';

const props = defineProps({
  userLocation: {
    type: Object,
    default: null, // { lat, lng }
  },
  items: {
    type: Array,
    default: () => [],
  },
  radiusKm: {
    type: Number,
    default: 15,
  },
});

const emit = defineEmits(['location-changed']);

const mapContainer = ref(null);
let map = null;
let userMarker = null;
let radiusCircle = null;
let itemMarkers = [];
let isInitializing = true; // Track if map is initializing

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Reinitialize map when component becomes visible
let observer = null;

onMounted(async () => {
  await nextTick();
  // Wait for DOM to be fully ready and visible
  const init = () => {
    if (mapContainer.value) {
      if (mapContainer.value.offsetParent !== null || mapContainer.value.offsetWidth > 0) {
        initMap();
      } else {
        // Retry if container is not visible yet
        setTimeout(init, 100);
      }
    }
  };
  setTimeout(init, 200);

  // Set up IntersectionObserver to reinitialize when map becomes visible
  nextTick(() => {
    if (mapContainer.value && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !map && mapContainer.value) {
            setTimeout(() => {
              initMap();
            }, 100);
          } else if (entry.isIntersecting && map) {
            // Invalidate size when map becomes visible
            setTimeout(() => {
              if (map) {
                map.invalidateSize();
              }
            }, 100);
          }
        });
      }, { threshold: 0.1 });
      observer.observe(mapContainer.value);
    }
  });
});

function initMap() {
  if (!mapContainer.value) {
    console.error('Map container element not found');
    return;
  }

  // Check if map already exists
  if (map) {
    map.remove();
    map = null;
  }

  // Default center (Tel Aviv)
  const defaultCenter = [32.0853, 34.7818];
  const center = props.userLocation && props.userLocation.lat && props.userLocation.lng
    ? [props.userLocation.lat, props.userLocation.lng]
    : defaultCenter;
  
  try {
    map = L.map(mapContainer.value, {
      center,
      zoom: props.userLocation && props.userLocation.lat ? 12 : 10,
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Invalidate size to ensure map renders correctly after container is visible
    setTimeout(() => {
      if (map) {
        map.invalidateSize();
        // Force a resize event
        window.dispatchEvent(new Event('resize'));
      }
    }, 300);

    // Update markers when props change
    updateMarkers();
  } catch (error) {
    console.error('Error initializing map:', error);
  }
}

// Helper function to calculate distance between two lat/lng points in meters
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function to calculate spiral offset positions
function getSpiralOffsets(count, baseOffset = 0.0009) {
  const offsets = [];
  
  if (count === 1) {
    offsets.push({ lat: 0, lng: 0 });
    return offsets;
  }
  
  // Use golden angle spiral for even distribution
  // This ensures markers are evenly spaced around a circle
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // Golden angle for even distribution
  
  for (let i = 0; i < count; i++) {
    const angle = i * goldenAngle;
    // Calculate radius to create a spiral pattern
    // For small counts, use fixed radius; for larger, spiral outward
    let radius;
    if (count <= 6) {
      // For 2-6 markers, arrange in a circle
      radius = baseOffset;
    } else {
      // For more markers, create spiral
      const ring = Math.floor(i / 6);
      radius = baseOffset * (1 + ring * 0.5);
    }
    
    offsets.push({
      lat: radius * Math.cos(angle),
      lng: radius * Math.sin(angle)
    });
  }
  
  return offsets;
}

// Function to group markers by proximity and calculate offsets
function calculateMarkerOffsets(items) {
  const threshold = 50; // Distance in meters to consider markers as overlapping
  const groups = [];
  const processed = new Set();
  
  items.forEach((item, index) => {
    if (!item.latitude || !item.longitude || processed.has(index)) return;
    
    const group = [index];
    processed.add(index);
    
    // Find all items close to this one
    items.forEach((otherItem, otherIndex) => {
      if (index === otherIndex || processed.has(otherIndex) || !otherItem.latitude || !otherItem.longitude) return;
      
      const distance = getDistance(
        item.latitude, item.longitude,
        otherItem.latitude, otherItem.longitude
      );
      
      if (distance < threshold) {
        group.push(otherIndex);
        processed.add(otherIndex);
      }
    });
    
    if (group.length > 1) {
      groups.push({
        centerLat: item.latitude,
        centerLng: item.longitude,
        indices: group
      });
    }
  });
  
  // Calculate offsets for each group
  const offsets = new Map();
  groups.forEach(group => {
    const spiralOffsets = getSpiralOffsets(group.indices.length);
    group.indices.forEach((index, i) => {
      offsets.set(index, {
        lat: group.centerLat + spiralOffsets[i].lat,
        lng: group.centerLng + spiralOffsets[i].lng
      });
    });
  });
  
  return offsets;
}

function updateMarkers() {
  if (!map) return;

  // Clear existing markers
  if (userMarker) {
    map.removeLayer(userMarker);
    userMarker = null;
  }
  if (radiusCircle) {
    map.removeLayer(radiusCircle);
    radiusCircle = null;
  }
  itemMarkers.forEach(marker => map.removeLayer(marker));
  itemMarkers = [];

  // Add user location marker (draggable)
  if (props.userLocation && props.userLocation.lat && props.userLocation.lng) {
    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: `
        <div class="user-marker-container">
          <div class="user-marker-pulse"></div>
          <div class="user-marker-dot"></div>
          <div class="user-marker-drag-hint">
            <i class="bi bi-arrows-move"></i>
            <span>Drag</span>
          </div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    userMarker = L.marker(
      [props.userLocation.lat, props.userLocation.lng],
      { 
        icon: userIcon,
        draggable: true,
        title: 'Drag to change search center'
      }
    ).addTo(map);

    // Handle marker drag
    let dragTimeout = null;
    userMarker.on('drag', () => {
      // Update radius circle position while dragging
      if (radiusCircle && userMarker) {
        const newPos = userMarker.getLatLng();
        radiusCircle.setLatLng(newPos);
      }
    });

    userMarker.on('dragend', () => {
      if (userMarker && !isInitializing) {
        const newPos = userMarker.getLatLng();
        const newLocation = {
          lat: newPos.lat,
          lng: newPos.lng,
          address: null
        };
        
        // Emit the new location (only if not initializing)
        emit('location-changed', newLocation);
        
        // Update radius circle position
        if (radiusCircle) {
          radiusCircle.setLatLng(newPos);
        }
        
        // Try to get address for new location (non-blocking)
        // Don't emit again - just update the address silently
        // The parent component will handle address updates separately
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newPos.lat}&lon=${newPos.lng}&zoom=18&addressdetails=1&accept-language=en`
        )
          .then(response => response.json())
          .then(data => {
            if (data && data.display_name) {
              newLocation.address = data.display_name;
              // Only emit if address was successfully fetched, but parent should ignore duplicate coordinates
              emit('location-changed', newLocation);
            }
          })
          .catch(e => {
            console.warn('Failed to get address for dragged location:', e);
          });
      }
    });

    // Add radius circle
    if (props.radiusKm) {
      radiusCircle = L.circle(
        [props.userLocation.lat, props.userLocation.lng],
        {
          radius: props.radiusKm * 1000, // Convert km to meters
          color: '#4285F4',
          fillColor: '#4285F4',
          fillOpacity: 0.1,
          weight: 2,
        }
      ).addTo(map);
    }

    // Center map on user location
    map.setView([props.userLocation.lat, props.userLocation.lng], 12);
  }

  // Calculate offsets for overlapping markers
  const markerOffsets = calculateMarkerOffsets(props.items);

  // Add item markers
  props.items.forEach((item, index) => {
    if (item.latitude && item.longitude) {
      // Use offset position if markers are overlapping, otherwise use original position
      const offset = markerOffsets.get(index);
      const markerLat = offset ? offset.lat : item.latitude;
      const markerLng = offset ? offset.lng : item.longitude;
      // Get photo URL from runtime config or fallback to build-time env var
      const baseURL = 
        (typeof window !== 'undefined' && window.__API_BASE_URL__) || 
        import.meta.env.VITE_API_BASE_URL || 
        '';
      let photoUrl = null;
      if (item.photos && item.photos.length > 0) {
        const photo = item.photos[0];
        if (photo.url) {
          if (photo.url.startsWith('http')) {
            photoUrl = photo.url;
          } else {
            photoUrl = baseURL 
              ? `${baseURL}${photo.url.startsWith('/') ? '' : '/'}${photo.url}`
              : photo.url.startsWith('/') ? photo.url : `/${photo.url}`;
          }
        }
      }

      // Create marker with item photo or fallback icon
      const itemIcon = L.divIcon({
        className: 'item-marker',
        html: `
          <div class="item-marker-content" style="background: white; border: 3px solid #4285F4; border-radius: 50%; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3); overflow: hidden; position: relative;">
            ${photoUrl ? `
              <img src="${photoUrl}" alt="${item.title || 'Item'}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />
            ` : `
              <i class="bi bi-geo-alt-fill" style="color: #4285F4; font-size: 24px;"></i>
            `}
          </div>
        `,
        iconSize: [56, 56],
        iconAnchor: [28, 56],
      });

      const marker = L.marker([markerLat, markerLng], {
        icon: itemIcon,
      }).addTo(map);

      // Add popup with item info and image
      const safePhotoUrl = photoUrl ? photoUrl.replace(/"/g, '&quot;') : '';
      const safeTitle = (item.title || 'Item').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const price = (item.pricePerDay || item.price_per_day || 0) / 100;
      const currency = item.currency || 'ILS';
      const distance = item.distance ? item.distance.toFixed(1) : null;
      const rating = item.rating ? item.rating.toFixed(1) : null;
      const reviewsCount = item.reviews_count || 0;
      
      const currencySymbols = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };
      const currencySymbol = currencySymbols[currency] || currency;
      const distanceInMiles = distance ? (distance * 0.621371).toFixed(1) : null;
      
      const popupContent = `
        <div class="map-popup">
          <div class="map-popup-image-container">
            ${photoUrl ? `
              <img src="${safePhotoUrl}" alt="${safeTitle}" class="map-popup-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
              <div class="map-popup-image-placeholder" style="display: none;">
                <i class="bi bi-image"></i>
              </div>
            ` : `
              <div class="map-popup-image-placeholder">
                <i class="bi bi-image"></i>
              </div>
            `}
          </div>
          <div class="map-popup-content">
            <div class="map-popup-body">
              ${item.category ? `<span class="map-popup-category">${item.category.toUpperCase()}</span>` : ''}
              <h3 class="map-popup-title">${safeTitle}</h3>
              <div class="map-popup-footer">
                <div class="map-popup-price-wrapper">
                  <span class="map-popup-price-amount">${currencySymbol}${price.toFixed(0)}</span>
                  <span class="map-popup-price-period">/day</span>
                </div>
                ${distance ? `
                  <div class="map-popup-distance">
                    <i class="bi bi-geo-alt"></i>
                    <span>${distance} km away</span>
                  </div>
                ` : ''}
              </div>
              <button onclick="window.location.href='/item/${item.id}'" class="map-popup-button" type="button">
                View Details
                <i class="bi bi-arrow-right map-popup-button-icon"></i>
              </button>
            </div>
          </div>
        </div>
      `;
      marker.bindPopup(popupContent);

      itemMarkers.push(marker);
    }
  });

  // Fit bounds to show all markers if there are items
  if (itemMarkers.length > 0 || userMarker) {
    const group = L.featureGroup([...itemMarkers, ...(userMarker ? [userMarker] : [])]);
    if (group.getLayers().length > 0) {
      try {
        map.fitBounds(group.getBounds().pad(0.1));
      } catch (e) {
        // If bounds calculation fails, just center on user location or first item
        if (userMarker) {
          map.setView([props.userLocation.lat, props.userLocation.lng], 12);
        } else if (itemMarkers.length > 0) {
          const firstItem = props.items.find(item => item.latitude && item.longitude);
          if (firstItem) {
            map.setView([firstItem.latitude, firstItem.longitude], 12);
          }
        }
      }
    }
  }
  
  // Mark initialization as complete after markers are updated
  if (isInitializing) {
    setTimeout(() => {
      isInitializing = false;
    }, 500);
  }
}

// Watch for changes in props
watch(() => [props.userLocation, props.items, props.radiusKm], (newVal, oldVal) => {
  if (map) {
    // Check if location actually changed
    const locationChanged = props.userLocation && 
      (!oldVal || !oldVal[0] || 
       oldVal[0]?.lat !== props.userLocation.lat || 
       oldVal[0]?.lng !== props.userLocation.lng);
    
    updateMarkers();
    
    // If location changed, center map on new location
    if (locationChanged && props.userLocation && props.userLocation.lat && props.userLocation.lng) {
      setTimeout(() => {
        if (map) {
          map.setView([props.userLocation.lat, props.userLocation.lng], 12);
          map.invalidateSize();
        }
      }, 100);
    } else {
      // Just invalidate size when items change
      setTimeout(() => {
        if (map) {
          map.invalidateSize();
        }
      }, 100);
    }
  }
}, { deep: true });

// Watch for map container visibility changes and reinitialize if needed
watch(() => mapContainer.value, (newVal) => {
  if (newVal && !map) {
    setTimeout(() => {
      initMap();
    }, 200);
  }
});

onUnmounted(() => {
  if (observer && mapContainer.value) {
    observer.unobserve(mapContainer.value);
    observer = null;
  }
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<template>
  <div ref="mapContainer" class="search-map"></div>
</template>

<style scoped>
.search-map {
  width: 100%;
  height: 100%;
  min-height: 500px;
  border-radius: 0.5rem;
  overflow: hidden;
  z-index: 0;
  position: relative;
}

/* Ensure Leaflet map container has proper dimensions */
:deep(.leaflet-container) {
  width: 100%;
  height: 100%;
  min-height: 500px;
  border-radius: 0.5rem;
}

:deep(.user-location-marker) {
  background: transparent;
  border: none;
  cursor: move !important;
}

:deep(.leaflet-marker-dragging) {
  cursor: move !important;
}

:deep(.user-marker-container) {
  position: relative;
  width: 24px;
  height: 24px;
}

:deep(.user-marker-pulse) {
  position: absolute;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #4285F4;
  opacity: 0.4;
  animation: pulse 2s infinite;
  transform: translate(-50%, -50%);
  left: 50%;
  top: 50%;
}

:deep(.user-marker-dot) {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #4285F4;
  border: 3px solid white;
  transform: translate(-50%, -50%);
  left: 50%;
  top: 50%;
  z-index: 2;
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.4);
  transition: transform 0.2s ease;
}

:deep(.user-location-marker:hover) .user-marker-dot {
  transform: translate(-50%, -50%) scale(1.1);
  box-shadow: 0 3px 12px rgba(66, 133, 244, 0.6);
}

:deep(.user-marker-drag-hint) {
  position: absolute;
  bottom: -32px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #4285F4 0%, #1a73e8 100%);
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
  display: flex;
  align-items: center;
  gap: 4px;
  letter-spacing: 0.3px;
}

:deep(.user-marker-drag-hint::before) {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid #4285F4;
}

:deep(.user-marker-drag-hint i) {
  font-size: 12px;
}

:deep(.user-location-marker:hover) .user-marker-drag-hint {
  opacity: 1;
  transform: translateX(-50%) translateY(-2px);
}

:deep(.leaflet-marker-dragging) .user-marker-drag-hint {
  opacity: 1;
  background: linear-gradient(135deg, #34a853 0%, #2d8f47 100%);
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 4px 12px rgba(52, 168, 83, 0.4);
}

:deep(.leaflet-marker-dragging) .user-marker-drag-hint::before {
  border-bottom-color: #34a853;
}

:deep(.leaflet-marker-dragging) .user-marker-drag-hint span::after {
  content: 'ging...';
}

.user-marker-drag-hint {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}

:deep(.user-location-marker:hover) .user-marker-drag-hint {
  opacity: 1;
}

:deep(.leaflet-marker-dragging) .user-marker-drag-hint {
  opacity: 1;
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.6;
  }
  100% {
    transform: translate(-50%, -50%) scale(2);
    opacity: 0;
  }
}

:deep(.item-marker) {
  background: transparent;
  border: none;
}

:deep(.item-marker-content) {
  background: white !important;
  border: 3px solid #4285F4 !important;
  border-radius: 50% !important;
  width: 56px !important;
  height: 56px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3) !important;
  transition: transform 0.2s ease, box-shadow 0.2s ease !important;
  overflow: hidden !important;
  position: relative !important;
}

:deep(.item-marker-content:hover) {
  transform: scale(1.1) !important;
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.5) !important;
}

:deep(.item-marker-image) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  border-radius: 50% !important;
}

:deep(.item-marker-content i) {
  color: #4285F4 !important;
  font-size: 24px !important;
}

:deep(.map-popup) {
  width: 288px;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

:deep(.map-popup:hover) {
  transform: translateY(-4px);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
}

:deep(.map-popup-image-container) {
  position: relative;
  height: 176px;
  overflow: hidden;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
}

:deep(.map-popup-image) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 16px 16px 0 0;
  transition: transform 0.3s ease;
}

:deep(.map-popup:hover .map-popup-image) {
  transform: scale(1.05);
}

:deep(.map-popup-image-placeholder) {
  width: 100%;
  height: 176px;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
}

:deep(.map-popup-image-placeholder i) {
  font-size: 3rem;
  opacity: 0.5;
}

:deep(.map-popup-content) {
  padding: 1rem;
  background: white;
}

:deep(.map-popup-body) {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

:deep(.map-popup-category) {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  width: fit-content;
}

:deep(.map-popup-title) {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
  color: #0f172a;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

:deep(.map-popup-footer) {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

:deep(.map-popup-price-wrapper) {
  display: flex;
  flex-direction: column;
}

:deep(.map-popup-price-amount) {
  font-size: 1.25rem;
  font-weight: 700;
  color: #2563eb;
  line-height: 1;
}

:deep(.map-popup-price-period) {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.125rem;
}

:deep(.map-popup-distance) {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
}

:deep(.map-popup-distance i) {
  font-size: 0.75rem;
  color: #94a3b8;
}

:deep(.map-popup-button) {
  width: 100%;
  padding: 0.625rem 1rem;
  border: 2px solid #2563eb;
  background: transparent;
  color: #2563eb;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

:deep(.map-popup-button:hover) {
  background: #2563eb;
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

:deep(.map-popup-button:active) {
  transform: translateY(0);
}

:deep(.map-popup-button-icon) {
  font-size: 0.875rem;
  transition: transform 0.2s ease;
}

:deep(.map-popup-button:hover .map-popup-button-icon) {
  transform: translateX(4px);
}

:deep(.leaflet-popup-content-wrapper) {
  padding: 0;
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2) !important;
  background: transparent;
}

:deep(.leaflet-popup-content) {
  margin: 0;
  width: auto !important;
}

:deep(.leaflet-popup-tip) {
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Dark mode styles */
:global([data-bs-theme="dark"]) .map-popup {
  background: #1e293b !important;
  border-color: rgba(51, 65, 85, 0.5) !important;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5) !important;
}

:global([data-bs-theme="dark"]) .map-popup-content {
  background: #1e293b !important;
}

:global([data-bs-theme="dark"]) .map-popup-title {
  color: #f8fafc !important;
}

:global([data-bs-theme="dark"]) .map-popup-category {
  background: rgba(59, 130, 246, 0.2) !important;
  color: #93c5fd !important;
}

:global([data-bs-theme="dark"]) .map-popup-price-amount {
  color: #60a5fa !important;
}

:global([data-bs-theme="dark"]) .map-popup-price-period,
:global([data-bs-theme="dark"]) .map-popup-distance {
  color: #94a3b8 !important;
}

:global([data-bs-theme="dark"]) .map-popup-distance i {
  color: #64748b !important;
}

:global([data-bs-theme="dark"]) .map-popup-button {
  border-color: #3b82f6 !important;
  color: #60a5fa !important;
}

:global([data-bs-theme="dark"]) .map-popup-button:hover {
  background: #3b82f6 !important;
  color: white !important;
}

:global([data-bs-theme="dark"]) .map-popup-image-container {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
}

:global([data-bs-theme="dark"]) .map-popup-image-placeholder {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
  color: #475569 !important;
}

:global([data-bs-theme="dark"]) .leaflet-popup-tip {
  background: #1e293b !important;
}
</style>

<style>
/* Global styles for Leaflet markers (outside Vue scope) */
.item-marker-content {
  background: white !important;
  border: 3px solid #4285F4 !important;
  border-radius: 50% !important;
  width: 56px !important;
  height: 56px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3) !important;
  transition: transform 0.2s ease, box-shadow 0.2s ease !important;
  overflow: hidden !important;
  position: relative !important;
}

.item-marker-content:hover {
  transform: scale(1.1) !important;
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.5) !important;
}

.item-marker-image {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  border-radius: 50% !important;
}

.item-marker-content i {
  color: #4285F4 !important;
  font-size: 24px !important;
}

.map-popup {
  width: 288px !important;
  background: white !important;
  border-radius: 16px !important;
  overflow: hidden !important;
}

.map-popup-image-container {
  position: relative !important;
  height: 176px !important;
  overflow: hidden !important;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%) !important;
}

.map-popup-image {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  transition: transform 0.3s ease !important;
}

.map-popup:hover .map-popup-image {
  transform: scale(1.05) !important;
}

.map-popup-image-placeholder {
  width: 100% !important;
  height: 176px !important;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: #cbd5e1 !important;
}

.map-popup-image-placeholder i {
  font-size: 3rem !important;
  opacity: 0.5 !important;
}

.map-popup-button {
  width: 100% !important;
  padding: 0.625rem 1rem !important;
  border: 2px solid #2563eb !important;
  background: transparent !important;
  color: #2563eb !important;
  border-radius: 12px !important;
  font-weight: 600 !important;
  font-size: 0.875rem !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.5rem !important;
  font-family: inherit !important;
}

.map-popup-button:hover {
  background: #2563eb !important;
  color: white !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25) !important;
}

.map-popup-button:active {
  transform: translateY(0) !important;
}

.map-popup-button:focus {
  outline: 2px solid #60a5fa !important;
  outline-offset: 2px !important;
}

.map-popup-button-icon {
  font-size: 0.875rem !important;
  transition: transform 0.2s ease !important;
}

.map-popup-button:hover .map-popup-button-icon {
  transform: translateX(4px) !important;
}

/* Dark mode global styles */
[data-bs-theme="dark"] .map-popup {
  background: #1e293b !important;
  border-color: rgba(51, 65, 85, 0.5) !important;
}

[data-bs-theme="dark"] .map-popup-content {
  background: #1e293b !important;
}

[data-bs-theme="dark"] .map-popup-image-container {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
}

[data-bs-theme="dark"] .map-popup-image-placeholder {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
  color: #475569 !important;
}

[data-bs-theme="dark"] .map-popup-button {
  border-color: #3b82f6 !important;
  color: #60a5fa !important;
}

[data-bs-theme="dark"] .map-popup-button:hover {
  background: #3b82f6 !important;
  color: white !important;
}
</style>

