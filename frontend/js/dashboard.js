/**
 * OPSMIND — Dashboard Module
 *
 * Premium DevOps dashboard
 * AWS monitoring is connected to the real FastAPI backend.
 *
 * Backend:
 * http://127.0.0.1:8000/api/aws
 */

const Dashboard = (() => {

    let charts = {};
    let sparklines = {};
    let infraMap = null;
    let logInterval = null;
    let metricsInterval = null;
    let awsInterval = null;

    let logPaused = false;
    let currentLogFilter = 'all';

    let tableSortState = {
        column: null,
        direction: 'asc'
    };

    let overviewInterval = null;

    // =========================================================
    // INITIALIZE
    // =========================================================

    function init() {

    // ============================================
    // LIVE OPSMIND OVERVIEW
    // ============================================

    loadOverviewData();

    // Refresh complete overview every 15 seconds
    overviewInterval = setInterval(
        loadOverviewData,
        15000
    );


    // ============================================
    // EXISTING DASHBOARD COMPONENTS
    // ============================================

    renderCharts();
    renderIncidents();
    renderAutomation();
    renderIntelligence();
    renderServiceTable();
    renderStatusBar();
    renderNotifications();

    startLogStream();
    startMetricsUpdates();


    // ============================================
    // 3D INFRASTRUCTURE MAP
    // ============================================

    setTimeout(() => {

        if (
            typeof Animations !== 'undefined' &&
            Animations.InfrastructureMap
        ) {

            infraMap =
                new Animations.InfrastructureMap(
                    'infraCanvas',
                    'infraNodes'
                );
        }

    }, 100);


    // ============================================
    // TABLE SEARCH
    // ============================================

    const searchInput =
        document.getElementById('serviceSearch');

    if (searchInput) {

        searchInput.addEventListener(
            'input',
            (e) => {
                filterServiceTable(e.target.value);
            }
        );
    }


    // ============================================
    // TABLE SORTING
    // ============================================

    const ths =
        document.querySelectorAll(
            '.service-table th[data-sort]'
        );

    ths.forEach(th => {

        th.addEventListener('click', () => {
            sortServiceTable(th.dataset.sort);
        });

        th.addEventListener('keydown', (e) => {

            if (
                e.key === 'Enter' ||
                e.key === ' '
            ) {

                e.preventDefault();

                sortServiceTable(
                    th.dataset.sort
                );
            }

        });

    });


    // ============================================
    // LOG PAUSE
    // ============================================

    const pauseBtn =
        document.getElementById('logPauseBtn');

    if (pauseBtn) {

        pauseBtn.addEventListener('click', () => {

            logPaused = !logPaused;

            pauseBtn.textContent =
                logPaused
                    ? 'Resume'
                    : 'Pause';

        });

    }


    // ============================================
    // LOG FILTER
    // ============================================

    const logFilter =
        document.getElementById('logLevelFilter');

    if (logFilter) {

        logFilter.addEventListener(
            'change',
            (e) => {

                currentLogFilter =
                    e.target.value;

            }
        );
    }


    // ============================================
    // VIEW ALL INCIDENTS
    // ============================================

    const viewAll =
        document.getElementById(
            'viewAllIncidents'
        );

    if (viewAll) {

        viewAll.addEventListener('click', () => {

            const page =
                document.querySelector(
                    '[data-page="incidents"]'
                );

            if (page) {
                page.click();
            }

        });

    }

}

// =========================================================
// HEALTH CARDS (rendered from /api/overview)
// =========================================================

function renderHealthCards(data) {

    const grid =
        document.getElementById('healthCardsGrid');

    if (!grid) return;

    const systems =
        (data && data.systems) || {};

    // -----------------------------------------------------
    // Card definitions: AWS, Kubernetes, Docker, Jenkins
    // -----------------------------------------------------

    const cardConfigs = [

        {
            index: 0,
            title: 'AWS',
            system: systems.aws,
            health: (s) =>
                !s ? 'unknown'
                    : s.status !== 'success' ? 'critical'
                    : (s.overall_health || 'healthy'),
            metrics: (s) => ([
                { id: 'instances', label: 'Instances', value: s ? (s.instance_count ?? '--') : '--' },
                { id: 'cpu', label: 'Region', value: s ? (s.region || '--') : '--' },
                { id: 'memory', label: 'Health', value: s ? (s.overall_health || '--') : '--' },
                { id: 'network', label: 'Status', value: s ? (s.status === 'success' ? 'Online' : 'Offline') : '--' }
            ])
        },

        {
            index: 1,
            title: 'Kubernetes',
            system: systems.kubernetes,
            health: (s) =>
                !s ? 'unknown' : (s.status === 'success' ? 'healthy' : 'critical'),
            metrics: (s) => ([
                { id: 'nodes', label: 'Nodes', value: s ? (s.node_count ?? '--') : '--' },
                { id: 'pods', label: 'Pods', value: s ? (s.pod_count ?? '--') : '--' },
                { id: 'running', label: 'Running', value: s ? (s.running_pods ?? '--') : '--' },
                { id: 'status', label: 'Status', value: s ? (s.kubernetes || '--') : '--' }
            ])
        },

        {
            index: 2,
            title: 'Docker',
            system: systems.docker,
            health: (s) =>
                !s ? 'unknown' : (s.status === 'success' ? 'healthy' : 'critical'),
            metrics: (s) => ([
                { id: 'containers', label: 'Containers', value: s ? (s.container_count ?? '--') : '--' },
                { id: 'running', label: 'Running', value: s ? (s.running_containers ?? '--') : '--' },
                { id: 'stopped', label: 'Stopped', value: s ? (s.stopped_containers ?? '--') : '--' },
                { id: 'images', label: 'Images', value: s ? (s.image_count ?? '--') : '--' }
            ])
        },

        {
            index: 3,
            title: 'Jenkins',
            system: systems.jenkins,
            health: (s) =>
                !s ? 'unknown' : (s.status === 'success' ? 'healthy' : 'critical'),
            metrics: (s) => ([
                { id: 'jobs', label: 'Jobs', value: s ? (s.job_count ?? '--') : '--' },
                { id: 'running', label: 'Running', value: s ? (s.running_jobs ?? '--') : '--' },
                { id: 'success', label: 'Success', value: s ? (s.successful_jobs ?? '--') : '--' },
                { id: 'failed', label: 'Failed', value: s ? (s.failed_jobs ?? '--') : '--' }
            ])
        }

    ];

    // -----------------------------------------------------
    // Build skeleton once, then just update values on
    // every subsequent refresh (keeps tilt/hover bindings
    // and sparkline canvases intact instead of destroying
    // the DOM every 15 seconds).
    // -----------------------------------------------------

    const alreadyBuilt =
        grid.children.length === cardConfigs.length;

    if (!alreadyBuilt) {

        grid.innerHTML = cardConfigs.map(cfg => `
            <div class="health-card" data-card-index="${cfg.index}">
                <div class="health-card-header">
                    <span class="health-card-title">${cfg.title}</span>
                    <span class="health-status-badge" id="health-status-${cfg.index}">--</span>
                </div>
                <div class="health-metrics">
                    ${cfg.metrics(null).map(m => `
                        <div class="health-metric">
                            <span class="metric-label">${m.label}</span>
                            <span class="metric-value" id="health-metric-${cfg.index}-${m.id}">--</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        if (typeof Animations !== 'undefined' && Animations.initTiltCards) {
            Animations.initTiltCards();
        }
    }

    // -----------------------------------------------------
    // Populate values
    // -----------------------------------------------------

    cardConfigs.forEach(cfg => {

        const health = cfg.health(cfg.system);

        const badge =
            document.getElementById(`health-status-${cfg.index}`);

        if (badge) {
            badge.textContent = String(health).replace('-', ' ').toUpperCase();
            badge.className = `health-status-badge ${health}`;
        }

        cfg.metrics(cfg.system).forEach(m => {
            const el =
                document.getElementById(`health-metric-${cfg.index}-${m.id}`);
            if (el) el.textContent = m.value;
        });

    });

}


async function loadOverviewData() {

    try {

        const response = await fetch(
            'http://127.0.0.1:8000/api/overview',
            {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                `Overview API returned ${response.status}`
            );
        }

        const data = await response.json();

        console.log(
            '[OpsMind] Live Overview:',
            data
        );


        // -----------------------------
        // Health Cards
        // -----------------------------

        renderHealthCards(data);


        // -----------------------------
        // Hero Statistics
        // -----------------------------

        updateOverviewHero(data);


        // -----------------------------
        // Backend online indicator
        // -----------------------------

        updateOverviewConnection(true);


        // -----------------------------
        // Live incidents
        // -----------------------------

        updateOverviewIncidents(data);


        // -----------------------------
        // Service table
        // -----------------------------

        updateOverviewServices(data);


        return data;

    } catch (error) {

        console.error(
            '[OpsMind] Overview monitoring failed:',
            error
        );

        updateOverviewConnection(false);

    }

}


// =========================================================
// OVERVIEW HERO
// =========================================================

function updateOverviewHero(data) {

    const platform =
        data?.platform || {};

    const health =
        platform.health_score ?? 0;

    const incidents =
        calculateOverviewIncidents(data);

    const services =
        platform.total_systems ?? 0;

    const automation =
        calculateAutomationCount(data);

    const risk =
        Math.max(0, 100 - health);


    const healthElement =
        document.querySelector(
            '[data-stat="health"] .stat-value'
        );

    const incidentElement =
        document.querySelector(
            '[data-stat="incidents"] .stat-value'
        );

    const servicesElement =
        document.querySelector(
            '[data-stat="services"] .stat-value'
        );

    const automationElement =
        document.querySelector(
            '[data-stat="automation"] .stat-value'
        );

    const riskElement =
        document.querySelector(
            '[data-stat="risk"] .stat-value'
        );


    if (healthElement) {
        healthElement.textContent =
            `${health}%`;
    }

    if (incidentElement) {
        incidentElement.textContent =
            incidents;
    }

    if (servicesElement) {
        servicesElement.textContent =
            services;
    }

    if (automationElement) {
        automationElement.textContent =
            automation;
    }

    if (riskElement) {
        riskElement.textContent =
            `${risk}/100`;
    }

}

function calculateOverviewIncidents(data) {

    const systems =
        data?.systems || {};

    let incidents = 0;


    Object.values(systems).forEach(system => {

        if (system.status === 'error') {
            incidents++;
        }

        if (
            system.failed_jobs &&
            system.failed_jobs > 0
        ) {
            incidents++;
        }

    });


    return incidents;

}


function calculateAutomationCount(data) {

    const jenkins =
        data?.systems?.jenkins || {};

    return (
        (jenkins.successful_jobs || 0) +
        (jenkins.running_jobs || 0)
    );

}

function updateOverviewConnection(isOnline) {

    const healthGrid =
        document.getElementById('healthCardsGrid');

    const topology =
        document.getElementById('infraMap');


    if (isOnline) {

        if (healthGrid) {
            healthGrid.classList.remove(
                'backend-offline'
            );
        }

        if (topology) {
            topology.classList.remove(
                'backend-offline'
            );
        }

        return;
    }


    if (healthGrid) {
        healthGrid.classList.add(
            'backend-offline'
        );
    }

    if (topology) {
        topology.classList.add(
            'backend-offline'
        );
    }

}


function updateOverviewIncidents(data) {

    const list =
        document.getElementById('incidentList');

    if (!list) return;


    const systems =
        data?.systems || {};

    const incidents = [];


    Object.entries(systems).forEach(
        ([name, system]) => {

            if (system.status === 'error') {

                incidents.push({

                    title:
                        `${name.toUpperCase()} Offline`,

                    message:
                        system.message ||
                        `${name} monitoring service is unavailable.`,

                    severity: 'critical'

                });

            }


            if (
                name === 'jenkins' &&
                system.failed_jobs > 0
            ) {

                incidents.push({

                    title:
                        'Jenkins Build Failures',

                    message:
                        `${system.failed_jobs} Jenkins jobs are currently failing.`,

                    severity: 'warning'

                });

            }

        }
    );


    if (!incidents.length) {

        list.innerHTML = `
            <div class="empty-state">
                <span>✓</span>
                <strong>All systems operational</strong>
                <p>No active infrastructure incidents detected.</p>
            </div>
        `;

        return;
    }


    list.innerHTML =
        incidents.map(incident => `

            <div class="incident-item ${incident.severity}">

                <div class="incident-content">

                    <strong>
                        ${incident.title}
                    </strong>

                    <span>
                        ${incident.message}
                    </span>

                </div>

                <span class="incident-severity">
                    ${incident.severity}
                </span>

            </div>

        `).join('');

}

function updateOverviewServices(data) {

    const tbody =
        document.getElementById(
            'serviceTableBody'
        );

    if (!tbody) return;


    const systems =
        data?.systems || {};


    const rows =
        Object.entries(systems).map(
            ([name, system]) => {

                const online =
                    system.status === 'success';

                const status =
                    online
                        ? 'Online'
                        : 'Offline';

                let details = '--';


                if (name === 'aws') {

                    details =
                        `${system.instance_count ?? 0} instances`;

                }

                else if (name === 'jenkins') {

                    details =
                        `${system.job_count ?? 0} jobs`;

                }

                else if (name === 'docker') {

                    details =
                        `${system.running_containers ?? 0} running`;

                }

                else if (name === 'kubernetes') {

                    details =
                        `${system.running_pods ?? 0} pods`;

                }


                return `

                    <tr>

                        <td>
                            ${name.toUpperCase()}
                        </td>

                        <td>
                            Production
                        </td>

                        <td>
                            <span class="status-badge ${online ? 'healthy' : 'critical'}">
                                ${status}
                            </span>
                        </td>

                        <td>
                            ${details}
                        </td>

                        <td>
                            Live
                        </td>

                        <td>
                            --
                        </td>

                        <td>
                            ${system.checked_at ?? '--'}
                        </td>

                        <td>
                            <span class="risk-badge ${online ? 'low' : 'high'}">
                                ${online ? 'Low' : 'High'}
                            </span>
                        </td>

                    </tr>

                `;

            }
        );


    tbody.innerHTML = rows.join('');

}


    // =========================================================
    // REAL AWS MONITORING
    // =========================================================

    async function loadAWSData() {

        try {

            const response =
                await fetch(
                    'http://127.0.0.1:8000/api/aws',
                    {
                        method: 'GET',
                        cache: 'no-store'
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `AWS API returned ${response.status}`
                );

            }


            const data =
                await response.json();


            console.log(
                'OPSMIND AWS:',
                data
            );


            updateAWSCard(data);


        } catch (error) {

            console.error(
                'OPSMIND AWS connection failed:',
                error
            );


            updateAWSCard({
                status: 'error',
                overall_health: 'offline',
                instance_count: 0,
                instances: []
            });

        }

    }


    function updateAWSCard(data) {

        const card =
            document.querySelector(
                '.health-card[data-card-index="0"]'
            );


        if (!card) return;


        const statusElement =
            document.getElementById(
                'health-status-0'
            );


        const cpuElement =
            document.getElementById(
                'health-metric-0-cpu'
            );


        const memoryElement =
            document.getElementById(
                'health-metric-0-memory'
            );


        const networkElement =
            document.getElementById(
                'health-metric-0-network'
            );


        const instancesElement =
            document.getElementById(
                'health-metric-0-instances'
            );


        // -----------------------------------------------------
        // Status
        // -----------------------------------------------------

        let health =
            data.overall_health || 'unknown';


        let displayHealth =
            health.replace('-', ' ').toUpperCase();


        if (statusElement) {

            statusElement.textContent =
                displayHealth;

            statusElement.className =
                `health-status-badge ${health}`;

        }


        // -----------------------------------------------------
        // Instance count
        // -----------------------------------------------------

        const instanceCount =
            Number(data.instance_count || 0);


        if (instancesElement) {

            instancesElement.textContent =
                instanceCount;

        }


        // -----------------------------------------------------
        // CPU
        // -----------------------------------------------------

        let cpu = null;


        if (
            Array.isArray(data.instances) &&
            data.instances.length > 0
        ) {

            const cpuValues =
                data.instances
                    .map(instance =>
                        instance.cpu_utilization
                    )
                    .filter(
                        value =>
                            typeof value === 'number'
                    );


            if (cpuValues.length > 0) {

                cpu =
                    cpuValues.reduce(
                        (sum, value) =>
                            sum + value,
                        0
                    ) / cpuValues.length;

            }

        }


        if (cpuElement) {

            cpuElement.textContent =
                cpu === null
                    ? '--'
                    : `${Math.round(cpu * 10) / 10}%`;

        }


        // -----------------------------------------------------
        // Memory
        // -----------------------------------------------------

        if (memoryElement) {

            memoryElement.textContent =
                '--';

        }


        // -----------------------------------------------------
        // Network
        // -----------------------------------------------------

        if (networkElement) {

            networkElement.textContent =
                '--';

        }


        // -----------------------------------------------------
        // AWS connected visual state
        // -----------------------------------------------------

        card.dataset.awsHealth =
            health;


        card.dataset.awsRegion =
            data.region || 'unknown';


        // -----------------------------------------------------
        // Console information
        // -----------------------------------------------------

        console.log(
            `AWS Region: ${data.region}`
        );

        console.log(
            `EC2 Instances: ${instanceCount}`
        );

        console.log(
            `Overall Health: ${health}`
        );

    }


    // =========================================================
    // CHARTS
    // =========================================================

    function renderCharts() {

        const grid =
            document.getElementById('chartsGrid');

        if (!grid) return;


        const metrics =
            MockData.getMetricsTimeSeries();


        const chartConfigs = [

            {
                id: 'cpu',
                title: 'CPU Utilization',
                data: metrics.cpu,
                color: '#00d4ff',
                fillColor:
                    'rgba(0, 212, 255, 0.08)',
                suffix: '%'
            },

            {
                id: 'memory',
                title: 'Memory Utilization',
                data: metrics.memory,
                color: '#7b2ff7',
                fillColor:
                    'rgba(123, 47, 247, 0.08)',
                suffix: '%'
            },

            {
                id: 'network',
                title: 'Network Traffic',
                data: metrics.network,
                color: '#4a7dff',
                fillColor:
                    'rgba(74, 125, 255, 0.08)',
                suffix: ' MB/s'
            },

            {
                id: 'latency',
                title: 'Request Latency',
                data: metrics.latency,
                color: '#ffab00',
                fillColor:
                    'rgba(255, 171, 0, 0.08)',
                suffix: 'ms'
            },

            {
                id: 'deployments',
                title: 'Deployment Frequency',
                data: metrics.deployments,
                color: '#00e676',
                fillColor:
                    'rgba(0, 230, 118, 0.08)',
                suffix: '/hr'
            },

            {
                id: 'errorRate',
                title: 'Error Rate',
                data: metrics.errorRate,
                color: '#ff3d5a',
                fillColor:
                    'rgba(255, 61, 90, 0.08)',
                suffix: '%'
            }

        ];


        grid.innerHTML =
            chartConfigs.map(c => {

                const lastVal =
                    c.data[c.data.length - 1].value;


                return `

                    <div class="chart-card">

                        <div class="chart-header">

                            <span class="chart-title">
                                ${c.title}
                            </span>

                            <span
                                class="chart-value"
                                id="chart-val-${c.id}"
                            >
                                ${lastVal}${c.suffix}
                            </span>

                        </div>


                        <div class="chart-canvas-wrapper">

                            <canvas
                                id="chart-${c.id}"
                            ></canvas>

                        </div>

                    </div>

                `;

            }).join('');


        setTimeout(() => {

            chartConfigs.forEach(c => {

                const canvas =
                    document.getElementById(
                        `chart-${c.id}`
                    );


                if (
                    canvas &&
                    typeof Animations !== 'undefined' &&
                    Animations.LineChart
                ) {

                    charts[c.id] = {

                        chart:
                            new Animations.LineChart(
                                canvas,
                                {
                                    data: c.data,
                                    color: c.color,
                                    fillColor:
                                        c.fillColor,
                                    maxValue:
                                        c.id === 'errorRate'
                                            ? 15
                                            : (
                                                c.suffix === '%'
                                                    ? 100
                                                    : null
                                            )
                                }
                            ),

                        config: c

                    };

                }

            });

        }, 50);

    }


    // =========================================================
    // INCIDENTS
    // =========================================================

    function renderIncidents() {

        const list =
            document.getElementById('incidentList');

        if (!list) return;


        const incidents =
            MockData.getIncidents();


        list.innerHTML =
            incidents.map(inc => {

                const timeAgo =
                    getTimeAgo(inc.timestamp);


                return `

                    <div
                        class="incident-item"
                        data-incident-id="${inc.id}"
                        tabindex="0"
                        role="button"
                        aria-label="${inc.severity} incident: ${inc.title}"
                    >

                        <div
                            class="incident-severity ${inc.severity}"
                        ></div>


                        <div class="incident-content">

                            <span
                                class="incident-badge ${inc.severity}"
                            >
                                ${inc.severity}
                            </span>

                            <div class="incident-title">
                                ${inc.service}
                            </div>

                            <div class="incident-desc">
                                ${inc.title}
                            </div>

                            <div class="incident-time">
                                ${timeAgo}
                            </div>

                        </div>

                    </div>

                `;

            }).join('');


        list
            .querySelectorAll('.incident-item')
            .forEach(item => {

                const handler = () => {

                    const id =
                        item.dataset.incidentId;


                    const incident =
                        incidents.find(
                            i => i.id === id
                        );


                    if (incident) {
                        showIncidentModal(incident);
                    }

                };


                item.addEventListener(
                    'click',
                    handler
                );


                item.addEventListener(
                    'keydown',
                    (e) => {

                        if (e.key === 'Enter') {
                            handler();
                        }

                    }
                );

            });

    }


    function showIncidentModal(incident) {

        const body =
            document.getElementById(
                'modalBody'
            );

        const footer =
            document.getElementById(
                'modalFooter'
            );

        const title =
            document.getElementById(
                'modalTitle'
            );


        if (!body || !footer || !title) return;


        title.textContent =
            `Incident: ${incident.service}`;


        body.innerHTML = `

            <div
                style="
                    display:flex;
                    flex-direction:column;
                    gap:16px;
                "
            >

                <div
                    style="
                        display:flex;
                        align-items:center;
                        gap:8px;
                    "
                >

                    <span
                        class="incident-badge ${incident.severity}"
                        style="font-size:0.75rem;"
                    >
                        ${incident.severity}
                    </span>

                    <span
                        style="
                            color:var(--text-muted);
                            font-size:0.85rem;
                        "
                    >
                        ${incident.status}
                    </span>

                </div>


                <div>

                    <div
                        style="
                            font-size:0.75rem;
                            color:var(--text-muted);
                            margin-bottom:4px;
                        "
                    >
                        DESCRIPTION
                    </div>

                    <div
                        style="color:var(--white-dim);"
                    >
                        ${incident.description}
                    </div>

                </div>


                <div>

                    <div
                        style="
                            font-size:0.75rem;
                            color:var(--text-muted);
                            margin-bottom:4px;
                        "
                    >
                        RECOMMENDED ACTION
                    </div>

                    <div
                        style="color:var(--cyan);"
                    >
                        ${incident.recommendedAction}
                    </div>

                </div>


                <div>

                    <div
                        style="
                            font-size:0.75rem;
                            color:var(--text-muted);
                            margin-bottom:4px;
                        "
                    >
                        TIMESTAMP
                    </div>

                    <div
                        style="
                            color:var(--white-dim);
                            font-family:var(--font-mono);
                        "
                    >
                        ${new Date(
                            incident.timestamp
                        ).toLocaleString()}
                    </div>

                </div>

            </div>

        `;


        footer.innerHTML = `

            <button
                class="modal-btn secondary"
                id="modalDismiss"
            >
                Dismiss
            </button>

            <button
                class="modal-btn primary"
                id="modalRemediate"
            >
                Auto-Remediate
            </button>

        `;


        openModal();


        document
            .getElementById('modalDismiss')
            ?.addEventListener(
                'click',
                closeModal
            );


        document
            .getElementById('modalRemediate')
            ?.addEventListener(
                'click',
                () => {

                    closeModal();

                    showToast(
                        'success',
                        `Auto-remediation triggered for ${incident.service}`
                    );

                }
            );

    }


    // =========================================================
    // NODE MODAL
    // =========================================================

    function showNodeModal(node) {

        const body =
            document.getElementById(
                'modalBody'
            );

        const footer =
            document.getElementById(
                'modalFooter'
            );

        const title =
            document.getElementById(
                'modalTitle'
            );


        if (!body || !footer || !title) return;


        title.textContent =
            `${node.icon} ${node.name} Details`;


        const statusColor =
            node.status === 'healthy'
                ? 'var(--green)'
                : node.status === 'warning'
                    ? 'var(--amber)'
                    : 'var(--red)';


        body.innerHTML = `

            <div
                style="
                    display:flex;
                    flex-direction:column;
                    gap:16px;
                "
            >

                <div
                    style="
                        display:flex;
                        align-items:center;
                        gap:8px;
                    "
                >

                    <span
                        class="status-dot ${node.status}"
                        style="
                            width:10px;
                            height:10px;
                            background:${statusColor};
                            box-shadow:
                                0 0 8px ${statusColor};
                        "
                    ></span>

                    <span
                        style="
                            color:${statusColor};
                            font-weight:600;
                            text-transform:uppercase;
                        "
                    >
                        ${node.status}
                    </span>

                </div>


                <div
                    style="
                        display:grid;
                        grid-template-columns:1fr 1fr;
                        gap:16px;
                    "
                >

                    <div>

                        <div
                            style="
                                font-size:0.7rem;
                                color:var(--text-muted);
                                margin-bottom:4px;
                            "
                        >
                            CPU USAGE
                        </div>

                        <div
                            style="
                                font-size:1.4rem;
                                font-weight:700;
                                font-family:var(--font-mono);
                                color:var(--white);
                            "
                        >
                            ${node.cpu}%
                        </div>

                        <div
                            style="
                                width:100%;
                                height:4px;
                                background:rgba(255,255,255,0.05);
                                border-radius:2px;
                                margin-top:6px;
                            "
                        >

                            <div
                                style="
                                    width:${node.cpu}%;
                                    height:100%;
                                    background:${
                                        node.cpu > 80
                                            ? 'var(--red)'
                                            : node.cpu > 60
                                                ? 'var(--amber)'
                                                : 'var(--green)'
                                    };
                                    border-radius:2px;
                                "
                            ></div>

                        </div>

                    </div>


                    <div>

                        <div
                            style="
                                font-size:0.7rem;
                                color:var(--text-muted);
                                margin-bottom:4px;
                            "
                        >
                            MEMORY USAGE
                        </div>

                        <div
                            style="
                                font-size:1.4rem;
                                font-weight:700;
                                font-family:var(--font-mono);
                                color:var(--white);
                            "
                        >
                            ${node.memory}%
                        </div>

                        <div
                            style="
                                width:100%;
                                height:4px;
                                background:rgba(255,255,255,0.05);
                                border-radius:2px;
                                margin-top:6px;
                            "
                        >

                            <div
                                style="
                                    width:${node.memory}%;
                                    height:100%;
                                    background:${
                                        node.memory > 80
                                            ? 'var(--red)'
                                            : node.memory > 60
                                                ? 'var(--amber)'
                                                : 'var(--green)'
                                    };
                                    border-radius:2px;
                                "
                            ></div>

                        </div>

                    </div>

                </div>


                <div>

                    <div
                        style="
                            font-size:0.7rem;
                            color:var(--text-muted);
                            margin-bottom:4px;
                        "
                    >
                        LATENCY
                    </div>

                    <div
                        style="
                            font-size:1.2rem;
                            font-weight:700;
                            font-family:var(--font-mono);
                            color:${
                                node.latency > 100
                                    ? 'var(--red)'
                                    : node.latency > 30
                                        ? 'var(--amber)'
                                        : 'var(--green)'
                            };
                        "
                    >
                        ${node.latency}ms
                    </div>

                </div>

            </div>

        `;


        footer.innerHTML = `

            <button
                class="modal-btn secondary"
                id="modalCloseNode"
            >
                Close
            </button>

        `;


        openModal();


        document
            .getElementById('modalCloseNode')
            ?.addEventListener(
                'click',
                closeModal
            );

    }


    // =========================================================
    // AUTOMATION
    // =========================================================

    function renderAutomation() {

        const panel =
            document.getElementById(
                'automationPanel'
            );

        if (!panel) return;


        const auto =
            MockData.getAutomationStatus();


        panel.innerHTML = `

            <div class="auto-success-rate">

                <span class="auto-rate-value">
                    ${auto.successRate}%
                </span>

                <div>

                    <div
                        style="
                            font-size:0.9rem;
                            font-weight:600;
                            color:var(--white);
                        "
                    >
                        Automation Success Rate
                    </div>

                    <div class="auto-rate-label">
                        ${auto.totalActions}
                        total actions executed
                    </div>

                </div>

            </div>


            <div class="auto-actions-title">
                Recent Automated Actions
            </div>


            ${auto.recentActions.map(a => `

                <div class="auto-action-item">

                    <span class="auto-action-check">
                        ✓
                    </span>

                    <span>
                        ${a.action}
                    </span>

                    <span
                        style="
                            margin-left:auto;
                            font-size:0.72rem;
                            color:var(--text-muted);
                            font-family:var(--font-mono);
                        "
                    >
                        ${a.time}
                    </span>

                </div>

            `).join('')}


            <div
                class="auto-pipeline"
                id="autoPipeline"
            >

                ${auto.pipelineSteps.map((step, i) => `

                    ${
                        i > 0
                            ? '<span class="pipeline-arrow">→</span>'
                            : ''
                    }

                    <div class="pipeline-step">

                        <div
                            class="
                                pipeline-dot
                                ${i < 5 ? 'completed' : 'active'}
                            "
                            id="pipeline-${i}"
                        >
                            ${i < 5 ? '✓' : '⟳'}
                        </div>

                        <span class="pipeline-label">
                            ${step}
                        </span>

                    </div>

                `).join('')}

            </div>

        `;


        animatePipeline();

    }


    function animatePipeline() {

        const steps =
            document.querySelectorAll(
                '.pipeline-dot'
            );

        let current = 0;


        setInterval(() => {

            steps.forEach((step, i) => {

                if (i < current) {

                    step.className =
                        'pipeline-dot completed';

                    step.textContent = '✓';

                }

                else if (i === current) {

                    step.className =
                        'pipeline-dot active';

                    step.textContent = '⟳';

                }

                else {

                    step.className =
                        'pipeline-dot';

                    step.textContent =
                        i + 1;

                }

            });


            current =
                (current + 1) %
                (steps.length + 1);


            if (current > steps.length - 1) {

                setTimeout(() => {
                    current = 0;
                }, 1000);

            }

        }, 2000);

    }


    // =========================================================
    // INTELLIGENCE
    // =========================================================

    function renderIntelligence() {

        const panel =
            document.getElementById(
                'intelligencePanel'
            );

        if (!panel) return;


        const intel =
            MockData.getIntelligence();


        const circumference =
            2 * Math.PI * 30;


        const offset =
            circumference -
            (
                intel.riskScore /
                intel.maxRisk
            ) *
            circumference;


        panel.innerHTML = `

            <div class="intel-card">

                <div class="intel-card-label">
                    Risk Analysis
                </div>


                <div class="risk-score-display">

                    <div class="risk-score-circle">

                        <svg viewBox="0 0 80 80">

                            <circle
                                class="risk-score-bg"
                                cx="40"
                                cy="40"
                                r="30"
                            />

                            <circle
                                class="risk-score-fill"
                                cx="40"
                                cy="40"
                                r="30"
                                style="
                                    stroke-dasharray:${circumference};
                                    stroke-dashoffset:${offset};
                                "
                            />

                        </svg>


                        <span class="risk-score-text">
                            ${intel.riskScore}
                        </span>

                    </div>


                    <div>

                        <div
                            style="
                                font-size:0.85rem;
                                color:var(--white);
                                font-weight:600;
                                margin-bottom:4px;
                            "
                        >
                            Low Risk
                        </div>

                        <div class="risk-description">
                            Infrastructure risk score is
                            within acceptable thresholds.
                            ${intel.anomalies}
                            anomalies detected.
                        </div>

                    </div>

                </div>

            </div>


            <div class="intel-card">

                <div class="intel-card-label">
                    Prediction Engine
                </div>

                <p class="intel-prediction">
                    ${intel.prediction}
                </p>

                <div
                    style="
                        margin-top:12px;
                        font-size:0.72rem;
                        color:var(--text-muted);
                    "
                >
                    Last analysis:
                    ${intel.lastAnalysis}
                    •
                    ${intel.predictions}
                    active predictions
                </div>

            </div>


            <div class="intel-card">

                <div class="intel-card-label">
                    Recommendation
                </div>

                <p class="intel-recommendation">
                    ${intel.recommendation}
                </p>

                <button
                    class="modal-btn primary"
                    style="
                        margin-top:16px;
                        font-size:0.78rem;
                    "
                    id="applyRecommendation"
                >
                    Apply Recommendation
                </button>

            </div>

        `;


        const applyBtn =
            document.getElementById(
                'applyRecommendation'
            );


        if (applyBtn) {

            applyBtn.addEventListener(
                'click',
                () => {

                    showToast(
                        'info',
                        'Recommendation forwarded to automation engine'
                    );

                }
            );

        }

    }


    // =========================================================
    // SERVICE TABLE
    // =========================================================

    let serviceData = [];


    function renderServiceTable() {

        serviceData =
            MockData.getServices();

        renderTableRows(serviceData);

    }


    function renderTableRows(data) {

        const tbody =
            document.getElementById(
                'serviceTableBody'
            );

        if (!tbody) return;


        tbody.innerHTML =
            data.map(s => {

                const riskClass =
                    s.risk > 60
                        ? 'high'
                        : s.risk > 30
                            ? 'medium'
                            : 'low';


                return `

                    <tr>

                        <td
                            style="
                                font-weight:600;
                                color:var(--white);
                            "
                        >
                            ${s.service}
                        </td>


                        <td>
                            <span
                                style="
                                    color:var(--text-muted);
                                "
                            >
                                ${s.environment}
                            </span>
                        </td>


                        <td>

                            <span
                                class="
                                    table-status-badge
                                    ${s.status}
                                "
                            >
                                ${s.status}
                            </span>

                        </td>


                        <td
                            style="
                                font-family:var(--font-mono);
                            "
                        >
                            ${s.cpu}%
                        </td>


                        <td
                            style="
                                font-family:var(--font-mono);
                            "
                        >
                            ${s.memory}%
                        </td>


                        <td
                            style="
                                font-family:var(--font-mono);
                                color:${
                                    s.latency > 100
                                        ? 'var(--red)'
                                        : s.latency > 30
                                            ? 'var(--amber)'
                                            : 'var(--white-dim)'
                                };
                            "
                        >
                            ${s.latency}ms
                        </td>


                        <td
                            style="
                                color:var(--text-muted);
                            "
                        >
                            ${s.lastDeploy}
                        </td>


                        <td>

                            <div class="table-risk">

                                <div class="risk-bar">

                                    <div
                                        class="
                                            risk-fill
                                            ${riskClass}
                                        "
                                        style="
                                            width:${s.risk}%;
                                        "
                                    ></div>

                                </div>

                                <span
                                    style="
                                        font-family:var(--font-mono);
                                        font-size:0.8rem;
                                    "
                                >
                                    ${s.risk}
                                </span>

                            </div>

                        </td>

                    </tr>

                `;

            }).join('');

    }


    function filterServiceTable(query) {

        const filtered =
            serviceData.filter(s =>

                s.service
                    .toLowerCase()
                    .includes(
                        query.toLowerCase()
                    )

                ||

                s.environment
                    .toLowerCase()
                    .includes(
                        query.toLowerCase()
                    )

                ||

                s.status
                    .toLowerCase()
                    .includes(
                        query.toLowerCase()
                    )

            );


        renderTableRows(filtered);

    }


    function sortServiceTable(column) {

        const ths =
            document.querySelectorAll(
                '.service-table th[data-sort]'
            );


        if (
            tableSortState.column === column
        ) {

            tableSortState.direction =
                tableSortState.direction === 'asc'
                    ? 'desc'
                    : 'asc';

        }

        else {

            tableSortState.column =
                column;

            tableSortState.direction =
                'asc';

        }


        ths.forEach(th => {

            th.classList.remove(
                'sorted-asc',
                'sorted-desc'
            );

            th.setAttribute(
                'aria-sort',
                'none'
            );


            const icon =
                th.querySelector(
                    '.sort-icon'
                );


            if (icon) {
                icon.textContent = '↕';
            }

        });


        const activeTh =
            document.querySelector(
                `th[data-sort="${column}"]`
            );


        if (activeTh) {

            activeTh.classList.add(
                `sorted-${tableSortState.direction}`
            );


            activeTh.setAttribute(
                'aria-sort',
                tableSortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
            );


            const icon =
                activeTh.querySelector(
                    '.sort-icon'
                );


            if (icon) {

                icon.textContent =
                    tableSortState.direction === 'asc'
                        ? '↑'
                        : '↓';

            }

        }


        const sorted =
            [...serviceData].sort((a, b) => {

                let valA = a[column];
                let valB = b[column];


                if (
                    typeof valA === 'string'
                ) {

                    valA =
                        valA.toLowerCase();

                    valB =
                        valB.toLowerCase();

                }


                if (
                    valA < valB
                ) {

                    return
                        tableSortState.direction === 'asc'
                            ? -1
                            : 1;

                }


                if (
                    valA > valB
                ) {

                    return
                        tableSortState.direction === 'asc'
                            ? 1
                            : -1;

                }


                return 0;

            });


        renderTableRows(sorted);

    }


    // =========================================================
    // LOG STREAM
    // =========================================================

    function startLogStream() {

        const logEl =
            document.getElementById(
                'logStream'
            );

        if (!logEl) return;


        const templates =
            MockData.getLogs();


        let logIndex = 0;


        for (let i = 0; i < 8; i++) {

            addLogEntry(
                logEl,
                templates[
                    logIndex %
                    templates.length
                ]
            );

            logIndex++;

        }


        logInterval =
            setInterval(() => {

                if (logPaused) return;


                const template =
                    templates[
                        logIndex %
                        templates.length
                    ];


                if (
                    currentLogFilter !== 'all' &&
                    template.level !==
                        currentLogFilter
                ) {

                    logIndex++;

                    return;

                }


                addLogEntry(
                    logEl,
                    template
                );


                logIndex++;


                while (
                    logEl.children.length > 50
                ) {

                    logEl.removeChild(
                        logEl.firstChild
                    );

                }


                logEl.scrollTop =
                    logEl.scrollHeight;


            }, 3000);

    }


    function addLogEntry(
        container,
        template
    ) {

        const now =
            new Date();


        const time =
            `${String(
                now.getHours()
            ).padStart(2, '0')}:` +

            `${String(
                now.getMinutes()
            ).padStart(2, '0')}:` +

            `${String(
                now.getSeconds()
            ).padStart(2, '0')}`;


        const entry =
            document.createElement(
                'div'
            );


        entry.className =
            'log-entry';


        entry.innerHTML = `

            <span class="log-time">
                [${time}]
            </span>

            <span
                class="log-level ${template.level}"
            >
                ${template.level.padEnd(5)}
            </span>

            <span class="log-message">
                ${template.message}
            </span>

        `;


        container.appendChild(
            entry
        );

    }


    // =========================================================
    // METRICS UPDATES
    // =========================================================

    function startMetricsUpdates() {

        metricsInterval =
            setInterval(() => {

                Object.keys(charts)
                    .forEach(key => {

                        const chartObj =
                            charts[key];


                        if (!chartObj) return;


                        const lastVal =
                            chartObj.chart.data[
                                chartObj.chart.data.length - 1
                            ];


                        const base =
                            typeof lastVal === 'object'
                                ? lastVal.value
                                : lastVal;


                        const variance =
                            key === 'errorRate'
                                ? 1
                                : 5;


                        const noise =
                            (
                                Math.random() - 0.5
                            ) *
                            variance *
                            2;


                        const newVal =
                            Math.max(
                                0,
                                Math.min(
                                    key === 'errorRate'
                                        ? 15
                                        : 100,
                                    base + noise
                                )
                            );


                        chartObj.chart.addPoint({
                            time: Date.now(),
                            value:
                                Math.round(
                                    newVal * 10
                                ) / 10
                        });


                        const valEl =
                            document.getElementById(
                                `chart-val-${key}`
                            );


                        if (valEl) {

                            valEl.textContent =
                                `${
                                    Math.round(
                                        newVal * 10
                                    ) / 10
                                }${chartObj.config.suffix}`;

                        }

                    });

            }, 4000);

    }


    // =========================================================
    // STATUS BAR
    // =========================================================

    function renderStatusBar() {

        const container =
            document.getElementById(
                'statusBarItems'
            );

        if (!container) return;


        const statuses =
            MockData.getGlobalStatus();


        container.innerHTML =
            statuses.map(s => `

                <div class="status-bar-item">

                    <span
                        class="status-dot ${s.status}"
                        style="
                            animation:pulse
                            ${
                                s.status === 'healthy'
                                    ? '3s'
                                    : '1.5s'
                            }
                            ease-in-out infinite;
                        "
                    ></span>

                    <span>
                        ${s.name}
                    </span>

                </div>

            `).join('');


        const hasIssue =
            statuses.some(
                s => s.status !== 'healthy'
            );


        const msgEl =
            document.getElementById(
                'statusMessage'
            );


        if (msgEl) {

            if (hasIssue) {

                msgEl.textContent =
                    'Degraded performance detected';

                msgEl.style.color =
                    'var(--amber)';

            }

            else {

                msgEl.textContent =
                    'All systems operational';

                msgEl.style.color =
                    'var(--green)';

            }

        }

    }


    // =========================================================
    // NOTIFICATIONS
    // =========================================================

    function renderNotifications() {

        const body =
            document.getElementById(
                'notifPanelBody'
            );

        if (!body) return;


        const notifications =
            MockData.getNotifications();


        body.innerHTML =
            notifications.map(n => `

                <div class="notif-item">

                    <div
                        class="
                            notif-icon
                            ${n.type}
                        "
                    >
                        ${
                            n.type === 'critical'
                                ? '🔴'
                                : n.type === 'warning'
                                    ? '🟡'
                                    : n.type === 'success'
                                        ? '🟢'
                                        : '🔵'
                        }
                    </div>


                    <div class="notif-content">

                        <div class="notif-title">
                            ${n.title}
                        </div>

                        <div class="notif-desc">
                            ${n.desc}
                        </div>

                        <div class="notif-time">
                            ${n.time}
                        </div>

                    </div>

                </div>

            `).join('');

    }


    // =========================================================
    // MODAL HELPERS
    // =========================================================

    function openModal() {

        const overlay =
            document.getElementById(
                'modalOverlay'
            );


        if (overlay) {

            overlay.classList.add(
                'open'
            );


            overlay.setAttribute(
                'aria-hidden',
                'false'
            );


            const closeButton =
                document.getElementById(
                    'modalClose'
                );


            if (closeButton) {
                closeButton.focus();
            }

        }

    }


    function closeModal() {

        const overlay =
            document.getElementById(
                'modalOverlay'
            );


        if (overlay) {

            overlay.classList.remove(
                'open'
            );


            overlay.setAttribute(
                'aria-hidden',
                'true'
            );

        }

    }


    // =========================================================
    // TOAST
    // =========================================================

    function showToast(
        type,
        message
    ) {

        const container =
            document.getElementById(
                'toastContainer'
            );

        if (!container) return;


        const icons = {

            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'

        };


        const toast =
            document.createElement(
                'div'
            );


        toast.className =
            `toast ${type}`;


        toast.innerHTML = `

            <span class="toast-icon">
                ${icons[type] || 'ℹ️'}
            </span>

            <span class="toast-text">
                ${message}
            </span>

        `;


        container.appendChild(
            toast
        );


        setTimeout(() => {

            toast.classList.add(
                'removing'
            );


            setTimeout(
                () => toast.remove(),
                300
            );

        }, 4000);

    }


    // =========================================================
    // UTILITY
    // =========================================================

    function getTimeAgo(
        timestamp
    ) {

        const diff =
            Date.now() - timestamp;


        const mins =
            Math.floor(
                diff / 60000
            );


        if (mins < 1) {
            return 'just now';
        }


        if (mins < 60) {

            return `${mins} minute${
                mins > 1 ? 's' : ''
            } ago`;

        }


        const hrs =
            Math.floor(
                mins / 60
            );


        return `${hrs} hour${
            hrs > 1 ? 's' : ''
        } ago`;

    }


    // =========================================================
    // DESTROY
    // =========================================================

    function destroy() {

        if (logInterval) {
            clearInterval(logInterval);
        }


        if (metricsInterval) {
            clearInterval(metricsInterval);
        }


        if (awsInterval) {
            clearInterval(awsInterval);
        }


        if (infraMap) {
            infraMap.destroy();
        }


        Object.values(charts)
            .forEach(c => {

                if (
                    c &&
                    c.chart &&
                    c.chart.destroy
                ) {

                    c.chart.destroy();

                }

            });

    }


    // =========================================================
    // PUBLIC API
    // =========================================================

    return {

        init,

        showNodeModal,

        showToast,

        openModal,

        closeModal,

        destroy

    };

}
)();
