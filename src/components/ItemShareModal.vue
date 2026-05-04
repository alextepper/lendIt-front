<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { Modal } from 'bootstrap';
import { useUiStore } from '../stores/ui';

const props = defineProps({
  title: { type: String, default: '' },
  priceLine: { type: String, default: '' },
  listingTypeLabel: { type: String, required: true },
  locationText: { type: String, default: '' },
  itemUrl: { type: String, required: true },
});

const { t } = useI18n();
const ui = useUiStore();

const modalEl = ref(null);
let bsModal = null;

const fullShareText = computed(() => {
  const lines = [];
  const name = (props.title || '').trim();
  if (name) lines.push(name);
  lines.push(`${t('listing.listingType')}: ${props.listingTypeLabel}`);
  lines.push(`${t('item.price')}: ${props.priceLine}`);
  const loc = (props.locationText || '').trim();
  if (loc) lines.push(`${t('item.location')}: ${loc}`);
  lines.push('');
  lines.push(props.itemUrl);
  return lines.join('\n');
});

function getModal() {
  if (!modalEl.value) return null;
  if (!bsModal) {
    bsModal = new Modal(modalEl.value);
  }
  return bsModal;
}

function open() {
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

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(fullShareText.value);
    ui.showToast(t('item.shareMessageCopied'), 'success');
  } catch {
    ui.showToast(t('item.shareClipboardFailed'), 'danger');
  }
}

async function copyLinkOnly() {
  try {
    await navigator.clipboard.writeText(props.itemUrl);
    ui.showToast(t('item.shareLinkCopied'), 'success');
  } catch {
    ui.showToast(t('item.shareClipboardFailed'), 'danger');
  }
}

async function shareViaDevice() {
  const title = props.title?.trim() || t('item.share');
  const text = fullShareText.value;
  if (typeof navigator.share !== 'function') {
    await copyMessage();
    ui.showToast(t('item.shareNativeUnavailable'), 'info');
    return;
  }
  try {
    await navigator.share({
      title,
      text,
      url: props.itemUrl,
    });
  } catch (e) {
    if (e?.name === 'AbortError') return;
    await copyMessage();
    ui.showToast(t('item.shareNativeUnavailable'), 'info');
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
          <p class="text-muted small mb-3">{{ t('item.shareTextHint') }}</p>

          <div class="share-preview border rounded-3 p-3 mb-3 bg-body-secondary text-start">
            <div class="fw-semibold mb-1">{{ title || '—' }}</div>
            <div class="small text-muted mb-1">{{ listingTypeLabel }}</div>
            <div class="small mb-1">{{ priceLine }}</div>
            <div v-if="locationText" class="small text-muted mb-2">{{ locationText }}</div>
            <div class="small font-monospace text-break user-select-all">{{ itemUrl }}</div>
          </div>

          <label class="form-label small text-muted">{{ t('item.shareMessagePreview') }}</label>
          <pre class="share-preview-pre border rounded p-2 small mb-0 text-start">{{ fullShareText }}</pre>

          <div class="d-grid gap-2 mt-3">
            <button type="button" class="btn btn-primary" @click="shareViaDevice">
              <i class="bi bi-share me-2" aria-hidden="true"></i>
              {{ t('item.shareViaDevice') }}
            </button>
            <button type="button" class="btn btn-outline-primary" @click="copyMessage">
              <i class="bi bi-clipboard me-2" aria-hidden="true"></i>
              {{ t('item.shareCopyMessage') }}
            </button>
            <button type="button" class="btn btn-outline-secondary" @click="copyLinkOnly">
              <i class="bi bi-link-45deg me-2" aria-hidden="true"></i>
              {{ t('item.shareCopyLinkOnly') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-preview-pre {
  max-height: 12rem;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
