<!-- src/views/VehicleFlowchart.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import mermaid from 'mermaid/dist/mermaid.esm.min.mjs';
import { getFlowchart } from '../apis.js';
import FlowchartViewer from './FlowchartViewer.vue';

const route = useRoute();
const router = useRouter();

const vehicle = {
  year: route.query.year,
  make: route.query.make,
  model: route.query.model,
  trim: route.query.trim
};

const issues = route.query.issues;
const answers = JSON.parse(route.query.answers || '{}');

const flowchartSvg = ref('');
const loading = ref(false);
const error = ref(null);

const getVehicleDisplayName = (vehicleDetails = {}) => {
  const parts = [vehicleDetails.year, vehicleDetails.make, vehicleDetails.model, vehicleDetails.trim].filter(Boolean);
  return parts.join(' ') || 'Unknown vehicle';
};

const initializeMermaid = () => {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    flowchart: { htmlLabels: true, curve: 'basis' }
  });
};

const getDiagram = async () => {
  loading.value = true;
  error.value = null;
  try {
    const resp = await getFlowchart(vehicle, issues, answers);
    const mermaidMatch = resp.match(/```mermaid\n([\s\S]*?)\n```/);
    if (!mermaidMatch) throw new Error('Mermaid code block not found');
    const code = mermaidMatch[1].trim();
    await mermaid.parse(code);
    const { svg } = await mermaid.render('diagnostic-flowchart', code);
    flowchartSvg.value = svg;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.push({ path: '/vehicle-questions', query: route.query });
};

onMounted(() => {
  initializeMermaid()
  getDiagram()
});

</script>

<template>
  <div class="untree_co-section" id="features-section">
    <div class="container">
      <div class="flowchart-page-shell">
        <h2>Vehicle Help</h2>
        <p><strong>Vehicle:</strong> {{ getVehicleDisplayName(vehicle) }}</p>
        <p><strong>Issues submitted:</strong> {{ issues }}</p>
        <div class="flowchart-page-content">
          <div class="flowchart-viewer-card">
            <h3>Diagnostic Flowchart</h3>
            <div v-if="loading" class="loading">Generating flowchart...</div>
            <div v-else-if="error" class="error">Error: {{ error }}</div>
            <FlowchartViewer
              v-else
              :svg="flowchartSvg"
              :title="getVehicleDisplayName(vehicle)"
              embedded-height="40rem"
            />
            <button @click="goBack" class="btn btn-secondary mt-4">Back to Questions</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flowchart-page-shell {
  max-width: 1200px;
  margin: 20px auto;
}

.flowchart-page-content {
  margin-top: 1rem;
}

.flowchart-viewer-card {
  margin: 20px auto;
}

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
