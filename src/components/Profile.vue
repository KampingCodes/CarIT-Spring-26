<script setup>
import { ref, watch, onMounted } from 'vue';
import { useThemeStore } from '../stores/theme';
import 'primeicons/primeicons.css';

import personPicture from "../assets/images/UntitledPerson.png";
import mermaid from 'mermaid/dist/mermaid.esm.min.mjs'
import { getSavedFlowcharts, getResponse, getUserData, setUserData, deleteFlowchart, uploadProfilePicture, crashOut } from '../apis.js';
import { authState } from '../auth.js';
import { getMermaidConfig, applyMermaidThemeToSvg } from '../flowchart-utils.js';
import MyGarage from './MyGarage.vue';
import ConfirmDialog from './ConfirmDialog.vue';

// Profile state
const Name = ref('');
const Email = ref('@example.com');
const dataLoading = ref(true);
const dataError = ref(false);
const editMode = ref(false);
const personPhoto = ref(personPicture);
const previewPhoto = ref(null);
const profilePictureInput = ref(null);
const uploadingProfilePicture = ref(false);
const profilePictureError = ref(null);
const profileNameError = ref(null);
const savingProfile = ref(false);
const crashOutCount = ref(0);
const crashOutLoading = ref(false);
const isShaking = ref(false);

// Flowchart carousel state (copied/adapted from FlowchartPage)
const flowcharts = ref([]);
const vehicles = ref([]);
const issues = ref([]);
const flowchartSvg = ref([]);
const thumbnailSvg = ref([]);
const loading = ref([]);
const error = ref([]);
const selectedIndex = ref(0);
const carouselScroll = ref(null);
const confirmDialog = ref(null);

const selectFlowchart = (idx) => { selectedIndex.value = idx; };

const removeFlowchart = async (idx, event) => {
  event.stopPropagation();
  const confirmed = await confirmDialog.value.show('Are you sure you want to delete this flowchart?');
  if (!confirmed) {
    return;
  }
  try {
    await deleteFlowchart(idx);
    flowcharts.value.splice(idx, 1);
    vehicles.value.splice(idx, 1);
    issues.value.splice(idx, 1);
    flowchartSvg.value.splice(idx, 1);
    thumbnailSvg.value.splice(idx, 1);
    loading.value.splice(idx, 1);
    error.value.splice(idx, 1);
    
    if (selectedIndex.value >= flowcharts.value.length && flowcharts.value.length > 0) {
      selectedIndex.value = flowcharts.value.length - 1;
    }
  } catch (err) {
    console.error('Error deleting flowchart:', err);
  }
};

const scrollCarousel = (direction) => {
  if (carouselScroll.value) {
    const scrollAmount = 220;
    const duration = 1000; // 1 second for smooth, visible scroll
    const startScroll = carouselScroll.value.scrollLeft;
    const targetScroll = startScroll + (direction === 'left' ? -scrollAmount : scrollAmount);
    const startTime = Date.now();
    
    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      // Easing function for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      carouselScroll.value.scrollLeft = startScroll + (targetScroll - startScroll) * easeProgress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }
};



const editPage = async () => { 
  if (editMode.value) {
    // Saving changes
    const saved = await saveProfile();
    previewPhoto.value = null;
    if (!saved) {
      return; // Stay in edit mode if save failed
    }
  }
  editMode.value = !editMode.value; 
};

const saveProfile = async () => { 
  profileNameError.value = null;
  savingProfile.value = true;
  const updateData = { name: Name.value };
  if (previewPhoto.value) {
    try {
      uploadingProfilePicture.value = true;
      profilePictureError.value = null;
      await uploadProfilePicture(previewPhoto.value);
      personPhoto.value = previewPhoto.value;
      previewPhoto.value = null;
    } catch (err) {
      profilePictureError.value = 'Failed to upload profile picture: ' + (err?.message || String(err));
      console.error('Profile picture upload error:', err);
      savingProfile.value = false;
      return false;
    } finally {
      uploadingProfilePicture.value = false;
    }
  }
  try {
    await setUserData(updateData);
    savingProfile.value = false;
    return true;
  } catch (err) {
    const errorMessage = err?.message || String(err);
    if (errorMessage.includes('already in use')) {
      profileNameError.value = 'This profile name is already in use. Please choose a different name.';
    } else {
      profileNameError.value = 'Failed to update profile: ' + errorMessage;
    }
    console.error('Profile save error:', err);
    savingProfile.value = false;
    return false;
  }
};

const triggerProfilePictureUpload = () => {
  if (profilePictureInput.value) {
    profilePictureInput.value.click();
  }
};

const handleCrashOut = async () => {
  if (crashOutLoading.value) return;
  
  crashOutLoading.value = true;
  try {
    const result = await crashOut();
    console.log('Crash out result:', result);
    
    if (result.success) {
      // Update the counter with the value from the server
      crashOutCount.value = result.crashOut;
      console.log('Updated crashOutCount to:', crashOutCount.value);
      
      // Trigger shake animation
      isShaking.value = true;
      setTimeout(() => {
        isShaking.value = false;
      }, 600); // Duration matches the shake animation
    } else {
      console.error('Failed to increment crash out:', result);
    }
  } catch (err) {
    console.error('Error during crash out:', err?.message || err);
  } finally {
    crashOutLoading.value = false;
  }
};

const handleProfilePictureChange = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  profilePictureError.value = null;

  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    profilePictureError.value = 'Invalid file type. Please use JPG, PNG, or WebP.';
    return;
  }

  // Validate file size (3.75MB to account for base64 encoding)
  const MAX_SIZE = 3.75 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    profilePictureError.value = 'File too large. Maximum size is 3.75MB.';
    return;
  }

  try {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewPhoto.value = e.target?.result;
    };
    reader.onerror = () => {
      profilePictureError.value = 'Failed to read file.';
    };
    reader.readAsDataURL(file);
  } catch (err) {
    profilePictureError.value = 'Error processing file: ' + (err?.message || String(err));
  } finally {
    // Reset file input
    if (profilePictureInput.value) {
      profilePictureInput.value.value = '';
    }
  }
};

