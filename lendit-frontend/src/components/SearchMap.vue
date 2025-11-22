<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
      if (userMarker) {
        const newPos = userMarker.getLatLng();
        const newLocation = {
          lat: newPos.lat,
          lng: newPos.lng,
          address: null
        };
        
        // Emit the new location
        emit('location-changed', newLocation);
        
        // Update radius circle position
        if (radiusCircle) {
          radiusCircle.setLatLng(newPos);
        }
        
        // Try to get address for new location (non-blocking)
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newPos.lat}&lon=${newPos.lng}&zoom=18&addressdetails=1&accept-language=en`
        )
          .then(response => response.json())
          .then(data => {
            if (data && data.display_name) {
              newLocation.address = data.display_name;
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

  // Add item markers
  props.items.forEach((item) => {
    if (item.latitude && item.longitude) {
      // Get photo URL
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
      let photoUrl = null;
      if (item.photos && item.photos.length > 0) {
        const photo = item.photos[0];
        if (photo.url) {
          photoUrl = photo.url.startsWith('http') 
            ? photo.url 
            : `${baseURL}${photo.url.startsWith('/') ? '' : '/'}${photo.url}`;
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

      const marker = L.marker([item.latitude, item.longitude], {
        icon: itemIcon,
      }).addTo(map);

      // Add popup with item info and image
      const popupContent = `
        <div class="map-popup">
          ${photoUrl ? `
            <div class="map-popup-image">
              <img src="${photoUrl}" alt="${item.title || 'Item'}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
              <div class="map-popup-image-placeholder" style="display: none;">
                <i class="bi bi-image"></i>
              </div>
            </div>
          ` : `
            <div class="map-popup-image-placeholder">
              <i class="bi bi-image"></i>
            </div>
          `}
          <div class="map-popup-content">
            <h6 class="mb-1">${item.title || 'Item'}</h6>
            <p class="mb-1 small">
              <strong>${(item.pricePerDay || item.price_per_day || 0) / 100} ${item.currency || 'ILS'}</strong>/day
            </p>
            ${item.distance ? `<p class="mb-1 small text-muted">📍 ${item.distance.toFixed(1)} km away</p>` : ''}
            ${item.rating ? `<p class="mb-1 small">⭐ ${item.rating.toFixed(1)} (${item.reviews_count || 0} reviews)</p>` : ''}
            <a href="/item/${item.id}" class="btn btn-sm btn-primary mt-2 w-100">View Details</a>
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

.user-marker-container {
  position: relative;
  width: 24px;
  height: 24px;
}

.user-marker-pulse {
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

.user-marker-dot {
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

.user-marker-drag-hint {
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

.user-marker-drag-hint::before {
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

.user-marker-drag-hint i {
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
  min-width: 250px;
  max-width: 300px;
  padding: 0;
  border-radius: 0.5rem;
  overflow: hidden;
}

:deep(.map-popup-image) {
  width: 100% !important;
  aspect-ratio: 16 / 9 !important;
  max-height: 180px !important;
  overflow: hidden !important;
  background: #f8f9fa !important;
  position: relative !important;
}

:deep(.map-popup-image img) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  display: block !important;
}

:deep(.map-popup-image-placeholder) {
  width: 100% !important;
  aspect-ratio: 16 / 9 !important;
  max-height: 180px !important;
  background: #f8f9fa !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: #adb5bd !important;
}

:deep(.map-popup-image-placeholder i) {
  font-size: 3rem !important;
}

.map-popup-content {
  padding: 0.75rem;
}

:deep(.map-popup h6) {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #212529;
}

:deep(.map-popup .btn) {
  width: 100%;
  margin-top: 0.5rem;
}

:deep(.leaflet-popup-content-wrapper) {
  padding: 0;
  border-radius: 0.5rem;
}

:deep(.leaflet-popup-content) {
  margin: 0;
  width: auto !important;
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

.map-popup-image {
  width: 100% !important;
  aspect-ratio: 16 / 9 !important;
  max-height: 180px !important;
  overflow: hidden !important;
  background: #f8f9fa !important;
  position: relative !important;
}

.map-popup-image img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  display: block !important;
}

.map-popup-image-placeholder {
  width: 100% !important;
  aspect-ratio: 16 / 9 !important;
  max-height: 180px !important;
  background: #f8f9fa !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: #adb5bd !important;
}

.map-popup-image-placeholder i {
  font-size: 3rem !important;
}
</style>

