<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { sendCrashReport, createCrashReportPayload } from '../services/crashReportService';
import { useUiStore } from '../stores/ui';

const { t } = useI18n();
const ui = useUiStore();

const isVisible = ref(false);
const errorDetails = ref(null);
const userDescription = ref('');
const submitting = ref(false);
const submitted = ref(false);

const errorMessage = computed(() => {
  if (!errorDetails.value) return '';
  if (errorDetails.value instanceof Error) {
    return errorDetails.value.message;
  }
  return String(errorDetails.value);
});

function show(error) {
  errorDetails.value = error;
  userDescription.value = '';
  submitted.value = false;
  isVisible.value = true;
}

function hide() {
  isVisible.value = false;
  setTimeout(() => {
    errorDetails.value = null;
    userDescription.value = '';
    submitted.value = false;
  }, 300);
}

async function submitReport() {
  if (!errorDetails.value) return;
  
  submitting.value = true;
  try {
    const payload = createCrashReportPayload(
      errorDetails.value,
      userDescription.value.trim()
    );
    
    await sendCrashReport(payload);
    submitted.value = true;
    ui.showToast(t('errorReport.reportSent'), 'success');
    
    setTimeout(() => {
      hide();
    }, 2000);
  } catch (error) {
    console.error('Failed to submit crash report:', error);
    ui.showToast(t('errorReport.reportFailed'), 'danger');
  } finally {
    submitting.value = false;
  }
}

function skipReport() {
  hide();
}

// Expose show method
defineExpose({ show });
</script>

