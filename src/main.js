import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { createPinia } from 'pinia';
import vue3GoogleLogin from 'vue3-google-login'
import { authState, ensureAuthReady, initAuth, refreshAdminStatus } from './auth';

const app = createApp(App);

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

  return true;
});

app.use(vue3GoogleLogin, {
  clientId: '847728556581-8per6t3c7po36b8k1q3qko9nvjlg0fai.apps.googleusercontent.com'
})
app.use(createPinia());
app.use(router);
initAuth().then(async () => {
  await router.isReady();
  app.mount('#app');
});
