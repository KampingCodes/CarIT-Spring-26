<script setup>
import { ref, watch, onMounted } from 'vue';
import { getCarOptions } from '../apis.js';
import { autoFillVehicleFromVIN } from '../VINapi.js';
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
  // If the incoming value already matches localVehicle, this is just the parent
  // reflecting our own emission back at us — skip to avoid blocking future updates.
  if (
    newVal.year === localVehicle.value.year &&
    newVal.make === localVehicle.value.make &&
    newVal.model === localVehicle.value.model &&
    newVal.trim === localVehicle.value.trim
  ) {
    return;
  }
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
  if (!props.autoLoad) return;
  refreshCarOptions();
});

function isValidYear(val) {
  return /^(18\d{2}|19\d{2}|2\d{3})$/.test(String(val));
}

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

    // Explicitly emit to parent since the watcher was blocked by isUpdatingFromExternal
    emit('update:modelValue', { ...localVehicle.value });
    
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

defineExpose({ refreshCarOptions, handleVINDecode, isValidYear });
</script>

<template>
  <div class="vehicle-selector-container">
    <!-- Manual Selection Section -->
    <div class="vehicle-selector-row">
      <div class="vs-field">
        <label class="form-label">Year</label>
        <SearchableSelect v-model="localVehicle.year" :options="yearOptions" placeholder="e.g. 2020" :number-only="true" :max-length="4" :validator="isValidYear" invalid-message="Invalid year" />
      </div>
      <div class="vs-field">
        <label class="form-label">Make</label>
        <SearchableSelect v-model="localVehicle.make" :options="makeOptions" placeholder="e.g. Honda" :capitalize="true" />
      </div>
      <div class="vs-field">
        <label class="form-label">Model</label>
        <SearchableSelect v-model="localVehicle.model" :options="modelOptions" placeholder="e.g. Civic" :capitalize="true" />
      </div>
      <div class="vs-field">
        <label class="form-label">Trim</label>
        <SearchableSelect v-model="localVehicle.trim" :options="trimOptions" placeholder="e.g. SE" :capitalize="true" />
      </div>
    </div>

    <!-- OR Divider -->
    <div class="divider-section">
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
  --vehicle-input-radius: 1rem;
  --vehicle-input-height: 3.55rem;
  --vehicle-input-shadow: 0 16px 32px rgba(7, 14, 28, 0.12);
  --vehicle-input-shadow-focus: 0 0 0 0.22rem rgba(64, 123, 255, 0.16), 0 18px 36px rgba(7, 14, 28, 0.16);
}

.vehicle-selector-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.vs-field {
  flex: 1 1 calc(50% - 0.5rem);
  min-width: 0;
}

.form-label {
  color: var(--color-text-secondary);
  font-weight: 600;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: block;
  margin-bottom: 0.7rem;
}

/* Divider Section */
.divider-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1.75rem;
  margin-bottom: 1.75rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--color-border) 18%, var(--color-border) 82%, transparent 100%);
}

.divider-text {
  white-space: nowrap;
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.8rem;
  letter-spacing: 0.14em;
}

/* VIN Input Section Styles */
.vin-input-section {
  padding: 0;
}

.vin-input-section h6 {
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 1rem;
}

.vin-input-wrapper {
  display: flex;
  gap: 0.75rem;
  align-items: stretch;
}