<template>
  <div v-if="isVisible" class="error-report-overlay" @click.self="hide">
    <div class="error-report-modal">
      <div class="error-report-header">
        <div class="error-icon">
          <i class="bi bi-exclamation-triangle-fill"></i>
        </div>
        <h2 class="error-title">{{ $t('errorReport.title') }}</h2>
        <p class="error-subtitle">{{ $t('errorReport.subtitle') }}</p>
      </div>

      <div class="error-report-body">
        <div v-if="!submitted" class="error-content">
          <div class="error-message">
            <p class="error-label">{{ $t('errorReport.errorOccurred') }}</p>
            <div class="error-details">
              <code>{{ errorMessage }}</code>
            </div>
          </div>

          <div class="error-description">
            <label class="form-label">
              {{ $t('errorReport.descriptionLabel') }}
              <span class="text-muted">({{ $t('errorReport.optional') }})</span>
            </label>
            <textarea
              v-model="userDescription"
              class="form-control"
              rows="4"
              :placeholder="$t('errorReport.descriptionPlaceholder')"
              :disabled="submitting"
              maxlength="2000"
            ></textarea>
            <small class="text-muted">
              {{ $t('errorReport.descriptionHint') }}
            </small>
          </div>
        </div>

        <div v-else class="error-success">
          <div class="success-icon">
            <i class="bi bi-check-circle-fill"></i>
          </div>
          <p class="success-message">{{ $t('errorReport.thankYou') }}</p>
        </div>
      </div>

      <div class="error-report-footer">
        <button
          v-if="!submitted"
          type="button"
          class="btn btn-secondary"
          @click="skipReport"
          :disabled="submitting"
        >
          {{ $t('errorReport.skip') }}
        </button>
        <button
          v-if="!submitted"
          type="button"
          class="btn btn-primary"
          @click="submitReport"
          :disabled="submitting"
        >
          <span v-if="submitting" class="spinner-border spinner-border-sm me-2"></span>
          <i v-else class="bi bi-send me-2"></i>
          {{ submitting ? $t('errorReport.sending') : $t('errorReport.sendReport') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error-report-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.error-report-modal {
  background: white;
  border-radius: 20px;
  max-width: 600px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
  overflow: hidden;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.error-report-header {
  text-align: center;
  padding: 2rem 2rem 1.5rem;
  border-bottom: 1px solid #f1f5f9;
}

.error-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-icon i {
  font-size: 32px;
  color: #f59e0b;
}

.error-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  color: #0f172a;
}

.error-subtitle {
  color: #64748b;
  margin: 0;
  font-size: 0.9375rem;
}

.error-report-body {
  padding: 2rem;
}

.error-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.error-message {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.error-label {
  font-weight: 600;
  color: #0f172a;
  margin: 0;
  font-size: 0.875rem;
}

.error-details {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem;
  max-height: 150px;
  overflow-y: auto;
}

.error-details code {
  font-size: 0.8125rem;
  color: #dc2626;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Courier New', monospace;
}

.error-description {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.error-description .form-label {
  font-weight: 600;
  color: #0f172a;
  margin: 0;
  font-size: 0.875rem;
}

.error-description .text-muted {
  font-weight: 400;
  color: #94a3b8;
}

.error-description textarea {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 0.75rem;
  font-size: 0.875rem;
  resize: vertical;
  min-height: 100px;
}

.error-description textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  outline: none;
}

.error-description small {
  font-size: 0.75rem;
  color: #94a3b8;
}

.error-success {
  text-align: center;
  padding: 2rem 0;
}

.success-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-icon i {
  font-size: 32px;
  color: #10b981;
}

.success-message {
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.error-report-footer {
  padding: 1.5rem 2rem;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.error-report-footer .btn {
  border-radius: 12px;
  padding: 0.625rem 1.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s;
}

.error-report-footer .btn-secondary {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #64748b;
}

.error-report-footer .btn-secondary:hover {
  background: #e2e8f0;
  color: #475569;
}

.error-report-footer .btn-primary {
  background: #3b82f6;
  border: 1px solid #3b82f6;
  color: white;
}

.error-report-footer .btn-primary:hover {
  background: #2563eb;
  border-color: #2563eb;
}

.error-report-footer .btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Dark mode */
:global([data-bs-theme="dark"]) .error-report-modal {
  background: #1e293b;
}

:global([data-bs-theme="dark"]) .error-report-header {
  border-bottom-color: #334155;
}

:global([data-bs-theme="dark"]) .error-title,
:global([data-bs-theme="dark"]) .error-label,
:global([data-bs-theme="dark"]) .success-message,
:global([data-bs-theme="dark"]) .error-description .form-label {
  color: #f8fafc;
}

:global([data-bs-theme="dark"]) .error-subtitle,
:global([data-bs-theme="dark"]) .error-description .text-muted,
:global([data-bs-theme="dark"]) .error-description small {
  color: #cbd5e1;
}

:global([data-bs-theme="dark"]) .error-details {
  background: #0f172a;
  border-color: #334155;
}

:global([data-bs-theme="dark"]) .error-details code {
  color: #fca5a5;
}

:global([data-bs-theme="dark"]) .error-description textarea {
  background: #0f172a;
  border-color: #334155;
  color: #f8fafc;
}

:global([data-bs-theme="dark"]) .error-description textarea:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
}

:global([data-bs-theme="dark"]) .error-report-footer {
  border-top-color: #334155;
}

:global([data-bs-theme="dark"]) .error-report-footer .btn-secondary {
  background: #334155;
  border-color: #475569;
  color: #cbd5e1;
}

:global([data-bs-theme="dark"]) .error-report-footer .btn-secondary:hover {
  background: #475569;
  color: #f8fafc;
}

@media (max-width: 640px) {
  .error-report-modal {
    margin: 0;
    border-radius: 20px 20px 0 0;
    max-height: 90vh;
    overflow-y: auto;
  }

  .error-report-header {
    padding: 1.5rem 1.5rem 1rem;
  }

  .error-report-body {
    padding: 1.5rem;
  }

  .error-report-footer {
    padding: 1rem 1.5rem;
    flex-direction: column;
  }

  .error-report-footer .btn {
    width: 100%;
  }
}
</style>
