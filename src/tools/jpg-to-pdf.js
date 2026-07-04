import { PDFDocument } from '../utils/pdf.js';
import { embedImage, downloadBytes } from '../utils/pdf.js';
import { createDropzone, makeSortable, runWithProgress, showToast, el, escapeHtml } from '../utils/ui.js';
import { revokeBlobUrl } from '../utils/preview.js';

export function renderJpgToPdf(container) {
  const images = [];

  container.innerHTML = '';
  const dropzone = createDropzone('image/png,image/jpeg', true, async (files) => {
    for (const file of files.filter((f) => /^image\/(png|jpeg)$/.test(f.type))) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const url = URL.createObjectURL(file);
      images.push({ file, bytes, url, type: file.type, id: crypto.randomUUID() });
    }
    renderUI();
  }, { getCount: () => images.length });
  container.appendChild(dropzone);

  const workspace = el('div', 'hidden');
  container.appendChild(workspace);

  function revokeAll() {
    for (const img of images) revokeBlobUrl(img.url);
  }

  function renderGrid() {
    const grid = workspace.querySelector('#image-grid');
    if (!grid) return;
    grid.innerHTML = '';
    images.forEach((img, i) => {
      const card = el('div', 'image-card');
      card.dataset.id = img.id;
      card.innerHTML = `
        <img src="${img.url}" alt="${escapeHtml(img.file.name)}" />
        <div class="image-meta">${i + 1}. ${escapeHtml(img.file.name)}</div>
      `;
      grid.appendChild(card);
    });
    makeSortable(grid, {
      onEnd: (evt) => {
        const [moved] = images.splice(evt.oldIndex, 1);
        images.splice(evt.newIndex, 0, moved);
        renderGrid();
      },
    });
  }

  function renderUI() {
    if (!images.length) return;
    workspace.classList.remove('hidden');

    if (!workspace.querySelector('#image-grid')) {
      workspace.innerHTML = `
        <div class="card">
          <div class="card-title">Images (drag to reorder)</div>
          <div class="image-grid" id="image-grid"></div>
          <div class="form-row" style="margin-top:1rem">
            <div class="form-group">
              <label>Orientation</label>
              <select id="orientation">
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
                <option value="auto">Auto (per image)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Margin (pt)</label>
              <input type="number" id="margin" value="0" min="0" max="72" />
            </div>
          </div>
          <div class="btn-group action-dock">
            <button class="btn btn-primary" id="convert-btn">Convert to PDF</button>
            <button class="btn btn-secondary" id="clear-btn">Clear</button>
          </div>
        </div>
      `;

      workspace.querySelector('#convert-btn').addEventListener('click', async () => {
        await runWithProgress(async (update) => {
          const doc = await PDFDocument.create();
          const orientation = workspace.querySelector('#orientation').value;
          const margin = Math.max(0, parseInt(workspace.querySelector('#margin').value, 10) || 0);

          for (let i = 0; i < images.length; i++) {
            update(`Processing image ${i + 1}/${images.length}`, ((i + 1) / images.length) * 100);
            const img = await embedImage(doc, images[i].bytes, images[i].type);

            let pw, ph;
            if (orientation === 'portrait') {
              pw = 595; ph = 842;
            } else if (orientation === 'landscape') {
              pw = 842; ph = 595;
            } else {
              pw = img.width > img.height ? 842 : 595;
              ph = img.width > img.height ? 595 : 842;
            }

            const page = doc.addPage([pw, ph]);
            const availW = pw - margin * 2;
            const availH = ph - margin * 2;
            const scale = Math.min(availW / img.width, availH / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = margin + (availW - w) / 2;
            const y = margin + (availH - h) / 2;
            page.drawImage(img, { x, y, width: w, height: h });
          }

          const result = await doc.save();
          downloadBytes(result, 'images.pdf');
          showToast('PDF created!');
        });
      });

      workspace.querySelector('#clear-btn').addEventListener('click', () => {
        revokeAll();
        images.length = 0;
        dropzone.resetDropzone();
        workspace.classList.add('hidden');
        workspace.innerHTML = '';
      });
    }

    renderGrid();
  }

  return () => revokeAll();
}