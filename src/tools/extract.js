import { PDFDocument } from '../utils/pdf.js';
import { loadPdfDocument, renderPagePreview, downloadBytes, deriveFilename } from '../utils/pdf.js';
import { createDropzone, runWithProgress, showToast, el, escapeHtml } from '../utils/ui.js';
import { createPreviewGuard } from '../utils/preview.js';

export function renderExtract(container) {
  let pdfData = null;
  const selected = new Set();
  const preview = createPreviewGuard();
  let gridGen = 0;

  container.innerHTML = '';
  container.appendChild(createDropzone('.pdf,application/pdf', false, async ([file]) => {
    try {
      pdfData = await loadPdfDocument(file);
      selected.clear();
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
    const pageCount = pdfData.doc.getPageCount();
    preview.cancel();

    workspace.innerHTML = `
      <div class="card">
        <div class="card-title">Select pages to extract from ${escapeHtml(pdfData.file.name)}</div>
        <div class="selection-bar hidden" id="sel-bar">
          <span id="sel-count">0 pages selected</span>
          <button class="btn btn-sm btn-secondary" id="select-all">Select All</button>
          <button class="btn btn-sm btn-secondary" id="clear-sel">Clear</button>
        </div>
        <div class="page-grid" id="page-grid"></div>
        <div class="btn-group action-dock">
          <button class="btn btn-primary" id="extract-btn" disabled>Extract & Download</button>
        </div>
      </div>
      <div class="preview-panel">
        <div class="preview-panel-header">Preview — <span id="preview-label">Page 1</span></div>
        <div class="preview-canvas-wrap" id="preview-wrap"></div>
      </div>
    `;

    const grid = workspace.querySelector('#page-grid');
    const extractBtn = workspace.querySelector('#extract-btn');
    const thumbGen = ++gridGen;

    function updateUI() {
      const bar = workspace.querySelector('#sel-bar');
      workspace.querySelector('#sel-count').textContent = `${selected.size} page${selected.size !== 1 ? 's' : ''} selected`;
      bar.classList.toggle('hidden', !selected.size);
      extractBtn.disabled = !selected.size;
    }

    function showPreview(idx) {
      workspace.querySelector('#preview-label').textContent = `Page ${idx + 1}`;
      const wrap = workspace.querySelector('#preview-wrap');
      preview.render(wrap, async () => {
        const canvas = await renderPagePreview(pdfData.bytes, idx, 1.2);
        return canvas;
      });
    }

    for (let i = 0; i < pageCount; i++) {
      const card = el('div', 'page-card');
      const thumb = el('div', 'page-thumb', '<span class="loading">...</span>');
      card.appendChild(thumb);
      const meta = el('div', 'page-meta');
      meta.innerHTML = `<span class="page-num">Page ${i + 1}</span>`;
      card.appendChild(meta);
      grid.appendChild(card);

      renderPagePreview(pdfData.bytes, i).then((c) => {
        if (thumbGen !== gridGen || !thumb.isConnected) return;
        thumb.innerHTML = '';
        thumb.appendChild(c);
      }).catch(() => {
        if (thumbGen !== gridGen) return;
        thumb.innerHTML = '<span class="loading">Error</span>';
      });

      card.addEventListener('click', () => {
        if (selected.has(i)) { selected.delete(i); card.classList.remove('selected'); }
        else { selected.add(i); card.classList.add('selected'); }
        updateUI();
        showPreview(i);
      });
    }

    showPreview(0);

    workspace.querySelector('#select-all').addEventListener('click', () => {
      for (let i = 0; i < pageCount; i++) selected.add(i);
      grid.querySelectorAll('.page-card').forEach((c) => c.classList.add('selected'));
      updateUI();
    });

    workspace.querySelector('#clear-sel').addEventListener('click', () => {
      selected.clear();
      grid.querySelectorAll('.page-card').forEach((c) => c.classList.remove('selected'));
      updateUI();
    });

    extractBtn.addEventListener('click', async () => {
      const indices = [...selected].sort((a, b) => a - b);
      await runWithProgress(async () => {
        const newDoc = await PDFDocument.create();
        const copied = await newDoc.copyPages(pdfData.doc, indices);
        copied.forEach((p) => newDoc.addPage(p));
        const result = await newDoc.save();
        downloadBytes(result, deriveFilename(pdfData.file.name, 'extracted'));
        showToast(`Extracted ${indices.length} page(s)!`);
      });
    });
  }
}