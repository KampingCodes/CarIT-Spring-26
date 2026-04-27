<script setup>
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
const viewerAriaLabel = computed(() => `${props.title || 'Flowchart'} viewer`);
const dotsPatternUrl = `${import.meta.env.BASE_URL}dots.png`;
const viewerThemeStyle = computed(() => ({
  '--flowchart-dots-image': `url(${dotsPatternUrl})`,
  '--flowchart-color-text-primary': 'var(--color-text-primary, #0d0d14)',
  '--flowchart-color-text-secondary': 'var(--color-text-secondary, #3c3c50)',
  '--flowchart-color-background-primary': 'var(--color-surface, #ffffff)',
  '--flowchart-color-background-secondary': 'var(--color-diagram-surface, #f8f9fa)',
  '--flowchart-color-background-secondary-hover': 'var(--color-surface-raised, #f0f2f6)',
  '--flowchart-color-border-tertiary': 'var(--color-border, #e2e4ec)',
  '--flowchart-color-border-diagram': 'var(--color-diagram-border, #e9ecef)',
  '--flowchart-color-accent': 'var(--color-brand, #407BFF)',
  '--flowchart-color-accent-hover': 'var(--color-brand-hover, #5489ff)',
  '--flowchart-color-accent-contrast': '#ffffff',
  '--flowchart-shadow': 'var(--color-card-shadow, rgba(0, 0, 0, 0.08))',
  '--flowchart-overlay': 'rgba(15, 23, 42, 0.7)'
}));
const defaultFitPadding = 32;
const defaultFitScaleFactor = 1.12;
const minZoomScale = 0.1;
const maxZoomScale = 6;
const wheelZoomSensitivity = 0.0028;
const wheelZoomDeltaLimit = 240;
const keyboardZoomFactor = 1.18;
const keyboardPanStep = 72;
const pointerDragThreshold = 6;
const clickSuppressionMs = 240;
const stageViewportOverscan = 1.5;

