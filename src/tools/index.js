import { renderMerge } from './merge.js';
import { renderSplit } from './split.js';
import { renderOrganize } from './organize.js';
import { renderRotate } from './rotate.js';
import { renderExtract } from './extract.js';
import { renderAddText } from './add-text.js';
import { renderAddImage } from './add-image.js';
import { renderSignature } from './signature.js';
import { renderWatermark } from './watermark.js';
import { renderPageNumbers } from './page-numbers.js';
import { renderJpgToPdf } from './jpg-to-pdf.js';
import { renderPdfToJpg } from './pdf-to-jpg.js';
import { renderHtmlToPdf } from './html-to-pdf.js';
import { renderProtect } from './protect.js';
import { renderCrop } from './crop.js';

export const TOOL_RENDERERS = {
  merge: renderMerge,
  split: renderSplit,
  organize: renderOrganize,
  rotate: renderRotate,
  extract: renderExtract,
  'add-text': renderAddText,
  'add-image': renderAddImage,
  signature: renderSignature,
  watermark: renderWatermark,
  'page-numbers': renderPageNumbers,
  'jpg-to-pdf': renderJpgToPdf,
  'pdf-to-jpg': renderPdfToJpg,
  'html-to-pdf': renderHtmlToPdf,
  protect: renderProtect,
  crop: renderCrop,
};