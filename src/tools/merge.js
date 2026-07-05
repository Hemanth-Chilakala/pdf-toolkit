import { PDFDocument } from '../utils/pdf.js';
import { loadPdfBytes, getPageCount, renderPagePreview, downloadBytes, deriveFilename } from '../utils/pdf.js';
import { createDropzone, makeSortable, runWithProgress, showToast, el, escapeHtml } from '../utils/ui.js';
import { icon } from '../utils/icons.js';
import { createPreviewGuard } from '../utils/preview.js';

export function renderMerge(container) {
  const files = [];
  const preview = createPreviewGuard();

  container.innerHTML = '';
  let loadChain = Promise.resolve();
  const dropzone = createDropzone('.pdf,application/pdf', true, async (newFiles) => {
    loadChain = loadChain.then(async () => {
      const startLen = files.length;
      try {
        for (const file of newFiles.filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'))) {
          const bytes = await loadPdfBytes(file);
          const pages = await getPageCount(bytes);
          files.push({ file, bytes, pages, id: crypto.randomUUID() });
        }
      } catch (err) {
        files.length = startLen;
        throw err;
      } finally {
        renderFileList();
        renderPreviews();
      }
    });
    await loadChain;
  }, { getCount: () => files.length });
  container.appendChild(dropzone);

  const listCard = el('div', 'card hidden', '<div class="card-title">Files to Merge (drag to reorder)</div>');
  const fileList = el('div', 'file-list');
  listCard.appendChild(fileList);
  container.appendChild(listCard);

  const previewCard = el('div', 'card hidden', '<div class="card-title">Preview</div>');
  const previewGrid = el('div', 'page-grid');
  previewCard.appendChild(previewGrid);
  container.appendChild(previewCard);

  const actionBar = el('div', 'btn-group action-dock hidden');
  actionBar.innerHTML = `<button class="btn btn-primary" id="merge-btn">Merge & Download</button>
    <button class="btn btn-secondary" id="clear-btn">Clear All</button>`;
  container.appendChild(actionBar);

  function renderFileList() {
    if (!files.length) {
      listCard.classList.add('hidden');
      actionBar.classList.add('hidden');
      return;
    }
    listCard.classList.remove('hidden');
    actionBar.classList.remove('hidden');
    fileList.innerHTML = '';
    files.forEach((f) => {
      const item = el('div', 'file-item');
      item.dataset.id = f.id;
      item.innerHTML = `
        <span class="file-icon">${icon('file')}</span>
        <span class="file-name">${escapeHtml(f.file.name)}</span>
        <span class="file-pages">${f.pages} pages</span>
        <button class="remove-btn" title="Remove">×</button>
      `;
      item.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = files.findIndex((entry) => entry.id === f.id);
        if (idx !== -1) files.splice(idx, 1);
        renderFileList();
        renderPreviews();
      });
      fileList.appendChild(item);
    });
    makeSortable(fileList, {
      onEnd: (evt) => {
        const [moved] = files.splice(evt.oldIndex, 1);
        files.splice(evt.newIndex, 0, moved);
        renderPreviews();
      },
    });
  }

  function renderPreviews() {
    preview.cancel();
    if (!files.length) {
      previewGrid.innerHTML = '';
      previewCard.classList.add('hidden');
      return;
    }
    previewCard.classList.remove('hidden');
    const gen = preview.nextId();
    previewGrid.innerHTML = '';

    let globalPage = 0;
    for (const f of files) {
      for (let p = 0; p < f.pages; p++) {
        globalPage++;
        const card = el('div', 'page-card');
        const thumb = el('div', 'page-thumb', '<span class="loading">Loading...</span>');
        card.appendChild(thumb);
        const meta = el('div', 'page-meta');
        meta.innerHTML = `<span class="page-num">P${globalPage}</span><span style="font-size:0.65rem;color:var(--text-muted)">${escapeHtml(f.file.name.slice(0, 12))}</span>`;
        card.appendChild(meta);
        previewGrid.appendChild(card);
        renderPagePreview(f.bytes, p).then((canvas) => {
          if (!preview.isCurrent(gen) || !thumb.isConnected) return;
          thumb.innerHTML = '';
          thumb.appendChild(canvas);
        }).catch(() => {
          if (!preview.isCurrent(gen) || !thumb.isConnected) return;
          thumb.innerHTML = '<span class="loading">Error</span>';
        });
      }
    }
  }

  actionBar.querySelector('#merge-btn').addEventListener('click', async () => {
    if (files.length < 2) {
      showToast('Add at least two PDFs to merge', 'error');
      return;
    }
    await runWithProgress(async (update) => {
      update('Merging PDFs...');
      const merged = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        update(`Merging file ${i + 1} of ${files.length}...`, ((i + 1) / files.length) * 100);
        const src = await PDFDocument.load(files[i].bytes);
        const copied = await merged.copyPages(src, src.getPageIndices());
        copied.forEach((page) => merged.addPage(page));
      }
      const result = await merged.save();
      downloadBytes(result, deriveFilename(files[0].file.name, `merged-${files.length}-files`));
      showToast('PDF merged successfully!');
    }, 'Merging PDFs...');
  });

  actionBar.querySelector('#clear-btn').addEventListener('click', () => {
    files.length = 0;
    preview.cancel();
    dropzone.resetDropzone();
    renderFileList();
    renderPreviews();
  });
}