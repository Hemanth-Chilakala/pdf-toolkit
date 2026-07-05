import { PDFDocument, rgb, StandardFonts } from '../utils/pdf.js';
import { loadPdfDocument, renderPagePreview, downloadBytes, deriveFilename } from '../utils/pdf.js';
import { createDropzone, runWithProgress, showToast, el, escapeHtml } from '../utils/ui.js';
import { createPreviewGuard, getEditorClickPercent } from '../utils/preview.js';

export function renderAddText(container) {
  let pdfData = null;
  let currentPage = 0;
  const annotations = [];
  const preview = createPreviewGuard();

  container.innerHTML = '';
  container.appendChild(createDropzone('.pdf,application/pdf', false, async ([file]) => {
    try {
      pdfData = await loadPdfDocument(file);
      annotations.length = 0;
      currentPage = 0;
      preview.cancel();
      renderUI();
    } catch (err) {
      showToast(err.message || 'Could not load PDF', 'error');
    }
  }));

  const workspace = el('div', 'hidden');
  container.appendChild(workspace);

  function renderUI() {
    if (!pdfData) return;
    workspace.classList.remove('hidden');
    preview.cancel();
    const pageCount = pdfData.doc.getPageCount();

    workspace.innerHTML = `
      <div class="card">
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>Text</label>
            <input type="text" id="text-input" placeholder="Enter text..." value="Sample Text" />
          </div>
          <div class="form-group">
            <label>Font size</label>
            <input type="number" id="font-size" value="18" min="6" max="72" />
          </div>
          <div class="form-group">
            <label>Color</label>
            <input type="color" id="font-color" value="#000000" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Page</label>
            <select id="page-select"></select>
          </div>
          <div class="form-group">
            <label>Position X (%)</label>
            <input type="range" id="pos-x" min="0" max="100" value="10" />
            <div class="range-value" id="pos-x-val">10%</div>
          </div>
          <div class="form-group">
            <label>Position Y (%)</label>
            <input type="range" id="pos-y" min="0" max="100" value="80" />
            <div class="range-value" id="pos-y-val">80%</div>
          </div>
        </div>
        <div class="btn-group action-dock">
          <button class="btn btn-secondary" id="add-text-btn">+ Add Text Box</button>
          <button class="btn btn-primary" id="apply-btn">Apply & Download</button>
        </div>
      </div>
      <div class="preview-panel">
        <div class="preview-panel-header">Live Preview — click to position</div>
        <div class="preview-canvas-wrap" id="preview-wrap" style="position:relative;cursor:crosshair"></div>
      </div>
      <div class="card hidden" id="annotations-list">
        <div class="card-title">Added Text Boxes</div>
        <div id="ann-items"></div>
      </div>
    `;

    const pageSelect = workspace.querySelector('#page-select');
    for (let i = 0; i < pageCount; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Page ${i + 1}`;
      pageSelect.appendChild(opt);
    }

    const wrap = workspace.querySelector('#preview-wrap');
    let overlayEl = null;

    function positionTextEl(item, ann) {
      item.style.left = `${ann.x}%`;
      item.style.bottom = `${100 - ann.y}%`;
      item.style.top = 'auto';
      item.style.fontSize = `${ann.size * 1.2}px`;
      item.style.color = ann.color;
      item.style.lineHeight = '1';
    }

    function renderOverlayItems() {
      if (!overlayEl) return;
      overlayEl.innerHTML = '';
      const pageAnns = annotations.filter((a) => a.page === currentPage);
      for (const ann of pageAnns) {
        const item = el('div', 'draggable-item text-box');
        positionTextEl(item, ann);
        item.textContent = ann.text;
        overlayEl.appendChild(item);
      }
    }

    function refreshPreview() {
      preview.render(wrap, async () => {
        const editorWrap = el('div', 'editor-canvas-wrap');
        const previewCanvas = await renderPagePreview(pdfData.bytes, currentPage, 1.2);
        editorWrap.appendChild(previewCanvas);
        overlayEl = el('div', 'editor-overlay');
        editorWrap.appendChild(overlayEl);
        renderOverlayItems();
        return editorWrap;
      });
    }

    refreshPreview();

    pageSelect.addEventListener('change', () => {
      currentPage = parseInt(pageSelect.value, 10);
      refreshPreview();
    });

    const posX = workspace.querySelector('#pos-x');
    const posY = workspace.querySelector('#pos-y');
    posX.addEventListener('input', () => {
      workspace.querySelector('#pos-x-val').textContent = `${posX.value}%`;
    });
    posY.addEventListener('input', () => {
      workspace.querySelector('#pos-y-val').textContent = `${posY.value}%`;
    });

    wrap.addEventListener('click', (e) => {
      const { x, y } = getEditorClickPercent(wrap, e.clientX, e.clientY);
      posX.value = x;
      posY.value = y;
      workspace.querySelector('#pos-x-val').textContent = `${x}%`;
      workspace.querySelector('#pos-y-val').textContent = `${y}%`;
    });

    workspace.querySelector('#add-text-btn').addEventListener('click', () => {
      const size = parseInt(workspace.querySelector('#font-size').value, 10);
      if (!Number.isFinite(size) || size < 6 || size > 72) {
        showToast('Font size must be between 6 and 72', 'error');
        return;
      }
      const ann = {
        text: workspace.querySelector('#text-input').value,
        size,
        color: workspace.querySelector('#font-color').value,
        page: currentPage,
        x: parseInt(posX.value, 10),
        y: parseInt(posY.value, 10),
      };
      annotations.push(ann);
      renderOverlayItems();
      renderAnnList();
    });

    function renderAnnList() {
      const list = workspace.querySelector('#annotations-list');
      const items = workspace.querySelector('#ann-items');
      if (!annotations.length) {
        list.classList.add('hidden');
        return;
      }
      list.classList.remove('hidden');
      items.innerHTML = annotations.map((a, i) => `
        <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border);font-size:0.875rem">
          <span>"${escapeHtml(a.text)}" on page ${a.page + 1}</span>
          <button class="btn btn-sm btn-danger" data-idx="${i}">Remove</button>
        </div>
      `).join('');
      items.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          annotations.splice(parseInt(btn.dataset.idx, 10), 1);
          renderOverlayItems();
          renderAnnList();
        });
      });
    }

    workspace.querySelector('#apply-btn').addEventListener('click', async () => {
      if (!annotations.length) {
        showToast('Add at least one text box', 'error');
        return;
      }
      await runWithProgress(async () => {
        const doc = await PDFDocument.load(pdfData.bytes);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const pages = doc.getPages();

        for (const ann of annotations) {
          const page = pages[ann.page];
          const { width, height } = page.getSize();
          const hex = ann.color.replace('#', '');
          const r = parseInt(hex.slice(0, 2), 16) / 255;
          const g = parseInt(hex.slice(2, 4), 16) / 255;
          const b = parseInt(hex.slice(4, 6), 16) / 255;
          const x = (ann.x / 100) * width;
          const y = height - (ann.y / 100) * height;
          page.drawText(ann.text, {
            x,
            y,
            size: ann.size,
            font,
            color: rgb(r, g, b),
          });
        }

        const result = await doc.save();
        downloadBytes(result, deriveFilename(pdfData.file.name, 'text-added'));
        showToast('Text added successfully!');
      });
    });
  }
}