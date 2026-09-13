/**
 * OPSMIND — Application Controller
 * 
 * Entry point. Handles navigation, sidebar, modals,
 * environment selector, keyboard shortcuts, and initialization.
 */

(function () {
    'use strict';

    // ---------- DOM ELEMENTS ----------
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalClose = document.getElementById('modalClose');
    const notificationBtn = document.getElementById('notificationBtn');
    const notifCloseBtn = document.getElementById('notifCloseBtn');
    const notificationPanel = document.getElementById('notificationPanel');
    const envBtns = document.querySelectorAll('.env-btn');
    const globalSearch = document.getElementById('globalSearch');

    // ---------- AUTH: username display + logout ----------
    const userProfile = document.getElementById('userProfile');
    const userNameEl = document.querySelector('.user-name');

    if (userNameEl) {
        const savedUsername = sessionStorage.getItem('opsmind_username');
        if (savedUsername) userNameEl.textContent = savedUsername;
    }

    if (userProfile) {
        const doLogout = async () => {
            if (!confirm('Log out of OpsMind?')) return;
            const token = sessionStorage.getItem('opsmind_token');
            try {
                await fetch('http://127.0.0.1:8000/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
            } catch (e) { /* backend unreachable; still clear locally */ }
            sessionStorage.removeItem('opsmind_token');
            sessionStorage.removeItem('opsmind_username');
            window.location.href = 'login.html';
        };
        userProfile.addEventListener('click', doLogout);
        userProfile.style.cursor = 'pointer';
        userProfile.title = 'Click to log out';
    }

    // ---------- SIDEBAR TOGGLE ----------
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth <= 1100) {
                sidebar.classList.toggle('mobile-open');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        });
    }

    // Close mobile sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1100 && sidebar.classList.contains('mobile-open')) {
            if (!sidebar.contains(e.target) && e.target !== sidebarToggle) {
                sidebar.classList.remove('mobile-open');
            }
        }
    });

    // ---------- NAVIGATION ----------
    navItems.forEach(item => {
        const handler = () => {
            const page = item.dataset.page;
            if (!page) return;

            // Update nav active state
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Show page
            pages.forEach(p => p.classList.remove('active'));
            const targetPage = document.getElementById(`page-${page}`);
            if (targetPage) {
                targetPage.classList.add('active');
            }

            // Close mobile sidebar
            if (window.innerWidth <= 1100) {
                sidebar.classList.remove('mobile-open');
            }
        };

        item.addEventListener('click', handler);
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler();
            }
        });
    });

    // ---------- MODAL ----------
    if (modalClose) {
        modalClose.addEventListener('click', () => Dashboard.closeModal());
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) Dashboard.closeModal();
        });
    }

    // ---------- NOTIFICATIONS PANEL ----------
    if (notificationBtn) {
        notificationBtn.addEventListener('click', () => {
            notificationPanel.classList.toggle('open');
            notificationPanel.setAttribute('aria-hidden',
                !notificationPanel.classList.contains('open'));
        });
    }

    if (notifCloseBtn) {
        notifCloseBtn.addEventListener('click', () => {
            notificationPanel.classList.remove('open');
            notificationPanel.setAttribute('aria-hidden', 'true');
        });
    }

    // ---------- ENVIRONMENT SELECTOR ----------
    envBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            envBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const env = btn.dataset.env;
            Dashboard.showToast('info', `Switched to ${env} environment`);
        });
    });

    // ---------- KEYBOARD SHORTCUTS ----------
    document.addEventListener('keydown', (e) => {
        // Cmd/Ctrl + K for search
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            if (globalSearch) globalSearch.focus();
        }

        // Escape to close modals/panels
        if (e.key === 'Escape') {
            Dashboard.closeModal();
            if (notificationPanel) {
                notificationPanel.classList.remove('open');
                notificationPanel.setAttribute('aria-hidden', 'true');
            }
        }
    });

    // ---------- SEARCH ----------
    if (globalSearch) {
        let searchTimeout;
        globalSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = e.target.value.trim();
                if (query.length > 2) {
                    // In production, this would call an API
                    Dashboard.showToast('info', `Searching for "${query}"...`);
                }
            }, 500);
        });
    }

    // ---------- PERIODIC TOAST NOTIFICATIONS ----------
    function startPeriodicNotifications() {
        const messages = [
            { type: 'success', msg: 'Health check passed for all services' },
            { type: 'info', msg: 'Metrics collection cycle completed' },
            { type: 'warning', msg: 'Worker pod memory usage at 71%' },
            { type: 'success', msg: 'Auto-scaling evaluation: no action needed' },
            { type: 'info', msg: 'SSL certificates validated successfully' }
        ];

        let idx = 0;
        setInterval(() => {
            const notification = messages[idx % messages.length];
            Dashboard.showToast(notification.type, notification.msg);
            idx++;
        }, 30000); // Every 30 seconds
    }

    // ---------- INITIALIZATION ----------
    function initApp() {
        // Initialize animations
        Animations.initMouseLight();
        Animations.initClock();

        // Initialize dashboard
        Dashboard.init();

        // Counter animation after brief delay for visibility
        setTimeout(() => {
            Animations.animateCounters();
            Animations.initTiltCards();
        }, 300);

        // Start periodic notifications
        startPeriodicNotifications();

        // Initial toast
        setTimeout(() => {
            Dashboard.showToast('success', 'OPSMIND Command Center initialized');
        }, 1500);

        console.log(
            '%c OPSMIND %c Autonomous DevOps Operations Platform ',
            'background: linear-gradient(135deg, #00d4ff, #7b2ff7); color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px 0 0 4px;',
            'background: #1a1a2e; color: #e8eaf6; padding: 4px 8px; border-radius: 0 4px 4px 0;'
        );
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

})();