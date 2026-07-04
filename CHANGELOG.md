# PDF Toolkit — Audit Report

Issues found during the full proofread of all 15 tools, shared utilities, and deployment flow — and how each was fixed.

**Scope:** `pdf-toolkit/` (active final version)  
**Date:** July 4, 2026  
**Verification:** `npm run build` · `npm run test` (16/16) · `npm run test:ui` (15/15)

---

## Summary

| Category | Issues found | Status |
|----------|-------------|--------|
| Preview race conditions | 10 tools | Fixed |
| Logic / coordinate bugs | 6 tools | Fixed |
| Memory leaks (blob URLs) | 4 tools | Fixed |
| Error handling gaps | 5 tools | Fixed |
| Security (unsanitized HTML) | 2 tools | Fixed |
| Deployment / blank screen | 1 issue | Fixed |

---

## 1. Preview race conditions

### Problem

Several tools call async preview functions (`renderPagePreview`, slider updates, page changes) without guarding against overlapping requests. When a user moves a slider quickly or switches pages, multiple renders run at once. Stale results append to the DOM instead of replacing it — causing **stacked canvases**, flicker, or wrong preview content.

This was first seen in **Crop PDF** (reported bug) and existed in most preview-heavy tools.

### Fix

Added a shared utility at `src/utils/preview.js`:

- `createPreviewGuard()` — generation counter so only the latest async render applies
- `schedule(fn, ms)` — debounced preview updates (80ms default)
- `cancel()` — invalidates in-flight renders on new file load or UI reset
- `revokeBlobUrl(url)` — cleans up object URLs when image state changes

### Tools updated

| Tool | Before | After |
|------|--------|-------|
| **crop** | Inline `previewGen` counter | Migrated to `createPreviewGuard` |
| **extract** | Already fixed in prior pass | Uses guard + thumb generation ID |
| **split** | Already fixed in prior pass | Uses guard |
| **organize** | Already fixed in prior pass | Uses guard |
| **merge** | No guard on thumbnail grid | `preview.nextId()` + `isCurrent()` check per thumb |
| **rotate** | No guard; preview never updated on page click | Guard + `showPreview()` on card click |
| **add-text** | Unguarded `refreshPreview()` | `preview.render()` wrapper |
| **add-image** | Unguarded; re-rendered full canvas on every slider tick | Debounced `schedulePreview()`; overlay-only updates when possible |
| **signature** | Unguarded `refreshPreview()` | Debounced guard; overlay rebuild without full DOM wipe |
| **watermark** | Unguarded; rapid slider changes stacked canvases | Debounced `schedulePreview()` |
| **page-numbers** | Unguarded on every input/change | Debounced `schedulePreview()` |
| **pdf-to-jpg** | Thumb renders could apply after re-load | `thumbGen` counter per grid render |

---

## 2. Logic and coordinate bugs

### Merge — remove button used stale index

**Problem:** After drag-reordering files, the remove button called `files.splice(i, 1)` using the index captured at render time. Reordering left the button pointing at the wrong file.

**Fix:** Remove by stable `id` via `files.findIndex(entry => entry.id === f.id)`.

---

### Rotate — preview never updated on page selection

**Problem:** Clicking a page card toggled selection styling but the main preview panel always showed page 1.

**Fix:** Added `showPreview(idx)` on card click; preview label updates to `Page N`.

---

### Add Text — preview Y position didn't match PDF output

**Problem:** PDF draws text at a **baseline** measured from the bottom (`y = height - (y% / 100) * height`). The preview overlay used CSS `top: y%`, placing the top of the text box at the click point — so preview and output were vertically misaligned.

**Fix:** Preview overlay now uses `bottom: (100 - y)%` with `top: auto` and `lineHeight: 1` to align with PDF baseline positioning.

---

### Page Numbers — preview used rough CSS percentages

**Problem:** Preview positioned labels with hardcoded values like `left: 45%; top: 92%`. PDF output used the `POSITIONS` map with fixed point offsets (e.g. `y: 30` from bottom, `x: 40` from left). Preview didn't match the downloaded PDF.

**Fix:** Preview now measures text width with canvas `measureText`, calls the same `POSITIONS` function, and converts PDF coordinates to CSS `left` / `bottom` percentages.

---

### Add Image / Watermark — stale image state on new PDF

**Problem:** Loading a new PDF didn't clear `imageData` / `wmImage`. A watermark or placed image from the previous session could appear on the new document.

**Fix:** `revokeBlobUrl()` + set image state to `null` in the PDF dropzone handler before loading the new file.

---

### Signature — saving signature reset the entire UI

**Problem:** Clicking "Save Signature" called `renderUI()` which wiped the DOM — losing PDF upload state, page selection, and slider positions.

**Fix:** Save handler now only updates the status text, enables the apply button, and refreshes the preview overlay. No full `renderUI()` call when a PDF is already loaded.

