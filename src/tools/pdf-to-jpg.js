import JSZip from 'jszip';
import { loadPdfDocument, pdfPageToImage, downloadBlob } from '../utils/pdf.js';
import { createDropzone, runWithProgress, showToast, el, escapeHtml } from '../utils/ui.js';
import { createPreviewGuard, revokeBlobUrl } from '../utils/preview.js';

export function renderPdfToJpg(container) {
  let pdfData = null;
  const preview = createPreviewGuard();
  const thumbUrls = [];
  let pdfToJpgGen = 0;

  container.innerHTML = '';
  container.appendChild(createDropzone('.pdf,application/pdf', false, async ([file]) => {
    try {
      thumbUrls.forEach(revokeBlobUrl);
      thumbUrls.length = 0;
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
            <label>Image Quality</label>
            <select id="quality">
              <option value="1.5">Standard</option>
              <option value="2" selected>High</option>
              <option value="3">Very High</option>
            </select>
          </div>
        </div>
        <div class="btn-group action-dock">
          <button class="btn btn-primary" id="export-zip">Download All as ZIP</button>
          <button class="btn btn-secondary" id="export-single">Export Page 1</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Page Previews</div>
        <div class="page-grid" id="page-grid"></div>
      </div>
    `;

    const grid = workspace.querySelector('#page-grid');
    const thumbGen = ++pdfToJpgGen;
    let exportPage = 0;
    const exportSingleBtn = workspace.querySelector('#export-single');

    for (let i = 0; i < pageCount; i++) {
      const card = el('div', 'page-card');
      const thumb = el('div', 'page-thumb', '<span class="loading">...</span>');
      card.appendChild(thumb);
      const meta = el('div', 'page-meta');
      meta.innerHTML = `<span class="page-num">Page ${i + 1}</span>`;
      card.appendChild(meta);
      grid.appendChild(card);

      pdfPageToImage(pdfData.bytes, i, 0.5).then((blob) => {
        if (thumbGen !== pdfToJpgGen || !thumb.isConnected) return;
        const url = URL.createObjectURL(blob);
        thumbUrls.push(url);
        thumb.innerHTML = `<img src="${url}" alt="Page ${i + 1}" />`;
      }).catch(() => {
        if (thumbGen !== pdfToJpgGen || !thumb.isConnected) return;
        thumb.innerHTML = '<span class="loading">Error</span>';
      });

      card.addEventListener('click', async () => {
        exportPage = i;
        exportSingleBtn.textContent = `Export Page ${i + 1}`;
        await runWithProgress(async () => {
          const scale = parseFloat(workspace.querySelector('#quality').value);
          const blob = await pdfPageToImage(pdfData.bytes, i, scale);
          downloadBlob(blob, `page-${i + 1}.jpg`);
          showToast(`Downloaded page ${i + 1}`);
        }, `Exporting page ${i + 1}...`);
      });
    }

    exportSingleBtn.addEventListener('click', async () => {
      await runWithProgress(async () => {
        const scale = parseFloat(workspace.querySelector('#quality').value);
        const blob = await pdfPageToImage(pdfData.bytes, exportPage, scale);
        downloadBlob(blob, `page-${exportPage + 1}.jpg`);
        showToast(`Downloaded page ${exportPage + 1}`);
      });
    });

    workspace.querySelector('#export-zip').addEventListener('click', async () => {
      await runWithProgress(async (update) => {
        const zip = new JSZip();
        const s = parseFloat(workspace.querySelector('#quality').value);
        for (let i = 0; i < pageCount; i++) {
          update(`Rendering page ${i + 1}/${pageCount}`, ((i + 1) / pageCount) * 100);
          const blob = await pdfPageToImage(pdfData.bytes, i, s);
          zip.file(`page-${String(i + 1).padStart(3, '0')}.jpg`, blob);
        }
        update('Creating ZIP...', 95);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, `${pdfData.file.name.replace('.pdf', '')}-pages.zip`);
        showToast(`Exported ${pageCount} pages!`);
      }, 'Exporting pages...');
    });
  }

  return () => {
    thumbUrls.forEach(revokeBlobUrl);
    thumbUrls.length = 0;
  };
}