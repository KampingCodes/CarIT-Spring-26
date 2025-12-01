<script setup>
import { ref, onMounted } from 'vue';
import { useCookies } from 'vue3-cookies';
import personPicture from "../assets/images/UntitledPerson.png";
import mermaid from 'mermaid/dist/mermaid.esm.min.mjs'
import { getSavedFlowcharts, getResponse, getUserData, setUserData } from '../apis.js';

// Profile state
const { cookies } = useCookies();
const Name = ref('');
const Email = ref('@example.com');
const crashingOut = ref(Number(cookies.get('crashOut') || 0));
const isShaking = ref(false);
const isShaking2 = ref(false);
const isRolling = ref(false);
const editMode = ref(false);
const personPhoto = ref(personPicture);

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

const selectFlowchart = (idx) => { selectedIndex.value = idx; };
const scrollCarousel = (direction) => {
  if (carouselScroll.value) {
    const scrollAmount = 220;
    carouselScroll.value.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  }
};

const triggerEffect = () => {
  isShaking.value = true;
  setTimeout(() => { isShaking.value = false; }, 1000);
};
const triggerEffect2 = () => {
  isShaking2.value = true;
  setTimeout(() => { isShaking2.value = false; }, 1000);
};
const crashOut = () => {
  crashingOut.value = Number(crashingOut.value) + 1;
  cookies.set('crashOut', crashingOut.value);
  if (Math.random() < 0.5) triggerEffect2(); else triggerEffect();
};
const doBarrelRoll = () => {
  crashingOut.value = Number(crashingOut.value) + 1;
  cookies.set('crashOut', crashingOut.value);
  triggerEffect(); triggerEffect2();
  isRolling.value = true;
  setTimeout(() => { isRolling.value = false; }, 1000);
};

const editPage = () => { editMode.value = !editMode.value; if (!editMode.value) saveProfile(); };
const saveProfile = () => { setUserData({ name: Name.value }); };

