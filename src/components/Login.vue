<script setup>
import { login, logout, authState } from '../auth.js'
</script>


<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Get Started</h1>
      <div v-if="!authState.isAuthenticated">
        <button @click="login" :disabled="authState.loginFailed">Login / Sign Up</button>
      </div>
    
      <div v-if="authState.isAuthenticated">
        <p>Logged in as <strong>{{ authState.user.name }}</strong></p>
        <button @click="logout">Logout</button>
      </div>

      <div v-if="authState.loginFailed">
        <p>Login not available.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.login-card {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  width: 350px;
  text-align: center;
}

h1 {
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
  text-align: left;
}

label {
  display: block;
  margin-bottom: 0.3rem;
  font-weight: bold;
}

input {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid #ccc;
  border-radius: 5px;
}

button {
  width: 100%;
  padding: 0.8rem;
  margin: 0.4rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1rem;
  cursor: pointer;
}

button:hover {
  background: #0056b3;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error {
  color: red;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}
</style>