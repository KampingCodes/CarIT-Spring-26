<!-- src/views/VehicleQuestions.vue -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState } from '../auth.js'
import { getQuestions } from '../apis.js'

const route = useRoute()
const router = useRouter()

const details = route.query || {}
const vehicle = { year: details.year, make: details.make, model: details.model, trim: details.trim }
const issues = details.issues || 'No issues provided'

const loading = ref(false)
const error = ref(null)
const questions = ref([])
const userAnswers = ref({})

const canProceed = computed(() => questions.value.every(q => userAnswers.value[q.id]))
const isGuest = computed(() => !authState.isAuthenticated)

const handleAnswer = (questionId, optionId) => {
  userAnswers.value[questionId] = optionId
}

const getFeedback = async () => {
  loading.value = true
  error.value = null
  try {
    const resp = await getQuestions(vehicle, issues)
    const json = resp.replace(/```json\n?|\n?```/g, '').trim()
    const data = JSON.parse(json)
    if (!data.questions || !Array.isArray(data.questions))
      throw new Error('Invalid response format')
    questions.value = data.questions
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const proceedToFlowchart = () => {
  if (!canProceed.value) return

  const answers = Object.entries(userAnswers.value).map(([questionId, optionId]) => {
    const question = questions.value.find(q => q.id === questionId)
    const option = question.options.find(opt => opt.id === optionId)
    return { question: question.text, answer: option.text, option: option.text }
  });

  const encodedAnswers = JSON.stringify(answers)
  router.push({
    path: '/vehicle-flowchart',
    query: {
      ...vehicle,
      issues,
      answers: encodedAnswers
    }
  })
}

onMounted(getFeedback)
</script>

<template>
  <div class="untree_co-section" id="features-section">
    <div class="container" style="max-width:800px;margin:20px auto;">
      <h2>Vehicle Help</h2>
      <p><strong>Vehicle:</strong> {{ vehicle.make }} {{ vehicle.model }} ({{ vehicle.year }})</p>
      <p><strong>Issues:</strong> {{ issues }}</p>
      <div v-if="isGuest" class="guest-banner">
        Guest mode is active. Your generated flowchart will not be saved after this session ends.
      </div>

      <div v-if="loading" class="loading">Loading...</div>
      <div v-else-if="error" class="error">Error: {{ error }}</div>
      <div v-else>
        <h3>Please Answer These Questions</h3>
        <div v-for="q in questions" :key="q.id" class="question-card">
          <p class="question-text">{{ q.text }}</p>
          <div class="options">
            <div
              v-for="opt in q.options"
              :key="opt.id"
              :class="{ option: true, selected: userAnswers[q.id] === opt.id }"
              @click="handleAnswer(q.id, opt.id)"
            >
              {{ opt.text }}
            </div>
          </div>
        </div>
        <button @click="proceedToFlowchart" :disabled="!canProceed" class="btn btn-primary mt-4">
          Generate Diagnostic Flowchart
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.question-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  background-color: white;
}

.question-text {
  font-weight: 600;
  margin-bottom: 15px;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option {
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option:hover {
  background-color: #f5f5f5;
}

.option.selected {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.flowchart-container {
  margin: 20px 0;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: white;
  overflow-x: auto;
}

.loading {
  text-align: center;
  padding: 20px;
  font-style: italic;
}

.error {
  color: #dc3545;
  padding: 10px;
  border: 1px solid #dc3545;
  border-radius: 4px;
  margin-top: 10px;
}

.guest-banner {
  margin: 1rem 0;
  padding: 0.85rem 1rem;
  border: 1px solid #ffe08a;
  background: #fff8db;
  border-radius: 8px;
  color: #725400;
}
</style>
