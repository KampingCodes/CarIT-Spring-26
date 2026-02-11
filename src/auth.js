import { reactive } from 'vue';
import { createAuth0Client } from '@auth0/auth0-spa-js'
import axios from 'axios'

export const authState = reactive({
  client: null,
  isAuthenticated: false,
  loginFailed: false,
  user: null,
});

// Initialize Auth0
export async function initAuth() {
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

  // Stay logged in
  if (await authState.client.isAuthenticated()) tryLogin();
}

// Get auth0 token
export async function getToken() {
  if (!authState.client) return;

  return await authState.client.getTokenSilently({
    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
    scope: 'openid profile email',
  });
}

// Attempt to login if the instance is already authenticated
async function tryLogin() {
  try {
    authState.user = await authState.client.getUser();
    await createUser();
    authState.isAuthenticated = true
    authState.loginFailed = false
    console.log("Logged in as:", authState.user.name)
  } catch (err) {
    authState.isAuthenticated = false
    if (err == "Failed to create user") authState.loginFailed = true
    console.log("Login failed:", err);
  }
}

// Create account
async function createUser() {
  const token = await getToken();
  if (!token) return;
  
  try {
    const res = await axios.post(
      'http://localhost:3001/api/create-user',
      {},
      { headers: { authorization: `Bearer ${token}` }, timeout: 3000 },
    );
    console.log(res.data);
  } catch (err) {
    console.log(err);
    throw "Failed to create user";
  }
}

// Login
export async function login() {
  await authState.client.loginWithPopup();
  tryLogin();
}

// Logout
export async function logout() {
  await authState.client.logout({
    logoutParams: { returnTo: window.location.origin },
  })
}

// put ID into vue3 cookies store
export function getUserID() {
  return authState.user.sub;
}


