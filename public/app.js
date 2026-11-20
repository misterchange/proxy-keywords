/**
 * Proxy Keywords Studio — Frontend Application Engine
 */

(function () {
  'use strict';

  // -------------------------------------------------------------
  // App State
  // -------------------------------------------------------------
  const state = {
    activeTab: 'launcher',
    reports: [],
    selectedReport: '',
    presets: [],
    selectedPreset: 'fabcastle',
    
    // Research Studio state
    targetDomain: 'removesynth.com',
    strategyMode: 'competitor',
    discoveredSeeds: [],
    queuedSeeds: [
      { keyword: 'remove synthid', country: 'us' },
      { keyword: 'synthid watermark remover', country: 'us' },
      { keyword: 'clean image metadata', country: 'us' },
      { keyword: 'photoshop metadata cleaner', country: 'us' }
    ],

    // Explorer query state
    search: '',
    country: 'all',
    list: 'all',
    kdFilter: 'all',
    tool: 'all',
    minVol: '',
    sort: 'volume',
    order: 'desc',
    page: 1,
    limit: 1,
    totalPages: 1,
    totalCount: 0,
    filteredCount: 0,
    rows: [],
    phraseMatchRows: [],
    questionsRows: [],
    phraseMatchCount: 0,
    questionsCount: 0,
    seedGroups: [],
    totalSeeds: 0,
    seedPage: 1,
    seedTotalPages: 1,
    viewMode: 'split',
    summary: null,

    // Telemetry state
    runStatus: 'idle',
    autoScroll: true,
    runStartTime: 0,
    timerInterval: null
  };

  // -------------------------------------------------------------
  // DOM References
  // -------------------------------------------------------------
  const dom = {
    // Navigation
    navTabs: document.getElementById('nav-tabs'),
    tabPanes: {
      explorer: document.getElementById('pane-explorer'),
      launcher: document.getElementById('pane-launcher'),
      terminal: document.getElementById('pane-terminal'),
      reports: document.getElementById('pane-reports')
    },
    systemStatusChip: document.getElementById('system-status-chip'),
    systemStatusLabel: document.getElementById('system-status-label'),
    liveTabBadge: document.getElementById('live-tab-badge'),

    // Research Studio (Step 1: Domain)
    inputDomain: document.getElementById('input-domain'),
    btnDomainCheck: document.getElementById('btn-domain-check'),
    domainActiveLabel: document.getElementById('domain-active-label'),
    domainDetectedHint: document.getElementById('domain-detected-hint'),
    btnHeroGotoExplorer: document.getElementById('btn-hero-goto-explorer'),

    // Research Studio (Step 2: Strategy & Seeds)
    stratTabCompetitor: document.getElementById('strat-tab-competitor'),
    stratTabDirect: document.getElementById('strat-tab-direct'),
    stratTabPresets: document.getElementById('strat-tab-presets'),
    paneStratCompetitor: document.getElementById('pane-strat-competitor'),
    paneStratDirect: document.getElementById('pane-strat-direct'),
    paneStratPresets: document.getElementById('pane-strat-presets'),
    inputCompetitors: document.getElementById('input-competitors'),
    btnAnalyzeCompetitors: document.getElementById('btn-analyze-competitors'),
    discoveredCount: document.getElementById('discovered-count'),
    btnAddAllCompetitors: document.getElementById('btn-add-all-competitors'),
    competitorSeedChips: document.getElementById('competitor-seed-chips'),
    inputDirectSeeds: document.getElementById('input-direct-seeds'),
    btnAppendDirectSeeds: document.getElementById('btn-append-direct-seeds'),
    queuedCount: document.getElementById('queued-count'),
    queuedTagsList: document.getElementById('queued-tags-list'),
    btnClearQueue: document.getElementById('btn-clear-queue'),

    // Explorer controls
    reportSelect: document.getElementById('report-select'),
    btnRefreshReports: document.getElementById('btn-refresh-reports'),
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    filterCountry: document.getElementById('filter-country'),
    filterList: document.getElementById('filter-list'),
    filterTool: document.getElementById('filter-tool'),
    kdSegmented: document.getElementById('kd-segmented'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    btnExportXlsx: document.getElementById('btn-export-xlsx'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    quickChipVol: document.getElementById('quick-chip-vol'),
    quickChipGems: document.getElementById('quick-chip-gems'),
    quickChipQuestions: document.getElementById('quick-chip-questions'),

    // Explorer KPIs
    kpiTotalKeywords: document.getElementById('kpi-total-keywords'),
    kpiFilteredSub: document.getElementById('kpi-filtered-sub'),
    kpiTotalVolume: document.getElementById('kpi-total-volume'),
    kpiAvgKd: document.getElementById('kpi-avg-kd'),
    kpiKdRating: document.getElementById('kpi-kd-rating'),
    kpiQuestionsSplit: document.getElementById('kpi-questions-split'),
    kdBarEasy: document.getElementById('kd-bar-easy'),
    kdBarMed: document.getElementById('kd-bar-med'),
    kdBarHard: document.getElementById('kd-bar-hard'),

    // Explorer Table & Pagination
    tableBody: document.getElementById('table-body'),
    tableResultsSummary: document.getElementById('table-results-summary'),
    paginationLimitLabel: document.getElementById('pagination-limit-label'),
    limitSelect: document.getElementById('limit-select'),
    pageNumbersText: document.getElementById('page-numbers-text'),
    btnFirstPage: document.getElementById('btn-first-page'),
    btnPrevPage: document.getElementById('btn-prev-page'),
    btnNextPage: document.getElementById('btn-next-page'),
    btnLastPage: document.getElementById('btn-last-page'),
    pageJumpInput: document.getElementById('page-jump-input'),
    totalPagesLabel: document.getElementById('total-pages-label'),

    // Split View vs Unified View DOM
    btnModeSplit: document.getElementById('btn-mode-split'),
    btnModeUnified: document.getElementById('btn-mode-unified'),
    seedCardsContainer: document.getElementById('seed-cards-container'),
    unifiedViewContainer: document.getElementById('unified-view-container'),

    // Keyword Slide-Over Drawer
    drawerOverlay: document.getElementById('keyword-drawer-overlay'),
    drawerPanel: document.getElementById('keyword-drawer'),
    drawerCloseBtn: document.getElementById('drawer-close-btn'),
    drawerKeywordTitle: document.getElementById('drawer-keyword-title'),
    drawerTagType: document.getElementById('drawer-tag-type'),
    btnDrawerCopy: document.getElementById('btn-drawer-copy'),
    drawerGoogleLink: document.getElementById('drawer-google-link'),
    drawerVol: document.getElementById('drawer-vol'),
    drawerKd: document.getElementById('drawer-kd'),
    drawerCpc: document.getElementById('drawer-cpc'),
    drawerMarket: document.getElementById('drawer-market'),
    drawerSeed: document.getElementById('drawer-seed'),
    drawerTool: document.getElementById('drawer-tool'),
    drawerGroup: document.getElementById('drawer-group'),
    oppBadge: document.getElementById('opp-badge'),
    oppText: document.getElementById('opp-text'),

    // Launcher / Studio
    launchForm: document.getElementById('launch-form'),
    presetCardsGrid: document.getElementById('preset-cards-grid'),
    inputStartOffset: document.getElementById('input-start-offset'),
    inputLimitSeeds: document.getElementById('input-limit-seeds'),
    btnLaunchRun: document.getElementById('btn-launch-run'),

    // Telemetry & Terminal
    hudStatusBadge: document.getElementById('hud-status-badge'),
    hudStatusText: document.getElementById('hud-status-text'),
    hudTargetName: document.getElementById('hud-target-name'),
    hudCurrentSeedText: document.getElementById('hud-current-seed-text'),
    btnStopTask: document.getElementById('btn-stop-task'),
    hudProgressPercent: document.getElementById('hud-progress-percent'),
    hudProgressCounter: document.getElementById('hud-progress-counter'),
    hudProgressFill: document.getElementById('hud-progress-fill'),
    hudSpeedBadge: document.getElementById('hud-speed-badge'),
    hudTimerBadge: document.getElementById('hud-timer-badge'),
    hudMFound: document.getElementById('hud-m-found'),
    hudMPm: document.getElementById('hud-m-pm'),
    hudMQ: document.getElementById('hud-m-q'),
    hudMHandoffs: document.getElementById('hud-m-handoffs'),
    hudMErrors: document.getElementById('hud-m-errors'),
    terminalOutput: document.getElementById('terminal-output'),
    checkAutoscroll: document.getElementById('check-autoscroll'),
    btnCopyLogs: document.getElementById('btn-copy-logs'),
    btnClearLogs: document.getElementById('btn-clear-logs'),

    // Report Archive
    reportsTableBody: document.getElementById('reports-table-body'),
    btnRefreshArchiveTop: document.getElementById('btn-refresh-archive-top'),

    // Toast
    toastContainer: document.getElementById('toast-container')
  };

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function formatNumber(num) {
    if (!num && num !== 0) return '--';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  }

  function getCountryFlag(code) {
    const flags = {
      in: '🇮🇳', us: '🇺🇸', gb: '🇬🇧', au: '🇦🇺', ae: '🇦🇪',
      ca: '🇨🇦', de: '🇩🇪', fr: '🇫🇷', id: '🇮🇩', br: '🇧🇷'
    };
    return flags[code.toLowerCase()] || '🌐';
  }

  // -------------------------------------------------------------
  // Tab Navigation
  // -------------------------------------------------------------
  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    Object.keys(dom.tabPanes).forEach(paneId => {
      dom.tabPanes[paneId].classList.toggle('active', paneId === tabId);
    });

    if (tabId === 'reports') {
      loadReportsArchive();
    }
  }

  dom.navTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-tab');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });

  // -------------------------------------------------------------
  // Reports API & Loading
  // -------------------------------------------------------------
  async function loadReportsList() {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      state.reports = data.reports || [];

      // Populate Report Select dropdown
      dom.reportSelect.innerHTML = '';
      if (state.reports.length === 0) {
        dom.reportSelect.innerHTML = '<option value="">No report files found</option>';
        return;
      }

      state.reports.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.filename;
        opt.textContent = `${r.filename} (${r.sizeFormatted})`;
        dom.reportSelect.appendChild(opt);
      });

      // Default select the first or previously selected
      if (!state.selectedReport || !state.reports.some(r => r.filename === state.selectedReport)) {
        state.selectedReport = state.reports[0].filename;
      }
      dom.reportSelect.value = state.selectedReport;

      // Load table data
      loadReportDetails();
    } catch (err) {
      showToast(`Error fetching reports: ${err.message}`, 'error');
    }
  }

  async function loadReportDetails() {
    if (!state.selectedReport) return;

    dom.tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-cell">
          <div class="empty-state">
            <div class="spinner"></div>
            <p>Querying keyword dataset...</p>
          </div>
        </td>
      </tr>
    `;

    // Calculate KD query parameters
    let minKd = '';
    let maxKd = '';
    if (state.kdFilter === 'easy') { minKd = '0'; maxKd = '14'; }
    else if (state.kdFilter === 'med') { minKd = '15'; maxKd = '29'; }
    else if (state.kdFilter === 'hard') { minKd = '30'; maxKd = '100'; }

    const isSplit = state.viewMode === 'split';
    const params = new URLSearchParams({
      page: isSplit ? '1' : String(state.page),
      limit: isSplit ? '500' : String(state.limit),
      sort: state.sort,
      order: state.order
    });

    if (isSplit) {
      params.append('seedLimit', String(state.limit));
      params.append('seedPage', String(state.page));
    }

    if (state.search) params.append('search', state.search);
    if (state.country !== 'all') params.append('country', state.country);
    if (state.list !== 'all') params.append('list', state.list);
    if (state.tool !== 'all') params.append('tool', state.tool);
    if (state.minVol) params.append('minVol', state.minVol);
    if (minKd) params.append('minKd', minKd);
    if (maxKd) params.append('maxKd', maxKd);

    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(state.selectedReport)}?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      state.rows = data.rows || [];
      state.phraseMatchRows = data.phraseMatchRows || [];
      state.questionsRows = data.questionsRows || [];
      state.phraseMatchCount = data.phraseMatchCount || 0;
      state.questionsCount = data.questionsCount || 0;
      state.totalCount = data.totalCount || 0;
      state.filteredCount = data.filteredCount || 0;
      state.seedGroups = data.seedGroups || [];
      state.totalSeeds = data.totalSeeds || 0;
      state.seedTotalPages = data.seedTotalPages || 1;
      state.seedPage = data.seedPage || 1;
      state.totalPages = isSplit ? (data.seedTotalPages || 1) : (data.totalPages || 1);
      state.page = isSplit ? (data.seedPage || 1) : (data.page || 1);
      state.summary = data.summary;

      renderKPIs();
      renderFilterOptions();
      renderTable();
      renderPagination();
    } catch (err) {
      if (dom.seedCardsContainer) {
        dom.seedCardsContainer.innerHTML = `<div class="empty-state" style="color:var(--rose);"><p>Failed: ${err.message}</p></div>`;
      }
      dom.tableBody.innerHTML = `
        <tr>
          <td colspan="9" class="empty-cell" style="color: var(--rose);">
            Failed to load dataset: ${err.message}
          </td>
        </tr>
      `;
      showToast(`Load error: ${err.message}`, 'error');
    }
  }

  // -------------------------------------------------------------
  // Render KPI Metrics Cards
  // -------------------------------------------------------------
  function renderKPIs() {
    if (!state.summary) return;
    const s = state.summary;
    if (dom.kpiTotalKeywords) dom.kpiTotalKeywords.textContent = (state.totalCount || s.totalKeywords || 0).toLocaleString();
    if (dom.kpiFilteredSub) dom.kpiFilteredSub.textContent = `${(state.filteredCount || 0).toLocaleString()} match filters`;
    if (dom.kpiTotalVolume) dom.kpiTotalVolume.textContent = (s.totalVolume || 0).toLocaleString();
    
    const avgKd = s.avgDifficulty || 0;
    if (dom.kpiAvgKd) dom.kpiAvgKd.textContent = String(avgKd);
    if (dom.kpiKdRating) {
      if (avgKd < 15) {
        dom.kpiKdRating.textContent = 'Low Competition';
        dom.kpiKdRating.style.color = 'var(--emerald)';
      } else if (avgKd < 30) {
        dom.kpiKdRating.textContent = 'Moderate Competition';
        dom.kpiKdRating.style.color = 'var(--amber)';
      } else {
        dom.kpiKdRating.textContent = 'High Competition';
        dom.kpiKdRating.style.color = 'var(--rose)';
      }
    }

    if (dom.kpiQuestionsSplit) {
      dom.kpiQuestionsSplit.textContent = `${(s.phraseMatches || 0).toLocaleString()} / ${(s.questions || 0).toLocaleString()}`;
    }

    // KD mini distribution bar
    if (dom.kdBarEasy && dom.kdBarMed && dom.kdBarHard) {
      const easyPct = avgKd < 20 ? 65 : 45;
      const medPct = 25;
      const hardPct = 100 - easyPct - medPct;
      dom.kdBarEasy.style.width = `${easyPct}%`;
      dom.kdBarMed.style.width = `${medPct}%`;
      dom.kdBarHard.style.width = `${hardPct}%`;
    }
  }

  // -------------------------------------------------------------
  // Render Dynamic Filter Options (Countries & Tools)
  // -------------------------------------------------------------
  function renderFilterOptions() {
    if (!state.summary) return;
    const { countries, tools } = state.summary;

    if (dom.filterCountry && countries) {
      const curCountry = state.country;
      dom.filterCountry.innerHTML = '<option value="all">All Markets</option>';
      Object.keys(countries).sort().forEach(c => {
        const flag = getCountryFlag(c);
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = `${flag} ${c.toUpperCase()} (${countries[c].toLocaleString()})`;
        if (c === curCountry) opt.selected = true;
        dom.filterCountry.appendChild(opt);
      });
    }

    if (dom.filterTool && tools) {
      const curTool = state.tool;
      dom.filterTool.innerHTML = '<option value="all">All Tools</option>';
      Object.keys(tools).sort().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = `${t} (${tools[t].toLocaleString()})`;
        if (t === curTool) opt.selected = true;
        dom.filterTool.appendChild(opt);
      });
    }
  }

  // Helper: Format a single row's HTML
  function formatRowHtml(row, num, isUnified = false) {
    let kdClass = 'easy';
    let kdDisplay = row.difficultyText || (row.difficulty !== null ? String(row.difficulty) : 'Easy');
    const textLower = String(row.difficultyText || '').toLowerCase();

    if (row.difficulty !== null && row.difficulty !== undefined) {
      if (row.difficulty < 15) kdClass = 'easy';
      else if (row.difficulty < 30) kdClass = 'med';
      else kdClass = 'hard';
    } else if (textLower.includes('hard')) {
      kdClass = 'hard';
    } else if (textLower.includes('med')) {
      kdClass = 'med';
    } else if (textLower.includes('easy')) {
      kdClass = 'easy';
    } else {
      kdClass = 'na';
      kdDisplay = 'N/A';
    }

    const isQuestion = String(row.list || '').toLowerCase().includes('question');
    const listClass = isQuestion ? 'question' : 'phrase';
    const listLabel = isQuestion ? 'Questions' : 'Phrase match';
    const flag = getCountryFlag(row.country || 'us');

    if (isUnified) {
      return `
        <tr data-row-id="${row.id}" class="clickable-row">
          <td class="td-num">${num}</td>
          <td><span class="kw-primary">${escapeHtml(row.keyword)}</span></td>
          <td><span class="vol-badge">${row.volumeText || (row.volume > 0 ? formatNumber(row.volume) : '<100')}</span></td>
          <td><span class="kd-badge ${kdClass}">${kdDisplay}</span></td>
          <td><span class="cpc-badge">${row.cpc ? '$' + row.cpc.toFixed(2) : '--'}</span></td>
          <td><span class="country-chip">${flag} ${(row.country || 'us').toUpperCase()}</span></td>
          <td><span class="type-pill ${listClass}">${listLabel}</span></td>
          <td><div class="tool-tag" title="${escapeHtml(row.tool || '')}">${escapeHtml(row.tool || '--')}</div></td>
          <td style="text-align: right;"><span class="row-arrow">&rsaquo;</span></td>
        </tr>
      `;
    }

    // Side-by-side row inside Seed Card
    return `
      <tr data-row-id="${row.id}" class="clickable-row">
        <td class="td-num">${num}</td>
        <td>
          <span class="kw-primary">${escapeHtml(row.keyword)}</span>
        </td>
        <td><span class="vol-badge">${row.volumeText || (row.volume > 0 ? formatNumber(row.volume) : '<100')}</span></td>
        <td><span class="kd-badge ${kdClass}">${kdDisplay}</span></td>
        <td><span class="cpc-badge">${row.cpc ? '$' + row.cpc.toFixed(2) : '--'}</span></td>
      </tr>
    `;
  }

  // -------------------------------------------------------------
  // Render Seed-by-Seed Grouped Cards or Unified Flat Table
  // -------------------------------------------------------------
  function renderTable() {
    if (state.viewMode === 'split') {
      if (dom.seedCardsContainer) dom.seedCardsContainer.style.display = 'flex';
      if (dom.unifiedViewContainer) dom.unifiedViewContainer.style.display = 'none';

      dom.tableResultsSummary.textContent = `Showing ${state.seedGroups.length} of ${state.totalSeeds.toLocaleString()} Seed Keywords (${state.filteredCount.toLocaleString()} total queries)`;

      if (state.seedGroups.length === 0) {
        dom.seedCardsContainer.innerHTML = `
          <div class="empty-state">
            <p>No seed keywords match your current search or filters.</p>
          </div>
        `;
      } else {
        dom.seedCardsContainer.innerHTML = state.seedGroups.map((g) => {
          const flag = getCountryFlag(g.country || 'us');
          const avgKdClass = g.avgKd < 15 ? 'emerald' : g.avgKd < 30 ? 'amber' : 'rose';
          const avgKdText = g.avgKd < 15 ? 'Easy' : g.avgKd < 30 ? 'Med' : 'Hard';

          const phraseRowsHtml = g.phraseMatches.length === 0
            ? `<tr><td colspan="5" class="empty-cell"><p style="color:var(--text-sub);padding:0.75rem;">No phrase match keywords discovered for this seed.</p></td></tr>`
            : g.phraseMatches.map((r, i) => formatRowHtml(r, i + 1, false)).join('');

          const questionsRowsHtml = g.questions.length === 0
            ? `<tr><td colspan="5" class="empty-cell"><p style="color:var(--text-sub);padding:0.75rem;">No question queries discovered for this seed.</p></td></tr>`
            : g.questions.map((r, i) => formatRowHtml(r, i + 1, false)).join('');

          return `
            <div class="seed-card">
              <!-- Highlighted Seed Keyword Banner -->
              <div class="seed-highlight-banner">
                <div class="seed-banner-left">
                  <div class="seed-target-icon">🎯</div>
                  <div class="seed-title-box">
                    <div class="seed-top-badge-row">
                      <span class="seed-badge">SEED KEYWORD</span>
                      <span class="country-chip">${flag} ${(g.country || 'us').toUpperCase()}</span>
                      ${g.tool ? `<span class="seed-tag tool-tag">${escapeHtml(g.tool)}</span>` : ''}
                      ${g.group ? `<span class="seed-tag group-tag">${escapeHtml(g.group)}</span>` : ''}
                    </div>
                    <h2 class="seed-title-text">
                      <span class="seed-quote">"</span>${escapeHtml(g.seed)}<span class="seed-quote">"</span>
                    </h2>
                  </div>
                </div>
                <div class="seed-banner-stats">
                  <!-- Quick Seed Flipping Controls -->
                  <div class="seed-nav-quick">
                    <button type="button" class="btn-seed-nav prev-seed-btn" ${state.page <= 1 ? 'disabled' : ''} title="Previous Seed Keyword">◀</button>
                    <span class="seed-index-badge">Seed ${state.page} of ${state.totalSeeds}</span>
                    <button type="button" class="btn-seed-nav next-seed-btn" ${state.page >= state.seedTotalPages ? 'disabled' : ''} title="Next Seed Keyword">▶</button>
                  </div>

                  <div class="seed-stat-item">
                    <span class="seed-stat-val indigo">${g.phraseMatches.length}</span>
                    <span class="seed-stat-lbl">Phrase Matches</span>
                  </div>
                  <div class="seed-stat-item">
                    <span class="seed-stat-val violet">${g.questions.length}</span>
                    <span class="seed-stat-lbl">Questions</span>
                  </div>
                  <div class="seed-stat-item">
                    <span class="seed-stat-val emerald">${formatNumber(g.totalVolume)}</span>
                    <span class="seed-stat-lbl">Total Volume</span>
                  </div>
                  <div class="seed-stat-item">
                    <span class="seed-stat-val ${avgKdClass}">KD ${g.avgKd}</span>
                    <span class="seed-stat-lbl">${avgKdText} Comp</span>
                  </div>
                </div>
              </div>

              <!-- Below: Discovered Keywords & Questions for this Seed -->
              <div class="seed-tables-split">
                <!-- Left: Phrase match table for this seed -->
                <div class="seed-column phrase-side">
                  <div class="seed-sub-header phrase-sub">
                    <span class="side-title">🔤 Phrase Match Keywords (${g.phraseMatches.length})</span>
                  </div>
                  <div class="seed-table-wrap">
                    <table class="data-table seed-inner-table">
                      <thead>
                        <tr>
                          <th class="th-num">#</th>
                          <th>Discovered Keyword</th>
                          <th>Volume</th>
                          <th>KD</th>
                          <th>CPC</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${phraseRowsHtml}
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Right: Questions table for this seed -->
                <div class="seed-column questions-side">
                  <div class="seed-sub-header questions-sub">
                    <span class="side-title">❓ Questions Keywords (${g.questions.length})</span>
                  </div>
                  <div class="seed-table-wrap">
                    <table class="data-table seed-inner-table">
                      <thead>
                        <tr>
                          <th class="th-num">#</th>
                          <th>Discovered Question</th>
                          <th>Volume</th>
                          <th>KD</th>
                          <th>CPC</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${questionsRowsHtml}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    } else {
      // Unified View
      if (dom.seedCardsContainer) dom.seedCardsContainer.style.display = 'none';
      if (dom.unifiedViewContainer) dom.unifiedViewContainer.style.display = 'block';

      dom.tableResultsSummary.textContent = `Showing ${state.filteredCount.toLocaleString()} keywords (${state.phraseMatchCount.toLocaleString()} Phrase match | ${state.questionsCount.toLocaleString()} Questions)`;

      const startIdx = (state.page - 1) * state.limit;
      if (state.rows.length === 0) {
        dom.tableBody.innerHTML = `
          <tr>
            <td colspan="9" class="empty-cell">
              <div class="empty-state"><p>No keywords match your current search or filters.</p></div>
            </td>
          </tr>
        `;
      } else {
        dom.tableBody.innerHTML = state.rows.map((r, i) => 
          formatRowHtml(r, startIdx + i + 1, true)
        ).join('');
      }
    }

    // Attach click listeners to previous and next seed buttons on the banner
    document.querySelectorAll('.prev-seed-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.page > 1) {
          state.page--;
          loadReportDetails();
        }
      });
    });

    document.querySelectorAll('.next-seed-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.page < state.seedTotalPages) {
          state.page++;
          loadReportDetails();
        }
      });
    });

    // Attach click listeners to all rows in either table to open Drawer
    document.querySelectorAll('.clickable-row').forEach(tr => {
      tr.addEventListener('click', () => {
        const rowId = parseInt(tr.dataset.rowId, 10);
        let row = state.rows.find(r => r.id === rowId);
        if (!row && state.seedGroups) {
          for (const g of state.seedGroups) {
            row = g.phraseMatches.find(r => r.id === rowId) || g.questions.find(r => r.id === rowId);
            if (row) break;
          }
        }
        if (row) openKeywordDrawer(row);
      });
    });

    // Update sort carets
    ['keyword', 'volume', 'difficulty', 'cpc', 'country', 'list', 'tool'].forEach(col => {
      const caret = document.getElementById(`caret-${col}`);
      if (caret) {
        if (state.sort === col) {
          caret.textContent = state.order === 'asc' ? '▲' : '▼';
        } else {
          caret.textContent = '';
        }
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // -------------------------------------------------------------
  // Keyword Detail Slide-Over Drawer
  // -------------------------------------------------------------
  let activeDrawerKeyword = '';

  function openKeywordDrawer(row) {
    activeDrawerKeyword = row.keyword;
    dom.drawerKeywordTitle.textContent = row.keyword;
    dom.drawerTagType.textContent = row.list || 'Phrase match';
    dom.drawerVol.textContent = row.volumeText || (row.volume > 0 ? formatNumber(row.volume) : '<100');
    
    let kdDisplay = 'N/A';
    if (row.difficulty !== null && row.difficulty !== undefined) {
      kdDisplay = String(row.difficulty);
    }
    dom.drawerKd.textContent = kdDisplay;
    dom.drawerCpc.textContent = row.cpc ? `$${row.cpc.toFixed(2)}` : '--';
    dom.drawerMarket.textContent = `${getCountryFlag(row.country || 'us')} ${(row.country || 'us').toUpperCase()}`;
    
    dom.drawerSeed.textContent = row.seed || '--';
    dom.drawerTool.textContent = row.tool || 'General';
    dom.drawerGroup.textContent = row.group || 'Default';

    // Google search link
    dom.drawerGoogleLink.href = `https://www.google.com/search?q=${encodeURIComponent(row.keyword)}&gl=${row.country || 'us'}`;

    // Opportunity Analysis
    if (row.difficulty !== null && row.difficulty < 15) {
      dom.oppBadge.textContent = '🔥 High Rank Opportunity';
      dom.oppBadge.style.color = '#34D399';
      dom.oppBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      dom.oppText.textContent = `High-potential low-competition target. With KD ${row.difficulty}, a well-targeted landing page or tool can rank quickly.`;
    } else if (row.difficulty !== null && row.difficulty < 30) {
      dom.oppBadge.textContent = '⚖️ Moderate Competition';
      dom.oppBadge.style.color = '#FBBF24';
      dom.oppBadge.style.background = 'rgba(245, 158, 11, 0.2)';
      dom.oppText.textContent = `Moderate competition (KD ${row.difficulty}). Quality content with authoritative internal links is recommended.`;
    } else {
      dom.oppBadge.textContent = '🛡️ High Difficulty Authority';
      dom.oppBadge.style.color = '#FB7185';
      dom.oppBadge.style.background = 'rgba(244, 63, 94, 0.2)';
      dom.oppText.textContent = `High competition keyword. Best used as a secondary topic cluster pillar supported by long-tail phrase variants.`;
    }

    dom.drawerOverlay.classList.add('open');
    dom.drawerPanel.classList.add('open');
  }

  function closeKeywordDrawer() {
    dom.drawerOverlay.classList.remove('open');
    dom.drawerPanel.classList.remove('open');
  }

  dom.drawerCloseBtn.addEventListener('click', closeKeywordDrawer);
  dom.drawerOverlay.addEventListener('click', closeKeywordDrawer);

  dom.btnDrawerCopy.addEventListener('click', () => {
    if (!activeDrawerKeyword) return;
    navigator.clipboard.writeText(activeDrawerKeyword).then(() => {
      showToast(`Copied "${activeDrawerKeyword}" to clipboard!`, 'success');
    });
  });

  // -------------------------------------------------------------
  // View Mode Switcher (Per-Seed Split vs. Unified Table)
  // -------------------------------------------------------------
  if (dom.btnModeSplit && dom.btnModeUnified) {
    dom.btnModeSplit.addEventListener('click', () => {
      if (state.viewMode === 'split') return;
      state.viewMode = 'split';
      state.limit = 1;
      dom.limitSelect.value = '1';
      if (dom.paginationLimitLabel) dom.paginationLimitLabel.textContent = 'Seeds per view:';
      dom.btnModeSplit.classList.add('active');
      dom.btnModeUnified.classList.remove('active');
      state.page = 1;
      loadReportDetails();
    });

    dom.btnModeUnified.addEventListener('click', () => {
      if (state.viewMode === 'unified') return;
      state.viewMode = 'unified';
      state.limit = 50;
      dom.limitSelect.value = '50';
      if (dom.paginationLimitLabel) dom.paginationLimitLabel.textContent = 'Keywords per page:';
      dom.btnModeUnified.classList.add('active');
      dom.btnModeSplit.classList.remove('active');
      state.page = 1;
      loadReportDetails();
    });
  }

  // -------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------
  function renderPagination() {
    const unit = state.viewMode === 'split' ? 'seeds' : 'keywords';
    dom.pageNumbersText.textContent = `Page ${state.page} of ${state.totalPages} (${state.viewMode === 'split' ? state.totalSeeds + ' seeds' : state.filteredCount + ' rows'})`;
    dom.pageJumpInput.value = state.page;
    dom.pageJumpInput.max = state.totalPages;
    dom.totalPagesLabel.textContent = `/ ${state.totalPages}`;

    dom.btnFirstPage.disabled = state.page <= 1;
    dom.btnPrevPage.disabled = state.page <= 1;
    dom.btnNextPage.disabled = state.page >= state.totalPages;
    dom.btnLastPage.disabled = state.page >= state.totalPages;
  }

  dom.btnFirstPage.addEventListener('click', () => { state.page = 1; loadReportDetails(); });
  dom.btnPrevPage.addEventListener('click', () => { if (state.page > 1) { state.page--; loadReportDetails(); } });
  dom.btnNextPage.addEventListener('click', () => { if (state.page < state.totalPages) { state.page++; loadReportDetails(); } });
  dom.btnLastPage.addEventListener('click', () => { state.page = state.totalPages; loadReportDetails(); });

  dom.pageJumpInput.addEventListener('change', () => {
    let p = parseInt(dom.pageJumpInput.value, 10);
    if (isNaN(p)) p = 1;
    p = Math.max(1, Math.min(state.totalPages, p));
    state.page = p;
    loadReportDetails();
  });

  dom.limitSelect.addEventListener('change', () => {
    state.limit = parseInt(dom.limitSelect.value, 10);
    state.page = 1;
    loadReportDetails();
  });

  // -------------------------------------------------------------
  // Filter & Search Events
  // -------------------------------------------------------------
  let searchTimeout = null;
  dom.searchInput.addEventListener('input', () => {
    const val = dom.searchInput.value.trim();
    dom.btnClearSearch.hidden = !val;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.search = val;
      state.page = 1;
      loadReportDetails();
    }, 280);
  });

  dom.btnClearSearch.addEventListener('click', () => {
    dom.searchInput.value = '';
    dom.btnClearSearch.hidden = true;
    state.search = '';
    state.page = 1;
    loadReportDetails();
  });

  dom.filterCountry.addEventListener('change', () => {
    state.country = dom.filterCountry.value;
    state.page = 1;
    loadReportDetails();
  });

  dom.filterList.addEventListener('change', () => {
    state.list = dom.filterList.value;
    state.page = 1;
    loadReportDetails();
  });

  dom.filterTool.addEventListener('change', () => {
    state.tool = dom.filterTool.value;
    state.page = 1;
    loadReportDetails();
  });

  dom.kdSegmented.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    document.querySelectorAll('#kd-segmented .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.kdFilter = btn.dataset.kd;
    state.page = 1;
    loadReportDetails();
  });

  // Quick Chips
  dom.quickChipVol.addEventListener('click', () => {
    state.minVol = state.minVol === '1000' ? '' : '1000';
    dom.quickChipVol.classList.toggle('active', !!state.minVol);
    state.page = 1;
    loadReportDetails();
  });

  dom.quickChipGems.addEventListener('click', () => {
    state.kdFilter = state.kdFilter === 'easy' ? 'all' : 'easy';
    document.querySelectorAll('#kd-segmented .seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.kd === state.kdFilter);
    });
    dom.quickChipGems.classList.toggle('active', state.kdFilter === 'easy');
    state.page = 1;
    loadReportDetails();
  });

  dom.quickChipQuestions.addEventListener('click', () => {
    state.list = state.list === 'Questions' ? 'all' : 'Questions';
    dom.filterList.value = state.list;
    dom.quickChipQuestions.classList.toggle('active', state.list === 'Questions');
    state.page = 1;
    loadReportDetails();
  });

  dom.btnResetFilters.addEventListener('click', () => {
    state.search = '';
    state.country = 'all';
    state.list = 'all';
    state.kdFilter = 'all';
    state.tool = 'all';
    state.minVol = '';
    dom.searchInput.value = '';
    dom.btnClearSearch.hidden = true;
    dom.filterCountry.value = 'all';
    dom.filterList.value = 'all';
    dom.filterTool.value = 'all';
    dom.quickChipVol.classList.remove('active');
    dom.quickChipGems.classList.remove('active');
    dom.quickChipQuestions.classList.remove('active');
    document.querySelectorAll('#kd-segmented .seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.kd === 'all');
    });
    state.page = 1;
    loadReportDetails();
    showToast('Filters reset to default', 'info');
  });

  // Sort clicking on th headers
  document.querySelectorAll('.th-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.sort === col) {
        state.order = state.order === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort = col;
        state.order = 'desc';
      }
      state.page = 1;
      loadReportDetails();
    });
  });

  dom.reportSelect.addEventListener('change', () => {
    state.selectedReport = dom.reportSelect.value;
    state.page = 1;
    loadReportDetails();
  });

  dom.btnRefreshReports.addEventListener('click', () => {
    loadReportsList();
    showToast('Refreshed report files list', 'info');
  });

  // Export Buttons
  dom.btnExportXlsx.addEventListener('click', () => {
    if (!state.selectedReport) return;
    window.open(`/api/reports/${encodeURIComponent(state.selectedReport)}/download`, '_blank');
  });

  dom.btnExportCsv.addEventListener('click', () => {
    if (!state.selectedReport) return;
    const csvCandidate = state.selectedReport.replace(/\.xlsx$/i, '.csv');
    window.open(`/api/reports/${encodeURIComponent(csvCandidate)}/download`, '_blank');
  });

  // -------------------------------------------------------------
  // TAB 1: Research Studio & Domain-Anchored Pipeline
  // -------------------------------------------------------------

  // Seed Queue Management
  function addSeedToQueue(keyword, country = 'us') {
    const cleanKw = keyword.trim();
    if (!cleanKw) return;
    const exists = state.queuedSeeds.some(s => s.keyword.toLowerCase() === cleanKw.toLowerCase());
    if (!exists) {
      state.queuedSeeds.push({ keyword: cleanKw, country });
      renderQueuedSeeds();
    }
  }

  function removeSeedFromQueue(index) {
    state.queuedSeeds.splice(index, 1);
    renderQueuedSeeds();
  }

  function renderQueuedSeeds() {
    dom.queuedCount.textContent = state.queuedSeeds.length;
    if (state.queuedSeeds.length === 0) {
      dom.queuedTagsList.innerHTML = '<span class="queued-empty-note">No seeds queued yet. Click "Analyze Competitors" or type custom seeds above.</span>';
      return;
    }

    dom.queuedTagsList.innerHTML = state.queuedSeeds.map((seed, idx) => `
      <span class="queued-tag">
        <span class="tag-text">${escapeHtml(seed.keyword)}</span>
        <button type="button" class="btn-remove-tag" data-seed-idx="${idx}" title="Remove seed">×</button>
      </span>
    `).join('');

    dom.queuedTagsList.querySelectorAll('.btn-remove-tag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.seedIdx, 10);
        removeSeedFromQueue(idx);
      });
    });
  }

  dom.btnClearQueue.addEventListener('click', () => {
    state.queuedSeeds = [];
    renderQueuedSeeds();
    showToast('Seeds queue cleared', 'info');
  });

  // Step 1: Target Domain
  function updateTargetDomain() {
    const raw = dom.inputDomain.value.trim() || 'removesynth.com';
    const clean = raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
    state.targetDomain = clean;
    dom.domainActiveLabel.textContent = clean;

    // Update topbar domain text
    const topbarDomain = document.getElementById('topbar-domain-text');
    if (topbarDomain) topbarDomain.textContent = clean;

    // Detect niche
    if (/synth|watermark|clean|photo|remove|metadata/i.test(clean)) {
      dom.domainDetectedHint.textContent = '✨ AI Watermark & Metadata Cleaning Niche Detected';
    } else if (/proxy|ip|rotate|scrape|geo/i.test(clean)) {
      dom.domainDetectedHint.textContent = '✨ Rotating Proxies & Scraping Infrastructure Niche Detected';
    } else if (/audio|sound|convert|mp3|vid/i.test(clean)) {
      dom.domainDetectedHint.textContent = '✨ Audio Extraction & Media Tooling Niche Detected';
    } else {
      dom.domainDetectedHint.textContent = '✨ Custom Domain Pipeline Active';
    }
  }

  dom.inputDomain.addEventListener('change', updateTargetDomain);
  dom.btnDomainCheck.addEventListener('click', () => {
    updateTargetDomain();
    showToast(`Domain locked to: ${state.targetDomain}`, 'success');
  });

  // Step 2: Strategy Tab Switching
  function setStrategyMode(mode) {
    state.strategyMode = mode;
    dom.stratTabCompetitor.classList.toggle('active', mode === 'competitor');
    dom.stratTabDirect.classList.toggle('active', mode === 'direct');
    dom.stratTabPresets.classList.toggle('active', mode === 'presets');

    dom.paneStratCompetitor.style.display = mode === 'competitor' ? 'block' : 'none';
    dom.paneStratDirect.style.display = mode === 'direct' ? 'block' : 'none';
    dom.paneStratPresets.style.display = mode === 'presets' ? 'block' : 'none';
  }

  dom.stratTabCompetitor.addEventListener('click', () => setStrategyMode('competitor'));
  dom.stratTabDirect.addEventListener('click', () => setStrategyMode('direct'));
  dom.stratTabPresets.addEventListener('click', () => setStrategyMode('presets'));

  // Competitor Analysis API Call
  async function analyzeCompetitors() {
    const competitors = dom.inputCompetitors.value.trim();
    dom.btnAnalyzeCompetitors.disabled = true;
    dom.btnAnalyzeCompetitors.textContent = '⏳ Analyzing...';

    try {
      const res = await fetch('/api/competitor-seeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: state.targetDomain,
          competitors
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract seeds');

      state.discoveredSeeds = data.seeds || [];
      dom.discoveredCount.textContent = state.discoveredSeeds.length;

      dom.competitorSeedChips.innerHTML = state.discoveredSeeds.map(s => {
        const sKw = (s && s.keyword ? s.keyword : '').toLowerCase();
        const isQueued = state.queuedSeeds.some(q => {
          const qKw = (typeof q === 'string' ? q : (q && q.keyword ? q.keyword : '')).toLowerCase();
          return qKw && qKw === sKw;
        });
        return `
          <button type="button" class="competitor-chip ${isQueued ? 'added' : ''}" data-kw="${escapeHtml(s.keyword)}">
            <span class="chip-plus">${isQueued ? '✓' : '+'}</span>
            <span class="chip-kw">${escapeHtml(s.keyword)}</span>
            <span class="chip-vol">${formatNumber(s.estVol)}</span>
          </button>
        `;
      }).join('');

      // Wire chip click events
      dom.competitorSeedChips.querySelectorAll('.competitor-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const kw = chip.dataset.kw;
          addSeedToQueue(kw);
          chip.classList.add('added');
          const plus = chip.querySelector('.chip-plus');
          if (plus) plus.textContent = '✓';
        });
      });

      showToast(`Discovered ${state.discoveredSeeds.length} competitor seed keywords!`, 'success');
    } catch (err) {
      showToast(`Competitor analysis error: ${err.message}`, 'error');
    } finally {
      dom.btnAnalyzeCompetitors.disabled = false;
      dom.btnAnalyzeCompetitors.textContent = '🔍 Analyze Competitors';
    }
  }

  dom.btnAnalyzeCompetitors.addEventListener('click', analyzeCompetitors);

  dom.btnAddAllCompetitors.addEventListener('click', () => {
    if (state.discoveredSeeds.length === 0) return;
    state.discoveredSeeds.forEach(s => addSeedToQueue(s.keyword));
    dom.competitorSeedChips.querySelectorAll('.competitor-chip').forEach(c => {
      c.classList.add('added');
      const plus = c.querySelector('.chip-plus');
      if (plus) plus.textContent = '✓';
    });
    showToast(`Added ${state.discoveredSeeds.length} seeds to queue!`, 'success');
  });

  // Direct Seed Input
  dom.btnAppendDirectSeeds.addEventListener('click', () => {
    const raw = dom.inputDirectSeeds.value.trim();
    if (!raw) {
      showToast('Please type at least one seed keyword', 'info');
      return;
    }

    const items = raw.split(/[\r\n,]+/).map(k => k.trim()).filter(Boolean);
    items.forEach(k => addSeedToQueue(k));
    dom.inputDirectSeeds.value = '';
    showToast(`Added ${items.length} custom seed(s) to queue!`, 'success');
  });

  // Quick Starter Chips
  document.querySelectorAll('.quick-chip-add').forEach(chip => {
    chip.addEventListener('click', () => {
      const addStr = chip.dataset.add;
      if (!addStr) return;
      const items = addStr.split(',').map(s => s.trim()).filter(Boolean);
      items.forEach(k => addSeedToQueue(k));
      showToast(`Queued ${items.length} starter seeds!`, 'success');
    });
  });

  // Matrix Presets Loader
  async function loadPresets() {
    try {
      const res = await fetch('/api/presets');
      const data = await res.json();
      state.presets = data.presets || [];

      dom.presetCardsGrid.innerHTML = '';
      if (state.presets.length === 0) {
        dom.presetCardsGrid.innerHTML = '<div style="color:var(--text-sub);">No presets found in samples/</div>';
        return;
      }

      state.presets.forEach((p, idx) => {
        const isSelected = p.filename.toLowerCase().includes('fabcastle') || idx === 0;
        if (isSelected && !state.selectedPreset) state.selectedPreset = p.filename.replace(/_seeds?\.(xlsx|csv)$/i, '');

        const card = document.createElement('div');
        card.className = `preset-card-option ${isSelected ? 'selected' : ''}`;
        card.dataset.preset = p.filename.replace(/_seeds?\.(xlsx|csv)$/i, '');
        card.innerHTML = `
          <div class="preset-name">${p.name}</div>
          <div class="preset-detail">${p.filename} • ${p.sizeFormatted}</div>
        `;

        card.addEventListener('click', () => {
          document.querySelectorAll('.preset-card-option').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          state.selectedPreset = card.dataset.preset;
        });

        dom.presetCardsGrid.appendChild(card);
      });
    } catch (err) {
      console.error('Error loading presets:', err);
    }
  }

  // Hero Quick Goto Explorer
  // -------------------------------------------------------------
  // ANTIGRAVITY AI AGENT CHATBOX ENGINE
  // -------------------------------------------------------------
  function setupAntigravityChatbox() {
    state.attachedExcel = null;
    state.selectedMarkets = ['us', 'in'];

    const btnOptDomain = document.getElementById('btn-opt-domain');
    const btnOptExcel = document.getElementById('btn-opt-excel');
    const btnOptCountry = document.getElementById('btn-opt-country');
    const btnOptCompetitor = document.getElementById('btn-opt-competitor');

    const trayDomain = document.getElementById('tray-domain');
    const trayExcel = document.getElementById('tray-excel');
    const trayCountry = document.getElementById('tray-country');
    const trayCompetitor = document.getElementById('tray-competitor');

    const allTrays = [trayDomain, trayExcel, trayCountry, trayCompetitor];
    function toggleTray(targetTray, btn) {
      const isVisible = targetTray.style.display === 'block';
      allTrays.forEach(t => { if (t) t.style.display = 'none'; });
      [btnOptDomain, btnOptExcel, btnOptCountry, btnOptCompetitor].forEach(b => {
        if (b) b.classList.remove('active');
      });
      if (!isVisible) {
        targetTray.style.display = 'block';
        if (btn) btn.classList.add('active');
      }
    }

    if (btnOptDomain && trayDomain) {
      btnOptDomain.addEventListener('click', () => toggleTray(trayDomain, btnOptDomain));
    }
    if (btnOptExcel && trayExcel) {
      btnOptExcel.addEventListener('click', () => {
        toggleTray(trayExcel, btnOptExcel);
        renderPickerPresetsList();
      });
    }
    if (btnOptCountry && trayCountry) {
      btnOptCountry.addEventListener('click', () => toggleTray(trayCountry, btnOptCountry));
    }
    if (btnOptCompetitor && trayCompetitor) {
      btnOptCompetitor.addEventListener('click', () => toggleTray(trayCompetitor, btnOptCompetitor));
    }

    // Close buttons for trays
    const btnCloseCountry = document.getElementById('btn-close-country-tray');
    if (btnCloseCountry && trayCountry) {
      btnCloseCountry.addEventListener('click', () => toggleTray(trayCountry, null));
    }
    const btnCloseExcel = document.getElementById('btn-close-excel-tray');
    if (btnCloseExcel && trayExcel) {
      btnCloseExcel.addEventListener('click', () => toggleTray(trayExcel, null));
    }

    // Domain Tray Apply
    const btnApplyDomain = document.getElementById('btn-apply-domain');
    const chatInputDomain = document.getElementById('chat-input-domain');
    const pillDomainVal = document.getElementById('pill-domain-val');
    const summaryDomainChip = document.getElementById('summary-domain-chip');

    if (btnApplyDomain && chatInputDomain) {
      btnApplyDomain.addEventListener('click', () => {
        const val = chatInputDomain.value.trim();
        if (val) {
          state.targetDomain = val.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
          if (pillDomainVal) pillDomainVal.textContent = state.targetDomain;
          if (summaryDomainChip) summaryDomainChip.textContent = `🌐 ${state.targetDomain}`;
          if (dom.inputDomain) dom.inputDomain.value = state.targetDomain;
          updateTargetDomain();
          toggleTray(trayDomain, null);
          appendChatMessage('agent', `🌐 Target domain updated to <strong>${state.targetDomain}</strong>. Ready to research!`);
          showToast(`Domain locked: ${state.targetDomain}`, 'success');
        }
      });
    }

    // Country Checkboxes in Tray
    const countryContainer = document.getElementById('chat-country-checkboxes');
    const pillCountriesVal = document.getElementById('pill-countries-val');
    const summaryCountryChip = document.getElementById('summary-country-chip');

    // -------------------------------------------------------------
    // INTERACTIVE WORLD MAP & MARKET SELECTOR ENGINE (Google Keyword Planner Style)
    // -------------------------------------------------------------
    const GLOBAL_MARKETS = [
      { code: 'us', name: 'United States', flag: '🇺🇸', tier: 1 },
      { code: 'in', name: 'India', flag: '🇮🇳', tier: 1 },
      { code: 'gb', name: 'United Kingdom', flag: '🇬🇧', tier: 1 },
      { code: 'ca', name: 'Canada', flag: '🇨🇦', tier: 1 },
      { code: 'au', name: 'Australia', flag: '🇦🇺', tier: 1 },
      { code: 'de', name: 'Germany', flag: '🇩🇪', tier: 1 },
      { code: 'fr', name: 'France', flag: '🇫🇷', tier: 1 },
      { code: 'jp', name: 'Japan', flag: '🇯🇵', tier: 1 },
      { code: 'br', name: 'Brazil', flag: '🇧🇷', tier: 1 },
      { code: 'ae', name: 'United Arab Emirates', flag: '🇦🇪', tier: 2 },
      { code: 'sg', name: 'Singapore', flag: '🇸🇬', tier: 2 },
      { code: 'it', name: 'Italy', flag: '🇮🇹', tier: 2 },
      { code: 'es', name: 'Spain', flag: '🇪🇸', tier: 2 },
      { code: 'nl', name: 'Netherlands', flag: '🇳🇱', tier: 2 },
      { code: 'se', name: 'Sweden', flag: '🇸🇪', tier: 2 },
      { code: 'no', name: 'Norway', flag: '🇳🇴', tier: 2 },
      { code: 'dk', name: 'Denmark', flag: '🇩🇰', tier: 2 },
      { code: 'fi', name: 'Finland', flag: '🇫🇮', tier: 2 },
      { code: 'ch', name: 'Switzerland', flag: '🇨🇭', tier: 2 },
      { code: 'ie', name: 'Ireland', flag: '🇮🇪', tier: 2 },
      { code: 'nz', name: 'New Zealand', flag: '🇳🇿', tier: 2 },
      { code: 'za', name: 'South Africa', flag: '🇿🇦', tier: 2 },
      { code: 'mx', name: 'Mexico', flag: '🇲🇽', tier: 2 },
      { code: 'id', name: 'Indonesia', flag: '🇮🇩', tier: 2 },
      { code: 'kr', name: 'South Korea', flag: '🇰🇷', tier: 2 },
      { code: 'sa', name: 'Saudi Arabia', flag: '🇸🇦', tier: 2 },
      { code: 'pl', name: 'Poland', flag: '🇵🇱', tier: 2 },
      { code: 'tr', name: 'Turkey', flag: '🇹🇷', tier: 2 },
      { code: 'ar', name: 'Argentina', flag: '🇦🇷', tier: 3 },
      { code: 'cl', name: 'Chile', flag: '🇨🇱', tier: 3 },
      { code: 'co', name: 'Colombia', flag: '🇨🇴', tier: 3 },
      { code: 'my', name: 'Malaysia', flag: '🇲🇾', tier: 3 },
      { code: 'th', name: 'Thailand', flag: '🇹🇭', tier: 3 },
      { code: 'ph', name: 'Philippines', flag: '🇵🇭', tier: 3 },
      { code: 'vn', name: 'Vietnam', flag: '🇻🇳', tier: 3 },
      { code: 'eg', name: 'Egypt', flag: '🇪🇬', tier: 3 },
      { code: 'ng', name: 'Nigeria', flag: '🇳🇬', tier: 3 },
      { code: 'ru', name: 'Russia', flag: '🇷🇺', tier: 3 },
      { code: 'cn', name: 'China', flag: '🇨🇳', tier: 3 },
      { code: 'il', name: 'Israel', flag: '🇮🇱', tier: 3 },
      { code: 'at', name: 'Austria', flag: '🇦🇹', tier: 3 },
      { code: 'be', name: 'Belgium', flag: '🇧🇪', tier: 3 },
      { code: 'pt', name: 'Portugal', flag: '🇵🇹', tier: 3 }
    ];

    const PIN_COORDINATES = {
      us: { x: 230, y: 175 },
      ca: { x: 235, y: 105 },
      mx: { x: 215, y: 240 },
      br: { x: 360, y: 340 },
      ar: { x: 330, y: 430 },
      cl: { x: 320, y: 417 },
      co: { x: 285, y: 285 },
      gb: { x: 485, y: 135 },
      fr: { x: 495, y: 175 },
      de: { x: 520, y: 155 },
      es: { x: 475, y: 200 },
      it: { x: 530, y: 195 },
      nl: { x: 513, y: 132 },
      be: { x: 511, y: 137 },
      ch: { x: 520, y: 149 },
      at: { x: 534, y: 146 },
      ie: { x: 481, y: 129 },
      pt: { x: 480, y: 171 },
      pl: { x: 550, y: 145 },
      se: { x: 530, y: 105 },
      no: { x: 505, y: 95 },
      fi: { x: 556, y: 97 },
      ua: { x: 575, y: 141 },
      tr: { x: 585, y: 190 },
      ru: { x: 690, y: 110 },
      eg: { x: 575, y: 230 },
      za: { x: 560, y: 410 },
      ng: { x: 522, y: 266 },
      sa: { x: 605, y: 240 },
      ae: { x: 644, y: 221 },
      il: { x: 591, y: 197 },
      in: { x: 695, y: 245 },
      pk: { x: 681, y: 202 },
      bd: { x: 740, y: 221 },
      cn: { x: 765, y: 205 },
      jp: { x: 875, y: 190 },
      kr: { x: 826, y: 181 },
      id: { x: 805, y: 315 },
      my: { x: 799, y: 285 },
      th: { x: 772, y: 249 },
      vn: { x: 786, y: 244 },
      ph: { x: 833, y: 259 },
      au: { x: 845, y: 395 },
      nz: { x: 940, y: 440 },
      kz: { x: 662, y: 145 }
    };

    const mapSvg = document.getElementById('world-map-svg');
    const mapTooltip = document.getElementById('map-tooltip');
    const mapSelectedBadge = document.getElementById('map-selected-badge');
    const mapSelectedChipsCloud = document.getElementById('map-selected-chips-cloud');
    const mapSearchInput = document.getElementById('map-country-search');
    const mapSearchDropdown = document.getElementById('map-search-dropdown');
    const btnClearMapSearch = document.getElementById('btn-clear-map-search');
    const btnMapClearAll = document.getElementById('btn-map-clear-all');

    function syncMarketUI() {
      // 1. Highlight map paths & country name labels
      if (mapSvg) {
        mapSvg.querySelectorAll('.map-country').forEach(path => {
          const code = (path.dataset.code || '').toLowerCase();
          const isSelected = state.selectedMarkets.includes(code);
          path.classList.toggle('selected', isSelected);
        });

        mapSvg.querySelectorAll('.map-country-name-label').forEach(lbl => {
          const code = (lbl.dataset.code || '').toLowerCase();
          const isSelected = state.selectedMarkets.includes(code);
          lbl.classList.toggle('selected', isSelected);
        });

        if (typeof updateMapLabelsVisibility === 'function') {
          updateMapLabelsVisibility();
        }

        const pinsGroup = document.getElementById('map-target-pins-group');
        if (pinsGroup) {
          pinsGroup.innerHTML = state.selectedMarkets.map(code => {
            const coords = PIN_COORDINATES[code];
            if (!coords) return '';
            return `
              <g class="map-pin-marker" data-code="${code}" transform="translate(${coords.x}, ${coords.y})">
                <circle r="9" fill="rgba(26, 115, 232, 0.28)" class="map-pin-pulse"></circle>
                <circle r="4.5" fill="#1A73E8" stroke="#FFFFFF" stroke-width="2"></circle>
              </g>
            `;
          }).join('');
        }
      }

      // 2. Render Selected Market Chips Cloud
      if (mapSelectedChipsCloud) {
        if (!state.selectedMarkets || state.selectedMarkets.length === 0) {
          mapSelectedChipsCloud.innerHTML = '<span style="font-size:0.75rem;color:var(--text-muted);font-style:italic;padding:4px 0;">No markets selected (click map or search above)</span>';
        } else {
          mapSelectedChipsCloud.innerHTML = state.selectedMarkets.map(code => {
            const item = GLOBAL_MARKETS.find(m => m.code === code) || { code, name: code.toUpperCase() };
            return `
              <span class="market-chip" data-code="${escapeHtml(item.code)}">
                <span class="market-chip-code">${item.code.toUpperCase()}</span>
                <span>${escapeHtml(item.name)}</span>
                <button type="button" class="btn-remove-chip" data-code="${escapeHtml(item.code)}" title="Remove market">✕</button>
              </span>
            `;
          }).join('');
        }
      }

      // 3. Update count badge
      const count = state.selectedMarkets.length;
      if (mapSelectedBadge) {
        mapSelectedBadge.textContent = `${count} market${count === 1 ? '' : 's'} active`;
      }

      // 4. Update Chatbox Country Pill and Summary
      let displayStr = 'None';
      if (state.selectedMarkets.length > 0) {
        if (state.selectedMarkets.length <= 3) {
          displayStr = state.selectedMarkets.map(c => {
            const item = GLOBAL_MARKETS.find(m => m.code === c);
            return item ? `${item.name}` : c.toUpperCase();
          }).join(', ');
        } else {
          displayStr = `${state.selectedMarkets.length} markets (${state.selectedMarkets.map(c => c.toUpperCase()).join(', ')})`;
        }
      }

      if (pillCountriesVal) pillCountriesVal.textContent = displayStr;
      if (summaryCountryChip) summaryCountryChip.textContent = `🌍 ${displayStr}`;

      // 5. Update legacy tray checkboxes if present
      if (countryContainer) {
        countryContainer.querySelectorAll('.chat-market-tag').forEach(tag => {
          const input = tag.querySelector('input');
          if (input) {
            input.checked = state.selectedMarkets.includes(input.value.toLowerCase());
            tag.classList.toggle('selected', input.checked);
          }
        });
      }
    }

    function toggleMarket(code, meta = null) {
      if (!code) return;
      code = code.toLowerCase();
      
      let item = GLOBAL_MARKETS.find(m => m.code === code);
      if (!item) {
        const name = (meta && meta.name) || code.toUpperCase();
        const flag = (meta && meta.flag) || '🌐';
        item = { code, name, flag, tier: 2 };
        GLOBAL_MARKETS.push(item);
      }

      const idx = state.selectedMarkets.indexOf(code);
      const isNowActive = idx === -1;
      if (isNowActive) {
        state.selectedMarkets.push(code);
        showToast(`${item.flag} ${item.name}: Added to target SERPs`, 'success');
      } else {
        state.selectedMarkets.splice(idx, 1);
        showToast(`${item.flag} ${item.name}: Removed from target SERPs`, 'info');
      }
      syncMarketUI();
    }

    // -------------------------------------------------------------
    // INTERACTIVE WORLD MAP PAN & ZOOM ENGINE (Google Maps Style)
    // -------------------------------------------------------------
    const BASE_VIEWBOX = { x: 0, y: 0, w: 1000, h: 520 };
    let mapZoom = 1;
    let mapPan = { x: 0, y: 0 };
    let isMouseDown = false;
    let hasDragged = false;
    let dragEndTimeout = null;
    let mouseDownPos = { x: 0, y: 0 };
    let panStart = { x: 0, y: 0 };
    let lastTouchDistance = null;
    let lastTouchCenter = null;

    const mapContainer = document.getElementById('interactive-map-container');
    const btnMapZoomIn = document.getElementById('btn-map-zoom-in');
    const btnMapZoomOut = document.getElementById('btn-map-zoom-out');
    const btnMapZoomReset = document.getElementById('btn-map-zoom-reset');
    const mapZoomBadge = document.getElementById('map-zoom-level-badge');
    const mapPanZoomHint = document.getElementById('map-pan-zoom-hint');

    function updateMapLabelsVisibility() {
      if (!mapSvg) return;
      const labelsGroup = document.getElementById('map-labels-group');
      if (!labelsGroup) return;

      const w = BASE_VIEWBOX.w / mapZoom;
      const h = BASE_VIEWBOX.h / mapZoom;
      const minX = mapPan.x;
      const maxX = mapPan.x + w;
      const minY = mapPan.y;
      const maxY = mapPan.y + h;

      // When map is at normal/unzoomed level (< 1.35x), keep map completely clean (no labels unless selected)
      const isUnzoomed = mapZoom < 1.35;

      const labels = labelsGroup.querySelectorAll('.map-country-name-label');
      labels.forEach(lbl => {
        const code = (lbl.dataset.code || '').toLowerCase();
        const isSelected = state.selectedMarkets && state.selectedMarkets.includes(code);

        if (isUnzoomed) {
          if (isSelected) {
            lbl.style.display = 'block';
            lbl.style.opacity = '1';
            lbl.style.fontSize = '7.5px';
            lbl.style.strokeWidth = '2px';
          } else {
            lbl.style.display = 'none';
            lbl.style.opacity = '0';
          }
          return;
        }

        // Zoomed in: ONLY show country names that are within the current visible viewport!
        const lx = parseFloat(lbl.getAttribute('x')) || 0;
        const ly = parseFloat(lbl.getAttribute('y')) || 0;
        const inViewport = (lx >= minX - 15 && lx <= maxX + 15 && ly >= minY - 15 && ly <= maxY + 15);

        if (!inViewport && !isSelected) {
          lbl.style.display = 'none';
          lbl.style.opacity = '0';
          return;
        }

        const isMajor = lbl.classList.contains('map-lbl-major');
        const isMedium = lbl.classList.contains('map-lbl-medium');
        const isDetail = lbl.classList.contains('map-lbl-detail');

        let shouldShow = false;
        if (isSelected) {
          shouldShow = true;
        } else if (mapZoom >= 3.2) {
          shouldShow = inViewport;
        } else if (mapZoom >= 2.2) {
          shouldShow = inViewport && (isMajor || isMedium);
        } else {
          // 1.35 <= mapZoom < 2.2: Show only major nations in this zoomed region
          shouldShow = inViewport && isMajor;
        }

        if (shouldShow) {
          lbl.style.display = 'block';
          lbl.style.opacity = '1';
          const baseSize = isMajor ? 8.5 : (isMedium ? 7.2 : 6.0);
          const scaledSize = Math.max(3.2, baseSize / Math.pow(mapZoom, 0.45));
          lbl.style.fontSize = `${scaledSize.toFixed(1)}px`;
          lbl.style.strokeWidth = `${(scaledSize * 0.28).toFixed(1)}px`;
        } else {
          lbl.style.display = 'none';
          lbl.style.opacity = '0';
        }
      });
    }

    function updateMapViewBox(animate = false) {
      if (!mapSvg) return;
      const w = BASE_VIEWBOX.w / mapZoom;
      const h = BASE_VIEWBOX.h / mapZoom;

      // Pan bounds so map doesn't get lost off-screen
      const marginX = Math.max(80, 180 / mapZoom);
      const marginY = Math.max(50, 120 / mapZoom);
      const minX = -marginX;
      const maxX = BASE_VIEWBOX.w - w + marginX;
      const minY = -marginY;
      const maxY = BASE_VIEWBOX.h - h + marginY;

      mapPan.x = Math.max(minX, Math.min(maxX, mapPan.x));
      mapPan.y = Math.max(minY, Math.min(maxY, mapPan.y));

      if (animate) {
        mapSvg.style.transition = 'viewBox 0.22s ease-out';
      } else {
        mapSvg.style.transition = 'none';
      }

      mapSvg.setAttribute('viewBox', `${mapPan.x.toFixed(2)} ${mapPan.y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);

      if (mapZoomBadge) {
        mapZoomBadge.textContent = `${Math.round(mapZoom * 100)}%`;
      }

      updateMapLabelsVisibility();
    }

    function zoomMap(factor, focalPoint = null, animate = true) {
      const oldZoom = mapZoom;
      let newZoom = Math.max(1, Math.min(8, oldZoom * factor));
      if (Math.abs(newZoom - oldZoom) < 0.001) return;

      const svgRect = mapSvg.getBoundingClientRect();
      let fx = 0.5;
      let fy = 0.5;

      if (focalPoint && svgRect.width > 0 && svgRect.height > 0) {
        fx = (focalPoint.x - svgRect.left) / svgRect.width;
        fy = (focalPoint.y - svgRect.top) / svgRect.height;
        fx = Math.max(0, Math.min(1, fx));
        fy = Math.max(0, Math.min(1, fy));
      }

      const oldW = BASE_VIEWBOX.w / oldZoom;
      const oldH = BASE_VIEWBOX.h / oldZoom;
      const curSvgX = mapPan.x + fx * oldW;
      const curSvgY = mapPan.y + fy * oldH;

      mapZoom = newZoom;
      const newW = BASE_VIEWBOX.w / newZoom;
      const newH = BASE_VIEWBOX.h / newZoom;

      if (mapZoom <= 1.01) {
        mapZoom = 1;
        mapPan.x = 0;
        mapPan.y = 0;
      } else {
        mapPan.x = curSvgX - fx * newW;
        mapPan.y = curSvgY - fy * newH;
      }

      updateMapViewBox(animate);

      // Hide hint once user begins interacting
      if (mapPanZoomHint) {
        mapPanZoomHint.style.opacity = '0';
      }
    }

    function resetMapZoomPan() {
      mapZoom = 1;
      mapPan.x = 0;
      mapPan.y = 0;
      updateMapViewBox(true);
    }

    if (btnMapZoomIn) {
      btnMapZoomIn.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomMap(1.4, null, true);
      });
    }

    if (btnMapZoomOut) {
      btnMapZoomOut.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomMap(0.71, null, true);
      });
    }

    if (btnMapZoomReset) {
      btnMapZoomReset.addEventListener('click', (e) => {
        e.stopPropagation();
        resetMapZoomPan();
      });
    }

    if (mapContainer && mapSvg) {
      // 1. Mouse wheel zoom towards pointer
      mapContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.18 : 0.85;
        zoomMap(factor, { x: e.clientX, y: e.clientY }, false);
      }, { passive: false });

      // 2. Double click to zoom in
      mapContainer.addEventListener('dblclick', (e) => {
        if (e.target.closest('.map-floating-controls, .btn-clear-map-search')) return;
        zoomMap(1.7, { x: e.clientX, y: e.clientY }, true);
      });

      // 3. Mouse Drag to Pan (smart drag threshold)
      mapContainer.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.closest('.map-floating-controls, .btn-clear-map-search')) return;
        isMouseDown = true;
        hasDragged = false;
        mouseDownPos = { x: e.clientX, y: e.clientY };
        panStart = { x: e.clientX, y: e.clientY };
      });

      window.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;
        const dist = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y);
        if (!hasDragged && dist > 5) {
          hasDragged = true;
          mapContainer.classList.add('is-panning');
          if (mapTooltip) mapTooltip.style.display = 'none';
          if (mapPanZoomHint) mapPanZoomHint.style.opacity = '0';
        }
        if (hasDragged) {
          const dx = e.clientX - panStart.x;
          const dy = e.clientY - panStart.y;
          const svgRect = mapSvg.getBoundingClientRect();
          const w = BASE_VIEWBOX.w / mapZoom;
          const h = BASE_VIEWBOX.h / mapZoom;
          const scaleX = w / svgRect.width;
          const scaleY = h / svgRect.height;

          mapPan.x -= dx * scaleX;
          mapPan.y -= dy * scaleY;
          panStart = { x: e.clientX, y: e.clientY };
          updateMapViewBox(false);
        }
      });

      window.addEventListener('mouseup', () => {
        if (!isMouseDown) return;
        isMouseDown = false;
        mapContainer.classList.remove('is-panning');
        if (hasDragged) {
          clearTimeout(dragEndTimeout);
          dragEndTimeout = setTimeout(() => {
            hasDragged = false;
          }, 70);
        }
      });

      // 4. Touch support (pinch to zoom & drag to pan)
      mapContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          isMouseDown = true;
          hasDragged = false;
          mouseDownPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
          isMouseDown = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          lastTouchDistance = Math.hypot(dx, dy);
          lastTouchCenter = {
            x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            y: (e.touches[0].clientY + e.touches[1].clientY) / 2
          };
        }
      }, { passive: true });

      mapContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isMouseDown) {
          const dist = Math.hypot(e.touches[0].clientX - mouseDownPos.x, e.touches[0].clientY - mouseDownPos.y);
          if (!hasDragged && dist > 6) hasDragged = true;
          if (hasDragged) {
            const dx = e.touches[0].clientX - panStart.x;
            const dy = e.touches[0].clientY - panStart.y;
            const svgRect = mapSvg.getBoundingClientRect();
            const w = BASE_VIEWBOX.w / mapZoom;
            const h = BASE_VIEWBOX.h / mapZoom;
            mapPan.x -= dx * (w / svgRect.width);
            mapPan.y -= dy * (h / svgRect.height);
            panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            updateMapViewBox(false);
          }
        } else if (e.touches.length === 2 && lastTouchDistance) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const newDistance = Math.hypot(dx, dy);
          const factor = newDistance / lastTouchDistance;
          zoomMap(factor, lastTouchCenter, false);
          lastTouchDistance = newDistance;
        }
      }, { passive: true });

      mapContainer.addEventListener('touchend', () => {
        isMouseDown = false;
        lastTouchDistance = null;
        if (hasDragged) {
          clearTimeout(dragEndTimeout);
          dragEndTimeout = setTimeout(() => {
            hasDragged = false;
          }, 70);
        }
      });

      // 5. Interactive SVG Map CLICK EVENT (Delegated on mapContainer and mapSvg)
      mapContainer.addEventListener('click', (e) => {
        if (e.target.closest('.map-floating-controls, .btn-clear-map-search')) return;
        if (hasDragged) return;

        const target = e.target.closest('.map-country, .map-country-name-label, .map-pin-marker');
        if (target && target.dataset && target.dataset.code) {
          const code = target.dataset.code;
          const name = target.dataset.name || (GLOBAL_MARKETS.find(m => m.code === code.toLowerCase())?.name);
          const flag = target.dataset.flag || (GLOBAL_MARKETS.find(m => m.code === code.toLowerCase())?.flag);
          toggleMarket(code, { name, flag });
        }
      });

      mapContainer.addEventListener('mousemove', (e) => {
        if (isMouseDown && hasDragged) return;
        const target = e.target.closest('.map-country, .map-country-name-label, .map-pin-marker');
        if (target && mapTooltip) {
          const code = (target.dataset.code || '').toLowerCase();
          const item = GLOBAL_MARKETS.find(m => m.code === code);
          const flag = item ? item.flag : (target.dataset.flag || '🌐');
          const name = item ? item.name : (target.dataset.name || code.toUpperCase());
          const isSelected = state.selectedMarkets.includes(code);

          mapTooltip.innerHTML = `${flag} <strong>${name}</strong> (${code.toUpperCase()}) • <em>${isSelected ? 'Selected (Click to remove)' : 'Click to add'}</em>`;
          mapTooltip.style.display = 'block';

          const containerRect = mapContainer.getBoundingClientRect();
          const x = e.clientX - containerRect.left + 10;
          const y = e.clientY - containerRect.top + 15;
          mapTooltip.style.left = `${Math.min(x, containerRect.width - 240)}px`;
          mapTooltip.style.top = `${y}px`;
        } else if (mapTooltip) {
          mapTooltip.style.display = 'none';
        }
      });

      mapContainer.addEventListener('mouseleave', () => {
        if (mapTooltip) mapTooltip.style.display = 'none';
      });
    }



    // Removing chips from selected cloud
    if (mapSelectedChipsCloud) {
      mapSelectedChipsCloud.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove-chip');
        if (btn && btn.dataset.code) {
          toggleMarket(btn.dataset.code);
        }
      });
    }

    // Country Search & Autocomplete
    if (mapSearchInput && mapSearchDropdown) {
      function renderSearchDropdown(query) {
        query = (query || '').trim().toLowerCase();
        const matches = query
          ? GLOBAL_MARKETS.filter(m => m.name.toLowerCase().includes(query) || m.code.toLowerCase().includes(query))
          : GLOBAL_MARKETS.slice(0, 8);

        if (matches.length === 0) {
          mapSearchDropdown.innerHTML = '<div style="padding:0.75rem;font-size:0.78rem;color:var(--text-muted);text-align:center;">No countries found. Try "United States", "Germany", "India"...</div>';
        } else {
          mapSearchDropdown.innerHTML = matches.map(m => {
            const isSelected = state.selectedMarkets.includes(m.code);
            return `
              <div class="map-search-item ${isSelected ? 'selected' : ''}" data-code="${m.code}">
                <div class="map-search-item-info">
                  <span style="font-size:1.1rem;line-height:1;">${m.flag}</span>
                  <span>${escapeHtml(m.name)}</span>
                  <span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted);">(${m.code.toUpperCase()})</span>
                </div>
                <span class="map-search-item-action">${isSelected ? '✓ Active' : '+ Add'}</span>
              </div>
            `;
          }).join('');
        }
        mapSearchDropdown.style.display = 'block';
      }

      mapSearchInput.addEventListener('input', () => {
        const q = mapSearchInput.value;
        if (btnClearMapSearch) btnClearMapSearch.style.display = q ? 'inline-block' : 'none';
        renderSearchDropdown(q);
      });

      mapSearchInput.addEventListener('focus', () => {
        renderSearchDropdown(mapSearchInput.value);
      });

      mapSearchDropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.map-search-item');
        if (item && item.dataset.code) {
          toggleMarket(item.dataset.code);
          mapSearchDropdown.style.display = 'none';
          mapSearchInput.value = '';
          if (btnClearMapSearch) btnClearMapSearch.style.display = 'none';
        }
      });

      if (btnClearMapSearch) {
        btnClearMapSearch.addEventListener('click', () => {
          mapSearchInput.value = '';
          btnClearMapSearch.style.display = 'none';
          mapSearchDropdown.style.display = 'none';
        });
      }

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.map-search-wrapper')) {
          mapSearchDropdown.style.display = 'none';
        }
      });
    }

    // Quick Preset Buttons
    document.querySelectorAll('.btn-map-preset[data-preset-markets]').forEach(btn => {
      btn.addEventListener('click', () => {
        const markets = (btn.dataset.presetMarkets || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        state.selectedMarkets = markets;
        syncMarketUI();
        showToast(`Target markets set to: ${markets.join(', ').toUpperCase()}`, 'info');
      });
    });

    if (btnMapClearAll) {
      btnMapClearAll.addEventListener('click', () => {
        state.selectedMarkets = [];
        syncMarketUI();
        showToast('All target markets cleared. Click on map to add.', 'warning');
      });
    }

    // Tray checkboxes event
    if (countryContainer) {
      countryContainer.addEventListener('change', () => {
        const checked = Array.from(countryContainer.querySelectorAll('input[type="checkbox"]:checked'))
          .map(cb => cb.value.toLowerCase());
        state.selectedMarkets = checked;
        syncMarketUI();
      });
    }

    // Initial sync of UI and map labels
    syncMarketUI();
    updateMapViewBox(false);

    // Excel Upload Handler
    const excelFileInput = document.getElementById('chat-excel-file-input');
    const excelDropzone = document.getElementById('chat-excel-dropzone');
    const attachedExcelChip = document.getElementById('attached-excel-chip');
    const attachedExcelName = document.getElementById('attached-excel-name');
    const attachedExcelCount = document.getElementById('attached-excel-count');
    const btnRemoveExcel = document.getElementById('btn-remove-excel-attachment');
    const pillExcelLabel = document.getElementById('pill-excel-label');

    if (excelDropzone && excelFileInput) {
      excelDropzone.addEventListener('click', () => excelFileInput.click());

      excelDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        excelDropzone.style.borderColor = 'var(--emerald)';
      });
      excelDropzone.addEventListener('dragleave', () => {
        excelDropzone.style.borderColor = '#111111';
      });
      excelDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        excelDropzone.style.borderColor = '#111111';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          uploadExcelFile(e.dataTransfer.files[0]);
        }
      });

      excelFileInput.addEventListener('change', () => {
        if (excelFileInput.files && excelFileInput.files.length > 0) {
          uploadExcelFile(excelFileInput.files[0]);
        }
      });
    }

    async function uploadExcelFile(file) {
      try {
        showToast(`Uploading ${file.name}...`, 'info');
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result).split(',')[1];
          const res = await fetch('/api/upload-seed-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              base64Content: base64
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to parse Excel file');

          state.attachedExcel = {
            filename: data.filename,
            count: data.rowCount
          };

          if (attachedExcelChip) {
            attachedExcelChip.style.display = 'inline-flex';
            if (attachedExcelName) attachedExcelName.textContent = data.filename;
            if (attachedExcelCount) attachedExcelCount.textContent = `(${data.rowCount} seeds)`;
          }
          if (pillExcelLabel) pillExcelLabel.textContent = `📊 ${data.filename}`;

          const summarySeedsChip = document.getElementById('summary-seeds-chip');
          if (summarySeedsChip) summarySeedsChip.textContent = `📄 ${data.filename} (${data.rowCount} seeds)`;

          toggleTray(trayExcel, null);
          appendChatMessage('agent', `📊 Successfully attached seed matrix <strong>"${data.filename}"</strong> with <strong>${data.rowCount}</strong> keyword rows. Ready to run!`);
          showToast(`Attached ${data.filename} (${data.rowCount} rows)`, 'success');
        };
        reader.readAsDataURL(file);
      } catch (err) {
        showToast(`Excel upload error: ${err.message}`, 'error');
      }
    }

    if (btnRemoveExcel) {
      btnRemoveExcel.addEventListener('click', (e) => {
        e.stopPropagation();
        state.attachedExcel = null;
        if (attachedExcelChip) attachedExcelChip.style.display = 'none';
        if (pillExcelLabel) pillExcelLabel.textContent = '+ Add Excel / Sheet';
        const summarySeedsChip = document.getElementById('summary-seeds-chip');
        if (summarySeedsChip) summarySeedsChip.textContent = `⚡ ${state.queuedSeeds.length} seeds queued`;
        showToast('Attached file removed', 'info');
      });
    }

    function renderPickerPresetsList() {
      const pickerList = document.getElementById('picker-presets-list');
      if (!pickerList) return;
      if (state.presets.length === 0) {
        pickerList.innerHTML = '<span style="font-size:0.75rem;color:var(--text-sub);">No presets found</span>';
        return;
      }
      pickerList.innerHTML = state.presets.map(p => `
        <button type="button" class="btn-pick-preset-opt ${state.attachedExcel && state.attachedExcel.filename === p.filename ? 'active' : ''}" data-file="${escapeHtml(p.filename)}">
          <span>${escapeHtml(p.name)}</span>
          <span style="font-size:0.68rem;opacity:0.7;">${p.filename}</span>
        </button>
      `).join('');

      pickerList.querySelectorAll('.btn-pick-preset-opt').forEach(btn => {
        btn.addEventListener('click', () => {
          const fn = btn.dataset.file;
          state.attachedExcel = { filename: fn, count: 60 };
          if (attachedExcelChip) {
            attachedExcelChip.style.display = 'inline-flex';
            if (attachedExcelName) attachedExcelName.textContent = fn;
            if (attachedExcelCount) attachedExcelCount.textContent = '(Matrix Preset)';
          }
          if (pillExcelLabel) pillExcelLabel.textContent = `📊 ${fn}`;
          const summarySeedsChip = document.getElementById('summary-seeds-chip');
          if (summarySeedsChip) summarySeedsChip.textContent = `📄 ${fn} (Matrix)`;
          toggleTray(trayExcel, null);
          appendChatMessage('agent', `📊 Attached pre-built seed matrix <strong>"${fn}"</strong>.`);
          showToast(`Selected preset: ${fn}`, 'success');
        });
      });
    }

    // Competitor Discovery in Chat Tray
    const btnChatAnalyzeCompetitors = document.getElementById('btn-chat-analyze-competitors');
    const chatInputCompetitors = document.getElementById('chat-input-competitors');
    const chatCompetitorChips = document.getElementById('chat-competitor-chips');

    if (btnChatAnalyzeCompetitors && chatInputCompetitors) {
      btnChatAnalyzeCompetitors.addEventListener('click', async () => {
        btnChatAnalyzeCompetitors.disabled = true;
        btnChatAnalyzeCompetitors.textContent = 'Analyzing...';
        try {
          const res = await fetch('/api/competitor-seeds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              domain: state.targetDomain,
              competitors: chatInputCompetitors.value.trim()
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to extract seeds');

          const seeds = data.seeds || [];
          if (chatCompetitorChips) {
            chatCompetitorChips.innerHTML = seeds.map(s => `
              <button type="button" class="competitor-chip" data-kw="${escapeHtml(s.keyword)}">
                <span>+</span>
                <span>${escapeHtml(s.keyword)}</span>
              </button>
            `).join('');

            chatCompetitorChips.querySelectorAll('.competitor-chip').forEach(c => {
              c.addEventListener('click', () => {
                addSeedToQueue(c.dataset.kw);
                c.classList.add('added');
                showToast(`Queued seed: "${c.dataset.kw}"`, 'success');
              });
            });
          }
          showToast(`Extracted ${seeds.length} competitor seeds!`, 'success');
        } catch (err) {
          showToast(`Competitor error: ${err.message}`, 'error');
        } finally {
          btnChatAnalyzeCompetitors.disabled = false;
          btnChatAnalyzeCompetitors.textContent = 'Extract Seeds';
        }
      });
    }

    // ChatGPT Prompt Suggestion Cards
    document.querySelectorAll('.chatgpt-prompt-card').forEach(card => {
      card.addEventListener('click', () => {
        const chatAgentInput = document.getElementById('chat-agent-input');
        const text = card.dataset.text || '';
        const domain = card.dataset.domain;
        const preset = card.dataset.preset;
        const competitor = card.dataset.competitor;

        if (domain) {
          state.targetDomain = domain;
          const pillDomainVal = document.getElementById('pill-domain-val');
          if (pillDomainVal) pillDomainVal.textContent = domain;
          if (dom.inputDomain) dom.inputDomain.value = domain;
          updateTargetDomain();
        }

        if (preset) {
          state.attachedExcel = { filename: preset, count: 60 };
          const attachedExcelChip = document.getElementById('attached-excel-chip');
          const attachedExcelName = document.getElementById('attached-excel-name');
          const attachedExcelCount = document.getElementById('attached-excel-count');
          const pillExcelLabel = document.getElementById('pill-excel-label');
          if (attachedExcelChip) {
            attachedExcelChip.style.display = 'inline-flex';
            if (attachedExcelName) attachedExcelName.textContent = preset;
            if (attachedExcelCount) attachedExcelCount.textContent = '(60 seeds)';
          }
          if (pillExcelLabel) pillExcelLabel.textContent = `📊 ${preset}`;
        }

        if (competitor) {
          const chatInputCompetitors = document.getElementById('chat-input-competitors');
          if (chatInputCompetitors) chatInputCompetitors.value = competitor;
        }

        if (chatAgentInput) {
          chatAgentInput.value = text;
          chatAgentInput.focus();
        }
      });
    });

    // RTRVR Use Cases Showcase Tab Switcher
    const rtrvrTabs = document.querySelectorAll('.rtrvr-tab');
    const rtrvrCanvas = document.getElementById('rtrvr-stage-canvas');
    rtrvrTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tabId;
        const themeColor = tab.dataset.theme;

        // Update active tab button
        rtrvrTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Morph canvas background color dynamically
        if (rtrvrCanvas && themeColor) {
          rtrvrCanvas.style.backgroundColor = themeColor;
        }

        // Show corresponding panel
        document.querySelectorAll('.rtrvr-panel').forEach(panel => {
          panel.classList.remove('active');
        });
        const targetPanel = document.getElementById(`rtrvr-panel-${tabId}`);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }
      });
    });

    // Quick Starter Chips in Welcome Message
    document.querySelectorAll('.btn-starter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const quick = chip.dataset.quick;
        if (quick === 'domain') toggleTray(trayDomain, btnOptDomain);
        if (quick === 'excel') toggleTray(trayExcel, btnOptExcel);
        if (quick === 'competitor') toggleTray(trayCompetitor, btnOptCompetitor);
      });
    });

    // Chat Textarea Enter Key Listener
    const chatAgentInput = document.getElementById('chat-agent-input');
    if (chatAgentInput) {
      chatAgentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          launchAutonomousResearchFromChat();
        }
      });
    }

    // Launch Button in Chatbox
    const btnChatRun = document.getElementById('btn-chat-run');
    if (btnChatRun) {
      btnChatRun.addEventListener('click', () => {
        launchAutonomousResearchFromChat();
      });
    }

    // New Chat Button in Left Chat Pane Header
    const btnChatNewThread = document.getElementById('btn-chat-new-thread');
    if (btnChatNewThread) {
      btnChatNewThread.addEventListener('click', () => {
        const welcome = document.getElementById('chatgpt-welcome-center');
        if (welcome) welcome.style.display = 'flex';
        const thread = document.getElementById('chat-thread-container');
        if (thread) {
          thread.innerHTML = '';
          thread.style.display = 'none';
        }
        const input = document.getElementById('chat-agent-input');
        if (input) {
          input.value = '';
          input.focus();
        }
        showToast('New conversation initialized', 'info');
      });
    }
  }

  function appendChatMessage(sender, htmlText) {
    const welcome = document.getElementById('chatgpt-welcome-center');
    if (welcome) welcome.style.display = 'none';

    const thread = document.getElementById('chat-thread-container');
    if (!thread) return;
    thread.style.display = 'flex';
    const msg = document.createElement('div');
    msg.className = `chat-msg msg-${sender}`;
    msg.innerHTML = sender === 'agent'
      ? `<div class="msg-avatar">⚡</div><div class="msg-content">${htmlText}</div>`
      : `<div class="msg-content">${htmlText}</div>`;
    thread.appendChild(msg);

    const scrollArea = document.getElementById('chat-pane-scroll');
    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }

  async function launchAutonomousResearchFromChat() {
    const chatAgentInput = document.getElementById('chat-agent-input');
    const rawText = chatAgentInput ? chatAgentInput.value.trim() : '';

    // If user typed custom seeds, parse and queue them
    if (rawText) {
      const parsedItems = rawText.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
      parsedItems.forEach(k => addSeedToQueue(k));
      if (chatAgentInput) chatAgentInput.value = '';
    }

    const domain = state.targetDomain || 'removesynth.com';
    const countries = state.selectedMarkets && state.selectedMarkets.length > 0 ? state.selectedMarkets : ['us'];

    // Render User message bubble
    appendChatMessage('user', `🚀 <strong>Launch Research:</strong> Domain: <code>${escapeHtml(domain)}</code> • Markets: [${countries.join(', ').toUpperCase()}] • ${state.attachedExcel ? `Attached Excel: <em>${state.attachedExcel.filename}</em>` : `Queued Seeds (${state.queuedSeeds.length})`}`);

    // Render Agent response bubble
    appendChatMessage('agent', `⚡ <strong>Research Active:</strong> Querying SERP streams. Extracting verified search volume and keyword difficulty metrics...`);

    const btnChatRun = document.getElementById('btn-chat-run');
    if (btnChatRun) {
      btnChatRun.disabled = true;
      btnChatRun.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;margin:0;display:inline-block;vertical-align:middle;"></span> Mining SERP...';
    }

    try {
      const payload = {
        domain,
        countries,
        start: 1
      };

      if (state.attachedExcel) {
        payload.preset = state.attachedExcel.filename;
      } else if (state.queuedSeeds.length > 0) {
        payload.seeds = state.queuedSeeds;
      } else {
        payload.preset = state.selectedPreset || 'fabcastle';
      }

      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start run');

      showToast(`⚡ Research started for ${domain}!`, 'success');
      state.runStartTime = Date.now();
      startTimer();
      // Switch immediately to Live Telemetry
      switchTab('terminal');
    } catch (err) {
      showToast(err.message, 'error');
      appendChatMessage('agent', `❌ <strong>Error launching task:</strong> ${escapeHtml(err.message)}`);
    } finally {
      if (btnChatRun) {
        btnChatRun.disabled = false;
        btnChatRun.innerHTML = '<span class="btn-launch-icon">⚡</span> <span>Start Autonomous Research ↗</span>';
      }
    }
  }

  // Hero Quick Goto Explorer
  if (dom.btnHeroGotoExplorer) {
    dom.btnHeroGotoExplorer.addEventListener('click', () => {
      switchTab('explorer');
    });
  }

  // Launch Form Submission (Immediate autonomous execution fallback)
  dom.launchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    launchAutonomousResearchFromChat();
  });

  // Stop Task
  dom.btnStopTask.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to stop the active keyword research task? Current checkpoints will be preserved.')) return;
    try {
      const res = await fetch('/api/run/stop', { method: 'POST' });
      const data = await res.json();
      showToast(data.message || 'Task stopped', 'info');
      stopTimer();
    } catch (err) {
      showToast(`Stop error: ${err.message}`, 'error');
    }
  });

  // -------------------------------------------------------------
  // TAB 3: Telemetry & SSE Stream
  // -------------------------------------------------------------
  function connectSSE() {
    const sse = new EventSource('/api/run/stream');

    sse.addEventListener('state', (e) => {
      try {
        const run = JSON.parse(e.data);
        updateTelemetryHUD(run);
      } catch (err) {
        console.error('SSE state parse error:', err);
      }
    });

    sse.addEventListener('log', (e) => {
      try {
        const log = JSON.parse(e.data);
        appendTerminalLog(log);
      } catch (err) {
        console.error('SSE log parse error:', err);
      }
    });

    sse.onerror = () => {
      // Reconnects automatically
    };
  }

  function startTimer() {
    stopTimer();
    state.timerInterval = setInterval(() => {
      if (!state.runStartTime) return;
      const elapsedSec = Math.floor((Date.now() - state.runStartTime) / 1000);
      const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const ss = String(elapsedSec % 60).padStart(2, '0');
      dom.hudTimerBadge.textContent = `⏱️ ${mm}:${ss}`;
    }, 1000);
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function updateTelemetryHUD(run) {
    state.runStatus = run.status;
    const isRunning = run.status === 'running';

    if (isRunning && !state.timerInterval && run.startTime) {
      state.runStartTime = run.startTime;
      startTimer();
    } else if (!isRunning) {
      stopTimer();
    }

    // Top status chip
    dom.systemStatusChip.classList.toggle('running', isRunning);
    dom.systemStatusLabel.textContent = isRunning ? `Research Active (#${run.currentSeedIndex})` : 'Engine Ready';
    dom.liveTabBadge.style.display = isRunning ? 'inline-block' : 'none';

    // HUD Badge
    dom.hudStatusBadge.classList.toggle('active', isRunning);
    dom.hudStatusText.textContent = isRunning ? 'Research Active' : (run.status === 'completed' ? 'Completed' : 'Engine Idle');
    dom.btnStopTask.disabled = !isRunning;

    // Target info
    dom.hudTargetName.textContent = run.targetFile || 'None';
    if (run.currentKeyword) {
      dom.hudCurrentSeedText.textContent = `[${run.currentCountry || ''}] "${run.currentKeyword}" (${run.currentTool || ''})`;
    } else {
      dom.hudCurrentSeedText.textContent = isRunning ? 'Initializing...' : 'Waiting for job';
    }

    // Progress Bar
    const total = run.totalSeeds || 1;
    const current = run.currentSeedIndex || 0;
    const percent = Math.min(100, Math.round((current / total) * 100)) || 0;

    dom.hudProgressPercent.textContent = `${percent}%`;
    dom.hudProgressCounter.textContent = `${current.toLocaleString()} / ${total.toLocaleString()} seeds`;
    dom.hudProgressFill.style.width = `${percent}%`;

    // Speed calculation
    if (isRunning && run.startTime && current > 0) {
      const minutes = (Date.now() - run.startTime) / 60000;
      if (minutes > 0.1) {
        const speed = (current / minutes).toFixed(1);
        dom.hudSpeedBadge.textContent = `⚡ ${speed} seeds/min`;
      }
    }

    // Counters
    dom.hudMFound.textContent = (run.keywordsFound || 0).toLocaleString();
    dom.hudMPm.textContent = (run.phraseMatches || 0).toLocaleString();
    dom.hudMQ.textContent = (run.questions || 0).toLocaleString();
    dom.hudMHandoffs.textContent = (run.handoffs || 0).toLocaleString();
    dom.hudMErrors.textContent = (run.errors || 0).toLocaleString();
  }

  function appendTerminalLog(entry) {
    const line = document.createElement('div');
    line.className = `log-line ${entry.level || 'info'}`;
    line.innerHTML = `<span class="log-time">[${entry.time}]</span> ${escapeHtml(entry.text)}`;
    dom.terminalOutput.appendChild(line);

    if (state.autoScroll) {
      dom.terminalOutput.scrollTop = dom.terminalOutput.scrollHeight;
    }
  }

  dom.checkAutoscroll.addEventListener('change', () => {
    state.autoScroll = dom.checkAutoscroll.checked;
  });

  dom.btnClearLogs.addEventListener('click', () => {
    dom.terminalOutput.innerHTML = '';
  });

  dom.btnCopyLogs.addEventListener('click', () => {
    const text = dom.terminalOutput.innerText;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Terminal logs copied to clipboard!', 'success');
    });
  });

  // -------------------------------------------------------------
  // TAB 4: Report Archive Table
  // -------------------------------------------------------------
  async function loadReportsArchive() {
    dom.reportsTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">Scanning output directory...</td></tr>';
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      const reports = data.reports || [];

      if (reports.length === 0) {
        dom.reportsTableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No reports found in output/</td></tr>';
        return;
      }

      dom.reportsTableBody.innerHTML = reports.map(r => {
        const isXlsx = r.ext === 'XLSX';
        const badgeClass = isXlsx ? 'xlsx' : 'csv';
        const dateStr = new Date(r.modifiedAt).toLocaleString();

        return `
          <tr>
            <td>
              <span class="report-file-name">${escapeHtml(r.filename)}</span>
            </td>
            <td>
              <span class="format-badge ${badgeClass}">${r.ext}</span>
            </td>
            <td>${r.sizeFormatted}</td>
            <td style="color:var(--text-sub);">${dateStr}</td>
            <td>
              <div class="actions-duo">
                <button type="button" class="btn-action-sm primary" data-explore="${escapeHtml(r.filename)}">
                  Explore
                </button>
                <a href="/api/reports/${encodeURIComponent(r.filename)}/download" download class="btn-action-sm">
                  Download
                </a>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Explore buttons in archive
      document.querySelectorAll('[data-explore]').forEach(btn => {
        btn.addEventListener('click', () => {
          const file = btn.dataset.explore;
          state.selectedReport = file;
          dom.reportSelect.value = file;
          state.page = 1;
          switchTab('explorer');
          loadReportDetails();
        });
      });
    } catch (err) {
      dom.reportsTableBody.innerHTML = `<tr><td colspan="5" class="empty-cell" style="color:var(--rose);">Failed to load archive: ${err.message}</td></tr>`;
    }
  }

  dom.btnRefreshArchiveTop.addEventListener('click', () => {
    loadReportsArchive();
    showToast('Report archive refreshed', 'info');
  });

  // -------------------------------------------------------------
  // Initialize App
  // -------------------------------------------------------------
  function init() {
    // Wire quick launch buttons
    const btnHeroLaunch = document.getElementById('btn-hero-launch-top');
    if (btnHeroLaunch) {
      btnHeroLaunch.addEventListener('click', () => switchTab('launcher'));
    }
    const btnHeaderQuickLaunch = document.getElementById('btn-header-quick-launch');
    if (btnHeaderQuickLaunch) {
      btnHeaderQuickLaunch.addEventListener('click', () => {
        switchTab('launcher');
        const form = document.getElementById('launch-form');
        if (form) form.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // New Agent Run button in sidebar
    const btnNewRun = document.getElementById('btn-new-run');
    if (btnNewRun) {
      btnNewRun.addEventListener('click', () => {
        switchTab('launcher');
        const welcome = document.getElementById('chatgpt-welcome-center');
        if (welcome) welcome.style.display = 'flex';
        const thread = document.getElementById('chat-thread-container');
        if (thread) thread.innerHTML = '';
        const chatAgentInput = document.getElementById('chat-agent-input');
        if (chatAgentInput) {
          chatAgentInput.value = '';
          chatAgentInput.focus();
        }
        state.queuedSeeds = [];
        renderQueuedSeeds();
        showToast('New Agent Research Session initialized.', 'info');
      });
    }

    // Sidebar Recent History Sessions
    document.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const preset = item.dataset.preset;
        if (preset === 'removesynth') {
          state.targetDomain = 'removesynth.com';
          if (dom.inputDomain) dom.inputDomain.value = 'removesynth.com';
          updateTargetDomain();
          switchTab('launcher');
          showToast('Loaded removesynth.com session', 'info');
        } else if (preset === 'fabcastle') {
          state.selectedPreset = 'fabcastle';
          switchTab('explorer');
          if (state.reports.length > 0) {
            const fabReport = state.reports.find(r => r.filename.toLowerCase().includes('fabcastle'));
            if (fabReport) {
              state.selectedReport = fabReport.filename;
              dom.reportSelect.value = fabReport.filename;
              loadReportDetails();
            }
          }
          showToast('Loaded fabcastle dataset in Explorer', 'info');
        } else if (preset === 'brightdata') {
          state.targetDomain = 'brightdata.com';
          if (dom.inputDomain) dom.inputDomain.value = 'brightdata.com';
          updateTargetDomain();
          switchTab('launcher');
          showToast('Loaded brightdata.com session', 'info');
        }
      });
    });

    // Initialize Antigravity Chatbox with Add Domain, Add Excel, and Select Country options
    setupAntigravityChatbox();

    // Start in Tab 1 (Research Studio)
    switchTab('launcher');
    updateTargetDomain();
    renderQueuedSeeds();
    analyzeCompetitors();

    loadReportsList();
    loadPresets();
    connectSSE();
  }

  init();

})();