async function ask(inputValue, responseRef, loadingRef) {
  responseRef.value = '';
  loadingRef.value = true;
  try {
    const res = await getResponse(inputValue);
    let out = res;
    const prefix = 'Mocked response (client):';
    if (typeof out === 'string' && out.startsWith(prefix)) out = out.slice(prefix.length).trim();
    const legacyOk = 'OK — received your request.';
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

onMounted(async () => {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', flowchart: { htmlLabels: true, curve: 'basis' } });
  // load user info
  try {
    const userData = await getUserData();
    if (userData?.name) Name.value = userData.name;
    if (userData?.email) Email.value = userData.email;
  } catch (e) {
    console.warn('Unable to fetch user data:', e?.message || e);
  }

  // load saved flowcharts
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
});
</script>

<template>
  <div class="container untree_co-section" :class="{ 'barrel-roll': isRolling, shake: isShaking, shake2: isShaking2 }">
    <div class="row">
      <!-- Left: Profile summary -->
      <div class="col-md-4" data-aos="fade-up" data-aos-delay="0">
        <div class="profile-card p-3">
          <img :src="personPhoto" alt="Profile" class="profile-photo" />
          <div class="profile-info mt-3">
            <div v-if="!editMode">
              <h4>{{ Name }}</h4>
            </div>
            <div v-else>
              <input v-model="Name" class="form-control" />
            </div>
            <p class="mb-1">{{ Email }}</p>
            <div class="d-grid gap-2 mb-4">
              <button class="btn btn-primary" @click="editPage">{{ editMode ? 'Save' : 'Edit Profile' }}</button>
              <button class="btn btn-success" @click="crashOut">Crash Out!</button>
            </div>
            <h5 class="mt-3">Crashouts: {{ crashingOut }}</h5>
          </div>
        </div>
      </div>

      <!-- Right: Carousel / Flowcharts -->
      <div class="col-md-8" data-aos="fade-up" data-aos-delay="100">
        <h3 class="heading">Your Flowcharts</h3>
        <div v-if="flowcharts.length === 0" class="excerpt">You haven't generated any flowcharts yet.</div>

        <div v-else class="carousel-section">
          <div class="carousel-wrapper align-items-center">
            <button class="carousel-btn carousel-btn-left" @click="scrollCarousel('left')" :disabled="flowcharts.length <= 3">&#8249;</button>
            <div class="carousel-container" ref="carouselScroll">
              <div v-for="(flowchart, idx) in flowcharts" :key="idx" class="thumbnail-card" :class="{ selected: selectedIndex === idx }" @click="selectFlowchart(idx)">
                <div v-if="loading[idx]" class="thumbnail-loading"><div class="spinner"></div></div>
                <div v-else-if="error[idx]" class="thumbnail-error">Error</div>
                <div v-else v-html="thumbnailSvg[idx]" class="thumbnail-svg"></div>
                <div class="thumbnail-info">
                  <div class="thumbnail-title">{{ vehicles[idx]?.make }} {{ vehicles[idx]?.model }}</div>
                  <div class="thumbnail-subtitle">{{ vehicles[idx]?.year }}</div>
                </div>
              </div>
            </div>
            <button class="carousel-btn carousel-btn-right" @click="scrollCarousel('right')" :disabled="flowcharts.length <= 3">&#8250;</button>
          </div>

          <div v-if="flowcharts[selectedIndex]" class="selected-flowchart-section mt-3">
            <div class="flowchart-header">
              <h4>{{ vehicles[selectedIndex]?.make || 'Unknown' }} {{ vehicles[selectedIndex]?.model || '' }} ({{ vehicles[selectedIndex]?.year || '' }})</h4>
              <p><strong>Issues:</strong> {{ issues[selectedIndex] }}</p>
            </div>
            <div v-if="loading[selectedIndex]" class="loading"><div class="spinner"></div> Loading flowchart...</div>
            <div v-else-if="error[selectedIndex]" class="error">{{ error[selectedIndex] }}</div>
            <div v-else v-html="flowchartSvg[selectedIndex]" class="flowchart-container mt-2"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-card { background: #fff; border-radius: 8px; box-shadow: none; text-align: center; }
.profile-photo { width: 160px; height: 160px; object-fit: cover; border-radius: 50%; }
.profile-info h4 { margin-top: 0.5rem; }
.carousel-section { margin-top: 1rem; }
.carousel-wrapper { display: flex; gap: 1rem; align-items: center; }
.carousel-container { display: flex; gap: 1rem; overflow-x: auto; scroll-behavior: smooth; padding: 1rem 0; flex: 1; }
.thumbnail-card { min-width: 200px; width: 200px; height: 220px; border: 2px solid #ddd; border-radius: 8px; overflow: hidden; cursor: pointer; transition: all 0.3s ease; background: white; display: flex; flex-direction: column; }
.thumbnail-card:hover { transform: translateY(-4px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); border-color: #999; }
.thumbnail-card.selected { border-color: #007bff; border-width: 3px; box-shadow: 0 4px 16px rgba(0, 123, 255, 0.3); }
.thumbnail-svg { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 0.5rem; }
.thumbnail-info { padding: 0.75rem; border-top: 1px solid #eee; background: #f9f9f9; }
.carousel-btn { background: white; border: 2px solid #ddd; border-radius: 50%; width: 40px; height: 40px; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.carousel-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.flowchart-container { width: 100%; margin: 20px auto; padding: 1rem; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
.spinner { border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.shake { animation: shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
.shake2 { animation: shake2 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
/* Strong, multi-axis shakes with rotation for an aggressive effect */
@keyframes shake {
  10%, 90% { transform: translate3d(-60px, -30px, 0) rotate(-12deg); }
  20%, 80% { transform: translate3d(60px, 30px, 0) rotate(12deg); }
  30%, 50%, 70% { transform: translate3d(-40px, 20px, 0) rotate(-8deg); }
  40%, 60% { transform: translate3d(40px, -20px, 0) rotate(8deg); }
}
@keyframes shake2 {
  10%, 90% { transform: translate3d(-30px, -60px, 0) rotate(-10deg); }
  20%, 80% { transform: translate3d(30px, 60px, 0) rotate(10deg); }
  30%, 50%, 70% { transform: translate3d(-20px, 40px, 0) rotate(-6deg); }
  40%, 60% { transform: translate3d(20px, -40px, 0) rotate(6deg); }
}
.barrel-roll { animation: rotateRoll 1s linear; }
@keyframes rotateRoll { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>