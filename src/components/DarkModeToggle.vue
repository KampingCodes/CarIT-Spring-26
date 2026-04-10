<script setup>
import { useThemeStore } from '../stores/theme';

const themeStore = useThemeStore();
</script>

<template>
  <button
    class="theme-toggle"
    @click="themeStore.toggle()"
    :aria-label="themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
  >
    <!-- Sun — shown when dark mode is active -->
    <svg v-if="themeStore.isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1"  x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1"  y1="12" x2="3"  y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>

    <!-- Moon — shown when light mode is active -->
    <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  background: var(--theme-toggle-bg, #e8eaf0);
  border: none;
  border-radius: 50%;
  width: 34px;
  height: 34px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-toggle-color, #3c3c50);
  flex-shrink: 0;
  padding: 0;
  /* Override the global transition from theme.css for instant icon swap */
  transition: background-color 0.2s ease, transform 0.2s ease, color 0.2s ease !important;
}

.theme-toggle:hover {
  transform: scale(1.12);
  background: var(--theme-toggle-hover-bg, #dde0ea);
}

.theme-toggle:active {
  transform: scale(0.95);
}

.theme-toggle svg {
  display: block;
  transition: none !important;
}
</style>
