/**
 * OPSMIND — Mock/Demo Data Module
 *
 * NOTE: This file provides SAMPLE/DEMO data only, for parts of the
 * dashboard that are illustrative (metrics charts, sample log stream,
 * demo incidents list, notifications, infrastructure map nodes).
 *
 * It is NOT used for real infrastructure status. Real AWS / Jenkins /
 * Docker / Kubernetes health comes from the live FastAPI backend via
 * /api/overview and /api/aws (see dashboard.js: loadOverviewData,
 * loadAWSData). Those flows never touch this file.
 *
 * This file was missing from the project when handed over, and was
 * referenced by index.html (<script src="js/mock-data.js">) as well as
 * by dashboard.js / animation.js. Recreated here to restore the
 * charts / logs / incidents-demo / automation / intelligence /
 * notifications / infra-map sections of the UI.
 */

const MockData = (() => {

    // ---------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------

    function series(count, base, variance, min = 0, max = 100) {
        const points = [];
        let value = base;
        for (let i = 0; i < count; i++) {
            value += (Math.random() - 0.5) * variance;
            value = Math.max(min, Math.min(max, value));
            points.push({ value: Math.round(value * 10) / 10 });
        }
        return points;
    }

    // ---------------------------------------------------------
    // Real-Time Metrics charts
    // ---------------------------------------------------------

    function getMetricsTimeSeries() {
        return {
            cpu: series(40, 45, 8, 0, 100),
            memory: series(40, 60, 6, 0, 100),
            network: series(40, 120, 30, 0, 500),
            latency: series(40, 45, 15, 5, 300),
            deployments: series(40, 4, 2, 0, 20),
            errorRate: series(40, 1.2, 0.8, 0, 15)
        };
    }

    // ---------------------------------------------------------
    // Demo incidents feed
    // ---------------------------------------------------------

    function getIncidents() {
        const now = Date.now();
        return [
            {
                id: 'inc-1001',
                severity: 'warning',
                service: 'API Gateway',
                title: 'Elevated response latency observed',
                timestamp: now - 6 * 60 * 1000
            },
            {
                id: 'inc-1002',
                severity: 'info',
                service: 'CI/CD Pipeline',
                title: 'Deployment completed with warnings',
                timestamp: now - 22 * 60 * 1000
            },
            {
                id: 'inc-1003',
                severity: 'critical',
                service: 'Payments Service',
                title: 'Elevated error rate on checkout endpoint',
                timestamp: now - 55 * 60 * 1000
            }
        ];
    }

    // ---------------------------------------------------------
    // Automation panel
    // ---------------------------------------------------------

    function getAutomationStatus() {
        return {
            successRate: 96,
            totalActions: 214,
            recentActions: [
                { action: 'Auto-scaled worker pool (+2 replicas)', time: '3m ago' },
                { action: 'Restarted unhealthy pod in default namespace', time: '17m ago' },
                { action: 'Rotated expiring TLS certificate', time: '1h ago' },
                { action: 'Cleared disk cache on build agent', time: '2h ago' }
            ],
            pipelineSteps: [
                'Build', 'Test', 'Scan', 'Package', 'Deploy', 'Verify'
            ]
        };
    }

    // ---------------------------------------------------------
    // Intelligence / risk panel
    // ---------------------------------------------------------

    function getIntelligence() {
        return {
            riskScore: 18,
            maxRisk: 100,
            anomalies: 2,
            prediction: 'No capacity issues expected in the next 24 hours based on current trends.',
            lastAnalysis: '5 min ago',
            predictions: 3,
            recommendation: 'Consider increasing the Jenkins agent pool during the 6-9pm deploy window.'
        };
    }

    // ---------------------------------------------------------
    // Service table (demo rows)
    // ---------------------------------------------------------

    function getServices() {
        return [
            { service: 'API Gateway', environment: 'Production', status: 'online', cpu: 42, memory: 58, latency: 34, lastDeploy: '2h ago', risk: 12 },
            { service: 'Auth Service', environment: 'Production', status: 'online', cpu: 31, memory: 47, latency: 22, lastDeploy: '1d ago', risk: 8 },
            { service: 'Payments Service', environment: 'Production', status: 'degraded', cpu: 76, memory: 81, latency: 142, lastDeploy: '3h ago', risk: 64 },
            { service: 'Notification Worker', environment: 'Staging', status: 'online', cpu: 20, memory: 35, latency: 18, lastDeploy: '6h ago', risk: 5 }
        ];
    }

    // ---------------------------------------------------------
    // Log stream templates
    // ---------------------------------------------------------

    function getLogs() {
        return [
            { level: 'info', message: 'Health check passed for all services' },
            { level: 'info', message: 'Metrics collection cycle completed' },
            { level: 'warn', message: 'Worker pod memory usage at 71%' },
            { level: 'info', message: 'Auto-scaling evaluation: no action needed' },
            { level: 'error', message: 'Timeout connecting to downstream cache node' },
            { level: 'info', message: 'SSL certificates validated successfully' },
            { level: 'debug', message: 'Cache hit ratio 94.2% over last interval' }
        ];
    }

    // ---------------------------------------------------------
    // Global status bar
    // ---------------------------------------------------------

    function getGlobalStatus() {
        return [
            { name: 'API', status: 'healthy' },
            { name: 'Database', status: 'healthy' },
            { name: 'Cache', status: 'healthy' },
            { name: 'CI/CD', status: 'warning' },
            { name: 'CDN', status: 'healthy' }
        ];
    }

    // ---------------------------------------------------------
    // Notifications panel
    // ---------------------------------------------------------

    function getNotifications() {
        return [
            { type: 'success', title: 'Deployment succeeded', desc: 'api-gateway v2.4.1 deployed to production', time: '5m ago' },
            { type: 'warning', title: 'High memory usage', desc: 'payments-service memory at 81%', time: '18m ago' },
            { type: 'info', title: 'Scheduled maintenance', desc: 'Database maintenance window at 2:00 AM UTC', time: '1h ago' }
        ];
    }

    // ---------------------------------------------------------
    // Infrastructure map nodes
    // ---------------------------------------------------------

    function getInfrastructureNodes() {
        return [
            { id: 'lb', name: 'Load Balancer', icon: '🌐', status: 'healthy', cpu: 22, memory: 30, x: 0.5, y: 0.15, children: ['api1', 'api2'] },
            { id: 'api1', name: 'API Node 1', icon: '🖥️', status: 'healthy', cpu: 45, memory: 58, x: 0.3, y: 0.45, children: ['db'] },
            { id: 'api2', name: 'API Node 2', icon: '🖥️', status: 'warning', cpu: 71, memory: 66, x: 0.7, y: 0.45, children: ['db'] },
            { id: 'db', name: 'Database', icon: '🗄️', status: 'healthy', cpu: 38, memory: 52, x: 0.5, y: 0.75, children: [] }
        ];
    }

    return {
        getMetricsTimeSeries,
        getIncidents,
        getAutomationStatus,
        getIntelligence,
        getServices,
        getLogs,
        getGlobalStatus,
        getNotifications,
        getInfrastructureNodes
    };

})();
