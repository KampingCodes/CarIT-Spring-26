<!-- Form -->

<script setup>
import NaviBar from './NaviBar.vue';
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
  <NaviBar />
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
  font-size: 14px;
}

.form-container input {
  display: block;
  width: 100%;
  padding: 10px;
  margin-top: 8px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
  -webkit-appearance: none;
  appearance: none;
}

.form-container input:focus {
  outline: none;
  border-color: #407BFF;
  box-shadow: 0 0 5px rgba(64, 123, 255, 0.3);
}

button {
  margin: 10px auto;
  padding: 12px 30px;
  background-color: #407BFF;
  color: white;
  font-weight: bold;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  min-height: 44px;
  width: 100%;
  transition: background-color 0.3s ease;
}

button:hover {
  background-color: #2e5cc8;
}

button:active {
  background-color: #1e3a99;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .form-container {
    max-width: 100%;
    margin: 15px;
    padding: 15px;
  }

  .form-container label {
    margin-bottom: 12px;
    font-size: 13px;
  }

  .form-container input {
    padding: 12px;
    font-size: 16px;
    margin-top: 5px;
  }

  button {
    margin: 15px auto;
    padding: 14px 20px;
    font-size: 14px;
  }
}

@media (max-width: 576px) {
  .form-container {
    margin: 10px;
    padding: 12px;
    border-radius: 6px;
  }

  .form-container label {
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 600;
  }

  .form-container input {
    padding: 10px;
    font-size: 16px;
    border-radius: 4px;
    margin-top: 6px;
  }

  button {
    width: 100%;
    margin: 12px 0;
    padding: 12px 20px;
  }
}
</style>
