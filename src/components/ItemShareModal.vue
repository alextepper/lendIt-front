<script setup>
import { ref, computed, nextTick, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toBlob } from 'html-to-image';
import { Modal } from 'bootstrap';
import { useUiStore } from '../stores/ui';

const props = defineProps({
  imageUrl: { type: String, default: null },
  title: { type: String, default: '' },
  priceLine: { type: String, default: '' },
  locationText: { type: String, default: '' },
  itemUrl: { type: String, required: true },
  itemId: { type: [String, Number], required: true },
});

const { t } = useI18n();
const ui = useUiStore();

const modalEl = ref(null);
const cardRef = ref(null);
let bsModal = null;

const hidePhotoForExport = ref(false);
const imgLoadError = ref(false);
const generating = ref(false);

const showPhoto = computed(
  () => !!(props.imageUrl && !imgLoadError.value && !hidePhotoForExport.value)
);

watch(
  () => props.imageUrl,
  () => {
    imgLoadError.value = false;
    hidePhotoForExport.value = false;
  }
);

function getModal() {
  if (!modalEl.value) return null;
  if (!bsModal) {
    bsModal = new Modal(modalEl.value);
  }
  return bsModal;
}

function open() {
  hidePhotoForExport.value = false;
  imgLoadError.value = false;
  nextTick(() => {
    getModal()?.show();
  });
}

function close() {
  Modal.getInstance(modalEl.value)?.hide();
}

defineExpose({ open, close });

onBeforeUnmount(() => {
  Modal.getInstance(modalEl.value)?.dispose();
  bsModal = null;
});

function onImgError() {
  imgLoadError.value = true;
}

async function captureBlob() {
  const el = cardRef.value;
  if (!el) return null;
  return toBlob(el, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#0f1628',
  });
}

/** Try capture; on failure optionally retry without photo area. */
async function captureWithFallback() {
  hidePhotoForExport.value = false;
  await nextTick();
  try {
    const blob = await captureBlob();
    if (blob) return blob;
  } catch {
    /* continue to fallback */
  }
  hidePhotoForExport.value = true;
  await nextTick();
  try {
    return await captureBlob();
  } catch (e) {
    console.warn('Item share capture failed:', e);
    return null;
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(props.itemUrl);
    ui.showToast(t('item.shareLinkCopied'), 'success');
  } catch {
    ui.showToast(t('item.shareClipboardFailed'), 'danger');
  }
}

function triggerDownload(blob) {
  const name = `sharo-item-${props.itemId}.png`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadImage() {
  generating.value = true;
  try {
    const blob = await captureWithFallback();
    if (!blob) {
      ui.showToast(t('item.shareImageFailed'), 'danger');
      return;
    }
    if (hidePhotoForExport.value) {
      ui.showToast(t('item.shareImageFailed'), 'warning');
    }
    triggerDownload(blob);
  } finally {
    generating.value = false;
    hidePhotoForExport.value = false;
    await nextTick();
  }
}

/** Opens the system share sheet with the listing URL only (or copies the link if sharing is unavailable).
 * We pass only `url` — combining `text`/`title` with `url` makes many apps paste the link twice. */
async function shareImageAndLink() {
  generating.value = true;
  try {
    if (typeof navigator.share === 'function') {
      const attempts = [
        { url: props.itemUrl },
        { text: props.itemUrl },
      ];
      for (const payload of attempts) {
        try {
          if (typeof navigator.canShare === 'function' && !navigator.canShare(payload)) {
            continue;
          }
          await navigator.share(payload);
          return;
        } catch (e) {
          if (e?.name === 'AbortError') return;
        }
      }
    }

    await copyLink();
  } finally {
    generating.value = false;
  }
}
</script>

<template>
  <div
    id="itemShareModal"
    ref="modalEl"
    class="modal fade"
    tabindex="-1"
    aria-labelledby="itemShareModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="itemShareModalLabel" class="modal-title">{{ t('item.shareCardTitle') }}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" :aria-label="t('common.close')"></button>
        </div>
        <div class="modal-body">
          <p class="text-muted small mb-3">{{ t('item.shareImageAndLinkHint') }}</p>

          <div class="d-flex justify-content-center mb-3 overflow-auto">
            <div ref="cardRef" class="share-card" dir="ltr">
              <div class="share-card__media">
                <img
                  v-if="showPhoto"
                  :src="imageUrl"
                  alt=""
                  class="share-card__img"
                  crossorigin="anonymous"
                  draggable="false"
                  @error="onImgError"
                />
                <div v-else class="share-card__placeholder" aria-hidden="true">
                  <i class="bi bi-image share-card__placeholder-icon"></i>
                </div>
              </div>
              <div class="share-card__body">
                <h2 class="share-card__title">{{ title || '—' }}</h2>
                <p class="share-card__price">{{ priceLine }}</p>
                <p v-if="locationText" class="share-card__location">
                  <i class="bi bi-geo-alt" aria-hidden="true"></i>
                  {{ locationText }}
                </p>
                <div class="share-card__footer">
                  <span class="share-card__brand">{{ t('item.shareBrand') }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="d-grid gap-2">
            <button type="button" class="btn btn-primary" :disabled="generating" @click="shareImageAndLink">
              <span
                v-if="generating"
                class="spinner-border spinner-border-sm me-2"
                role="status"
                aria-hidden="true"
              ></span>
              <i v-else class="bi bi-share me-2" aria-hidden="true"></i>
              {{ generating ? t('item.shareGenerating') : t('item.shareImageAndLink') }}
            </button>
            <button type="button" class="btn btn-outline-primary" :disabled="generating" @click="copyLink">
              <i class="bi bi-link-45deg me-2" aria-hidden="true"></i>
              {{ t('item.shareCopyLink') }}
            </button>
            <button type="button" class="btn btn-outline-secondary" :disabled="generating" @click="downloadImage">
              <i class="bi bi-download me-2" aria-hidden="true"></i>
              {{ t('item.shareDownloadImage') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-card {
  width: 360px;
  min-width: 360px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: #0f1628;
  text-align: left;
}

.share-card__media {
  height: 200px;
  background: linear-gradient(145deg, #1a2744 0%, #0f1628 100%);
  position: relative;
}

.share-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.share-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #243352 0%, #121a2e 100%);
}

.share-card__placeholder-icon {
  font-size: 3rem;
  color: rgba(255, 255, 255, 0.25);
}

.share-card__body {
  padding: 1rem 1.125rem 1.125rem;
  color: #fff;
}

.share-card__title {
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.3;
  margin: 0 0 0.5rem;
  color: #fff;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.share-card__price {
  font-size: 1.25rem;
  font-weight: 700;
  color: #7dd3fc;
  margin: 0 0 0.35rem;
}

.share-card__location {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.85);
  margin: 0 0 0.75rem;
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
}

.share-card__location .bi {
  margin-top: 0.1rem;
  flex-shrink: 0;
}

.share-card__footer {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding-top: 0.65rem;
}

.share-card__brand {
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
}
</style>
