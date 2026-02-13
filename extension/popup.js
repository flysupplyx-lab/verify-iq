// Verify.IQ V3 Chrome Extension — Popup Script
// Tab switching, API calls, social analysis, dark web scanner,
// dropship detector, rug pull scanner, deepfake, ad transparency

const DEFAULT_API_URL = 'http://localhost:3000';

// ===== STATE =====
let currentTab = 'scan';
let settings = { apiUrl: DEFAULT_API_URL, apiKey: '' };
let isPro = true; // Enabled for demo purposes
let scanStartTime = 0;
let totalScans = 0;
let selectedChain = 'ethereum';
let selectedContext = 'general_risk';

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    // Load settings
    try {
        const stored = await chrome.storage.local.get(['apiUrl', 'apiKey', 'isPro', 'totalScans']);
        if (stored.apiUrl) settings.apiUrl = stored.apiUrl;
        if (stored.apiKey) settings.apiKey = stored.apiKey;
        totalScans = stored.totalScans || 0;
    } catch (e) { console.log('Running in dev mode'); }

    updateProUI();

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Scan
    document.getElementById('scanBtn').addEventListener('click', scanUrl);
    const urlInput = document.getElementById('urlInput');
    if (urlInput) {
        urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') scanUrl(); });
    }

    // Social Authenticity
    const socialScanBtn = document.getElementById('socialScanBtn');
    if (socialScanBtn) socialScanBtn.addEventListener('click', runSocialAnalysis);

    // Dark Web
    const darkwebScanBtn = document.getElementById('darkwebScanBtn');
    if (darkwebScanBtn) darkwebScanBtn.addEventListener('click', scanDarkWeb);
    const darkwebInput = document.getElementById('darkwebInput');
    if (darkwebInput) darkwebInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') scanDarkWeb(); });

    // Dropship
    const dropshipBtn = document.getElementById('dropshipBtn');
    if (dropshipBtn) dropshipBtn.addEventListener('click', runDropshipCheck);

    // Rug Pull
    const rugPullBtn = document.getElementById('rugPullBtn');
    if (rugPullBtn) rugPullBtn.addEventListener('click', runRugPullCheck);

    // Chain selection chips
    document.querySelectorAll('.chain-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chain-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedChain = chip.dataset.chain;
        });
    });

    // Deepfake
    const deepfakeBtn = document.getElementById('deepfakeBtn');
    if (deepfakeBtn) deepfakeBtn.addEventListener('click', runDeepfakeCheck);

    // Ad Transparency
    const adTransparencyBtn = document.getElementById('adTransparencyBtn');
    if (adTransparencyBtn) adTransparencyBtn.addEventListener('click', runAdTransparencyCheck);


    // AI Agent
    const agentScanBtn = document.getElementById('agentScanBtn');
    if (agentScanBtn) agentScanBtn.addEventListener('click', runAgentAnalysis);


    document.querySelectorAll('.context-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.context-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedContext = chip.dataset.context;
        });
    });

    // Settings
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);

    document.getElementById('closeSettingsBtn')?.addEventListener('click', closeSettings);
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettings);
    document.getElementById('clearHistoryBtn')?.addEventListener('click', clearHistory);

    // Close on outside click
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('settingsModal');
        if (e.target === modal) closeSettings();
    });

    // Load History
    loadHistory();

    // Pro Upgrade
    document.querySelectorAll('.upgrade-link').forEach(link => {
        link.addEventListener('click', () => {
            window.open('https://verifyiq.io/pricing', '_blank');
        });
    });

    // Auto-fill current tab URL
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url && tab.url.startsWith('http')) {
            const input = document.getElementById('urlInput');
            if (input) input.value = tab.url;
        }
    } catch (e) { }
});

