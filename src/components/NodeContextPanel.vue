<script setup>
import { ref, watch, computed } from 'vue';
import { getResponse as askAI, saveFlowchartInstruction } from '../apis';

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  node: {
    type: Object,
    default: null
  },
  // Optional extra context to help the model answer better
  // { vehicle, issues, mermaidCode }
  context: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['close', 'instruction-saved']);

const question = ref('');
const answer = ref('');
const loading = ref(false);
const error = ref('');

// Format assistant output: bold known section headers while keeping bullets
const formattedAnswer = computed(() => formatAnswer(answer.value));

const title = computed(() => props.node?.label || 'Flowchart Node');
const nodeId = computed(() => props.node?.nodeId || props.node?.rawId || '');
const flowchartId = computed(() => props.context?.flowchartId || '');

watch(
  () => [props.open, props.node?.nodeId],
  () => {
    // Reset state when opening or switching nodes
    if (props.open) {
      question.value = '';
      answer.value = '';
      error.value = '';
      loading.value = false;
    }
  }
);

const closePanel = () => {
  emit('close');
};

function buildPrompt(userQuestion) {
  const vehicle = props.context?.vehicle || {};
  const issues = props.context?.issues || '';
  const mermaidCode = (props.context?.mermaidCode || '').slice(0, 5000);
  const nodeLabel = props.node?.label || '';
  const id = nodeId.value || '';

  const vehicleBlock = `Vehicle Information:\nYear: ${vehicle.year || 'Unknown'}\nMake: ${vehicle.make || 'Unknown'}\nModel: ${vehicle.model || 'Unknown'}\nTrim: ${vehicle.trim || 'Unknown'}`;

  const nodeBlock = `Selected Node:\nID: ${id || 'N/A'}\nLabel: ${nodeLabel || 'N/A'}`;

  const flowchartBlock = mermaidCode
    ? `Relevant Mermaid Flowchart (truncated if long):\n\n\u0060\u0060\u0060mermaid\n${mermaidCode}\n\u0060\u0060\u0060`
    : 'Flowchart not available.';

  return [
    'You are a helpful automotive diagnostics expert.',
    'Answer clearly and concisely for a student mechanic.',
    ' Use "-" for bullets and "1.", "2.", etc. for steps. Do not include any other text, symbols ex: ("*"), or formatting, DO NOT BOLD.',
    vehicleBlock,
    nodeBlock,
    flowchartBlock,
    '',
    `User Question about this node: ${userQuestion}`
  ].join('\n\n');
}

async function ask() {
  if (!question.value?.trim()) return;
  loading.value = true;
  error.value = '';
  answer.value = '';
  try {
    const prompt = buildPrompt(question.value.trim());
    const resp = await askAI(prompt);
    answer.value = typeof resp === 'string' ? resp : JSON.stringify(resp);
    // Attempt to save as an instruction linked to this flowchart
    await maybeSaveInstruction({
      type: 'qa',
      question: question.value.trim(),
      answer: answer.value
    });
  } catch (err) {
    const retry = err?.retryAfterSeconds ? ` Please try again in ${err.retryAfterSeconds} seconds.` : '';
    error.value = err?.message || 'Failed to get an answer.';
    if (retry) error.value += retry;
  } finally {
    loading.value = false;
  }
}

function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    ask();
  }
}

