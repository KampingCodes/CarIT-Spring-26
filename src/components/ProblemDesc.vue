<script setup>
import { useRoute, useRouter } from 'vue-router';
import { ref } from 'vue';

const service1SubHeading = "What's going on with your";
const route = useRoute();
const router = useRouter();
const vehicle = route.query;

// Reactive variables
const problemDescription = ref("");
const vehicleYear = ref(vehicle.year);
const vehicleMake = ref(vehicle.make);

// Form submission
function submitProblem() {
  router.push({
    path: '/vehicle-questions',
    query: {
      ...vehicle,
      issues: problemDescription.value
    },
  })
}

</script>

<template>
  <div class="untree_co-section" id="features-section">
    <div class="container">
      <div class="row justify-content-between">
        <div class="col-lg-4 problem-desc-offset">
          <h3 class="heading mb-2" data-aos="fade-up" data-aos-delay="100">
            {{ service1SubHeading }}
          </h3>
          <div v-if="vehicleYear && vehicleMake" class="vehicle-blue mb-4" data-aos="fade-up" data-aos-delay="120">
            {{ vehicleYear }} {{ vehicleMake }}
          </div>
          <div class="mb-4" data-aos="fade-up" data-aos-delay="200">
            <p>
              Please describe the issue you are experiencing with your vehicle in as much detail as possible. This will help us provide the most accurate assistance. If you have any relevant symptoms, noises, warning lights, or recent repairs, please include them below.
            </p>
            <div v-if="problemDescription.trim().length > 0" class="mt-3">
              <button class="btn btn-primary submit-btn" type="button" @click="submitProblem">
                Submit
              </button>
            </div>
          </div>
        </div>
        <div class="col-lg-7" data-aos="fade-up" data-aos-delay="400">
          <div class="problem-desc-box">
            <textarea id="problemDescription" class="form-control problem-textarea" rows="10" placeholder="Describe the problem you're experiencing with your vehicle..." v-model="problemDescription"></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.problem-desc-offset {
  margin-top: 2.5rem;
}
.vehicle-blue {
  font-size: 2rem;
  font-weight: 600;
  color: #0d6efd;
  margin-bottom: 1.5rem;
}
.problem-desc-box {
  background: var(--color-surface);
  border-radius: 1rem;
  box-shadow: 0 2px 16px rgba(0,0,0,0.07);
  padding: 2rem 2rem 1.5rem 2rem;
  margin-top: 1.5rem;
}
.problem-textarea {
  width: 100%;
  min-height: 220px;
  font-size: 1.15rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  padding: 1rem;
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  resize: vertical;
  transition: border-color 0.2s;
}
.problem-textarea:focus {
  border-color: var(--primary, #0d6efd);
  outline: none;
  background: var(--color-surface);
}
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
</style>
