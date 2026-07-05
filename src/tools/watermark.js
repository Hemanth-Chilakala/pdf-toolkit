import { PDFDocument, rgb, degrees, StandardFonts } from '../utils/pdf.js';
import { loadPdfDocument, renderPagePreview, embedImage, downloadBytes, deriveFilename } from '../utils/pdf.js';
import { createDropzone, runWithProgress, showToast, el } from '../utils/ui.js';
import { icon } from '../utils/icons.js';
import { markConfigured } from '../utils/tool-flow.js';
import { createPreviewGuard, revokeBlobUrl } from '../utils/preview.js';
import { escapeHtml } from '../utils/ui.js';

export function renderWatermark(container) {
  let pdfData = null;
  let wmImage = null;
  const preview = createPreviewGuard();

  container.innerHTML = '';
  container.appendChild(createDropzone('.pdf,application/pdf', false, async ([file]) => {
    try {
      revokeBlobUrl(wmImage?.url);
      wmImage = null;
      pdfData = await loadPdfDocument(file);
      preview.cancel();
      renderUI();
    } catch (err) {
      showToast(err.message || 'Could not load PDF', 'error');
    }
  }));

  const workspace = el('div', 'hidden');
  container.appendChild(workspace);

  function getSettings() {
    return {
      type: workspace.querySelector('#wm-type').value,
      text: workspace.querySelector('#wm-text').value,
      fontSize: parseInt(workspace.querySelector('#wm-size').value, 10),
      color: workspace.querySelector('#wm-color').value,
      opacity: parseInt(workspace.querySelector('#wm-opacity').value, 10) / 100,
      rotation: parseInt(workspace.querySelector('#wm-rotation').value, 10),
      position: workspace.querySelector('#wm-position').value,
    };
  }

  function renderUI() {
    if (!pdfData) return;
    workspace.classList.remove('hidden');
    preview.cancel();

    workspace.innerHTML = `
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>Type</label>
            <select id="wm-type">
              <option value="text">Text Watermark</option>
              <option value="image">Image Watermark</option>
            </select>
          </div>
        </div>
        <div id="text-options">
          <div class="form-row">
            <div class="form-group" style="flex:2">
              <label>Watermark Text</label>
              <input type="text" id="wm-text" value="CONFIDENTIAL" />
            </div>
            <div class="form-group">
              <label>Font Size</label>
              <input type="number" id="wm-size" value="48" min="12" max="120" />
            </div>
            <div class="form-group">
              <label>Color</label>
              <input type="color" id="wm-color" value="#888888" />
            </div>
          </div>
        </div>
        <div id="image-options" class="hidden">
          <div class="dropzone" id="wm-img-drop">
            <div class="dropzone-inner">
              <div class="dropzone-icon">${icon('image')}</div>
              <div class="dropzone-copy">
                <h3>Drop watermark image (PNG/JPG)</h3>
                <p>or click to browse</p>
              </div>
            </div>
            <input type="file" accept="image/png,image/jpeg" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Opacity</label>
            <input type="range" id="wm-opacity" min="5" max="100" value="30" />
            <div class="range-value" id="opacity-val">30%</div>
          </div>
          <div class="form-group">
            <label>Rotation (°)</label>
            <input type="range" id="wm-rotation" min="-90" max="90" value="-45" />
            <div class="range-value" id="rotation-val">-45°</div>
          </div>
          <div class="form-group">
            <label>Position</label>
            <select id="wm-position">
              <option value="center">Center</option>
              <option value="top-left">Top Left</option>
              <option value="top-right">Top Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="diagonal">Diagonal (tiled)</option>
            </select>
          </div>
        </div>
        <div class="btn-group action-dock">
          <button class="btn btn-primary" id="apply-wm">Apply Watermark & Download</button>
        </div>
      </div>
      <div class="preview-panel">
        <div class="preview-panel-header">Preview (Page 1)</div>
        <div class="preview-canvas-wrap" id="preview-wrap"></div>
      </div>
    `;

    markConfigured();

    const wmType = workspace.querySelector('#wm-type');
    const textOpts = workspace.querySelector('#text-options');
    const imageOpts = workspace.querySelector('#image-options');
    const imgDrop = workspace.querySelector('#wm-img-drop');

    wmType.addEventListener('change', () => {
      textOpts.classList.toggle('hidden', wmType.value !== 'text');
      imageOpts.classList.toggle('hidden', wmType.value !== 'image');
      if (wmType.value === 'text') {
        revokeBlobUrl(wmImage?.url);
        wmImage = null;
      }
      schedulePreview();
    });

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
        if (file && /^image\/(png|jpeg)$/.test(file.type)) await loadWmImage(file);
        else if (file) showToast('Only PNG/JPG images are supported', 'error');
      };
      imgInput.onchange = async () => {
        if (imgInput.files[0]) await loadWmImage(imgInput.files[0]);
        imgInput.value = '';
      };
    }

    bindImgDrop();

    async function loadWmImage(file) {
      revokeBlobUrl(wmImage?.url);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const url = URL.createObjectURL(file);
      wmImage = { bytes, url, type: file.type };
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
      schedulePreview();
    }

    function schedulePreview() {
      const wrap = workspace.querySelector('#preview-wrap');
      preview.schedule(() => {
        preview.render(wrap, async () => {
          const canvas = await renderPagePreview(pdfData.bytes, 0, 0.85);
          const ctx = canvas.getContext('2d');
          const page = pdfData.doc.getPage(0);
          const { width: pw, height: ph } = page.getSize();
          const scale = canvas.width / pw;
          const settings = getSettings();

          if (settings.type === 'text' && settings.text.trim()) {
            await paintTextWatermark(ctx, pw, ph, scale, settings);
          } else if (settings.type === 'image' && wmImage) {
            await paintImageWatermark(ctx, pw, ph, scale, settings, wmImage.url);
          }

          const editorWrap = el('div', 'editor-canvas-wrap');
          editorWrap.appendChild(canvas);
          return editorWrap;
        });
      });
    }

    const refresh = () => schedulePreview();
    workspace.querySelector('#wm-opacity').addEventListener('input', (e) => {
      workspace.querySelector('#opacity-val').textContent = `${e.target.value}%`;
      refresh();
    });
    workspace.querySelector('#wm-rotation').addEventListener('input', (e) => {
      workspace.querySelector('#rotation-val').textContent = `${e.target.value}°`;
      refresh();
    });
    workspace.querySelector('#wm-text').addEventListener('input', refresh);
    workspace.querySelector('#wm-size').addEventListener('input', refresh);
    workspace.querySelector('#wm-color').addEventListener('input', refresh);
    workspace.querySelector('#wm-position').addEventListener('change', refresh);

    schedulePreview();

    workspace.querySelector('#apply-wm').addEventListener('click', async () => {
      const settings = getSettings();
      if (settings.type === 'text' && !settings.text.trim()) {
        showToast('Enter watermark text', 'error');
        return;
      }
      if (settings.type === 'image' && !wmImage) {
        showToast('Upload a watermark image', 'error');
        return;
      }

      await runWithProgress(async (update) => {
        const doc = await PDFDocument.load(pdfData.bytes);
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        const pages = doc.getPages();

        let embeddedImg = null;
        if (settings.type === 'image' && wmImage) {
          embeddedImg = await embedImage(doc, wmImage.bytes, wmImage.type);
        }

        for (let i = 0; i < pages.length; i++) {
          update(`Watermarking page ${i + 1}/${pages.length}`, ((i + 1) / pages.length) * 100);
          const page = pages[i];
          const { width, height } = page.getSize();

          if (settings.type === 'text') {
            applyTextWatermark(page, font, width, height, settings);
          } else if (embeddedImg) {
            applyImageWatermark(page, embeddedImg, width, height, settings);
          }
        }

        const result = await doc.save();
        downloadBytes(result, deriveFilename(pdfData.file.name, 'watermarked'));
        showToast('Watermark applied!');
      });
    });
  }
}