function buildInstructionsPrompt() {
  const vehicle = props.context?.vehicle || {};
  const issues = props.context?.issues || '';
  const mermaidCode = (props.context?.mermaidCode || '').slice(0, 5000);
  const nodeLabel = props.node?.label || '';
  const id = nodeId.value || '';

  const vehicleBlock = `Vehicle Information:\nYear: ${vehicle.year || 'Unknown'}\nMake: ${vehicle.make || 'Unknown'}\nModel: ${vehicle.model || 'Unknown'}\nTrim: ${vehicle.trim || 'Unknown'}\nIssues: ${issues || 'Unknown'}`;

  const nodeBlock = `Flowchart Step to Explain:\nID: ${id || 'N/A'}\nLabel: ${nodeLabel || 'N/A'}`;

  const flowchartBlock = mermaidCode
    ? `Relevant Mermaid Flowchart (truncated if long):\n\n\u0060\u0060\u0060mermaid\n${mermaidCode}\n\u0060\u0060\u0060`
    : 'Flowchart not available.';

  return [
    'You are an automotive coach for beginners.',
    'Give very simple, step-by-step instructions to perform ONLY the flowchart step shown below.',
    'Use short sentences, plain words, and avoid jargon.',
    'If a measurement is needed, include typical ranges and what to do for out-of-range results.',
    'If vehicle-specific data is missing, give general guidance for most passenger cars.',
    '',
    vehicleBlock,
    nodeBlock,
    flowchartBlock,
    '',
    'Format your answer exactly as:',
    ' Tools & Materials: (short bullet list)',
    ' Safety Notes: (1-3 bullets)',
    ' Steps: (numbered 1, 2, 3… very clear and beginner-friendly)',
    ' What to Look For: (bullets with normal/abnormal results and next action)',
    ' Time Estimate: (rough minutes)',
    ' Use "-" for bullets and "1.", "2.", etc. for steps. Do not include any other text, symbols ex: ("*"), or formatting, DO NOT BOLD.'
  ].join('\n');
}

async function askGuide() {
  loading.value = true;
  error.value = '';
  answer.value = '';
  try {
    const prompt = buildInstructionsPrompt();
    const resp = await askAI(prompt);
    answer.value = typeof resp === 'string' ? resp : JSON.stringify(resp);
    // Attempt to save the guided instructions
    await maybeSaveInstruction({
      type: 'guide',
      question: `Guide for: ${title.value}`,
      answer: answer.value
    });
  } catch (err) {
    const retry = err?.retryAfterSeconds ? ` Please try again in ${err.retryAfterSeconds} seconds.` : '';
    error.value = err?.message || 'Failed to get an answer.';
    if (retry) error.value += retry;
  } finally {
    loading.value = false;
  }
}

async function maybeSaveInstruction({ type, question, answer }) {
  try {
    const fId = flowchartId.value;
    if (!fId) return; // Not persisted or guest session
    const payload = {
      type,
      nodeId: nodeId.value || '',
      nodeLabel: title.value || '',
      question: question || '',
      answer: answer || ''
    };
    const result = await saveFlowchartInstruction(fId, payload);
    if (result && result.success && result.instruction) {
      emit('instruction-saved', { flowchartId: fId, instruction: result.instruction });
    }
  } catch (_e) {
    // Silently ignore save errors (e.g., unauthenticated/guest)
  }
}

