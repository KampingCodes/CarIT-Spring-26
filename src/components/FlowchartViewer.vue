<script setup>
import Panzoom from '@panzoom/panzoom';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({
  svg: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: 'Flowchart'
  },
  embeddedHeight: {
    type: String,
    default: '34rem'
  },
  fullscreenEnabled: {
    type: Boolean,
    default: true
  }
});

const isFullscreen = ref(false);
const inlineViewport = ref(null);
const inlineStage = ref(null);
const fullscreenViewport = ref(null);
const fullscreenStage = ref(null);

const MIN_SCALE = 0.15;
const MAX_SCALE = 6;
const BUTTON_ZOOM_STEP = 0.28;
// Start/reset transform values.
// Manual tuning:
// - Increase scale to start more zoomed in; decrease it to start more zoomed out.
// - Move right: increase X. Move left: decrease X.
// - Move down: increase Y. Move up: decrease Y.
const INLINE_START_SCALE = 0.327529;
const FULLSCREEN_START_SCALE = 0.327529;
const INLINE_START_X = -1924.42;
const FULLSCREEN_START_X = -1924.42;
const INLINE_START_Y = -2657.18;
const FULLSCREEN_START_Y = -2657.18;

const contexts = {
  inline: {
    instance: null,
    wheelHandler: null,
    pointerDownHandler: null,
    pointerUpHandler: null,
    windowBlurHandler: null,
    resetFrame: null,
    viewport: inlineViewport,
    stage: inlineStage
  },
  fullscreen: {
    instance: null,
    wheelHandler: null,
    pointerDownHandler: null,
    pointerUpHandler: null,
    windowBlurHandler: null,
    resetFrame: null,
    viewport: fullscreenViewport,
    stage: fullscreenStage
  }
};

const hasSvg = computed(() => Boolean(props.svg));

const getContext = (mode) => contexts[mode];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getContentMetrics = (stageElement) => {
  const fallbackMetrics = {
    x: 0,
    y: 0,
    width: stageElement?.scrollWidth || stageElement?.clientWidth || 1,
    height: stageElement?.scrollHeight || stageElement?.clientHeight || 1
  };

  const svgElement = stageElement?.querySelector('svg');
  const viewBox = svgElement?.viewBox?.baseVal;

  if (viewBox?.width && viewBox?.height) {
    return {
      x: viewBox.x || 0,
      y: viewBox.y || 0,
      width: viewBox.width,
      height: viewBox.height
    };
  }

  if (svgElement?.getBBox) {
    try {
      const box = svgElement.getBBox();
      if (box.width && box.height) {
        return {
          x: box.x || 0,
          y: box.y || 0,
          width: box.width,
          height: box.height
        };
      }
    } catch {
      return fallbackMetrics;
    }
  }

  return fallbackMetrics;
};

const prepareSvg = (stageElement) => {
  const svgElement = stageElement?.querySelector('svg');

  if (!stageElement || !svgElement) {
    return null;
  }

  const metrics = getContentMetrics(stageElement);
  const safeWidth = Math.max(metrics.width, 1);
  const safeHeight = Math.max(metrics.height, 1);

  stageElement.style.width = `${safeWidth}px`;
  stageElement.style.height = `${safeHeight}px`;
  svgElement.style.display = 'block';
  svgElement.style.width = `${safeWidth}px`;
  svgElement.style.height = `${safeHeight}px`;
  svgElement.style.maxWidth = 'none';
  svgElement.style.maxHeight = 'none';

  return {
    ...metrics,
    width: safeWidth,
    height: safeHeight
  };
};

const fitDiagram = (mode, allowShrink = true) => {
  const context = getContext(mode);
  const viewportElement = context.viewport.value;
  const stageElement = context.stage.value;
  const instance = context.instance;

  if (!viewportElement || !stageElement || !instance) {
    return;
  }

  const padding = mode === 'fullscreen' ? 48 : 32;
  const viewportWidth = Math.max(viewportElement.clientWidth - padding, 1);
  const viewportHeight = Math.max(viewportElement.clientHeight - padding, 1);
  prepareSvg(stageElement);
  const { x: contentX, y: contentY, width, height } = metrics;

  const fitScale = Math.min(viewportWidth / width, viewportHeight / height);
  const nextScale = allowShrink ? fitScale : Math.max(fitScale, 1);
  const safeScale = Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, safeScale));
  const targetWidth = width * scale;
  const targetHeight = height * scale;
  const x = (viewportElement.clientWidth - targetWidth) / 2 - (contentX * scale);
  const y = (viewportElement.clientHeight - targetHeight) / 2 - (contentY * scale);

  instance.zoom(scale, { animate: false, force: true });
  instance.pan(x, y, { animate: false, force: true });
};

