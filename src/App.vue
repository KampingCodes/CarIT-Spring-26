<script setup>
import { watchEffect, onMounted } from 'vue';
import NaviBar from "./components/NaviBar.vue";
import { useThemeStore } from './stores/theme';
import { useServerStore } from './stores/server.js';

const themeStore = useThemeStore();
const serverStore = useServerStore();

// Keep data-theme on <html> in sync with store, persisting across navigation
watchEffect(() => {
  document.documentElement.setAttribute('data-theme', themeStore.isDark ? 'dark' : 'light');
});

// Pre-warm the server and track connectivity status
onMounted(() => {
  serverStore.check();
});
</script>

<template>
  <NaviBar />
  <router-view />
</template>
