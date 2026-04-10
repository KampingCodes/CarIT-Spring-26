<script setup>
import Panzoom from '@panzoom/panzoom';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  svg: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
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

const emit = defineEmits(['node-activate']);

const inlineViewportRef = ref(null);
const inlineStageRef = ref(null);
const fullscreenViewportRef = ref(null);
const fullscreenStageRef = ref(null);

const isFullscreen = ref(false);
const bodyOverflow = ref('');
const bodyOverflowX = ref('');
const bodyOverflowY = ref('');
const htmlOverflow = ref('');
const htmlOverflowX = ref('');
const htmlOverflowY = ref('');

const hasSvg = computed(() => typeof props.svg === 'string' && props.svg.trim().length > 0);
const dotsPatternUrl = `${import.meta.env.BASE_URL}dots.png`;
const defaultFitPadding = 32;
const defaultFitScaleFactor = 1.12;
const minZoomScale = 0.1;
const maxZoomScale = 6;
const wheelZoomSensitivity = 0.0035;
const wheelZoomDeltaLimit = 160;
const stageViewportOverscan = 1.5;

function createViewerContext(name, viewportRef, stageRef) {
  return {
    name,
    viewportRef,
    stageRef,
    panzoom: null,
    svgElement: null,
    contentLayout: null,
    cleanup: [],
    rafIds: [],
    lastPointerClientPoint: null
  };
}

const inlineContext = createViewerContext('inline', inlineViewportRef, inlineStageRef);
const fullscreenContext = createViewerContext('fullscreen', fullscreenViewportRef, fullscreenStageRef);

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function removeCleanup(context) {
  while (context.cleanup.length) {
    const cleanup = context.cleanup.pop();
    try {
      cleanup?.();
    } catch {
      // noop
    }
  }
}

function cancelPendingFrames(context) {
  context.rafIds.forEach((frameId) => cancelAnimationFrame(frameId));
  context.rafIds = [];
}

function destroyPanzoom(context) {
  if (context.panzoom) {
    context.panzoom.destroy();
    context.panzoom = null;
  }
}

function resetContext(context) {
  cancelPendingFrames(context);
  removeCleanup(context);
  destroyPanzoom(context);
  context.svgElement = null;
  context.contentLayout = null;
  context.lastPointerClientPoint = null;

  const viewport = context.viewportRef.value;
  if (viewport) {
    viewport.classList.remove('is-dragging');
  }

  const stage = context.stageRef.value;
  if (stage) {
    stage.innerHTML = '';
    stage.style.width = '0px';
    stage.style.height = '0px';
  }
}

function getContextBounds(svgElement) {
  const viewBox = svgElement?.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return {
      x: viewBox.x,
      y: viewBox.y,
      width: viewBox.width,
      height: viewBox.height
    };
  }

  try {
    const box = svgElement?.getBBox?.();
    if (box && box.width > 0 && box.height > 0) {
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height
      };
    }
  } catch {
    // getBBox can fail before layout is ready
  }

  const width = Number.parseFloat(svgElement?.getAttribute('width') || '0');
  const height = Number.parseFloat(svgElement?.getAttribute('height') || '0');

  if (width > 0 && height > 0) {
    return {
      x: 0,
      y: 0,
      width,
      height
    };
  }

  return null;
}

function getNodeLabel(nodeElement) {
  const labelElement = nodeElement.querySelector('.nodeLabel, .label, text');
  const label = labelElement?.textContent?.replace(/\s+/g, ' ').trim();
  return label || 'Flowchart node';
}

function emitNodeActivation(nodeElement) {
  const rawId = (nodeElement.getAttribute('id') || nodeElement.dataset.id || '').trim();
  const label = getNodeLabel(nodeElement);
  const nodeId = (nodeElement.dataset.id || rawId || label).trim();

  emit('node-activate', {
    nodeId,
    label,
    rawId
  });
}

function enhanceNodes(context) {
  const stage = context.stageRef.value;
  if (!stage) {
    return;
  }

  const nodes = Array.from(stage.querySelectorAll('.node'));
  nodes.forEach((nodeElement) => {
    const label = getNodeLabel(nodeElement);
    nodeElement.setAttribute('tabindex', '0');
    nodeElement.setAttribute('role', 'button');
    nodeElement.setAttribute('aria-label', label);
    nodeElement.classList.add('flowchart-node--interactive');

    const onClick = () => emitNodeActivation(nodeElement);
    const onFocus = () => emitNodeActivation(nodeElement);
    const onKeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        emitNodeActivation(nodeElement);
      }
    };

    nodeElement.addEventListener('click', onClick);
    nodeElement.addEventListener('focus', onFocus);
    nodeElement.addEventListener('keydown', onKeydown);

    context.cleanup.push(() => {
      nodeElement.removeEventListener('click', onClick);
      nodeElement.removeEventListener('focus', onFocus);
      nodeElement.removeEventListener('keydown', onKeydown);
    });
  });
}

