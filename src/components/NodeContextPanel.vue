<script setup>
import { computed, nextTick, ref, watch } from 'vue';

const GUIDED_PROMPTS = [
  { key: 'symptom', label: 'Clarify the symptom', hint: 'Add the exact sound, smell, warning light, or behavior seen at this step.' },
  { key: 'conditions', label: 'Describe when it happens', hint: 'Explain whether it happens cold, hot, under load, at idle, or while driving.' },
  { key: 'history', label: 'Recent repair history', hint: 'Mention recent repairs, replacement parts, or maintenance tied to this node.' },
  { key: 'tests', label: 'Known test results', hint: 'Add pressure readings, scan-tool data, visual inspection results, or other checks.' }
];

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  node: {
    type: Object,
    default: null
  },
  context: {
    type: Object,
    default: () => ({})
  },
  saving: {
    type: Boolean,
    default: false
  },
  refining: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'save', 'refine']);

const freeText = ref('');
const guidedPromptKey = ref('');
const textareaRef = ref(null);

const selectedPrompt = computed(() => GUIDED_PROMPTS.find((prompt) => prompt.key === guidedPromptKey.value) || null);
const panelTitle = computed(() => props.node?.label ? `Enhance context for ${props.node.label}` : 'Enhance node context');

watch(
  () => [props.open, props.context, props.node],
  async ([isOpen]) => {
    if (!isOpen) {
      return;
    }

    freeText.value = props.context?.freeText || '';
    guidedPromptKey.value = props.context?.guidedPromptKey || '';

    await nextTick();
    textareaRef.value?.focus();
  },
  { immediate: true, deep: true }
);

const closePanel = () => {
  emit('close');
};

const buildPayload = () => ({
  guidedPromptKey: guidedPromptKey.value,
  guidedPromptLabel: selectedPrompt.value?.label || '',
  freeText: freeText.value.trim(),
  nodeLabel: props.node?.label || ''
});

const saveContext = () => {
  emit('save', buildPayload());
};

const refineFlowchart = () => {
  emit('refine', buildPayload());
};
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
        aria-describedby="node-context-description"
      >
        <div class="node-context-header">
          <div>
            <p class="node-context-eyebrow">Flowchart node context</p>
            <h3 id="node-context-title" class="node-context-title">{{ panelTitle }}</h3>
            <p id="node-context-description" class="node-context-description">
              Add guided details and optional free-form notes to make the next branch more specific.
            </p>
          </div>
          <button type="button" class="node-context-close" @click="closePanel" aria-label="Close node context panel">
            ×
          </button>
        </div>

        <div class="node-context-body">
          <div class="node-context-section">
            <label class="node-context-label">Guided prompts</label>
            <p class="node-context-help">Choose the prompt that best fits what you want to clarify at this node.</p>
            <div class="guided-prompt-grid" role="group" aria-label="Guided prompts for the selected flowchart node">
              <button
                v-for="prompt in GUIDED_PROMPTS"
                :key="prompt.key"
                type="button"
                class="guided-prompt-card"
                :class="{ selected: guidedPromptKey === prompt.key }"
                :aria-pressed="guidedPromptKey === prompt.key"
                @click="guidedPromptKey = prompt.key"
              >
                <span class="guided-prompt-title">{{ prompt.label }}</span>
                <span class="guided-prompt-hint">{{ prompt.hint }}</span>
              </button>
            </div>
          </div>

          <div class="node-context-section">
            <label for="node-context-textarea" class="node-context-label">Additional details</label>
            <p class="node-context-help">Describe observations, conditions, recent repairs, or test results tied to this node.</p>
            <textarea
              id="node-context-textarea"
              ref="textareaRef"
              v-model="freeText"
              class="node-context-textarea"
              rows="8"
              placeholder="Example: The stall only happens after 20 minutes of driving, and a fuel pump was replaced last week."
            ></textarea>
          </div>
        </div>

        <div class="node-context-footer">
          <button type="button" class="btn btn-outline-secondary" @click="closePanel">Cancel</button>
          <button type="button" class="btn btn-secondary" @click="saveContext" :disabled="saving || refining">
            {{ saving ? 'Saving...' : 'Save Context' }}
          </button>
          <button type="button" class="btn btn-primary" @click="refineFlowchart" :disabled="saving || refining">
            {{ refining ? 'Refining...' : 'Refine From This Node' }}
          </button>
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

.node-context-footer {
  margin-top: 1.5rem;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
}

.node-context-eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #6b7280;
}

.node-context-title {
  margin: 0;
  font-size: 1.4rem;
}

.node-context-description,
.node-context-help {
  margin: 0.4rem 0 0;
  color: #6b7280;
}

.node-context-close {
  border: none;
  background: transparent;
  font-size: 1.75rem;
  line-height: 1;
  color: #4b5563;
}

.node-context-body {
  display: grid;
  gap: 1.5rem;
}

.node-context-section {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 1rem;
  background: #f8fafc;
}

.node-context-label {
  display: block;
  font-weight: 600;
  color: #111827;
}

.guided-prompt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.85rem;
  margin-top: 0.85rem;
}

.guided-prompt-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  text-align: left;
  padding: 0.9rem 1rem;
  border-radius: 14px;
  border: 1px solid #cbd5e1;
  background: #fff;
  transition: all 0.2s ease;
}

.guided-prompt-card.selected,
.guided-prompt-card:hover {
  border-color: #0d6efd;
  box-shadow: 0 10px 24px rgba(13, 110, 253, 0.12);
}

.guided-prompt-title {
  font-weight: 600;
  color: #111827;
}

.guided-prompt-hint {
  color: #6b7280;
  font-size: 0.92rem;
}

.node-context-textarea {
  width: 100%;
  margin-top: 0.85rem;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
  background: #fff;
  padding: 1rem;
  resize: vertical;
  min-height: 180px;
}

.node-context-textarea:focus,
.guided-prompt-card:focus,
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
</style>
