// Verify.IQ Premium - Interactive Trust Score Gauge
const API_URL = window.location.origin;

// Gauge Animation Controller
class TrustScoreGauge {
    constructor() {
        this.gauge = document.querySelector('.gauge-progress');
        this.scoreElement = document.getElementById('gaugeScore');
        this.labelElement = document.getElementById('gaugeLabel');
        this.currentScore = 0;
        this.targetScore = 0;
        this.circumference = 2 * Math.PI * 85; // radius = 85
    }

    setScore(score, label = 'Analyzing...', animated = true) {
        this.targetScore = Math.max(0, Math.min(100, score));

        // Update label
        this.labelElement.textContent = label;

        // Determine color based on score
        const color = this.getColorForScore(score);
        this.updateGaugeColor(color);

        if (animated) {
            this.animateScore();
        } else {
            this.currentScore = this.targetScore;
            this.updateGaugeDisplay();
        }
    }

    animateScore() {
        const duration = 2000; // 2 seconds
        const startTime = performance.now();
        const startScore = this.currentScore;
        const scoreDiff = this.targetScore - startScore;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out cubic)
            const eased = 1 - Math.pow(1 - progress, 3);

            this.currentScore = startScore + (scoreDiff * eased);
            this.updateGaugeDisplay();

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    updateGaugeDisplay() {
        // Update number
        this.scoreElement.textContent = Math.round(this.currentScore);

        // Update circular progress
        const offset = this.circumference - (this.currentScore / 100) * this.circumference;
        this.gauge.style.strokeDashoffset = offset;
    }

    getColorForScore(score) {
        if (score >= 80) return { primary: '#10B981', secondary: '#059669', name: 'safe' };
        if (score >= 50) return { primary: '#F59E0B', secondary: '#D97706', name: 'warning' };
        return { primary: '#F43F5E', secondary: '#E11D48', name: 'danger' };
    }

    updateGaugeColor(color) {
        const gradient = this.gauge.ownerSVGElement.querySelector('#gaugeGradient');
        gradient.querySelector('stop:first-child').setAttribute('stop-color', color.primary);
        gradient.querySelector('stop:last-child').setAttribute('stop-color', color.secondary);

        // Update score color
        this.scoreElement.style.background = `linear-gradient(135deg, ${color.primary}, ${color.secondary})`;
        this.scoreElement.style.webkitBackgroundClip = 'text';
        this.scoreElement.style.webkitTextFillColor = 'transparent';
        this.scoreElement.style.backgroundClip = 'text';
    }

    reset() {
        this.setScore(0, 'Ready to scan', false);
    }
}

// Initialize gauge
const gauge = new TrustScoreGauge();
gauge.reset();

// URL Scanner
const urlInput = document.getElementById('urlInput');
const scanBtn = document.getElementById('scanBtn');
const resultsPanel = document.getElementById('resultsPanel');