function setExplicitDimensions(context, bounds) {
  const stage = context.stageRef.value;
  const viewport = context.viewportRef.value;
  const svgElement = context.svgElement;
  if (!stage || !viewport || !svgElement || !bounds) {
    return;
  }

  const contentWidth = Math.max(bounds.width, 1);
  const contentHeight = Math.max(bounds.height, 1);
  const stageWidth = Math.max(
    contentWidth + viewport.clientWidth * stageViewportOverscan * 2,
    viewport.clientWidth * (1 + stageViewportOverscan * 2),
    contentWidth
  );
  const stageHeight = Math.max(
    contentHeight + viewport.clientHeight * stageViewportOverscan * 2,
    viewport.clientHeight * (1 + stageViewportOverscan * 2),
    contentHeight
  );
  const contentOffsetX = (stageWidth - contentWidth) / 2;
  const contentOffsetY = (stageHeight - contentHeight) / 2;

  context.contentLayout = {
    contentWidth,
    contentHeight,
    contentOffsetX,
    contentOffsetY,
    stageWidth,
    stageHeight
  };

  stage.style.width = `${stageWidth}px`;
  stage.style.height = `${stageHeight}px`;

  if (!svgElement.viewBox?.baseVal?.width || !svgElement.viewBox?.baseVal?.height) {
    svgElement.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${contentWidth} ${contentHeight}`);
  }

  svgElement.setAttribute('width', `${contentWidth}`);
  svgElement.setAttribute('height', `${contentHeight}`);
  svgElement.style.width = `${contentWidth}px`;
  svgElement.style.height = `${contentHeight}px`;
  svgElement.style.position = 'absolute';
  svgElement.style.left = `${contentOffsetX}px`;
  svgElement.style.top = `${contentOffsetY}px`;
  svgElement.style.display = 'block';
  svgElement.style.overflow = 'visible';
}

function bindPanzoom(context) {
  const viewport = context.viewportRef.value;
  const stage = context.stageRef.value;
  if (!viewport || !stage) {
    return;
  }

  context.panzoom = Panzoom(stage, {
    minScale: minZoomScale,
    maxScale: maxZoomScale,
    origin: '0 0',
    canvas: true
  });

  const onWheel = (event) => {
    event.preventDefault();
    context.lastPointerClientPoint = {
      clientX: event.clientX,
      clientY: event.clientY
    };

    const currentScale = context.panzoom?.getScale?.();
    if (!currentScale) {
      return;
    }

    const deltaScale = event.deltaMode === 1
      ? event.deltaY * 16
      : event.deltaMode === 2
        ? event.deltaY * viewport.clientHeight
        : event.deltaY;

    const limitedDelta = clamp(deltaScale, -wheelZoomDeltaLimit, wheelZoomDeltaLimit);
    const nextScale = clamp(
      currentScale * Math.exp(-limitedDelta * wheelZoomSensitivity),
      minZoomScale,
      maxZoomScale
    );

    const focal = getFocalPoint(context, context.lastPointerClientPoint);
    context.panzoom?.zoom(nextScale, { animate: false, force: true, focal });
  };

  const onPointerMove = (event) => {
    context.lastPointerClientPoint = {
      clientX: event.clientX,
      clientY: event.clientY
    };
  };

  const onPointerLeave = () => {
    context.lastPointerClientPoint = null;
  };

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    context.lastPointerClientPoint = {
      clientX: event.clientX,
      clientY: event.clientY
    };
    viewport.classList.add('is-dragging');
  };

  const onPointerUp = () => {
    viewport.classList.remove('is-dragging');
  };

  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerleave', onPointerLeave);
  viewport.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  context.cleanup.push(() => viewport.removeEventListener('wheel', onWheel));
  context.cleanup.push(() => viewport.removeEventListener('pointermove', onPointerMove));
  context.cleanup.push(() => viewport.removeEventListener('pointerleave', onPointerLeave));
  context.cleanup.push(() => viewport.removeEventListener('pointerdown', onPointerDown));
  context.cleanup.push(() => window.removeEventListener('pointerup', onPointerUp));
  context.cleanup.push(() => window.removeEventListener('pointercancel', onPointerUp));
}

function fitDiagram(context, padding = defaultFitPadding) {
  const viewport = context.viewportRef.value;
  const stage = context.stageRef.value;
  const svgElement = context.svgElement || stage?.querySelector('svg');

  if (!viewport || !stage || !svgElement || !context.panzoom) {
    return false;
  }

  const viewportWidth = viewport.clientWidth;
  const viewportHeight = viewport.clientHeight;
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return false;
  }

  const bounds = getContextBounds(svgElement);
  if (!bounds) {
    return false;
  }

  context.svgElement = svgElement;
  setExplicitDimensions(context, bounds);

  const contentLayout = context.contentLayout;
  const contentWidth = contentLayout?.contentWidth || bounds.width;
  const contentHeight = contentLayout?.contentHeight || bounds.height;
  const contentOffsetX = contentLayout?.contentOffsetX || 0;
  const contentOffsetY = contentLayout?.contentOffsetY || 0;

  const fitScale = Math.min(
    Math.max(viewportWidth - padding, 1) / contentWidth,
    Math.max(viewportHeight - padding, 1) / contentHeight
  );

  const scale = clamp(
    fitScale * defaultFitScaleFactor,
    minZoomScale,
    maxZoomScale
  );

  const desiredLeft = (viewportWidth - contentWidth * scale) / 2;
  const desiredTop = (viewportHeight - contentHeight * scale) / 2;
  const x = desiredLeft / scale - contentOffsetX;
  const y = desiredTop / scale - contentOffsetY;

  context.panzoom.zoom(scale, { animate: false, force: true });
  context.panzoom.pan(x, y, { animate: false, force: true });
  return true;
}

function scheduleFit(context) {
  cancelPendingFrames(context);

  const frameOne = requestAnimationFrame(() => {
    const frameTwo = requestAnimationFrame(() => {
      context.rafIds = context.rafIds.filter((frameId) => frameId !== frameTwo);
      fitDiagram(context);
    });

    context.rafIds = context.rafIds.filter((frameId) => frameId !== frameOne);
    context.rafIds.push(frameTwo);
  });

  context.rafIds.push(frameOne);
}

function mountSvgIntoContext(context) {
  const stage = context.stageRef.value;
  if (!stage) {
    return;
  }

  resetContext(context);

  if (!hasSvg.value) {
    return;
  }

  stage.innerHTML = props.svg;
  const svgElement = stage.querySelector('svg');
  if (!svgElement) {
    stage.innerHTML = '';
    return;
  }

  context.svgElement = svgElement;
  svgElement.setAttribute('preserveAspectRatio', svgElement.getAttribute('preserveAspectRatio') || 'xMidYMid meet');
  svgElement.setAttribute('focusable', 'false');
  svgElement.setAttribute('aria-hidden', 'false');

  const bounds = getContextBounds(svgElement);
  if (bounds) {
    setExplicitDimensions(context, bounds);
  }

  enhanceNodes(context);
  bindPanzoom(context);
  scheduleFit(context);
}

async function rebuildContext(context) {
  await nextTick();
  mountSvgIntoContext(context);
}

function getFocalPoint(context, clientPoint) {
  const viewport = context.viewportRef.value;
  const rect = viewport?.getBoundingClientRect?.();

  if (!rect) {
    return { x: 0, y: 0 };
  }

  return {
    x: clamp(clientPoint.clientX - rect.left, 0, rect.width),
    y: clamp(clientPoint.clientY - rect.top, 0, rect.height)
  };
}

function resetView(context) {
  fitDiagram(context);
}

function lockBodyScroll() {
  bodyOverflow.value = document.body.style.overflow;
  bodyOverflowX.value = document.body.style.overflowX;
  bodyOverflowY.value = document.body.style.overflowY;
  htmlOverflow.value = document.documentElement.style.overflow;
  htmlOverflowX.value = document.documentElement.style.overflowX;
  htmlOverflowY.value = document.documentElement.style.overflowY;

  document.body.style.overflow = 'hidden';
  document.body.style.overflowX = 'hidden';
  document.body.style.overflowY = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.overflowX = 'hidden';
  document.documentElement.style.overflowY = 'hidden';
}

function restoreBodyScroll() {
  document.body.style.overflow = bodyOverflow.value;
  document.body.style.overflowX = bodyOverflowX.value;
  document.body.style.overflowY = bodyOverflowY.value;
  document.documentElement.style.overflow = htmlOverflow.value;
  document.documentElement.style.overflowX = htmlOverflowX.value;
  document.documentElement.style.overflowY = htmlOverflowY.value;
}

function closeFullscreen() {
  isFullscreen.value = false;
}

async function openFullscreen() {
  if (!props.fullscreenEnabled || !hasSvg.value || isFullscreen.value) {
    return;
  }

  isFullscreen.value = true;
}

function handleOverlayClick() {
  closeFullscreen();
}

function handleWindowResize() {
  if (inlineContext.panzoom) {
    scheduleFit(inlineContext);
  }

  if (isFullscreen.value && fullscreenContext.panzoom) {
    scheduleFit(fullscreenContext);
  }
}

function handleWindowKeydown(event) {
  if (event.key === 'Escape' && isFullscreen.value) {
    closeFullscreen();
  }
}

watch(
  () => props.svg,
  async () => {
    await rebuildContext(inlineContext);
    if (isFullscreen.value) {
      await rebuildContext(fullscreenContext);
    }
  },
  { flush: 'post' }
);

watch(
  () => isFullscreen.value,
  async (open) => {
    if (open) {
      lockBodyScroll();
      await rebuildContext(fullscreenContext);
      return;
    }

    resetContext(fullscreenContext);
    restoreBodyScroll();
  },
  { flush: 'post' }
);

onMounted(async () => {
  window.addEventListener('resize', handleWindowResize);
  window.addEventListener('keydown', handleWindowKeydown);
  await rebuildContext(inlineContext);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize);
  window.removeEventListener('keydown', handleWindowKeydown);
  resetContext(inlineContext);
  resetContext(fullscreenContext);
  restoreBodyScroll();
});
</script>

<template>
  <div class="flowchart-viewer" :style="{ '--flowchart-dots-image': `url(${dotsPatternUrl})` }">
    <div class="flowchart-toolbar" aria-label="Flowchart controls">
      <p class="flowchart-toolbar-hint">Drag to pan · Scroll to zoom</p>
      <div class="flowchart-toolbar-actions">
        <button
          type="button"
          class="flowchart-toolbar-button"
          :disabled="!hasSvg"
          @click="resetView(inlineContext)"
        >
          <span class="flowchart-toolbar-button-icon pi pi-refresh" aria-hidden="true"></span>
          <span>Reset</span>
        </button>
        <button
          v-if="fullscreenEnabled"
          type="button"
          class="flowchart-toolbar-button flowchart-toolbar-button--featured"
          :disabled="!hasSvg"
          @click="openFullscreen"
        >
          <span class="flowchart-toolbar-button-icon pi pi-window-maximize" aria-hidden="true"></span>
          <span>Fullscreen</span>
        </button>
      </div>
    </div>

    <div
      ref="inlineViewportRef"
      class="flowchart-viewport"
      :style="{ '--flowchart-embedded-height': embeddedHeight }"
    >
      <div ref="inlineStageRef" class="flowchart-stage"></div>
      <div v-if="!hasSvg" class="flowchart-empty-state">Flowchart unavailable.</div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="isFullscreen"
      class="flowchart-fullscreen-overlay"
      @click.self="handleOverlayClick"
    >
      <div class="flowchart-fullscreen-card" role="dialog" aria-modal="true" @click.stop>
        <div class="flowchart-fullscreen-header">
          <div class="flowchart-fullscreen-heading">
            <p class="flowchart-fullscreen-label">Interactive viewer</p>
            <h2 class="flowchart-fullscreen-title">{{ title || 'Flowchart viewer' }}</h2>
          </div>
          <div class="flowchart-toolbar-actions">
            <button
              type="button"
              class="flowchart-toolbar-button"
              :disabled="!hasSvg"
              @click="resetView(fullscreenContext)"
            >
              <span class="flowchart-toolbar-button-icon pi pi-refresh" aria-hidden="true"></span>
              <span>Reset</span>
            </button>
            <button
              type="button"
              class="flowchart-toolbar-button flowchart-toolbar-button--featured"
              :disabled="!hasSvg"
              @click="closeFullscreen"
            >
              <span class="flowchart-toolbar-button-icon pi pi-times" aria-hidden="true"></span>
              <span>Close</span>
            </button>
          </div>
        </div>

        <div ref="fullscreenViewportRef" class="flowchart-viewport flowchart-viewport--fullscreen">
          <div ref="fullscreenStageRef" class="flowchart-stage"></div>
          <div v-if="!hasSvg" class="flowchart-empty-state">Flowchart unavailable.</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.flowchart-viewer {
  --flowchart-color-text-primary: var(--color-text-primary, CanvasText);
  --flowchart-color-text-secondary: var(--color-text-secondary, GrayText);
  --flowchart-color-background-primary: var(--color-background-primary, Canvas);
  --flowchart-color-background-secondary: var(--color-background-secondary, Canvas);
  --flowchart-color-border-tertiary: var(--color-border-tertiary, GrayText);
  --flowchart-color-accent: var(--color-accent-primary, var(--color-text-primary, CanvasText));
  --flowchart-color-accent-contrast: var(--color-background-primary, Canvas);
  --flowchart-overlay: rgba(15, 23, 42, 0.7);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: transparent;
  color: var(--flowchart-color-text-primary);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.flowchart-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.flowchart-toolbar-hint,
.flowchart-fullscreen-label {
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  color: var(--flowchart-color-text-secondary);
}

.flowchart-toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.viewer-btn {
  border: 1px solid #d0d7de;
  background: #fff;
  color: #1f2937;
  border-radius: 999px;
  background: var(--flowchart-color-background-primary);
  color: var(--flowchart-color-text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  padding: 6px 14px;
  min-height: 32px;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease, opacity 0.2s ease;
}

.flowchart-toolbar-button:hover:not(:disabled),
.flowchart-toolbar-button:focus-visible:not(:disabled) {
  border-color: var(--flowchart-color-accent);
  outline: none;
}

.flowchart-toolbar-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.flowchart-toolbar-button-icon {
  font-size: 12px;
  line-height: 1;
}

.flowchart-toolbar-button--featured {
  background: var(--flowchart-color-accent);
  color: var(--flowchart-color-accent-contrast);
  border-color: var(--flowchart-color-accent);
}

.flowchart-viewport {
  position: relative;
  overflow: hidden;
  border: 1px solid #dfe3e8;
  border-radius: 16px;
  background:
    radial-gradient(circle at 1px 1px, rgba(13, 110, 253, 0.12) 1px, transparent 0) 0 0 / 24px 24px,
    #fff;
  touch-action: none;
  margin-bottom: 5rem;
}

.flowchart-viewport.is-dragging {
  cursor: grabbing;
}

.flowchart-viewport--fullscreen {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.flowchart-stage {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  transform-origin: top left;
  will-change: transform;
}

.flowchart-empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  text-align: center;
  font-size: 14px;
  font-weight: 400;
  color: var(--flowchart-color-text-secondary);
  pointer-events: none;
}

.flowchart-fullscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--flowchart-overlay);
}

.flowchart-fullscreen-card {
  width: min(96vw, 1400px);
  height: min(92vh, 960px);
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 20px;
  border: 0.5px solid var(--flowchart-color-border-tertiary);
  background: Canvas;
  background-color: var(--flowchart-color-background-primary, Canvas);
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.18);
}

.flowchart-fullscreen-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.flowchart-fullscreen-heading {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.flowchart-fullscreen-title {
  margin: 0;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6c757d;
}

.flowchart-viewport :deep(.flowchart-node--interactive) {
  cursor: pointer;
  outline: none;
}

.flowchart-viewport :deep(.flowchart-node--interactive:focus-visible) {
  outline: none;
}

.flowchart-viewport :deep(.flowchart-node--interactive:hover rect),
.flowchart-viewport :deep(.flowchart-node--interactive:hover polygon),
.flowchart-viewport :deep(.flowchart-node--interactive:hover path),
.flowchart-viewport :deep(.flowchart-node--interactive:focus-visible rect),
.flowchart-viewport :deep(.flowchart-node--interactive:focus-visible polygon),
.flowchart-viewport :deep(.flowchart-node--interactive:focus-visible path) {
  stroke: var(--flowchart-color-accent) !important;
  stroke-width: 2px !important;
}

@media (max-width: 768px) {
  .flowchart-toolbar,
  .flowchart-fullscreen-header {
    align-items: stretch;
  }

  .flowchart-toolbar-actions {
    justify-content: flex-start;
  }

  .flowchart-fullscreen-card {
    width: min(96vw, 1400px);
    height: min(94vh, 960px);
    padding: 1rem;
  }
}
</style>
