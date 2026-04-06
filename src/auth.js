import { reactive } from 'vue';
import { createAuth0Client } from '@auth0/auth0-spa-js'
import axios from 'axios'
import router from './router.js'

export const authState = reactive({
  client: null,
  isAuthenticated: false,
  loginFailed: false,
  user: null,
  isAdmin: false,
  adminAccessLevel: 'user',
  adminStatusLoaded: false,
  isReady: false,
});

let authInitPromise = null;

// Initialize Auth0
export async function initAuth() {
  if (!authInitPromise) {
    authInitPromise = (async () => {
      authState.client = await createAuth0Client({
        domain: import.meta.env.VITE_AUTH0_DOMAIN,
        clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
          redirect_uri: window.location.origin,
        },
        cacheLocation: 'localstorage',
        useRefreshTokens: true,
      });

      if (await authState.client.isAuthenticated()) {
        await tryLogin();
      } else {
        resetAdminState();
      }

      authState.isReady = true;
      return authState.client;
    })();
  }

  return authInitPromise;
}

export async function ensureAuthReady() {
  return authInitPromise || initAuth();
}

// Get auth0 token
export async function getToken(skipAuthCheck = false) {
  if (!authState.client) return;
  if (!skipAuthCheck && !authState.isAuthenticated) return;

  return await authState.client.getTokenSilently({
    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
    scope: 'openid profile email',
  });
}

// Attempt to login if the instance is already authenticated
async function tryLogin() {
  try {
    authState.user = await authState.client.getUser();
    authState.isAuthenticated = true
    try {
      await createUser();
    } catch (err) {
      console.warn('Unable to sync user profile during login:', err);
    }

    await refreshAdminStatus({ suppressErrors: true });
    authState.loginFailed = false
    console.log("Logged in as:", authState.user.name)
  } catch (err) {
    authState.isAuthenticated = false
    resetAdminState();
    if (err == "Failed to create user") authState.loginFailed = true
    console.log("Login failed:", err);
  }
}

// Create account
async function createUser() {
  const token = await getToken(true);
  if (!token) return;
  
  try {
    const res = await axios.post(
      'http://localhost:3000/api/create-user',
      {},
      { headers: { authorization: `Bearer ${token}` }, timeout: 3000 },
    );
    console.log(res.data);
  } catch (err) {
    console.log(err);
    throw "Failed to create user";
  }
}

export async function refreshAdminStatus(options = {}) {
  const { suppressErrors = false } = options;

  if (!authState.isAuthenticated) {
    resetAdminState();
    return { isAdmin: false, accessLevel: 'user' };
  }

  try {
    const token = await getToken(true);
    if (!token) {
      resetAdminState();
      return { isAdmin: false, accessLevel: 'user' };
    }

    const response = await axios.get('http://localhost:3000/api/admin/status', {
      headers: { authorization: `Bearer ${token}` }
    });

    authState.isAdmin = Boolean(response.data?.isAdmin);
    authState.adminAccessLevel = response.data?.accessLevel || 'user';
    authState.adminStatusLoaded = true;
    return response.data;
  } catch (err) {
    resetAdminState();
    if (!suppressErrors) {
      throw err;
    }

    console.warn('Unable to refresh admin status:', err?.message || err);
    return { isAdmin: false, accessLevel: 'user' };
  }
}

// Login
export async function login() {
  try {
    await authState.client.loginWithPopup();
    await tryLogin();
    // Redirect to profile after successful login
    router.push('/profile');
  } catch (err) {
    console.error('Login error:', err);
    authState.loginFailed = true;
  }
}

// Logout
export async function logout() {
  await authState.client.logout({
    logoutParams: { returnTo: window.location.origin },
  })
  authState.isAuthenticated = false;
  authState.user = null;
  resetAdminState();
  // Redirect to home after logout
  router.push('/');
}

// put ID into vue3 cookies store
export function getUserID() {
  return authState.user?.sub;
}

function resetAdminState() {
  authState.isAdmin = false;
  authState.adminAccessLevel = 'user';
  authState.adminStatusLoaded = true;
}




