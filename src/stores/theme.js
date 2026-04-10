import { defineStore } from 'pinia';

export const useThemeStore = defineStore('theme', {
  state: () => ({
    isDark: localStorage.getItem('carit-theme') === 'dark'
  }),
  actions: {
    toggle() {
      this.isDark = !this.isDark;
      localStorage.setItem('carit-theme', this.isDark ? 'dark' : 'light');
    }
  }
});