const resetToStart = (mode) => {
  const context = getContext(mode);
  const viewportElement = context.viewport.value;
  const stageElement = context.stage.value;
  const instance = context.instance;

  if (!viewportElement || !stageElement || !instance) {
    return;
  }

  const metrics = prepareSvg(stageElement) || getContentMetrics(stageElement);
  const scale = clamp(
    mode === 'fullscreen' ? FULLSCREEN_START_SCALE : INLINE_START_SCALE,
    MIN_SCALE,
    MAX_SCALE
  );
  const x = mode === 'fullscreen' ? FULLSCREEN_START_X : INLINE_START_X;
  const y = mode === 'fullscreen' ? FULLSCREEN_START_Y : INLINE_START_Y;

  instance.zoom(scale, { animate: false, force: true });
  instance.pan(
    x,
    y,
    { animate: false, force: true }
  );
};

const scheduleResetToStart = (mode) => {
  const context = getContext(mode);

  if (context.resetFrame) {
    cancelAnimationFrame(context.resetFrame);
  }

  context.resetFrame = requestAnimationFrame(() => {
    context.resetFrame = requestAnimationFrame(() => {
      context.resetFrame = null;
      resetToStart(mode);
    });
  });
};

const getViewportCenterPoint = (viewportElement) => {
  const rect = viewportElement?.getBoundingClientRect();

  if (!rect) {
    return null;
  }

  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2
  };
};

const zoomAtViewportCenter = (direction) => {
  const mode = isFullscreen.value ? 'fullscreen' : 'inline';
  const context = getContext(mode);
  const instance = context.instance;
  const viewportElement = context.viewport.value;

  if (!instance || !viewportElement) {
    return;
  }

  const centerPoint = getViewportCenterPoint(viewportElement);

  if (!centerPoint) {
    return;
  }

  const scale = instance.getScale();
  const nextScale = scale * Math.exp(direction * BUTTON_ZOOM_STEP);

  instance.zoomToPoint(nextScale, centerPoint, { animate: true });
};

const zoomIn = () => {
  zoomAtViewportCenter(1);
};

const zoomOut = () => {
  zoomAtViewportCenter(-1);
};

const resetView = () => {
  resetToStart(isFullscreen.value ? 'fullscreen' : 'inline');
};

const destroyPanzoom = (mode) => {
  const context = getContext(mode);
  const viewportElement = context.viewport.value;

  if (viewportElement && context.wheelHandler) {
    viewportElement.removeEventListener('wheel', context.wheelHandler);
  }

  if (viewportElement && context.pointerDownHandler) {
    viewportElement.removeEventListener('pointerdown', context.pointerDownHandler);
  }

  if (viewportElement && context.pointerUpHandler) {
    viewportElement.removeEventListener('pointerup', context.pointerUpHandler);
    viewportElement.removeEventListener('pointercancel', context.pointerUpHandler);
  }

  if (context.pointerUpHandler) {
    window.removeEventListener('pointerup', context.pointerUpHandler);
  }

  if (context.windowBlurHandler) {
    window.removeEventListener('blur', context.windowBlurHandler);
  }

  context.instance?.destroy();
  context.instance = null;
  context.wheelHandler = null;
  context.pointerDownHandler = null;
  context.pointerUpHandler = null;
  context.windowBlurHandler = null;

  if (context.resetFrame) {
    cancelAnimationFrame(context.resetFrame);
    context.resetFrame = null;
  }
};

