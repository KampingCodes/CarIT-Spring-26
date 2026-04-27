<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useServerStore } from '../stores/server.js';

const serverStore = useServerStore();
const router = useRouter();
const retrying = ref(false);

async function retry() {
  retrying.value = true;
  await serverStore.check();
  retrying.value = false;
  if (serverStore.isOnline) {
    router.push('/');
  }
}
</script>

<template>
  <div class="unavailable-wrapper">
    <div class="unavailable-card" data-aos="fade-up">
      <div class="unavailable-icon">
        <i class="pi pi-server" aria-hidden="true"></i>
      </div>
      <h2 class="unavailable-title">Server Unavailable</h2>
      <p class="unavailable-message">
        The CarIT server is currently starting up or unreachable.<br />
        Only <strong>Home</strong> and <strong>About Us</strong> are available right now.
      </p>
      <div class="unavailable-actions">
        <button class="btn unavailable-btn-retry" :disabled="retrying" @click="retry">
          <i :class="['pi', retrying ? 'pi-spin pi-spinner' : 'pi-refresh']" aria-hidden="true"></i>
          {{ retrying ? 'Checking…' : 'Retry Connection' }}
        </button>
        <router-link to="/" class="btn unavailable-btn-home">
          <i class="pi pi-home" aria-hidden="true"></i>
          Go to Home
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.unavailable-wrapper {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.unavailable-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: 0 4px 20px var(--color-card-shadow);
  padding: 3rem 2.5rem;
  text-align: center;
  max-width: 480px;
  width: 100%;
}

.unavailable-icon {
  font-size: 3.5rem;
  color: var(--color-text-muted);
  margin-bottom: 1.25rem;
}

.unavailable-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 0.75rem;
}

.unavailable-message {
  font-size: 0.95rem;
  color: var(--color-text-muted);
  line-height: 1.6;
  margin-bottom: 2rem;
}

.unavailable-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.unavailable-btn-retry,
.unavailable-btn-home {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: transform 0.2s ease, background-color 0.2s ease;
  text-decoration: none;
}

.unavailable-btn-retry {
  background: var(--color-brand, #407bff);
  color: #fff;
  border: 1px solid transparent;
}

.unavailable-btn-retry:hover:not(:disabled) {
  background: #2f67e8;
  transform: translateY(-1px);
}

.unavailable-btn-retry:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.unavailable-btn-home {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.unavailable-btn-home:hover {
  border-color: var(--color-brand);
  color: var(--color-brand);
  transform: translateY(-1px);
}
</style>