async function ask(inputValue, responseRef, loadingRef) {
  responseRef.value = '';
  loadingRef.value = true;
  try {
    const res = await getResponse(inputValue);
    let out = res;
    const prefix = 'Mocked response (client):';
    if (typeof out === 'string' && out.startsWith(prefix)) out = out.slice(prefix.length).trim();
    const legacyOk = 'OK - received your request.';
    if (typeof out === 'string' && out.startsWith(legacyOk)) out = out.slice(legacyOk.length).trim();
    responseRef.value = out;
  } catch (err) {
    responseRef.value = 'Error: ' + (err?.message || String(err));
  } finally {
    loadingRef.value = false;
  }
}

// Helper to extract mermaid code and render SVG/thumbnail
const getDiagram = async (flowchartObj, idx) => {
  loading.value[idx] = true;
  error.value[idx] = null;
  vehicles.value[idx] = flowchartObj.vehicle;
  issues.value[idx] = flowchartObj.issues;
  try {
    const mermaidMatch = flowchartObj.flowchart.match(/```mermaid\n([\s\S]*?)\n```/);
    if (!mermaidMatch) throw new Error('Mermaid code block not found');
    const code = mermaidMatch[1].trim();
    await mermaid.parse(code);
    const { svg } = await mermaid.render(`flowchart-${idx}`, code);
    flowchartSvg.value[idx] = applyMermaidThemeToSvg(svg, themeStore.isDark);
    const { svg: thumbSvg } = await mermaid.render(`thumbnail-${idx}`, code);
    thumbnailSvg.value[idx] = applyMermaidThemeToSvg(thumbSvg, themeStore.isDark);
  } catch (err) {
    error.value[idx] = err.message;
  } finally {
    loading.value[idx] = false;
  }
};

// Load user data
async function loadUserData(retries = 6, delayMs = 5000) {
  if (!authState.isAuthenticated) {
    dataLoading.value = false;
    return;
  }
  dataLoading.value = true;
  dataError.value = false;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const userData = await getUserData();
      if (userData?.name) Name.value = userData.name;
      if (userData?.email) Email.value = userData.email;
      if (userData?.profilePicture) personPhoto.value = userData.profilePicture;
      if (userData?.crashOut !== undefined && userData.crashOut !== null) crashOutCount.value = userData.crashOut;
      dataLoading.value = false;
      return;
    } catch (e) {
      console.warn(`Unable to fetch user data (attempt ${attempt + 1}/${retries}):`, e?.message || e);
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  // All retries exhausted
  dataLoading.value = false;
  dataError.value = true;
}

