<script setup>
import { reactive } from 'vue'
const props = defineProps({
  modelValue: { type: Object, default: () => ({ name:'', phone:'', method:'pickup', address:'' }) }
})
const emit = defineEmits(['update:modelValue'])
const form = reactive({ ...props.modelValue })

function update(){ emit('update:modelValue', { ...form }) }
</script>

<template>
  <div class="card p-3">
    <h2 class="h6 mb-3">Contact & Delivery</h2>
    <div class="row g-2">
      <div class="col-md-6">
        <label class="form-label">Full name</label>
        <input v-model="form.name" @input="update" class="form-control" />
      </div>
      <div class="col-md-6">
        <label class="form-label">Phone</label>
        <input v-model="form.phone" @input="update" class="form-control" placeholder="+972…" />
      </div>
      <div class="col-12">
        <label class="form-label">Receive method</label>
        <select v-model="form.method" @change="update" class="form-select">
          <option value="pickup">Pickup</option>
          <option value="delivery">Delivery</option>
        </select>
      </div>
      <div class="col-12" v-if="form.method==='delivery'">
        <label class="form-label">Address</label>
        <input v-model="form.address" @input="update" class="form-control" placeholder="Street, city" />
      </div>
    </div>
  </div>
</template>
