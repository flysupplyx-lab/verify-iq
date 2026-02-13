// Verify.IQ V3 — Background Service Worker
// Handles context menus, URL scanning, and all module routing

const DEFAULT_API_URL = 'http://localhost:3000';

// ===== SETTINGS =====
async function getApiUrl() {
    try {
        const { apiUrl } = await chrome.storage.local.get(['apiUrl']);
        return apiUrl || DEFAULT_API_URL;
    } catch (e) {
        return DEFAULT_API_URL;
    }
}

async function getApiKey() {
    try {
        const { apiKey } = await chrome.storage.local.get(['apiKey']);
        return apiKey || '';
    } catch (e) {
        return '';
    }
}

// ===== CONTEXT MENUS =====
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'verifyiq-scan-link',
        title: 'Scan with Verify.IQ',
        contexts: ['link'],
    });

    chrome.contextMenus.create({
        id: 'verifyiq-scan-page',
        title: 'Scan this page with Verify.IQ',
        contexts: ['page'],
    });

    chrome.contextMenus.create({
        id: 'verifyiq-detect-ai',
        title: 'Check for AI content',
        contexts: ['selection'],
    });

    chrome.contextMenus.create({
        id: 'verifyiq-verify-email',
        title: 'Verify email: "%s"',
        contexts: ['selection'],
    });

    // Module B: Dropship check on images
    chrome.contextMenus.create({
        id: 'verifyiq-dropship-check',
        title: '🔍 Check if dropshipped',
        contexts: ['image'],
    });

    // Module C: Rug pull check on selected text (contract addresses)
    chrome.contextMenus.create({
        id: 'verifyiq-rug-pull-check',
        title: '🔴 Check contract: "%s"',
        contexts: ['selection'],
    });

    // Module D: Deepfake check on images
    chrome.contextMenus.create({
        id: 'verifyiq-deepfake-check',
        title: '🤖 Check if AI-generated face',
        contexts: ['image'],
    });
});

// ===== CONTEXT MENU HANDLER =====
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const apiUrl = await getApiUrl();
    const apiKey = await getApiKey();

    const headers = { 'Content-Type': 'application/json', 'X-Source': 'extension' };
    if (apiKey) headers['X-Api-Key'] = apiKey;

    try {
        if (info.menuItemId === 'verifyiq-scan-link') {
            const url = info.linkUrl;
            await sendToTab(tab.id, { type: 'SCAN_LOADING', url });

            const response = await fetch(`${apiUrl}/api/scan-url`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ url }),
            });

            const result = await response.json();
            await sendToTab(tab.id, { type: 'SCAN_RESULT', data: result });
        }

        else if (info.menuItemId === 'verifyiq-scan-page') {
            const url = tab.url;
            await sendToTab(tab.id, { type: 'SCAN_LOADING', url });

            const response = await fetch(`${apiUrl}/api/scan-url`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ url }),
            });

            const result = await response.json();
            await sendToTab(tab.id, { type: 'SCAN_RESULT', data: result });
        }

        else if (info.menuItemId === 'verifyiq-detect-ai') {
            const text = info.selectionText;
            if (!text || text.length < 20) {
                await sendToTab(tab.id, { type: 'ERROR', error: 'Please select at least 20 characters' });
                return;
            }

            await sendToTab(tab.id, { type: 'AI_LOADING' });

            const response = await fetch(`${apiUrl}/api/detect-ai`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ text }),
            });

            const result = await response.json();
            await sendToTab(tab.id, { type: 'AI_RESULT', data: result });
        }

        else if (info.menuItemId === 'verifyiq-verify-email') {
            const email = info.selectionText?.trim();
            if (!email || !email.includes('@')) {
                await sendToTab(tab.id, { type: 'ERROR', error: 'Please select a valid email address' });
                return;
            }

            await sendToTab(tab.id, { type: 'EMAIL_LOADING' });

            const response = await fetch(`${apiUrl}/api/verify-email`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ email }),
            });

            const result = await response.json();
            await sendToTab(tab.id, { type: 'EMAIL_RESULT', data: result });
        }

        // Module B: Dropship check (from image context menu)
        else if (info.menuItemId === 'verifyiq-dropship-check') {
            await sendToTab(tab.id, { type: 'SCAN_LOADING', url: 'Checking product source...' });

            // Ask content script for product data
            const productResp = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_DROPSHIP' });

            if (productResp?.success && productResp.product) {
                const response = await fetch(`${apiUrl}/api/dropship-check`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        product_title: productResp.product.title,
                        price: productResp.product.price,
                        image_url: info.srcUrl || productResp.product.imageUrl,
                        store_url: productResp.product.storeUrl,
                        currency: productResp.product.currency
                    }),
                });

                const result = await response.json();
                await sendToTab(tab.id, { type: 'DROPSHIP_RESULT', data: result });
            } else {
                await sendToTab(tab.id, { type: 'ERROR', error: 'Could not extract product data. Make sure you are on a product page.' });
            }
        }

        // Module C: Rug pull check (from selected text)
        else if (info.menuItemId === 'verifyiq-rug-pull-check') {
            const text = info.selectionText?.trim();
            const ethMatch = text?.match(/0x[a-fA-F0-9]{40}/);

            if (!ethMatch) {
                await sendToTab(tab.id, { type: 'ERROR', error: 'No valid contract address found in selection' });
                return;
            }

            await sendToTab(tab.id, { type: 'SCAN_LOADING', url: `Checking contract ${ethMatch[0].slice(0, 10)}...` });

            const response = await fetch(`${apiUrl}/api/rug-pull-check`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ address: ethMatch[0], chain: 'ethereum' }),
            });

            const result = await response.json();
            await sendToTab(tab.id, { type: 'RUG_PULL_RESULT', data: result });
        }

        // Module D: Deepfake check (from image context menu)
        else if (info.menuItemId === 'verifyiq-deepfake-check') {
            await sendToTab(tab.id, { type: 'SCAN_LOADING', url: 'Analyzing face for AI patterns...' });

            const response = await fetch(`${apiUrl}/api/deepfake-check`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    image_url: info.srcUrl,
                    platform: detectPlatformFromUrl(tab.url)
                }),
            });

            const result = await response.json();
            await sendToTab(tab.id, { type: 'DEEPFAKE_RESULT', data: result });
        }
    } catch (error) {
        console.error('Verify.IQ context menu error:', error);
        await sendToTab(tab.id, {
            type: 'ERROR',
            error: `Connection failed. Is the API running at ${apiUrl}?`,
        });
    }
});

