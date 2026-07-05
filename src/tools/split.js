import { PDFDocument } from '../utils/pdf.js';
import { loadPdfDocument, renderPagePreview, downloadBytes, parsePageRange, deriveFilename } from '../utils/pdf.js';
import { createDropzone, runWithProgress, showToast, el, escapeHtml } from '../utils/ui.js';
import { createPreviewGuard } from '../utils/preview.js';

export function renderSplit(container) {
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
  workspace.id = 'split-workspace';
  container.appendChild(workspace);

  function renderUI() {
    if (!pdfData) return;
    preview.cancel();
    workspace.classList.remove('hidden');
    const { doc, file } = pdfData;
    const pageCount = doc.getPageCount();

    workspace.innerHTML = `
      <div class="card">
        <div class="card-title">${escapeHtml(file.name)} — ${pageCount} pages</div>
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>Page ranges (e.g. 1-3, 5, 7-10)</label>
            <input type="text" id="range-input" placeholder="1-${pageCount}" />
          </div>
        </div>
        <p style="font-size:0.8125rem;color:var(--text-muted);margin-bottom:0.75rem">Or click pages below to select them</p>
        <div class="page-grid" id="page-grid"></div>
        <div class="btn-group action-dock">
          <button class="btn btn-primary" id="split-extract">Extract Selected</button>
          <button class="btn btn-secondary" id="split-range">Extract by Range</button>
          <button class="btn btn-secondary" id="select-all">Select All</button>
          <button class="btn btn-secondary" id="clear-sel">Clear Selection</button>
        </div>
      </div>
      <div class="preview-panel" id="preview-panel">
        <div class="preview-panel-header">Page Preview <span id="preview-label"></span></div>
        <div class="preview-canvas-wrap" id="preview-wrap"></div>
      </div>
    `;

    const grid = workspace.querySelector('#page-grid');
    const thumbGen = ++gridGen;

    function showPreview(idx) {
      workspace.querySelector('#preview-label').textContent = `— Page ${idx + 1}`;
      preview.render(workspace.querySelector('#preview-wrap'), async () => {
        return renderPagePreview(pdfData.bytes, idx, 1.2);
      });
    }

    for (let i = 0; i < pageCount; i++) {
      const card = el('div', 'page-card');
      card.dataset.index = i;
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
        if (selected.has(i)) {
          selected.delete(i);
          card.classList.remove('selected');
        } else {
          selected.add(i);
          card.classList.add('selected');
        }
        showPreview(i);
      });
    }

    showPreview(0);

    workspace.querySelector('#select-all').addEventListener('click', () => {
      for (let i = 0; i < pageCount; i++) selected.add(i);
      grid.querySelectorAll('.page-card').forEach((c) => c.classList.add('selected'));
    });

    workspace.querySelector('#clear-sel').addEventListener('click', () => {
      selected.clear();
      grid.querySelectorAll('.page-card').forEach((c) => c.classList.remove('selected'));
    });

    async function extractPages(indices, filename) {
      await runWithProgress(async () => {
        const newDoc = await PDFDocument.create();
        const copied = await newDoc.copyPages(pdfData.doc, indices);
        copied.forEach((p) => newDoc.addPage(p));
        const result = await newDoc.save();
        downloadBytes(result, filename);
        showToast(`Saved ${filename}`);
      });
    }

    workspace.querySelector('#split-extract').addEventListener('click', () => {
      if (!selected.size) {
        showToast('Select at least one page', 'error');
        return;
      }
      const indices = [...selected].sort((a, b) => a - b);
      extractPages(indices, deriveFilename(file.name, 'split'));
    });

    workspace.querySelector('#split-range').addEventListener('click', () => {
      const input = workspace.querySelector('#range-input').value;
      const indices = parsePageRange(input || `1-${pageCount}`, pageCount);
      if (!indices.length) {
        showToast('Invalid page range', 'error');
        return;
      }
      extractPages(indices, deriveFilename(file.name, 'split'));
    });
  }
}