import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { createPinia } from 'pinia';
import vue3GoogleLogin from 'vue3-google-login'
import { authState, ensureAuthReady, initAuth, refreshAdminStatus } from './auth';
import { useServerStore, PUBLIC_ROUTES } from './stores/server.js';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// Kick off the server check immediately so the ready-promise resolves ASAP
const serverStore = useServerStore();
serverStore.check();

router.beforeEach(async (to) => {
  await ensureAuthReady();

  if (to.meta?.requiresAuth && !authState.isAuthenticated) {
    return '/login';
  }

  if (to.meta?.requiresAdmin) {
    try {
      await refreshAdminStatus();
    } catch {
      return '/';
    }

    if (!authState.isAdmin) {
      return '/';
    }
  }

  // Block server-dependent routes while the server is offline.
  // Wait for the first check to complete so we don't block during the initial ping.
  const isPublic = PUBLIC_ROUTES.includes(to.path);
  if (!isPublic) {
    await serverStore.ready();
    if (serverStore.isOffline) {
      return '/server-unavailable';
    }
  }

  return true;
});

app.use(vue3GoogleLogin, {
  clientId: '847728556581-8per6t3c7po36b8k1q3qko9nvjlg0fai.apps.googleusercontent.com'
})
app.use(router);
initAuth().then(async () => {
  await router.isReady();
  app.mount('#app');
});