const initPanzoom = async (mode) => {
  const context = getContext(mode);
  const viewportElement = context.viewport.value;
  const stageElement = context.stage.value;

  destroyPanzoom(mode);

  if (!props.svg || !viewportElement || !stageElement) {
    return;
  }

  await nextTick();

  if (!stageElement.querySelector('svg')) {
    return;
  }

  prepareSvg(stageElement);

  context.instance = Panzoom(stageElement, {
    minScale: MIN_SCALE,
    maxScale: MAX_SCALE,
    step: 0.2,
    animate: true,
    canvas: true,
    pinchAndPan: true,
    touchAction: 'none'
  });

  context.wheelHandler = (event) => {
    event.preventDefault();
    context.instance?.zoomWithWheel(event);
  };

  context.pointerDownHandler = (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    viewportElement.classList.add('is-dragging');
  };

  context.pointerUpHandler = () => {
    viewportElement.classList.remove('is-dragging');
  };

  context.windowBlurHandler = () => {
    viewportElement.classList.remove('is-dragging');
  };

  viewportElement.addEventListener('wheel', context.wheelHandler, { passive: false });
  viewportElement.addEventListener('pointerdown', context.pointerDownHandler);
  viewportElement.addEventListener('pointerup', context.pointerUpHandler);
  viewportElement.addEventListener('pointercancel', context.pointerUpHandler);
  window.addEventListener('pointerup', context.pointerUpHandler);
  window.addEventListener('blur', context.windowBlurHandler);

  resetToStart(mode);
  scheduleResetToStart(mode);
};

const openFullscreen = async () => {
  if (!props.fullscreenEnabled || !props.svg) {
    return;
  }

  isFullscreen.value = true;
  document.body.style.overflow = 'hidden';
  await nextTick();
  initPanzoom('fullscreen');
};

const closeFullscreen = () => {
  isFullscreen.value = false;
  document.body.style.overflow = '';
  destroyPanzoom('fullscreen');
};

watch(
  () => props.svg,
  async () => {
    await nextTick();
    initPanzoom('inline');
    if (isFullscreen.value) {
      initPanzoom('fullscreen');
    }
  },
  { immediate: true }
);

watch(isFullscreen, async (value) => {
  if (!value) {
    return;
  }

  await nextTick();
  initPanzoom('fullscreen');
});

onBeforeUnmount(() => {
  destroyPanzoom('inline');
  destroyPanzoom('fullscreen');
  document.body.style.overflow = '';
});
</script>

<template>
  <div class="flowchart-viewer">
    <div class="flowchart-viewer__toolbar">
      <div class="flowchart-viewer__hint">
        <span>Drag to pan</span>
        <span>|</span>
        <span>Scroll or pinch to zoom</span>
      </div>
      <div class="flowchart-viewer__actions">
        <button type="button" class="viewer-btn" @click="zoomOut" :disabled="!hasSvg">−</button>
        <button type="button" class="viewer-btn" @click="zoomIn" :disabled="!hasSvg">+</button>
        <button type="button" class="viewer-btn" @click="resetView" :disabled="!hasSvg">Reset</button>
        <button
          v-if="fullscreenEnabled"
          type="button"
          class="viewer-btn viewer-btn--primary"
          @click="openFullscreen"
          :disabled="!hasSvg"
        >
          Fullscreen
        </button>
      </div>
    </div>

    <div ref="inlineViewport" class="flowchart-viewer__viewport" :style="{ '--viewer-height': embeddedHeight }">
      <div ref="inlineStage" class="flowchart-viewer__stage" v-html="svg"></div>
    </div>

    <p class="flowchart-viewer__note">Use fullscreen on phones for easier pinch-and-pan navigation.</p>

    <Teleport to="body">
      <div v-if="isFullscreen" class="flowchart-viewer__overlay" @click.self="closeFullscreen">
        <div class="flowchart-viewer__overlay-card">
          <div class="flowchart-viewer__overlay-header">
            <div>
              <p class="flowchart-viewer__overlay-label">Interactive Viewer</p>
              <h3 class="flowchart-viewer__overlay-title">{{ title }}</h3>
            </div>
            <div class="flowchart-viewer__actions flowchart-viewer__actions--overlay">
              <button type="button" class="viewer-btn" @click="zoomOut">−</button>
              <button type="button" class="viewer-btn" @click="zoomIn">+</button>
              <button type="button" class="viewer-btn" @click="resetView">Reset</button>
              <button type="button" class="viewer-btn viewer-btn--primary" @click="closeFullscreen">Close</button>
            </div>
          </div>

          <div ref="fullscreenViewport" class="flowchart-viewer__viewport flowchart-viewer__viewport--fullscreen">
            <div ref="fullscreenStage" class="flowchart-viewer__stage" v-html="svg"></div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.flowchart-viewer {
  width: 100%;
}

