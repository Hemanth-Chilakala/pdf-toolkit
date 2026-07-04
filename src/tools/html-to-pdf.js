import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { showToast, runWithProgress } from '../utils/ui.js';
import { markConfigured } from '../utils/tool-flow.js';

function waitForIframeLoad(iframe) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Preview timed out — check your HTML')), 10000);
    const done = () => {
      clearTimeout(timeout);
      resolve();
    };
    if (iframe.contentDocument?.readyState === 'complete') {
      requestAnimationFrame(() => requestAnimationFrame(done));
      return;
    }
    iframe.addEventListener('load', () => requestAnimationFrame(() => requestAnimationFrame(done)), { once: true });
  });
}

export function renderHtmlToPdf(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-title">HTML Content</div>
      <div class="form-row">
        <div class="form-group">
          <label>Page Size</label>
          <select id="page-size">
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
            <option value="legal">Legal</option>
          </select>
        </div>
        <div class="form-group">
          <label>Orientation</label>
          <select id="orientation">
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>HTML (with inline CSS supported)</label>
        <textarea id="html-input"><!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
  h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
  p { line-height: 1.6; }
  .highlight { background: #fef3c7; padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
  <h1>Sample Document</h1>
  <p>This is a <span class="highlight">sample HTML document</span> that will be converted to PDF entirely in your browser.</p>
  <p>No data is sent to any server. Your content stays private.</p>
  <ul>
    <li>Supports basic HTML and CSS</li>
    <li>Headings, paragraphs, lists</li>
    <li>Inline styles and style blocks</li>
  </ul>
</body>
</html></textarea>
      </div>
      <div class="btn-group action-dock">
        <button class="btn btn-secondary" id="preview-btn">Preview</button>
        <button class="btn btn-primary" id="convert-btn">Convert to PDF</button>
      </div>
    </div>
    <div class="preview-panel" id="preview-panel">
      <div class="preview-panel-header">Live Preview</div>
      <div class="preview-canvas-wrap" id="preview-wrap" style="background:#fff;padding:0;overflow:auto;max-height:600px">
        <iframe id="preview-frame" sandbox="allow-same-origin" referrerpolicy="no-referrer" style="width:100%;min-height:500px;border:none;background:#fff"></iframe>
      </div>
    </div>
  `;

  const htmlInput = container.querySelector('#html-input');
  const previewFrame = container.querySelector('#preview-frame');

  function updatePreview() {
    const html = htmlInput.value;
    previewFrame.srcdoc = html;
  }

  updatePreview();
  markConfigured();
  let previewTimer = null;
  htmlInput.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      updatePreview();
      markConfigured();
    }, 300);
  });

  container.querySelector('#preview-btn').addEventListener('click', updatePreview);

  container.querySelector('#convert-btn').addEventListener('click', async () => {
    await runWithProgress(async (update) => {
      try {
        update('Rendering HTML...');
        const html = htmlInput.value;
        previewFrame.srcdoc = html;

        await waitForIframeLoad(previewFrame);

        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        const body = iframeDoc?.body;
        if (!body) throw new Error('Could not read preview content');

        update('Capturing content...', 40);
        const canvas = await html2canvas(body, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });

        update('Generating PDF...', 70);
        const pageSize = container.querySelector('#page-size').value;
        const orientation = container.querySelector('#orientation').value;
        const pdf = new jsPDF({ orientation, unit: 'pt', format: pageSize });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 40;
        const availW = pageWidth - margin * 2;
        const availH = pageHeight - margin * 2;

        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const imgW = canvas.width;
        const imgH = canvas.height;
        const ratio = Math.min(availW / imgW, availH / imgH);
        const w = imgW * ratio;
        const h = imgH * ratio;

        if (h <= availH) {
          pdf.addImage(imgData, 'JPEG', margin + (availW - w) / 2, margin, w, h);
        } else {
          let position = 0;
          const pageCanvas = document.createElement('canvas');
          const pageH = (availH / ratio);
          pageCanvas.width = imgW;
          pageCanvas.height = pageH;
          const ctx = pageCanvas.getContext('2d');

          while (position < imgH) {
            const sliceH = Math.min(pageH, imgH - position);
            pageCanvas.height = sliceH;
            ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(canvas, 0, position, imgW, sliceH, 0, 0, imgW, sliceH);
            const pageImg = pageCanvas.toDataURL('image/jpeg', 0.92);
            if (position > 0) pdf.addPage();
            const slicePdfH = sliceH * ratio;
            pdf.addImage(pageImg, 'JPEG', margin, margin, availW, slicePdfH);
            position += sliceH;
          }
        }

        update('Saving...', 95);
        const blob = pdf.output('blob');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'document.pdf';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('PDF created!');
      } catch (err) {
        throw new Error(err.message || 'Conversion failed');
      }
    }, 'Converting HTML to PDF...');
  });
}