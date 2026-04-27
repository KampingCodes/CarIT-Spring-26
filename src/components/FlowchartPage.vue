<script setup>
import { onMounted, ref, computed, watch } from 'vue';
import 'primeicons/primeicons.css';
import { deleteFlowchart, getSavedFlowcharts, enableFlowchartSharing, disableFlowchartSharing } from '../apis';
import { authState } from '../auth.js';
import mermaid from 'mermaid/dist/mermaid.esm.min.mjs';
import ConfirmDialog from './ConfirmDialog.vue';
import FlowchartViewer from './FlowchartViewer.vue';
import NodeContextPanel from './NodeContextPanel.vue';
import { buildMermaidNodeMap, normalizeFlowchartRecord, prepareMermaidForRender, resolveNodeSelection, getMermaidConfig, applyMermaidThemeToSvg } from '../flowchart-utils.js';
import { useThemeStore } from '../stores/theme';

const flowcharts = ref([]);
const flowchartSvg = ref({});
const thumbnailSvg = ref({});
const shareLoading = ref({});
const shareCopied = ref(false);
let shareCopiedTimer = null;
const loading = ref({});
const error = ref({});
const selectedFlowchartId = ref('');
const carouselScroll = ref(null);
const confirmDialog = ref(null);
const selectedNode = ref(null);
const panelOpen = ref(false);
const themeStore = useThemeStore();

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

