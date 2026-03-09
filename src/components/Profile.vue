<script setup>
import { ref, watch, onMounted } from 'vue';
import 'primeicons/primeicons.css';

import personPicture from "../assets/images/UntitledPerson.png";
import mermaid from 'mermaid/dist/mermaid.esm.min.mjs'
import { getSavedFlowcharts, getResponse, getUserData, setUserData, deleteFlowchart, uploadProfilePicture, crashOut } from '../apis.js';
import { authState } from '../auth.js';
import MyGarage from './MyGarage.vue';
import ConfirmDialog from './ConfirmDialog.vue';

// Profile state
const Name = ref('');
const Email = ref('@example.com');
const ExperienceLevel = ref(null);
const editMode = ref(false);
const personPhoto = ref(personPicture);
const previewPhoto = ref(null);
const profilePictureInput = ref(null);
const uploadingProfilePicture = ref(false);
const profilePictureError = ref(null);
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
    await saveProfile();
    previewPhoto.value = null;
  }
  editMode.value = !editMode.value; 
};

const saveProfile = async () => { 
  const updateData = { name: Name.value, experienceLevel: ExperienceLevel.value };
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
      return;
    } finally {
      uploadingProfilePicture.value = false;
    }
  }
  await setUserData(updateData);
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
    flowchartSvg.value[idx] = svg;
    const { svg: thumbSvg } = await mermaid.render(`thumbnail-${idx}`, code);
    thumbnailSvg.value[idx] = thumbSvg;
  } catch (err) {
    error.value[idx] = err.message;
  } finally {
    loading.value[idx] = false;
  }
};

// Load user data
async function loadUserData() {
  if (!authState.isAuthenticated) return;
  try {
    const userData = await getUserData();
    if (userData?.name) Name.value = userData.name;
    if (userData?.email) Email.value = userData.email;
    if (userData?.experienceLevel !== undefined && userData.experienceLevel !== null) ExperienceLevel.value = userData.experienceLevel;
    if (userData?.profilePicture) personPhoto.value = userData.profilePicture;
    if (userData?.crashOut !== undefined && userData.crashOut !== null) crashOutCount.value = userData.crashOut;
  } catch (e) {
    console.warn('Unable to fetch user data:', e?.message || e);
  }
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

onMounted(async () => {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', flowchart: { htmlLabels: true, curve: 'basis' } });
  // Load data if already authenticated
  if (authState.isAuthenticated) {
    await loadUserData();
    await loadFlowcharts();
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
  }
});
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
            <div v-if="!editMode" class="profile-name">
              {{ Name }}
            </div>
            <div v-else class="edit-input-wrapper">
              <input v-model="Name" class="form-control form-control-sm" placeholder="Your name" />
            </div>

            <!-- Experience Level Badge -->
            <div v-if="!editMode && ExperienceLevel" class="profile-section">
              <span class="experience-badge">{{ ExperienceLevel }}</span>
            </div>
            <div v-else-if="editMode" class="profile-section edit-input-wrapper">
              <select v-model="ExperienceLevel" class="form-select form-select-sm">
                <option :value="null">Select level</option>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Expert</option>
              </select>
            </div>

            <!-- Email -->
            <div class="profile-email">
              {{ Email }}
            </div>

            <!-- Edit Profile Button -->
            <div class="button-group">
              <button class="btn btn-primary btn-sm w-100" @click="editPage">
                {{ editMode ? 'Save Profile' : 'Edit Profile' }}
              </button>
            </div>

            <!-- Crash Out Stats Section -->
            <div class="crash-out-section">
              <div class="crash-out-counter">{{ crashOutCount }}</div>
              <button 
                class="btn btn-danger btn-sm w-100" 
                @click="handleCrashOut" 
                :disabled="crashOutLoading"
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
        <MyGarage :editable="true" class="mb-5" />

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
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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
  border: 3px solid #e9ecef;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
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
  color: #212529;
  margin-top: 0.5rem;
}

.profile-section {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.experience-badge {
  display: inline-block;
  background: #007bff;
  color: white;
  padding: 0.4rem 0.9rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2);
}

.profile-email {
  font-size: 0.95rem;
  color: #6c757d;
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

.btn-primary {
  background: #007bff;
  border: none;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 123, 255, 0.3);
  background: #0056b3;
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-danger {
  background: #007bff;
  border: none;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 123, 255, 0.3);
  background: #0056b3;
}

.btn-danger:active:not(:disabled) {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* ===== Crash Out Section ===== */
.crash-out-section {
  padding-top: 1rem;
  border-top: 1px solid #e9ecef;
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
  color: #007bff;
}

/* ===== Section Headers ===== */
.section-header {
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #212529;
  margin-bottom: 0.25rem;
}

.section-subtitle {
  font-size: 0.95rem;
  color: #6c757d;
  margin: 0;
}

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
  border: 2px solid #e9ecef;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  background: white;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.thumbnail-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
  border-color: #dee2e6;
}

.thumbnail-card.selected {
  border-color: #007bff;
  border-width: 3px;
  box-shadow: 0 6px 20px rgba(0, 123, 255, 0.25);
}

.thumbnail-svg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0.5rem;
  background: #f8f9fa;
}

.thumbnail-info {
  padding: 0.9rem;
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
}

.thumbnail-title {
  font-weight: 500;
  color: #212529;
  font-size: 0.95rem;
}

.thumbnail-subtitle {
  font-size: 0.85rem;
  color: #6c757d;
  margin-top: 0.2rem;
}

/* ===== Carousel Controls ===== */
.carousel-btn {
  background: white;
  border: 2px solid #dee2e6;
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
  border-color: #007bff;
  color: #007bff;
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
</style>