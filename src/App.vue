<script setup>
import { watchEffect } from 'vue';
import NaviBar from "./components/NaviBar.vue";
import { useThemeStore } from './stores/theme';

const themeStore = useThemeStore();

// Keep data-theme on <html> in sync with store, persisting across navigation
watchEffect(() => {
  document.documentElement.setAttribute('data-theme', themeStore.isDark ? 'dark' : 'light');
});
</script>

<template>
  <NaviBar />
  <router-view />
</template>
