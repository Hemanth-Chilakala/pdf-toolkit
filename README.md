# PDF Toolkit

A privacy-focused PDF toolkit that runs entirely in your browser. Merge, split, edit, convert, and protect PDFs — no uploads, no server.

![15 tools](https://img.shields.io/badge/tools-15-blue) ![license](https://img.shields.io/badge/license-MIT-green)

## Features

- **15 tools** — merge, split, organize, rotate, extract, add text/image, signature, watermark, page numbers, JPG↔PDF, HTML→PDF, protect, crop
- **100% local** — files never leave your device
- **No account** — open and use immediately
- **Dark UI** — polished, responsive interface

## Quick start

**Do not double-click `index.html`** — browsers block local apps loaded from disk.

```bash
npm install
npm start
```

Open the URL printed in the terminal (default: http://localhost:5174)

### Development

```bash
npm run dev
```

Hot reload at http://localhost:5174

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Build (if needed) + serve production build |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm test` | Run feature tests (16 assertions) |
| `npm run test:ui` | Browser smoke tests (requires running server) |

## Deploy

Static output in `dist/` — works on GitHub Pages, Vercel, Netlify, or any static host.

```bash
npm run build
# Deploy the dist/ folder
```

`vite.config.js` uses `base: './'` for relative asset paths (GitHub Pages compatible).

## Tech stack

- [Vite](https://vitejs.dev/) — build tooling
- [pdf-lib](https://pdf-lib.js.org/) — PDF creation and editing
- [pdf.js](https://mozilla.github.io/pdf.js/) — PDF rendering
- [html2canvas](https://html2canvas.hertzen.com/) + [jsPDF](https://github.com/parallax/jsPDF) — HTML to PDF
- [SortableJS](https://sortablejs.github.io/Sortable/) — drag-and-drop reordering

## Project structure

```
├── public/           Service worker
├── scripts/        Tests and local server
├── src/
│   ├── app.js      Shell UI and routing
│   ├── tools/      One module per tool (15)
│   └── utils/      PDF helpers, UI components, preview guard
├── test-fixtures/  Sample PDFs for tests
└── index.html      Entry point
```

## License

MIT — see [LICENSE](LICENSE)