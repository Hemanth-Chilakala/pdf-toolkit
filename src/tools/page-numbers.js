import { PDFDocument, rgb, StandardFonts } from '../utils/pdf.js';
import { loadPdfDocument, renderPagePreview, downloadBytes, deriveFilename } from '../utils/pdf.js';
import { createDropzone, runWithProgress, showToast, el, escapeHtml } from '../utils/ui.js';
import { createPreviewGuard } from '../utils/preview.js';

const POSITIONS = {
  'bottom-center': (w, h, tw) => ({ x: (w - tw) / 2, y: 30 }),
  'bottom-left': (w, h) => ({ x: 40, y: 30 }),
  'bottom-right': (w, h, tw) => ({ x: w - tw - 40, y: 30 }),
  'top-center': (w, h, tw) => ({ x: (w - tw) / 2, y: h - 40 }),
  'top-left': (w, h) => ({ x: 40, y: h - 40 }),
  'top-right': (w, h, tw) => ({ x: w - tw - 40, y: h - 40 }),
};

export function renderPageNumbers(container) {
  let pdfData = null;
  const preview = createPreviewGuard();

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
            <label>Position</label>
            <select id="num-position">
              <option value="bottom-center">Bottom Center</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="top-center">Top Center</option>
              <option value="top-left">Top Left</option>
              <option value="top-right">Top Right</option>
            </select>
          </div>
          <div class="form-group">
            <label>Font Size</label>
            <input type="number" id="num-size" value="12" min="8" max="36" />
          </div>
          <div class="form-group">
            <label>Color</label>
            <input type="color" id="num-color" value="#333333" />
          </div>
          <div class="form-group">
            <label>Start Number</label>
            <input type="number" id="num-start" value="1" min="1" />
          </div>
          <div class="form-group">
            <label>Format</label>
            <select id="num-format">
              <option value="number">1, 2, 3...</option>
              <option value="page-of">Page 1 of N</option>
            </select>
          </div>
        </div>
        <div class="btn-group action-dock">
          <button class="btn btn-primary" id="apply-nums">Add Page Numbers & Download</button>
        </div>
      </div>
      <div class="preview-panel">
        <div class="preview-panel-header">Preview (Page 1)</div>
        <div class="preview-canvas-wrap" id="preview-wrap" style="position:relative"></div>
      </div>
    `;

    function schedulePreview() {
      const wrap = workspace.querySelector('#preview-wrap');
      preview.schedule(() => {
        preview.render(wrap, async () => {
          const editorWrap = el('div', 'editor-canvas-wrap');
          const canvas = await renderPagePreview(pdfData.bytes, 0, 1.2);
          editorWrap.appendChild(canvas);

          const page = pdfData.doc.getPage(0);
          const { width: pw, height: ph } = page.getSize();
          const format = workspace.querySelector('#num-format').value;
          const start = parseInt(workspace.querySelector('#num-start').value, 10);
          const size = parseInt(workspace.querySelector('#num-size').value, 10);
          const pos = workspace.querySelector('#num-position').value;
          const text = format === 'page-of' ? `Page ${start} of ${pageCount}` : String(start);

          const measure = document.createElement('canvas').getContext('2d');
          measure.font = `${size * 1.2}px Helvetica, Arial, sans-serif`;
          const tw = measure.measureText(text).width / 1.2;
          const posFn = POSITIONS[pos];
          const { x, y } = posFn(pw, ph, tw);

          const overlay = el('div', 'editor-overlay');
          const label = el('div', 'text-box');
          label.textContent = text;
          label.style.fontSize = `${size * 1.2}px`;
          label.style.color = workspace.querySelector('#num-color').value;
          label.style.left = `${(x / pw) * 100}%`;
          label.style.bottom = `${(y / ph) * 100}%`;
          label.style.top = 'auto';
          label.style.lineHeight = '1';
          overlay.appendChild(label);
          editorWrap.appendChild(overlay);
          return editorWrap;
        });
      });
    }

    schedulePreview();
    workspace.querySelectorAll('select, input').forEach((input) => {
      input.addEventListener('change', schedulePreview);
      input.addEventListener('input', schedulePreview);
    });

    workspace.querySelector('#apply-nums').addEventListener('click', async () => {
      const start = parseInt(workspace.querySelector('#num-start').value, 10);
      if (!Number.isFinite(start) || start < 1) {
        showToast('Start number must be at least 1', 'error');
        return;
      }
      await runWithProgress(async (update) => {
        const doc = await PDFDocument.load(pdfData.bytes);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const pages = doc.getPages();
        const size = parseInt(workspace.querySelector('#num-size').value, 10);
        const format = workspace.querySelector('#num-format').value;
        const pos = workspace.querySelector('#num-position').value;
        const hex = workspace.querySelector('#num-color').value.replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        const posFn = POSITIONS[pos];

        for (let i = 0; i < pages.length; i++) {
          update(`Numbering page ${i + 1}/${pages.length}`, ((i + 1) / pages.length) * 100);
          const page = pages[i];
          const { width, height } = page.getSize();
          const num = start + i;
          const text = format === 'page-of' ? `Page ${num} of ${pages.length}` : String(num);
          const tw = font.widthOfTextAtSize(text, size);
          const { x, y } = posFn(width, height, tw);
          page.drawText(text, { x, y, size, font, color: rgb(r, g, b) });
        }

        const result = await doc.save();
        downloadBytes(result, deriveFilename(pdfData.file.name, 'numbered'));
        showToast('Page numbers added!');
      });
    });
  }
}