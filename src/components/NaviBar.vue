<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import 'primeicons/primeicons.css';

import { themeColor, siteName } from '../items';
import { authState, login, logout } from '../auth.js';
import DarkModeToggle from './DarkModeToggle.vue';

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
  if (window.innerWidth >= 1200) {
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

        <ul class="d-none d-lg-inline-block site-menu nav-links desktop-nav-links">
          <li v-for="item in visibleNavItems" :key="item.to" :class="{ active: isActive(item.to) }">
            <RouterLink :to="item.to" class="nav-link">{{ item.label }}</RouterLink>
          </li>
        </ul>

        <ul class="d-none d-lg-inline-block site-menu nav-actions desktop-nav-actions">
          <li class="nav-toggle-item">
            <DarkModeToggle />
          </li>
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

        <div class="mobile-nav-controls d-inline-flex d-lg-none mobile-only-controls">
          <DarkModeToggle class="mobile-nav-theme-toggle" />
          <button
            type="button"
            :class="['nav-burger', { active: isMobileMenuOpen }]"
            :aria-expanded="isMobileMenuOpen"
            :aria-label="isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'"
            @click="toggleMobileMenu"
          >
            <i :class="['pi', isMobileMenuOpen ? 'pi-times' : 'pi-bars']" aria-hidden="true"></i>
          </button>
        </div>
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
  display: inline-flex !important;
  align-items: center;
}

.nav-links,
.nav-actions {
  padding-left: 0;
}

.desktop-nav-links,
.desktop-nav-actions {
  display: none !important;
}

.mobile-only-controls {
  display: inline-flex !important;
}

.nav-toggle-item {
  display: flex;
  align-items: center;
  margin-right: 10px;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  height: auto;
  margin-left: 0;
  border: 0;
  border-radius: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text-primary, #0d0d14);
  box-shadow: none;
  line-height: 1;
}

.nav-burger i {
  font-size: 1.2rem;
  line-height: 1;
}

.nav-burger:hover {
  color: var(--color-brand, #407bff);
}

.nav-burger:focus-visible,
.mobile-nav-close:focus-visible,
.mobile-nav-link:focus-visible,
.mobile-action:focus-visible {
  outline: 2px solid var(--color-brand, #407bff);
  outline-offset: 2px;
}

.mobile-nav-controls {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  line-height: 1;
}

.mobile-nav-theme-toggle {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.mobile-nav-theme-toggle :deep(.theme-toggle) {
  width: auto;
  height: auto;
  padding: 0;
  border-radius: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.mobile-nav-theme-toggle :deep(.theme-toggle:hover) {
  background: transparent;
}

.mobile-nav-theme-toggle :deep(.theme-toggle svg) {
  width: 1.2rem;
  height: 1.2rem;
}

.nav-bottom-offset {
  height: 50px;
}

.mobile-nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1990;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
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
  background: var(--color-mobile-menu-bg, #ffffff);
  color: var(--color-text-primary, #0d0d14);
  border-left: 1px solid var(--color-border, #e2e4ec);
  box-shadow: -10px 0 30px rgba(15, 23, 42, 0.18);
  overflow-y: auto;
}

.mobile-nav-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.mobile-nav-header .logo {
  color: var(--color-text-primary, #0d0d14);
}

.mobile-nav-header .logo:hover {
  color: var(--color-text-primary, #0d0d14);
}

.mobile-nav-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border, #e2e4ec);
  border-radius: 999px;
  background: var(--color-surface-raised, #f4f7fb);
  color: var(--color-text-primary, #0d0d14);
}

.mobile-nav-close:hover {
  background: var(--color-surface, #ffffff);
  color: var(--color-brand, #407bff);
  border-color: var(--color-brand, #407bff);
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
  color: var(--color-text-secondary, rgba(0, 0, 0, 0.72));
  background: var(--color-bg-subtle, #f8fafc);
  border: 1px solid var(--color-border-subtle, #eceef4);
}

.mobile-nav-link:hover {
  color: var(--color-brand, #407bff);
  background: var(--color-brand-light, #eef4ff);
}

.mobile-nav-links li.active .mobile-nav-link {
  color: var(--color-text-primary, #0d0d14);
  background: var(--color-brand-light, #eef4ff);
  border-color: var(--color-brand, #407bff);
}

.mobile-action {
  border: 1px solid transparent;
  justify-content: center;
  font-weight: 500;
}

.mobile-action-outline {
  border-color: var(--color-border, rgba(0, 0, 0, 0.1));
  color: var(--color-text-primary, #0d0d14);
  background: var(--color-surface, #ffffff);
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

@media (min-width: 1200px) {
  .desktop-nav-links,
  .desktop-nav-actions {
    display: inline-block !important;
  }

  .mobile-only-controls {
    display: none !important;
  }

  .nav-bottom-offset {
    height: 20px;
  }
}

@media (max-width: 1199.98px) {
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
