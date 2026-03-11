<script setup>
import { onMounted, ref, computed } from 'vue';
import 'primeicons/primeicons.css';
import { deleteFlowchart, getSavedFlowcharts, refineFlowchartNode, saveFlowchartNodeContext } from '../apis';
import mermaid from 'mermaid/dist/mermaid.esm.min.mjs';
import ConfirmDialog from './ConfirmDialog.vue';
import FlowchartViewer from './FlowchartViewer.vue';
import NodeContextPanel from './NodeContextPanel.vue';
import { buildMermaidNodeMap, normalizeFlowchartRecord, resolveNodeSelection, upsertFlowchartRecord } from '../flowchart-utils.js';

const flowcharts = ref([]);
const flowchartSvg = ref({});
const thumbnailSvg = ref({});
const loading = ref({});
const error = ref({});
const selectedFlowchartId = ref('');
const carouselScroll = ref(null);
const confirmDialog = ref(null);
const selectedNode = ref(null);
const panelOpen = ref(false);
const savingContext = ref(false);
const refiningFlowchart = ref(false);

const selectedFlowchart = computed(() => {
  if (flowcharts.value.length === 0) return null;
  const activeId = selectedFlowchartId.value || flowcharts.value[0]?.flowchartId;
  const record = flowcharts.value.find((flowchart) => flowchart.flowchartId === activeId) || flowcharts.value[0];
  if (!record) return null;
  return {
    ...record,
    svg: flowchartSvg.value[record.flowchartId],
    loading: loading.value[record.flowchartId],
    error: error.value[record.flowchartId]
  };
});

const nodeMap = computed(() => buildMermaidNodeMap(selectedFlowchart.value?.mermaidCode || ''));
const currentNodeContext = computed(() => {
  const nodeId = selectedNode.value?.nodeId;
  return nodeId ? selectedFlowchart.value?.nodeContexts?.[nodeId] || {} : {};
});

const getVehicleDisplayName = (vehicle = {}) => {
  const { year, make, model, trim } = vehicle || {};
  const base = [year, make, model].filter(Boolean).join(' ');
  if (base && trim) return `${base} - ${trim}`;
  if (base) return base;
  return trim || 'Unknown vehicle';
};

const getVehicleCardTitle = (vehicle = {}) => {
  const parts = [vehicle.make, vehicle.model].filter(Boolean);
  return parts.join(' ') || 'Unknown vehicle';
};

const getVehicleCardSubtitle = (vehicle = {}) => {
  const parts = [vehicle.year, vehicle.trim].filter(Boolean);
  return parts.join(' - ');
};

const getDiagram = async (flowchartObj) => {
  const flowchartId = flowchartObj.flowchartId;
  loading.value = { ...loading.value, [flowchartId]: true };
  error.value = { ...error.value, [flowchartId]: null };

  try {
    const code = flowchartObj.mermaidCode;
    if (!code) throw new Error('This saved flowchart does not contain valid Mermaid data yet.');
    await mermaid.parse(code);
    
    // Generate full-size flowchart
    const { svg } = await mermaid.render(`flowchart-${flowchartId}`, code);
    flowchartSvg.value = { ...flowchartSvg.value, [flowchartId]: svg };
    
    // Generate thumbnail (same SVG, will be styled smaller)
    const { svg: thumbSvg } = await mermaid.render(`thumbnail-${flowchartId}`, code);
    thumbnailSvg.value = { ...thumbnailSvg.value, [flowchartId]: thumbSvg };
  } catch (err) {
    error.value = { ...error.value, [flowchartId]: err.message };
  } finally {
    loading.value = { ...loading.value, [flowchartId]: false };
  }
};

const selectFlowchart = (flowchartId) => {
  selectedFlowchartId.value = flowchartId;
};

const removeFlowchart = async (flowchartId, event) => {
  event.stopPropagation();
  const confirmed = await confirmDialog.value.show('Are you sure you want to delete this flowchart?');
  if (!confirmed) {
    return;
  }
  try {
    await deleteFlowchart(flowchartId);
    flowcharts.value = flowcharts.value.filter((flowchart) => flowchart.flowchartId !== flowchartId);

    const nextMainSvg = { ...flowchartSvg.value };
    const nextThumbSvg = { ...thumbnailSvg.value };
    const nextLoading = { ...loading.value };
    const nextError = { ...error.value };
    delete nextMainSvg[flowchartId];
    delete nextThumbSvg[flowchartId];
    delete nextLoading[flowchartId];
    delete nextError[flowchartId];
    flowchartSvg.value = nextMainSvg;
    thumbnailSvg.value = nextThumbSvg;
    loading.value = nextLoading;
    error.value = nextError;

    if (selectedFlowchartId.value === flowchartId) {
      selectedFlowchartId.value = flowcharts.value[0]?.flowchartId || '';
    }
  } catch (err) {
    console.error('Error deleting flowchart:', err);
  }
};

