<script setup>
defineProps({
  open: {
    type: Boolean,
    default: false
  },
  node: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close']);

const closePanel = () => {
  emit('close');
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
      >
        <div class="node-context-header">
          <div>
            <h3 id="node-context-title" class="node-context-title">Example Header</h3>
          </div>
          <button type="button" class="node-context-close" @click="closePanel" aria-label="Close node context panel">
            ×
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

.node-context-title {
  margin: 0;
  font-size: 1.4rem;
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
</style>
