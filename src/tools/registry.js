export const TOOL_CATEGORIES = [
  {
    id: 'organize',
    title: 'Organize',
    accent: 'blue',
    tools: [
      { id: 'merge', icon: 'merge', name: 'Merge PDF', shortcut: 'M', desc: 'Combine multiple PDFs in any order with drag-and-drop.' },
      { id: 'split', icon: 'split', name: 'Split PDF', shortcut: 'S', desc: 'Split by page ranges or extract selected pages.' },
      { id: 'organize', icon: 'organize', name: 'Organize Pages', shortcut: 'O', desc: 'Reorder, delete, duplicate, and rotate pages.' },
      { id: 'rotate', icon: 'rotate', name: 'Rotate PDF', shortcut: 'R', desc: 'Rotate all pages or selected pages.' },
      { id: 'extract', icon: 'extract', name: 'Extract Pages', shortcut: 'E', desc: 'Export selected pages into a separate PDF.' },
    ],
  },
  {
    id: 'edit',
    title: 'Edit',
    accent: 'green',
    tools: [
      { id: 'add-text', icon: 'add-text', name: 'Add Text', shortcut: 'T', desc: 'Place editable text boxes anywhere on the page.' },
      { id: 'add-image', icon: 'add-image', name: 'Add Images', shortcut: 'I', desc: 'Insert and position PNG/JPG images.' },
      { id: 'signature', icon: 'signature', name: 'Draw Signature', shortcut: 'G', desc: 'Draw and place a signature on your document.' },
      { id: 'watermark', icon: 'watermark', name: 'Watermark', shortcut: 'W', desc: 'Add text or image watermarks with opacity control.' },
      { id: 'page-numbers', icon: 'page-numbers', name: 'Page Numbers', shortcut: 'N', desc: 'Add page numbers with custom position and style.' },
    ],
  },
  {
    id: 'convert',
    title: 'Convert',
    accent: 'yellow',
    tools: [
      { id: 'jpg-to-pdf', icon: 'jpg-to-pdf', name: 'JPG to PDF', shortcut: 'J', desc: 'Convert images to PDF with layout options.' },
      { id: 'pdf-to-jpg', icon: 'pdf-to-jpg', name: 'PDF to JPG', shortcut: 'P', desc: 'Export every page as an image, download as ZIP.' },
      { id: 'html-to-pdf', icon: 'html-to-pdf', name: 'HTML to PDF', shortcut: 'H', desc: 'Convert HTML content into a PDF document.' },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    accent: 'red',
    tools: [
      { id: 'protect', icon: 'protect', name: 'Protect PDF', shortcut: 'L', desc: 'Password-protect PDFs with AES encryption.' },
    ],
  },
  {
    id: 'utilities',
    title: 'Utilities',
    accent: 'blue',
    tools: [
      { id: 'crop', icon: 'crop', name: 'Crop PDF', shortcut: 'C', desc: 'Crop individual pages or all pages.' },
    ],
  },
];

export function getToolById(id) {
  for (const cat of TOOL_CATEGORIES) {
    const tool = cat.tools.find((t) => t.id === id);
    if (tool) return { ...tool, category: cat.title, accent: cat.accent };
  }
  return null;
}

export function getAllTools() {
  return TOOL_CATEGORIES.flatMap((c) =>
    c.tools.map((t) => ({ ...t, category: c.title, accent: c.accent }))
  );
}