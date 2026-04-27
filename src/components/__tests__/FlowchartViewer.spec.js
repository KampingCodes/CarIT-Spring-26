import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import FlowchartViewer from '../FlowchartViewer.vue';

const sampleSvg = `
  <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
    <g class="node" id="start-node">
      <rect x="20" y="20" width="80" height="40" rx="8"></rect>
      <text class="nodeLabel" x="60" y="45" text-anchor="middle">Start</text>
    </g>
  </svg>
`;

function setViewportMetrics(element, width = 420, height = 280) {
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    get: () => width
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    get: () => height
  });
  element.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height
  });
}

async function settleViewer(wrapper, selector = '.flowchart-viewport') {
  const viewport = wrapper.get(selector).element;
  return settleViewportElement(viewport);
}

async function settleViewportElement(viewport) {
  setViewportMetrics(viewport);
  window.dispatchEvent(new Event('resize'));
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
  return viewport;
}

function dispatchPointer(element, type, options) {
  element.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    ...options
  }));
}

describe('FlowchartViewer', () => {
  it('supports keyboard zoom, pan, and reset from the viewport', async () => {
    const wrapper = mount(FlowchartViewer, {
      attachTo: document.body,
      props: {
        svg: sampleSvg,
        title: 'Diagnostics'
      }
    });

    const viewport = await settleViewer(wrapper);
    const stage = wrapper.get('.flowchart-stage').element;
    await wrapper.get('.flowchart-toolbar-button').trigger('click');
    await nextTick();
    const initialTransform = stage.style.transform;

    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    expect(stage.style.transform).not.toBe(initialTransform);

    const zoomedTransform = stage.style.transform;
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(stage.style.transform).not.toBe(zoomedTransform);

    await wrapper.get('.flowchart-toolbar-button').trigger('click');
    expect(stage.style.transform).toBe(initialTransform);
  });

  it('zooms with wheel input and pans with pointer drag', async () => {
    const wrapper = mount(FlowchartViewer, {
      attachTo: document.body,
      props: {
        svg: sampleSvg
      }
    });

    const viewport = await settleViewer(wrapper);
    const stage = wrapper.get('.flowchart-stage').element;
    await wrapper.get('.flowchart-toolbar-button').trigger('click');
    await nextTick();
    const initialTransform = stage.style.transform;

    viewport.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 180,
      clientY: 120,
      deltaY: -60
    }));
    expect(stage.style.transform).not.toBe(initialTransform);

    const zoomedTransform = stage.style.transform;
    dispatchPointer(viewport, 'pointerdown', { pointerId: 1, clientX: 160, clientY: 120, button: 0 });
    dispatchPointer(viewport, 'pointermove', { pointerId: 1, clientX: 200, clientY: 150, button: 0 });
    dispatchPointer(viewport, 'pointerup', { pointerId: 1, clientX: 200, clientY: 150, button: 0 });
    expect(stage.style.transform).not.toBe(zoomedTransform);
  });

  it('emits node activation from node keyboard interaction', async () => {
    const wrapper = mount(FlowchartViewer, {
      attachTo: document.body,
      props: {
        svg: sampleSvg
      }
    });

    await settleViewer(wrapper);
    const node = wrapper.get('.node').element;

    node.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const emissions = wrapper.emitted('node-activate');
    expect(emissions).toBeTruthy();
    expect(emissions.at(-1)?.[0]).toMatchObject({
      nodeId: 'start-node',
      label: 'Start',
      rawId: 'start-node'
    });
  });

  it('opens fullscreen, supports touch pinch, and closes on Escape', async () => {
    const wrapper = mount(FlowchartViewer, {
      attachTo: document.body,
      props: {
        svg: sampleSvg,
        title: 'Diagnostics'
      }
    });

    await settleViewer(wrapper);
    const buttons = wrapper.findAll('button');
    await buttons[1].trigger('click');
    await nextTick();

    const fullscreenViewport = document.body.querySelector('.flowchart-viewport--fullscreen');
    const fullscreenStage = document.body.querySelector('.flowchart-fullscreen-card .flowchart-stage');
    const fullscreenResetButton = document.body.querySelector('.flowchart-fullscreen-card .flowchart-toolbar-button');

    expect(fullscreenViewport).toBeTruthy();
    expect(fullscreenStage).toBeTruthy();
    expect(fullscreenResetButton).toBeTruthy();

    await settleViewportElement(fullscreenViewport);
    fullscreenResetButton.click();
    await nextTick();
    const initialTransform = fullscreenStage.style.transform;

    dispatchPointer(fullscreenViewport, 'pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 120,
      clientY: 140,
      isPrimary: true
    });
    dispatchPointer(fullscreenViewport, 'pointerdown', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 220,
      clientY: 140,
      isPrimary: false
    });
    dispatchPointer(fullscreenViewport, 'pointermove', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 260,
      clientY: 140,
      isPrimary: false
    });
    dispatchPointer(fullscreenViewport, 'pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 120,
      clientY: 140,
      isPrimary: true
    });
    dispatchPointer(fullscreenViewport, 'pointerup', {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 260,
      clientY: 140,
      isPrimary: false
    });

    expect(fullscreenStage.style.transform).not.toBe(initialTransform);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(wrapper.find('.flowchart-fullscreen-overlay').exists()).toBe(false);
  });
});