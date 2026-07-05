import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function loadPdfBytes(file) {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function loadPdfDocument(file) {
  const bytes = await loadPdfBytes(file);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  return { bytes, doc, file };
}

export async function getPageCount(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

export async function renderPagePreview(bytes, pageIndex, scale = 0.4) {
  const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  } finally {
    await pdf.destroy();
  }
}

export async function renderAllPreviews(bytes, scale = 0.35, onProgress) {
  const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;
  try {
    const count = pdf.numPages;
    const canvases = [];
    for (let i = 1; i <= count; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
      canvases.push(canvas);
      onProgress?.(i, count);
    }
    return canvases;
  } finally {
    await pdf.destroy();
  }
}

export async function pdfPageToImage(bytes, pageIndex, scale = 2) {
  const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) reject(new Error('Failed to export page image'));
        else resolve(blob);
      }, 'image/jpeg', 0.92);
    });
  } finally {
    await pdf.destroy();
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  downloadBlob(blob, filename);
}

/** Builds "name-suffix.pdf" from a source filename, stripping its extension. */
export function deriveFilename(sourceName, suffix) {
  const base = sourceName.replace(/\.pdf$/i, '');
  return `${base}-${suffix}.pdf`;
}

export async function embedImage(pdfDoc, imageBytes, type) {
  if (type === 'png' || imageBytes[0] === 0x89) {
    return pdfDoc.embedPng(imageBytes);
  }
  return pdfDoc.embedJpg(imageBytes);
}

export function parsePageRange(input, maxPages) {
  const pages = new Set();
  const parts = input.split(',').map((s) => s.trim());
  for (const part of parts) {
    if (!part) continue;
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : maxPages;
      for (let i = start; i <= end && i <= maxPages; i++) {
        if (i >= 1) pages.add(i - 1);
      }
    } else {
      const num = parseInt(part, 10);
      if (num >= 1 && num <= maxPages) pages.add(num - 1);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

export { PDFDocument, degrees, rgb, StandardFonts };