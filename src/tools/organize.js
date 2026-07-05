import { PDFDocument, degrees } from '../utils/pdf.js';
import { loadPdfDocument, renderPagePreview, downloadBytes, deriveFilename } from '../utils/pdf.js';
import { createDropzone, makeSortable, runWithProgress, showToast, el } from '../utils/ui.js';
import { createPreviewGuard } from '../utils/preview.js';

export function renderOrganize(container) {
  let pdfData = null;
  let pages = [];
  const preview = createPreviewGuard();

  container.innerHTML = '';
  container.appendChild(createDropzone('.pdf,application/pdf', false, async ([file]) => {
    try {
      pdfData = await loadPdfDocument(file);
    const count = pdfData.doc.getPageCount();
    pages = Array.from({ length: count }, (_, i) => ({
      srcIndex: i,
      rotation: 0,
      id: crypto.randomUUID(),
    }));
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
    workspace.innerHTML = `
      <div class="toolbar">
        <button class="btn btn-sm btn-secondary" id="dup-sel">Duplicate Selected</button>
        <button class="btn btn-sm btn-secondary" id="del-sel">Delete Selected</button>
        <span class="separator"></span>
        <button class="btn btn-sm btn-secondary" id="rot-left">-90°</button>
        <button class="btn btn-sm btn-secondary" id="rot-right">+90°</button>
        <span class="separator"></span>
        <button class="btn btn-primary" id="save-organized">Download</button>
      </div>
      <div class="selection-bar hidden" id="sel-bar">
        <span id="sel-count">0 selected</span>
        <button class="btn btn-sm btn-secondary" id="clear-sel">Clear</button>
      </div>
      <div class="page-grid" id="page-grid"></div>
      <div class="preview-panel">
        <div class="preview-panel-header">Selected Page Preview</div>
        <div class="preview-canvas-wrap" id="preview-wrap"></div>
      </div>
    `;

    const selected = new Set();
    const grid = workspace.querySelector('#page-grid');

    function updateSelectionBar() {
      const bar = workspace.querySelector('#sel-bar');
      if (selected.size) {
        bar.classList.remove('hidden');
        workspace.querySelector('#sel-count').textContent = `${selected.size} selected`;
      } else {
        bar.classList.add('hidden');
      }
    }

    let thumbGen = 0;

    function showPreview(pg) {
      preview.render(workspace.querySelector('#preview-wrap'), async () => {
        const c = await renderPagePreview(pdfData.bytes, pg.srcIndex, 1.2);
        if (pg.rotation) c.style.transform = `rotate(${pg.rotation}deg)`;
        return c;
      });
    }

    function renderGrid() {
      grid.innerHTML = '';
      const gen = ++thumbGen;
      pages.forEach((pg, displayIdx) => {
        const card = el('div', 'page-card');
        card.dataset.id = pg.id;
        if (selected.has(pg.id)) card.classList.add('selected');

        const thumb = el('div', 'page-thumb', '<span class="loading">...</span>');
        card.appendChild(thumb);
        const meta = el('div', 'page-meta');
        meta.innerHTML = `
          <span class="page-num">#${displayIdx + 1}${pg.rotation ? ` (${pg.rotation}°)` : ''}</span>
          <div class="page-actions">
            <button title="Rotate left" data-action="rot-l">-</button>
            <button title="Duplicate" data-action="dup">+</button>
            <button title="Delete" data-action="del">×</button>
          </div>
        `;
        card.appendChild(meta);
        grid.appendChild(card);

        renderPagePreview(pdfData.bytes, pg.srcIndex).then((canvas) => {
          if (gen !== thumbGen || !thumb.isConnected) return;
          thumb.innerHTML = '';
          if (pg.rotation) canvas.style.transform = `rotate(${pg.rotation}deg)`;
          thumb.appendChild(canvas);
        }).catch(() => {
          if (gen !== thumbGen) return;
          thumb.innerHTML = '<span class="loading">Error</span>';
        });

        card.addEventListener('click', (e) => {
          if (e.target.closest('.page-actions')) return;
          if (selected.has(pg.id)) selected.delete(pg.id);
          else selected.add(pg.id);
          card.classList.toggle('selected');
          updateSelectionBar();
          showPreview(pg);
        });

        meta.querySelector('[data-action="rot-l"]').addEventListener('click', (e) => {
          e.stopPropagation();
          pg.rotation = (pg.rotation - 90 + 360) % 360;
          renderGrid();
        });
        meta.querySelector('[data-action="dup"]').addEventListener('click', (e) => {
          e.stopPropagation();
          pages.splice(displayIdx + 1, 0, { ...pg, id: crypto.randomUUID() });
          renderGrid();
        });
        meta.querySelector('[data-action="del"]').addEventListener('click', (e) => {
          e.stopPropagation();
          if (pages.length <= 1) return;
          pages.splice(displayIdx, 1);
          selected.delete(pg.id);
          renderGrid();
          updateSelectionBar();
          if (pages.length) showPreview(pages[Math.min(displayIdx, pages.length - 1)]);
          else workspace.querySelector('#preview-wrap').innerHTML = '';
        });
      });

      makeSortable(grid, {
        onEnd: (evt) => {
          const [moved] = pages.splice(evt.oldIndex, 1);
          pages.splice(evt.newIndex, 0, moved);
          renderGrid();
        },
      });
    }

    renderGrid();
    if (pages.length) showPreview(pages[0]);

    workspace.querySelector('#clear-sel').addEventListener('click', () => {
      selected.clear();
      grid.querySelectorAll('.selected').forEach((c) => c.classList.remove('selected'));
      updateSelectionBar();
    });

    workspace.querySelector('#dup-sel').addEventListener('click', () => {
      if (!selected.size) {
        showToast('Select pages to duplicate', 'error');
        return;
      }
      const indices = pages.map((p, i) => (selected.has(p.id) ? i : -1)).filter((i) => i >= 0).sort((a, b) => b - a);
      indices.forEach((i) => pages.splice(i + 1, 0, { ...pages[i], id: crypto.randomUUID() }));
      renderGrid();
    });

    workspace.querySelector('#del-sel').addEventListener('click', () => {
      if (selected.size >= pages.length) {
        showToast('Cannot delete all pages', 'error');
        return;
      }
      pages = pages.filter((p) => !selected.has(p.id));
      selected.clear();
      renderGrid();
      updateSelectionBar();
      if (pages.length) showPreview(pages[0]);
      else workspace.querySelector('#preview-wrap').innerHTML = '';
    });

    workspace.querySelector('#rot-left').addEventListener('click', () => {
      if (!selected.size) { showToast('Select pages to rotate', 'error'); return; }
      pages.forEach((p) => {
        if (selected.has(p.id)) p.rotation = (p.rotation - 90 + 360) % 360;
      });
      renderGrid();
    });

    workspace.querySelector('#rot-right').addEventListener('click', () => {
      if (!selected.size) { showToast('Select pages to rotate', 'error'); return; }
      pages.forEach((p) => {
        if (selected.has(p.id)) p.rotation = (p.rotation + 90) % 360;
      });
      renderGrid();
    });

    workspace.querySelector('#save-organized').addEventListener('click', async () => {
      await runWithProgress(async (update) => {
        update('Building PDF...');
        const newDoc = await PDFDocument.create();
        for (let i = 0; i < pages.length; i++) {
          update(`Processing page ${i + 1}/${pages.length}`, ((i + 1) / pages.length) * 100);
          const [copied] = await newDoc.copyPages(pdfData.doc, [pages[i].srcIndex]);
          if (pages[i].rotation) copied.setRotation(degrees(pages[i].rotation));
          newDoc.addPage(copied);
        }
        const result = await newDoc.save();
        downloadBytes(result, deriveFilename(pdfData.file.name, 'organized'));
        showToast('PDF saved!');
      });
    });
  }
}