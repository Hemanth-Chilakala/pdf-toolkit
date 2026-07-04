import { PDFDocument } from '../utils/pdf.js';
import { loadPdfDocument, renderPagePreview, downloadBytes } from '../utils/pdf.js';
import { createDropzone, runWithProgress, showToast, el, escapeHtml } from '../utils/ui.js';
import { createPreviewGuard } from '../utils/preview.js';

export function renderCrop(container) {
  let pdfData = null;
  let currentPage = 0;
  const preview = createPreviewGuard();

  container.innerHTML = '';
  container.appendChild(createDropzone('.pdf,application/pdf', false, async ([file]) => {
    try {
      pdfData = await loadPdfDocument(file);
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
        <div class="card-title">Crop ${escapeHtml(pdfData.file.name)}</div>
        <div class="form-row">
          <div class="form-group">
            <label>Apply to</label>
            <select id="apply-to">
              <option value="current">Current page only</option>
              <option value="all">All pages</option>
            </select>
          </div>
          <div class="form-group">
            <label>Page</label>
            <select id="page-select"></select>
          </div>
        </div>
        <p style="font-size:0.8125rem;color:var(--text-muted);margin-bottom:0.75rem">
          Set crop margins as percentage from each edge
        </p>
        <div class="form-row">
          <div class="form-group">
            <label>Top (%)</label>
            <input type="range" id="crop-top" min="0" max="45" value="0" />
            <div class="range-value" id="top-val">0%</div>
          </div>
          <div class="form-group">
            <label>Bottom (%)</label>
            <input type="range" id="crop-bottom" min="0" max="45" value="0" />
            <div class="range-value" id="bottom-val">0%</div>
          </div>
          <div class="form-group">
            <label>Left (%)</label>
            <input type="range" id="crop-left" min="0" max="45" value="0" />
            <div class="range-value" id="left-val">0%</div>
          </div>
          <div class="form-group">
            <label>Right (%)</label>
            <input type="range" id="crop-right" min="0" max="45" value="0" />
            <div class="range-value" id="right-val">0%</div>
          </div>
        </div>
        <div class="btn-group action-dock">
          <button class="btn btn-primary" id="crop-btn">Crop & Download</button>
        </div>
      </div>
      <div class="preview-panel">
        <div class="preview-panel-header">Crop Preview</div>
        <div class="preview-canvas-wrap crop-preview-wrap" id="preview-wrap"></div>
      </div>
    `;

    const pageSelect = workspace.querySelector('#page-select');
    for (let i = 0; i < pageCount; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Page ${i + 1}`;
      pageSelect.appendChild(opt);
    }

    const cropInputs = ['top', 'bottom', 'left', 'right'];

    function schedulePreview() {
      const wrap = workspace.querySelector('#preview-wrap');
      preview.schedule(() => {
        preview.render(wrap, async () => {
          const top = parseInt(workspace.querySelector('#crop-top').value, 10);
          const bottom = parseInt(workspace.querySelector('#crop-bottom').value, 10);
          const left = parseInt(workspace.querySelector('#crop-left').value, 10);
          const right = parseInt(workspace.querySelector('#crop-right').value, 10);

          const canvas = await renderPagePreview(pdfData.bytes, currentPage, 1.2);
          const editorWrap = el('div', 'editor-canvas-wrap crop-preview');
          editorWrap.appendChild(canvas);

          const overlay = el('div', 'editor-overlay crop-overlay');
          ['top', 'bottom', 'left', 'right'].forEach((side) => {
            const shade = el('div', 'crop-shade');
            if (side === 'top') {
              shade.style.top = '0';
              shade.style.left = '0';
              shade.style.right = '0';
              shade.style.height = `${top}%`;
            } else if (side === 'bottom') {
              shade.style.bottom = '0';
              shade.style.left = '0';
              shade.style.right = '0';
              shade.style.height = `${bottom}%`;
            } else if (side === 'left') {
              shade.style.top = `${top}%`;
              shade.style.bottom = `${bottom}%`;
              shade.style.left = '0';
              shade.style.width = `${left}%`;
            } else {
              shade.style.top = `${top}%`;
              shade.style.bottom = `${bottom}%`;
              shade.style.right = '0';
              shade.style.width = `${right}%`;
            }
            overlay.appendChild(shade);
          });

          const cropBox = el('div', 'crop-box');
          cropBox.style.top = `${top}%`;
          cropBox.style.left = `${left}%`;
          cropBox.style.right = `${right}%`;
          cropBox.style.bottom = `${bottom}%`;
          overlay.appendChild(cropBox);

          editorWrap.appendChild(overlay);
          return editorWrap;
        });
      });
    }

    schedulePreview();

    const pageGroup = pageSelect.closest('.form-group');
    const applyToSelect = workspace.querySelector('#apply-to');
    applyToSelect.addEventListener('change', () => {
      pageGroup.classList.toggle('hidden', applyToSelect.value === 'all');
    });

    pageSelect.addEventListener('change', () => {
      currentPage = parseInt(pageSelect.value, 10);
      schedulePreview();
    });

    cropInputs.forEach((side) => {
      workspace.querySelector(`#crop-${side}`).addEventListener('input', (e) => {
        workspace.querySelector(`#${side}-val`).textContent = `${e.target.value}%`;
        schedulePreview();
      });
    });

    workspace.querySelector('#crop-btn').addEventListener('click', async () => {
      const applyTo = workspace.querySelector('#apply-to').value;
      const top = parseInt(workspace.querySelector('#crop-top').value, 10) / 100;
      const bottom = parseInt(workspace.querySelector('#crop-bottom').value, 10) / 100;
      const left = parseInt(workspace.querySelector('#crop-left').value, 10) / 100;
      const right = parseInt(workspace.querySelector('#crop-right').value, 10) / 100;

      if (top + bottom >= 0.9 || left + right >= 0.9) {
        showToast('Crop margins too large', 'error');
        return;
      }

      await runWithProgress(async (update) => {
        const doc = await PDFDocument.load(pdfData.bytes);
        const pages = doc.getPages();
        const targetPages = applyTo === 'all'
          ? pages.map((_, i) => i)
          : [currentPage];

        for (let n = 0; n < targetPages.length; n++) {
          const idx = targetPages[n];
          update(`Cropping page ${n + 1}/${targetPages.length}`, ((n + 1) / targetPages.length) * 100);
          const page = pages[idx];
          const { width, height } = page.getSize();

          const cropX = left * width;
          const cropY = bottom * height;
          const cropW = width * (1 - left - right);
          const cropH = height * (1 - top - bottom);

          page.setCropBox(cropX, cropY, cropW, cropH);
          page.setMediaBox(cropX, cropY, cropW, cropH);
        }

        const result = await doc.save();
        downloadBytes(result, 'cropped.pdf');
        showToast('PDF cropped!');
      });
    });
  }
}