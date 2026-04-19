<!-- src/views/VehicleFlowchart.vue -->
<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import mermaid from 'mermaid/dist/mermaid.esm.min.mjs';
import { useThemeStore } from '../stores/theme';
import { authState } from '../auth.js';
import { getFlowchart } from '../apis.js';
import FlowchartViewer from './FlowchartViewer.vue';
import NodeContextPanel from './NodeContextPanel.vue';
import {
  buildMermaidNodeMap,
  normalizeDiagnosticResponses,
  normalizeFlowchartRecord,
  prepareMermaidForRender,
  resolveNodeSelection,
  getMermaidConfig,
  applyMermaidThemeToSvg
} from '../flowchart-utils.js';

const route = useRoute();
const router = useRouter();

const vehicle = {
  year: route.query.year,
  make: route.query.make,
  model: route.query.model,
  trim: route.query.trim
};

const issues = route.query.issues;

const flowchartSvg = ref('');
const loading = ref(false);
const error = ref(null);
const currentFlowchart = ref(null);
const selectedNode = ref(null);
const panelOpen = ref(false);

const answers = ref(parseAnswers(route.query.answers));
const themeStore = useThemeStore();

const nodeMap = computed(() => buildMermaidNodeMap(currentFlowchart.value?.mermaidCode || ''));
const isGuestSession = computed(() => !authState.isAuthenticated || Boolean(currentFlowchart.value?.sessionOnly));

const getVehicleDisplayName = (vehicleDetails = {}) => {
  const parts = [vehicleDetails.year, vehicleDetails.make, vehicleDetails.model, vehicleDetails.trim].filter(Boolean);
  return parts.join(' ') || 'Unknown vehicle';
};

const initializeMermaid = () => {
  mermaid.initialize(getMermaidConfig(themeStore.isDark));
};

const renderDiagram = async (mermaidCode) => {
  if (!mermaidCode) {
    throw new Error('Mermaid code block not found');
  }

  const renderCode = prepareMermaidForRender(mermaidCode);
  await mermaid.parse(renderCode);
  const { svg } = await mermaid.render(`diagnostic-flowchart-${Date.now()}`, renderCode);
  flowchartSvg.value = applyMermaidThemeToSvg(svg, themeStore.isDark);
};

const generateFlowchart = async () => {
  loading.value = true;
  error.value = null;

  try {
    const response = await getFlowchart(vehicle, issues, answers.value);
    const record = normalizeFlowchartRecord(response, Date.now());
    currentFlowchart.value = record;
    await renderDiagram(record.mermaidCode);
  } catch (err) {
    error.value = err?.message || 'Unable to generate flowchart';
  } finally {
    loading.value = false;
  }
};

const handleNodeActivate = (selection) => {
  const resolved = resolveNodeSelection(selection, nodeMap.value);
  if (!resolved?.nodeId) {
    return;
  }

  selectedNode.value = resolved;
  panelOpen.value = true;
};

const closeNodePanel = () => {
  panelOpen.value = false;
};

const goBack = () => {
  router.push({ path: '/vehicle-questions', query: route.query });
};

onMounted(() => {
  initializeMermaid();
  generateFlowchart();
});

watch(() => themeStore.isDark, async () => {
  initializeMermaid();
  if (currentFlowchart.value?.mermaidCode) {
    await renderDiagram(currentFlowchart.value.mermaidCode);
  }
});

function parseAnswers(encodedAnswers) {
  try {
    return normalizeDiagnosticResponses(JSON.parse(encodedAnswers || '[]'));
  } catch {
    return [];
  }
}
</script>

<template>
  <div class="untree_co-section" id="features-section">
    <div class="container">
      <div class="flowchart-page-shell">
        <h2>Diagnostic Flowchart</h2>
        <p><strong>Vehicle:</strong> {{ getVehicleDisplayName(vehicle) }}</p>
        <p><strong>Issues submitted:</strong> {{ issues }}</p>
        <div v-if="isGuestSession" class="guest-session-banner">
          Guest flowcharts are temporary and are not added to your saved flowcharts or profile history.
        </div>

        <div v-if="currentFlowchart?.responses?.length" class="responses-section">
          <h3>Diagnostic Answers</h3>
          <div v-for="(response, idx) in currentFlowchart.responses" :key="idx" class="response-item">
            <strong>{{ response.question }}</strong><br />
            {{ response.answer }}
          </div>
        </div>

        <div class="flowchart-page-content">
          <div class="flowchart-viewer-card">
            <div class="flowchart-card-header">
            </div>

            <div v-if="loading" class="loading">Generating flowchart...</div>
            <div v-else-if="error" class="error">Error: {{ error }}</div>
            <FlowchartViewer
              v-else
              :svg="flowchartSvg"
              :title="getVehicleDisplayName(vehicle)"
              embedded-height="40rem"
              @node-activate="handleNodeActivate"
            />

            <button @click="goBack" class="btn btn-secondary mt-4">Back to Questions</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <NodeContextPanel
    :open="panelOpen"
    :node="selectedNode"
    :context="{ vehicle, issues, mermaidCode: currentFlowchart?.mermaidCode, flowchartId: currentFlowchart?.flowchartId }"
    @close="closeNodePanel"
  />
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

.flowchart-card-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
  margin-bottom: 1rem;
}

.flowchart-helper-text {
  margin: 0.35rem 0 0;
  color: var(--color-text-muted);
}

.responses-section {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: 12px;
  padding: 1rem;
  margin-top: 1rem;
  color: var(--color-text-primary);
}

.response-item + .response-item {
  margin-top: 0.75rem;
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

.guest-session-banner {
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border-radius: 10px;
  background: #fff8db;
  border: 1px solid #ffe08a;
  color: #725400;
}

@media (max-width: 768px) {
  .untree_co-section#features-section {
    padding-top: 3rem;
  }

  .flowchart-page-shell {
    margin: 0 auto;
  }
}
</style>
