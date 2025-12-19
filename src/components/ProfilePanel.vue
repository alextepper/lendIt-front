<script setup>
import { ref, onMounted } from 'vue';
import { getProfile, updateProfile, uploadAvatar } from '../services/userService';
import { useUiStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import { useI18n } from 'vue-i18n'; 
import UserHistory from './UserHistory.vue';
import UserItems from './UserItems.vue';

const ui = useUiStore();
const auth = useAuthStore();
const form = ref({ name: '', email: '', phone: '', avatar: '', profilePicture: '', city: '' });
const originalForm = ref({});
const loading = ref(true);
const saving = ref(false);
const editMode = ref(false);
const cities = ref([]);
const baseURL = import.meta.env.VITE_API_BASE_URL;
const { t } = useI18n();
onMounted(async () => {
  try {
    const me = await getProfile();
    form.value = {
      username: me.username || '',
      email: me.email || '',
      phone: me.phone || '',
      avatar: me.avatar || me.profilePicture || '',
      profilePicture: me.profilePicture || me.avatar || '',
      city: me.city || me.location || '',
    };
    // Store original values for cancel
    originalForm.value = { ...form.value };
  } finally {
    loading.value = false;
  }
});

function toggleEditMode() {
  if (editMode.value) {
    // Cancel edit - restore original values
    form.value = { ...originalForm.value };
  }
  editMode.value = !editMode.value;
}

function getProfilePictureUrl(profilePicture) {
  if (!profilePicture) {
    return 'https://placehold.co/96x96?text=Avatar';
  }
  // If it's already a full URL, return as is
  if (profilePicture.startsWith('http://') || profilePicture.startsWith('https://')) {
    return profilePicture;
  }
  // If it starts with /uploads, prepend base URL
  if (profilePicture.startsWith('/uploads/')) {
    return `${baseURL}${profilePicture}`;
  }
  // Otherwise, assume it's a relative path
  return `${baseURL}/${profilePicture}`;
}

async function save() {
  saving.value = true;
  try {
    const updated = await updateProfile({
      username: form.value.username,
      phone: form.value.phone,
      city: form.value.city,
    });
    ui.showToast(t('dashboard.profileUpdated'), 'success');
    // Update original form with saved values
    originalForm.value = { ...form.value };
    // Exit edit mode
    editMode.value = false;
    // reflect in auth.user if present
    if (auth.user)
      auth.user = {
        ...auth.user,
        username: updated.username,
        phone: updated.phone,
        avatar: updated.profilePicture || updated.avatar,
        city: updated.city || updated.location,
      };
  } catch (e) {
    ui.showToast(e?.response?.data?.message || e.message, 'danger');
  } finally {
    saving.value = false;
  }
}

async function onAvatarChange(ev) {
  const file = ev.target.files?.[0];
  if (!file) return;
  
  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    ui.showToast(t('dashboard.invalidFileType'), 'danger');
    return;
  }
  
  // Validate file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    ui.showToast(t('dashboard.fileTooLarge'), 'danger');
    return;
  }
  
  try {
    const result = await uploadAvatar(file);
    const profilePictureUrl = result.profilePicture || result.avatar;
    form.value.avatar = profilePictureUrl;
    form.value.profilePicture = profilePictureUrl;
    // Update original form to reflect the change
    originalForm.value.avatar = profilePictureUrl;
    originalForm.value.profilePicture = profilePictureUrl;
    
    if (auth.user) {
      auth.user = { 
        ...auth.user, 
        avatar: profilePictureUrl,
        profilePicture: profilePictureUrl
      };
    }
    ui.showToast(t('dashboard.profilePictureUpdated'), 'success');
  } catch (e) {
    ui.showToast(e?.response?.data?.message || t('dashboard.profilePictureUploadFailed'), 'danger');
  }
}
</script>

