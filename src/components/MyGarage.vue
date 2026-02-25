<script setup>
import { ref, onMounted, watch } from 'vue';
import { getGarage, addGarageVehicle, editGarageVehicle, removeGarageVehicle } from '../apis.js';
import { authState } from '../auth.js';
import VehicleSelector from './VehicleSelector.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  editable: { type: Boolean, default: false },
  selectable: { type: Boolean, default: false },
});

const emit = defineEmits(['select']);
const selectedCarId = ref(null);

const selectCar = (car) => {
  selectedCarId.value = car._id;
  emit('select', { year: String(car.year), make: car.make, model: car.model, trim: car.trim || '' });
};

// Garage state
const garage = ref([]);
const garageLoading = ref(false);
const showAddForm = ref(false);
const editingCarId = ref(null);
const confirmDeleteId = ref(null);
const garageForm = ref({ year: '', make: '', model: '', trim: '' });
const vehicleSelectorRef = ref(null);
const initialLoading = ref(true);

const resetGarageForm = () => {
  garageForm.value = { year: '', make: '', model: '', trim: '' };
};

const openAddForm = () => {
  resetGarageForm();
  editingCarId.value = null;
  showAddForm.value = true;
};

const cancelForm = () => {
  showAddForm.value = false;
  editingCarId.value = null;
  resetGarageForm();
};

const openEditForm = async (car) => {
  editingCarId.value = car._id;
  garageForm.value = { year: String(car.year), make: car.make, model: car.model, trim: car.trim || '' };
  showAddForm.value = true;
  if (vehicleSelectorRef.value) {
    await vehicleSelectorRef.value.refreshCarOptions();
  }
  editingCarId.value = car._id;
};

const submitGarageForm = async () => {
  garageLoading.value = true;
  try {
    if (editingCarId.value) {
      await editGarageVehicle(editingCarId.value, { ...garageForm.value });
    } else {
      await addGarageVehicle({ ...garageForm.value });
    }
    garage.value = await getGarage();
    cancelForm();
  } catch (err) {
    console.error('Garage save error:', err);
  } finally {
    garageLoading.value = false;
  }
};

const garageError = ref('');

const promptDelete = (carId) => { confirmDeleteId.value = carId; garageError.value = ''; };
const cancelDelete = () => { confirmDeleteId.value = null; garageError.value = ''; };

const confirmRemove = async () => {
  garageLoading.value = true;
  garageError.value = '';
  try {
    const result = await removeGarageVehicle(confirmDeleteId.value);
    if (result && result.success === false) {
      garageError.value = result.message || 'Failed to remove vehicle';
      return;
    }
    garage.value = await getGarage();
    confirmDeleteId.value = null;
  } catch (err) {
    console.error('Garage remove error:', err);
    garageError.value = err?.response?.data?.message || err?.message || 'Failed to remove vehicle';
  } finally {
    garageLoading.value = false;
  }
};

async function loadGarage() {
  if (!authState.isAuthenticated) {
    initialLoading.value = false;
    return;
  }
  try {
    garage.value = await getGarage();
  } catch (err) {
    console.error('Error loading garage:', err);
  } finally {
    initialLoading.value = false;
  }
}

onMounted(() => {
  loadGarage();
});

// Watch for authentication changes and reload garage when user logs in
watch(() => authState.isAuthenticated, (isAuth) => {
  if (isAuth) {
    loadGarage();
  } else {
    garage.value = [];
  }
});
</script>

