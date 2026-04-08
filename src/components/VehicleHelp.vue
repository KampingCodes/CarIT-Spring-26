<script setup>
import MarkdownIt from 'markdown-it';
import { useRoute } from "vue-router";
import { getResponse, getFlowchart, getQuestions } from "../genai.js";
import { getVehicles } from "../vehicles.js";
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import mermaid from 'mermaid/dist/mermaid.esm.min.mjs';
import FlowchartViewer from './FlowchartViewer.vue';
import { useThemeStore } from '../stores/theme';
import { getMermaidConfig, applyMermaidThemeToSvg } from '../flowchart-utils.js';

const themeStore = useThemeStore();
const currentMermaidCode = ref('');

// Initialize mermaid only when component is mounted
const initializeMermaid = () => {
  mermaid.initialize(getMermaidConfig(themeStore.isDark));
};

// Get query params
const route = useRoute();
const details = route.query || {};

// Get vehicle data
const vehicle = { year: details.year, make: details.make, model: details.model, trim: details.trim };
const issues = details.issues || "No issues provided";

// Status variables
const aiOutput = ref('');
const questions = ref([]);
const userAnswers = ref({});
const loading = ref(false);
const error = ref(null);
const step = ref('questions'); // 'questions' or 'flowchart'
const flowchartSvg = ref('');

