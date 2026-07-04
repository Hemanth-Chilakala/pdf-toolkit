/** Guards async preview renders so stale results never stack canvases. */
export function createPreviewGuard() {
  let generation = 0;
  let debounceTimer = null;

  function cancel() {
    generation += 1;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function schedule(fn, ms = 80) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      fn();
    }, ms);
  }

  async function render(container, build) {
    const id = ++generation;
    if (!container) return;
    container.innerHTML = '<span class="loading">Loading preview...</span>';
    try {
      const node = await build();
      if (id !== generation || !container.isConnected) return;
      container.innerHTML = '';
      if (node) container.appendChild(node);
    } catch {
      if (id !== generation || !container.isConnected) return;
      container.innerHTML = '<span class="loading" style="color:var(--red)">Preview unavailable</span>';
    }
  }

  function isCurrent(id) {
    return id === generation;
  }

  function nextId() {
    return ++generation;
  }

  return { render, schedule, cancel, isCurrent, nextId };
}

/** Revoke blob URLs when replacing image state. */
export function revokeBlobUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

/** Map a click to % position relative to the editor canvas (not outer wrap). */
export function getEditorClickPercent(container, clientX, clientY) {
  const target = container.querySelector('.editor-canvas-wrap') || container;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: Math.min(100, Math.max(0, Math.round(((clientX - rect.left) / rect.width) * 100))),
    y: Math.min(100, Math.max(0, Math.round(((clientY - rect.top) / rect.height) * 100))),
  };
}