<script setup>
import { themeColor } from "../items";
import { useRoute, useRouter } from 'vue-router';
import { useVehicleStore } from '../stores/vehicle';
import { authState } from '../auth.js';
import { addCarRecord, addGarageVehicle } from '../apis.js';
import { checkRecalls } from '../VINapi.js';
import VehicleSelector from './VehicleSelector.vue';
import MyGarage from './MyGarage.vue';

const service1SubHeading = "Start by entering your vehicle information";

import { ref, watch } from "vue";
const vehicleForm = ref({ year: '', make: '', model: '', trim: '' });
const saving = ref(false);
const errorMessage = ref('');
const selectedFromGarage = ref(false);
const garageRef = ref(null);

// Recall check state
const recallCount = ref(0);
const recallsLoading = ref(false);
const recallError = ref('');

function onGarageSelect(car) {
  vehicleForm.value = { ...car };
  selectedFromGarage.value = true;
}

// If the user manually changes a field, clear the garage selection highlight
watch(vehicleForm, () => {
  if (selectedFromGarage.value) {
    selectedFromGarage.value = false;
  }
}, { deep: true });

// Check for recalls when vehicle info is complete
watch(() => vehicleForm.value, async (newVal) => {
  if (newVal.year && newVal.make && newVal.model) {
    await performRecallCheck(newVal.year, newVal.make, newVal.model);
  } else {
    recallCount.value = 0;
    recallError.value = '';
  }
}, { deep: true });

async function performRecallCheck(year, make, model) {
  try {
    recallsLoading.value = true;
    recallError.value = '';
    const result = await checkRecalls(make, model, year);
    recallCount.value = result.count;
  } catch (error) {
    console.error('Recall check failed:', error);
    recallError.value = 'Unable to check recalls at this time';
    recallCount.value = 0;
  } finally {
    recallsLoading.value = false;
  }
}

const route = useRoute();
const router = useRouter();
const vehicleStore = useVehicleStore();

function isValidYear(val) {
  return /^(18\d{2}|19\d{2}|2\d{3})$/.test(String(val));
}

async function submitVehicle() {
  if (!vehicleForm.value.year || !vehicleForm.value.make || !vehicleForm.value.model) {
    errorMessage.value = 'Please fill in Year, Make, and Model';
    return;
  }
  if (!isValidYear(vehicleForm.value.year)) {
    errorMessage.value = 'Please enter a valid year (e.g. 2020). Year must start with 18, 19, or 2.';
    return;
  }

  saving.value = true;
  errorMessage.value = '';

  try {
    // Always add to Cars DB (whether logged in or not)
    // If logged in, addGarageVehicle will add to both garage and Cars DB
    if (authState.isAuthenticated) {
      await addGarageVehicle({ ...vehicleForm.value });
    } else {
      await addCarRecord({ ...vehicleForm.value });
    }

    // Navigate to problem description
    router.push({
      path: '/problemdescription',
      query: {
        year: vehicleForm.value.year,
        make: vehicleForm.value.make,
        model: vehicleForm.value.model,
        trim: vehicleForm.value.trim
      }
    });
  } catch (err) {
    console.error('Error saving vehicle:', err);
    errorMessage.value = 'Failed to save vehicle. Please try again.';
  } finally {
    saving.value = false;
  }
}