// Helper to get feedback from the AI
const getFeedback = async () => {
  loading.value = true;
  error.value = null;

  try {
    if (step.value === 'questions') {
      // Get the multiple choice questions
      // const resp = await getResponse(generateQuestionsPrompt(), 'questions');
      const resp = await getQuestions(vehicle, issues);
      try {
        // Log the response for debugging
        console.log('AI Response:', resp);
        
        // Try to clean the response if it contains markdown backticks
        const jsonStr = resp.replace(/```json\n?|\n?```/g, '').trim();
        console.log('Cleaned JSON:', jsonStr);
        
        const data = JSON.parse(jsonStr);
        if (!data.questions || !Array.isArray(data.questions)) {
          throw new Error('Invalid response format: missing questions array');
        }
        questions.value = data.questions;
      } catch (parseErr) {
        console.error('Parse error:', parseErr);
        throw new Error(`Failed to parse AI response as JSON. Error: ${parseErr.message}`);
      }
    } else {
      // Get the flowchart
      // const resp = await getResponse(generateFlowchartPrompt(), 'flowchart');
      
      const responses = Object.entries(userAnswers.value)
        .map(([questionId, answer]) => {
          const question = questions.value.find(q => q.id === questionId);
          const option = question?.options.find(opt => opt.id === answer);
          return {
            question: question?.text,
            option: option?.text
          };
        })
      
      const resp = await getFlowchart(vehicle, issues, responses);
      console.log('Flowchart response:', resp);
      
      // Extract the Mermaid diagram from the response
      const mermaidMatch = resp.match(/```mermaid\n([\s\S]*?)\n```/);
      if (mermaidMatch) {
        let mermaidCode = mermaidMatch[1].trim();
        console.log('Original Mermaid code:', mermaidCode);
        
        // First, ensure we have the header on its own line
        mermaidCode = mermaidCode.replace(/^graph TD\s+/, 'graph TD\n');
        
        // Split the code into lines and process each line
        const lines = mermaidCode.split('\n');
        const processedLines = lines.map(line => {
          // Skip the header line
          if (line.trim() === 'graph TD') return line;
          
          // Remove special characters and clean up the line
          return line
            .replace(/\(e\.g\.,?\s[^)]*\)/g, '')  // Remove e.g. examples
            .replace(/[()]/g, '')  // Remove regular parentheses except for start/end nodes
            .replace(/[^a-zA-Z0-9\s{}>|\[\]"-_]/g, '')  // Remove other special characters
            .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
            .trim();
        });
        
        // Reconstruct the Mermaid code with proper formatting
        mermaidCode = processedLines
          .filter(line => line.trim())  // Remove empty lines
          .join('\n    ');  // Add proper indentation
        
        // Ensure proper spacing for the first node definition
        mermaidCode = mermaidCode.replace(/^(graph TD)\s*([A-Z])/, '$1\n    $2');
        
        console.log('Sanitized Mermaid code:', mermaidCode);
        
        // Basic syntax validation
        if (!mermaidCode.startsWith('graph TD') && !mermaidCode.startsWith('flowchart TD')) {
          throw new Error('Invalid flowchart format: Must start with "graph TD" or "flowchart TD"');
        }
        
        try {
          // Validate the diagram first
          await mermaid.parse(mermaidCode);
          
          // If validation passes, render the diagram
          currentMermaidCode.value = mermaidCode;
          const { svg } = await mermaid.render('diagnostic-flowchart', mermaidCode);
          flowchartSvg.value = applyMermaidThemeToSvg(svg, themeStore.isDark);
        } catch (mermaidErr) {
          console.error('Mermaid error:', mermaidErr);
          throw new Error(`Failed to render flowchart diagram: ${mermaidErr.message}`);
        }
      } else {
        throw new Error('Invalid flowchart format: Mermaid code block not found');
      }
    }
  } catch (err) {
    error.value = err?.message || String(err);
  } finally {
    loading.value = false;
  }
};

// Handle user's answer selection
const handleAnswer = (questionId, answerId) => {
  userAnswers.value[questionId] = answerId;
};

// Check if all questions are answered
const canProceed = computed(() => {
  return questions.value.every(q => userAnswers.value[q.id]);
});

// Proceed to flowchart generation
const proceedToFlowchart = () => {  
  if (canProceed.value) {
    step.value = 'flowchart';
    getFeedback();
  }
};

// Reset answers and go back to questions
const resetToQuestions = () => {
  userAnswers.value = {};
  step.value = 'questions';
  getFeedback();
};

onMounted(() => {
  // Initialize mermaid when component is mounted
  initializeMermaid();
  // Fire the AI request when the page loads
  getFeedback();
});

watch(() => themeStore.isDark, async () => {
  initializeMermaid();
  if (currentMermaidCode.value) {
    const { svg } = await mermaid.render(`diagnostic-flowchart-${Date.now()}`, currentMermaidCode.value);
    flowchartSvg.value = applyMermaidThemeToSvg(svg, themeStore.isDark);
  }
});

// Cleanup when component is unmounted
onBeforeUnmount(() => {
  // Clear any Mermaid diagrams and reset state
  flowchartSvg.value = '';
  mermaid.initialize({ startOnLoad: false });
});
</script>

<template>
  <div class="untree_co-section" id="features-section">
    <div class="container">
      <div style="max-width:800px;margin:20px auto;">
        <h2>Vehicle Help</h2>
        <p><strong>Vehicle:</strong> {{ vehicle.make || 'Unknown' }} {{ vehicle.model || '' }} ({{ vehicle.year || '' }})</p>
        <p><strong>Issues submitted:</strong> {{ issues }}</p>
        
        <div style="margin-top:1rem;">
          <!-- Show a loading indicator -->
          <div v-if="loading" class="loading">Loading...</div>

          <div v-else-if="error" class="error">Error: {{ error }}</div>

          <div v-else>
            <!-- Questions Section -->
            <div v-if="step === 'questions'" class="questions-section">
              <h3>Please Answer These Questions</h3>
              <div v-for="question in questions" :key="question.id" class="question-card">
                <p class="question-text">{{ question.text }}</p>
                <div class="options">
                  <div v-for="option in question.options" :key="option.id" 
                       class="option" 
                       :class="{ selected: userAnswers[question.id] === option.id }"
                       @click="handleAnswer(question.id, option.id)">
                    {{ option.text }}
                  </div>
                </div>
              </div>
              <button 
                @click="proceedToFlowchart" 
                :disabled="!canProceed"
                class="btn btn-primary mt-4">
                Generate Diagnostic Flowchart
              </button>
            </div>

            <!-- Flowchart Section -->
            <div v-else class="flowchart-section">
              <h3>Diagnostic Flowchart</h3>
              <FlowchartViewer
                v-if="flowchartSvg"
                :svg="flowchartSvg"
                :title="`${vehicle.make || 'Unknown'} ${vehicle.model || ''} ${vehicle.year ? `(${vehicle.year})` : ''}`.trim()"
                embedded-height="40rem"
              />
              <div v-else class="loading">Generating flowchart...</div>
              <button 
                @click="resetToQuestions" 
                class="btn btn-secondary mt-4">
                Back to Questions
              </button>
            </div>
          </div>
        </div>
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
</style>