.flowchart-viewer__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.flowchart-viewer__hint {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  color: #6c757d;
  font-size: 0.95rem;
}

.flowchart-viewer__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.viewer-btn {
  border: 1px solid #d0d7de;
  background: #fff;
  color: #1f2937;
  border-radius: 999px;
  padding: 0.45rem 0.95rem;
  font-size: 0.95rem;
  line-height: 1;
  transition: all 0.2s ease;
}

.viewer-btn:hover:not(:disabled) {
  border-color: #0d6efd;
  color: #0d6efd;
}

.viewer-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.viewer-btn--primary {
  background: #0d6efd;
  border-color: #0d6efd;
  color: #fff;
}

.viewer-btn--primary:hover:not(:disabled) {
  background: #0b5ed7;
  border-color: #0b5ed7;
  color: #fff;
}

.flowchart-viewer__viewport {
  --viewer-height: 34rem;
  position: relative;
  width: 100%;
  min-height: min(var(--viewer-height), 70vh);
  height: min(var(--viewer-height), 70vh);
  overflow: hidden;
  border: 1px solid #dfe3e8;
  border-radius: 16px;
  background:
    radial-gradient(circle at 1px 1px, rgba(13, 110, 253, 0.12) 1px, transparent 0) 0 0 / 24px 24px,
    #fff;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: move;
  cursor: grab;
  cursor: -webkit-grab;
}

.flowchart-viewer__viewport.is-dragging {
  cursor: move;
  cursor: grabbing;
  cursor: -webkit-grabbing;
}

.flowchart-viewer__viewport :deep(svg),
.flowchart-viewer__viewport :deep(svg *) {
  cursor: inherit;
}

.flowchart-viewer__viewport--fullscreen {
  height: calc(100vh - 12rem);
  min-height: 26rem;
}

.flowchart-viewer__stage {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  max-width: none;
  transform-origin: top left;
  will-change: transform;
}

.flowchart-viewer__stage :deep(svg) {
  display: block;
  width: auto !important;
  max-width: none !important;
  height: auto !important;
}

.flowchart-viewer__stage :deep(.label),
.flowchart-viewer__stage :deep(foreignObject) {
  pointer-events: none;
}

.flowchart-viewer__note {
  margin-top: 0.75rem;
  margin-bottom: 0;
  color: #6c757d;
  font-size: 0.95rem;
}

.flowchart-viewer__overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(15, 23, 42, 0.75);
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.flowchart-viewer__overlay-card {
  width: min(96vw, 1400px);
  height: min(92vh, 960px);
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.flowchart-viewer__overlay-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.flowchart-viewer__overlay-label {
  margin: 0;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6c757d;
}

.flowchart-viewer__overlay-title {
  margin: 0.15rem 0 0;
  font-size: 1.5rem;
}

@media (max-width: 768px) {
  .flowchart-viewer__toolbar,
  .flowchart-viewer__overlay-header {
    flex-direction: column;
    align-items: stretch;
  }

  .flowchart-viewer__actions,
  .flowchart-viewer__actions--overlay {
    justify-content: flex-start;
  }

  .flowchart-viewer__viewport {
    min-height: min(var(--viewer-height), 60vh);
    height: min(var(--viewer-height), 60vh);
  }

  .flowchart-viewer__overlay {
    padding: 0.75rem;
  }

  .flowchart-viewer__overlay-card {
    width: 100%;
    height: 100%;
    border-radius: 18px;
    padding: 1rem;
  }

  .flowchart-viewer__viewport--fullscreen {
    height: calc(100vh - 13rem);
    min-height: 20rem;
  }
}
</style>
