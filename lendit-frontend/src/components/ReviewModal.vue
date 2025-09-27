<script setup>
import { reactive, computed } from 'vue';
import StarRating from './StarRating.vue';

const props = defineProps({ modelValue: Boolean });
const emit = defineEmits(['update:modelValue', 'submit']);
const form = reactive({ rating: 0, comment: '' });

const valid = computed(() => form.rating >= 1 && form.comment.trim().length >= 3);

function close() { 
  emit('update:modelValue', false); 
}

function submit() { 
  if (valid.value) { 
    emit('submit', { ...form }); 
    close(); 
  } 
}
</script>

<template>
  <div class="modal fade" :class="{ show: modelValue }" style="display:block" v-if="modelValue" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Write a review</h5>
          <button class="btn-close" @click="close"></button>
        </div>
        <div class="modal-body">
          <label class="form-label">Your rating</label>
          <div class="mb-2"><StarRating v-model="form.rating" /></div>
          <label class="form-label">Comment</label>
          <textarea v-model="form.comment" rows="4" class="form-control" placeholder="Helpful, specific feedback…"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary" @click="close">Cancel</button>
          <button class="btn btn-primary" :disabled="!valid" @click="submit">Submit</button>
        </div>
      </div>
    </div>
  </div>
</template>
