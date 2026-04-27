<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import mermaid from 'mermaid/dist/mermaid.esm.min.mjs';
import { useThemeStore } from '../stores/theme';
import { authState, login } from '../auth.js';
import { getSharedFlowchart, saveSharedFlowchart } from '../apis.js';
import FlowchartViewer from './FlowchartViewer.vue';
import { normalizeFlowchartRecord, prepareMermaidForRender, getMermaidConfig, applyMermaidThemeToSvg } from '../flowchart-utils.js';

const route = useRoute();
const router = useRouter();
const themeStore = useThemeStore();

const shareToken = route.params.shareToken;

const flowchart = ref(null);
const flowchartSvg = ref('');
const loading = ref(true);
const renderError = ref(null);
const fetchError = ref(null);
const saveLoading = ref(false);
const saveResult = ref(null); // null | 'success' | 'error'
const saveError = ref('');

const getVehicleDisplayName = (vehicle = {}) => {
  const parts = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean);
  return parts.join(' ') || 'Unknown vehicle';
};

const initializeMermaid = () => {
  mermaid.initialize(getMermaidConfig(themeStore.isDark));
};

const renderDiagram = async (mermaidCode) => {
  renderError.value = null;
  if (!mermaidCode) {
    renderError.value = 'This flowchart does not contain valid diagram data.';
    return;
  }
  const renderCode = prepareMermaidForRender(mermaidCode);
  await mermaid.parse(renderCode);
  const { svg } = await mermaid.render(`shared-flowchart-${Date.now()}`, renderCode);
  flowchartSvg.value = applyMermaidThemeToSvg(svg, themeStore.isDark);
};

const fetchAndRender = async () => {
  loading.value = true;
  fetchError.value = null;
  flowchart.value = null;
  flowchartSvg.value = '';

  try {
    const data = await getSharedFlowchart(shareToken);
    flowchart.value = normalizeFlowchartRecord(data.flowchart, 0);
    await renderDiagram(flowchart.value.mermaidCode);
  } catch (err) {
    if (err?.status === 404) {
      fetchError.value = 'This share link is no longer valid or has been removed.';
    } else {
      fetchError.value = err?.message || 'Unable to load the shared flowchart.';
    }
  } finally {
    loading.value = false;
  }
};

const handleSave = async () => {
  saveLoading.value = true;
  saveResult.value = null;
  saveError.value = '';
  try {
    await saveSharedFlowchart(shareToken);
    saveResult.value = 'success';
  } catch (err) {
    saveResult.value = 'error';
    saveError.value = err?.message || 'Unable to save the flowchart.';
  } finally {
    saveLoading.value = false;
  }
};

const goToFlowcharts = () => {
  router.push('/flowcharts');
};

onMounted(async () => {
  initializeMermaid();
  await fetchAndRender();
});

watch(() => themeStore.isDark, async () => {
  initializeMermaid();
  if (flowchart.value?.mermaidCode) {
    await renderDiagram(flowchart.value.mermaidCode);
  }
});
</script>

