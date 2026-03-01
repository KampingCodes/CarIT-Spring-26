<script setup>
import { ref } from 'vue';

const isVisible = ref(false);
const message = ref('');
let resolveCallback = null;

const show = (msg) => {
  return new Promise((resolve) => {
    message.value = msg;
    resolveCallback = resolve;
    isVisible.value = true;
  });
};

const confirm = () => {
  isVisible.value = false;
  if (resolveCallback) resolveCallback(true);
};

const cancel = () => {
  isVisible.value = false;
  if (resolveCallback) resolveCallback(false);
};

defineExpose({ show });
</script>

<template>
  <div v-if="isVisible" class="confirm-overlay" @click="cancel">
    <div class="confirm-dialog" @click.stop>
      <div class="confirm-content">
        <p>{{ message }}</p>
      </div>
      <div class="confirm-buttons">
        <button class="btn btn-secondary" @click="cancel">Cancel</button>
        <button class="btn btn-danger" @click="confirm">Delete</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  padding: 2rem;
  max-width: 400px;
  min-width: 300px;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.confirm-content {
  margin-bottom: 1.5rem;
}

.confirm-content p {
  font-size: 1.1rem;
  color: #333;
  margin: 0;
}

.confirm-buttons {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.6rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: #e9ecef;
  color: #495057;
}

.btn-secondary:hover {
  background: #dee2e6;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.btn:active {
  transform: scale(0.95);
}
</style>
