<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import 'primeicons/primeicons.css';

import { themeColor, siteName } from '../items';
import { authState, login, logout } from '../auth.js';

const route = useRoute();

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/VehicleInfo', label: 'Start' },
  { to: '/features', label: 'Features' },
  { to: '/aboutus', label: 'About us' },
  { to: '/flowcharts', label: 'Your Flowcharts', requiresAuth: true },
  { to: '/admin', label: 'Admin Dashboard', requiresAdmin: true },
];

const isMobileMenuOpen = ref(false);
const isScrolled = ref(false);
const isNavHidden = ref(false);
const isLoggedIn = computed(() => authState.isAuthenticated);
const isAdmin = computed(() => authState.isAdmin);
const visibleNavItems = computed(() =>
  navItems.filter((item) => {
    if (item.requiresAdmin) {
      return isAdmin.value;
    }

    if (item.requiresAuth) {
      return isLoggedIn.value;
    }

    return true;
  }),
);
const navClasses = computed(() => ({
  scrolled: isScrolled.value,
  awake: isScrolled.value && !isNavHidden.value,
  sleep: isScrolled.value && isNavHidden.value,
}));
const showNavOffset = computed(() => route.path !== '/');

let lastScrollTop = 0;

function isActive(path) {
  return route.path === path;
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false;
}

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
}

function handleScroll() {
  const currentScrollTop = window.scrollY || window.pageYOffset || 0;
  isScrolled.value = currentScrollTop > 24;

  if (isMobileMenuOpen.value) {
    isNavHidden.value = false;
    lastScrollTop = currentScrollTop;
    return;
  }

  if (currentScrollTop <= 24) {
    isNavHidden.value = false;
  } else if (currentScrollTop > lastScrollTop && currentScrollTop > 140) {
    isNavHidden.value = true;
  } else if (currentScrollTop < lastScrollTop) {
    isNavHidden.value = false;
  }

  lastScrollTop = currentScrollTop;
}

function handleResize() {
  if (window.innerWidth >= 992) {
    closeMobileMenu();
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    closeMobileMenu();
  }
}

async function handleLogin() {
  closeMobileMenu();
  await login();
}

async function handleLogout() {
  closeMobileMenu();
  await logout();
}

watch(
  () => route.fullPath,
  () => {
    closeMobileMenu();
  },
);