// ===== API HELPER =====
async function apiCall(endpoint, body) {
    const headers = { 'Content-Type': 'application/json', 'X-Source': 'extension' };
    if (settings.apiKey) headers['X-Api-Key'] = settings.apiKey;

    const response = await fetch(`${settings.apiUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `API error: ${response.status}`);
    }

    return response.json();
}

// ===== SOCIAL ANALYSIS =====
async function runSocialAnalysis() {
    console.log('Verify.IQ: Starting social analysis...');
    const resultContainer = document.getElementById('socialResult');
    resultContainer.style.display = 'block';
    resultContainer.innerHTML = '<div class="loading-pulse">Analyzing Profile DOM...</div>';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('instagram.com') && !tab.url.includes('tiktok.com') && !tab.url.includes('twitter.com') && !tab.url.includes('x.com')) {
        resultContainer.innerHTML = `
            <div class="risk-alert warning">
                <span class="risk-alert-icon">⚠️</span>
                <span>Not a supported social profile.<br><small>Go to an Instagram, TikTok, or X profile page.</small></span>
            </div>`;
        return;
    }

    try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PROFILE_DATA' });

        if (response && response.success && response.data) {
            const result = SocialAnalyzer.calculateIntegrityScore(response.data);
            renderSocialResult(result, response.data);
        } else {
            throw new Error(response.error || 'Failed to extract data');
        }
    } catch (e) {
        console.error(e);
        resultContainer.innerHTML = `
            <div class="risk-alert danger">
                <span class="risk-alert-icon">🚨</span>
                <span>Extraction Failed.<br><small>Refresh the page and try again. (${e.message})</small></span>
            </div>`;
    }
}

function renderSocialResult(result, data) {
    addToHistory('social', data.platform?.toUpperCase() || 'SOCIAL', result.score, result.score + '/100');
    const container = document.getElementById('socialResult');
    const scoreColor = result.score > 80 ? 'var(--accent-green)' : result.score > 50 ? 'var(--accent-orange)' : 'var(--accent-red)';

    let detailsHtml = '';
    if (result.details.penalties.length > 0) {
        detailsHtml += `<div class="analysis-section"><div class="section-title">Risk Factors</div>`;
        result.details.penalties.forEach(p => {
            detailsHtml += `<div class="risk-item"><span class="risk-icon">⚠️</span> ${p.reason} <span class="risk-weight">(${p.weight})</span></div>`;
        });
        detailsHtml += `</div>`;
    }

    if (result.details.bonuses.length > 0) {
        detailsHtml += `<div class="analysis-section"><div class="section-title">Trust Signals</div>`;
        result.details.bonuses.forEach(b => {
            detailsHtml += `<div class="trust-item"><span class="trust-icon">✅</span> ${b.reason} <span class="trust-weight">(+${b.weight})</span></div>`;
        });
        detailsHtml += `</div>`;
    }

    container.innerHTML = `
        <div class="social-score-card">
            <div class="social-header">
                <div class="social-avatar">
                   <div style="width:100%;height:100%;background:#333;display:flex;align-items:center;justify-content:center;font-size:20px;">👤</div>
                </div>
                <div class="social-info">
                    <div class="social-platform">${data.platform?.toUpperCase()} PROFILE</div>
                    <div class="social-stats">
                        <span>${formatCount(data.followers)} Followers</span> • 
                        <span>${formatCount(data.following)} Following</span>
                    </div>
                </div>
            </div>
            
            <div class="realness-meter">
                <div class="meter-label">
                    <span>Realness Score</span>
                    <span style="color:${scoreColor};font-weight:700;">${result.score}/100</span>
                </div>
                <div class="meter-track">
                    <div class="meter-fill" style="width:${result.score}%; background:${scoreColor};"></div>
                </div>
                <div class="meter-verdict">${result.verdict.toUpperCase()}</div>
            </div>
            
            ${detailsHtml}
        </div>
    `;
}

// ===== DROPSHIP CHECK =====
async function runDropshipCheck() {
    const resultContainer = document.getElementById('dropshipResult');
    const productTitle = document.getElementById('dropshipInput').value.trim();
    const price = parseFloat(document.getElementById('dropshipPrice').value) || 0;

    if (!productTitle) {
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = '<div class="risk-alert warning"><span>⚠️</span> Enter a product name to check.</div>';
        return;
    }

    resultContainer.style.display = 'block';
    resultContainer.innerHTML = '<div class="loading-pulse">Analyzing product source...</div>';

    try {
        // Try to get store URL from active tab
        let storeUrl = '';
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            storeUrl = tab?.url || '';
        } catch (e) { }

        const result = await apiCall('/api/dropship-check', {
            product_title: productTitle,
            price,
            store_url: storeUrl
        });

        renderDropshipResult(result);
    } catch (e) {
        resultContainer.innerHTML = `<div class="risk-alert danger"><span>🚨</span> Check failed: ${e.message}</div>`;
    }
}

function renderDropshipResult(data) {
    addToHistory('dropship', data.category || 'Product', 100 - data.likelihood, data.likelihood + '% Risk');
    const container = document.getElementById('dropshipResult');
    const riskClass = data.likelihood >= 70 ? 'risk-critical' : data.likelihood >= 40 ? 'risk-high' : data.likelihood >= 20 ? 'risk-medium' : 'risk-safe';

    let signalsHtml = data.signals.map(s =>
        `<div class="signal-item"><span class="sig-icon">🔸</span><span><strong>${s.name}</strong> — ${s.detail}</span></div>`
    ).join('');

    container.innerHTML = `
        <div class="result-card">
            <h4>Dropship Analysis</h4>
            <div class="result-row">
                <span class="result-label">Likelihood</span>
                <span class="risk-badge ${riskClass}">${data.likelihood}%</span>
            </div>
            <div class="result-row">
                <span class="result-label">Category</span>
                <span class="result-value">${data.category}</span>
            </div>
            ${data.markup_multiplier ? `
            <div class="result-row">
                <span class="result-label">Est. Markup</span>
                <span class="result-value">${data.markup_multiplier.toFixed(1)}x</span>
            </div>` : ''}
            ${data.estimated_source_price ? `
            <div class="result-row">
                <span class="result-label">Est. Source Price</span>
                <span class="result-value">$${data.estimated_source_price.toFixed(2)}</span>
            </div>` : ''}
            <div class="result-row">
                <span class="result-label">Verdict</span>
                <span class="result-value" style="font-size: 11px;">${data.verdict}</span>
            </div>
            <div class="signal-list">${signalsHtml}</div>
            <a href="${data.search_url}" target="_blank" class="action-link">🔍 Search AliExpress</a>
            <a href="${data.alibaba_url}" target="_blank" class="action-link" style="margin-left: 6px;">🏭 Search Alibaba</a>
        </div>
    `;
}

// ===== RUG PULL CHECK =====
async function runRugPullCheck() {
    const resultContainer = document.getElementById('cryptoResult');
    const address = document.getElementById('contractInput').value.trim();

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = '<div class="risk-alert warning"><span>⚠️</span> Enter a valid contract address (0x + 40 hex chars).</div>';
        return;
    }

    resultContainer.style.display = 'block';
    resultContainer.innerHTML = '<div class="loading-pulse">Scanning contract on-chain...</div>';

    try {
        const result = await apiCall('/api/rug-pull-check', {
            address,
            chain: selectedChain
        });

        renderRugPullResult(result);
    } catch (e) {
        resultContainer.innerHTML = `<div class="risk-alert danger"><span>🚨</span> Scan failed: ${e.message}</div>`;
    }
}

function renderRugPullResult(data) {
    const riskScore = data.risk_level === 'safe' ? 90 : data.risk_level === 'medium' ? 50 : 10;
    addToHistory('crypto', data.tokenSymbol || 'Token', riskScore, data.risk_level?.toUpperCase());
    const container = document.getElementById('cryptoResult');
    const riskMap = {
        safe: 'risk-safe', medium: 'risk-medium',
        high: 'risk-high', critical: 'risk-critical',
        unknown: 'risk-medium'
    };
    const riskClass = riskMap[data.risk_level] || 'risk-medium';

    let signalsHtml = (data.signals || []).map(s =>
        `<div class="signal-item"><span class="sig-icon">${data.isHoneypot ? '🚫' : '⚠️'}</span><span><strong>${s.name}</strong> — ${s.detail}</span></div>`
    ).join('');

    container.innerHTML = `
        <div class="result-card">
            <h4>${data.isHoneypot ? '🚫 HONEYPOT DETECTED' : '🔍 Contract Analysis'}</h4>
            <div class="result-row">
                <span class="result-label">Risk Level</span>
                <span class="risk-badge ${riskClass}">${data.risk_level?.toUpperCase()}</span>
            </div>
            ${data.tokenName ? `
            <div class="result-row">
                <span class="result-label">Token</span>
                <span class="result-value">${data.tokenName} (${data.tokenSymbol})</span>
            </div>` : ''}
            <div class="result-row">
                <span class="result-label">Buy Tax</span>
                <span class="result-value">${data.buyTax}%</span>
            </div>
            <div class="result-row">
                <span class="result-label">Sell Tax</span>
                <span class="result-value" style="color: ${data.sellTax > 10 ? '#ef4444' : 'inherit'}">${data.sellTax}%</span>
            </div>
            ${data.liquidity !== null ? `
            <div class="result-row">
                <span class="result-label">Liquidity</span>
                <span class="result-value">$${typeof data.liquidity === 'number' ? data.liquidity.toLocaleString() : data.liquidity}</span>
            </div>` : ''}
            <div class="result-row">
                <span class="result-label">LP Locked</span>
                <span class="result-value">${data.lpLocked ? '✅ Yes' : '❌ No'}</span>
            </div>
            <div class="result-row">
                <span class="result-label">Verdict</span>
                <span class="result-value" style="font-size: 11px;">${data.verdict}</span>
            </div>
            <div class="signal-list">${signalsHtml}</div>
            ${data.manual_check_url ? `<a href="${data.manual_check_url}" target="_blank" class="action-link">🔗 Check on HoneyPot.is</a>` : ''}
        </div>
    `;
}

// ===== DEEPFAKE CHECK =====
async function runDeepfakeCheck() {
    const resultContainer = document.getElementById('deepfakeResult');
    const imageUrl = document.getElementById('deepfakeInput').value.trim();

    if (!imageUrl) {
        // Try to get PFP from current tab's content script
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PFP' });
            if (response?.pfpUrl) {
                document.getElementById('deepfakeInput').value = response.pfpUrl;
                return runDeepfakeCheck(); // Retry with URL
            }
        } catch (e) { }

        resultContainer.style.display = 'block';
        resultContainer.innerHTML = '<div class="risk-alert warning"><span>⚠️</span> Enter an image URL or visit a profile page.</div>';
        return;
    }

    resultContainer.style.display = 'block';
    resultContainer.innerHTML = '<div class="loading-pulse">Analyzing face patterns...</div>';

    try {
        const result = await apiCall('/api/deepfake-check', {
            image_url: imageUrl,
            platform: 'unknown'
        });

        renderDeepfakeResult(result);
    } catch (e) {
        resultContainer.innerHTML = `<div class="risk-alert danger"><span>🚨</span> Check failed: ${e.message}</div>`;
    }
}

function renderDeepfakeResult(data) {
    const score = data.verdict === 'likely_real' ? 90 : 10;
    addToHistory('deepfake', 'Deepfake Scan', score, data.ai_probability);
    const container = document.getElementById('deepfakeResult');
    const verdictColors = {
        likely_ai: '#ef4444',
        possibly_ai: '#f59e0b',
        likely_real: '#10b981'
    };
    const verdictLabels = {
        likely_ai: 'Likely AI-Generated',
        possibly_ai: 'Possibly AI',
        likely_real: 'Likely Real'
    };

    let indicatorsHtml = (data.indicators || []).map(i =>
        `<div class="signal-item"><span class="sig-icon">🔸</span><span>${i}</span></div>`
    ).join('');

    container.innerHTML = `
        <div class="result-card">
            <div class="result-row">
                <span class="result-label">AI Probability</span>
                <span class="risk-badge" style="background: ${verdictColors[data.verdict]}22; color: ${verdictColors[data.verdict]};">${data.ai_probability}%</span>
            </div>
            <div class="result-row">
                <span class="result-label">Verdict</span>
                <span class="result-value" style="color: ${verdictColors[data.verdict]};">${verdictLabels[data.verdict] || data.verdict}</span>
            </div>
            <div class="result-row">
                <span class="result-label">Method</span>
                <span class="result-value">${data.method}</span>
            </div>
            ${indicatorsHtml ? `<div class="signal-list">${indicatorsHtml}</div>` : ''}
            ${data.note ? `<p style="font-size: 10px; color: var(--text-muted); margin-top: 8px;">${data.note}</p>` : ''}
        </div>
    `;
}

// ===== AI AGENT CHECK =====
async function runAgentAnalysis() {
    const resultContainer = document.getElementById('agentResult');
    const input = document.getElementById('agentInput').value.trim();

    if (!input) {
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = '<div class="risk-alert warning"><span>⚠️</span> Please enter text to analyze.</div>';
        return;
    }

    resultContainer.style.display = 'block';
    resultContainer.innerHTML = '<div class="loading-pulse">Consulting AI Agent...</div>';

    try {
        const result = await apiCall('/api/agent-scan', {
            context: selectedContext,
            data: { input }
        });

        renderAgentResult(result);
    } catch (e) {
        resultContainer.innerHTML = `<div class="risk-alert danger"><span>🚨</span> Agent Error: ${e.message}</div>`;
    }
}

function renderAgentResult(data) {
    const container = document.getElementById('agentResult');

    // Formatting verdict color
    const score = data.risk_score || data.authenticity_score || data.probability || 0;
    let color = '#0A84FF';
    if (selectedContext === 'general_risk') {
        color = score > 70 ? '#FF375F' : score > 30 ? '#FF9F0A' : '#30D158'; // High risk = red
    } else if (selectedContext === 'social_audit') {
        color = score > 70 ? '#30D158' : '#FF375F'; // High authenticity = green
    }

    let detailsHtml = '';
    if (data.specific_concerns && data.specific_concerns.length) {
        detailsHtml = data.specific_concerns.map(c => `<li>${c}</li>`).join('');
    } else if (data.flags && data.flags.length) {
        detailsHtml = data.flags.map(f => `<li>${f}</li>`).join('');
    }

    container.innerHTML = `
        <div style="padding: 12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0;">Analysis Result</h4>
                <div class="risk-badge" style="background:${color}; color:white;">${score}/100</div>
            </div>
            <p style="font-size:13px; margin: 10px 0; font-weight: 500;">${data.verdict || data.reasoning}</p>
            ${detailsHtml ? `<ul style="font-size:12px; padding-left:20px; color:var(--text-muted);">${detailsHtml}</ul>` : ''}
        </div>
    `;
}

// ===== AD TRANSPARENCY CHECK =====
async function runAdTransparencyCheck() {
    const resultContainer = document.getElementById('adResult');
    let username = document.getElementById('adUsernameInput').value.trim().replace(/^@/, '');

    if (!username) {
        // Try to extract from current tab
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const urlMatch = tab.url.match(/(?:instagram\.com|tiktok\.com|twitter\.com|x\.com)\/@?([^/?]+)/);
            if (urlMatch) username = urlMatch[1];
        } catch (e) { }

        if (!username) {
            resultContainer.style.display = 'block';
            resultContainer.innerHTML = '<div class="risk-alert warning"><span>⚠️</span> Enter a username or visit a profile page.</div>';
            return;
        }
        document.getElementById('adUsernameInput').value = username;
    }

    resultContainer.style.display = 'block';
    resultContainer.innerHTML = '<div class="loading-pulse">Checking ad libraries...</div>';

    try {
        // Try to get bio from content script for better analysis
        let bio = '';
        let followers = 0;
        let platform = 'unknown';
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PROFILE_DATA' });
            if (response?.success && response.data) {
                bio = response.data.bio || '';
                followers = response.data.followers || 0;
                platform = response.data.platform || 'unknown';
            }
        } catch (e) { }

        const result = await apiCall('/api/ad-transparency', {
            username,
            platform,
            bio,
            followers
        });

        renderAdTransparencyResult(result);
    } catch (e) {
        resultContainer.innerHTML = `<div class="risk-alert danger"><span>🚨</span> Check failed: ${e.message}</div>`;
    }
}

function renderAdTransparencyResult(data) {
    addToHistory('intel', 'Ad Check', 100 - data.ad_likelihood, data.ad_likelihood + '% Ad Prob');
    const container = document.getElementById('adResult');
    const riskClass = data.ad_likelihood >= 70 ? 'risk-critical' : data.ad_likelihood >= 40 ? 'risk-high' : data.ad_likelihood >= 20 ? 'risk-medium' : 'risk-safe';

    let funnelHtml = (data.funnel_indicators || []).map(f =>
        `<div class="signal-item"><span class="sig-icon">🎯</span><span>${f}</span></div>`
    ).join('');

    container.innerHTML = `
        <div class="result-card">
            <div class="result-row">
                <span class="result-label">Ad Likelihood</span>
                <span class="risk-badge ${riskClass}">${data.ad_likelihood}%</span>
            </div>
            <div class="result-row">
                <span class="result-label">Running Ads?</span>
                <span class="result-value">${data.is_running_ads ? '📢 Yes' : '❌ No'}</span>
            </div>
            ${data.ad_count > 0 ? `
            <div class="result-row">
                <span class="result-label">Est. Active Ads</span>
                <span class="result-value">${data.ad_count}</span>
            </div>` : ''}
            ${data.ad_platforms?.length > 0 ? `
            <div class="result-row">
                <span class="result-label">Platforms</span>
                <span class="result-value" style="font-size: 11px;">${data.ad_platforms.join(', ')}</span>
            </div>` : ''}
            <div class="result-row">
                <span class="result-label">Verdict</span>
                <span class="result-value" style="font-size: 11px;">${data.verdict}</span>
            </div>
            ${funnelHtml ? `<div class="signal-list">${funnelHtml}</div>` : ''}
            <a href="${data.ad_library_url}" target="_blank" class="action-link">📖 Meta Ad Library</a>
            <a href="${data.tiktok_creative_url}" target="_blank" class="action-link" style="margin-left: 6px;">🎵 TikTok Ads</a>
        </div>
    `;
}

// ===== STANDARD SCAN & UTILS =====
function formatCount(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.remove('active');
        if (c.id === `${tabName}Panel`) c.classList.add('active');
    });
}

function updateProUI() {
    // Logic to hide/show pro features if gating them
}

async function scanUrl() {
    const urlInput = document.getElementById('urlInput');
    const url = urlInput?.value.trim();
    if (!url) return;

    const trustScore = document.getElementById('trustScore');
    trustScore.textContent = '...';

    try {
        const result = await apiCall('/api/scan-url', { url });
        if (result.trust_score !== undefined) {
            trustScore.textContent = result.trust_score;
            addToHistory('scan', url, result.trust_score, result.trust_score + '/100');
        }
    } catch (e) {
        console.error('Scan failed:', e);
        trustScore.textContent = '??';
    }
}

async function scanDarkWeb() {
    const input = document.getElementById('darkwebInput');
    const query = input?.value.trim();
    if (!query) return;

    try {
        const result = await apiCall('/api/darkweb-scan', { query });
        console.log('Dark web result:', result);
    } catch (e) {
        console.error('Dark web scan failed:', e);
    }
}

// ===== SETTINGS & HISTORY LOGIC =====
function openSettings() {
    const modal = document.getElementById('settingsModal');
    const apiUrlInput = document.getElementById('apiUrlInput');
    const apiKeyInput = document.getElementById('apiKeyInput');

    if (apiUrlInput) apiUrlInput.value = settings.apiUrl;
    if (apiKeyInput) apiKeyInput.value = settings.apiKey;
    if (modal) modal.classList.add('active');
}

function closeSettings() {
    document.getElementById('settingsModal')?.classList.remove('active');
}

async function saveSettings() {
    const apiUrlInput = document.getElementById('apiUrlInput');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveBtn = document.getElementById('saveSettingsBtn');

    const newUrl = apiUrlInput.value.trim().replace(/\/$/, '') || DEFAULT_API_URL;
    const newKey = apiKeyInput.value.trim();

    await chrome.storage.local.set({ apiUrl: newUrl, apiKey: newKey });
    settings.apiUrl = newUrl;
    settings.apiKey = newKey;

    if (saveBtn) {
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="btn-text">SAVED!</span>';
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            closeSettings();
        }, 1000);
    }
}

// History
let scanHistory = [];

async function loadHistory() {
    const stored = await chrome.storage.local.get(['scanHistory']);
    scanHistory = stored.scanHistory || [];
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('activityList');
    if (!list) return;

    if (scanHistory.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🔍</span>
                <span class="empty-text">No scans yet. Paste a URL above to begin.</span>
            </div>`;
        return;
    }

    list.innerHTML = scanHistory.map(item => `
        <div class="activity-item">
            <div class="activity-dot ${getScoreColorClass(item.score)}"></div>
            <div class="activity-info">
                <div class="activity-text">${item.label}</div>
                <div class="activity-time">${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div class="history-score ${getScoreColorClass(item.score)}">${item.scoreLabel}</div>
        </div>
    `).join('');
}

function getScoreColorClass(score) {
    if (typeof score === 'number') {
        if (score >= 80) return 'dot-green';
        if (score >= 50) return 'dot-purple'; // Changed to fit palette
        return 'dot-red';
    }
    // String mapping
    if (score === 'high') return 'dot-green';
    if (score === 'med') return 'dot-purple';
    if (score === 'low') return 'dot-red';
    return 'dot-purple';
}

async function addToHistory(type, label, score, scoreLabel) {
    const newItem = {
        type,
        label,
        score, // number (0-100) or 'high'/'low' for color
        scoreLabel, // text to display
        timestamp: Date.now()
    };

    scanHistory.unshift(newItem);
    if (scanHistory.length > 20) scanHistory.pop(); // Keep last 20

    await chrome.storage.local.set({ scanHistory });
    renderHistory();
}

async function clearHistory() {
    scanHistory = [];
    await chrome.storage.local.set({ scanHistory });
    renderHistory();
}