<template>
  <div class="card p-3">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="h6 mb-0">{{ t('dashboard.profile') }}</h2>
      <button 
        v-if="!loading"
        class="btn btn-sm" 
        :class="editMode ? 'btn-outline-secondary' : 'btn-outline-primary'"
        @click="toggleEditMode"
      >
        <i class="bi" :class="editMode ? 'bi-x-lg' : 'bi-pencil'"></i>
        {{ editMode ? t('dashboard.cancel') : t('dashboard.edit') }}
      </button>
    </div>

    <div v-if="loading" class="text-secondary small">{{ $t('common.loading') }}</div>

    <div v-else class="row g-3">
      <div class="col-auto">
        <div class="position-relative profile-picture-container">
          <img
            :src="getProfilePictureUrl(form.profilePicture || form.avatar)"
            class="rounded-circle profile-avatar"
            width="96"
            height="96"
            :alt="$t('dashboard.profilePicture')"
          />
          <label class="btn btn-sm btn-primary profile-picture-upload-btn">
            <i class="bi bi-camera-fill"></i>
            <input 
              type="file" 
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" 
              class="d-none" 
              @change="onAvatarChange" 
            />
          </label>
        </div>
      </div>

      <div class="col">
        <!-- View Mode -->
        <div v-if="!editMode" class="profile-view">
          <div class="profile-field mb-3">
            <label class="field-label text-muted small">{{ t('dashboard.name') }}</label>
            <div class="field-value">{{ form.username || $t('dashboard.notSet') }}</div>
          </div>
          <div class="profile-field mb-3">
            <label class="field-label text-muted small">{{ t('dashboard.email') }}</label>
            <div class="field-value">{{ form.email || $t('dashboard.notSet') }}</div>
          </div>
          <div class="profile-field mb-3">
            <label class="field-label text-muted small">{{ t('dashboard.phone') }}</label>
            <div class="field-value">{{ form.phone || $t('dashboard.notSet') }}</div>
          </div>
          <div class="profile-field mb-3">
            <label class="field-label text-muted small">{{ t('dashboard.city') }}</label>
            <div class="field-value">{{ form.city || $t('dashboard.notSet') }}</div>
          </div>
        </div>

        <!-- Edit Mode -->
        <div v-else class="profile-edit">
          <div class="row g-2">
            <div class="col-md-6">
              <label class="form-label">{{ t('dashboard.name') }}</label>
              <input 
                v-model="form.username" 
                class="form-control" 
                :placeholder="t('dashboard.enterYourName')"
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">{{ t('dashboard.email') }}</label>
              <input 
                v-model="form.email" 
                class="form-control" 
                disabled 
                :title="t('dashboard.emailCannotBeChangedHere')"
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">{{ t('dashboard.phone') }}</label>
              <input 
                v-model="form.phone" 
                class="form-control" 
                :placeholder="t('dashboard.enterYourPhone')" 
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">{{ t('dashboard.city') }}</label>
              <select 
                v-model="form.city" 
                class="form-select"
              >
                <option value="">{{ t('dashboard.selectYourCity') }}</option>
                <option v-for="city in cities" :key="city" :value="city">
                  {{ city }}
                </option>
              </select>
            </div>
          </div>

          <div class="mt-3 d-flex gap-2">
            <button class="btn btn-primary" :disabled="saving" @click="save">
              <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
              <i v-else class="bi bi-check-lg me-1"></i>
              <span>{{ t('dashboard.saveChanges') }}</span>
            </button>
            <button class="btn btn-outline-secondary" @click="toggleEditMode" :disabled="saving">
              {{ t('dashboard.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- User Items Section -->
    <!-- <div class="mt-4">
      <UserItems />
    </div> -->

    <!-- User History Section -->
    <!-- <div class="mt-4">
      <UserHistory />
    </div> -->
  </div>
</template>

<style scoped>
.profile-picture-container {
  display: inline-block;
}

.profile-avatar {
  object-fit: cover;
  border: 3px solid #f8f9fa;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: block;
}

.profile-picture-upload-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  border: 2px solid white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.profile-picture-upload-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
}

.profile-picture-upload-btn i {
  font-size: 14px;
}

.profile-view {
  padding: 0.5rem 0;
}

.profile-field {
  padding: 0.75rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.profile-field:last-child {
  border-bottom: none;
}

.field-label {
  display: block;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
}

.field-value {
  font-size: 1rem;
  color: #212529;
  font-weight: 500;
  min-height: 1.5rem;
}

/* Removed :empty::before rule as we handle "Not set" in template with i18n */

.profile-edit .form-label {
  font-weight: 600;
  color: #495057;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.profile-edit .form-control {
  border-radius: 0.5rem;
  border: 1px solid #dee2e6;
  padding: 0.625rem 0.875rem;
  font-size: 0.95rem;
  transition: all 0.2s ease;
}

.profile-edit .form-control:focus {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
}

.profile-edit .form-control:disabled {
  background-color: #f8f9fa;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .profile-field {
    padding: 0.5rem 0;
  }
  
  .field-value {
    font-size: 0.95rem;
  }
}
</style>