const scrollCarousel = (direction) => {
  if (carouselScroll.value) {
    const scrollAmount = 220; // thumbnail width + gap
    carouselScroll.value.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }
};

onMounted(async () => {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    flowchart: { htmlLabels: true, curve: 'basis' }
  });
  
  flowcharts.value = await getSavedFlowcharts();
  flowcharts.value = flowcharts.value.map((flowchart, index) => normalizeFlowchartRecord(flowchart, index));
  selectedFlowchartId.value = flowcharts.value[0]?.flowchartId || '';
  await Promise.all(flowcharts.value.map(getDiagram));
});

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
  if (!selectedFlowchart.value?.flowchartId || !selectedNode.value?.nodeId) {
    return;
  }

  savingContext.value = true;
  try {
    const updatedRecord = await saveFlowchartNodeContext(
      selectedFlowchart.value.flowchartId,
      selectedNode.value.nodeId,
      selectedNode.value.label,
      nodeContext
    );
    flowcharts.value = upsertFlowchartRecord(flowcharts.value, normalizeFlowchartRecord(updatedRecord, selectedFlowchart.value.flowchartId));
  } catch (err) {
    console.error('Error saving node context:', err);
  } finally {
    savingContext.value = false;
  }
};

const refineFromNode = async (nodeContext) => {
  if (!selectedFlowchart.value?.flowchartId || !selectedNode.value?.nodeId) {
    return;
  }

  refiningFlowchart.value = true;
  try {
    const updatedRecord = await refineFlowchartNode({
      flowchartId: selectedFlowchart.value.flowchartId,
      vehicle: selectedFlowchart.value.vehicle,
      issues: selectedFlowchart.value.issues,
      responses: selectedFlowchart.value.responses,
      mermaidCode: selectedFlowchart.value.mermaidCode,
      nodeId: selectedNode.value.nodeId,
      nodeLabel: selectedNode.value.label,
      nodeContext
    });
    const normalizedRecord = normalizeFlowchartRecord(updatedRecord, selectedFlowchart.value.flowchartId);
    flowcharts.value = upsertFlowchartRecord(flowcharts.value, normalizedRecord);
    selectedFlowchartId.value = normalizedRecord.flowchartId;
    await getDiagram(normalizedRecord);
    panelOpen.value = false;
  } catch (err) {
    console.error('Error refining flowchart:', err);
  } finally {
    refiningFlowchart.value = false;
  }
};
</script>

