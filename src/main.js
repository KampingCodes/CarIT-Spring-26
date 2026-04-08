import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { createPinia } from 'pinia';
import vue3GoogleLogin from 'vue3-google-login'
import { initAuth } from './auth';

const app = createApp(App);
app.use(vue3GoogleLogin, {
  clientId: '847728556581-8per6t3c7po36b8k1q3qko9nvjlg0fai.apps.googleusercontent.com'
})
app.use(createPinia());
app.use(router);
initAuth().then(() => app.mount('#app'));