<template>
  <div class="untree_co-section shared-flowchart-page" id="shared-flowchart-section">
    <div class="container">
      <div class="shared-shell">

        <!-- Loading state -->
        <div v-if="loading" class="state-block">
          <div class="spinner"></div>
          <p>Loading shared flowchart…</p>
        </div>

        <!-- Error state -->
        <div v-else-if="fetchError" class="state-block error-block">
          <i class="pi pi-exclamation-circle error-icon"></i>
          <p class="error-text">{{ fetchError }}</p>
          <router-link to="/" class="btn btn-secondary mt-3">Go home</router-link>
        </div>

        <!-- Flowchart loaded -->
        <template v-else-if="flowchart">
          <div class="shared-header">
            <div class="shared-header-text">
              <h1 class="heading">{{ getVehicleDisplayName(flowchart.vehicle) }}</h1>
              <p class="shared-meta"><strong>Issues:</strong> {{ flowchart.issues }}</p>
              <p class="shared-badge"><i class="pi pi-share-alt"></i> Shared diagnostic flowchart</p>
            </div>

            <!-- Save CTA -->
            <div class="save-cta">
              <!-- Already saved successfully -->
              <div v-if="saveResult === 'success'" class="save-success">
                <i class="pi pi-check-circle"></i>
                Saved to your account!
                <button class="btn-go-flowcharts" @click="goToFlowcharts">View my flowcharts</button>
              </div>

              <!-- Authenticated: show save button -->
              <template v-else-if="authState.isAuthenticated">
                <p class="save-hint">Save a copy to your account to interact with and refine it.</p>
                <button
                  class="btn-save"
                  @click="handleSave"
                  :disabled="saveLoading"
                >
                  <i class="pi pi-bookmark"></i>
                  {{ saveLoading ? 'Saving…' : 'Save to My Account' }}
                </button>
                <p v-if="saveResult === 'error'" class="save-error">{{ saveError }}</p>
              </template>

              <!-- Guest: prompt to sign in -->
              <template v-else>
                <p class="save-hint">Have a CarIT account? Sign in to save this flowchart and interact with it.</p>
                <button class="btn-save" @click="login">
                  <i class="pi pi-sign-in"></i> Sign in to save
                </button>
              </template>
            </div>
          </div>

          <!-- Diagnostic responses -->
          <div v-if="flowchart.responses?.length" class="responses-section">
            <h3>Diagnostic Answers</h3>
            <div v-for="(response, idx) in flowchart.responses" :key="idx" class="response-item">
              <strong>{{ response.question }}</strong><br />
              {{ response.answer }}
            </div>
          </div>

          <!-- Flowchart viewer -->
          <div v-if="renderError" class="error">{{ renderError }}</div>
          <FlowchartViewer
            v-else
            :svg="flowchartSvg"
            :title="getVehicleDisplayName(flowchart.vehicle)"
            embedded-height="42rem"
          />

          <!-- Read-only instructions -->
          <div v-if="flowchart.instructions?.length" class="instructions-section">
            <div class="section-header">
              <h3 class="section-title">Saved Instructions</h3>
              <p class="section-subtitle">AI guides and Q&amp;A included with this flowchart</p>
            </div>
            <div class="instructions-list">
              <div v-for="item in flowchart.instructions" :key="item.instructionId" class="instruction-card">
                <div class="instruction-meta">
                  <span class="instruction-type" :class="{ 'is-guide': item.type === 'guide', 'is-qa': item.type === 'qa' }">
                    {{ item.type === 'guide' ? 'Guide' : 'Q&A' }}
                  </span>
                  <span class="instruction-sep">•</span>
                  <span class="instruction-node" v-if="item.nodeLabel">{{ item.nodeLabel }}</span>
                  <span class="instruction-time">{{ new Date(item.createdAt).toLocaleString() }}</span>
                </div>
                <div v-if="item.question" class="instruction-question">Q: {{ item.question }}</div>
                <pre class="instruction-answer">{{ item.answer }}</pre>
              </div>
            </div>
          </div>
        </template>

      </div>
    </div>
  </div>
</template>

<style scoped>
.shared-flowchart-page {
  padding-top: 4.5rem;
  min-height: 80vh;
}

.shared-shell {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 0 4rem;
}

.state-block {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--color-text-secondary);
}

.error-block {
  color: #dc3545;
}

.error-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.error-text {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
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

/* Header */
.shared-header {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.shared-header-text {
  flex: 1 1 280px;
}

.heading {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 0.4rem;
}

.shared-meta {
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
}

.shared-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 0.25rem 0.75rem;
}

/* Save CTA */
.save-cta {
  flex: 0 1 320px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
}

.save-hint {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.75rem;
}

.btn-save {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1.1rem;
  border-radius: 8px;
  border: none;
  background: var(--color-brand, #407BFF);
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-save:hover:not(:disabled) {
  background: var(--color-brand-hover, #5489ff);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-success {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  color: #198754;
  font-weight: 600;
}

.btn-go-flowcharts {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.8rem;
  border-radius: 6px;
  border: 1px solid #198754;
  background: transparent;
  color: #198754;
  font-size: 0.88rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-go-flowcharts:hover {
  background: #198754;
  color: #fff;
}

.save-error {
  color: #dc3545;
  font-size: 0.88rem;
  margin-top: 0.5rem;
}

/* Responses */
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

.error {
  color: #dc3545;
  text-align: center;
  padding: 1.5rem;
}

/* Instructions */
.instructions-section {
  margin-top: 2rem;
}

.section-header {
  margin-bottom: 1rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 0.25rem;
}

.section-subtitle {
  font-size: 0.9rem;
  color: var(--color-text-muted);
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

.instruction-type { font-weight: 600; }
.instruction-type.is-guide,
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
  .shared-header {
    flex-direction: column;
  }
  .save-cta {
    flex: 1 1 100%;
  }
}
</style>