<template>
  <div class="garage-section" v-bind="$attrs">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h4 class="mb-0">My Garage</h4>
      <button v-if="editable && authState.isAuthenticated" class="btn btn-primary btn-sm" @click="openAddForm" :disabled="showAddForm">+ Add Vehicle</button>
    </div>

    <!-- Not authenticated message -->
    <div v-if="!authState.isAuthenticated" class="garage-empty">
      Please log in to view your garage.
    </div>

    <!-- Add / Edit form (editable mode only) -->
    <div v-else-if="editable && showAddForm" class="garage-form card p-3 mb-3">
      <h5>{{ editingCarId ? 'Edit Vehicle' : 'Add New Vehicle' }}</h5>
      <VehicleSelector ref="vehicleSelectorRef" v-model="garageForm" />
      <div class="mt-3 d-flex gap-2">
        <button class="btn btn-primary" @click="submitGarageForm" :disabled="garageLoading || !garageForm.year || !garageForm.make || !garageForm.model">
          {{ garageLoading ? 'Saving...' : (editingCarId ? 'Save Changes' : 'Add Vehicle') }}
        </button>
        <button class="btn btn-secondary" @click="cancelForm">Cancel</button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-else-if="initialLoading" class="garage-loading">
      <div class="spinner"></div> Loading your garage...
    </div>

    <!-- Vehicle list -->
    <div v-else-if="garage.length === 0 && !showAddForm" class="garage-empty">
      No vehicles in your garage yet.{{ editable ? ' Add one above!' : '' }}
    </div>
    <div v-else class="garage-list">
      <div v-for="car in garage" :key="car._id"
        class="garage-card card p-3 mb-2"
        :class="{ 'garage-card-selectable': selectable, 'garage-card-selected': selectable && selectedCarId === car._id }"
        @click="selectable ? selectCar(car) : null"
      >
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <strong>{{ car.year }} {{ car.make }} {{ car.model }}</strong>
            <span v-if="car.trim" class="text-muted ms-2"> - {{ car.trim }}</span>
          </div>
          <div v-if="editable" class="d-flex gap-2">
            <button class="btn btn-outline-primary btn-sm" @click.stop="openEditForm(car)">Edit</button>
            <button class="btn btn-outline-danger btn-sm" @click.stop="promptDelete(car._id)">Remove</button>
          </div>
          <div v-else-if="selectable && selectedCarId === car._id">
            <span class="badge bg-primary">Selected</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Delete confirmation modal (outside garage-section to avoid stacking context issues) -->
  <Teleport to="body">
    <div v-if="confirmDeleteId" class="delete-overlay" @click.self="cancelDelete">
      <div class="delete-confirm card p-4">
        <h5>Remove Vehicle</h5>
        <p>Are you sure you want to permanently remove this vehicle from your garage?</p>
        <div v-if="garageError" class="alert alert-danger py-2 mb-2">{{ garageError }}</div>
        <div class="d-flex gap-2 justify-content-end">
          <button class="btn btn-secondary" @click="cancelDelete">Cancel</button>
          <button class="btn btn-danger" @click="confirmRemove" :disabled="garageLoading">
            {{ garageLoading ? 'Removing...' : 'Yes, Remove' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Main section styling */
.garage-section { 
  position: relative;
  z-index: 0; /* Ensure navbar (z-index: 10) always stays on top */
  padding: 24px; 
  background: #ffffff; 
  border-radius: 12px; 
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  min-width: 0; /* Allow flex shrinking */
}

/* Header spacing */
.garage-section .d-flex.justify-content-between {
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.garage-section h4 {
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
  font-size: clamp(1.25rem, 2.5vw, 1.5rem); /* Responsive font size */
}

/* Add/Edit form styling */
.garage-form { 
  border-radius: 10px; 
  padding: 20px;
  margin-bottom: 16px;
  width: 100%;
}

.garage-form h5 {
  color: #2c3e50;
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 16px;
}

/* Vehicle card list */
.garage-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Individual vehicle cards */
.garage-card { 
  border: 1px solid #e1e8ed; 
  border-radius: 10px; 
  padding: 16px 20px;
  background: #ffffff;
  transition: all 0.2s ease;
}

.garage-card:hover { 
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); 
  border-color: #c8d6e5;
  transform: translateY(-1px);
}

.garage-card strong {
  font-size: 1.05rem;
  color: #2c3e50;
  font-weight: 600;
}

.garage-card .text-muted {
  color: #6c757d !important;
  font-size: 0.95rem;
}

/* Selectable cards */
.garage-card-selectable { 
  cursor: pointer; 
}

.garage-card-selectable:hover { 
  border-color: #4a90e2;
  background: #f8fbff;
}

.garage-card-selected { 
  border-color: #007bff; 
  border-width: 2px; 
  background: #f0f7ff; 
  box-shadow: 0 4px 16px rgba(0, 123, 255, 0.15);
}

/* Button group spacing */
.garage-card .d-flex.gap-2 {
  gap: 8px;
}

.garage-card .btn-sm {
  padding: 6px 14px;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Badge styling */
.garage-card .badge {
  padding: 6px 12px;
  font-weight: 500;
  font-size: 0.875rem;
}

/* Delete modal overlay */
.delete-overlay { 
  position: fixed; 
  inset: 0; 
  background: rgba(0, 0, 0, 0.5); 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  z-index: 1050;
  backdrop-filter: blur(2px);
}

.delete-confirm { 
  max-width: 440px; 
  width: 90%; 
  border-radius: 12px; 
  background: #fff; 
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  animation: modalSlideIn 0.2s ease-out;
  padding: 20px;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.delete-confirm h5 {
  color: #2c3e50;
  font-weight: 600;
  margin-bottom: 12px;
}

.delete-confirm p {
  color: #6c757d;
  line-height: 1.6;
}

/* Loading state */
.garage-loading {   
  display: flex;
  align-items: center;
  gap: 12px;
  color: #6c757d;
  padding: 20px 0;
  font-size: 0.95rem;
}

/* Empty state */
.garage-empty {
  color: #95a5a6;
  font-style: italic;
  padding: 20px 0;
  text-align: center;
  font-size: 0.95rem;
}

/* Spinner animation */
.spinner {
  border: 3px solid #f3f4f6;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Form button spacing */
.garage-form .mt-3 {
  margin-top: 20px !important;
}

.garage-form .btn {
  font-weight: 500;
  padding: 8px 20px;
}

/* Responsive Design */
/* Tablet and above - maintain side-by-side layout */
@media (min-width: 768px) and (max-width: 1199px) {
  .garage-section {
    padding: 20px 16px;
  }
  
  .garage-form {
    padding: 18px 16px;
  }
  
  .garage-card {
    padding: 14px 16px;
  }
  
  .garage-card strong {
    font-size: 1rem;
  }
  
  .garage-section h4 {
    font-size: 1.35rem;
  }
  
  .garage-card .btn-sm {
    padding: 5px 12px;
    font-size: 0.8rem;
  }
}

/* Small tablets - more compact */
@media (min-width: 576px) and (max-width: 767px) {
  .garage-section {
    padding: 16px 12px;
  }
  
  .garage-form {
    padding: 16px 14px;
  }
  
  .garage-card {
    padding: 12px 14px;
  }
  
  .garage-card strong {
    font-size: 0.95rem;
  }
  
  .garage-section h4 {
    font-size: 1.25rem;
  }
  
  .garage-card .d-flex.justify-content-between {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start !important;
  }
  
  .garage-card .btn-sm {
    padding: 5px 10px;
    font-size: 0.75rem;
  }
}

/* Mobile phones only - stack below */
@media (max-width: 575px) {
  .garage-section {
    padding: 16px;
  }
  
  .garage-form {
    max-width: 100%;
    padding: 16px;
  }
  
  .garage-section h4 {
    font-size: 1.2rem;
  }
  
  .garage-card {
    padding: 12px;
  }
  
  .garage-card strong {
    font-size: 0.9rem;
  }
  
  .garage-card .text-muted {
    font-size: 0.85rem;
  }
  
  .garage-card .d-flex.justify-content-between {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start !important;
  }
  
  .garage-card .d-flex.gap-2 {
    width: 100%;
    justify-content: flex-start;
  }
  
  .garage-card .btn-sm {
    padding: 6px 12px;
    font-size: 0.8rem;
    flex: 1;
  }
  
  .garage-form {
    padding: 16px;
  }
  
  .garage-form .d-flex.gap-2 {
    flex-direction: column;
  }
  
  .garage-form .btn {
    width: 100%;
  }
  
  .delete-confirm {
    max-width: 95%;
    margin: 0 10px;
  }
}
</style>
