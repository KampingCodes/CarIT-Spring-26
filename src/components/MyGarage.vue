<script setup>
import { ref, onMounted } from 'vue';
import { getGarage, addGarageVehicle, editGarageVehicle, removeGarageVehicle } from '../apis.js';
import VehicleSelector from './VehicleSelector.vue';

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

onMounted(async () => {
  try {
    garage.value = await getGarage();
  } catch (err) {
    console.error('Error loading garage:', err);
  } finally {
    initialLoading.value = false;
  }
});
</script>

<template>
  <div class="garage-section">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h4 class="mb-0">My Garage</h4>
      <button v-if="editable" class="btn btn-primary btn-sm" @click="openAddForm" :disabled="showAddForm">+ Add Vehicle</button>
    </div>

    <!-- Add / Edit form (editable mode only) -->
    <div v-if="editable && showAddForm" class="garage-form card p-3 mb-3">
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
    <div v-if="initialLoading" class="garage-loading">
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
            <span v-if="car.trim" class="text-muted ms-2">– {{ car.trim }}</span>
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
.garage-section { position: relative; }
.garage-form { border: 1px solid #dee2e6; border-radius: 8px; background: #f8f9fa; }
.garage-card { border: 1px solid #dee2e6; border-radius: 8px; transition: box-shadow 0.2s ease, border-color 0.2s ease; }
.garage-card:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
.garage-card-selectable { cursor: pointer; }
.garage-card-selectable:hover { border-color: #007bff; }
.garage-card-selected { border-color: #007bff; border-width: 2px; background: #f0f7ff; box-shadow: 0 2px 12px rgba(0, 123, 255, 0.15); }
.delete-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1050; }
.delete-confirm { max-width: 420px; width: 90%; border-radius: 8px; background: #fff; box-shadow: 0 8px 30px rgba(0,0,0,0.2); }

.garage-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #666;
  padding: 12px 0;
}

.garage-empty {
  color: #888;
  font-style: italic;
  padding: 12px 0;
}

.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