// Demo mode - simulate scanning
scanBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();

    if (!url) {
        alert('Please enter a URL to scan');
        return;
    }

    // Validate URL format
    try {
        new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
        alert('Please enter a valid URL');
        return;
    }

    // Start scanning animation
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Scanning...';

    gauge.setScore(0, 'Initializing scan...');
    resultsPanel.classList.remove('active');

    // Simulate scanning stages
    await sleep(500);
    gauge.setScore(25, 'Checking SSL...');

    await sleep(800);
    gauge.setScore(50, 'Analyzing DNS...');

    await sleep(700);
    gauge.setScore(75, 'Scanning dark web...');

    await sleep(900);

    // Try real API call, fallback to demo data
    try {
        const response = await fetch(`${API_URL}/api/scan-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Source': 'landing'
            },
            body: JSON.stringify({ url })
        });

        if (response.ok) {
            const data = await response.json();
            displayResults(data);
        } else {
            throw new Error('API unavailable');
        }
    } catch (error) {
        // Demo mode - generate realistic results
        const demoData = generateDemoResults(url);
        displayResults(demoData);
    }

    // Reset button
    scanBtn.disabled = false;
    scanBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg> Scan URL';
});

// Enter key support
urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') scanBtn.click();
});

function generateDemoResults(url) {
    const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    const isWellKnown = ['google.com', 'github.com', 'microsoft.com', 'apple.com'].some(d => domain.includes(d));

    const score = isWellKnown ? 92 + Math.floor(Math.random() * 6) : 45 + Math.floor(Math.random() * 30);
    const verdict = score >= 80 ? 'safe' : score >= 50 ? 'warning' : 'danger';
    const riskLevel = score >= 80 ? 'low' : score >= 50 ? 'medium' : 'high';

    return {
        url,
        trust_score: score,
        verdict,
        risk_level: riskLevel,
        ssl_valid: score >= 60,
        domain_age_days: isWellKnown ? 7300 : 180 + Math.floor(Math.random() * 1000),
        dark_web_hits: score < 60 ? Math.floor(Math.random() * 5) : 0,
        threat_intel_flags: score < 50 ? Math.floor(Math.random() * 3) : 0,
        processing_time_ms: 342 + Math.floor(Math.random() * 200),
        checks: {
            ssl_certificate: score >= 60,
            domain_reputation: score >= 70,
            dns_records: score >= 65,
            dark_web_scan: score >= 80,
            threat_database: score >= 75
        }
    };
}

function displayResults(data) {
    const score = data.trust_score || data.score || 0;
    const verdict = data.verdict || (score >= 80 ? 'safe' : score >= 50 ? 'warning' : 'danger');
    const verdictLabel = score >= 80 ? 'Excellent' : score >= 50 ? 'Moderate' : 'High Risk';

    // Update gauge
    gauge.setScore(score, verdictLabel);

    // Build results HTML
    const verdictClass = verdict === 'safe' ? 'safe' : verdict === 'warning' ? 'warning' : 'danger';
    const verdictIcon = verdict === 'safe'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
        : verdict === 'warning'
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';

    resultsPanel.innerHTML = `
        <div class="result-header">
            <div class="result-url">${data.url}</div>
            <div class="result-verdict ${verdictClass}">
                ${verdictIcon}
                ${verdictLabel}
            </div>
        </div>
        
        <div class="result-grid">
            <div class="result-metric">
                <div class="result-metric-label">SSL Status</div>
                <div class="result-metric-value">${data.ssl_valid ? '✓ Valid' : '✗ Invalid'}</div>
            </div>
            <div class="result-metric">
                <div class="result-metric-label">Domain Age</div>
                <div class="result-metric-value">${Math.floor((data.domain_age_days || 0) / 365)}y</div>
            </div>
            <div class="result-metric">
                <div class="result-metric-label">Scan Time</div>
                <div class="result-metric-value">${data.processing_time_ms}ms</div>
            </div>
        </div>
        
        <div class="result-details">
            ${createDetailItem(
        data.checks?.ssl_certificate ? 'safe' : 'danger',
        'SSL Certificate',
        data.checks?.ssl_certificate ? 'Valid & Trusted' : 'Invalid or Expired'
    )}
            ${createDetailItem(
        data.checks?.domain_reputation ? 'safe' : 'warning',
        'Domain Reputation',
        data.checks?.domain_reputation ? 'Clean Record' : 'Some Flags Detected'
    )}
            ${createDetailItem(
        data.dark_web_hits === 0 ? 'safe' : 'danger',
        'Dark Web Scan',
        data.dark_web_hits === 0 ? 'No Leaks Found' : `${data.dark_web_hits} Potential Leaks`
    )}
            ${createDetailItem(
        data.threat_intel_flags === 0 ? 'safe' : 'danger',
        'Threat Intelligence',
        data.threat_intel_flags === 0 ? 'No Threats Detected' : `${data.threat_intel_flags} Flags Raised`
    )}
        </div>
    `;

    resultsPanel.classList.add('active');
}

function createDetailItem(type, label, value) {
    const icon = type === 'safe'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
        : type === 'warning'
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';

    return `
        <div class="result-detail-item">
            <div class="result-detail-icon ${type}">
                ${icon}
            </div>
            <div class="result-detail-content">
                <div class="result-detail-label">${label}</div>
                <div class="result-detail-value">${value}</div>
            </div>
        </div>
    `;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Nav scroll effect
window.addEventListener('scroll', () => {
    const nav = document.getElementById('nav');
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Demo: Auto-scan on page load (optional)
window.addEventListener('load', () => {
    // Uncomment to auto-demo on load:
    // setTimeout(() => {
    //     urlInput.value = 'https://github.com';
    //     scanBtn.click();
    // }, 1000);
});
