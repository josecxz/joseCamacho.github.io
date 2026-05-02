// Francisco Granda — Log
// Starfield + ship flybys + scroll reveal + live clock + tweaks panel.

(() => {
    'use strict';

    // ── Tweak state (persisted to localStorage) ────────────────────────
    const DEFAULTS = {
        accentHue: 168,
        starDensity: 2800,
        starTwinkle: true,
        ships: true,
        shipEnterpriseRefit: true,
        shipEnterpriseD: true,
        shipVoyager: true,
        shipSpeed: 1.0,
        parallax: true,
        scrollAnimations: true,
        hoverGlow: true,
        gridOverlay: true,
    };

    const STORAGE_KEY = 'fg-tweaks-v1';
    const tweaks = { ...DEFAULTS };
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        for (const k of Object.keys(DEFAULTS)) {
            if (k in saved) tweaks[k] = saved[k];
        }
    } catch (e) { /* ignore */ }

    function persist() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks)); } catch (e) { /* ignore */ }
    }

    // ── Year ─────────────────────────────────────────────────────────
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // ── Live UTC clock ───────────────────────────────────────────────
    const clockEl = document.getElementById('utc-clock');
    function updateClock() {
        const now = new Date();
        const iso = now.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
        if (clockEl) clockEl.textContent = iso;
    }
    updateClock();
    setInterval(updateClock, 1000);

    // ── Accent hue + global flags ────────────────────────────────────
    const body = document.body;
    function applyGlobalTweaks() {
        document.documentElement.style.setProperty('--hue', tweaks.accentHue);
        body.classList.toggle('glow-on', !!tweaks.hoverGlow);
        body.classList.toggle('no-scroll-anim', !tweaks.scrollAnimations);
        const gridEl = document.querySelector('[data-grid]');
        if (gridEl) gridEl.classList.toggle('hidden', !tweaks.gridOverlay);
    }
    applyGlobalTweaks();

    // ── Reveal on scroll ─────────────────────────────────────────────
    const revealEls = document.querySelectorAll('[data-reveal]');
    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) {
                const delay = parseInt(e.target.dataset.revealDelay || '0', 10);
                setTimeout(() => e.target.classList.add('revealed'), delay);
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.18 });
    revealEls.forEach((el) => io.observe(el));

    // ── Active section for rail nav ──────────────────────────────────
    const sections = document.querySelectorAll('[data-section]');
    const links = document.querySelectorAll('.rail-nav a[data-link]');
    const activeIO = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) {
                const id = e.target.dataset.section;
                links.forEach((a) => {
                    a.classList.toggle('active', a.dataset.link === id);
                });
            }
        });
    }, { threshold: 0.35 });
    sections.forEach((s) => activeIO.observe(s));

    // ── Hero parallax on window scroll ───────────────────────────────
    const heroInner = document.querySelector('[data-hero-inner]');
    function onScroll() {
        if (!heroInner) return;
        const y = window.scrollY;
        if (tweaks.parallax) {
            heroInner.style.transform = `translateY(${y * 0.25}px)`;
            heroInner.style.opacity = String(Math.max(0, 1 - y / 900));
        } else {
            heroInner.style.transform = '';
            heroInner.style.opacity = '';
        }
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    // ── Starfield + ship flybys ──────────────────────────────────────
    const canvas = document.getElementById('stars');
    const ctx = canvas.getContext('2d');
    const mouse = { x: -9999, y: -9999 };
    let stars = [];
    let ships = [];
    let raf = 0;
    let scheduleTimer = 0;

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const count = Math.floor((w * h) / tweaks.starDensity);
        stars = Array.from({ length: count }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            r: Math.random() * 1.4 + 0.2,
            a: Math.random() * 0.6 + 0.2,
            da: (Math.random() - 0.5) * 0.012,
            depth: Math.random() * 0.8 + 0.2,
        }));
    }

    function onMove(e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }
    function onLeave() { mouse.x = -9999; mouse.y = -9999; }

    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    resize();

    // ── Ship renderers (top-down, facing +X; caller flips for direction) ──
    function drawWarpTrail(length, strands = 4, widthBase = 3, hue = 220) {
        const grad = ctx.createLinearGradient(-length, 0, 0, 0);
        grad.addColorStop(0, `oklch(0.85 0.2 ${hue} / 0)`);
        grad.addColorStop(0.6, `oklch(0.85 0.2 ${hue} / 0.22)`);
        grad.addColorStop(1, `oklch(0.92 0.18 ${hue} / 0.55)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        for (let i = 0; i < strands; i++) {
            ctx.beginPath();
            ctx.moveTo(-length, (i - (strands - 1) / 2) * widthBase);
            ctx.lineTo(-10, (i - (strands - 1) / 2) * (widthBase * 0.35));
            ctx.globalAlpha = 0.32 + Math.sin((Date.now() / 80) + i) * 0.15;
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    function drawBussard(x, y, r, pulse) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `oklch(0.72 0.22 30 / ${pulse})`;
        ctx.shadowColor = 'oklch(0.72 0.22 30)';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    function drawWarpGlow(x, y, r, pulse) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `oklch(0.88 0.2 220 / ${0.7 + pulse * 0.3})`;
        ctx.shadowColor = 'oklch(0.88 0.2 220)';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function drawEnterpriseRefit() {
        const pulse = 0.7 + Math.sin(Date.now() / 150) * 0.3;
        drawWarpTrail(200, 5, 2.6);

        const hull = 'oklch(0.82 0.006 230)';
        const hullDark = 'oklch(0.62 0.008 230)';
        const stroke = 'oklch(0.22 0.01 260)';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.7;

        ctx.fillStyle = hull;
        ctx.beginPath(); ctx.ellipse(-14, 0, 22, 7.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'oklch(0.5 0.01 260 / 0.6)';
        ctx.beginPath(); ctx.ellipse(-14, 0, 16, 5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-14, 0, 9, 2.8, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = stroke;

        ctx.fillStyle = hullDark;
        ctx.beginPath();
        ctx.moveTo(-10, 2); ctx.lineTo(-4, 5); ctx.lineTo(2, 5); ctx.lineTo(-4, 1);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.fillStyle = hull;
        ctx.beginPath(); ctx.ellipse(8, 5.5, 20, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(-11, 5.5, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = 'oklch(0.75 0.14 60 / 0.8)';
        ctx.shadowColor = 'oklch(0.75 0.14 60)'; ctx.shadowBlur = 6; ctx.fill();
        ctx.shadowBlur = 0;

        for (const yy of [-10, 10]) {
            ctx.fillStyle = hullDark;
            ctx.beginPath();
            ctx.moveTo(0, 4 * Math.sign(yy)); ctx.lineTo(2, yy * 0.55);
            ctx.lineTo(10, yy); ctx.lineTo(12, yy);
            ctx.lineTo(6, 4 * Math.sign(yy));
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = hull;
            ctx.beginPath(); ctx.ellipse(8, yy, 18, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'oklch(0.5 0.01 260 / 0.7)';
            ctx.beginPath(); ctx.moveTo(-8, yy); ctx.lineTo(24, yy); ctx.stroke();
            ctx.strokeStyle = stroke;
            drawBussard(-9, yy, 2.2, pulse);
            drawWarpGlow(25, yy, 1.8, pulse);
        }

        if (Math.floor(Date.now() / 500) % 2) {
            ctx.beginPath(); ctx.arc(-34, 0, 1, 0, Math.PI * 2);
            ctx.fillStyle = 'oklch(0.85 0.22 30)'; ctx.fill();
        }
    }

    function drawEnterpriseD() {
        const pulse = 0.7 + Math.sin(Date.now() / 140) * 0.3;
        drawWarpTrail(220, 5, 3);

        const hull = 'oklch(0.84 0.006 230)';
        const hullDark = 'oklch(0.6 0.008 230)';
        const stroke = 'oklch(0.22 0.01 260)';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.7;

        ctx.fillStyle = hull;
        ctx.beginPath(); ctx.ellipse(-12, 0, 26, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'oklch(0.5 0.01 260 / 0.55)';
        ctx.beginPath(); ctx.ellipse(-12, 0, 20, 7.5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-12, 0, 13, 4.5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-12, 0, 6, 2, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = hullDark;
        ctx.beginPath(); ctx.ellipse(-12, 0, 2, 1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = stroke;

        ctx.fillStyle = hullDark;
        ctx.beginPath();
        ctx.moveTo(-6, 3); ctx.lineTo(2, 6); ctx.lineTo(6, 6); ctx.lineTo(0, 2);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.fillStyle = hull;
        ctx.beginPath(); ctx.ellipse(10, 7, 16, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(-5, 7, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'oklch(0.78 0.15 60 / 0.85)';
        ctx.shadowColor = 'oklch(0.78 0.15 60)'; ctx.shadowBlur = 7; ctx.fill();
        ctx.shadowBlur = 0;

        for (const yy of [-13, 13]) {
            ctx.fillStyle = hullDark;
            ctx.beginPath();
            ctx.moveTo(4, 5 * Math.sign(yy)); ctx.lineTo(6, yy * 0.5);
            ctx.lineTo(12, yy); ctx.lineTo(15, yy);
            ctx.lineTo(8, 5 * Math.sign(yy));
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = hull;
            ctx.beginPath();
            const nx = 10, nw = 16, nh = 2.4;
            ctx.moveTo(nx - nw, yy - nh);
            ctx.lineTo(nx + nw, yy - nh);
            ctx.quadraticCurveTo(nx + nw + 3, yy, nx + nw, yy + nh);
            ctx.lineTo(nx - nw, yy + nh);
            ctx.quadraticCurveTo(nx - nw - 3, yy, nx - nw, yy - nh);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = `oklch(0.85 0.2 220 / ${0.5 + pulse * 0.3})`;
            ctx.fillRect(nx - nw + 2, yy - nh * 0.5 - 0.4, nw * 2 - 4, 0.8);
            drawBussard(nx - nw, yy, 2.4, pulse);
        }

        if (Math.floor(Date.now() / 450) % 2) {
            ctx.beginPath(); ctx.arc(-38, 0, 1, 0, Math.PI * 2);
            ctx.fillStyle = 'oklch(0.85 0.22 30)'; ctx.fill();
        }
    }

    function drawVoyager() {
        const pulse = 0.7 + Math.sin(Date.now() / 130) * 0.3;
        drawWarpTrail(190, 4, 2.4);

        const hull = 'oklch(0.83 0.006 230)';
        const hullDark = 'oklch(0.6 0.008 230)';
        const stroke = 'oklch(0.22 0.01 260)';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.7;

        ctx.fillStyle = hull;
        ctx.beginPath();
        ctx.moveTo(-26, 0);
        ctx.quadraticCurveTo(-20, -8, -8, -6);
        ctx.quadraticCurveTo(4, -5, 10, -2.5);
        ctx.lineTo(14, 1);
        ctx.lineTo(10, 4);
        ctx.quadraticCurveTo(4, 7, -8, 6);
        ctx.quadraticCurveTo(-20, 8, -26, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'oklch(0.5 0.01 260 / 0.6)';
        ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(10, 0); ctx.stroke();
        ctx.strokeStyle = stroke;

        ctx.fillStyle = hullDark;
        ctx.beginPath(); ctx.ellipse(8, 1, 10, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(-20, 0, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = 'oklch(0.78 0.16 60 / 0.85)';
        ctx.shadowColor = 'oklch(0.78 0.16 60)'; ctx.shadowBlur = 6; ctx.fill();
        ctx.shadowBlur = 0;

        for (const yy of [-11, 11]) {
            ctx.fillStyle = hullDark;
            ctx.beginPath();
            ctx.moveTo(4, 0); ctx.lineTo(2, yy * 0.5);
            ctx.lineTo(8, yy * 0.95); ctx.lineTo(12, yy);
            ctx.lineTo(14, yy * 0.5); ctx.lineTo(10, 0);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = hull;
            ctx.beginPath();
            const s = yy > 0 ? 1 : -1;
            ctx.moveTo(-2, yy);
            ctx.quadraticCurveTo(-4, yy + 0.2 * -s, -2, yy + 1.8 * s);
            ctx.lineTo(16, yy + 1.4 * s);
            ctx.quadraticCurveTo(20, yy, 16, yy - 1.4 * s);
            ctx.lineTo(-2, yy - 1.8 * s);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            drawBussard(-2, yy, 1.8, pulse);
            drawWarpGlow(20, yy, 1.5, pulse);
        }

        if (Math.floor(Date.now() / 420) % 2) {
            ctx.beginPath(); ctx.arc(-30, 0, 0.9, 0, Math.PI * 2);
            ctx.fillStyle = 'oklch(0.85 0.22 30)'; ctx.fill();
        }
    }

    const SHIP_RENDERERS = {
        enterpriseRefit: drawEnterpriseRefit,
        enterpriseD: drawEnterpriseD,
        voyager: drawVoyager,
    };

    function enabledShipKinds() {
        const out = [];
        if (tweaks.shipEnterpriseRefit) out.push('enterpriseRefit');
        if (tweaks.shipEnterpriseD) out.push('enterpriseD');
        if (tweaks.shipVoyager) out.push('voyager');
        return out;
    }

    function scheduleFlyby() {
        clearTimeout(scheduleTimer);
        if (!tweaks.ships) return;
        const kinds = enabledShipKinds();
        if (!kinds.length) {
            scheduleTimer = setTimeout(scheduleFlyby, 3000);
            return;
        }
        const delay = 6000 + Math.random() * 10000;
        scheduleTimer = setTimeout(() => {
            if (!tweaks.ships) return;
            const list = enabledShipKinds();
            if (!list.length) { scheduleFlyby(); return; }
            const kind = list[Math.floor(Math.random() * list.length)];
            const dir = Math.random() > 0.5 ? 1 : -1;
            const w = window.innerWidth;
            const h = window.innerHeight;
            ships.push({
                kind,
                direction: dir,
                x: dir > 0 ? -80 : w + 80,
                y: 80 + Math.random() * Math.max(120, h - 260),
                seed: Math.random() * 10,
            });
            scheduleFlyby();
        }, delay);
    }

    function draw() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx.clearRect(0, 0, w, h);
        const mx = mouse.x, my = mouse.y;
        const cx = w / 2, cy = h / 2;
        const px = tweaks.parallax && mx > -9000 ? (mx - cx) * 0.012 : 0;
        const py = tweaks.parallax && my > -9000 ? (my - cy) * 0.012 : 0;
        const hue = tweaks.accentHue;

        for (const s of stars) {
            if (tweaks.starTwinkle) {
                s.a += s.da;
                if (s.a < 0.12 || s.a > 0.9) s.da = -s.da;
            }
            const sx = s.x + s.depth * -px;
            const sy = s.y + s.depth * -py;
            const ddx = sx - mx, ddy = sy - my;
            const d2 = ddx * ddx + ddy * ddy;
            const near = d2 < 140 * 140;
            const radius = near ? s.r + (1 - d2 / (140 * 140)) * 1.8 : s.r;
            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, Math.PI * 2);
            ctx.fillStyle = near
                ? `oklch(0.88 0.14 ${hue} / ${Math.min(1, s.a + 0.25)})`
                : `rgba(220, 228, 255, ${s.a * (0.3 + s.depth * 0.7)})`;
            ctx.fill();
            if (near) {
                for (const t of stars) {
                    if (t === s) continue;
                    const tx = t.x + t.depth * -px;
                    const ty = t.y + t.depth * -py;
                    const nx = sx - tx, ny = sy - ty;
                    const nd2 = nx * nx + ny * ny;
                    if (nd2 < 70 * 70) {
                        ctx.strokeStyle = `oklch(0.88 0.14 ${hue} / ${0.18 * (1 - nd2 / (70 * 70))})`;
                        ctx.lineWidth = 0.4;
                        ctx.beginPath();
                        ctx.moveTo(sx, sy);
                        ctx.lineTo(tx, ty);
                        ctx.stroke();
                    }
                }
            }
        }

        if (tweaks.ships) {
            const speedBase = 1.8 * (tweaks.shipSpeed || 1);
            const remaining = [];
            for (const ship of ships) {
                ship.x += speedBase * ship.direction;
                ship.y += Math.sin(ship.x * 0.005 + ship.seed) * 0.3;
                ctx.save();
                ctx.translate(ship.x, ship.y);
                if (ship.direction > 0) ctx.scale(-1, 1);
                const renderer = SHIP_RENDERERS[ship.kind];
                if (renderer) renderer();
                ctx.restore();
                if (ship.x > -160 && ship.x < w + 160) remaining.push(ship);
            }
            ships = remaining;
        } else {
            ships = [];
        }

        raf = requestAnimationFrame(draw);
    }
    draw();
    scheduleFlyby();

    // ── Tweaks panel wiring ──────────────────────────────────────────
    const toggleBtn = document.getElementById('tweaks-toggle');
    const panelBody = document.getElementById('tweaks-body');
    toggleBtn.addEventListener('click', () => {
        const open = panelBody.hasAttribute('hidden');
        if (open) panelBody.removeAttribute('hidden');
        else panelBody.setAttribute('hidden', '');
        toggleBtn.setAttribute('aria-expanded', String(open));
    });

    function formatVal(key, v) {
        if (key === 'accentHue') return `${v}°`;
        if (key === 'shipSpeed') return `${Number(v).toFixed(2)}×`;
        return String(v);
    }

    document.querySelectorAll('[data-tweak]').forEach((input) => {
        const key = input.dataset.tweak;
        if (!(key in tweaks)) return;
        if (input.type === 'checkbox') {
            input.checked = !!tweaks[key];
            input.addEventListener('change', () => {
                tweaks[key] = input.checked;
                persist();
                applyGlobalTweaks();
                if (key === 'starDensity') resize();
                if (['ships', 'shipEnterpriseRefit', 'shipEnterpriseD', 'shipVoyager'].includes(key)) scheduleFlyby();
            });
        } else if (input.type === 'range') {
            input.value = String(tweaks[key]);
            const valEl = document.querySelector(`[data-val="${key}"]`);
            if (valEl) valEl.textContent = formatVal(key, tweaks[key]);
            input.addEventListener('input', () => {
                const v = input.step && input.step.includes('.') ? parseFloat(input.value) : parseInt(input.value, 10);
                tweaks[key] = v;
                if (valEl) valEl.textContent = formatVal(key, v);
                persist();
                applyGlobalTweaks();
                if (key === 'starDensity') resize();
            });
        }
    });
})();
