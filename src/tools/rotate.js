import { PDFDocument, degrees } from '../utils/pdf.js';
import { loadPdfDocument, renderPagePreview, downloadBytes, parsePageRange, deriveFilename } from '../utils/pdf.js';
import { createDropzone, runWithProgress, showToast, el, escapeHtml } from '../utils/ui.js';
import { createPreviewGuard } from '../utils/preview.js';

export function renderRotate(container) {
  let pdfData = null;
  const preview = createPreviewGuard();
  let gridGen = 0;

  container.innerHTML = '';
  container.appendChild(createDropzone('.pdf,application/pdf', false, async ([file]) => {
    try {
      pdfData = await loadPdfDocument(file);
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
        <div class="card-title">${escapeHtml(pdfData.file.name)} — ${pageCount} pages</div>
        <div class="form-row">
          <div class="form-group">
            <label>Apply to</label>
            <select id="apply-to">
              <option value="all">All pages</option>
              <option value="selected">Selected pages</option>
              <option value="range">Page range</option>
            </select>
          </div>
          <div class="form-group hidden" id="range-group">
            <label>Page range</label>
            <input type="text" id="range-input" placeholder="1-${pageCount}" />
          </div>
          <div class="form-group">
            <label>Rotation</label>
            <select id="rotation">
              <option value="90">90° clockwise</option>
              <option value="180">180°</option>
              <option value="270">90° counter-clockwise</option>
            </select>
          </div>
        </div>
        <div class="page-grid" id="page-grid"></div>
        <div class="btn-group action-dock">
          <button class="btn btn-primary" id="rotate-btn">Rotate & Download</button>
        </div>
      </div>
      <div class="preview-panel">
        <div class="preview-panel-header">Preview — <span id="preview-label">Page 1</span></div>
        <div class="preview-canvas-wrap" id="preview-wrap"></div>
      </div>
    `;

    const selected = new Set();
    const grid = workspace.querySelector('#page-grid');
    const thumbGen = ++gridGen;

    function showPreview(idx) {
      workspace.querySelector('#preview-label').textContent = `Page ${idx + 1}`;
      const wrap = workspace.querySelector('#preview-wrap');
      preview.render(wrap, async () => renderPagePreview(pdfData.bytes, idx, 1.2));
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
        if (thumbGen !== gridGen || !thumb.isConnected) return;
        thumb.innerHTML = '<span class="loading">Error</span>';
      });

      card.addEventListener('click', () => {
        if (selected.has(i)) { selected.delete(i); card.classList.remove('selected'); }
        else { selected.add(i); card.classList.add('selected'); }
        showPreview(i);
      });
    }

    showPreview(0);

    const applyTo = workspace.querySelector('#apply-to');
    const rangeGroup = workspace.querySelector('#range-group');
    applyTo.addEventListener('change', () => {
      rangeGroup.classList.toggle('hidden', applyTo.value !== 'range');
      grid.style.display = applyTo.value === 'selected' ? '' : 'none';
      if (applyTo.value !== 'selected') {
        selected.clear();
        grid.querySelectorAll('.page-card.selected').forEach((c) => c.classList.remove('selected'));
      }
    });

    workspace.querySelector('#rotate-btn').addEventListener('click', async () => {
      const rot = parseInt(workspace.querySelector('#rotation').value, 10);
      let targetPages = new Set();

      if (applyTo.value === 'all') {
        for (let i = 0; i < pageCount; i++) targetPages.add(i);
      } else if (applyTo.value === 'selected') {
        targetPages = selected;
        if (!targetPages.size) {
          showToast('Select pages first', 'error');
          return;
        }
      } else {
        const indices = parsePageRange(workspace.querySelector('#range-input').value || `1-${pageCount}`, pageCount);
        if (!indices.length) {
          showToast('Invalid page range', 'error');
          return;
        }
        targetPages = new Set(indices);
      }

      if (!targetPages.size) {
        showToast('No pages matched', 'error');
        return;
      }

      await runWithProgress(async (update) => {
        const newDoc = await PDFDocument.load(pdfData.bytes);
        const pages = newDoc.getPages();
        let n = 0;
        for (const idx of targetPages) {
          if (idx < 0 || idx >= pages.length) continue;
          n++;
          update(`Rotating page ${n}...`, (n / targetPages.size) * 100);
          const page = pages[idx];
          const current = page.getRotation().angle;
          page.setRotation(degrees(current + rot));
        }
        const result = await newDoc.save();
        downloadBytes(result, deriveFilename(pdfData.file.name, 'rotated'));
        showToast('PDF rotated!');
      });
    });
  }
}