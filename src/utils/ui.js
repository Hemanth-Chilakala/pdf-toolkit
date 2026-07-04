import Sortable from 'sortablejs';
import { icon } from './icons.js';
import { markConfigured, markComplete, resetToolFlow } from './tool-flow.js';

export function showProgress(message = 'Processing...', percent = null) {
  let overlay = document.getElementById('progress-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'progress-overlay';
    overlay.className = 'progress-overlay';
    overlay.innerHTML = `
      <div class="progress-box">
        <div class="spinner"></div>
        <p id="progress-message">${message}</p>
        <div class="progress-bar hidden" id="progress-bar">
          <div class="progress-bar-fill" id="progress-fill" style="width: 0%"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  document.getElementById('progress-message').textContent = message;
  const bar = document.getElementById('progress-bar');
  const fill = document.getElementById('progress-fill');
  if (percent !== null) {
    bar.classList.remove('hidden');
    fill.style.width = `${percent}%`;
  } else {
    bar.classList.add('hidden');
  }
}

export function hideProgress() {
  document.getElementById('progress-overlay')?.remove();
}

export function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  existing?.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  document.body.appendChild(toast);
  if (type === 'success') markComplete();
  setTimeout(() => toast.remove(), 3500);
}

function updateDropzoneState(el, count, multiple) {
  const title = el.querySelector('h3');
  const hint = el.querySelector('p');
  const badge = el.querySelector('.dropzone-badge');

  if (count > 0) {
    el.classList.add('has-files');
    title.textContent = multiple
      ? `${count} file${count === 1 ? '' : 's'} ready`
      : 'File loaded';
    hint.textContent = multiple ? 'Drop more files or click to add' : 'Click or drop to replace';
    if (badge) badge.textContent = String(count);
    markConfigured();
  } else {
    el.classList.remove('has-files');
    title.textContent = el.dataset.defaultTitle;
    hint.textContent = el.dataset.defaultHint;
    if (badge) badge.textContent = '';
    resetToolFlow();
  }
}

export function createDropzone(accept, multiple, onFiles, options = {}) {
  const isPdf = accept.includes('pdf');
  const isImage = accept.includes('image');
  const fileLabel = isPdf ? 'PDF' : isImage ? 'image' : 'file';

  const el = document.createElement('div');
  el.className = 'dropzone';
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `Upload ${multiple ? 'files' : 'file'}`);
  el.dataset.defaultTitle = `Select ${multiple ? `${fileLabel} files` : `${fileLabel} file`}`;
  el.dataset.defaultHint = `or drag and drop ${multiple ? 'them' : 'it'} here`;
  el.innerHTML = `
    <div class="dropzone-inner">
      <div class="dropzone-icon">${icon('upload')}</div>
      <div class="dropzone-copy">
        <h3>${el.dataset.defaultTitle}</h3>
        <p>${el.dataset.defaultHint}</p>
      </div>
      <span class="dropzone-badge" aria-hidden="true"></span>
    </div>
    <input type="file" accept="${accept}" ${multiple ? 'multiple' : ''} />
  `;
  const input = el.querySelector('input');
  let fileCount = 0;

  const handleFiles = async (files) => {
    if (!files.length) return;
    try {
      await onFiles(files);
      if (options.getCount) {
        fileCount = options.getCount();
      } else {
        fileCount = multiple ? fileCount + files.length : 1;
      }
      updateDropzoneState(el, fileCount, multiple);
    } catch (err) {
      showToast(err.message || 'Failed to load file', 'error');
    }
  };

  const openPicker = (e) => {
    if (e?.target === input) return;
    input.click();
  };
  el.addEventListener('click', openPicker);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('dragover');
  });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]);
  });
  input.addEventListener('change', () => {
    if (input.files.length) handleFiles([...input.files]);
    input.value = '';
  });

  el.resetDropzone = () => {
    fileCount = 0;
    updateDropzoneState(el, 0, multiple);
  };

  el.setDropzoneCount = (count) => {
    fileCount = count;
    updateDropzoneState(el, count, multiple);
  };

  return el;
}

const sortableMap = new WeakMap();

export function makeSortable(el, options = {}) {
  sortableMap.get(el)?.destroy();
  const instance = Sortable.create(el, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    ...options,
  });
  sortableMap.set(el, instance);
  return instance;
}

export async function runWithProgress(fn, message = 'Processing...') {
  showProgress(message);
  try {
    return await fn((msg, pct) => showProgress(msg, pct));
  } catch (err) {
    showToast(err.message || 'Something went wrong', 'error');
    throw err;
  } finally {
    hideProgress();
  }
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}