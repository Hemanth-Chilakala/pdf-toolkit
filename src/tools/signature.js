import { PDFDocument } from '../utils/pdf.js';
import { loadPdfDocument, renderPagePreview, embedImage, downloadBytes, deriveFilename } from '../utils/pdf.js';
import { createDropzone, runWithProgress, showToast, el } from '../utils/ui.js';
import { createPreviewGuard, getEditorClickPercent } from '../utils/preview.js';

const SESSION_KEY = 'pdf-toolkit-signature';

export function renderSignature(container) {
  let pdfData = null;
  let signatureDataUrl = sessionStorage.getItem(SESSION_KEY);
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

  const workspace = el('div');
  container.appendChild(workspace);

  function renderSignaturePad() {
    return `
      <div class="card" id="sig-pad-card">
        <div class="card-title">Draw Your Signature</div>
        <div class="signature-pad-wrap">
          <canvas id="sig-canvas" width="500" height="200"></canvas>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary" id="clear-sig">Clear</button>
          <button class="btn btn-primary" id="save-sig">Save Signature</button>
        </div>
        <p class="status-text" id="sig-status" ${signatureDataUrl ? '' : 'style="display:none"'}>Signature saved for this session</p>
      </div>
    `;
  }

  function initPad() {
    const canvas = workspace.querySelector('#sig-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let drawing = false;
    let hasInk = false;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const start = (e) => {
      e.preventDefault();
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
      if (!drawing) return;
      hasInk = true;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const stop = () => { drawing = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('mouseleave', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stop);
    canvas.addEventListener('touchcancel', stop);

    workspace.querySelector('#clear-sig')?.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasInk = false;
    });

    workspace.querySelector('#save-sig')?.addEventListener('click', () => {
      if (!hasInk) {
        showToast('Draw a signature first', 'error');
        return;
      }
      signatureDataUrl = canvas.toDataURL('image/png');
      try {
        sessionStorage.setItem(SESSION_KEY, signatureDataUrl);
      } catch {
        showToast('Signature too large to store in session', 'error');
        return;
      }
      showToast('Signature saved for this session');

      const status = workspace.querySelector('#sig-status');
      if (status) status.style.display = '';

      const applyBtn = workspace.querySelector('#apply-sig');
      if (applyBtn) applyBtn.disabled = false;

      if (pdfData) schedulePreview();
    });

    if (signatureDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = signatureDataUrl;
    }
  }

  function renderUI() {
    if (!pdfData) {
      workspace.innerHTML = renderSignaturePad();
      initPad();
      return;
    }

    const pageCount = pdfData.doc.getPageCount();
    workspace.innerHTML = `
      ${renderSignaturePad()}
      <div class="card">
        <div class="card-title">Place Signature on ${pdfData.file.name}</div>
        <div class="form-row">
          <div class="form-group">
            <label>Page</label>
            <select id="page-select"></select>
          </div>
          <div class="form-group">
            <label>Width (%)</label>
            <input type="range" id="sig-width" min="10" max="60" value="25" />
            <div class="range-value" id="width-val">25%</div>
          </div>
          <div class="form-group">
            <label>Position X (%)</label>
            <input type="range" id="pos-x" min="0" max="100" value="60" />
            <div class="range-value" id="pos-x-val">60%</div>
          </div>
          <div class="form-group">
            <label>Position Y (%)</label>
            <input type="range" id="pos-y" min="0" max="100" value="85" />
            <div class="range-value" id="pos-y-val">85%</div>
          </div>
        </div>
        <div class="btn-group action-dock">
          <button class="btn btn-primary" id="apply-sig" ${!signatureDataUrl ? 'disabled' : ''}>Apply to Page 1 & Download</button>
        </div>
      </div>
      <div class="preview-panel">
        <div class="preview-panel-header">Preview</div>
        <div class="preview-canvas-wrap" id="preview-wrap" style="position:relative;cursor:crosshair"></div>
      </div>
    `;

    initPad();

    const pageSelect = workspace.querySelector('#page-select');
    for (let i = 0; i < pageCount; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Page ${i + 1}`;
      pageSelect.appendChild(opt);
    }

    let overlayEl = null;

    function buildOverlay() {
      if (!overlayEl || !signatureDataUrl) return;
      overlayEl.innerHTML = '';
      const sig = el('div', 'draggable-item');
      sig.style.left = `${workspace.querySelector('#pos-x').value}%`;
      sig.style.top = `${workspace.querySelector('#pos-y').value}%`;
      sig.style.width = `${workspace.querySelector('#sig-width').value}%`;
      const img = document.createElement('img');
      img.src = signatureDataUrl;
      img.style.width = '100%';
      sig.appendChild(img);
      overlayEl.appendChild(sig);
    }

    function schedulePreview() {
      const wrap = workspace.querySelector('#preview-wrap');
      preview.schedule(() => {
        preview.render(wrap, async () => {
          const editorWrap = el('div', 'editor-canvas-wrap');
          const canvas = await renderPagePreview(pdfData.bytes, currentPage, 1.2);
          editorWrap.appendChild(canvas);
          if (signatureDataUrl) {
            overlayEl = el('div', 'editor-overlay');
            editorWrap.appendChild(overlayEl);
            buildOverlay();
          }
          return editorWrap;
        });
      });
    }

    schedulePreview();

    pageSelect.addEventListener('change', () => {
      currentPage = parseInt(pageSelect.value, 10);
      const btn = workspace.querySelector('#apply-sig');
      if (btn) btn.textContent = `Apply to Page ${currentPage + 1} & Download`;
      schedulePreview();
    });

    ['#pos-x', '#pos-y', '#sig-width'].forEach((sel) => {
      workspace.querySelector(sel).addEventListener('input', () => {
        const id = sel.replace('#', '');
        const valMap = { 'pos-x': 'pos-x-val', 'pos-y': 'pos-y-val', 'sig-width': 'width-val' };
        workspace.querySelector(`#${valMap[id]}`).textContent = `${workspace.querySelector(sel).value}%`;
        if (overlayEl) buildOverlay();
      });
    });

    workspace.querySelector('#preview-wrap').addEventListener('click', (e) => {
      const wrap = workspace.querySelector('#preview-wrap');
      const { x, y } = getEditorClickPercent(wrap, e.clientX, e.clientY);
      workspace.querySelector('#pos-x').value = x;
      workspace.querySelector('#pos-y').value = y;
      workspace.querySelector('#pos-x-val').textContent = `${workspace.querySelector('#pos-x').value}%`;
      workspace.querySelector('#pos-y-val').textContent = `${workspace.querySelector('#pos-y').value}%`;
      if (overlayEl) buildOverlay();
    });

    workspace.querySelector('#apply-sig').addEventListener('click', async () => {
      if (!signatureDataUrl) {
        showToast('Draw and save a signature first', 'error');
        return;
      }

      await runWithProgress(async () => {
        const doc = await PDFDocument.load(pdfData.bytes);
        const page = doc.getPages()[currentPage];
        const { width: pw, height: ph } = page.getSize();

        const resp = await fetch(signatureDataUrl);
        const sigBytes = new Uint8Array(await resp.arrayBuffer());
        const img = await doc.embedPng(sigBytes);

        const w = (parseInt(workspace.querySelector('#sig-width').value, 10) / 100) * pw;
        const aspect = img.height / img.width;
        const h = w * aspect;
        const x = (parseInt(workspace.querySelector('#pos-x').value, 10) / 100) * pw;
        const y = ph - (parseInt(workspace.querySelector('#pos-y').value, 10) / 100) * ph - h;

        page.drawImage(img, { x, y, width: w, height: h });
        const result = await doc.save();
        downloadBytes(result, deriveFilename(pdfData.file.name, 'signed'));
        showToast('Signature applied!');
      });
    });
  }

  renderUI();
}