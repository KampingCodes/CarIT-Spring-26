<script setup>
import { themeColor, siteName } from "../items";
import { RouterLink } from 'vue-router';
import { logout, login, authState } from '../auth.js'
</script>
<template>
  <nav class="site-nav dark js-site-navbar mb-5 site-navbar-target">
    <div class="container">
      <div class="site-navigation">
        <RouterLink to="/" class="logo m-0 float-left">
          {{ siteName }}<span class="text-primary">.</span>
        </RouterLink>
        <ul class="js-clone-nav d-none d-lg-inline-block site-menu float-left">
          <li :class="{ active: $route.path === '/' }">
            <RouterLink to="/" class="nav-link">Home</RouterLink>
          </li>
          <li :class="{ active: $route.path === '/service1' }"><RouterLink to="/service1" class="nav-link">Start</RouterLink></li>
          <li :class="{ active: $route.path === '/features' }"><RouterLink to="/features" class="nav-link">Features</RouterLink></li>
          <li :class="{ active: $route.path === '/aboutus' }"><RouterLink to="/aboutus" class="nav-link">About us</RouterLink></li>
          <li v-if="lI" :class="{ active: $route.path === '/flowcharts' }"><RouterLink to="/flowcharts" class="nav-link">Your Flowcharts</RouterLink></li>
          <li v-if="showAdmin" :class="{ active: $route.path === '/admin' }"><RouterLink to="/admin" class="nav-link">Admin Dashboard</RouterLink></li>
        </ul>
        <ul
          class="js-clone-nav 
          -none mt-1 d-lg-inline-block site-menu float-right"
        >
          <li class="cta-primary">
            <a v-if="!lI" @click="login" :style="[{ backgroundColor: themeColor, cursor: 'pointer' }]">Login / Sign Up</a>
          </li>
          <li class="cta-button-outline" style="margin-right: 5px;">
            <RouterLink v-if="lI" to="/profile" class="nav-link">Profile</RouterLink>
          </li>
          <li class="cta-primary">
            <a v-if="lI" @click="logout" :style="[{ backgroundColor: themeColor, cursor: 'pointer' }]">Log Out</a>
          </li>
        </ul>
        <a
          href="#"
          class="burger ml-auto float-right site-menu-toggle js-menu-toggle d-inline-block dark d-lg-none"
          data-toggle="collapse"
          data-target="#main-navbar"
        >
          <span></span>
        </a>
      </div>
    </div>
  </nav>
</template>

<script>
export default {
  computed: {
    lI() {
      return authState.isAuthenticated
    },
    showAdmin() {
      return authState.isAuthenticated && authState.isAdmin
    }
  }
}
</script>
