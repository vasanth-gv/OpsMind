/**
 * OPSMIND — Animations Module
 * 
 * Handles 3D effects, tilt, parallax, counters,
 * chart rendering, infrastructure map, and micro-interactions.
 */

const Animations = (() => {

    // ---------- MOUSE LIGHT FOLLOW ----------
    let mouseX = 0;
    let mouseY = 0;
    let lightX = 0;
    let lightY = 0;
    let lightRAF = null;

    function initMouseLight() {
        const light = document.getElementById('mouseLight');
        if (!light) return;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function updateLight() {
            lightX += (mouseX - lightX) * 0.08;
            lightY += (mouseY - lightY) * 0.08;
            light.style.transform = `translate(${lightX - 300}px, ${lightY - 300}px)`;
            lightRAF = requestAnimationFrame(updateLight);
        }
        updateLight();
    }

    // ---------- 3D TILT EFFECT ----------
    function initTiltCards() {
        const cards = document.querySelectorAll('.tilt-card');
        cards.forEach(card => {
            card.addEventListener('mousemove', handleTilt);
            card.addEventListener('mouseleave', resetTilt);
        });
    }

    function handleTilt(e) {
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -6;
        const rotateY = ((x - centerX) / centerX) * 6;

        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        card.style.transition = 'transform 0.1s ease-out';
    }

    function resetTilt(e) {
        const card = e.currentTarget;
        card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
        card.style.transition = 'transform 0.4s ease';
    }

    // ---------- COUNTER ANIMATION ----------
    function animateCounters() {
        const counters = document.querySelectorAll('.counter');
        counters.forEach(counter => {
            const target = parseFloat(counter.dataset.target);
            const suffix = counter.dataset.suffix || '';
            const duration = 2000;
            const startTime = performance.now();
            const isFloat = target % 1 !== 0;

            function updateCounter(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = eased * target;

                if (isFloat) {
                    counter.textContent = current.toFixed(1) + suffix;
                } else {
                    counter.textContent = Math.round(current) + suffix;
                }

                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                }
            }
            requestAnimationFrame(updateCounter);
        });
    }

    // ---------- CHART RENDERING (Canvas) ----------
    class LineChart {
        constructor(canvas, options = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.data = options.data || [];
            this.color = options.color || '#00d4ff';
            this.fillColor = options.fillColor || 'rgba(0, 212, 255, 0.08)';
            this.lineWidth = options.lineWidth || 2;
            this.showDots = options.showDots || false;
            this.animated = options.animated !== false;
            this.maxValue = options.maxValue || null;
            this.minValue = options.minValue || 0;
            this.resize();
            this._resizeHandler = () => this.resize();
            window.addEventListener('resize', this._resizeHandler);
        }

        resize() {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            this.ctx.scale(dpr, dpr);
            this.width = rect.width;
            this.height = rect.height;
            this.draw();
        }

        updateData(newData) {
            this.data = newData;
            this.draw();
        }

        addPoint(point) {
            this.data.push(point);
            if (this.data.length > 120) {
                this.data.shift();
            }
            this.draw();
        }

        draw() {
            const ctx = this.ctx;
            const { width, height, data } = this;

            ctx.clearRect(0, 0, width, height);

            if (data.length < 2) return;

            const values = data.map(d => typeof d === 'object' ? d.value : d);
            const max = this.maxValue || Math.max(...values) * 1.15;
            const min = this.minValue;
            const range = max - min || 1;

            const stepX = width / (values.length - 1);
            const padding = 4;

            // Draw grid lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
                const gy = padding + ((height - padding * 2) / 3) * i;
                ctx.beginPath();
                ctx.moveTo(0, gy);
                ctx.lineTo(width, gy);
                ctx.stroke();
            }

            // Build path
            const points = values.map((val, i) => ({
                x: i * stepX,
                y: padding + (1 - (val - min) / range) * (height - padding * 2)
            }));

            // Gradient fill
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, this.fillColor);
            gradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const cpx = (prev.x + curr.x) / 2;
                ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
            }

            // Fill
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();

            // Line
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const cpx = (prev.x + curr.x) / 2;
                ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y);
            }
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();

            // Glow
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 6;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // End dot
            if (points.length > 0) {
                const last = points[points.length - 1];
                ctx.beginPath();
                ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
                ctx.fillStyle = this.fillColor;
                ctx.fill();
            }
        }

        destroy() {
            window.removeEventListener('resize', this._resizeHandler);
        }
    }

    // ---------- MINI SPARKLINE ----------
    class Sparkline {
        constructor(canvas, data, color) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.data = data;
            this.color = color || '#00d4ff';
            this.resize();
        }

        resize() {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            this.ctx.scale(dpr, dpr);
            this.width = rect.width;
            this.height = rect.height;
            this.draw();
        }

        updateData(data) {
            this.data = data;
            this.draw();
        }

        draw() {
            const ctx = this.ctx;
            const { width, height, data } = this;
            ctx.clearRect(0, 0, width, height);
            if (data.length < 2) return;

            const max = Math.max(...data) * 1.1;
            const min = Math.min(...data) * 0.9;
            const range = max - min || 1;
            const stepX = width / (data.length - 1);

            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, this.color + '22');
            gradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            data.forEach((val, i) => {
                const x = i * stepX;
                const y = 2 + (1 - (val - min) / range) * (height - 4);
                if (i === 0) ctx.moveTo(x, y);
                else {
                    const prevX = (i - 1) * stepX;
                    const prevY = 2 + (1 - (data[i - 1] - min) / range) * (height - 4);
                    const cpx = (prevX + x) / 2;
                    ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
                }
            });

            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.beginPath();
            data.forEach((val, i) => {
                const x = i * stepX;
                const y = 2 + (1 - (val - min) / range) * (height - 4);
                if (i === 0) ctx.moveTo(x, y);
                else {
                    const prevX = (i - 1) * stepX;
                    const prevY = 2 + (1 - (data[i - 1] - min) / range) * (height - 4);
                    const cpx = (prevX + x) / 2;
                    ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
                }
            });
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    // ---------- INFRASTRUCTURE MAP ----------
    class InfrastructureMap {
        constructor(canvasId, containerId) {
            this.canvas = document.getElementById(canvasId);
            this.container = document.getElementById(containerId);
            if (!this.canvas || !this.container) return;

            this.ctx = this.canvas.getContext('2d');
            this.nodes = MockData.getInfrastructureNodes();
            this.connections = this._buildConnections();
            this.animOffset = 0;
            this.hoveredNode = null;
            this._rafId = null;

            this.resize();
            this.renderNodes();
            this.animate();

            this._resizeHandler = () => { this.resize(); this.renderNodes(); };
            window.addEventListener('resize', this._resizeHandler);
        }

        _buildConnections() {
            const connections = [];
            this.nodes.forEach(node => {
                if (node.children) {
                    node.children.forEach(childId => {
                        const child = this.nodes.find(n => n.id === childId);
                        if (child) {
                            connections.push({ from: node, to: child });
                        }
                    });
                }
            });
            return connections;
        }

        resize() {
            const parent = this.canvas.parentElement;
            const rect = parent.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            this.width = rect.width;
            this.height = rect.height;
        }

        renderNodes() {
            this.container.innerHTML = '';
            this.nodes.forEach(node => {
                const el = document.createElement('div');
                el.className = 'infra-node';
                el.dataset.nodeId = node.id;

                const px = node.x * this.width;
                const py = node.y * this.height;
                el.style.left = (px - 50) + 'px';
                el.style.top = (py - 30) + 'px';

                const statusClass = node.status;
                const statusColor = node.status === 'healthy' ? 'var(--green)' :
                    node.status === 'warning' ? 'var(--amber)' : 'var(--red)';

                el.innerHTML = `
                    <div class="node-inner">
                        <span class="node-status-dot status-dot ${statusClass}" style="background:${statusColor};box-shadow:0 0 6px ${statusColor}"></span>
                        <span class="node-icon">${node.icon}</span>
                        <span class="node-name">${node.name}</span>
                        <span class="node-metric">CPU ${node.cpu}% | MEM ${node.memory}%</span>
                    </div>
                `;

                el.addEventListener('mouseenter', (e) => this.showTooltip(e, node));
                el.addEventListener('mouseleave', () => this.hideTooltip());
                el.addEventListener('click', () => this.onNodeClick(node));

                this.container.appendChild(el);
            });
        }

        showTooltip(e, node) {
            const tooltip = document.getElementById('nodeTooltip');
            if (!tooltip) return;

            const latencyColor = node.latency > 100 ? 'var(--red)' :
                node.latency > 30 ? 'var(--amber)' : 'var(--green)';

            tooltip.innerHTML = `
                <h4>${node.icon} ${node.name}</h4>
                <div class="tooltip-row"><span class="tooltip-label">Status</span><span class="tooltip-value" style="color:${node.status === 'healthy' ? 'var(--green)' : node.status === 'warning' ? 'var(--amber)' : 'var(--red)'}">${node.status.toUpperCase()}</span></div>
                <div class="tooltip-row"><span class="tooltip-label">CPU</span><span class="tooltip-value">${node.cpu}%</span></div>
                <div class="tooltip-row"><span class="tooltip-label">Memory</span><span class="tooltip-value">${node.memory}%</span></div>
                <div class="tooltip-row"><span class="tooltip-label">Latency</span><span class="tooltip-value" style="color:${latencyColor}">${node.latency}ms</span></div>
            `;

            const rect = this.container.getBoundingClientRect();
            const nodeX = node.x * this.width;
            const nodeY = node.y * this.height;

            let left = nodeX + 60;
            let top = nodeY - 20;
            if (left + 210 > this.width) left = nodeX - 220;
            if (top + 140 > this.height) top = this.height - 150;

            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
            tooltip.classList.add('visible');
            this.hoveredNode = node.id;
        }

        hideTooltip() {
            const tooltip = document.getElementById('nodeTooltip');
            if (tooltip) tooltip.classList.remove('visible');
            this.hoveredNode = null;
        }

        onNodeClick(node) {
            if (typeof Dashboard !== 'undefined' && Dashboard.showNodeModal) {
                Dashboard.showNodeModal(node);
            }
        }

        animate() {
            this.animOffset += 0.5;
            this.drawConnections();
            this._rafId = requestAnimationFrame(() => this.animate());
        }

        drawConnections() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.width, this.height);

            this.connections.forEach(conn => {
                const fromX = conn.from.x * this.width;
                const fromY = conn.from.y * this.height;
                const toX = conn.to.x * this.width;
                const toY = conn.to.y * this.height;

                const isHovered = this.hoveredNode === conn.from.id || this.hoveredNode === conn.to.id;

                // Connection line
                ctx.beginPath();
                ctx.moveTo(fromX, fromY);

                // Curved line
                const midX = (fromX + toX) / 2;
                const midY = (fromY + toY) / 2;
                ctx.quadraticCurveTo(midX + (toX - fromX) * 0.1, midY, toX, toY);

                ctx.strokeStyle = isHovered ? 'rgba(0, 212, 255, 0.5)' : 'rgba(100, 120, 255, 0.15)';
                ctx.lineWidth = isHovered ? 2 : 1;
                ctx.stroke();

                // Animated particles
                this.drawParticle(ctx, fromX, fromY, toX, toY, isHovered);
            });
        }

        drawParticle(ctx, x1, y1, x2, y2, highlight) {
            const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const speed = 0.003;
            const t = ((this.animOffset * speed) % 1 + 1) % 1;

            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;

            ctx.beginPath();
            ctx.arc(px, py, highlight ? 3 : 2, 0, Math.PI * 2);
            ctx.fillStyle = highlight ? 'rgba(0, 212, 255, 0.8)' : 'rgba(100, 120, 255, 0.4)';
            ctx.fill();

            if (highlight) {
                ctx.beginPath();
                ctx.arc(px, py, 6, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 212, 255, 0.15)';
                ctx.fill();
            }
        }

        destroy() {
            if (this._rafId) cancelAnimationFrame(this._rafId);
            window.removeEventListener('resize', this._resizeHandler);
        }
    }

    // ---------- CLOCK ----------
    function initClock() {
        const clockEl = document.getElementById('liveClock');
        if (!clockEl) return;

        function update() {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const s = String(now.getSeconds()).padStart(2, '0');
            clockEl.textContent = `${h}:${m}:${s}`;
        }
        update();
        setInterval(update, 1000);
    }

    // Public API
    return {
        initMouseLight,
        initTiltCards,
        animateCounters,
        LineChart,
        Sparkline,
        InfrastructureMap,
        initClock
    };
})();