<!-- Form -->

<script setup>
import { reactive } from 'vue';
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter();

const formData = reactive({
  make: "",
  model: "",
  year: "",
  mileage: "",
  engine: "",
  transmission: "",
  trim: "",
  bodystyle: ""
});

function handleSubmit() {
  console.log("Form submitted:", formData);
  // Navigate to VehicleHelp.vue with form info
  router.push({
    path: '/vehicle-submit',
    query: { ...formData }   // spread the reactive object into query params
  });
}
</script>

<template>
  <main>
    <div class="form-container">
      <form @submit.prevent="handleSubmit">
        <label>
          Vehicle Make
          <input v-model="formData.make" type="text" />
        </label>
        <label>
          Vehicle Model
          <input v-model="formData.model" type="text" />
        </label>
        <label>
          Year
          <input v-model="formData.year" type="text" />
        </label>
        <label>
          Mileage
          <input v-model="formData.mileage" type="text" />
        </label>
        <label>
          Engine
          <input v-model="formData.engine" type="text" />
        </label>
        <label>
          Transmission
          <input v-model="formData.transmission" type="text" />
        </label>
        <label>
          Trim
          <input v-model="formData.trim" type="text" />
        </label>
        <label>
          Bodystyle
          <input v-model="formData.bodystyle" type="text" />
        </label>

        <!-- Submit -->
        <button type="submit">Submit</button>
      </form>
    </div>
  </main>
</template>

<style scoped>
.form-container {
  max-width: 600px;
  margin: 20px auto;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.form-container label {
  display: block;
  margin-bottom: 15px;
  font-weight: bold;
}

.form-container input {
  display: block;
  width: calc(100% - 2px);
  padding: 8px;
  margin-left: 2px;
  margin-top: 8px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  margin: 10px 2px;
  padding: 10px 30px;
  background-color: #007bff;
  color: white;
  font-weight: bold;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #0056b3;
}
</style>
