<script setup>
import { ref, watch, onMounted } from 'vue';
import { getCarOptions } from '../apis.js';
import { autoFillVehicleFromVIN } from './function.js';
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

// VIN input state
const vinInput = ref('');
const isDecodingVIN = ref(false);
const vinError = ref('');
const vinSuccess = ref('');

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

// Decode VIN and auto-fill vehicle fields
async function handleVINDecode() {
  vinError.value = '';
  vinSuccess.value = '';
  
  if (!vinInput.value.trim()) {
    vinError.value = 'Please enter a VIN';
    return;
  }

  try {
    isDecodingVIN.value = true;
    const vehicleInfo = await autoFillVehicleFromVIN(vinInput.value);
    
    // Update the local vehicle with decoded data
    isUpdatingFromExternal.value = true;
    localVehicle.value = {
      year: vehicleInfo.year || '',
      make: vehicleInfo.make || '',
      model: vehicleInfo.model || '',
      trim: vehicleInfo.trim || ''
    };
    
    // Refresh available options based on decoded VIN
    await refreshCarOptions();
    isUpdatingFromExternal.value = false;
    
    vinSuccess.value = `Successfully decoded VIN! Auto-filled: ${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}`;
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      vinSuccess.value = '';
    }, 3000);
  } catch (error) {
    vinError.value = error.message || 'Failed to decode VIN. Please check and try again.';
    console.error('VIN decode error:', error);
  } finally {
    isDecodingVIN.value = false;
  }
}

defineExpose({ refreshCarOptions, handleVINDecode });
</script>

<template>
  <div class="vehicle-selector-container">
    <!-- Manual Selection Section -->
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

    <!-- OR Divider -->
    <div class="divider-section my-3">
      <div class="divider-line"></div>
      <div class="divider-text">OR</div>
      <div class="divider-line"></div>
    </div>

    <!-- VIN Input Section -->
    <div class="vin-input-section">
      <h6 class="mb-3">Decode your VIN</h6>
      <div class="vin-input-wrapper">
        <input 
          v-model="vinInput" 
          type="text" 
          class="form-control" 
          placeholder="Enter VIN (17 characters)"
          maxlength="17"
          @keyup.enter="handleVINDecode"
          :disabled="isDecodingVIN"
        />
        <button 
          class="btn btn-primary vin-decode-btn" 
          type="button" 
          @click="handleVINDecode"
          :disabled="isDecodingVIN || !vinInput.trim()"
        >
          {{ isDecodingVIN ? 'Decoding...' : 'Decode' }}
        </button>
      </div>
      
      <!-- VIN Status Messages -->
      <div v-if="vinError" class="alert alert-danger mt-2 mb-0">
        {{ vinError }}
      </div>
      <div v-if="vinSuccess" class="alert alert-success mt-2 mb-0">
        ✓ {{ vinSuccess }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.vehicle-selector-container {
  display: flex;
  flex-direction: column;
}

.form-label {
  font-weight: 500;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}

.vehicle-selector-row {
  --bs-gutter-x: 0.5rem;
  margin-bottom: 1.5rem;
}

/* Divider Section */
.divider-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.divider-line {
  flex: 1;
  height: 1px;
  background-color: #dee2e6;
}

.divider-text {
  white-space: nowrap;
  color: #6c757d;
  font-weight: 500;
  font-size: 0.875rem;
}

/* VIN Input Section Styles */
.vin-input-section {
  padding: 0;
}

.vin-input-section h6 {
  font-weight: 500;
  color: #333;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.vin-input-wrapper {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}

.vin-input-section .form-control {
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  flex: 1;
}

.vin-decode-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}

.vin-input-section .alert {
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
}

/* Make inputs more compact */
.vehicle-selector-row :deep(.form-control) {
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
}

/* Responsive adjustments for very small screens */
@media (max-width: 768px) {
  .vehicle-selector-row {
    --bs-gutter-x: 0.25rem;
  }

  .vehicle-selector-row .col-3 {
    flex: 0 0 25%;
  }
}

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

  .vin-input-section h6 {
    font-size: 0.85rem;
  }

  .vin-input-section .form-control {
    font-size: 0.8rem;
    padding: 0.3rem 0.4rem;
  }

  .vin-decode-btn {
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
  }

  .vin-input-wrapper {
    gap: 0.3rem;
  }

  .divider-section {
    gap: 0.5rem;
    margin-top: 1rem !important;
    margin-bottom: 1rem !important;
  }
}
</style>