// ===== MESSAGE HANDLER FROM CONTENT SCRIPTS =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DROPSHIP_CHECK') {
        // Triggered by floating badge click in content script
        handleDropshipCheck(message.data, sender.tab?.id);
    }
    if (message.type === 'RUG_PULL_AUTO_CHECK') {
        // Auto-triggered by content script on crypto pages
        handleRugPullAutoCheck(message.address, message.chain, sender.tab?.id);
    }
});

async function handleDropshipCheck(productData, tabId) {
    if (!tabId) return;
    const apiUrl = await getApiUrl();
    const apiKey = await getApiKey();
    const headers = { 'Content-Type': 'application/json', 'X-Source': 'extension' };
    if (apiKey) headers['X-Api-Key'] = apiKey;

    try {
        const response = await fetch(`${apiUrl}/api/dropship-check`, {
            method: 'POST',
            headers,
            body: JSON.stringify(productData),
        });
        const result = await response.json();
        await sendToTab(tabId, { type: 'DROPSHIP_RESULT', data: result });
    } catch (e) {
        await sendToTab(tabId, { type: 'ERROR', error: 'Dropship check failed' });
    }
}

async function handleRugPullAutoCheck(address, chain, tabId) {
    if (!tabId) return;
    const apiUrl = await getApiUrl();
    const apiKey = await getApiKey();
    const headers = { 'Content-Type': 'application/json', 'X-Source': 'extension' };
    if (apiKey) headers['X-Api-Key'] = apiKey;

    try {
        const response = await fetch(`${apiUrl}/api/rug-pull-check`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ address, chain: chain || 'ethereum' }),
        });
        const result = await response.json();
        await sendToTab(tabId, { type: 'RUG_PULL_RESULT', data: result });
    } catch (e) {
        console.warn('Auto rug pull check failed:', e.message);
    }
}

// ===== HELPERS =====
function detectPlatformFromUrl(url) {
    if (!url) return 'unknown';
    const u = url.toLowerCase();
    if (u.includes('instagram.com')) return 'instagram';
    if (u.includes('tiktok.com')) return 'tiktok';
    if (u.includes('twitter.com') || u.includes('x.com')) return 'x';
    if (u.includes('facebook.com')) return 'facebook';
    return 'unknown';
}

async function sendToTab(tabId, message) {
    try {
        await chrome.tabs.sendMessage(tabId, message);
    } catch (e) {
        // Content script may not be injected yet — try to inject it
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content.js'],
            });
            await chrome.scripting.insertCSS({
                target: { tabId },
                files: ['content.css'],
            });
            // Retry sending the message
            setTimeout(async () => {
                try {
                    await chrome.tabs.sendMessage(tabId, message);
                } catch (e2) {
                    console.error('Failed to send message after injection:', e2);
                }
            }, 300);
        } catch (injectError) {
            console.error('Failed to inject content script:', injectError);
        }
    }
}
