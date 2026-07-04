# PDF Toolkit

A privacy-focused PDF toolkit that runs entirely in the browser. Merge, split, organize,
edit, convert, and protect PDFs — no uploads, no server, no accounts.

![Vite](https://img.shields.io/badge/build-Vite-646CFF)
![JavaScript](https://img.shields.io/badge/language-JavaScript-F7DF1E)
![Tools](https://img.shields.io/badge/tools-15-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Overview

PDF Toolkit is a single-page app with 15 PDF tools grouped into five categories:
organize, edit, convert, security, and utilities. Every operation — parsing, editing,
rendering, and re-saving the PDF — happens client-side in the browser using `pdf-lib`
and `pdf.js`. Files never leave the device: there is no backend, no file upload
endpoint, and no telemetry.

## Features

- **Organize** — merge, split, reorder/rotate/delete pages, extract page ranges.
- **Edit** — add text boxes, insert images, draw a signature, apply watermarks, add page numbers.
- **Convert** — JPG ↔ PDF, HTML to PDF.
- **Security** — password-protect a PDF with AES encryption.
- **Utilities** — crop pages.
- Drag-and-drop file input and page reordering (SortableJS).
- Dark, responsive UI with no build-time theming step.
- Fully static output — deployable to any static host at zero cost.

## How it works

```
  Browser
  ───────
  File input / drag-drop
        │
        ▼
  pdf.js  ──── render pages, extract page images/text
        │
        ▼
  pdf-lib ──── merge, split, rotate, crop, watermark, encrypt, rebuild the PDF
        │
        ▼
  Blob → download                (nothing is sent to a server)
```

Each tool in `src/tools/` is an independent module that takes the loaded PDF (or images),
performs one operation with `pdf-lib`/`pdf.js`/`jsPDF`, and returns a new file for download.
The shell in `src/app.js` handles routing between tools and shares common UI/preview code
from `src/utils/`.

## Project structure

```
pdf-toolkit/
├── index.html                 Entry point
├── package.json               Scripts and dependencies
├── vite.config.js             Build config (base: './' for static hosting)
├── public/
│   └── sw.js                  Service worker
├── scripts/
│   ├── serve.mjs              Local production server (npm start)
│   ├── test-all-tools.mjs     Feature test suite (16 assertions)
│   └── ui-check-all.mjs       Browser smoke tests (Playwright)
├── src/
│   ├── app.js                 Shell UI and routing
│   ├── main.js                App entry point
│   ├── style.css              Dark theme
│   ├── tools/                 One module per tool (merge, split, watermark, protect, ...)
│   │   └── registry.js        Tool catalog (categories, names, shortcuts)
│   └── utils/                 PDF helpers, preview rendering, UI components
├── test-fixtures/             Sample PDFs used by the test suite
└── .github/workflows/         CI tests + GitHub Pages deploy
```

## Prerequisites

- Node.js 18 or newer (includes npm).
- A modern browser (Chrome, Edge, Firefox, Safari).

## Quickstart

```bash
git clone https://github.com/Hemanth-Chilakala/pdf-toolkit.git
cd pdf-toolkit
npm install
npm start
```

Open the URL printed in the terminal (default `http://localhost:5174`). Do not open
`index.html` directly by double-clicking it — browsers block local apps loaded from disk.

For hot-reload during development:

```bash
npm run dev
```

## Usage

1. Pick a tool from the categorized grid (Organize, Edit, Convert, Security, Utilities).
2. Drag in a PDF (or images, for JPG-to-PDF/HTML-to-PDF).
3. Adjust the tool's options (page ranges, rotation, watermark text/opacity, password, etc.).
4. Download the result — the file is generated and saved locally; nothing is uploaded.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Build (if needed) + serve production build |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm test` | Run feature tests (16 assertions) |
| `npm run test:ui` | Browser smoke tests (requires running server) |

## Deployment

The repo includes a GitHub Actions workflow that builds and deploys to GitHub Pages on
every push to `main` (set **Settings → Pages → Source** to **GitHub Actions** once).
`vite.config.js` uses `base: './'` so the same build works unmodified on Vercel, Netlify,
or any static host — just run `npm run build` and deploy the `dist/` folder.

## Verification

- `npm test` runs 16 feature assertions across the tool set against the sample PDFs in
  `test-fixtures/` (verified passing).
- `npm run test:ui` drives the built app with Playwright for browser smoke tests.
- Manually exercised merge, split, watermark, protect, and JPG-to-PDF in the browser to
  confirm downloads open correctly and page content is preserved.

## Privacy

No file a user opens in this app is ever transmitted anywhere. All PDF parsing, editing,
and generation happens in-memory in the browser tab; closing the tab discards everything.
There is no server component, database, or analytics.

## License

Released under the [MIT License](LICENSE).