.vin-input-section .form-control {
  min-height: var(--vehicle-input-height);
  padding: 1rem 1.15rem;
  border: 1px solid var(--color-border);
  border-radius: var(--vehicle-input-radius);
  background: var(--color-surface);
  box-shadow: none;
  color: var(--color-text-primary);
  font-size: 0.96rem;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  flex: 1;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.vin-input-section .form-control::placeholder {
  color: var(--color-text-muted);
  opacity: 1;
}

.vin-input-section .form-control:focus,
.vin-input-section .form-control:active {
  border: 1px solid var(--primary, #407bff);
  background: var(--color-surface);
  box-shadow: var(--vehicle-input-shadow-focus);
  color: var(--color-text-primary);
  transform: none;
}

.vin-decode-btn {
  min-height: var(--vehicle-input-height);
  padding: 0.85rem 1.4rem;
  border-radius: var(--vehicle-input-radius);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  box-shadow: 0 14px 24px rgba(64, 123, 255, 0.22);
}

.vin-input-section .alert {
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
}

.vs-field :deep(.form-control) {
  min-height: var(--vehicle-input-height);
  padding: 1rem 1.15rem;
  border: 1px solid var(--color-border);
  border-radius: var(--vehicle-input-radius);
  background: var(--color-surface);
  box-shadow: none;
  color: var(--color-text-primary);
  font-size: 0.98rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.vs-field :deep(.form-control::placeholder) {
  color: var(--color-text-muted);
  opacity: 1;
}

.vs-field :deep(.form-control:focus),
.vs-field :deep(.form-control:active) {
  border: 1px solid var(--primary, #407bff);
  background: var(--color-surface);
  box-shadow: var(--vehicle-input-shadow-focus);
  color: var(--color-text-primary);
  transform: none;
}

.vs-field :deep(.ss-invalid) {
  border-color: #dc3545 !important;
  box-shadow: 0 0 0 0.18rem rgba(220, 53, 69, 0.14) !important;
}

.vs-field :deep(.ss-invalid-msg) {
  top: calc(100% + 0.35rem);
  right: 0.2rem;
  margin-top: 0;
}

.vs-field :deep(.ss-dropdown) {
  top: calc(100% + 0.4rem);
  border: 1px solid var(--color-border);
  border-radius: calc(var(--vehicle-input-radius) + 0.1rem);
  background: var(--color-surface);
  box-shadow: 0 22px 40px rgba(7, 14, 28, 0.18);
  padding: 0.35rem 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.vs-field :deep(.ss-dropdown li) {
  min-height: 46px;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
}

.vs-field :deep(.ss-dropdown li:hover),
.vs-field :deep(.ss-dropdown li.ss-highlighted) {
  background: rgba(64, 123, 255, 0.12);
  color: var(--primary, #407bff);
}

/* Responsive adjustments for very small screens */
@media (max-width: 768px) {
  .vehicle-selector-row {
    --bs-gutter-x: 0.25rem;
    gap: 0.75rem;
  }

  .vs-field {
    flex: 1 1 calc(50% - 0.375rem);
  }

  .form-label {
    font-size: 0.72rem;
    margin-bottom: 0.6rem;
  }

  .vin-input-wrapper {
    gap: 0.5rem;
  }

  .vin-input-section .form-control,
  .vs-field :deep(.form-control) {
    min-height: 50px;
    font-size: 14px;
    padding: 0.85rem 0.95rem;
  }

  .vin-decode-btn {
    min-height: 50px;
    padding: 0.5rem 1rem;
  }
}

@media (max-width: 576px) {
  .vehicle-selector-row {
    gap: 0.85rem;
  }

  .vs-field {
    flex-basis: 100%;
  }

  .vin-input-wrapper {
    flex-direction: column;
  }

  .vin-decode-btn {
    width: 100%;
  }
}

@media (max-width: 576px) {
  .vehicle-selector-row {
    flex-direction: column;
    gap: 1rem;
  }

  .vs-field {
    flex: 1 1 100%;
  }

  .form-label {
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .divider-section {
    margin: 1rem 0;
    gap: 0.5rem;
  }

  .vin-input-wrapper {
    flex-direction: column;
    gap: 0.75rem;
  }

  .vin-input-section .form-control {
    width: 100%;
    min-height: 44px;
    font-size: 16px;
    padding: 0.5rem;
  }

  .vin-decode-btn {
    width: 100%;
    min-height: 40px;
    font-size: 0.78rem;
    padding: 0.42rem 0.9rem;
  }

  .vin-input-section h6 {
    font-size: 0.85rem;
    margin-bottom: 0.75rem;
  }

  .vs-field :deep(.form-control) {
    min-height: 44px;
    font-size: 16px;
    padding: 0.5rem;
  }

  .vin-input-section .alert {
    font-size: 0.75rem;
    padding: 0.5rem;
    width: 100%;
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
    min-height: 38px;
    padding: 0.35rem 0.75rem;
    font-size: 0.72rem;
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
