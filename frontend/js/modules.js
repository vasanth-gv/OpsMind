/**
 * OPSMIND — Additional Modules
 * Services / Incidents / Automation / Intelligence / Logs / Settings
 *
 * All of these hit REAL backend endpoints (/api/services, /api/incidents,
 * /api/automation, /api/intelligence, /api/logs, /api/settings). Nothing
 * here is demo data -- if a system is unavailable, that shows up as a
 * genuine "unavailable" state rather than a fake healthy row.
 */

(function () {
    'use strict';

    const API_BASE = 'http://127.0.0.1:8000';

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function timeAgo(iso) {
        if (!iso) return '--';
        const diff = Date.now() - new Date(iso).getTime();
        if (isNaN(diff)) return iso;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }

    function emptyState(icon, title, msg) {
        return `<div class="empty-state"><span>${icon}</span><strong>${title}</strong><p>${msg}</p></div>`;
    }

    function errorState(msg) {
        return `<div class="empty-state"><span>⚠</span><strong>Could not load data</strong><p>${escapeHtml(msg)}</p></div>`;
    }

    // =====================================================
    // SERVICES
    // =====================================================

    let allServices = [];

    async function loadServices() {
        const tbody = document.getElementById('svcTableBody');
        if (!tbody) return;
        try {
            const res = await fetch(`${API_BASE}/api/services`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            allServices = data.services || [];
            renderServices(allServices);
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="8">${errorState(e.message)}</td></tr>`;
        }
    }

    function renderServices(list) {
        const tbody = document.getElementById('svcTableBody');
        if (!tbody) return;
        if (!list.length) {
            tbody.innerHTML = `<tr><td colspan="8">${emptyState('—', 'No services found', 'No monitored services are currently reporting data.')}</td></tr>`;
            return;
        }
        tbody.innerHTML = list.map(s => `
            <tr>
                <td>${escapeHtml(s.service)}</td>
                <td>${escapeHtml(s.type)}</td>
                <td>${escapeHtml(s.environment)}</td>
                <td><span class="table-status-badge ${s.status === 'online' ? 'healthy' : 'critical'}">${escapeHtml(s.status)}</span></td>
                <td><span class="table-status-badge ${s.health}">${escapeHtml(s.health)}</span></td>
                <td>${escapeHtml(s.endpoint || s.version || '—')}</td>
                <td>${timeAgo(s.last_checked)}</td>
                <td class="table-risk">${s.risk ?? '--'}</td>
            </tr>
        `).join('');
    }

    const svcSearch = document.getElementById('svcSearch');
    if (svcSearch) {
        svcSearch.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            renderServices(allServices.filter(s =>
                (s.service || '').toLowerCase().includes(q) ||
                (s.type || '').toLowerCase().includes(q)
            ));
        });
    }

    // =====================================================
    // INCIDENTS
    // =====================================================

    async function loadIncidents() {
        const activeEl = document.getElementById('incActiveList');
        const resolvedEl = document.getElementById('incResolvedList');
        if (!activeEl) return;
        try {
            const res = await fetch(`${API_BASE}/api/incidents`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            activeEl.innerHTML = data.active.length
                ? data.active.map(i => `
                    <div class="incident-item ${i.severity}">
                        <div class="incident-content">
                            <strong>${escapeHtml(i.title)}</strong>
                            <span>${escapeHtml(i.service)} — opened ${timeAgo(i.created_at)}</span>
                        </div>
                        <span class="incident-severity">${escapeHtml(i.severity)}</span>
                    </div>
                `).join('')
                : emptyState('✓', 'All systems operational', 'No active infrastructure incidents detected.');

            resolvedEl.innerHTML = data.resolved.length
                ? data.resolved.slice(0, 10).map(i => `
                    <div class="incident-item info">
                        <div class="incident-content">
                            <strong>${escapeHtml(i.title)}</strong>
                            <span>${escapeHtml(i.service)} — resolved ${timeAgo(i.resolved_at)}</span>
                        </div>
                        <span class="incident-severity">resolved</span>
                    </div>
                `).join('')
                : emptyState('—', 'No resolved incidents yet', 'Resolved incidents will appear here once systems recover.');

        } catch (e) {
            activeEl.innerHTML = errorState(e.message);
        }
    }

    // =====================================================
    // AUTOMATION
    // =====================================================

    async function loadAutomation() {
        const statsGrid = document.getElementById('autoStatsGrid');
        const suggestionsEl = document.getElementById('autoSuggestions');
        if (!statsGrid) return;
        try {
            const res = await fetch(`${API_BASE}/api/automation`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            statsGrid.innerHTML = `
                <div class="hero-stat-card glass-card"><div class="stat-info"><span class="stat-value">${data.total_actions}</span><span class="stat-label">Total Actions</span></div></div>
                <div class="hero-stat-card glass-card"><div class="stat-info"><span class="stat-value">${data.successful_actions}</span><span class="stat-label">Successful</span></div></div>
                <div class="hero-stat-card glass-card"><div class="stat-info"><span class="stat-value">${data.failed_actions}</span><span class="stat-label">Failed</span></div></div>
                <div class="hero-stat-card glass-card"><div class="stat-info"><span class="stat-value">${data.pending_suggestions.length}</span><span class="stat-label">Pending Suggestions</span></div></div>
            `;

            if (!data.engine_connected) {
                suggestionsEl.insertAdjacentHTML('beforebegin',
                    `<p style="opacity:.6;font-size:13px;margin:-8px 0 12px">${escapeHtml(data.note)}</p>`);
            }

            suggestionsEl.innerHTML = data.pending_suggestions.length
                ? data.pending_suggestions.map(s => `
                    <div class="incident-item warning">
                        <div class="incident-content">
                            <strong>${escapeHtml(s.recommended_action)}</strong>
                            <span>${escapeHtml(s.target)} — trigger: ${escapeHtml(s.trigger)}</span>
                        </div>
                        <span class="incident-severity">requires approval</span>
                    </div>
                `).join('')
                : emptyState('✓', 'No suggested actions', 'Nothing currently needs attention.');

        } catch (e) {
            statsGrid.innerHTML = errorState(e.message);
        }
    }

    // =====================================================
    // INTELLIGENCE
    // =====================================================

    async function loadIntelligence() {
        const grid = document.getElementById('intelGrid');
        const anomaliesEl = document.getElementById('intelAnomalies');
        if (!grid) return;
        try {
            const res = await fetch(`${API_BASE}/api/intelligence`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const risk = data.risk;

            grid.innerHTML = `
                <div class="intel-card glass-card">
                    <span class="intel-card-label">Risk Score</span>
                    <div class="stat-value" style="font-size:32px">${risk.risk_score}<span style="font-size:14px;opacity:.6">/100</span></div>
                    <small style="opacity:.6">Trend: ${escapeHtml(risk.trend)}</small>
                </div>
                <div class="intel-card glass-card">
                    <span class="intel-card-label">Anomalies Detected</span>
                    <div class="stat-value" style="font-size:32px">${data.anomalies.anomaly_count}</div>
                    <small style="opacity:.6">Rule-based detection</small>
                </div>
                <div class="intel-card glass-card">
                    <span class="intel-card-label">Method</span>
                    <div style="font-size:13px;margin-top:8px;opacity:.85">${escapeHtml(risk.method)}</div>
                </div>
            `;

            const reasonsHtml = risk.reasons.map(r => `
                <div class="incident-item info"><div class="incident-content"><span>${escapeHtml(r)}</span></div></div>
            `).join('');

            anomaliesEl.innerHTML = data.anomalies.anomalies.length
                ? data.anomalies.anomalies.map(a => `
                    <div class="incident-item ${a.severity}">
                        <div class="incident-content"><strong>${escapeHtml(a.type.replace(/_/g, ' '))}</strong><span>${escapeHtml(a.message)}</span></div>
                        <span class="incident-severity">${escapeHtml(a.severity)}</span>
                    </div>
                `).join('') + reasonsHtml
                : emptyState('✓', 'No anomalies detected', 'All monitored signals look normal.') + reasonsHtml;

        } catch (e) {
            grid.innerHTML = errorState(e.message);
        }
    }

    // =====================================================
    // LOGS
    // =====================================================

    let logsPaused = false;
    let logsLevelFilter = 'all';

    async function loadLogs() {
        if (logsPaused) return;
        const box = document.getElementById('logsStreamBox');
        if (!box) return;
        try {
            const res = await fetch(`${API_BASE}/api/logs?limit=200&level=${logsLevelFilter}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            box.innerHTML = data.logs.length
                ? data.logs.map(l => `
                    <div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05)">
                        <span style="opacity:.5">${new Date(l.timestamp).toLocaleTimeString()}</span>
                        <span style="font-weight:600;margin:0 8px;color:${
                            l.level === 'ERROR' || l.level === 'CRITICAL' ? '#ff5c5c' :
                            l.level === 'WARNING' ? '#ffc23c' : '#4fd1c5'
                        }">[${l.level}]</span>
                        <span style="opacity:.7">${escapeHtml(l.service)}:</span>
                        ${escapeHtml(l.message)}
                    </div>
                `).join('')
                : emptyState('—', 'No log entries yet', 'Logs will appear here as the backend performs monitoring checks.');

        } catch (e) {
            box.innerHTML = errorState(e.message);
        }
    }

    const logsLevelSelect = document.getElementById('logsLevelFilter');
    if (logsLevelSelect) {
        logsLevelSelect.addEventListener('change', (e) => {
            logsLevelFilter = e.target.value;
            loadLogs();
        });
    }

    const logsPauseBtn = document.getElementById('logsPauseBtn');
    if (logsPauseBtn) {
        logsPauseBtn.addEventListener('click', () => {
            logsPaused = !logsPaused;
            logsPauseBtn.innerHTML = logsPaused ? '<span>▶</span> Resume' : '<span>⏸</span> Pause';
        });
    }

    const logsClearBtn = document.getElementById('logsClearBtn');
    if (logsClearBtn) {
        logsClearBtn.addEventListener('click', () => {
            const box = document.getElementById('logsStreamBox');
            if (box) box.innerHTML = emptyState('—', 'Cleared', 'View cleared locally (backend history untouched).');
        });
    }

    // =====================================================
    // SETTINGS
    // =====================================================

    async function loadSettings() {
        const grid = document.getElementById('settingsGrid');
        if (!grid) return;
        try {
            const res = await fetch(`${API_BASE}/api/settings`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            const conn = (label, info) => `
                <div class="intel-card glass-card">
                    <span class="intel-card-label">${label}</span>
                    <div style="margin-top:8px">
                        <span class="table-status-badge ${info.status === 'CONNECTED' ? 'healthy' : 'critical'}">${info.status}</span>
                    </div>
                    <small style="opacity:.6;display:block;margin-top:6px">${escapeHtml(info.region || info.url || '')}</small>
                </div>
            `;

            grid.innerHTML = `
                <div class="intel-card glass-card">
                    <span class="intel-card-label">Backend URL</span>
                    <div style="margin-top:8px;font-family:monospace">${escapeHtml(data.backend.url)}</div>
                    <small style="opacity:.6;display:block;margin-top:6px">Overview refresh: ${data.backend.overview_refresh_interval_seconds}s</small>
                </div>
                ${conn('AWS', data.integrations.aws)}
                ${conn('Jenkins', data.integrations.jenkins)}
                ${conn('Docker', data.integrations.docker)}
                ${conn('Kubernetes', data.integrations.kubernetes)}
            `;

        } catch (e) {
            grid.innerHTML = errorState(e.message);
        }
    }

    // =====================================================
    // INFRASTRUCTURE PAGE
    // =====================================================

    let infraMapPageInstance = null;

    function initInfraMap() {
        if (infraMapPageInstance) return; // don't re-create on every poll
        if (typeof Animations !== 'undefined' && Animations.InfrastructureMap &&
            document.getElementById('infraCanvasPage')) {
            infraMapPageInstance = new Animations.InfrastructureMap('infraCanvasPage', 'infraNodesPage');
        }
    }

    async function loadInfraTable() {
        const tbody = document.getElementById('infraTableBody');
        if (!tbody) return;
        try {
            const res = await fetch(`${API_BASE}/api/services`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const nodes = (data.services || []).filter(s => s.type !== 'Jenkins Job' && s.type !== 'CI/CD');

            tbody.innerHTML = nodes.length
                ? nodes.map(n => `
                    <tr>
                        <td>${escapeHtml(n.service)}</td>
                        <td>${escapeHtml(n.type)}</td>
                        <td><span class="table-status-badge ${n.status === 'online' ? 'healthy' : 'critical'}">${escapeHtml(n.status)}</span></td>
                        <td><span class="table-status-badge ${n.health}">${escapeHtml(n.health)}</span></td>
                        <td>${escapeHtml(n.endpoint || n.version || '—')}</td>
                        <td>${timeAgo(n.last_checked)}</td>
                    </tr>
                `).join('')
                : `<tr><td colspan="6">${emptyState('—', 'No infrastructure data', 'AWS, Docker and Kubernetes are all unavailable right now.')}</td></tr>`;

        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="6">${errorState(e.message)}</td></tr>`;
        }
    }

    // =====================================================
    // INIT + INTERVALS (no duplicate intervals)
    // =====================================================

    function init() {
        loadServices();
        loadIncidents();
        loadAutomation();
        loadIntelligence();
        loadLogs();
        loadSettings();

        setTimeout(initInfraMap, 300); // wait for MockData/Animations to be ready
        loadInfraTable();

        setInterval(loadServices, 20000);
        setInterval(loadIncidents, 15000);
        setInterval(loadAutomation, 20000);
        setInterval(loadIntelligence, 20000);
        setInterval(loadLogs, 10000);
        setInterval(loadInfraTable, 20000);
        // settings rarely changes; no auto-poll needed
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
