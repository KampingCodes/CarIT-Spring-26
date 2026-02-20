<script setup>
import { ref, watch, onMounted } from 'vue';
import { getCarOptions } from '../apis.js';
import SearchableSelect from './SearchableSelect.vue';

const props = defineProps({
  modelValue: { type: Object, default: () => ({ year: '', make: '', model: '', trim: '' }) },
  autoLoad: { type: Boolean, default: true },
});

const emit = defineEmits(['update:modelValue']);

// Car option lists from DB
const yearOptions = ref([]);
const makeOptions = ref([]);
const modelOptions = ref([]);
const trimOptions = ref([]);

const localVehicle = ref({ ...props.modelValue });
const isUpdatingFromExternal = ref(false);
const isLoadingOptions = ref(false);
let optionsLoadTimeout = null;

// Emit changes back to parent
watch(localVehicle, (newVal) => {
  if (!isUpdatingFromExternal.value) {
    emit('update:modelValue', { ...newVal });
  }
}, { deep: true });

// Sync external changes - don't trigger cascading clears
watch(() => props.modelValue, async (newVal) => {
  isUpdatingFromExternal.value = true;
  localVehicle.value = { ...newVal };
  await refreshCarOptions();
  isUpdatingFromExternal.value = false;
}, { deep: true });

// Debounced fetch function to prevent rapid API calls
async function refreshCarOptions() {
  // Clear any pending timeout
  if (optionsLoadTimeout) {
    clearTimeout(optionsLoadTimeout);
  }

  // Debounce the API call
  return new Promise((resolve) => {
    optionsLoadTimeout = setTimeout(async () => {
      try {
        isLoadingOptions.value = true;
        const filters = {};
        if (localVehicle.value.year) filters.year = localVehicle.value.year;
        if (localVehicle.value.make) filters.make = localVehicle.value.make;
        if (localVehicle.value.model) filters.model = localVehicle.value.model;
        
        const opts = await getCarOptions(filters);
        yearOptions.value = opts.years.map(String);
        makeOptions.value = opts.makes;
        modelOptions.value = opts.models;
        trimOptions.value = opts.trims;
        
        resolve();
      } catch (err) {
        console.error('Error fetching car options:', err);
        resolve();
      } finally {
        isLoadingOptions.value = false;
      }
    }, 150);
  });
}

// When year changes, clear downstream and refetch
watch(() => localVehicle.value.year, (newVal, oldVal) => {
  if (newVal !== oldVal && !isUpdatingFromExternal.value) {
    localVehicle.value.make = '';
    localVehicle.value.model = '';
    localVehicle.value.trim = '';
    refreshCarOptions();
  }
});

// When make changes, clear downstream and refetch
watch(() => localVehicle.value.make, (newVal, oldVal) => {
  if (newVal !== oldVal && !isUpdatingFromExternal.value) {
    localVehicle.value.model = '';
    localVehicle.value.trim = '';
    refreshCarOptions();
  }
});

// When model changes, clear trim and refetch
watch(() => localVehicle.value.model, (newVal, oldVal) => {
  if (newVal !== oldVal && !isUpdatingFromExternal.value) {
    localVehicle.value.trim = '';
    refreshCarOptions();
  }
});

onMounted(() => {
  if (props.autoLoad) {
    refreshCarOptions();
  }
});

defineExpose({ refreshCarOptions });
</script>

<template>
  <div class="row g-2 vehicle-selector-row">
    <div class="col-3">
      <label class="form-label">Year</label>
      <SearchableSelect v-model="localVehicle.year" :options="yearOptions" placeholder="e.g. 2020" />
    </div>
    <div class="col-3">
      <label class="form-label">Make</label>
      <SearchableSelect v-model="localVehicle.make" :options="makeOptions" placeholder="e.g. Honda" />
    </div>
    <div class="col-3">
      <label class="form-label">Model</label>
      <SearchableSelect v-model="localVehicle.model" :options="modelOptions" placeholder="e.g. Civic" />
    </div>
    <div class="col-3">
      <label class="form-label">Trim</label>
      <SearchableSelect v-model="localVehicle.trim" :options="trimOptions" placeholder="e.g. SE" />
    </div>
  </div>
</template>

<style scoped>
.form-label {
  font-weight: 500;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}

.vehicle-selector-row {
  --bs-gutter-x: 0.5rem;
}

/* Make inputs more compact */
.vehicle-selector-row :deep(.form-control) {
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
}

/* Responsive adjustments for very small screens */
@media (max-width: 575px) {
  .vehicle-selector-row {
    --bs-gutter-x: 0.25rem;
  }
  
  .form-label {
    font-size: 0.75rem;
    margin-bottom: 0.15rem;
  }
  
  .vehicle-selector-row :deep(.form-control) {
    padding: 0.3rem 0.4rem;
    font-size: 0.8rem;
  }
}
</style>