function formatAnswer(text = '') {
  if (!text) return '';

  // Normalize line endings for consistent matching across platforms
  let work = String(text).replace(/\r\n?|\u2028|\u2029/g, '\n');

  // Exact section names
  const headers = [
    'Tools & Materials',
    'Safety Notes',
    'Steps',
    'What to Look For',
    'Time Estimate'
  ];

  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Mark section headers (optionally preceded by a bullet/number), followed by a colon
  headers.forEach((label) => {
    const pattern = new RegExp(
      `(^|\\n)(\\s*(?:[-*]|\\d+\.)?\\s*)(${escRe(label)})\\s*:`,
      'g'
    );
    work = work.replace(pattern, (_m, g1, g2, g3) => `${g1}${g2}__BOLD_START__${g3}:__BOLD_END__`);
  });

  // Escape HTML entities to keep rendering safe
  const escapeHtml = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  work = escapeHtml(work);

  // Restore bold markers to actual strong tags
  work = work
    .replace(/__BOLD_START__/g, '<strong>')
    .replace(/__BOLD_END__/g, '</strong>');

  return work;
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="node-context-overlay"
      @click.self="closePanel"
      @keydown.esc="closePanel"
    >
      <div
        class="node-context-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-context-title"
      >
        <div class="node-context-header">
          <div>
            <p class="node-context-label">Node Q&A</p>
            <h3 id="node-context-title" class="node-context-title">{{ title }}</h3>
            <p v-if="nodeId" class="node-context-sub">ID: {{ nodeId }}</p>
          </div>
          <button type="button" class="node-context-close" @click="closePanel" aria-label="Close node context panel">
            ×
          </button>
        </div>

        <div class="node-context-body">
          <div class="node-context-primary">
            <button
              type="button"
              class="node-context-btn node-context-btn--primary-big"
              :disabled="loading"
              @click="askGuide"
            >
              {{ loading ? 'Generating…' : 'Guide me through this step' }}
            </button>
            <small class="node-context-hint">Get simple, step-by-step instructions</small>
          </div>

          <label for="node-question" class="node-context-input-label">Ask a question about this step</label>
          <textarea
            id="node-question"
            class="node-context-textarea"
            rows="4"
            v-model="question"
            :disabled="loading"
            placeholder="Example: What tests should I run before moving past this node?"
            @keydown="onKeydown"
          />

          <div class="node-context-actions">
            <button type="button" class="node-context-btn node-context-btn--secondary" :disabled="loading || !question.trim()" @click="ask">
              {{ loading ? 'Asking…' : 'Ask' }}
            </button>
            <small class="node-context-hint">Tip: Ctrl+Enter to send</small>
          </div>

          <div v-if="error" class="node-context-error">{{ error }}</div>

          <div v-if="answer" class="node-context-answer">
            <div class="node-context-answer-body" v-html="formattedAnswer"></div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.node-context-overlay {
  position: fixed;
  inset: 0;
  z-index: 2200;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.node-context-panel {
  width: min(780px, 100%);
  max-height: min(88vh, 900px);
  overflow: auto;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.24);
  padding: 1.5rem;
}

.node-context-header,
.node-context-footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.node-context-header {
  margin-bottom: 1rem;
}

.node-context-label {
  margin: 0;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6c757d;
}

.node-context-title {
  margin: 0;
  font-size: 1.4rem;
}

.node-context-sub {
  margin: 0.25rem 0 0;
  color: #6b7280;
}

.node-context-close {
  border: none;
  background: transparent;
  font-size: 1.75rem;
  line-height: 1;
  color: #4b5563;
}

.node-context-close:focus {
  outline: 2px solid #0d6efd;
  outline-offset: 2px;
}

@media (max-width: 768px) {
  .node-context-panel {
    padding: 1rem;
  }

  .node-context-header,
  .node-context-footer {
    flex-direction: column;
    align-items: stretch;
  }
}

.node-context-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.node-context-input-label {
  font-weight: 600;
}

.node-context-textarea {
  width: 100%;
  border: 1px solid #d0d7de;
  border-radius: 10px;
  padding: 0.75rem;
  resize: vertical;
}

.node-context-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.node-context-primary {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.node-context-btn {
  border: 1px solid #0d6efd;
  background: #0d6efd;
  color: #fff;
  border-radius: 999px;
  padding: 0.5rem 1rem;
}

.node-context-btn--secondary {
  background: #fff;
  color: #0d6efd;
}

.node-context-btn--primary-big {
  padding: 0.75rem 1.25rem;
  font-size: 1rem;
  width: 100%;
}

.node-context-hint {
  color: #6c757d;
}

.node-context-error {
  color: #dc3545;
  background: #ffe9ec;
  border: 1px solid #ffc2c9;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
}

.node-context-answer {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 12px;
  padding: 0.75rem;
}

.node-context-answer-body {
  white-space: pre-wrap;
}
</style>

<style>
[data-theme="dark"] .node-context-panel {
  background: #1e293b;
  color: #e2e8f0;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
}

[data-theme="dark"] .node-context-label {
  color: #94a3b8;
}

[data-theme="dark"] .node-context-sub {
  color: #94a3b8;
}

[data-theme="dark"] .node-context-close {
  color: #94a3b8;
}

[data-theme="dark"] .node-context-close:hover {
  color: #e2e8f0;
}

[data-theme="dark"] .node-context-textarea {
  background: #0f172a;
  color: #e2e8f0;
  border-color: #334155;
}

[data-theme="dark"] .node-context-textarea::placeholder {
  color: #64748b;
}

[data-theme="dark"] .node-context-btn--secondary {
  background: #1e293b;
  color: #60a5fa;
  border-color: #60a5fa;
}

[data-theme="dark"] .node-context-hint {
  color: #94a3b8;
}

[data-theme="dark"] .node-context-error {
  background: #3b1a1e;
  border-color: #7f1d1d;
  color: #fca5a5;
}

[data-theme="dark"] .node-context-answer {
  background: #0f172a;
  border-color: #334155;
  color: #e2e8f0;
}
</style>