---

### JPG to PDF — form reset on every image add

**Problem:** `renderUI()` rebuilt the entire workspace (including orientation/margin inputs) every time images were added or reordered, resetting user settings.

**Fix:** Split into `renderGrid()` (reorders thumbnails only) and one-time workspace setup. Sortable `onEnd` calls `renderGrid()` instead of full `renderUI()`.

---

## 3. Memory leaks

### Problem

`URL.createObjectURL()` was used for image previews and PDF-to-JPG thumbnails but URLs were never revoked. Replacing images or loading new files leaked blob URLs in memory.

### Fix

`revokeBlobUrl()` called when:

| Tool | When revoked |
|------|-------------|
| **add-image** | New image selected; new PDF loaded |
| **watermark** | New watermark image; new PDF loaded |
| **jpg-to-pdf** | Clear all button |
| **pdf-to-jpg** | New PDF loaded (revokes all thumb URLs) |

---

## 4. Error handling

### Problem

Several tools had no `try/catch` around PDF load or processing. Failures threw unhandled promise rejections with no user feedback.

### Fix

| Tool | Added |
|------|-------|
| **rotate** | try/catch on PDF load → error toast |
| **add-text** | try/catch on PDF load |
| **add-image** | try/catch on PDF load |
| **signature** | try/catch on PDF load |
| **watermark** | try/catch on PDF load |
| **page-numbers** | try/catch on PDF load |
| **crop** | try/catch on PDF load |
| **pdf-to-jpg** | try/catch on PDF load |
| **protect** | try/catch on encrypt; try/catch on load |
| **html-to-pdf** | try/catch around full conversion; iframe load timeout (10s) instead of blind 500ms `setTimeout` |

---

## 5. Security

### Problem

**Merge** and **JPG to PDF** inserted filenames directly into `innerHTML`. A crafted filename with `<` or `"` could break markup or enable XSS.

### Fix

Filenames passed through `escapeHtml()` from `src/utils/ui.js` before insertion into the DOM.

---

## 6. Shared utility improvements (prior pass, retained)

These were fixed earlier and kept as part of the stable base:

| File | Fix |
|------|-----|
| `src/utils/ui.js` | `makeSortable()` destroys prior Sortable instance (WeakMap) — prevents duplicate drag handlers |
| `src/utils/ui.js` | `runWithProgress()` shows error toasts on failure |
| `src/utils/ui.js` | `handleFiles()` wrapped in try/catch |
| `src/utils/pdf.js` | `pdf.destroy()` in finally blocks |
| `src/utils/pdf.js` | Null blob check in `pdfPageToImage` |
| `src/app.js` | Skip re-opening same tool; invalid hash → home |

---

## 7. Deployment — blank screen on open

### Problem

Users who unzipped `pdf-toolkit-final.zip` and double-clicked `index.html` saw a **blank screen**. Browsers block ES module scripts over the `file://` protocol (CORS policy). The HTML loaded but all JavaScript failed silently.

### Fix

| Change | Purpose |
|--------|---------|
| `scripts/serve.mjs` | Local HTTP server for the production `dist/` build |
| `npm start` script | One command: build if needed, then serve on port 5174 (auto-increments if busy) |
| `index.html` fallback | Inline script detects `file://` and shows setup instructions instead of blank page |
| `src/main.js` | Service worker registration skipped on `file://` |
| `pdf-toolkit-final.zip` | Now includes pre-built `dist/` so `npm start` works without a separate build step |
| `ARCHIVE-README.md` | Warns not to double-click `index.html` |

### Correct way to run

```bash
cd pdf-toolkit
npm install
npm start
# → http://localhost:5174
```

---

## Files changed

```
src/utils/preview.js          (new — preview guard + blob revoke)
src/main.js                   (service worker file:// guard)
index.html                    (file:// fallback message)
package.json                  (npm start script)
scripts/serve.mjs             (new — local static server)
ARCHIVE-README.md             (startup instructions)

src/tools/merge.js
src/tools/rotate.js
src/tools/add-text.js
src/tools/add-image.js
src/tools/signature.js
src/tools/watermark.js
src/tools/page-numbers.js
src/tools/crop.js
src/tools/jpg-to-pdf.js
src/tools/pdf-to-jpg.js
src/tools/html-to-pdf.js
src/tools/protect.js
src/tools/extract.js          (prior pass)
src/tools/split.js            (prior pass)
src/tools/organize.js         (prior pass)
```

---

## Test results (post-fix)

```
npm run build     ✓
npm run test      16/16 passed (15 tools + registry)
npm run test:ui   15/15 tools navigated; merge upload; watermark preview
```

---

## What was not changed

- `pdf-toolkit-v1/` — frozen earlier version, left untouched
- Tool feature set — still 15 tools, no additions or removals
- Visual design / dark theme — no UI redesign in this pass