const selectedInstructions = computed(() => {
  const items = selectedFlowchart.value?.instructions;
  return Array.isArray(items) ? items : [];
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
    const renderCode = prepareMermaidForRender(code);
    await mermaid.parse(renderCode);
    
    // Generate full-size flowchart
    const { svg } = await mermaid.render(`flowchart-${flowchartId}`, renderCode);
    flowchartSvg.value = { ...flowchartSvg.value, [flowchartId]: applyMermaidThemeToSvg(svg, themeStore.isDark) };
    
    // Generate thumbnail (same SVG, will be styled smaller)
    const thumbnailCode = prepareMermaidForRender(code, { wrapAt: 18 });
    const { svg: thumbSvg } = await mermaid.render(`thumbnail-${flowchartId}`, thumbnailCode);
    thumbnailSvg.value = { ...thumbnailSvg.value, [flowchartId]: applyMermaidThemeToSvg(thumbSvg, themeStore.isDark) };
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

const initializeMermaid = () => {
  mermaid.initialize(getMermaidConfig(themeStore.isDark));
};

const handleEnableShare = async (flowchartId) => {
  shareLoading.value = { ...shareLoading.value, [flowchartId]: true };
  try {
    const result = await enableFlowchartSharing(flowchartId);
    if (result?.shareToken) {
      const idx = flowcharts.value.findIndex((f) => f.flowchartId === flowchartId);
      if (idx !== -1) {
        flowcharts.value = [
          ...flowcharts.value.slice(0, idx),
          { ...flowcharts.value[idx], shareToken: result.shareToken },
          ...flowcharts.value.slice(idx + 1)
        ];
      }
      copyShareLink(result.shareToken);
    }
  } catch (err) {
    console.error('Error enabling sharing:', err);
  } finally {
    shareLoading.value = { ...shareLoading.value, [flowchartId]: false };
  }
};

const handleDisableShare = async (flowchartId) => {
  shareLoading.value = { ...shareLoading.value, [flowchartId]: true };
  try {
    await disableFlowchartSharing(flowchartId);
    const idx = flowcharts.value.findIndex((f) => f.flowchartId === flowchartId);
    if (idx !== -1) {
      const updated = { ...flowcharts.value[idx] };
      delete updated.shareToken;
      flowcharts.value = [
        ...flowcharts.value.slice(0, idx),
        updated,
        ...flowcharts.value.slice(idx + 1)
      ];
    }
  } catch (err) {
    console.error('Error disabling sharing:', err);
  } finally {
    shareLoading.value = { ...shareLoading.value, [flowchartId]: false };
  }
};

const copyShareLink = (shareToken) => {
  const url = `${window.location.origin}/shared/${shareToken}`;
  navigator.clipboard.writeText(url).catch(() => {});
  shareCopied.value = true;
  clearTimeout(shareCopiedTimer);
  shareCopiedTimer = setTimeout(() => { shareCopied.value = false; }, 2500);
};

onMounted(async () => {
  initializeMermaid();

  if (!authState.isAuthenticated) {
    return;
  }
  
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

// When an instruction is saved from NodeContextPanel, insert it immediately
function onInstructionSaved({ flowchartId, instruction }) {
  if (!flowchartId || !instruction) return;
  const idx = flowcharts.value.findIndex(f => f.flowchartId === flowchartId);
  if (idx === -1) return;
  const target = flowcharts.value[idx];
  const current = Array.isArray(target.instructions) ? target.instructions : [];
  const exists = current.some(it => it.instructionId === instruction.instructionId);
  const nextInstructions = exists ? current : [instruction, ...current];
  const updated = {
    ...target,
    instructions: nextInstructions,
    updatedAt: new Date().toISOString()
  };
  // Replace the item to trigger reactivity
  flowcharts.value = [
    ...flowcharts.value.slice(0, idx),
    updated,
    ...flowcharts.value.slice(idx + 1)
  ];
}

watch(() => themeStore.isDark, async () => {
  initializeMermaid();
  await Promise.all(flowcharts.value.map(getDiagram));
});
</script>

<template>
  <div class="untree_co-home flowchart-page" id="home-section">
    <ConfirmDialog ref="confirmDialog" />
    <div class="container">
      <div class="row align-items-start">
        <div class="col-12">
          <h1 class="heading" data-aos="fade-up" data-aos-delay="0">
            Flowcharts
          </h1>
          
          <div v-if="flowcharts.length === 0" class="excerpt" data-aos="fade-up" data-aos-delay="100">
            {{ authState.isAuthenticated ? "You haven't generated any flowcharts yet." : "Sign in to view saved flowcharts. Guest flowcharts are never persisted." }}
          </div>

          <!-- Carousel Section -->
          <div v-else class="carousel-section">
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
                <div class="share-controls">
                  <template v-if="selectedFlowchart.shareToken">
                    <span class="share-status"><i class="pi pi-link"></i> Share link active</span>
                    <button
                      class="btn-share-action"
                      @click="copyShareLink(selectedFlowchart.shareToken)"
                      :title="shareCopied ? 'Copied!' : 'Copy link'"
                    >
                      <i :class="shareCopied ? 'pi pi-check' : 'pi pi-copy'"></i>
                      {{ shareCopied ? 'Copied!' : 'Copy link' }}
                    </button>
                    <button
                      class="btn-share-stop"
                      @click="handleDisableShare(selectedFlowchart.flowchartId)"
                      :disabled="shareLoading[selectedFlowchart.flowchartId]"
                      title="Stop sharing"
                    >
                      <i class="pi pi-times"></i> Stop sharing
                    </button>
                  </template>
                  <template v-else>
                    <button
                      class="btn-share-action"
                      @click="handleEnableShare(selectedFlowchart.flowchartId)"
                      :disabled="shareLoading[selectedFlowchart.flowchartId]"
                    >
                      <i class="pi pi-share-alt"></i>
                      {{ shareLoading[selectedFlowchart.flowchartId] ? 'Generating link...' : 'Share' }}
                    </button>
                  </template>
                </div>
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

              <!-- Saved Instructions for this flowchart -->
              <div class="instructions-section">
                <div class="section-header">
                  <h3 class="section-title">Saved Instructions</h3>
                  <p class="section-subtitle">AI guides and Q&A for this flowchart</p>
                </div>
                <div v-if="selectedInstructions.length === 0" class="excerpt">
                  No instructions yet — open a node and use the panel to generate and save them.
                </div>
                <div v-else class="instructions-list">
                  <div v-for="item in selectedInstructions" :key="item.instructionId" class="instruction-card">
                    <div class="instruction-meta">
                      <span class="instruction-type" :class="{ 'is-guide': item.type==='guide', 'is-qa': item.type==='qa' }">{{ item.type === 'guide' ? 'Guide' : 'Q&A' }}</span>
                      <span class="instruction-sep">•</span>
                      <span class="instruction-node" v-if="item.nodeLabel">{{ item.nodeLabel }}</span>
                      <span class="instruction-time">{{ new Date(item.createdAt).toLocaleString() }}</span>
                    </div>
                    <div v-if="item.question" class="instruction-question">Q: {{ item.question }}</div>
                    <pre class="instruction-answer">{{ item.answer }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <NodeContextPanel
      :open="panelOpen"
      :node="selectedNode"
      :context="{ vehicle: selectedFlowchart?.vehicle, issues: selectedFlowchart?.issues, mermaidCode: selectedFlowchart?.mermaidCode, flowchartId: selectedFlowchart?.flowchartId }"
      @close="closeNodePanel"
      @instruction-saved="onInstructionSaved"
    />
  </div>
</template>

<style scoped>
.flowchart-page,
.flowchart-page > .container > .row {
  padding-top: 4.5rem;
  min-height: auto;
}

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
}

.thumbnail-card {
  min-width: 200px;
  width: 200px;
  height: 220px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--color-surface);
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
  background: var(--color-diagram-surface);
}

[data-theme="dark"] .thumbnail-svg {
  background: var(--color-surface);
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
  color: var(--color-text-muted);
}

.thumbnail-info {
  padding: 0.75rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-raised);
}

.thumbnail-title {
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text-primary);
}

.thumbnail-subtitle {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: 0.25rem;
}

.delete-icon {
  position: absolute;
  top: 6px;
  right: 6px;
  color: var(--color-text-secondary);
  font-size: 1rem;
  cursor: pointer;
  transition: transform 0.15s ease, color 0.15s ease;
  z-index: 10;
}

.delete-icon:hover {
  color: var(--color-text-primary);
  transform: scale(1.1);
}

.delete-icon:active {
  transform: scale(0.95);
}

.carousel-btn {
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  color: var(--color-text-secondary);
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
  background: var(--color-surface-raised);
  border-color: var(--color-brand);
  color: var(--color-brand);
}

.carousel-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.selected-flowchart-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid var(--color-border);
}