watch(isMobileMenuOpen, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

onMounted(() => {
  handleScroll();
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.body.style.overflow = '';
  window.removeEventListener('scroll', handleScroll);
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <nav :class="['site-nav', 'dark', 'mb-5', 'site-navbar-target', navClasses]">
    <div class="container">
      <div class="site-navigation">
        <RouterLink to="/" class="logo m-0">
          {{ siteName }}<span class="text-primary">.</span>
        </RouterLink>

        <ul class="d-none d-lg-inline-block site-menu nav-links">
          <li v-for="item in visibleNavItems" :key="item.to" :class="{ active: isActive(item.to) }">
            <RouterLink :to="item.to" class="nav-link">{{ item.label }}</RouterLink>
          </li>
        </ul>

        <ul class="d-none d-lg-inline-block site-menu nav-actions">
          <li v-if="!isLoggedIn" class="cta-primary">
            <a @click="handleLogin" :style="[{ backgroundColor: themeColor, cursor: 'pointer' }]">Login / Sign Up</a>
          </li>
          <li v-if="isLoggedIn" class="cta-button-outline nav-action-spacing">
            <RouterLink to="/profile" class="nav-link nav-action-link">
              <i class="pi pi-user nav-icon" aria-hidden="true"></i>
              <span>Profile</span>
            </RouterLink>
          </li>
          <li v-if="isLoggedIn" class="cta-primary">
            <a @click="handleLogout" :style="[{ backgroundColor: themeColor, cursor: 'pointer' }]" class="nav-action-link">
              <i class="pi pi-sign-out nav-icon" aria-hidden="true"></i>
              <span>Log Out</span>
            </a>
          </li>
        </ul>

        <button
          type="button"
          :class="['burger', 'nav-burger', 'd-inline-block', 'd-lg-none', { active: isMobileMenuOpen }]"
          :aria-expanded="isMobileMenuOpen"
          aria-label="Toggle navigation menu"
          @click="toggleMobileMenu"
        >
          <span></span>
        </button>
      </div>
    </div>
  </nav>

  <div v-if="showNavOffset" class="nav-bottom-offset" aria-hidden="true"></div>

  <transition name="nav-fade">
    <div v-if="isMobileMenuOpen" class="mobile-nav-backdrop" @click="closeMobileMenu"></div>
  </transition>

  <transition name="mobile-nav-slide">
    <aside v-if="isMobileMenuOpen" class="mobile-nav-panel" aria-label="Mobile navigation">
      <div class="mobile-nav-header">
        <RouterLink to="/" class="logo m-0" @click="closeMobileMenu">
          {{ siteName }}<span class="text-primary">.</span>
        </RouterLink>
        <button type="button" class="mobile-nav-close" aria-label="Close navigation menu" @click="closeMobileMenu">
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </div>

      <ul class="mobile-nav-links">
        <li v-for="item in visibleNavItems" :key="`mobile-${item.to}`" :class="{ active: isActive(item.to) }">
          <RouterLink :to="item.to" class="mobile-nav-link" @click="closeMobileMenu">{{ item.label }}</RouterLink>
        </li>
      </ul>

      <div class="mobile-nav-actions">
        <a
          v-if="!isLoggedIn"
          class="mobile-action mobile-action-primary"
          :style="[{ backgroundColor: themeColor, cursor: 'pointer' }]"
          @click="handleLogin"
        >
          Login / Sign Up
        </a>

        <RouterLink v-if="isLoggedIn" to="/profile" class="mobile-action mobile-action-outline" @click="closeMobileMenu">
          <i class="pi pi-user" aria-hidden="true"></i>
          <span>Profile</span>
        </RouterLink>

        <button
          v-if="isLoggedIn"
          type="button"
          class="mobile-action mobile-action-primary mobile-action-button"
          :style="[{ backgroundColor: themeColor }]"
          @click="handleLogout"
        >
          <i class="pi pi-sign-out" aria-hidden="true"></i>
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  </transition>
</template>

<style scoped>
.site-nav {
  transition: transform 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease, padding 0.3s ease;
}

.site-nav.scrolled.sleep {
  transform: translateY(-100%);
}

.site-nav.scrolled.awake {
  transform: translateY(0);
}

.site-navigation {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.nav-links {
  flex: 1;
}

.nav-actions {
  margin-left: auto;
}

.nav-links,
.nav-actions {
  padding-left: 0;
}

.nav-action-spacing {
  margin-right: 5px;
}

.nav-action-link {
  display: inline-flex !important;
  align-items: center;
  gap: 0.5rem;
}

.nav-icon {
  font-size: 0.95rem;
}

.nav-burger {
  margin-left: auto;
  border: 0;
  padding: 0;
  background: transparent;
}

.nav-bottom-offset {
  height: 20px;
}

.mobile-nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1990;
  background: rgba(15, 23, 42, 0.35);
}

.mobile-nav-panel {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: min(320px, 88vw);
  height: 100vh;
  padding: 1.5rem 1.25rem;
  background: #ffffff;
  box-shadow: -10px 0 30px rgba(15, 23, 42, 0.16);
  overflow-y: auto;
}

.mobile-nav-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.mobile-nav-header .logo {
  color: #000000;
}

.mobile-nav-header .logo:hover {
  color: #000000;
}

.mobile-nav-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 999px;
  background: #f4f7fb;
  color: #000000;
}

.mobile-nav-links,
.mobile-nav-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mobile-nav-link,
.mobile-action {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.9rem 1rem;
  border-radius: 18px;
  text-decoration: none !important;
}

.mobile-nav-link {
  color: rgba(0, 0, 0, 0.72);
  background: #f8fafc;
}

.mobile-nav-links li.active .mobile-nav-link {
  color: #000000;
  background: #eef4ff;
}

.mobile-action {
  border: 1px solid transparent;
  justify-content: center;
  font-weight: 500;
}

.mobile-action-outline {
  border-color: rgba(0, 0, 0, 0.1);
  color: #000000;
  background: #ffffff;
}

.mobile-action-primary {
  color: #ffffff !important;
}

.mobile-action-button {
  border: 0;
}

.nav-fade-enter-active,
.nav-fade-leave-active,
.mobile-nav-slide-enter-active,
.mobile-nav-slide-leave-active {
  transition: all 0.25s ease;
}

.nav-fade-enter-from,
.nav-fade-leave-to {
  opacity: 0;
}

.mobile-nav-slide-enter-from,
.mobile-nav-slide-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

@media (max-width: 991.98px) {
  .site-navigation {
    gap: 1rem;
  }

  .site-nav {
    padding-top: 16px;
    padding-bottom: 16px;
  }

  .nav-bottom-offset {
    height: 50px;
  }
}
</style>