// Load saved flowcharts
async function loadFlowcharts() {
  if (!authState.isAuthenticated) return;
  try {
    flowcharts.value = await getSavedFlowcharts();
    // initialize arrays
    flowcharts.value.forEach((f, idx) => {
      loading.value[idx] = false;
      error.value[idx] = null;
      flowchartSvg.value[idx] = null;
      thumbnailSvg.value[idx] = null;
      // kick off diagram generation
      getDiagram(f, idx);
    });
  } catch (err) {
    console.error('Error loading saved flowcharts:', err);
  }
}

const themeStore = useThemeStore();

const initializeMermaid = () => {
  mermaid.initialize(getMermaidConfig(themeStore.isDark));
};

watch(() => themeStore.isDark, () => {
  initializeMermaid();
  flowcharts.value.forEach((f, idx) => getDiagram(f, idx));
});

// Clear profile name error when user edits the name
watch(() => Name.value, () => {
  if (profileNameError.value) {
    profileNameError.value = null;
  }
});

onMounted(async () => {
  initializeMermaid();
  // Load data if already authenticated, otherwise skeleton hides once auth resolves
  if (authState.isAuthenticated) {
    await loadUserData();
    await loadFlowcharts();
  } else {
    // Auth hasn't resolved yet — keep skeleton; the watch below will trigger load
    // Don't turn off loading here; wait for authState watch
  }
});

// Watch for authentication changes and reload data when user logs in
watch(() => authState.isAuthenticated, async (isAuth) => {
  if (isAuth) {
    await loadUserData();
    await loadFlowcharts();
  } else {
    // Clear data on logout
    Name.value = '';
    Email.value = '@example.com';
    crashOutCount.value = 0;
    personPhoto.value = personPicture;
    previewPhoto.value = null;
    flowcharts.value = [];
    dataLoading.value = false;
    dataError.value = false;
  }
});

// Helpers for UI labels
function getVehicleDisplayName(vehicle = {}) {
  const { year, make, model, trim } = vehicle || {};
  const base = [year, make, model].filter(Boolean).join(' ');
  if (base && trim) return `${base} - ${trim}`;
  if (base) return base;
  return trim || 'Unknown vehicle';
}



</script>

