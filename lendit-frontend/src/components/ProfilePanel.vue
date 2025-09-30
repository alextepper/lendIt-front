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
const loading = ref(true);
const saving = ref(false);

onMounted(async () => {
  try {
    const me = await getProfile();
    form.value = {
      name: me.name || '',
      email: me.email || '',
      phone: me.phone || '',
      avatar: me.avatar || '',
    };
  } finally {
    loading.value = false;
  }
});

async function save() {
  saving.value = true;
  try {
    const updated = await updateProfile({
      name: form.value.name,
      phone: form.value.phone,
    });
    ui.showToast('Profile updated', 'success');
    // reflect in auth.user if present
    if (auth.user)
      auth.user = {
        ...auth.user,
        name: updated.name,
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
    <h2 class="h6 mb-3">Profile</h2>

    <div v-if="loading" class="text-secondary small">Loading…</div>

    <div v-else class="row g-3">
      <div class="col-auto">
        <img
          :src="form.avatar || 'https://placehold.co/96x96?text=Avatar'"
          class="rounded-circle"
          width="96"
          height="96"
          alt="Avatar"
        />
        <div class="mt-2">
          <label class="btn btn-sm btn-outline-secondary">
            <i class="bi bi-upload"></i> Upload
            <input type="file" accept="image/*" class="d-none" @change="onAvatarChange" />
          </label>
        </div>
      </div>

      <div class="col">
        <div class="row g-2">
          <div class="col-md-6">
            <label class="form-label">Name</label>
            <input v-model="form.name" class="form-control" />
          </div>
          <div class="col-md-6">
            <label class="form-label">Email</label>
            <input v-model="form.email" class="form-control" disabled />
          </div>
          <div class="col-md-6">
            <label class="form-label">Phone</label>
            <input v-model="form.phone" class="form-control" placeholder="+972…" />
          </div>
        </div>

        <div class="mt-3">
          <button class="btn btn-primary" :disabled="saving" @click="save">
            <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
            Save changes
          </button>
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
