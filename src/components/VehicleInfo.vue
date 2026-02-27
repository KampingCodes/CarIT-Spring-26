<script setup>
import { themeColor } from "../items";
import { useRoute, useRouter } from 'vue-router';
import { useVehicleStore } from '../stores/vehicle';
import { authState } from '../auth.js';
import { addGarageVehicle } from '../apis.js';
import VehicleSelector from './VehicleSelector.vue';
import MyGarage from './MyGarage.vue';

const service1SubHeading = "Start by entering your vehicle information";

import { ref, watch } from "vue";
const vehicleForm = ref({ year: '', make: '', model: '', trim: '' });
const saving = ref(false);
const errorMessage = ref('');
const selectedFromGarage = ref(false);
const garageRef = ref(null);

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
      // For logged-out users, still add to Cars DB via a direct endpoint
      // We'll create a separate endpoint for this
      await addCarToDatabase({ ...vehicleForm.value });
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

// Helper to add car to database without garage (for logged-out users)
async function addCarToDatabase(vehicle) {
  const response = await fetch('http://localhost:3000/api/cars/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(vehicle),
  });
  if (!response.ok) throw new Error('Failed to add car to database');
  return response.json();
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
            >Vehicle Information</span
          >
          <h3 class="heading mb-4" data-aos="fade-up" data-aos-delay="100">
            {{ service1SubHeading }}
          </h3>
          <div class="mb-4" data-aos="fade-up" data-aos-delay="200">
            <p>
              Please ensure all fields are filled out accurately to help us provide the best results possible. 
              Don't know your vehicle details? No worries! You can find this information on your vehicle's registration document or insurance card.
              If you're still unsure, you can visit the site below to decode your vehicle's identification number(VIN).
            </p>
            <div style="margin-left: 1.2em; margin-bottom: 1.2em;">
              <a href="https://vpic.nhtsa.dot.gov/decoder/" target="_blank" rel="noopener" style="text-decoration: underline; color: #007bff;">
                NHTSA's free VIN decoder
              </a>
            </div>
            <div v-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
            <div v-if="vehicleForm.year && vehicleForm.make && vehicleForm.model">
              <button class="btn btn-primary submit-btn" @click="submitVehicle" :disabled="saving">
                {{ saving ? 'Saving...' : 'Submit' }}
              </button>
            </div>
          </div>
        </div>
        <div class="col-lg-7" data-aos="fade-up" data-aos-delay="400">
          <div class="vehicle-selector p-4 rounded shadow bg-light">
            <h5 class="mb-3">Select Your Vehicle</h5>
            <VehicleSelector v-model="vehicleForm" />
            <div v-if="vehicleForm.year && vehicleForm.make && vehicleForm.model" class="alert alert-success mt-3">
              <strong>Selected Vehicle:</strong><br />
              {{ vehicleForm.year }} {{ vehicleForm.make }} {{ vehicleForm.model }} {{ vehicleForm.trim }}
            </div>
          </div>

          <!-- Garage picker for logged-in users -->
          <div v-if="authState.isAuthenticated" class="garage-picker mt-3">
            <div class="divider-text">
              <span>or pick from your garage</span>
            </div>
            <MyGarage ref="garageRef" :selectable="true" @select="onGarageSelect" />
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
  background: #fff;
  border-radius: 1rem;
  box-shadow: 0 2px 16px rgba(0,0,0,0.07);
  padding: 2rem 2rem 1.5rem 2rem;
  margin-top: 1.5rem;
}
.vehicle-selector h5 {
  color: var(--primary, #0d6efd);
  font-weight: 600;
  margin-bottom: 1.5rem;
}
.vehicle-selector label.form-label {
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
}
.vehicle-selector select.form-select {
  border-radius: 0.5rem;
  border: 1px solid #d1d5db;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  background: #f8f9fa;
  color: #222;
  margin-bottom: 1rem;
  transition: border-color 0.2s;
}
.vehicle-selector select.form-select:focus {
  border-color: var(--primary, #0d6efd);
  outline: none;
  background: #fff;
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

.garage-picker {
  padding-top: 0.5rem;
}

.divider-text {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  color: #888;
  font-size: 0.9rem;
}

.divider-text::before,
.divider-text::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #dee2e6;
}

.divider-text span {
  padding: 0 1rem;
  white-space: nowrap;
}
</style>