function createViewerContext(name, viewportRef, stageRef) {
  return {
    name,
    viewportRef,
    stageRef,
    svgElement: null,
    contentLayout: null,
    cleanup: [],
    rafIds: [],
    scale: 1,
    translateX: 0,
    translateY: 0,
    activePointers: new Map(),
    lastSinglePointerPosition: null,
    pointerStartPosition: null,
    dragDistance: 0,
    suppressClickUntil: 0
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

function updateTransform(context) {
  const stage = context.stageRef.value;
  if (!stage) {
    return;
  }

  stage.style.transform = `matrix(${context.scale}, 0, 0, ${context.scale}, ${context.translateX}, ${context.translateY})`;
}

function resetContext(context) {
  cancelPendingFrames(context);
  removeCleanup(context);
  context.svgElement = null;
  context.contentLayout = null;
  context.scale = 1;
  context.translateX = 0;
  context.translateY = 0;
  context.activePointers.clear();
  context.lastSinglePointerPosition = null;
  context.pointerStartPosition = null;
  context.dragDistance = 0;
  context.suppressClickUntil = 0;

  const viewport = context.viewportRef.value;
  if (viewport) {
    viewport.classList.remove('is-dragging');
  }

  const stage = context.stageRef.value;
  if (stage) {
    stage.innerHTML = '';
    stage.style.width = '0px';
    stage.style.height = '0px';
    stage.style.transform = 'matrix(1, 0, 0, 1, 0, 0)';
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

    const onClick = () => {
      if (Date.now() < context.suppressClickUntil) {
        return;
      }

      emitNodeActivation(nodeElement);
    };
    const onFocus = () => {
      if (Date.now() < context.suppressClickUntil) {
        return;
      }

      emitNodeActivation(nodeElement);
    };
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

function getWheelDelta(event, viewportHeight) {
  if (event.deltaMode === 1) {
    return event.deltaY * 16;
  }

  if (event.deltaMode === 2) {
    return event.deltaY * viewportHeight;
  }

  return event.deltaY;
}

function getDistance(points) {
  if (points.length < 2) {
    return 0;
  }

  const [firstPoint, secondPoint] = points;
  return Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y);
}

function getMidpoint(points) {
  if (!points.length) {
    return { x: 0, y: 0 };
  }

  if (points.length === 1) {
    return points[0];
  }

  const [firstPoint, secondPoint] = points;
  return {
    x: (firstPoint.x + secondPoint.x) / 2,
    y: (firstPoint.y + secondPoint.y) / 2
  };
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

function zoomToPoint(context, nextScale, focalPoint) {
  const scale = clamp(nextScale, minZoomScale, maxZoomScale);
  const contentX = (focalPoint.x - context.translateX) / context.scale;
  const contentY = (focalPoint.y - context.translateY) / context.scale;

  context.scale = scale;
  context.translateX = focalPoint.x - contentX * scale;
  context.translateY = focalPoint.y - contentY * scale;
  updateTransform(context);
}

function panBy(context, deltaX, deltaY) {
  context.translateX += deltaX;
  context.translateY += deltaY;
  updateTransform(context);
}

function bindInteractions(context) {
  const viewport = context.viewportRef.value;
  const stage = context.stageRef.value;
  if (!viewport || !stage) {
    return;
  }

  const stopDragging = () => {
    if (!context.activePointers.size) {
      viewport.classList.remove('is-dragging');
      context.lastSinglePointerPosition = null;
      context.pointerStartPosition = null;
      context.dragDistance = 0;
    }
  };

  const onWheel = (event) => {
    event.preventDefault();
    viewport.focus({ preventScroll: true });

    const limitedDelta = clamp(getWheelDelta(event, viewport.clientHeight), -wheelZoomDeltaLimit, wheelZoomDeltaLimit);
    const nextScale = context.scale * Math.exp(-limitedDelta * wheelZoomSensitivity);
    zoomToPoint(context, nextScale, getFocalPoint(context, event));
  };

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    const point = getFocalPoint(context, event);
    context.activePointers.set(event.pointerId, point);
    viewport.classList.add('is-dragging');
    viewport.focus({ preventScroll: true });
    viewport.setPointerCapture?.(event.pointerId);

    if (context.activePointers.size === 1) {
      context.lastSinglePointerPosition = point;
      context.pointerStartPosition = point;
      context.dragDistance = 0;
      return;
    }

    context.lastSinglePointerPosition = null;
    context.dragDistance = pointerDragThreshold;
    context.suppressClickUntil = Date.now() + clickSuppressionMs;
  };

  const onPointerMove = (event) => {
    if (!context.activePointers.has(event.pointerId)) {
      return;
    }

    const previousPoints = Array.from(context.activePointers.values());
    const nextPoint = getFocalPoint(context, event);
    context.activePointers.set(event.pointerId, nextPoint);
    const nextPoints = Array.from(context.activePointers.values());

    if (nextPoints.length === 1) {
      const previousPoint = context.lastSinglePointerPosition || nextPoint;
      const deltaX = nextPoint.x - previousPoint.x;
      const deltaY = nextPoint.y - previousPoint.y;

      if (deltaX || deltaY) {
        panBy(context, deltaX, deltaY);
      }

      if (context.pointerStartPosition) {
        context.dragDistance = Math.max(
          context.dragDistance,
          Math.hypot(nextPoint.x - context.pointerStartPosition.x, nextPoint.y - context.pointerStartPosition.y)
        );
        if (context.dragDistance >= pointerDragThreshold) {
          context.suppressClickUntil = Date.now() + clickSuppressionMs;
        }
      }

      context.lastSinglePointerPosition = nextPoint;
      return;
    }

    if (previousPoints.length < 2) {
      return;
    }

    const previousMidpoint = getMidpoint(previousPoints);
    const nextMidpoint = getMidpoint(nextPoints);
    const previousDistance = getDistance(previousPoints);
    const nextDistance = getDistance(nextPoints);

    panBy(context, nextMidpoint.x - previousMidpoint.x, nextMidpoint.y - previousMidpoint.y);
    if (previousDistance > 0 && nextDistance > 0) {
      zoomToPoint(context, context.scale * (nextDistance / previousDistance), nextMidpoint);
    }

    context.dragDistance = pointerDragThreshold;
    context.suppressClickUntil = Date.now() + clickSuppressionMs;
  };

  const onPointerEnd = (event) => {
    if (!context.activePointers.has(event.pointerId)) {
      return;
    }

    context.activePointers.delete(event.pointerId);
    viewport.releasePointerCapture?.(event.pointerId);

    if (context.dragDistance >= pointerDragThreshold) {
      context.suppressClickUntil = Date.now() + clickSuppressionMs;
    }

    if (context.activePointers.size === 1) {
      context.lastSinglePointerPosition = Array.from(context.activePointers.values())[0];
      context.pointerStartPosition = context.lastSinglePointerPosition;
      context.dragDistance = 0;
      return;
    }

    stopDragging();
  };

  const onClickCapture = (event) => {
    if (Date.now() < context.suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const onKeydown = (event) => {
    if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      panBy(context, keyboardPanStep, 0);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      panBy(context, -keyboardPanStep, 0);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      panBy(context, 0, keyboardPanStep);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      panBy(context, 0, -keyboardPanStep);
      return;
    }

    if (event.key === '+' || event.key === '=' || event.key === 'Add') {
      event.preventDefault();
      zoomToPoint(context, context.scale * keyboardZoomFactor, {
        x: viewport.clientWidth / 2,
        y: viewport.clientHeight / 2
      });
      return;
    }

    if (event.key === '-' || event.key === '_' || event.key === 'Subtract') {
      event.preventDefault();
      zoomToPoint(context, context.scale / keyboardZoomFactor, {
        x: viewport.clientWidth / 2,
        y: viewport.clientHeight / 2
      });
      return;
    }

    if (event.key === '0' || event.key === 'Numpad0') {
      event.preventDefault();
      fitDiagram(context);
    }
  };

  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerEnd);
  viewport.addEventListener('pointercancel', onPointerEnd);
  viewport.addEventListener('keydown', onKeydown);
  stage.addEventListener('click', onClickCapture, true);

  context.cleanup.push(() => viewport.removeEventListener('wheel', onWheel));
  context.cleanup.push(() => viewport.removeEventListener('pointerdown', onPointerDown));
  context.cleanup.push(() => viewport.removeEventListener('pointermove', onPointerMove));
  context.cleanup.push(() => viewport.removeEventListener('pointerup', onPointerEnd));
  context.cleanup.push(() => viewport.removeEventListener('pointercancel', onPointerEnd));
  context.cleanup.push(() => viewport.removeEventListener('keydown', onKeydown));
  context.cleanup.push(() => stage.removeEventListener('click', onClickCapture, true));
}

function fitDiagram(context, padding = defaultFitPadding) {
  const viewport = context.viewportRef.value;
  const stage = context.stageRef.value;
  const svgElement = context.svgElement || stage?.querySelector('svg');

  if (!viewport || !stage || !svgElement) {
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

  context.scale = scale;
  context.translateX = desiredLeft - contentOffsetX * scale;
  context.translateY = desiredTop - contentOffsetY * scale;
  updateTransform(context);
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
  bindInteractions(context);
  scheduleFit(context);
}

async function rebuildContext(context) {
  await nextTick();
  mountSvgIntoContext(context);
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
  if (inlineContext.svgElement) {
    scheduleFit(inlineContext);
  }

  if (isFullscreen.value && fullscreenContext.svgElement) {
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
      fullscreenViewportRef.value?.focus?.({ preventScroll: true });
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
  <div class="flowchart-viewer" :style="viewerThemeStyle">
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
      tabindex="0"
      :aria-label="viewerAriaLabel"
    >
      <div ref="inlineStageRef" class="flowchart-stage"></div>
      <div v-if="!hasSvg" class="flowchart-empty-state">Flowchart unavailable.</div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="isFullscreen"
      class="flowchart-fullscreen-overlay"
      :style="viewerThemeStyle"
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

        <div
          ref="fullscreenViewportRef"
          class="flowchart-viewport flowchart-viewport--fullscreen"
          tabindex="0"
          :aria-label="viewerAriaLabel"
        >
          <div ref="fullscreenStageRef" class="flowchart-stage"></div>
          <div v-if="!hasSvg" class="flowchart-empty-state">Flowchart unavailable.</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.flowchart-viewer {
  --flowchart-color-text-primary: var(--color-text-primary, #0d0d14);
  --flowchart-color-text-secondary: var(--color-text-secondary, #3c3c50);
  --flowchart-color-background-primary: var(--color-surface, #ffffff);
  --flowchart-color-background-secondary: var(--color-diagram-surface, #f8f9fa);
  --flowchart-color-background-secondary-hover: var(--color-surface-raised, #f0f2f6);
  --flowchart-color-border-tertiary: var(--color-border, #e2e4ec);
  --flowchart-color-border-diagram: var(--color-diagram-border, #e9ecef);
  --flowchart-color-accent: var(--color-brand, #407BFF);
  --flowchart-color-accent-hover: var(--color-brand-hover, #5489ff);
  --flowchart-color-accent-contrast: #ffffff;
  --flowchart-shadow: var(--color-card-shadow, rgba(0, 0, 0, 0.08));
  --flowchart-overlay: rgba(15, 23, 42, 0.7);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--flowchart-color-border-tertiary);
  border-radius: 16px;
  background: var(--flowchart-color-background-primary);
  box-shadow: 0 12px 32px var(--flowchart-shadow);
  color: var(--flowchart-color-text-primary);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  margin-bottom: 5rem;
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
}

.flowchart-toolbar-button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 0.5px solid var(--flowchart-color-border-tertiary);
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
  box-shadow: 0 2px 6px var(--flowchart-shadow);
  transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.flowchart-toolbar-button:hover:not(:disabled),
.flowchart-toolbar-button:focus-visible:not(:disabled) {
  background: var(--flowchart-color-background-secondary-hover);
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

.flowchart-toolbar-button--featured:hover:not(:disabled),
.flowchart-toolbar-button--featured:focus-visible:not(:disabled) {
  background: var(--flowchart-color-accent-hover);
  border-color: var(--flowchart-color-accent-hover);
}

.flowchart-viewport {
  position: relative;
  overflow: hidden;
  min-height: var(--flowchart-embedded-height, 34rem);
  height: var(--flowchart-embedded-height, 34rem);
  border: 1px solid var(--flowchart-color-border-diagram);
  border-radius: 12px;
  background-color: var(--flowchart-color-background-secondary);
  background-image: var(--flowchart-dots-image);
  background-repeat: repeat;
  background-size: 24px 24px;
  cursor: grab;
  user-select: none;
  touch-action: none;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

.flowchart-viewport:focus-visible {
  outline: 2px solid var(--flowchart-color-accent);
  outline-offset: 2px;
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
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 20px;
  border: 1px solid var(--flowchart-color-border-tertiary);
  background-color: var(--flowchart-color-background-primary);
  box-shadow: 0 24px 64px var(--flowchart-shadow);
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
  font-size: 18px;
  line-height: 1.3;
  font-weight: 500;
  color: var(--flowchart-color-text-primary);
}

.flowchart-viewport--fullscreen {
  background-color: var(--flowchart-color-background-secondary);
  background-image: var(--flowchart-dots-image);
}

.flowchart-viewport :deep(svg) {
  display: block;
  overflow: visible;
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