<template>
  <div class="untree_co-home" id="home-section">
    <ConfirmDialog ref="confirmDialog" />
    <div class="container">
      <div class="row align-items-start">
        <div class="col-12">
          <h1 class="heading" data-aos="fade-up" data-aos-delay="0">
            Flowcharts
          </h1>
          
          <div v-if="flowcharts.length === 0" class="excerpt" data-aos="fade-up" data-aos-delay="100">
            You haven't generated any flowcharts yet.
          </div>

          <!-- Carousel Section -->
          <div v-else class="carousel-section">
            <h3 class="carousel-title">Select a Flowchart</h3>
            <div class="carousel-wrapper">
              <button 
                class="carousel-btn carousel-btn-left" 
                @click="scrollCarousel('left')"
                :disabled="flowcharts.length <= 3"
              >
                &#8249;
              </button>
              
              <div class="carousel-container" ref="carouselScroll">
                <div 
                  v-for="(flowchart, idx) in flowcharts" 
                  :key="flowchart.flowchartId"
                  class="thumbnail-card"
                  :class="{ selected: selectedFlowchartId === flowchart.flowchartId }"
                  @click="selectFlowchart(flowchart.flowchartId)"
                >
                  <i
                    class="pi pi-trash delete-icon"
                    @click="removeFlowchart(flowchart.flowchartId, $event)"
                    title="Delete flowchart"
                  ></i>
                  
                  <div v-if="loading[flowchart.flowchartId]" class="thumbnail-loading">
                    <div class="spinner"></div>
                  </div>
                  <div v-else-if="error[flowchart.flowchartId]" class="thumbnail-error">
                    Error
                  </div>
                  <div v-else v-html="thumbnailSvg[flowchart.flowchartId]" class="thumbnail-svg"></div>
                  
                  <div class="thumbnail-info">
                    <div class="thumbnail-title">
                      {{ getVehicleCardTitle(flowchart.vehicle) }}
                    </div>
                    <div v-if="getVehicleCardSubtitle(flowchart.vehicle)" class="thumbnail-subtitle">
                      {{ getVehicleCardSubtitle(flowchart.vehicle) }}
                    </div>
                  </div>
                </div>
              </div>
              
              <button 
                class="carousel-btn carousel-btn-right" 
                @click="scrollCarousel('right')"
                :disabled="flowcharts.length <= 3"
              >
                &#8250;
              </button>
            </div>

            <!-- Selected Flowchart Display -->
            <div v-if="selectedFlowchart" class="selected-flowchart-section">
              <div class="flowchart-header">
                <h2>{{ getVehicleDisplayName(selectedFlowchart.vehicle) }}</h2>
                <p><strong>Issues:</strong> {{ selectedFlowchart.issues }}</p>
                <p class="flowchart-context-hint">Click any node to add context and refine a more specific downstream branch.</p>
              </div>

              <div v-if="selectedFlowchart.responses" class="responses-section">
                <div v-for="(response, idx) in selectedFlowchart.responses" :key="idx" class="response-item">
                  <strong>{{ response.question }}</strong><br/>
                  {{ response.answer }}
                </div>
              </div>

              <div v-if="selectedFlowchart.loading" class="loading">
                <div class="spinner"></div>
                Loading flowchart...
              </div>
              <div v-else-if="selectedFlowchart.error" class="error">
                {{ selectedFlowchart.error }}
              </div>
              <FlowchartViewer
                v-else
                :svg="selectedFlowchart.svg"
                :title="getVehicleDisplayName(selectedFlowchart.vehicle)"
                embedded-height="42rem"
                @node-activate="handleNodeActivate"
              />
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
  </div>
</template>

<style scoped>
.carousel-section {
  margin-top: 2rem;
}

.carousel-title {
  margin-bottom: 1rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.carousel-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 3rem;
}

.carousel-container {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 1rem 0;
  flex: 1;
  scrollbar-width: thin;
}

.carousel-container::-webkit-scrollbar {
  height: 8px;
}

.carousel-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.carousel-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.carousel-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.thumbnail-card {
  min-width: 200px;
  width: 200px;
  height: 220px;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
  display: flex;
  flex-direction: column;
  position: relative;
}

.thumbnail-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: #999;
}

.thumbnail-card.selected {
  border-color: #007bff;
  border-width: 3px;
  box-shadow: 0 4px 16px rgba(0, 123, 255, 0.3);
}

.thumbnail-svg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0.5rem;
}

.thumbnail-svg :deep(svg) {
  max-width: 100%;
  max-height: 140px;
  width: auto !important;
  height: auto !important;
}

.thumbnail-loading,
.thumbnail-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  color: #666;
}

.thumbnail-info {
  padding: 0.75rem;
  border-top: 1px solid #eee;
  background: #f9f9f9;
}

.thumbnail-title {
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thumbnail-subtitle {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.25rem;
}

.delete-icon {
  position: absolute;
  top: 6px;
  right: 6px;
  color: #000;
  font-size: 1rem;
  cursor: pointer;
  transition: transform 0.15s ease, color 0.15s ease;
  z-index: 10;
}

.delete-icon:hover {
  color: #333;
  transform: scale(1.1);
}

.delete-icon:active {
  transform: scale(0.95);
}

.carousel-btn {
  background: white;
  border: 2px solid #ddd;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.carousel-btn:hover:not(:disabled) {
  background: #f0f0f0;
  border-color: #999;
}

.carousel-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.selected-flowchart-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #eee;
}

.flowchart-header h2 {
  margin-bottom: 0.5rem;
  font-size: 1.75rem;
}

.flowchart-header p {
  margin-bottom: 1rem;
  color: #555;
}

.responses-section {
  margin: 1.5rem 0;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
}

.response-item {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.response-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.loading,
.error {
  text-align: center;
  padding: 2rem;
  font-size: 1.1rem;
}

.error {
  color: #dc3545;
}

.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .carousel-btn {
    display: none;
  }
  
  .thumbnail-card {
    min-width: 160px;
    width: 160px;
    height: 200px;
  }
}
</style>