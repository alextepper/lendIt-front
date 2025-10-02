<script setup>
import { ref, onMounted } from 'vue';
import { getProfile, updateProfile, uploadAvatar } from '../services/userService';
import { useUiStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import UserHistory from './UserHistory.vue';
import UserItems from './UserItems.vue';

const ui = useUiStore();
const auth = useAuthStore();
const form = ref({ name: '', email: '', phone: '', avatar: '' });
const originalForm = ref({});
const loading = ref(true);
const saving = ref(false);
const editMode = ref(false);

onMounted(async () => {
  try {
    const me = await getProfile();
    form.value = {
      username: me.username || '',
      email: me.email || '',
      phone: me.phone || '',
      avatar: me.avatar || '',
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

async function save() {
  saving.value = true;
  try {
    const updated = await updateProfile({
      username: form.value.username,
      phone: form.value.phone,
    });
    ui.showToast('Profile updated', 'success');
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
        avatar: updated.avatar,
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
  try {
    const { avatar } = await uploadAvatar(file);
    form.value.avatar = avatar;
    if (auth.user) auth.user = { ...auth.user, avatar };
    ui.showToast('Avatar updated', 'success');
  } catch (e) {
    ui.showToast('Failed to upload avatar', 'danger');
  }
}
</script>

<template>
  <div class="card p-3">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="h6 mb-0">Profile</h2>
      <button 
        v-if="!loading"
        class="btn btn-sm" 
        :class="editMode ? 'btn-outline-secondary' : 'btn-outline-primary'"
        @click="toggleEditMode"
      >
        <i class="bi" :class="editMode ? 'bi-x-lg' : 'bi-pencil'"></i>
        {{ editMode ? 'Cancel' : 'Edit' }}
      </button>
    </div>

    <div v-if="loading" class="text-secondary small">Loading…</div>

    <div v-else class="row g-3">
      <div class="col-auto">
        <div class="position-relative">
          <img
            :src="form.avatar || 'https://placehold.co/96x96?text=Avatar'"
            class="rounded-circle profile-avatar"
            width="96"
            height="96"
            alt="Avatar"
          />
          <div v-if="editMode" class="mt-2">
            <label class="btn btn-sm btn-outline-secondary">
              <i class="bi bi-upload"></i> Upload
              <input type="file" accept="image/*" class="d-none" @change="onAvatarChange" />
            </label>
          </div>
        </div>
      </div>

      <div class="col">
        <!-- View Mode -->
        <div v-if="!editMode" class="profile-view">
          <div class="profile-field mb-3">
            <label class="field-label text-muted small">Name</label>
            <div class="field-value">{{ form.username || 'Not set' }}</div>
          </div>
          <div class="profile-field mb-3">
            <label class="field-label text-muted small">Email</label>
            <div class="field-value">{{ form.email || 'Not set' }}</div>
          </div>
          <div class="profile-field mb-3">
            <label class="field-label text-muted small">Phone</label>
            <div class="field-value">{{ form.phone || 'Not set' }}</div>
          </div>
        </div>

        <!-- Edit Mode -->
        <div v-else class="profile-edit">
          <div class="row g-2">
            <div class="col-md-6">
              <label class="form-label">Name</label>
              <input 
                v-model="form.username" 
                class="form-control" 
                placeholder="Enter your name"
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">Email</label>
              <input 
                v-model="form.email" 
                class="form-control" 
                disabled 
                title="Email cannot be changed here"
              />
            </div>
            <div class="col-md-6">
              <label class="form-label">Phone</label>
              <input 
                v-model="form.phone" 
                class="form-control" 
                placeholder="+972…" 
              />
            </div>
          </div>

          <div class="mt-3 d-flex gap-2">
            <button class="btn btn-primary" :disabled="saving" @click="save">
              <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
              <i v-else class="bi bi-check-lg me-1"></i>
              Save changes
            </button>
            <button class="btn btn-outline-secondary" @click="toggleEditMode" :disabled="saving">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- User Items Section -->
    <div class="mt-4">
      <UserItems />
    </div>

    <!-- User History Section -->
    <div class="mt-4">
      <UserHistory />
    </div>
  </div>
</template>

<style scoped>
.profile-avatar {
  object-fit: cover;
  border: 3px solid #f8f9fa;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

.field-value:empty::before {
  content: 'Not set';
  color: #adb5bd;
  font-style: italic;
}

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
