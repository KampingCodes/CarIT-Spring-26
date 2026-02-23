<script setup>
import NaviBar from "./NaviBar.vue";
import { useRoute } from "vue-router";
import { addVehicle } from "../vehicles.js";
import { authState } from "../auth.js";
import MyGarage from './MyGarage.vue';

const route = useRoute();

// All form data is available here
const vehicle = route.query;

addVehicle(vehicle);

/**
 * Return a displayable value or a default placeholder when empty.
 * Treats undefined, null, empty string, and strings with only whitespace as empty.
 */
const formatField = (val, placeholder = "None") => {
  if (val === undefined || val === null) return placeholder;
  if (typeof val === "string") {
    return val.trim() === "" ? placeholder : val;
  }
  // For numbers and other types, convert to string if not NaN
  if (typeof val === "number") return isNaN(val) ? placeholder : String(val);
  return String(val);
};

</script>

<template>
  <div>
    <main>
      <NaviBar />
    </main>
    <div class="vehicle-container">
      <h1>Vehicle Submitted</h1>
      <div class="vehicle-info">
        <h2>Your Vehicle Information</h2>
        <table class="vehicle-table">
          <tbody>
            <tr>
              <th>Make</th>
              <td>{{ formatField(vehicle.make) }}</td>
            </tr>
            <tr>
              <th>Model</th>
              <td>{{ formatField(vehicle.model) }}</td>
            </tr>
            <tr>
              <th>Year</th>
              <td>{{ formatField(vehicle.year) }}</td>
            </tr>
            <tr>
              <th>Mileage</th>
              <td>{{ formatField(vehicle.mileage) }}</td>
            </tr>
            <tr>
              <th>Engine</th>
              <td>{{ formatField(vehicle.engine) }}</td>
            </tr>
            <tr>
              <th>Transmission</th>
              <td>{{ formatField(vehicle.transmission) }}</td>
            </tr>
            <tr>
              <th>Trim</th>
              <td>{{ formatField(vehicle.trim) }}</td>
            </tr>
            <tr>
              <th>Bodystyle</th>
              <td>{{ formatField(vehicle.bodystyle) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Garage section (logged-in users only) -->
      <MyGarage v-if="authState.isAuthenticated" class="garage-section" />
    </div>
  </div>
</template>

<style scoped>
.vehicle-container {
  padding: 20px;
  max-width: 800px;
  margin: auto;
  margin-top: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 2px 2px 24px rgba(0, 0, 0, 0.2);
}

.vehicle-info {
  margin-top: 20px;
}

.vehicle-info h2 {
  margin-top: 0;
}

.vehicle-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
  font-size: 16px;
  table-layout: fixed; /* keep columns consistent so rows line up */
}

.vehicle-table th,
.vehicle-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #e6e6e6;
  vertical-align: top;
  word-break: break-word;
}

.vehicle-table th {
  text-align: left;
  width: 180px; /* fixed label column for consistent alignment */
  min-width: 120px;
  color: #333;
  font-weight: 600;
  background-color: #fafafa;
}

.vehicle-table tr:last-child th,
.vehicle-table tr:last-child td {
  border-bottom: none;
}

/* Garage section styles */
.garage-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 2px solid #e6e6e6;
}
</style>
