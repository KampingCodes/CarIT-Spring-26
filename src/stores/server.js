import { defineStore } from 'pinia';

const PUBLIC_ROUTES = ['/', '/aboutus', '/server-unavailable'];

export const useServerStore = defineStore('server', {
  state: () => ({
    /** 'checking' | 'online' | 'offline' */
    status: 'checking',
    /** Resolves once the first check completes */
    _readyPromise: null,
    _resolveReady: null,
  }),

  getters: {
    isOnline: (state) => state.status === 'online',
    isChecking: (state) => state.status === 'checking',
    isOffline: (state) => state.status === 'offline',
  },

  actions: {
    /** Initialise the ready-promise (called once at app start). */
    init() {
      if (!this._readyPromise) {
        this._readyPromise = new Promise((resolve) => {
          this._resolveReady = resolve;
        });
      }
    },

    /** Returns a promise that resolves once the first check completes. */
    ready() {
      this.init();
      return this._readyPromise;
    },

    /** Ping the server. Updates status and resolves the ready-promise. */
    async check() {
      this.init();
      this.status = 'checking';
      const apiBase = import.meta.env.VITE_API_URL || '';
      try {
        const res = await fetch(`${apiBase}/api/`, { signal: AbortSignal.timeout(10000) });
        this.status = res.ok ? 'online' : 'offline';
      } catch {
        this.status = 'offline';
      } finally {
        if (this._resolveReady) {
          this._resolveReady();
          this._resolveReady = null;
        }
      }
    },
  },
});

export { PUBLIC_ROUTES };
