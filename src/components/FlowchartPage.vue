<script setup>
import { onMounted, ref, computed } from 'vue';
import { getSavedFlowcharts } from '../apis';
import mermaid from 'mermaid/dist/mermaid.esm.min.mjs'

const flowcharts = ref([]);
const vehicles = ref([]);
const issues = ref([]);
const flowchartSvg = ref([]);
const thumbnailSvg = ref([]);
const loading = ref([]);
const error = ref([]);
const selectedIndex = ref(0);
const carouselScroll = ref(null);

const selectedFlowchart = computed(() => {
  if (flowcharts.value.length === 0) return null;
  return {
    vehicle: vehicles.value[selectedIndex.value],
    issues: issues.value[selectedIndex.value],
    responses: flowcharts.value[selectedIndex.value]?.responses,
    svg: flowchartSvg.value[selectedIndex.value],
    loading: loading.value[selectedIndex.value],
    error: error.value[selectedIndex.value]
  };
});

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
    
    // Generate full-size flowchart
    const { svg } = await mermaid.render(`flowchart-${idx}`, code);
    flowchartSvg.value[idx] = svg;
    
    // Generate thumbnail (same SVG, will be styled smaller)
    const { svg: thumbSvg } = await mermaid.render(`thumbnail-${idx}`, code);
    thumbnailSvg.value[idx] = thumbSvg;
  } catch (err) {
    error.value[idx] = err.message;
  } finally {
    loading.value[idx] = false;
  }
};

const selectFlowchart = (idx) => {
  selectedIndex.value = idx;
};

const scrollCarousel = (direction) => {
  if (carouselScroll.value) {
    const scrollAmount = 220; // thumbnail width + gap
    carouselScroll.value.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }
};

onMounted(async () => {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    flowchart: { htmlLabels: true, curve: 'basis' }
  });
  
  flowcharts.value = await getSavedFlowcharts();
  flowcharts.value.forEach(getDiagram);
});
</script>

<template>
  <div class="untree_co-home" id="home-section">
    <div class="container">
      <div class="row align-items-start">
        <div class="col-12">
          <h1 class="heading" data-aos="fade-up" data-aos-delay="0">
            Flowcharts
          </h1>
          
          <div v-if="flowcharts.length === 0" class="excerpt" data-aos="fade-up" data-aos-delay="100">
            You haven't generated any flowcharts yet.
          </div>

          <!-- Carousel Section -->
          <div v-else class="carousel-section">
            <h3 class="carousel-title">Select a Flowchart</h3>
            <div class="carousel-wrapper">
              <button 
                class="carousel-btn carousel-btn-left" 
                @click="scrollCarousel('left')"
                :disabled="flowcharts.length <= 3"
              >
                &#8249;
              </button>
              
              <div class="carousel-container" ref="carouselScroll">
                <div 
                  v-for="(flowchart, idx) in flowcharts" 
                  :key="idx"
                  class="thumbnail-card"
                  :class="{ selected: selectedIndex === idx }"
                  @click="selectFlowchart(idx)"
                >
                  <div v-if="loading[idx]" class="thumbnail-loading">
                    <div class="spinner"></div>
                  </div>
                  <div v-else-if="error[idx]" class="thumbnail-error">
                    Error
                  </div>
                  <div v-else v-html="thumbnailSvg[idx]" class="thumbnail-svg"></div>
                  
                  <div class="thumbnail-info">
                    <div class="thumbnail-title">
                      {{ vehicles[idx]?.make }} {{ vehicles[idx]?.model }}
                    </div>
                    <div class="thumbnail-subtitle">
                      {{ vehicles[idx]?.year }}
                    </div>
                  </div>
                </div>
              </div>
              
              <button 
                class="carousel-btn carousel-btn-right" 
                @click="scrollCarousel('right')"
                :disabled="flowcharts.length <= 3"
              >
                &#8250;
              </button>
            </div>

            <!-- Selected Flowchart Display -->
            <div v-if="selectedFlowchart" class="selected-flowchart-section">
              <div class="flowchart-header">
                <h2>
                  {{ selectedFlowchart.vehicle?.make || 'Unknown' }} 
                  {{ selectedFlowchart.vehicle?.model || '' }} 
                  ({{ selectedFlowchart.vehicle?.year || '' }})
                </h2>
                <p><strong>Issues:</strong> {{ selectedFlowchart.issues }}</p>
              </div>

              <div v-if="selectedFlowchart.responses" class="responses-section">
                <div v-for="(response, idx) in selectedFlowchart.responses" :key="idx" class="response-item">
                  <strong>{{ response.question }}</strong><br/>
                  {{ response.option }}
                </div>
              </div>

              <div v-if="selectedFlowchart.loading" class="loading">
                <div class="spinner"></div>
                Loading flowchart...
              </div>
              <div v-else-if="selectedFlowchart.error" class="error">
                {{ selectedFlowchart.error }}
              </div>
              <div v-else v-html="selectedFlowchart.svg" class="flowchart-container"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.carousel-section {
  margin-top: 2rem;
}

.carousel-title {
  margin-bottom: 1rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.carousel-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 3rem;
}

.carousel-container {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding: 1rem 0;
  flex: 1;
  scrollbar-width: thin;
}

.carousel-container::-webkit-scrollbar {
  height: 8px;
}

.carousel-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.carousel-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.carousel-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.thumbnail-card {
  min-width: 200px;
  width: 200px;
  height: 220px;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
  display: flex;
  flex-direction: column;
}

.thumbnail-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: #999;
}

.thumbnail-card.selected {
  border-color: #007bff;
  border-width: 3px;
  box-shadow: 0 4px 16px rgba(0, 123, 255, 0.3);
}

.thumbnail-svg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0.5rem;
}

.thumbnail-svg :deep(svg) {
  max-width: 100%;
  max-height: 140px;
  width: auto !important;
  height: auto !important;
}

.thumbnail-loading,
.thumbnail-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  color: #666;
}

.thumbnail-info {
  padding: 0.75rem;
  border-top: 1px solid #eee;
  background: #f9f9f9;
}

.thumbnail-title {
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thumbnail-subtitle {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.25rem;
}

.carousel-btn {
  background: white;
  border: 2px solid #ddd;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.carousel-btn:hover:not(:disabled) {
  background: #f0f0f0;
  border-color: #999;
}

.carousel-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.selected-flowchart-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #eee;
}

.flowchart-header h2 {
  margin-bottom: 0.5rem;
  font-size: 1.75rem;
}

.flowchart-header p {
  margin-bottom: 1rem;
  color: #555;
}

.responses-section {
  margin: 1.5rem 0;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 8px;
}

.response-item {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.response-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.flowchart-container {
  width: 100%;
  margin: 20px auto;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.loading,
.error {
  text-align: center;
  padding: 2rem;
  font-size: 1.1rem;
}

.error {
  color: #dc3545;
}

.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .carousel-btn {
    display: none;
  }
  
  .thumbnail-card {
    min-width: 160px;
    width: 160px;
    height: 200px;
  }
}
</style>