.flowchart-header h2 {
  margin-bottom: 0.5rem;
  font-size: 1.75rem;
  color: var(--color-text-primary);
}

.flowchart-header p {
  margin-bottom: 1rem;
  color: var(--color-text-secondary);
}

.share-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.share-status {
  font-size: 0.88rem;
  color: #198754;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-weight: 600;
}

.btn-share-action,
.btn-share-stop {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.8rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text-primary);
  font-size: 0.88rem;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.btn-share-action:hover:not(:disabled) {
  background: var(--color-brand);
  border-color: var(--color-brand);
  color: #fff;
}

.btn-share-stop:hover:not(:disabled) {
  background: #dc3545;
  border-color: #dc3545;
  color: #fff;
}

.btn-share-action:disabled,
.btn-share-stop:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.responses-section {
  margin: 1.5rem 0;
  padding: 1rem;
  background: var(--color-surface-raised);
  border-radius: 8px;
  color: var(--color-text-secondary);
}

.response-item {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
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
  border: 3px solid var(--color-surface-raised);
  border-top: 3px solid var(--color-brand);
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

/* ===== Instructions ===== */
.instructions-section {
  margin-top: 2rem;
}

.instructions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.instruction-card {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: 8px;
  padding: 0.75rem 0.9rem;
}

.instruction-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-bottom: 0.35rem;
}

.instruction-type {
  font-weight: 600;
}

.instruction-type.is-guide { color: #0d6efd; }
.instruction-type.is-qa { color: #0d6efd; }
.instruction-sep { opacity: 0.6; }
.instruction-time { margin-left: auto; }
.instruction-question { font-weight: 600; margin-bottom: 0.35rem; color: var(--color-text-primary); }
.instruction-answer {
  white-space: pre-wrap;
  margin: 0;
  color: var(--color-text-secondary);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.6rem 0.7rem;
  font-size: 0.92rem;
}

@media (max-width: 768px) {
  .flowchart-page,
  .flowchart-page > .container > .row {
    padding-top: 2rem;
  }

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