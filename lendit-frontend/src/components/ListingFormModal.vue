<script setup>
import { reactive, watch, onMounted } from 'vue';
import { fetchCategories, fetchLocations } from '../services/listingsService';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  listing: { type: Object, default: null }, // if passed -> edit
});
const emit = defineEmits(['update:modelValue', 'submit']);

const form = reactive({
  title: '',
  category: '',
  location: '',
  price_per_day: 0,
  description: '',
});
const cats = reactive({ list: [] });
const locs = reactive({ list: [] });

watch(
  () => props.listing,
  (v) => {
    Object.assign(form, v ? { ...v } : { title: '', category: '', location: '', price_per_day: 0, description: '' });
  },
  { immediate: true }
);

onMounted(async () => {
  cats.list = await fetchCategories().catch(() => []);
  locs.list = await fetchLocations().catch(() => []);
});

function close() {
  emit('update:modelValue', false);
}
function submit() {
  if (!form.title || !form.category || !form.location || !form.price_per_day) return;
  emit('submit', { ...form });
  close();
}
</script>

<template>
  <div
    class="modal fade"
    :class="{ show: modelValue }"
    style="display: block"
    v-if="modelValue"
    tabindex="-1"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ listing ? 'Edit listing' : 'New listing' }}</h5>
          <button class="btn-close" @click="close"></button>
        </div>
        <div class="modal-body">
          <div class="mb-2">
            <label class="form-label">Title</label>
            <input v-model="form.title" class="form-control" />
          </div>
          <div class="row g-2">
            <div class="col-6">
              <label class="form-label">Category</label>
              <select v-model="form.category" class="form-select">
                <option value="">Choose…</option>
                <option v-for="c in cats.list" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div class="col-6">
              <label class="form-label">Location</label>
              <select v-model="form.location" class="form-select">
                <option value="">Choose…</option>
                <option v-for="l in locs.list" :key="l" :value="l">{{ l }}</option>
              </select>
            </div>
          </div>
          <div class="mt-2">
            <label class="form-label">Price per day ($)</label>
            <input v-model.number="form.price_per_day" type="number" min="1" class="form-control" />
          </div>
          <div class="mt-2">
            <label class="form-label">Description</label>
            <textarea v-model="form.description" rows="3" class="form-control" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary" @click="close">Cancel</button>
          <button class="btn btn-primary" @click="submit">{{ listing ? 'Save' : 'Create' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