function parseColor(hex) {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return rgb(0.5, 0.5, 0.5);
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  );
}

function getCenterPoint(position, pw, ph, itemW, itemH) {
  const margin = 40;
  const centers = {
    center: { cx: pw / 2, cy: ph / 2 },
    'top-left': { cx: margin + itemW / 2, cy: ph - margin - itemH / 2 },
    'top-right': { cx: pw - margin - itemW / 2, cy: ph - margin - itemH / 2 },
    'bottom-left': { cx: margin + itemW / 2, cy: margin + itemH / 2 },
    'bottom-right': { cx: pw - margin - itemW / 2, cy: margin + itemH / 2 },
  };
  return centers[position] || centers.center;
}

function getRotatedOrigin(cx, cy, itemW, itemH, rotationDeg) {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cx - (itemW / 2) * cos + (itemH / 2) * sin,
    y: cy - (itemW / 2) * sin - (itemH / 2) * cos,
  };
}

function applyTextWatermark(page, font, pw, ph, settings) {
  const { text, fontSize, color, opacity, rotation, position } = settings;
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const textHeight = fontSize;
  const fill = parseColor(color);

  if (position === 'diagonal') {
    const rowStep = fontSize * 2.8;
    const colStep = textWidth + fontSize * 1.5;
    let row = 0;
    for (let y = fontSize; y < ph + rowStep; y += rowStep) {
      const stagger = (row % 2) * (colStep / 2);
      for (let x = -textWidth + stagger; x < pw + textWidth; x += colStep) {
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: fill,
          opacity,
          rotate: degrees(rotation),
        });
      }
      row += 1;
    }
    return;
  }

  const { cx, cy } = getCenterPoint(position, pw, ph, textWidth, textHeight);
  const { x, y } = getRotatedOrigin(cx, cy, textWidth, textHeight, rotation);
  page.drawText(text, {
    x,
    y,
    size: fontSize,
    font,
    color: fill,
    opacity,
    rotate: degrees(rotation),
  });
}

