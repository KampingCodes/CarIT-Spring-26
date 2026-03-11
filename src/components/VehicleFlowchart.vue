<!-- src/views/VehicleFlowchart.vue -->
<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import mermaid from 'mermaid/dist/mermaid.esm.min.mjs';
import { getFlowchart, refineFlowchartNode, saveFlowchartNodeContext } from '../apis.js';
import FlowchartViewer from './FlowchartViewer.vue';
import NodeContextPanel from './NodeContextPanel.vue';
import {
  buildMermaidNodeMap,
  normalizeDiagnosticResponses,
  normalizeFlowchartRecord,
  resolveNodeSelection
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
const savingContext = ref(false);
const refiningFlowchart = ref(false);

const answers = ref(parseAnswers(route.query.answers));

const nodeMap = computed(() => buildMermaidNodeMap(currentFlowchart.value?.mermaidCode || ''));
const currentNodeContext = computed(() => {
  const nodeId = selectedNode.value?.nodeId;
  return nodeId ? currentFlowchart.value?.nodeContexts?.[nodeId] || {} : {};
});

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

const renderDiagram = async (mermaidCode) => {
  if (!mermaidCode) {
    throw new Error('Mermaid code block not found');
  }

  await mermaid.parse(mermaidCode);
  const { svg } = await mermaid.render(`diagnostic-flowchart-${Date.now()}`, mermaidCode);
  flowchartSvg.value = svg;
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

const saveNodeContext = async (nodeContext) => {
  if (!currentFlowchart.value?.flowchartId || !selectedNode.value?.nodeId) {
    return;
  }

  savingContext.value = true;
  error.value = null;

  try {
    const updatedRecord = await saveFlowchartNodeContext(
      currentFlowchart.value.flowchartId,
      selectedNode.value.nodeId,
      selectedNode.value.label,
      nodeContext
    );
    currentFlowchart.value = normalizeFlowchartRecord(updatedRecord, currentFlowchart.value.flowchartId);
  } catch (err) {
    error.value = err?.message || 'Unable to save node context';
  } finally {
    savingContext.value = false;
  }
};

const refineFromNode = async (nodeContext) => {
  if (!currentFlowchart.value?.flowchartId || !selectedNode.value?.nodeId) {
    return;
  }

  refiningFlowchart.value = true;
  error.value = null;

  try {
    const updatedRecord = await refineFlowchartNode({
      flowchartId: currentFlowchart.value.flowchartId,
      vehicle: currentFlowchart.value.vehicle,
      issues: currentFlowchart.value.issues,
      responses: currentFlowchart.value.responses,
      mermaidCode: currentFlowchart.value.mermaidCode,
      nodeId: selectedNode.value.nodeId,
      nodeLabel: selectedNode.value.label,
      nodeContext
    });
    currentFlowchart.value = normalizeFlowchartRecord(updatedRecord, currentFlowchart.value.flowchartId);
    await renderDiagram(currentFlowchart.value.mermaidCode);
    panelOpen.value = false;
  } catch (err) {
    error.value = err?.message || 'Unable to refine flowchart';
  } finally {
    refiningFlowchart.value = false;
  }
};

const goBack = () => {
  router.push({ path: '/vehicle-questions', query: route.query });
};

onMounted(() => {
  initializeMermaid();
  generateFlowchart();
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
        <h2>Vehicle Help</h2>
        <p><strong>Vehicle:</strong> {{ getVehicleDisplayName(vehicle) }}</p>
        <p><strong>Issues submitted:</strong> {{ issues }}</p>

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
              <div>
                <h3>Diagnostic Flowchart</h3>
                <p class="flowchart-helper-text">Click or keyboard-select any node to add context and refine the next branch.</p>
              </div>
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
    :context="currentNodeContext"
    :saving="savingContext"
    :refining="refiningFlowchart"
    @close="closeNodePanel"
    @save="saveNodeContext"
    @refine="refineFromNode"
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
  color: #6b7280;
}

.responses-section {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 12px;
  padding: 1rem;
  margin-top: 1rem;
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
</style>
