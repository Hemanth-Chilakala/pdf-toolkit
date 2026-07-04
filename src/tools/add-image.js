import { PDFDocument } from '../utils/pdf.js';
import { loadPdfDocument, renderPagePreview, embedImage, downloadBytes } from '../utils/pdf.js';
import { createDropzone, runWithProgress, showToast, el, escapeHtml } from '../utils/ui.js';
import { icon } from '../utils/icons.js';
import { createPreviewGuard, revokeBlobUrl, getEditorClickPercent } from '../utils/preview.js';

export function renderAddImage(container) {
  let pdfData = null;
  let imageData = null;
  let currentPage = 0;
  const placements = [];
  const preview = createPreviewGuard();

  container.innerHTML = '';
  const pdfDrop = createDropzone('.pdf,application/pdf', false, async ([file]) => {
    try {
      placements.forEach((p) => revokeBlobUrl(p.previewUrl));
      placements.length = 0;
      revokeBlobUrl(imageData?.url);
      imageData = null;
      pdfData = await loadPdfDocument(file);
      currentPage = 0;
      placements.length = 0;
      preview.cancel();
      renderUI();
    } catch (err) {
      showToast(err.message || 'Could not load PDF', 'error');
    }
  });
  container.appendChild(pdfDrop);

  const workspace = el('div', 'hidden');
  container.appendChild(workspace);

  function renderUI() {
    if (!pdfData) return;
    workspace.classList.remove('hidden');
    preview.cancel();
    const pageCount = pdfData.doc.getPageCount();

    workspace.innerHTML = `
      <div class="card">
        <div class="card-title">Insert Image</div>
        <div class="dropzone" id="img-drop">
          <div class="dropzone-inner">
            <div class="dropzone-icon">${icon('image')}</div>
            <div class="dropzone-copy">
              <h3>Drop PNG/JPG image here</h3>
              <p>or click to browse</p>
            </div>
          </div>
          <input type="file" accept="image/png,image/jpeg" />
        </div>
        <div class="form-row" style="margin-top:1rem">
          <div class="form-group">
            <label>Page</label>
            <select id="page-select"></select>
          </div>
          <div class="form-group">
            <label>Width (% of page)</label>
            <input type="range" id="img-width" min="5" max="100" value="30" />
            <div class="range-value" id="width-val">30%</div>
          </div>
          <div class="form-group">
            <label>Position X (%)</label>
            <input type="range" id="pos-x" min="0" max="100" value="10" />
            <div class="range-value" id="pos-x-val">10%</div>
          </div>
          <div class="form-group">
            <label>Position Y (%)</label>
            <input type="range" id="pos-y" min="0" max="100" value="10" />
            <div class="range-value" id="pos-y-val">10%</div>
          </div>
        </div>
        <div class="btn-group action-dock">
          <button class="btn btn-secondary" id="place-btn" disabled>+ Place Image</button>
          <button class="btn btn-primary" id="apply-btn">Apply & Download</button>
        </div>
      </div>
      <div class="preview-panel">
        <div class="preview-panel-header">Live Preview</div>
        <div class="preview-canvas-wrap" id="preview-wrap" style="position:relative;cursor:crosshair"></div>
      </div>
    `;

    const pageSelect = workspace.querySelector('#page-select');
    for (let i = 0; i < pageCount; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Page ${i + 1}`;
      pageSelect.appendChild(opt);
    }

    const imgDrop = workspace.querySelector('#img-drop');

    function bindImgDrop() {
      const imgInput = imgDrop.querySelector('input');
      imgDrop.onclick = (e) => {
        if (e.target === imgInput) return;
        imgInput.click();
      };
      imgDrop.ondragover = (e) => { e.preventDefault(); imgDrop.classList.add('dragover'); };
      imgDrop.ondragleave = () => imgDrop.classList.remove('dragover');
      imgDrop.ondrop = async (e) => {
        e.preventDefault();
        imgDrop.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) await loadImage(file);
      };
      imgInput.onchange = async () => {
        if (imgInput.files[0]) await loadImage(imgInput.files[0]);
        imgInput.value = '';
      };
    }

    bindImgDrop();

    async function loadImage(file) {
      if (!file || !/^image\/(png|jpeg)$/.test(file.type)) {
        showToast('Only PNG/JPG images are supported', 'error');
        return;
      }
      revokeBlobUrl(imageData?.url);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const url = URL.createObjectURL(file);
      imageData = { bytes, url, type: file.type };
      imgDrop.classList.add('has-files');
      imgDrop.innerHTML = `
        <div class="dropzone-inner">
          <div class="dropzone-icon">${icon('image')}</div>
          <div class="dropzone-copy">
            <h3>${escapeHtml(file.name)}</h3>
            <p>Click or drop to replace image</p>
          </div>
        </div>
        <input type="file" accept="image/png,image/jpeg" />
      `;
      bindImgDrop();
      workspace.querySelector('#place-btn').disabled = false;
      schedulePreview();
    }

    let overlayEl = null;

    function buildOverlay() {
      if (!overlayEl) return;
      overlayEl.innerHTML = '';
      const pagePlacements = placements.filter((p) => p.page === currentPage);
      for (const p of pagePlacements) {
        const item = el('div', 'draggable-item');
        item.style.left = `${p.x}%`;
        item.style.top = `${p.y}%`;
        item.style.width = `${p.width}%`;
        const img = document.createElement('img');
        img.src = p.previewUrl;
        img.style.width = '100%';
        item.appendChild(img);
        overlayEl.appendChild(item);
      }

      if (imageData) {
        const ghost = el('div', 'draggable-item');
        ghost.style.left = `${workspace.querySelector('#pos-x').value}%`;
        ghost.style.top = `${workspace.querySelector('#pos-y').value}%`;
        ghost.style.width = `${workspace.querySelector('#img-width').value}%`;
        ghost.style.opacity = '0.7';
        const img = document.createElement('img');
        img.src = imageData.url;
        img.style.width = '100%';
        ghost.appendChild(img);
        overlayEl.appendChild(ghost);
      }
    }

    function schedulePreview() {
      const wrap = workspace.querySelector('#preview-wrap');
      preview.schedule(() => {
        preview.render(wrap, async () => {
          const editorWrap = el('div', 'editor-canvas-wrap');
          const canvas = await renderPagePreview(pdfData.bytes, currentPage, 1.2);
          editorWrap.appendChild(canvas);
          overlayEl = el('div', 'editor-overlay');
          editorWrap.appendChild(overlayEl);
          buildOverlay();
          return editorWrap;
        });
      });
    }

    schedulePreview();

    pageSelect.addEventListener('change', () => {
      currentPage = parseInt(pageSelect.value, 10);
      schedulePreview();
    });

    ['#pos-x', '#pos-y', '#img-width'].forEach((sel) => {
      workspace.querySelector(sel).addEventListener('input', () => {
        const id = sel.slice(1);
        const valEl = workspace.querySelector(`#${id}-val`) || workspace.querySelector(`#${id.replace('img-', '')}-val`);
        if (valEl) valEl.textContent = `${workspace.querySelector(sel).value}%`;
        if (overlayEl) buildOverlay();
        else schedulePreview();
      });
    });

    workspace.querySelector('#preview-wrap').addEventListener('click', (e) => {
      const wrap = workspace.querySelector('#preview-wrap');
      const { x, y } = getEditorClickPercent(wrap, e.clientX, e.clientY);
      workspace.querySelector('#pos-x').value = x;
      workspace.querySelector('#pos-y').value = y;
      workspace.querySelector('#pos-x-val').textContent = `${x}%`;
      workspace.querySelector('#pos-y-val').textContent = `${y}%`;
      if (overlayEl) buildOverlay();
    });

    workspace.querySelector('#place-btn').addEventListener('click', () => {
      if (!imageData) return;
      placements.push({
        page: currentPage,
        x: parseInt(workspace.querySelector('#pos-x').value, 10),
        y: parseInt(workspace.querySelector('#pos-y').value, 10),
        width: parseInt(workspace.querySelector('#img-width').value, 10),
        bytes: imageData.bytes,
        type: imageData.type,
        previewUrl: imageData.url,
      });
      buildOverlay();
      showToast('Image placed');
    });

    workspace.querySelector('#apply-btn').addEventListener('click', async () => {
      const all = placements.length ? placements : (imageData ? [{
        page: currentPage,
        x: parseInt(workspace.querySelector('#pos-x').value, 10),
        y: parseInt(workspace.querySelector('#pos-y').value, 10),
        width: parseInt(workspace.querySelector('#img-width').value, 10),
        bytes: imageData.bytes,
        type: imageData.type,
      }] : []);

      if (!all.length) {
        showToast('Add an image first', 'error');
        return;
      }

      await runWithProgress(async () => {
        const doc = await PDFDocument.load(pdfData.bytes);
        const pages = doc.getPages();

        for (const p of all) {
          const page = pages[p.page];
          const { width: pw, height: ph } = page.getSize();
          const img = await embedImage(doc, p.bytes, p.type);
          const imgW = (p.width / 100) * pw;
          const aspect = img.height / img.width;
          const imgH = imgW * aspect;
          const x = (p.x / 100) * pw;
          const y = ph - (p.y / 100) * ph - imgH;
          page.drawImage(img, { x, y, width: imgW, height: imgH });
        }

        const result = await doc.save();
        downloadBytes(result, 'image-added.pdf');
        showToast('Images added!');
      });
    });

    return () => {
      placements.forEach((p) => revokeBlobUrl(p.previewUrl));
      revokeBlobUrl(imageData?.url);
    };
  }
}