function applyImageWatermark(page, embeddedImg, pw, ph, settings) {
  const { opacity, rotation, position } = settings;
  const imgW = pw * (position === 'diagonal' ? 0.22 : 0.4);
  const imgH = (embeddedImg.height / embeddedImg.width) * imgW;

  if (position === 'diagonal') {
    const rowStep = imgH * 2.2;
    const colStep = imgW * 1.4;
    let row = 0;
    for (let y = imgH * 0.5; y < ph + rowStep; y += rowStep) {
      const stagger = (row % 2) * (colStep / 2);
      for (let x = -imgW + stagger; x < pw + imgW; x += colStep) {
        page.drawImage(embeddedImg, {
          x,
          y,
          width: imgW,
          height: imgH,
          opacity,
          rotate: degrees(rotation),
        });
      }
      row += 1;
    }
    return;
  }

  const { cx, cy } = getCenterPoint(position, pw, ph, imgW, imgH);
  const { x, y } = getRotatedOrigin(cx, cy, imgW, imgH, rotation);
  page.drawImage(embeddedImg, {
    x,
    y,
    width: imgW,
    height: imgH,
    opacity,
    rotate: degrees(rotation),
  });
}

async function paintTextWatermark(ctx, pw, ph, scale, settings) {
  const { text, fontSize, color, opacity, rotation, position } = settings;
  const size = fontSize * scale;
  const rad = (rotation * Math.PI) / 180;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.font = `bold ${size}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = color;

  const metrics = ctx.measureText(text);
  const tw = metrics.width;
  const th = size;

  if (position === 'diagonal') {
    const rowStep = size * 2.8;
    const colStep = tw + size * 1.5;
    let row = 0;
    for (let y = size; y < ph * scale + rowStep; y += rowStep) {
      const stagger = (row % 2) * (colStep / 2);
      for (let x = -tw + stagger; x < pw * scale + tw; x += colStep) {
        ctx.save();
        ctx.translate(x + tw / 2, y);
        ctx.rotate(rad);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
      row += 1;
    }
  } else {
    const { cx, cy } = getCenterPoint(position, pw, ph, tw / scale, th / scale);
    ctx.translate(cx * scale, (ph - cy) * scale);
    ctx.rotate(rad);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
  }

  ctx.restore();
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function paintImageWatermark(ctx, pw, ph, scale, settings, imageUrl) {
  const img = await loadImageElement(imageUrl);
  const { opacity, rotation, position } = settings;
  const imgW = pw * scale * (position === 'diagonal' ? 0.22 : 0.4);
  const imgH = (img.height / img.width) * imgW;
  const rad = (rotation * Math.PI) / 180;

  ctx.save();
  ctx.globalAlpha = opacity;

  if (position === 'diagonal') {
    const rowStep = imgH * 2.2;
    const colStep = imgW * 1.4;
    let row = 0;
    for (let y = imgH * 0.5; y < ph * scale + rowStep; y += rowStep) {
      const stagger = (row % 2) * (colStep / 2);
      for (let x = -imgW + stagger; x < pw * scale + imgW; x += colStep) {
        ctx.save();
        ctx.translate(x + imgW / 2, y + imgH / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
        ctx.restore();
      }
      row += 1;
    }
  } else {
    const { cx, cy } = getCenterPoint(position, pw, ph, imgW / scale, imgH / scale);
    ctx.translate(cx * scale, (ph - cy) * scale);
    ctx.rotate(rad);
    ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
  }

  ctx.restore();
}