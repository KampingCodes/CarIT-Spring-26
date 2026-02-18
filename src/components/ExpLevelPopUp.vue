<script setup>
import { ref } from 'vue';
import { authState } from '../auth.js';

const isVisible = ref(true);

const closePopup = () => {
  isVisible.value = false;
};
</script>

<template>
  <div v-if="authState.isAuthenticated && isVisible" class="popup-overlay">
    <div class="popup-content">
      <div class="popup-header">
        <button class="close-btn" @click="closePopup">&times;</button>
      </div>
      <p class="popup-text">Testing</p>
    </div>
  </div>
</template>

<style scoped>
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.popup-content {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  max-width: 400px;
  position: relative;
}

.popup-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.popup-text {
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
  margin: 0;
  color: #333;
}
</style>
