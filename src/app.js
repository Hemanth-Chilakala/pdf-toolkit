import { TOOL_CATEGORIES, getToolById, getAllTools } from './tools/registry.js';
import { TOOL_RENDERERS } from './tools/index.js';
import { icon } from './utils/icons.js';
import { resetToolFlow, onToolStepChange } from './utils/tool-flow.js';

const POPULAR_TOOL_IDS = ['merge', 'split', 'jpg-to-pdf', 'protect'];

export function createApp(root) {
  let activeTool = null;
  let destroyTool = null;
  let searchQuery = '';
  let categoryFilter = 'all';

  root.innerHTML = `
    <a href="#main" class="skip-link">Skip to content</a>
    <div class="app">
      <div class="bg-mesh" aria-hidden="true"></div>
      <header class="header">
        <button class="brand" id="go-home" type="button">
          <span class="brand-icon">${icon('logo')}</span>
          <span class="brand-text">PDF Toolkit</span>
        </button>
        <div class="header-search">
          <span class="search-icon">${icon('search')}</span>
          <input type="search" id="tool-search" placeholder="Search tools..." autocomplete="off" aria-label="Search tools" />
          <kbd class="search-kbd">Ctrl K</kbd>
        </div>
        <div class="header-trust">
          <span class="trust-pill">${icon('shield')} 100% in your browser</span>
        </div>
      </header>

      <main class="main" id="main">
        <section class="home-view" id="home-view"></section>
        <section class="tool-view hidden" id="tool-view">
          <div class="tool-view-inner">
            <button class="back-link" id="back-home" type="button">${icon('arrow-left')} All tools</button>
            <header class="tool-hero" id="tool-hero"></header>
            <div class="tool-steps" id="tool-steps">
              <div class="step-indicator" id="step-indicator">
                <div class="step-item" data-step="1">
                  <span class="step-dot">1</span>
                  <span class="step-label">Upload</span>
                </div>
                <span class="step-line" data-line="1"></span>
                <div class="step-item" data-step="2">
                  <span class="step-dot">2</span>
                  <span class="step-label">Configure</span>
                </div>
                <span class="step-line" data-line="2"></span>
                <div class="step-item" data-step="3">
                  <span class="step-dot">3</span>
                  <span class="step-label">Download</span>
                </div>
              </div>
            </div>
            <div class="tool-workspace" id="tool-workspace"></div>
          </div>
        </section>
      </main>

      <footer class="footer">
        <p>Your files are processed locally. Nothing is uploaded to any server.</p>
      </footer>
    </div>
  `;

  const homeView = root.querySelector('#home-view');
  const toolView = root.querySelector('#tool-view');
  const toolHero = root.querySelector('#tool-hero');
  const toolWorkspace = root.querySelector('#tool-workspace');
  const stepIndicator = root.querySelector('#step-indicator');
  const searchInput = root.querySelector('#tool-search');
  const totalTools = getAllTools().length;

  function updateSteps(step) {
    stepIndicator.querySelectorAll('.step-item').forEach((item) => {
      const n = Number(item.dataset.step);
      item.classList.toggle('active', n === step);
      item.classList.toggle('done', n < step);
    });
    stepIndicator.querySelectorAll('.step-line').forEach((line) => {
      const n = Number(line.dataset.line);
      line.classList.toggle('done', n < step);
    });
  }

  onToolStepChange(updateSteps);

  function filteredCategories() {
    const q = searchQuery.trim().toLowerCase();
    return TOOL_CATEGORIES.map((cat) => ({
      ...cat,
      tools: cat.tools.filter((t) => {
        const matchesSearch =
          !q ||
          t.name.toLowerCase().includes(q) ||
          t.desc.toLowerCase().includes(q) ||
          cat.title.toLowerCase().includes(q);
        const matchesCategory = categoryFilter === 'all' || cat.id === categoryFilter;
        return matchesSearch && matchesCategory;
      }),
    })).filter((cat) => cat.tools.length);
  }

  function renderHome() {
    activeTool = null;
    resetToolFlow();
    homeView.classList.remove('hidden');
    toolView.classList.add('hidden');
    history.replaceState(null, '', '#');

    const cats = filteredCategories();
    const visibleCount = cats.reduce((n, c) => n + c.tools.length, 0);
    const popularTools = POPULAR_TOOL_IDS.map(getToolById).filter(Boolean);

    homeView.innerHTML = `
      <div class="home-hero">
        <span class="hero-badge">${icon('shield')} Private by design</span>
        <h1>Every PDF tool you need</h1>
        <p class="hero-subtitle">Merge, split, edit, convert, and protect PDFs — free, fast, and fully offline in your browser.</p>
        <div class="hero-stats">
          <div class="stat-card">
            <span class="stat-value">${totalTools}</span>
            <span class="stat-label">Tools</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">0</span>
            <span class="stat-label">Server uploads</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">${TOOL_CATEGORIES.length}</span>
            <span class="stat-label">Categories</span>
          </div>
        </div>
      </div>

      <div class="category-filters" role="group" aria-label="Filter by category">
        <button class="filter-chip ${categoryFilter === 'all' ? 'active' : ''}" data-filter="all" type="button">All tools</button>
        ${TOOL_CATEGORIES.map(
          (cat) => `
            <button class="filter-chip accent-${cat.accent} ${categoryFilter === cat.id ? 'active' : ''}" data-filter="${cat.id}" type="button">
              ${cat.title}
            </button>
          `
        ).join('')}
      </div>

      ${
        !searchQuery && categoryFilter === 'all'
          ? `
        <section class="quick-start">
          <div class="quick-start-header">
            <h2>Quick start</h2>
            <p>Jump straight into the most-used tools</p>
          </div>
          <div class="quick-start-grid">
            ${popularTools
              .map(
                (tool) => `
              <button class="quick-card accent-${tool.accent}" data-tool="${tool.id}" type="button">
                <span class="quick-card-icon">${icon(tool.icon)}</span>
                <span class="quick-card-body">
                  <span class="quick-card-name">${tool.name}</span>
                  <span class="quick-card-desc">${tool.desc}</span>
                </span>
                <span class="quick-card-arrow">${icon('arrow-right')}</span>
              </button>
            `
              )
              .join('')}
          </div>
        </section>
      `
          : ''
      }

      ${cats
        .map(
          (cat) => `
        <section class="tool-category">
          <h2 class="category-title">
            <span class="category-dot accent-${cat.accent}"></span>
            ${cat.title}
          </h2>
          <div class="tool-grid">
            ${cat.tools
              .map(
                (tool) => `
              <button class="tool-card accent-${cat.accent}" data-tool="${tool.id}" type="button">
                <span class="tool-card-icon">${icon(tool.icon)}</span>
                <span class="tool-card-name">${tool.name}</span>
                <span class="tool-card-desc">${tool.desc}</span>
                <span class="tool-card-arrow">${icon('arrow-right')}</span>
              </button>
            `
              )
              .join('')}
          </div>
        </section>
      `
        )
        .join('')}

      ${!visibleCount ? '<p class="empty-search">No tools match your search.</p>' : ''}
    `;

    homeView.querySelectorAll('.tool-card, .quick-card').forEach((card) => {
      card.addEventListener('click', () => openTool(card.dataset.tool));
    });

    homeView.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        categoryFilter = chip.dataset.filter;
        renderHome();
      });
    });
  }

  function openTool(toolId) {
    if (!getToolById(toolId)) {
      renderHome();
      return;
    }
    if (activeTool === toolId) return;
    activeTool = toolId;
    resetToolFlow();
    homeView.classList.add('hidden');
    toolView.classList.remove('hidden');
    history.replaceState(null, '', `#${toolId}`);

    const tool = getToolById(toolId);
    toolHero.innerHTML = `
      <div class="tool-hero-icon accent-${tool.accent}">${icon(tool.icon)}</div>
      <div class="tool-hero-copy">
        <p class="tool-hero-category">${tool.category}</p>
        <h1>${tool.name}</h1>
        <p class="tool-hero-desc">${tool.desc}</p>
      </div>
    `;

    destroyTool?.();
    destroyTool = null;
    toolWorkspace.innerHTML = '';
    const renderer = TOOL_RENDERERS[toolId];
    if (renderer) {
      const cleanup = renderer(toolWorkspace);
      if (typeof cleanup === 'function') destroyTool = cleanup;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    if (activeTool) {
      const visible = filteredCategories().some((c) => c.tools.some((t) => t.id === activeTool));
      if (!visible) renderHome();
    } else {
      renderHome();
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (e.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.blur();
      if (searchQuery) {
        searchQuery = '';
        searchInput.value = '';
        renderHome();
      }
    }
  });

  root.querySelector('#go-home').addEventListener('click', renderHome);
  root.querySelector('#back-home').addEventListener('click', renderHome);

  const hash = location.hash.slice(1);
  if (hash && getToolById(hash)) openTool(hash);
  else renderHome();

  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (id && getToolById(id)) openTool(id);
    else renderHome();
  });
}