import { afterEach, vi } from 'vitest';

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

class PointerEventMock extends MouseEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.pointerId = options.pointerId ?? 1;
    this.pointerType = options.pointerType ?? 'mouse';
    this.isPrimary = options.isPrimary ?? true;
  }
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverMock;
}

if (!globalThis.PointerEvent) {
  globalThis.PointerEvent = PointerEventMock;
}

if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = function setPointerCapture() {};
}

if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = function releasePointerCapture() {};
}

if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
}

if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (frameId) => clearTimeout(frameId);
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});