<template>
  <div class="container untree_co-section" :class="{ 'shake-animation': isShaking }">
    <ConfirmDialog ref="confirmDialog" />
    <div class="profile-layout">
      <!-- Left: Profile summary -->
      <div class="profile-sidebar" data-aos="fade-up" data-aos-delay="0">
        <div class="profile-card">
          <!-- Profile Photo -->
          <div class="profile-photo-wrapper">
            <img 
              :src="previewPhoto || personPhoto" 
              alt="Profile" 
              class="profile-photo" 
              :class="{ 'cursor-pointer': editMode }"
              @click="editMode && triggerProfilePictureUpload()"
              :title="editMode ? 'Click to change profile picture' : ''"
            />
            <div v-if="editMode && previewPhoto" class="photo-indicator">Preview</div>
            <div v-else-if="editMode" class="photo-indicator">Click to upload</div>
          </div>
          <input 
            ref="profilePictureInput"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/jpg,image/png,image/webp"
            style="display: none;"
            @change="handleProfilePictureChange"
          />
          <div v-if="profilePictureError" class="alert alert-danger alert-sm mt-2" role="alert" style="font-size: 0.85rem;">
            {{ profilePictureError }}
          </div>

          <!-- Profile Info -->
          <div class="profile-info">
            <!-- Name -->
            <div v-if="dataLoading" class="skeleton skeleton-name"></div>
            <div v-else-if="dataError" class="profile-server-error">
              <span>Server unavailable</span>
              <button class="btn btn-sm profile-action-button mt-2" @click="loadUserData()">Retry</button>
            </div>
            <div v-else-if="!editMode" class="profile-name">
              {{ Name }}
            </div>
            <div v-else class="edit-input-wrapper">
              <input v-model="Name" class="form-control form-control-sm" placeholder="Your name" />
              <div v-if="profileNameError" class="alert alert-danger alert-sm mt-2">
                {{ profileNameError }}
              </div>
            </div>

            <!-- Email -->
            <div v-if="dataLoading" class="skeleton skeleton-email"></div>
            <div v-else-if="!dataError" class="profile-email">
              {{ Email }}
            </div>

            <!-- Edit Profile Button -->
            <div class="button-group">
              <button class="btn profile-action-button profile-edit-button w-100" @click="editPage" :disabled="dataLoading || savingProfile">
                <i :class="['pi', editMode ? 'pi-check' : 'pi-pencil']" aria-hidden="true"></i>
                <span>{{ editMode ? (savingProfile ? 'Saving...' : 'Save Profile') : 'Edit Profile' }}</span>
              </button>
            </div>

            <!-- Crash Out Stats Section -->
            <div class="crash-out-section">
              <div v-if="dataLoading" class="skeleton skeleton-counter"></div>
              <div v-else class="crash-out-counter">{{ crashOutCount }}</div>
              <button 
                class="btn profile-action-button profile-crash-button w-100" 
                @click="handleCrashOut" 
                :disabled="crashOutLoading || dataLoading"
              >
                {{ crashOutLoading ? 'Loading...' : 'Crash Out' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="profile-content" data-aos="fade-up" data-aos-delay="100">

        <!-- ===== Garage Section ===== -->
        <MyGarage :editable="true" :disabled="dataLoading" class="mb-5" />

        

      </div>
    </div>

  </div>
</template>

<style scoped>
/* ===== Layout ===== */
.profile-layout {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
  flex-wrap: nowrap;
}

.profile-sidebar {
  flex: 0 0 clamp(140px, 28%, 260px);
  width: clamp(140px, 28%, 260px);
  min-width: 0;
}

.profile-content {
  flex: 1 1 0;
  min-width: 0;
}

/* Stack vertically on screens ≤950px */
@media (max-width: 950px) {
  .profile-layout {
    flex-wrap: wrap;
    gap: 1.5rem;
  }
  .profile-sidebar {
    flex: 0 0 100%;
    width: 100%;
  }
  .profile-content {
    flex: 0 0 100%;
    width: 100%;
  }
}

/* Between 950px and 992px navbar clearance */
@media (min-width: 951px) and (max-width: 991.98px) {
  .untree_co-section {
    padding-top: 90px;
  }
}

/* ===== Profile Card ===== */
.profile-card {
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 2px 8px var(--color-card-shadow);
  padding: 1.5rem 1rem;
  text-align: center;
  transition: box-shadow 0.3s ease;
}

.profile-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* Profile Photo */
.profile-photo-wrapper {
  position: relative;
  display: inline-block;
  margin: 0 auto;
}

.profile-photo {
  width: 130px;
  height: 130px;
  object-fit: cover;
  border-radius: 50%;
  display: block;
  transition: opacity 0.2s ease;
  border: 3px solid var(--color-border);
  box-shadow: 0 2px 8px var(--color-card-shadow);
}

.profile-photo.cursor-pointer {
  cursor: pointer;
}

.profile-photo.cursor-pointer:hover {
  opacity: 0.85;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.photo-indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  white-space: nowrap;
}

/* ===== Profile Info ===== */
.profile-info {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.alert-sm {
  padding: 0.5rem 0.75rem;
  margin-bottom: 0;
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.profile-name {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-top: 0.5rem;
}

.profile-email {
  font-size: 0.95rem;
  color: var(--color-text-muted);
  word-break: break-word;
}

.edit-input-wrapper {
  width: 100%;
}

/* ===== Buttons ===== */
.button-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  border-radius: 6px;
}

.profile-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-height: 2.5rem;
  padding: 0.55rem 0.9rem;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--color-brand, #407bff);
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  box-shadow: none;
  transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}

.profile-action-button i {
  font-size: 0.9rem;
}

.profile-action-button:hover:not(:disabled) {
  transform: translateY(-1px);
  background: #2f67e8;
}

.profile-action-button:active:not(:disabled) {
  transform: translateY(0);
}

.profile-edit-button {
  margin-top: 0.1rem;
}

.profile-crash-button {
  background: var(--color-brand, #407bff);
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* ===== Crash Out Section ===== */
.crash-out-section {
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.crash-out-header {
  font-size: 0.95rem;
  font-weight: 500;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.crash-out-counter {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-brand);
}

/* ===== Section Headers ===== */
.section-header {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 0.25rem;
}

.section-subtitle {
  font-size: 0.95rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* Instructions styles removed from Profile; now shown on Flowchart page */

/* ===== Carousel ===== */
.carousel-section {
  margin-top: 1.5rem;
  max-width: 100%;
}

.carousel-wrapper {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: 1rem;
}

.carousel-container {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 0.5rem 0;
  max-width: calc(3 * 200px + 2 * 1rem);
  flex-shrink: 0;
}

/* ===== Thumbnail Cards ===== */
.thumbnail-card {
  min-width: 200px;
  width: 200px;
  height: 220px;
  border: 2px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;
  box-shadow: 0 2px 4px var(--color-card-shadow);
}

.thumbnail-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 8px 16px var(--color-card-shadow);
  border-color: var(--color-border);
}

.thumbnail-card.selected {
  border-color: var(--color-brand);
  border-width: 3px;
  box-shadow: 0 6px 20px rgba(64, 123, 255, 0.25);
}

.thumbnail-svg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0.5rem;
  background: var(--color-diagram-surface);
}

.thumbnail-info {
  padding: 0.9rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-raised);
}

.thumbnail-title {
  font-weight: 500;
  color: var(--color-text-primary);
  font-size: 0.95rem;
}

.thumbnail-subtitle {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 0.2rem;
}

/* ===== Carousel Controls ===== */
.carousel-btn {
  background: var(--color-surface);
  border: 2px solid var(--color-border);
  color: var(--color-text-secondary);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.carousel-btn:hover:not(:disabled) {
  border-color: var(--color-brand);
  color: var(--color-brand);
  transform: scale(1.05);
}

.carousel-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* ===== Delete Icon ===== */
.delete-icon {
  position: absolute;
  top: 6px;
  right: 6px;
  color: #000;
  font-size: 1rem;
  cursor: pointer;
  transition: transform 0.15s ease, color 0.15s ease;
  z-index: 10;
}

.delete-icon:hover {
  color: #333;
  transform: scale(1.1);
}

.delete-icon:active {
  transform: scale(0.95);
}

/* ===== Flowchart Display ===== */
.flowchart-header {
  margin-bottom: 1rem;
}

.flowchart-header h4 {
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #212529;
}

.flowchart-header p {
  margin: 0;
  color: #6c757d;
  font-size: 0.95rem;
}

.flowchart-container {
  width: 100%;
  padding: 1.5rem;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
}

/* ===== Loading & Errors ===== */
.loading,
.error {
  padding: 2rem;
  text-align: center;
  color: #6c757d;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.error {
  color: #dc3545;
  background: #f8d7da;
  border-radius: 8px;
  border: 1px solid #f5c6cb;
}

.excerpt {
  padding: 2rem;
  text-align: center;
  color: #6c757d;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

/* ===== Spinner ===== */
.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ===== Shake Animation ===== */
@keyframes shake {
  0%, 100% { transform: translateX(0) translateY(0); }
  10% { transform: translateX(-30px) translateY(-30px); }
  20% { transform: translateX(30px) translateY(30px); }
  30% { transform: translateX(-30px) translateY(30px); }
  40% { transform: translateX(30px) translateY(-30px); }
  50% { transform: translateX(-40px) translateY(-40px); }
  60% { transform: translateX(40px) translateY(40px); }
  70% { transform: translateX(-40px) translateY(40px); }
  80% { transform: translateX(40px) translateY(-40px); }
  90% { transform: translateX(-20px) translateY(-20px); }
}

.shake-animation {
  animation: shake 0.4s linear;
}

/* ===== Mobile Improvements ===== */
@media (max-width: 768px) {
  .container.untree_co-section {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .profile-layout {
    gap: 1rem;
  }

  .profile-sidebar,
  .profile-content {
    padding-left: 0.25rem;
    padding-right: 0.25rem;
    box-sizing: border-box;
  }

  .profile-card {
    padding: 1.25rem 0.75rem;
  }

  .profile-name {
    font-size: 1.1rem;
  }

  .section-title {
    font-size: 1.1rem;
  }

  .carousel-container {
    max-width: 100%;
  }

  .thumbnail-card {
    min-width: 160px;
    width: 160px;
    height: 180px;
  }

  .carousel-wrapper {
    gap: 0.75rem;
  }
}

/* ===== Skeleton Loading ===== */
@keyframes skeleton-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  border-radius: 6px;
  background: linear-gradient(90deg, var(--color-border, #e0e0e0) 25%, color-mix(in srgb, var(--color-border, #e0e0e0) 60%, transparent) 50%, var(--color-border, #e0e0e0) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}

.skeleton-name {
  height: 1.4rem;
  width: 70%;
  margin: 0.5rem auto 0;
}

.skeleton-email {
  height: 1rem;
  width: 85%;
  margin: 0 auto;
}

.skeleton-counter {
  height: 2rem;
  width: 3rem;
  margin: 0 auto;
  border-radius: 8px;
}

.profile-server-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
}

</style>