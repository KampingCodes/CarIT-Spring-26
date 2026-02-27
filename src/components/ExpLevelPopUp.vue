<script setup>

import { ref, onMounted, watch } from 'vue';
import { authState } from '../auth.js';
import { getUserData, setUserData } from '../apis.js';


const isVisible = ref(false);
const ExperienceLevel = ref(null);


const closePopup = () => {
  isVisible.value = false;
};

const selectedExperience = ref();

function handleSubmit() {
  
  let experienceLevel = selectedExperience.value;

  console.log("Selected experience level:", experienceLevel);

  setUserData({ experienceLevel: experienceLevel });
  
  closePopup();
}

// Check user experience level
async function checkExperienceLevel() {
  if (!authState.isAuthenticated) return;
  try {
    const userData = await getUserData();
    ExperienceLevel.value = userData?.experienceLevel || null;
    console.log("Fetched experience level:", ExperienceLevel.value);
    
    const validLevels = ['Beginner', 'Intermediate', 'Expert'];
    // Show popup if experience level is null or not one of the valid options
    if (ExperienceLevel.value === null || !validLevels.includes(ExperienceLevel.value)) {
      isVisible.value = true;
    }
  } catch (err) {
    console.warn('Unable to fetch user data:', err?.message || err);
  }
}

// Check on mount
onMounted(() => {
  checkExperienceLevel();
});

// Watch for authentication changes
watch(() => authState.isAuthenticated, (isAuth) => {
  if (isAuth) {
    checkExperienceLevel();
  }
});


</script>

<template>
  <!-- checks if user is authenticated and experience level is null, Beginner, Intermediate, or Expert, then shows the popup -->
  <div v-if="authState.isAuthenticated && isVisible" class="popup-overlay">
    <div class="popup-content">
      <div class="popup-header">
        <button class="close-btn" @click="closePopup">&times;</button>
      </div>
      <p class="popup-text">What's your Experience Level?</p>
      <p class="popup-text" style="font-size: 1rem; color: gray; font-weight: normal; margin-top: 0.5rem;">This helps us tailor the experience to your needs so that we can help you fix your car in the best way possible.</p>
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <input v-model="selectedExperience" type="radio" id="Beginner" name="experience" value="Beginner">
          <label for="Beginner">Beginner - What's a car?</label>
          <input v-model="selectedExperience" type="radio" id="Intermediate" name="experience" value="Intermediate">
          <label for="Intermediate">Intermediate - I know the basics</label>
          <input v-model="selectedExperience" type="radio" id="Expert" name="experience" value="Expert">
          <label for="Expert">Expert - I know my car inside and out</label>

          <div class="submit-button">
            <button class="submit-btn" type="submit">Submit</button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.popup-content {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  max-width: 400px;
  position: relative;
}

.popup-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.popup-text {
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
  margin: 0;
  color: #333;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

input[type="radio"] {
  display: none;
}

label {
  display: block;
  padding: 0.8rem;
  background: #f0f0f0;
  border-radius: 5px;
  text-align: center;
  cursor: pointer;
  transition: background 0.3s, color 0.3s;
}

label:hover {
  background: #e0e0e0;
}

input[type="radio"]:checked + label {
  background: #007bff;
  color: white;
}

.submit-button {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.submit-btn {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
  padding: 0.8rem 2rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1rem;
  cursor: pointer;
}

.submit-btn:hover {
    background-color: #0056b3;
  }


</style>