</script>
<template>
  <div class="untree_co-section" id="features-section">
    <div class="container">
      <div class="row justify-content-between">
        <div class="col-lg-4">
          <span
            class="caption"
            data-aos="fade-up"
            data-aos-delay="0"
            :style="[{ color: themeColor }]"
            ></span
          >
          <h3 class="heading mb-4" data-aos="fade-up" data-aos-delay="100">
            {{ service1SubHeading }}
          </h3>
          <div class="mb-4" data-aos="fade-up" data-aos-delay="200">
            <p>
              Please ensure all fields are filled out accurately to help us provide the best results possible.
              Don’t know your vehicle details? No worries! You can find this information on your vehicle’s registration document or insurance card.
              If you’re still unsure, simply enter your vehicle’s identification number (VIN), 
              and the system will automatically retrieve your vehicle’s information for you.
            </p>
            <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
            <div v-if="recallCount > 0" class="alert alert-warning" role="alert">
              <strong>⚠️ Recall Warning!</strong><br />
              <span v-if="recallsLoading">Checking recalls...</span>
              <span v-else>
                {{ recallCount }} potential recall{{ recallCount !== 1 ? 's' : '' }} found for vehicles of this make, model, and year.
                <a href="https://www.nhtsa.gov/recalls" target="_blank" class="alert-link">
                  Verify with VIN at NHTSA.gov
                </a>
              </span>
            </div>
            <div v-if="recallError" class="alert alert-info">{{ recallError }}</div>
            <div v-if="vehicleForm.year && vehicleForm.make && vehicleForm.model">
              <button class="btn btn-primary submit-btn" @click="submitVehicle" :disabled="saving">
                {{ saving ? 'Saving...' : 'Submit' }}
              </button>
            </div>
          </div>
        </div>
        <div class="col-lg-7" data-aos="fade-up" data-aos-delay="400">
          <!-- Garage picker for logged-in users -->
          <div v-if="authState.isAuthenticated" class="garage-picker">
            <MyGarage ref="garageRef" :selectable="true" @select="onGarageSelect" />
            <div class="divider-text">
              <span>or enter a new vehicle</span>
            </div>
          </div>

          <div class="vehicle-selector">
            <div v-if="!authState.isAuthenticated" class="alert alert-warning guest-notice mb-3">
              You're continuing as a guest. Your generated flowchart is available only for this session unless you sign in.
            </div>
            <VehicleSelector v-model="vehicleForm" />
            <div v-if="vehicleForm.year && vehicleForm.make && vehicleForm.model" class="alert alert-success mt-3">
              <strong>Selected Vehicle:</strong><br />
              {{ vehicleForm.year }} {{ vehicleForm.make }} {{ vehicleForm.model }} {{ vehicleForm.trim }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.submit-btn {
  background: var(--primary, #0d6efd);
  border-color: var(--primary, #0d6efd);
  color: #fff;
  font-weight: 600;
  font-size: 1.25rem;
  padding: 0.85rem 2.8rem;
  border-radius: 2rem;
  margin-top: 0.5rem;
  margin-left: 1.5em;
  box-shadow: 0 2px 8px rgba(13,110,253,0.08);
  transition: background 0.2s, border-color 0.2s;
  letter-spacing: 0.5px;
}
.submit-btn:hover {
  background: #0056b3;
  border-color: #0056b3;
}

.form-row {
.submit-btn {
  box-shadow: 0 2px 8px rgba(13,110,253,0.08);
  transition: background 0.2s, border-color 0.2s;
}
.submit-btn:hover {
  background: #0056b3;
  border-color: #0056b3;
}
  display: flex;
  align-items: center;
  margin-bottom: 1.25rem;
}
.form-row label.form-label {
  flex: 0 0 80px;
  margin-bottom: 0;
  margin-right: 1rem;
  text-align: right;
}
.form-row .form-select-inline {
  flex: 1 1 auto;
  min-width: 180px;
  max-width: 320px;
}

.vehicle-selector {
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  padding: 24px;
}
.vehicle-selector h5 {
  color: var(--color-text-primary);
  font-weight: 600;
  margin-bottom: 1.5rem;
}
.vehicle-selector label.form-label {
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 0.25rem;
}
.vehicle-selector select.form-select {
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 0.5rem 1rem;
  font-size: 1rem;
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  margin-bottom: 1rem;
  transition: border-color 0.2s;
}
.vehicle-selector select.form-select:focus {
  border-color: var(--primary, #0d6efd);
  outline: none;
  background: var(--color-surface);
}
.vehicle-selector .alert-success {
  background: #e6f4ea;
  color: #217a4a;
  border: none;
  border-radius: 0.5rem;
  margin-top: 1.5rem;
  font-size: 1.05rem;
}
.vehicle-selector .mb-2 {
  margin-bottom: 1.25rem !important;
}

.guest-notice {
  font-size: 0.95rem;
  border-radius: 0.75rem;
}

.garage-picker {
  padding-top: 0;
}

.divider-text {
  display: flex;
  align-items: center;
  margin-top: 1.25rem;
  margin-bottom: 1.25rem;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.divider-text::before,
.divider-text::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--color-border);
}

.divider-text span {
  padding: 0 1rem;
  white-space: nowrap;
}
</style>
